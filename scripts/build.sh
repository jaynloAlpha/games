#!/usr/bin/env bash
# 构建发布目录：dist/ = 二进制 + games/ + site.json + VERSION
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> cargo build --release"
cargo build --release

echo "==> 校验 games/ 和 site.json"
./target/release/clayplay --check

echo "==> 组装 dist/"
rm -rf dist
mkdir -p dist
cp target/release/clayplay dist/clayplay

if [ -d games ]; then
  cp -R games dist/games
  # 模板不随发布包下发，避免部署目录里多一个占位游戏
  rm -rf dist/games/_template
fi
cp site.json dist/site.json

VERSION="${CLAY_VERSION:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(git describe --tags --always --dirty 2>/dev/null || true)"
fi
if [ -z "$VERSION" ]; then
  VERSION="$(date -u +%Y%m%d-%H%M%S)"
fi
printf '%s\n' "$VERSION" > dist/VERSION

echo "    version: $VERSION"
du -sh dist | awk '{print "    size:    " $1}'
find dist -maxdepth 2 -type f | sort | sed 's/^/    /'
