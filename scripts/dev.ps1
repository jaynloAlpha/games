# 本地开发：默认 127.0.0.1:8787，改 games\ 后约 10 秒自动刷新
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$env:CLAY_BIND = if ($env:CLAY_BIND) { $env:CLAY_BIND } else { "127.0.0.1:8787" }
$env:CLAY_GAMES_DIR = if ($env:CLAY_GAMES_DIR) { $env:CLAY_GAMES_DIR } else { "games" }
$env:CLAY_SITE_FILE = if ($env:CLAY_SITE_FILE) { $env:CLAY_SITE_FILE } else { "site.json" }
$env:RUST_LOG = if ($env:RUST_LOG) { $env:RUST_LOG } else { "clayplay=info,tower_http=warn" }

cargo run -- @args
