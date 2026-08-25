const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sanitizeCapturedRequest, registrableDomain } = require('../packages/training/sanitize');
const { labelRequest } = require('../packages/training/policy');
const { generateSeedCases } = require('../packages/training/scenarios');
const { buildDataset, readJsonl, ensureNoGroupLeakage } = require('../packages/training/dataset');
const { parseDecision, evaluatePredictions } = require('../packages/training/evaluation');
const { LocalCaptureStore } = require('../packages/training/capture-store');

test('sanitizes captures down to hostnames and categorical metadata', () => {
  const record = sanitizeCapturedRequest({ url: 'https://tracker.example/pixel?email=person@example.com&token=secret', resourceType: 'xhr', requestHeaders: { cookie: 'secret' } }, { pageUrl: 'https://shop.example/account/123?session=secret', outcome: 'observed_blocked', source: 'ghostery', listMatches: ['ghostery'] });
  const serialized = JSON.stringify(record);
  assert.equal(record.input.request_domain, 'tracker.example');
  assert.equal(record.input.page_domain, 'shop.example');
  assert.equal(record.input.third_party, true);
  assert.doesNotMatch(serialized, /person|token|cookie|session|account\/123/);
});

test('uses registrable domains for first-party classification', () => {
  assert.equal(registrableDomain('https://cdn.shop.example.co.uk/a.js'), 'example.co.uk');
  const record = sanitizeCapturedRequest({ url: 'https://api.example.co.uk/data', resourceType: 'xhr' }, { pageUrl: 'https://www.example.co.uk' });
  assert.equal(record.input.third_party, false);
  const unknownSource = sanitizeCapturedRequest({ url: 'https://cdn.example/script.js', resourceType: 'script' }, {});
  assert.equal(unknownSource.input.third_party, true);
});

test('routes strong blocker evidence automatically and ambiguous traffic to review', () => {
  const blocked = labelRequest({ input: { page_domain: 'news.test', request_domain: 'securepubads.g.doubleclick.net', resource_type: 'script', third_party: true, list_matches: ['ghostery'] }, evidence: { outcome: 'observed_blocked' } });
  const ambiguous = labelRequest({ input: { page_domain: 'news.test', request_domain: 'unknown.test', resource_type: 'script', third_party: true, list_matches: [], user_context: 'automatic_page_load' }, evidence: { outcome: 'observed_allowed' } });
  assert.equal(blocked.expected.action, 'block');
  assert.equal(blocked.review_required, false);
  assert.equal(ambiguous.expected.action, 'review');
  assert.equal(ambiguous.review_required, true);
});

test('builds reproducible MLX splits without page-domain leakage', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clearweb-model-data-'));
  const result = buildDataset({ seeds: generateSeedCases(), captured: [], outDir });
  assert.equal(result.manifest.counts.input, 448);
  assert.equal(result.manifest.counts.review, 0);
  assert.equal(result.splits.train.length + result.splits.valid.length + result.splits.test.length, 448);
  assert.ok(result.splits.train.length > 0 && result.splits.valid.length > 0 && result.splits.test.length > 0);
  assert.equal(ensureNoGroupLeakage(result.splits), true);
  const mlxRow = readJsonl(path.join(outDir, 'train.jsonl'))[0];
  assert.equal(mlxRow.messages[0].role, 'system');
  assert.equal(mlxRow.messages[2].role, 'assistant');
});

test('capture store is opt-in and writes only sanitized records', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clearweb-capture-'));
  let enabled = false;
  const filePath = path.join(root, 'captured.jsonl');
  const store = new LocalCaptureStore({ filePath, isEnabled: () => enabled });
  assert.equal(store.record({ url: 'https://tracker.example/x?secret=1' }, { pageUrl: 'https://site.test/private' }).saved, false);
  enabled = true;
  assert.equal(store.record({ url: 'https://tracker.example/x?secret=1', resourceType: 'script' }, { pageUrl: 'https://site.test/private' }).saved, true);
  const saved = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(saved, /secret|private/);
  assert.match(saved, /tracker\.example/);
});

test('evaluation reports invalid JSON and false blocks', () => {
  const parsed = parseDecision('```json\n{"action":"allow","category":"essential","reason":"needed","confidence":0.9}\n```');
  assert.equal(parsed.action, 'allow');
  const metrics = evaluatePredictions([
    { id: 'a', expected: { action: 'allow', category: 'essential', reason: 'gold', confidence: 1 }, predicted: parsed, latency_ms: 10 },
    { id: 'b', expected: { action: 'review', category: 'unknown', reason: 'gold', confidence: 1 }, predicted: { action: 'block', category: 'tracking', reason: 'wrong', confidence: 0.8 }, latency_ms: 20 },
    { id: 'c', expected: { action: 'block', category: 'tracking', reason: 'gold', confidence: 1 }, predicted: null, latency_ms: 30 }
  ]);
  assert.equal(metrics.valid_json_rate, 2 / 3);
  assert.equal(metrics.false_block_rate, 1 / 2);
  assert.equal(metrics.latency_ms.p95, 30);
});
