#!/usr/bin/env node
const path = require('node:path');
const { generateSeedCases } = require('../../packages/training/scenarios');
const { buildDataset, readJsonl } = require('../../packages/training/dataset');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const root = path.resolve(__dirname, '../..');
const capturedPath = argument('--captured', '');
const reviewedPath = argument('--reviewed', path.join(root, 'model-data/human-reviewed.jsonl'));
const outDir = path.resolve(argument('--out', path.join(root, 'model-data/generated')));
const siteCount = Number(argument('--sites', '32'));
const seeds = generateSeedCases({ siteCount });
const captured = capturedPath ? readJsonl(path.resolve(capturedPath)) : [];
const reviewed = readJsonl(path.resolve(reviewedPath));
const result = buildDataset({ seeds, captured: [...captured, ...reviewed], outDir });
process.stdout.write(`${JSON.stringify({ output: outDir, ...result.manifest }, null, 2)}\n`);
