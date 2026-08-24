const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'engine/version.json'), 'utf8')
);

test('Clearweb native engine is pinned as version 1.0.0', () => {
  assert.equal(manifest.clearwebVersion, '1.0.0');
  assert.equal(manifest.platform, 'macos-arm64');
  assert.match(manifest.chromiumRevision, /^[a-f0-9]{40}$/);
});

test('native engine requires the Chromium sandbox', () => {
  assert.equal(manifest.sandboxRequired, true);
  const configure = fs.readFileSync(
    path.join(root, 'scripts/engine/configure.sh'),
    'utf8'
  );
  assert.doesNotMatch(configure, /no-sandbox|disable-setuid-sandbox/);
});

test('engine checkout and output cannot be committed', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /^engine\/chromium\/$/m);
  assert.match(ignore, /^engine\/depot_tools\/$/m);
  assert.match(ignore, /^engine\/out\/$/m);
});
