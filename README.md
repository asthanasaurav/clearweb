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

## Status

🚧 Early development / architecture phase.

The immediate goal is a runnable macOS desktop MVP demonstrating browser navigation, network filtering, Clean Web Mode, and a protection summary.

## License

License decision pending before accepting external contributions.
