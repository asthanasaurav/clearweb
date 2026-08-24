#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
source_root="$repo_root/engine/chromium/src"
depot_tools="$repo_root/engine/depot_tools"
output_dir="$source_root/out/ClearwebRelease"

"$repo_root/scripts/engine/doctor.sh"
[ -f "$output_dir/args.gn" ] || {
  printf 'Run scripts/engine/configure.sh first.\n' >&2
  exit 1
}

export PATH="$depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0
cd "$source_root"
autoninja -C "$output_dir" chrome

app="$output_dir/Chromium.app"
[ -d "$app" ] || {
  printf 'Build completed without the expected Chromium.app.\n' >&2
  exit 1
}
printf 'Pinned native engine built at %s.\n' "$app"

