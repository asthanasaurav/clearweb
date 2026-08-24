const test = require('node:test');
const assert = require('node:assert/strict');
const { AD_HOST_MARKERS, AD_LABEL_PATTERN, buildCleanWebScript } = require('../packages/clean-web/inject');

test('recognizes international advertisement labels', () => {
  const pattern = new RegExp(AD_LABEL_PATTERN, 'i');
  for (const label of ['Advertisement', 'Advertentie', 'Sponsored', 'Gesponsord', 'Werbung']) assert.match(label, pattern);
  assert.doesNotMatch('Sign in', pattern);
});

test('targets common advertising hosts', () => {
  assert.ok(AD_HOST_MARKERS.includes('doubleclick.net'));
  assert.ok(AD_HOST_MARKERS.includes('amazon-adsystem.com'));
});

test('injected cleaner observes dynamic slots and protects controls', () => {
  const script = buildCleanWebScript(true);
  assert.match(script, /MutationObserver/);
  assert.match(script, /form,nav/);
  assert.match(script, /target\.remove\(\)/);
});
