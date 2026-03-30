#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB_ROOT="$ROOT/.playwright/system-libs"

export LD_LIBRARY_PATH="$LIB_ROOT/usr/lib/x86_64-linux-gnu:$LIB_ROOT/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export FONTCONFIG_PATH="$LIB_ROOT/etc/fonts"
export FONTCONFIG_FILE="$LIB_ROOT/etc/fonts/fonts.conf"
export XDG_DATA_DIRS="$LIB_ROOT/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

if [[ -n "${PLAYWRIGHT_CHROMIUM_EXECUTABLE:-}" && -x "${PLAYWRIGHT_CHROMIUM_EXECUTABLE}" ]]; then
  exec "${PLAYWRIGHT_CHROMIUM_EXECUTABLE}" "$@"
fi

for cache_root in "$HOME/.cache/ms-playwright" "/workspace/.cache/ms-playwright"; do
  [[ -d "$cache_root" ]] || continue
  while IFS= read -r candidate; do
    exec "$candidate" "$@"
  done < <(find "$cache_root" -type f -path '*/chrome*/chrome' | sort -r)

  while IFS= read -r candidate; do
    exec "$candidate" "$@"
  done < <(find "$cache_root" -type f -path '*/chrome-linux/headless_shell' | sort -r)
done

echo 'Could not find a Playwright Chromium executable. Run `npm run pw:install` first or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.' >&2
exit 1
