#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STANDALONE_DIR="$ROOT/.next/standalone"
STATIC_SRC="$ROOT/.next/static"
STATIC_DEST="$STANDALONE_DIR/.next/static"
PUBLIC_SRC="$ROOT/public"
PUBLIC_DEST="$STANDALONE_DIR/public"

mkdir -p "$STANDALONE_DIR/.next"
rm -rf "$STATIC_DEST"
cp -R "$STATIC_SRC" "$STATIC_DEST"

if [[ -d "$PUBLIC_SRC" ]]; then
  rm -rf "$PUBLIC_DEST"
  cp -R "$PUBLIC_SRC" "$PUBLIC_DEST"
fi

echo "Prepared standalone assets for local Playwright harness"
