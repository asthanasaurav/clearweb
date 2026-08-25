const TRACKING_KEYS = [/^utm_/i,/^fbclid$/i,/^gclid$/i,/^dclid$/i,/^msclkid$/i,/^mc_(cid|eid)$/i,/^igshid$/i];

function sanitizeUrl(raw) {
  try {
    const url = new URL(raw);
    let removed = 0;
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_KEYS.some((pattern) => pattern.test(key))) {
        url.searchParams.delete(key);
        removed++;
      }
    }
    return { url:url.toString(), removed };
  } catch {
    return { url:raw, removed:0 };
  }
}

function normalizeInput(input) {
  const value = String(input || '').trim();
  if (!value) return 'clearweb://newtab';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

module.exports = { sanitizeUrl, normalizeInput };
