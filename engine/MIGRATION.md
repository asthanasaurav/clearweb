# Clearweb 1.0.0 migration gates

The Electron application must not be replaced until every gate below passes.

1. **Reproducible engine** — pinned arm64 Chromium compiles from a clean checkout.
2. **Native chrome** — Clearweb window, tabs, omnibox and navigation run without Electron.
3. **Profile** — cookies, storage, history, bookmarks and restorable sessions persist.
4. **Protection** — deterministic blocking and tracking-parameter stripping run before render.
5. **Clean Web** — cosmetic cleanup and explicit AI cleanup preserve page isolation.
6. **Downloads and permissions** — user-visible, revocable and confined to expected paths.
7. **Performance** — warm tab switches meet the committed latency budget under load.
8. **Compatibility** — representative login and strict-site tests pass without impersonating Chrome.
9. **Security** — Chromium sandbox remains enabled; no remote content receives browser privileges.
10. **Distribution** — all app/helper binaries are signed, notarized and updateable.

MagicBricks is a compatibility test, not a special-case bypass. Clearweb must
never weaken TLS, disable the sandbox, forge security challenges or launch a
different browser to make the test pass.

