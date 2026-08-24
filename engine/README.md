# Clearweb Chromium engine

Clearweb 1.0.0 is a native Chromium browser distribution. Electron remains in
`apps/desktop` only as the maintained 0.2.1 fallback while the native browser
passes the migration gates in `MIGRATION.md`.

The engine checkout and build output are deliberately excluded from Git. They
are reproducibly resolved from `version.json` and live below `engine/chromium`
and `engine/out`.

## Bootstrap on Apple silicon

Requirements:

- macOS 14.5 or newer
- full Xcode 16 or newer selected with `xcode-select`
- at least 180 GiB free disk space
- a case-sensitive build volume is recommended by Chromium

Run:

```sh
./scripts/engine/doctor.sh
./scripts/engine/bootstrap.sh
./scripts/engine/configure.sh
./scripts/engine/build.sh
```

`bootstrap.sh` downloads Google's official `depot_tools`, checks out Chromium,
and detaches it at the exact revision in `version.json`. `configure.sh` creates
an arm64 release configuration without disabling Chromium's sandbox. `build.sh`
builds Chromium first; the Clearweb patch layer is intentionally kept small and
will be applied only after the unmodified pinned engine build is reproducible.

