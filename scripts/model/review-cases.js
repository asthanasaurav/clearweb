#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { ACTIONS, CATEGORIES, normalizeDecision } = require('../../packages/training/contracts');
const { readJsonl } = require('../../packages/training/dataset');

async function main() {
  const source = path.resolve(process.argv[2] || path.join(__dirname, '../../model-data/generated/review.jsonl'));
  const destination = path.resolve(process.argv[3] || path.join(__dirname, '../../model-data/human-reviewed.jsonl'));
  const already = new Set(readJsonl(destination).map((record) => record.id));
  const queue = readJsonl(source).filter((record) => !already.has(record.id));
  const rl = readline.createInterface({ input, output });
  let reviewed = 0;
  try {
    for (const record of queue) {
      output.write(`\n${record.id}\n${JSON.stringify(record.input, null, 2)}\nSuggested: ${JSON.stringify(record.expected)}\n`);
      const actionInput = (await rl.question(`Action [${record.expected.action}] (${[...ACTIONS].join('/')}), s=skip, q=quit: `)).trim().toLowerCase();
      if (actionInput === 'q') break;
      if (actionInput === 's') continue;
      const action = actionInput || record.expected.action;
      if (!ACTIONS.has(action)) { output.write('Invalid action; skipped.\n'); continue; }
      const categoryInput = (await rl.question(`Category [${record.expected.category}]: `)).trim().toLowerCase();
      const category = categoryInput || record.expected.category;
      if (!CATEGORIES.has(category)) { output.write('Invalid category; skipped.\n'); continue; }
      const reasonInput = (await rl.question(`Reason [${record.expected.reason}]: `)).trim();
      const expected = normalizeDecision({ action, category, reason: reasonInput || record.expected.reason, confidence: 1 });
      const approved = { ...record, expected, label_status: 'human-reviewed', review_required: false, reviewed_at: new Date().toISOString() };
      fs.appendFileSync(destination, `${JSON.stringify(approved)}\n`, { encoding: 'utf8', mode: 0o600 });
      reviewed += 1;
    }
  } finally { rl.close(); }
  output.write(`\nSaved ${reviewed} human-reviewed case(s) to ${destination}. Re-run pnpm model:data.\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
