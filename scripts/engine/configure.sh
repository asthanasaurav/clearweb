#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
source_root="$repo_root/engine/chromium/src"
depot_tools="$repo_root/engine/depot_tools"
output_dir="$source_root/out/ClearwebRelease"

"$repo_root/scripts/engine/doctor.sh"
[ -d "$source_root" ] || {
  printf 'Run scripts/engine/bootstrap.sh first.\n' >&2
  exit 1
}

export PATH="$depot_tools:$PATH"
export DEPOT_TOOLS_UPDATE=0
mkdir -p "$output_dir"

cat > "$output_dir/args.gn" <<'ARGS'
is_debug = false
is_component_build = false
target_cpu = "arm64"
symbol_level = 1
blink_symbol_level = 0
is_official_build = true
is_chrome_branded = false
enable_nacl = false
use_siso = true
ARGS

cd "$source_root"
gn gen "$output_dir"
gn args "$output_dir" --list --short >/dev/null
printf 'Configured sandboxed arm64 release output at %s.\n' "$output_dir"

