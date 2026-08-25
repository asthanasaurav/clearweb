#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { SYSTEM_PROMPT, buildPrompt } = require('../../packages/training/contracts');
const { readJsonl } = require('../../packages/training/dataset');
const { parseDecision, evaluatePredictions } = require('../../packages/training/evaluation');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const endpoint = argument('--endpoint', 'http://127.0.0.1:8080/v1/chat/completions');
  const model = argument('--model', 'mlx-community/Qwen3-1.7B-4bit');
  const input = path.resolve(argument('--input', path.join(__dirname, '../../model-data/generated/test-cases.jsonl')));
  const output = path.resolve(argument('--output', path.join(__dirname, '../../model-data/generated/evaluation-report.json')));
  const limit = Number(argument('--limit', '0'));
  const cases = readJsonl(input).slice(0, limit || undefined);
  const rows = [];
  for (const testCase of cases) {
    const started = Date.now();
    let raw = '', error = '';
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildPrompt(testCase.input) }] }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      raw = body.choices?.[0]?.message?.content || '';
    } catch (cause) { error = cause.message; }
    rows.push({ id: testCase.id, expected: testCase.expected, predicted: parseDecision(raw), raw, error, latency_ms: Date.now() - started });
    process.stdout.write(`${rows.length}/${cases.length} ${testCase.id}\r`);
  }
  const report = { model, endpoint, evaluated_at: new Date().toISOString(), metrics: evaluatePredictions(rows), predictions: rows };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`\nEvaluation written to ${output}\n`);
  process.stdout.write(`${JSON.stringify(report.metrics, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
