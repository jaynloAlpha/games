# 部署到 Ubuntu

目标：Ubuntu 22.04 / 24.04，最低 1 vCPU / 512 MB 内存即可。服务是**只读静态站**：没有数据库、没有上传、运行期不写磁盘。

> **二进制兼容性**：Rust 程序链接系统 glibc。在 Ubuntu 24.04 上编译的二进制不能直接跑在 22.04 上。最稳妥是**在目标服务器上构建**，或用下面的 Docker 方式构建/运行。

---

## 方式 A：systemd + nginx（推荐）

### 1. 安装构建环境并构建

```bash
sudo apt update
sudo apt install -y build-essential curl git
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

git clone https://github.com/jaynloAlpha/games.git
cd games
./scripts/build.sh
```

构建脚本会跑测试前的严格校验（`clayplay --check`），任何游戏的 `game.json` 有问题都会直接失败，避免把坏包发上线。

### 2. 安装服务

```bash
sudo ./deploy/install.sh
```

脚本会：

- 创建系统用户 `clayplay`
- 把 `dist/` 安装到 `/opt/clayplay`
- 安装并启动 `clayplay.service`
- 服务只监听 `127.0.0.1:8080`

检查：

```bash
curl http://127.0.0.1:8080/healthz
sudo systemctl status clayplay
sudo journalctl -u clayplay -f
```

### 3. nginx 反向代理 + HTTPS

```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/clayplay
sudo sed -i 's/games.example.com/你的域名/' /etc/nginx/sites-available/clayplay
sudo ln -s /etc/nginx/sites-available/clayplay /etc/nginx/sites-enabled/clayplay
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 免费证书（可选但强烈建议）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

> 平台使用绝对路径（`/assets/...`、`/games/...`），请部署在**域名根目录**或独立子域名，不支持 `/clayplay/` 这种子路径。

### 4. 升级与回滚

```bash
cd ~/games
git pull
./scripts/build.sh          # 校验 + 重新打包
sudo ./deploy/install.sh    # 覆盖安装并重启
```

回滚：`git checkout <上一个 tag/commit>` 后重新执行上面两条；服务本身无状态，回滚就是换二进制和 `games/`。

建议保留上一版：

```bash
sudo cp -a /opt/clayplay /opt/clayplay.bak-$(date +%Y%m%d)
```

### 5. 备份

没有需要备份的运行时数据。真正需要进版本库的是：

- `games/`（游戏源码）
- `site.json`（站点文案）
- `src/`、`web/`（平台代码）

把这些放进 git 即可；`/opt/clayplay` 随时可以从 `dist/` 重建。

---

## 方式 B：Docker

服务器有 Docker 时最省心，构建环境与运行环境一致，不存在 glibc 问题。

```bash
git clone https://github.com/jaynloAlpha/games.git
cd games
docker compose up -d --build
```

- 容器内监听 `0.0.0.0:8080`，宿主只绑定 `127.0.0.1:8080`
- 升级：`git pull && docker compose up -d --build`
- 前端仍用 nginx / Caddy 反代 8080 并签 HTTPS
- 想让改 `games/` 立即生效（重启容器后），取消 `docker-compose.yml` 里的 volumes 注释

健康检查：

```bash
curl http://127.0.0.1:8080/healthz
docker compose logs -f
```

---

## 方式 C：只传二进制

如果不想在服务器装 Rust：

1. 在与服务器相同发行版的环境里（或用 Docker）构建出 `dist/`
2. 上传 `clayplay`、`games/`、`site.json`
3. 自己写 systemd unit（参考 `deploy/clayplay.service`）

```bash
scp -r dist/* user@server:/opt/clayplay/
sudo useradd --system --home /opt/clayplay --shell /usr/sbin/nologin clayplay
sudo chown -R clayplay:clayplay /opt/clayplay
sudo cp deploy/clayplay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clayplay
```

---

## 反向代理与缓存

- **HTML 不缓存**：应用对 `/`、`/play/*` 下发 `Cache-Control: no-cache`。
- **游戏资源**：`/games/*` 下发 1 小时缓存；封面 `immutable`，配合 `?v=<game.json 修改时间>` 自动失效。
- **Range 请求**：游戏音频/视频依赖 Range，nginx 示例对 `/games/` 关闭了 `proxy_buffering`。
- **请求体**：产品没有上传接口，`client_max_body_size 2m` 足够。
- **压缩**：nginx 示例开启了 gzip；Rust 侧对内嵌资源不做压缩。

如果以后把游戏换成大体积的 WebGL 资源，可以在 nginx 对 `/games/` 增加 `proxy_cache`，但要注意封面 URL 的 `?v=` 变化。

---

## 安全说明

- 服务以非 root 用户运行，systemd unit 开启 `ProtectSystem=strict`、`ProtectHome=true`、`NoNewPrivileges=true`，`/opt/clayplay` 只读。
- **没有任何管理后台或上传接口**，不存在被拿后台的入口；上架游戏 = 发布新版本。
- 平台页面下发 CSP（`default-src 'self'` 等）。游戏 iframe 是**同源可信代码**，不额外套 CSP；只放自己写的游戏，不要托管第三方来源的包。
- iframe 带 `sandbox="allow-scripts allow-same-origin ..."`，禁止游戏跳转顶层页面；但同源脚本仍可访问平台页面的 DOM。再次强调：只运行自己开发的游戏。
- 建议在 nginx 层加一层基础限速（示例未启用），防止异常刷 `/api/*`；站点本身没有写接口。

---

## 常见问题

**端口被占用**：`ss -ltnp | grep 8080`，或改 `CLAY_BIND`。

**页面 404 / 游戏打不开**：检查目录名是否合法（小写字母、数字、连字符），`game.json` 是否能通过 `clayplay --check`，`entry` 指定的文件是否存在。

**`GLIBC_2.xx not found`**：二进制与服务器发行版不匹配，改用 Docker 或在目标机上构建。

**改了 `games/` 但线上没变化**：生产建议 `CLAY_WATCH=0`，需要重新构建并重启；开发模式默认 10 秒热加载。

**中文文件名**：目录名必须是 ASCII slug；游戏标题、文案可以是中文。`game.json` 请保存为 UTF-8。

---

## 卸载

```bash
sudo systemctl disable --now clayplay
sudo rm /etc/systemd/system/clayplay.service
sudo rm -rf /opt/clayplay
sudo userdel clayplay
```
