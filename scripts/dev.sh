#!/usr/bin/env bash
# 本地开发：默认 127.0.0.1:8787，改 games/ 后约 10 秒自动刷新
set -euo pipefail
cd "$(dirname "$0")/.."
export CLAY_BIND="${CLAY_BIND:-127.0.0.1:8787}"
export CLAY_GAMES_DIR="${CLAY_GAMES_DIR:-games}"
export CLAY_SITE_FILE="${CLAY_SITE_FILE:-site.json}"
export RUST_LOG="${RUST_LOG:-clayplay=info,tower_http=warn}"
exec cargo run -- "$@"
