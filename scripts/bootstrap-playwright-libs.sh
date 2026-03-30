#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAYWRIGHT_DIR="$ROOT/.playwright"
APT_DIR="$PLAYWRIGHT_DIR/apt"
DEB_DIR="$PLAYWRIGHT_DIR/debs"
LIB_DIR="$PLAYWRIGHT_DIR/system-libs"

LISTS_DIR="$APT_DIR/lists"
ARCHIVES_DIR="$APT_DIR/cache/archives"

PACKAGES=(
  libglib2.0-0
  libnss3
  libnspr4
  libdbus-1-3
  libatk1.0-0
  libatk-bridge2.0-0
  libatspi2.0-0
  libx11-6
  libxcomposite1
  libxdamage1
  libxext6
  libxfixes3
  libxrandr2
  libgbm1
  libxcb1
  libxkbcommon0
  libasound2
  libxi6
  libxrender1
  libdrm2
  libwayland-server0
  libxau6
  libxdmcp6
  libfontconfig1
  fontconfig-config
  fonts-dejavu-core
  libcups2
  libpango-1.0-0
  libcairo2
  libavahi-client3
  libavahi-common3
  libpixman-1-0
  libfreetype6
  libpng16-16
  libxcb-shm0
  libxcb-render0
  libfribidi0
  libthai0
  libharfbuzz0b
  libdatrie1
  libgraphite2-3
)

mkdir -p "$LISTS_DIR/partial" "$ARCHIVES_DIR/partial" "$DEB_DIR" "$LIB_DIR"

apt-get \
  -o Dir::State::Lists="$LISTS_DIR" \
  -o Dir::Cache::Archives="$ARCHIVES_DIR" \
  update

pushd "$DEB_DIR" >/dev/null
apt-get \
  -o Dir::State::Lists="$LISTS_DIR" \
  -o Dir::Cache::Archives="$ARCHIVES_DIR" \
  download "${PACKAGES[@]}"

shopt -s nullglob
for deb in ./*.deb; do
  dpkg-deb -x "$deb" "$LIB_DIR"
done
shopt -u nullglob
popd >/dev/null

printf 'Bootstrapped Playwright system libraries into %s\n' "$LIB_DIR"
