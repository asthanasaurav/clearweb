# Clearweb

**The web, without the garbage.**

Clearweb is an experimental privacy-first browser project focused on removing advertising, tracking, interruptions, and attention-hijacking page elements by default.

## Product vision

Most browsers render whatever a publisher sends and leave users to install extensions afterward. Clearweb reverses that model: the user defines what deserves their attention.

## Core ideas

- **Ad & tracker blocking by default** — network-level filtering with EasyList/EasyPrivacy-compatible rules.
- **Clean Web Mode** — transform cluttered pages into the content the user actually came for.
- **Explain this element** — inspect advertising/tracking elements and explain what they are and which third parties are involved.
- **Attention Dashboard** — show blocked requests, data saved, trackers prevented, and estimated interruption reduction.
- **URL hygiene** — remove known tracking parameters from navigations and shared URLs.
- **Site controls** — simple per-site protection controls and allowlisting.
- **Local-first intelligence (roadmap)** — classify advertising, sponsored content, engagement bait, and page clutter locally where practical.

## Architecture direction

The first milestone deliberately avoids maintaining a full Chromium fork. The MVP will use a Chromium-based desktop shell with Clearweb-owned filtering and page-cleaning components. A deeper Chromium fork can be evaluated only if browser-engine-level integration becomes necessary.

```text
clearweb/
├── apps/
│   └── desktop/          # Desktop browser shell
├── packages/
│   ├── blocker/          # Request/filter-list engine
│   ├── clean-web/        # DOM/content cleanup engine
│   ├── privacy/          # Tracking protection + URL hygiene
│   └── shared/           # Shared types/configuration
├── docs/                 # Architecture and product documentation
└── tests/                # Cross-component tests
```

## Initial milestones

### M0 — Foundation
- Desktop browser shell
- Navigation, tabs, address bar
- Monorepo/tooling foundation

### M1 — Blocking
- Request interception
- Filter-list ingestion
- EasyList/EasyPrivacy compatibility baseline
- Per-site allowlist
- Block statistics

### M2 — Clean Web Mode
- Remove overlays, autoplay interruptions and common clutter
- Reader-oriented content extraction
- User-toggleable cleaning levels

### M3 — Privacy
- Tracking-parameter removal
- Third-party tracker visibility
- Per-site privacy report

### M4 — Attention layer
- Explain-this-element UX
- Attention Dashboard
- Local classification experiments

## Principles

1. User attention belongs to the user.
2. Blocking should happen as early as practical, not merely hide rendered ads.
3. Privacy-sensitive processing should be local-first.
4. Sites must remain recoverable when aggressive blocking breaks functionality.
5. Clearweb should explain what it blocks instead of behaving like a black box.
6. Performance and compatibility are product features.

## macOS MVP

Current version: **0.2.0**

Versioning follows `X.Y.Z`: bug fixes increment `Z`, minor features increment `Y`, and `X` changes only when explicitly directed by the project owner.

The feature branch contains a runnable Electron-only macOS MVP with:

- Multi-tab navigation, omnibox, bookmarks, history, downloads and restorable sessions
- A persistent Chromium profile for cookies, storage and provider-permitted logins
- Ghostery's EasyList/EasyPrivacy-compatible network blocker and URL tracking-parameter stripping
- Default-on Clean Web rules with protected interactive controls and fail-open behavior
- Protection counters and an in-browser privacy dashboard
- Five-minute inactive-tab destruction with transparent restore from saved URL/title state
- A default-on local AI sidebar backed by a provider abstraction; Qwen through Ollama is the default provider
- Sandboxed, context-isolated web content and a narrow IPC bridge for trusted browser chrome

### Run

Requires Node.js 22+ and pnpm.

```sh
pnpm install
pnpm start
```

Local AI is optional at runtime. Install Ollama and pull `qwen2.5:3b` to enable assistant responses. If Ollama is missing or times out, browsing and deterministic protection continue normally.

### Verify and package

```sh
pnpm run check
pnpm test
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run build:mac
```

Unsigned arm64 DMG/ZIP artifacts are produced in `dist/`. Public distribution still requires a Clearweb icon, Apple Developer ID signing, notarization and release-channel update infrastructure.

### Known MVP limitations

- Chrome Web Store extensions are not supported.
- Google and other providers may restrict authentication in embedded Chromium/Electron clients.
- Protection counters are per app run; browsing library and sessions persist.
- Clean Web currently uses conservative deterministic DOM rules, not an always-on AI classifier.
- Qwen is not bundled, so the user must run Ollama and install the model locally.
- Builds are macOS arm64 and unsigned; Fedora and Windows are intentionally out of scope.

## License

License decision pending before accepting external contributions.
