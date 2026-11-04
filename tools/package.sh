#!/usr/bin/env bash
# Package each game into dist/<game>.zip, ready to upload (index.html at the zip root).
# Usage: tools/package.sh [game ...]   (default: all three games)
set -euo pipefail
cd "$(dirname "$0")/.."
games=("$@")
[ ${#games[@]} -eq 0 ] && games=(prism-runner lantern-links island-ferry)
mkdir -p dist
for g in "${games[@]}"; do
  node tools/check-bundle.mjs "$g"
  cmp -s shared/ytsdk.js "$g/ytsdk.js" || { echo "ERROR: $g/ytsdk.js differs from shared/ytsdk.js"; exit 1; }
  rm -f "dist/$g.zip"
  (cd "$g" && zip -qr -X "../dist/$g.zip" . -x 'README.md' -x '.*')
  echo "dist/$g.zip  $(du -h "dist/$g.zip" | cut -f1)"
done
