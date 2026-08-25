const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeDecision, toMlxRecord } = require('./contracts');
const { captureFingerprint, registrableDomain } = require('./sanitize');
const { labelRequest, POLICY_VERSION } = require('./policy');

function readJsonl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
  });
}

function stableScore(value) {
  return Number.parseInt(crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8), 16) / 0xffffffff;
}

function normalizeCase(record) {
  const provided = normalizeDecision(record.expected);
  const derived = provided ? null : labelRequest(record);
  const expected = provided || derived.expected;
  return {
    ...record,
    page_group: record.page_group || registrableDomain(record.input?.page_domain) || 'unknown',
    expected,
    policy_version: record.policy_version || POLICY_VERSION,
    label_status: record.label_status || derived?.label_status || 'unreviewed',
    review_required: Boolean(record.review_required ?? derived?.review_required)
  };
}

function deduplicate(records) {
  const accepted = new Map();
  const conflicted = new Set();
  const review = [];
  for (const raw of records) {
    const current = normalizeCase(raw);
    const key = captureFingerprint(current);
    if (conflicted.has(key)) { review.push({ ...current, review_reason: 'Additional record for a fingerprint with conflicting labels' }); continue; }
    const previous = accepted.get(key);
    if (!previous) { accepted.set(key, current); continue; }
    if (previous.expected.action !== current.expected.action || previous.expected.category !== current.expected.category) {
      accepted.delete(key);
      conflicted.add(key);
      review.push({ ...current, review_reason: 'Conflicting labels for the same request fingerprint', conflicting_case_ids: [previous.id, current.id] });
      continue;
    }
    const preferred = previous.label_status === 'synthetic-reviewed' || previous.label_status === 'human-reviewed' ? previous : current;
    accepted.set(key, preferred);
  }
  return { cases: [...accepted.values()], review };
}

function splitByPageGroup(cases) {
  const splits = { train: [], valid: [], test: [] };
  const groups = new Map();
  for (const item of cases) {
    if (!groups.has(item.page_group)) groups.set(item.page_group, []);
    groups.get(item.page_group).push(item);
  }
  const ordered = [...groups.entries()].sort((a, b) => stableScore(a[0]) - stableScore(b[0]));
  const trainGroups = ordered.length >= 3 ? Math.min(ordered.length - 2, Math.max(1, Math.floor(ordered.length * 0.70))) : Math.min(1, ordered.length);
  const validGroups = ordered.length >= 3 ? Math.min(ordered.length - trainGroups - 1, Math.max(1, Math.floor(ordered.length * 0.15))) : 0;
  ordered.forEach(([, records], index) => {
    const split = index < trainGroups ? 'train' : index < trainGroups + validGroups ? 'valid' : 'test';
    splits[split].push(...records);
  });
  return splits;
}

function ensureNoGroupLeakage(splits) {
  const owners = new Map();
  for (const [split, records] of Object.entries(splits)) {
    for (const record of records) {
      const previous = owners.get(record.page_group);
      if (previous && previous !== split) throw new Error(`Page-group leakage: ${record.page_group} occurs in ${previous} and ${split}`);
      owners.set(record.page_group, split);
    }
  }
  return true;
}

function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''));
}

function buildDataset({ seeds = [], captured = [], outDir }) {
  const normalized = [...seeds, ...captured].map(normalizeCase);
  const approvedFingerprints = new Set(normalized.filter((item) => item.label_status === 'human-reviewed').map(captureFingerprint));
  const filtered = normalized.filter((item) => item.label_status === 'human-reviewed' || !approvedFingerprints.has(captureFingerprint(item)));
  const preReview = filtered.filter((item) => item.review_required && !['human-reviewed', 'synthetic-reviewed'].includes(item.label_status));
  const candidates = filtered.filter((item) => !preReview.includes(item));
  const { cases, review: conflicts } = deduplicate(candidates);
  const splits = splitByPageGroup(cases);
  ensureNoGroupLeakage(splits);
  for (const [name, records] of Object.entries(splits)) {
    writeJsonl(path.join(outDir, `${name}.jsonl`), records.map(toMlxRecord));
    writeJsonl(path.join(outDir, `${name}-cases.jsonl`), records);
  }
  const review = [...preReview, ...conflicts];
  writeJsonl(path.join(outDir, 'review.jsonl'), review);
  const actionCounts = (records) => records.reduce((counts, record) => ({ ...counts, [record.expected.action]: (counts[record.expected.action] || 0) + 1 }), {});
  const manifest = {
    schema_version: 1,
    policy_version: POLICY_VERSION,
    counts: { input: normalized.length, train: splits.train.length, valid: splits.valid.length, test: splits.test.length, review: review.length },
    action_counts: { train: actionCounts(splits.train), valid: actionCounts(splits.valid), test: actionCounts(splits.test) },
    split_strategy: 'stable SHA-256 assignment by registrable page domain; 70/15/15 targets',
    privacy: 'Hostnames and categorical request metadata only; paths, queries, headers, cookies, and bodies are excluded.'
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { splits, review, manifest };
}

module.exports = { readJsonl, stableScore, normalizeCase, deduplicate, splitByPageGroup, ensureNoGroupLeakage, buildDataset };
