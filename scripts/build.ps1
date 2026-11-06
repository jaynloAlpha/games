# 构建发布目录：dist\ = clayplay.exe + games\ + site.json + VERSION
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> cargo build --release"
cargo build --release
if ($LASTEXITCODE -ne 0) { throw "cargo build 失败" }

Write-Host "==> 校验 games\ 和 site.json"
& ".\target\release\clayplay.exe" --check
if ($LASTEXITCODE -ne 0) { throw "游戏清单校验失败" }

Write-Host "==> 组装 dist\"
if (Test-Path dist) { Remove-Item dist -Recurse -Force }
New-Item -ItemType Directory dist | Out-Null
Copy-Item ".\target\release\clayplay.exe" ".\dist\clayplay.exe"

Copy-Item ".\games" ".\dist\games" -Recurse
Remove-Item ".\dist\games\_template" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item ".\site.json" ".\dist\site.json"

$version = $env:CLAY_VERSION
if (-not $version) {
  try {
    $version = (& cmd /c "git describe --tags --always --dirty 2>nul")
  } catch {
    $version = $null
  }
}
if (-not $version) {
  $version = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
}
Set-Content -Path ".\dist\VERSION" -Value $version -Encoding ascii

Write-Host "    version: $version"
Write-Host "    files:"
Get-ChildItem dist -Recurse -File | ForEach-Object {
  Write-Host ("      " + $_.FullName.Substring((Resolve-Path dist).Path.Length + 1))
}
