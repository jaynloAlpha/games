#!/usr/bin/env bash
# 在 Ubuntu 服务器上安装/升级 Clay Play。
# 用法（在仓库根目录执行，先跑过 scripts/build.sh）：
#   sudo ./deploy/install.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/clayplay}"
SERVICE_USER="${SERVICE_USER:-clayplay}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo $0" >&2
  exit 1
fi
if [ ! -f "$REPO_DIR/dist/clayplay" ]; then
  echo "找不到 dist/clayplay，请先运行 ./scripts/build.sh" >&2
  exit 1
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

systemctl stop clayplay 2>/dev/null || true
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_DIR"
rm -rf "$APP_DIR/games"
cp -a "$REPO_DIR/dist/." "$APP_DIR/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
chmod 755 "$APP_DIR/clayplay"

install -m 0644 "$REPO_DIR/deploy/clayplay.service" /etc/systemd/system/clayplay.service
systemctl daemon-reload
systemctl enable clayplay
systemctl restart clayplay

sleep 1
systemctl --no-pager --lines=0 status clayplay || true
echo
echo "安装完成：http://127.0.0.1:8080"
echo "下一步：把 deploy/nginx.conf 配到 nginx，或直接用 Caddy 反代。"
