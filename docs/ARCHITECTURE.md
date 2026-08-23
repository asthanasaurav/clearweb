# Clearweb Architecture

## Goal

Build a privacy-first desktop browser that blocks unwanted network activity before render and provides a second, content-aware cleaning layer after document load.

## Layers

```text
┌─────────────────────────────────────────────┐
│                 Browser UI                  │
│ tabs · omnibox · site controls · dashboard │
├─────────────────────────────────────────────┤
│             Clean Web Engine                │
│ DOM cleanup · content extraction · explain │
├─────────────────────────────────────────────┤
│               Privacy Layer                 │
│ URL hygiene · tracker report · permissions │
├─────────────────────────────────────────────┤
│              Blocking Engine                │
│ filter parser · matcher · request decisions │
├─────────────────────────────────────────────┤
│          Chromium-based Web Runtime         │
└─────────────────────────────────────────────┘
```

## Blocking pipeline

1. Browser initiates a network request.
2. Clearweb normalizes request URL and context.
3. URL hygiene removes known navigation tracking parameters when applicable.
4. Blocking engine evaluates compiled filter rules.
5. Request is allowed or cancelled.
6. Decision and reason are recorded locally for the current site's protection report.
7. After document load, Clean Web performs optional cosmetic/content filtering.

## Package boundaries

### `packages/blocker`
Pure filtering logic. It should not depend on desktop UI code. Inputs are request metadata and compiled rules; outputs are deterministic decisions plus reason metadata.

### `packages/clean-web`
Page-level transformations. Runs only with explicit protection policy and should preserve reversible state wherever practical.

### `packages/privacy`
Tracking URL sanitization, third-party classification, privacy policy, and site-level protection state.

### `packages/shared`
Stable cross-package contracts and types.

### `apps/desktop`
Browser runtime, tabs, navigation, web contents integration, menus, settings and user-facing protection surfaces.

## Security principles

- Treat filter lists and remote configuration as untrusted input.
- No arbitrary remote code execution through filter updates.
- Keep browsing/protection telemetry local by default.
- Minimize privileged renderer APIs.
- Isolate page content from browser-level capabilities.
- Do not weaken Chromium sandboxing to implement convenience features.

## MVP technology decision

Start with a Chromium-based desktop shell rather than a Chromium source fork. This lets the project validate filtering, Clean Web UX and product-market assumptions without inheriting Chromium's full build and patch-maintenance burden.

The runtime choice should be revisited if required interception APIs, extension compatibility, anti-fingerprinting, or browser-engine integration cannot meet Clearweb's product requirements.
