#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
engine_root="$repo_root/engine"
depot_tools="$engine_root/depot_tools"
checkout_root="$engine_root/chromium"
revision=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["chromiumRevision"])' "$engine_root/version.json")

"$repo_root/scripts/engine/doctor.sh"

if [ ! -d "$depot_tools/.git" ]; then
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$depot_tools"
fi

export PATH="$depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0

if [ ! -d "$checkout_root/src/.git" ]; then
  mkdir -p "$checkout_root"
  cd "$checkout_root"
  fetch --nohooks chromium
fi

cd "$checkout_root/src"
git fetch https://chromium.googlesource.com/chromium/src.git "$revision"
git checkout --detach "$revision"
gclient sync --with_branch_heads --with_tags --no-history

actual_revision=$(git rev-parse HEAD)
[ "$actual_revision" = "$revision" ] || {
  printf 'Expected Chromium %s but checked out %s\n' "$revision" "$actual_revision" >&2
  exit 1
}

printf 'Chromium is pinned at %s.\n' "$actual_revision"

