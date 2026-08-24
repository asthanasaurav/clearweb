const test=require('node:test');const assert=require('node:assert/strict');const {sanitizeUrl,normalizeInput}=require('../packages/privacy/url-hygiene');
test('strips trackers and preserves content',()=>{const r=sanitizeUrl('https://example.com/a?utm_source=x&id=42&fbclid=y');assert.equal(r.url,'https://example.com/a?id=42');assert.equal(r.removed,2)});
test('normalizes domains and searches',()=>{assert.equal(normalizeInput('example.com/a'),'https://example.com/a');assert.match(normalizeInput('clear web browser'),/^https:\/\/www\.google\.com\/search\?q=/)});
test('invalid URLs fail open',()=>assert.deepEqual(sanitizeUrl('not a url'),{url:'not a url',removed:0}));
