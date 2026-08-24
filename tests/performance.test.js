const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('uses composable WebContentsView instead of deprecated BrowserView', () => {
  const main = read('apps/desktop/main.js');
  assert.match(main, /WebContentsView/);
  assert.doesNotMatch(main, /\bBrowserView\b/);
  assert.match(main, /contentView\.addChildView/);
  assert.match(main, /contentView\.removeChildView/);
});

test('keeps protection updates and tab DOM work off the full-render path', () => {
  const main = read('apps/desktop/main.js');
  const renderer = read('apps/desktop/ui/renderer.js');
  assert.match(main, /protection:changed/);
  assert.match(renderer, /onProtection/);
  assert.doesNotMatch(renderer, /\$\('tabs'\)\.innerHTML/);
});

test('exposes blocked-request details and explicit AI page cleanup', () => {
  const main = read('apps/desktop/main.js');
  const preload = read('apps/desktop/preload.js');
  const html = read('apps/desktop/ui/index.html');
  assert.match(main, /protection:get-details/);
  assert.match(main, /page:clean-ai/);
  assert.match(preload, /cleanWithAI/);
  assert.match(html, /id="ai-clean"/);
  assert.match(html, /v0\.2\.1/);
});

test('uses a Chrome-compatible identity for strict sites', () => {
  const main = read('apps/desktop/main.js');
  assert.match(main, /COMPAT_USER_AGENT/);
  assert.match(main, /setUserAgent/);
  assert.match(main, /magicbricks\.com/);
  assert.match(main, /Sec-CH-UA/);
});

test('installs blocking once across macOS window relaunches', () => {
  const main = read('apps/desktop/main.js');
  assert.match(main, /if \(blockingInstalled\) return/);
  assert.match(main, /blockingInstalled = true/);
  assert.match(main, /site:compatibility/);
});
