#!/usr/bin/env node
const path = require('node:path');
const { readJsonl, ensureNoGroupLeakage } = require('../../packages/training/dataset');
const { normalizeDecision } = require('../../packages/training/contracts');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '../../model-data/generated'));
const names = ['train', 'valid', 'test'];
const splits = Object.fromEntries(names.map((name) => [name, readJsonl(path.join(dataDir, `${name}-cases.jsonl`))]));
ensureNoGroupLeakage(splits);
const ids = new Set();
for (const [name, rows] of Object.entries(splits)) {
  for (const row of rows) {
    if (!row.id || ids.has(row.id)) throw new Error(`Duplicate or missing case id in ${name}: ${row.id}`);
    if (!normalizeDecision(row.expected)) throw new Error(`Invalid expected decision: ${row.id}`);
    ids.add(row.id);
  }
}
process.stdout.write(`Dataset valid: ${ids.size} cases; no IDs or page groups leak between train, valid, and test.\n`);
