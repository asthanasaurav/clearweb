const fs = require('node:fs');
const path = require('node:path');
const { sanitizeCapturedRequest } = require('./sanitize');

class LocalCaptureStore {
  constructor({ filePath, isEnabled = () => false, maxBytes = 20 * 1024 * 1024 } = {}) {
    this.filePath = filePath;
    this.isEnabled = isEnabled;
    this.maxBytes = maxBytes;
    this.accepted = 0;
    this.rejected = 0;
  }

  record(details, context) {
    if (!this.isEnabled()) return { saved: false, reason: 'disabled' };
    const sanitized = sanitizeCapturedRequest(details, context);
    if (!sanitized) { this.rejected += 1; return { saved: false, reason: 'invalid' }; }
    let size = 0;
    try { size = fs.statSync(this.filePath).size; } catch {}
    if (size >= this.maxBytes) { this.rejected += 1; return { saved: false, reason: 'capacity' }; }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${JSON.stringify(sanitized)}\n`, { encoding: 'utf8', mode: 0o600 });
    this.accepted += 1;
    return { saved: true, record: sanitized };
  }

  stats() {
    let bytes = 0;
    try { bytes = fs.statSync(this.filePath).size; } catch {}
    return { enabled: Boolean(this.isEnabled()), sessionCaptured: this.accepted, sessionRejected: this.rejected, bytes, path: this.filePath };
  }
}

module.exports = { LocalCaptureStore };
