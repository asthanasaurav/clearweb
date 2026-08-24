#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
manifest="$repo_root/engine/version.json"

fail() {
  printf 'Clearweb engine doctor: %s\n' "$1" >&2
  exit 1
}

[ "$(uname -s)" = "Darwin" ] || fail "macOS is required for the 1.0.0 build"
[ "$(uname -m)" = "arm64" ] || fail "this first build target requires Apple silicon"
command -v git >/dev/null 2>&1 || fail "git is required"
command -v python3 >/dev/null 2>&1 || fail "Python 3 is required"
command -v xcodebuild >/dev/null 2>&1 || fail "full Xcode 16+ is required"

xcode_version=$(xcodebuild -version 2>/dev/null | awk 'NR == 1 { print $2 }')
[ -n "$xcode_version" ] || fail "select full Xcode with: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
xcode_major=${xcode_version%%.*}
[ "$xcode_major" -ge 16 ] || fail "Xcode 16+ is required (found $xcode_version)"

available_kib=$(df -Pk "$repo_root" | awk 'NR == 2 { print $4 }')
minimum_kib=$((180 * 1024 * 1024))
[ "$available_kib" -ge "$minimum_kib" ] || fail "at least 180 GiB free disk space is required"

python3 - "$manifest" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    manifest = json.load(source)
assert manifest["clearwebVersion"] == "1.0.0"
assert manifest["platform"] == "macos-arm64"
assert manifest["sandboxRequired"] is True
assert len(manifest["chromiumRevision"]) == 40
PY

printf 'Clearweb 1.0.0 engine prerequisites are ready (Xcode %s).\n' "$xcode_version"

