# Run the Clearweb MVP

## macOS development build

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/asthanasaurav/clearweb.git
cd clearweb
git checkout feat/mvp-browser
npm install
npm start
```

The current MVP opens a Chromium-backed Clearweb window with a persistent profile, normal website cookie/session storage, network ad/tracker protection, URL tracking-parameter cleanup, and the first Clearweb browser chrome.

## Current limitations

This is a development build, not yet a signed distributable browser. Google and other identity providers may restrict authentication in embedded Chromium runtimes depending on their current OAuth/security policy. Clearweb does not bypass those controls.

Local Qwen inference, full Clean Web DOM transformations, production tabs, downloads, bookmarks/history, permissions UI and signed macOS packaging are still under implementation.
