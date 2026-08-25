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
  assert.match(script, /addedNodes/);
  assert.match(script, /requestIdleCallback/);
  assert.doesNotMatch(script, /innerText/);
  assert.doesNotMatch(script, /getBoundingClientRect/);
});

test('adds YouTube-specific ad slots and player ad handling', () => {
  const script = buildCleanWebScript(true);
  assert.match(script, /ytd-ad-slot-renderer/);
  assert.match(script, /html5-video-player\.ad-showing/);
  assert.match(script, /ytp-ad-skip-button/);
});
