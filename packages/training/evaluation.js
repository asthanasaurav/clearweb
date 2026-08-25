const { ACTIONS, CATEGORIES, normalizeDecision } = require('./contracts');

function parseDecision(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return normalizeDecision(JSON.parse(match[0])); } catch { return null; }
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function evaluatePredictions(rows) {
  const actionStats = Object.fromEntries([...ACTIONS].map((action) => [action, { tp: 0, fp: 0, fn: 0 }]));
  let valid = 0, actionCorrect = 0, categoryCorrect = 0, falseBlocks = 0, nonBlockGold = 0;
  const latencies = [];
  const failures = [];
  rows.forEach((row) => {
    const expected = normalizeDecision(row.expected);
    const predicted = normalizeDecision(row.predicted);
    if (Number.isFinite(row.latency_ms)) latencies.push(row.latency_ms);
    if (expected?.action !== 'block') nonBlockGold += 1;
    if (!predicted) { failures.push({ id: row.id, type: 'invalid-json-or-schema' }); return; }
    valid += 1;
    if (predicted.action === expected.action) actionCorrect += 1;
    else failures.push({ id: row.id, type: 'wrong-action', expected: expected.action, predicted: predicted.action });
    if (predicted.category === expected.category) categoryCorrect += 1;
    if (predicted.action === 'block' && expected.action !== 'block') falseBlocks += 1;
    for (const action of ACTIONS) {
      if (predicted.action === action && expected.action === action) actionStats[action].tp += 1;
      if (predicted.action === action && expected.action !== action) actionStats[action].fp += 1;
      if (predicted.action !== action && expected.action === action) actionStats[action].fn += 1;
    }
  });
  const perAction = {};
  for (const [action, stats] of Object.entries(actionStats)) {
    const precision = stats.tp / Math.max(1, stats.tp + stats.fp);
    const recall = stats.tp / Math.max(1, stats.tp + stats.fn);
    perAction[action] = { ...stats, precision, recall, f1: (2 * precision * recall) / Math.max(Number.EPSILON, precision + recall) };
  }
  return {
    total: rows.length,
    valid_json_rate: valid / Math.max(1, rows.length),
    action_accuracy: actionCorrect / Math.max(1, rows.length),
    category_accuracy: categoryCorrect / Math.max(1, rows.length),
    false_block_rate: falseBlocks / Math.max(1, nonBlockGold),
    latency_ms: { p50: percentile(latencies, 0.50), p95: percentile(latencies, 0.95) },
    per_action: perAction,
    failures
  };
}

module.exports = { parseDecision, evaluatePredictions };
