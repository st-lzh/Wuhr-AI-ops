# Wuhr AI Ops 安装与升级手册

本文面向平台与 Agent 系统管理员。平台运行镜像发布在 [Docker Hub `wuhrai/wuhrai`](https://hub.docker.com/r/wuhrai/wuhrai)；Node、PostgreSQL 和 Redis 默认通过 [DaoCloud 公共镜像加速](https://github.com/DaoCloud/public-image-mirror) 获取；公开 GitHub Release 只包含 Wuhr Agent 编译后二进制、安装脚本和校验文件，不包含后端源码。

## 1. 部署结构

- 平台：Next.js 应用、PostgreSQL、Redis、交付调度器，全部由 Docker Compose 管理。
- Agent：直接运行在受管操作系统上，由 systemd、OpenRC、SysV init 或 launchd 管理，不使用 Docker。
- 默认端口：平台 `3000/tcp`，Agent `2081/tcp`。
- 数据：PostgreSQL、Redis、平台数据与日志使用具名 Docker 卷；Agent 数据保存在 `/var/lib/wuhr-agent`。
- 安全：Agent 默认启用 API Key、按调用方限流、命令校验、审计和人工审批。

生产环境建议将平台放在 HTTPS 反向代理或负载均衡器后，只允许平台服务器访问 Agent 的 `2081/tcp`。

## 2. 支持范围

平台安装器支持带 Docker Engine 与 Docker Compose v2 的 Linux：

- Debian、Ubuntu
- RHEL、CentOS、Rocky Linux、AlmaLinux
- openSUSE、SLES
- Alpine Linux

Agent 支持：

- Linux：amd64、arm64；systemd、OpenRC、SysV init
- macOS：Intel、Apple Silicon；launchd

建议配置为 4 核 CPU、8 GiB 内存和 20 GiB 可用磁盘。首次安装若 Docker 缺失，脚本会尝试通过系统软件源安装；完全离线环境应提前安装 Docker Engine 与 Compose v2。

## 3. 交互式一键部署整个平台

公开仓库提供前端源码，后端 Agent 使用编译包。推荐在 Linux 服务器执行：

| 部署场景 | 命令 | 说明 |
| --- | --- | --- |
| 交互式安装向导 | `sudo ./install.sh` | 识别系统后选择完整安装、分机安装、镜像来源与国内代理 |
| Linux/macOS 单机完整安装 | Linux：`sudo ./install.sh all`；macOS：`./install.sh all` | Agent 安装为宿主机系统服务；平台组件使用 Docker |
| 平台连接远程 Agent | `./install.sh platform ...` | 只启动 Docker 平台，不在本机安装 Agent |
| 只安装后端 Agent | `sudo ./install.sh agent` | 下载匹配系统/架构的编译包并注册系统服务 |
| 验收现有部署 | `./install.sh verify` | 检查平台、数据库、Redis、调度器和 Agent |
| 停止平台 | `./install.sh down` | 停止容器但保留全部具名数据卷 |

### Linux/macOS 单机完整安装

```bash
git clone https://github.com/st-lzh/Wuhr-AI-ops.git
cd Wuhr-AI-ops
sudo ./install.sh
```

macOS 需要先启动 Docker Desktop，并使用 `./install.sh`（不要在整个脚本前加 `sudo`）；安装 Agent 的 launchd 服务时，脚本会单独请求管理员权限。

安装向导会先显示检测到的 Linux 发行版和 CPU 架构，然后逐项询问：

1. 完整部署、仅平台、仅 Agent、验收或停止。
2. 前端从 Docker Hub 拉取、本地源码构建或使用已有镜像。
3. 是否通过企业/国内镜像代理前缀拉取。
4. Agent 使用国内下载优先、GitHub 优先或单一下载源。
5. 平台与 Agent 端口、监听范围及远程 Agent 凭据文件。

推荐的完整部署会完成以下真实操作：

1. 检查或安装 Docker Engine 与 Docker Compose v2。
2. 优先从国内下载站获取匹配架构的 Agent；失败时切换 GitHub。
3. 校验 Agent SHA-256，并注册为 systemd、OpenRC、SysV 或 macOS launchd 系统服务。
4. 为 Agent 与平台生成同一份 API Key。
5. 按固定发布摘要拉取 `wuhrai/wuhrai:1.0.0` 多架构镜像。
6. 默认从 DaoCloud 国内入口拉取 Node、PostgreSQL 和 Redis，失败时自动回退 Docker Hub。
7. 启动 PostgreSQL、Redis、前端平台和交付调度器。
8. 执行 Prisma 数据库迁移、管理员初始化和模型厂商初始化。
9. 校验管理员邮箱、用户名、角色、启用状态、审批状态、权限和密码哈希，并用固定初始密码真实调用登录接口。
10. 从平台容器验证 Agent 地址和 API Key。

安装完成后，终端会直接显示客户首次登录所需的邮箱、用户名和密码；登录框同时支持用户名或邮箱。凭据也会写入：

```text
.deploy/wuhr-ai-ops/initial-credentials.txt
```

默认登录邮箱为 `admin@wuhr.ai`，用户名为 `admin`，固定初始密码为 `WuhrAI@2026!`。文件权限为 `600`。首次登录修改密码并安全保存 Agent Key 后，应删除初始凭据文件。需要为正式环境指定不同密码时，可使用 `--admin-password-file`。

如果存量环境忘记密码或旧凭据已失效，可在不删除 PostgreSQL、Redis 和业务数据的情况下重置管理员密码：

```bash
./install.sh platform --reset-admin-password --non-interactive
```

脚本会复用现有部署状态，把密码恢复为 `WuhrAI@2026!`、同步管理员启用/审批/权限字段，分别在容器重建前后真实登录验证，最后覆盖初始凭据文件并在终端显示完整登录信息。也可以配合 `--admin-password-file` 指定客户预先准备的密码文件。

### 镜像与国内加速

官方镜像同时支持 `linux/amd64` 和 `linux/arm64`。脚本不会仅依赖可变的标签：默认将 `1.0.0` 与发布时记录的 OCI SHA-256 摘要一起校验。代理拉取失败会回退 Docker Hub；Docker Hub 失败也可按选择回退代理。所有远程来源都失败时，只有本机已有镜像摘要与官方发布摘要完全一致才允许继续。

Dockerfile、开发 Compose、生产 Compose 和离线打包配置中的 Node、PostgreSQL、Redis 默认使用 DaoCloud 推荐的“添加前缀”形式，例如 `m.daocloud.io/docker.io/library/node:20-slim`。Node 仍固定与官方源一致的 SHA-256 摘要；DaoCloud 不可用时，安装器会自动切换同版本的 Docker Hub 镜像。

交互向导中的 `--image-proxy` 主要用于平台成品镜像，也可以覆盖公共基础镜像的优先来源。代理前缀示例为 `registry.example.com/docker.io`，不要填写 `http://` 或 `https://`。当前 DaoCloud 对 `wuhrai/wuhrai:1.0.0` 返回 403，因此平台成品镜像不能硬编码为 DaoCloud 地址，仍通过 Docker Hub、用户配置的镜像代理或本地已校验缓存获取。

非交互部署示例：

```bash
# 直接从 Docker Hub 拉取官方镜像
sudo ./install.sh all --non-interactive --image-mode pull

# 国内/企业代理优先，失败回退 Docker Hub
sudo ./install.sh all --non-interactive --image-mode pull \
  --image-proxy registry.example.com/docker.io \
  --prefer-image-proxy

# 二次开发服务器使用当前源码构建
sudo ./install.sh all --non-interactive --image-mode build
```

`--image-proxy` 是“可直接拼接镜像名称”的代理仓库前缀，不会改写 `/etc/docker/daemon.json`。如果云厂商提供的是 Docker daemon 专用 `registry-mirrors` 地址，应先按云厂商文档配置 Docker，再在向导中选择“使用 Docker 当前配置”。脚本不会覆盖客户已有的 daemon 配置。

### 平台连接已有远程 Agent

适用于本地或单独服务器运行 Docker 平台、另一台 Linux 服务器运行 Agent：

```bash
./install.sh platform \
  --agent-url http://10.0.0.20:2081 \
  --agent-api-key-file ./agent-api-key.txt
```

也可以从已有 `.env.local` 安全读取 Agent 地址和 Key：

```bash
./install.sh platform --agent-env-file .env.local
```

默认的一键全新安装不要求用户处理旧数据库密钥：如果 `.deploy/项目名/.env` 不存在，但机器上残留同项目名的旧容器或数据卷，脚本会自动删除这些遗留资源，再创建全新数据卷并导入最新数据库结构和初始化数据。

如果必须保留并接管早期版本创建的 `wuhr-ai-ops_postgres_data` 等数据卷，则显式执行：

```bash
./install.sh platform \
  --project-name wuhr-ai-ops \
  --platform-env-file .env \
  --agent-env-file .env.local
```

提供 `--platform-env-file` 后，脚本会导入原数据库、Redis、JWT 和加密密钥并继续使用原数据卷，不会重置管理员密码；旧文件缺少关键密钥时仍会停止，以保护需要保留的数据。接管成功后配置会安全保存在 `.deploy/wuhr-ai-ops/.env`，以后升级不必重复传入旧环境文件。

测试环境可使用独立项目名和端口，不会和正式数据卷混用：

```bash
./install.sh platform \
  --project-name wuhr-test \
  --port 3100 \
  --agent-env-file .env.local
```

部署完成后可重复验收或停止容器：

```bash
./install.sh verify --project-name wuhr-test
./install.sh down --project-name wuhr-test
```

`down` 不带 `--volumes`，因此数据库、Redis、交付记录和平台数据都会保留。不要手工执行 `docker compose down -v`。

## 4. 校验 Agent 发布包

以 `1.0.1` 为例：

下载来源：

- GitHub：`https://github.com/st-lzh/Wuhr-AI-ops/releases/tag/v1.0.1`
- 国内镜像：`http://106.12.150.207/download/`

Agent 按操作系统和 CPU 架构分为四个包：

- `wuhr-agent-1.0.1-linux-amd64.tar.gz`
- `wuhr-agent-1.0.1-linux-arm64.tar.gz`
- `wuhr-agent-1.0.1-darwin-amd64.tar.gz`
- `wuhr-agent-1.0.1-darwin-arm64.tar.gz`

推荐直接使用在线安装器。它先访问 GitHub，失败或校验不通过时自动切换国内镜像：

```bash
tmp=$(mktemp) && trap 'rm -f "$tmp"' 0 HUP INT TERM \
  && (curl -fsSL 'https://github.com/st-lzh/Wuhr-AI-ops/releases/download/v1.0.1/install-agent.sh' -o "$tmp" \
  || curl -fsSL 'http://106.12.150.207/download/v1.0.1/install-agent.sh' -o "$tmp") \
  && sudo sh "$tmp" --port=2081
```

手动下载时必须同时下载对应的 `.sha256` 文件。例如：

```bash
sha256sum -c wuhr-agent-1.0.1-linux-amd64.tar.gz.sha256
tar -xzf wuhr-agent-1.0.1-linux-amd64.tar.gz
cd wuhr-agent-1.0.1-linux-amd64
sudo ./install-agent.sh --port=2081
```

macOS 使用 `shasum -a 256 -c 文件名.sha256`。不要安装校验失败的文件。

## 5. 私有离线包一键安装

本节仅适用于发布负责人生成的私有完整离线包。普通联网服务器应使用上一节的根目录 `install.sh` 和 Docker Hub 多架构镜像；完全离线环境才需要包含镜像归档的私有包。

适合单机试用或平台与中央 Agent 部署在同一台 Linux 服务器：

```bash
sudo ./install.sh all
```

脚本会依次：

1. 识别系统、CPU 架构和服务管理器。
2. 安装并启动本机 Agent。
3. 导入当前架构的 PostgreSQL、Redis 与平台离线镜像。
4. 生成数据库密码、Redis 密码、JWT 密钥、加密密钥和 Agent API Key。
5. 执行数据库迁移与初始化。
6. 启动平台及交付调度器。
7. 验证平台健康状态和 Agent 鉴权。

完成后，初始管理员账号、固定初始密码和 Agent API Key 会直接显示在终端，并写入：

```text
/opt/wuhr-ai-ops/initial-credentials.txt
```

默认用户名为 `admin`，邮箱为 `admin@wuhr.ai`，固定初始密码为 `WuhrAI@2026!`。该文件权限为 `600`。首次登录并安全保存凭据后，请立即修改管理员密码并删除此文件。

## 6. 私有离线包分开安装

生产环境通常把平台和 Agent 分开部署。先在安全终端生成一份共享 API Key：

```bash
umask 077
printf 'wuhr_%s\n' "$(openssl rand -hex 24)" > agent-api-key.txt
```

在 Agent 服务器安装：

```bash
sudo ./install-agent.sh \
  --api-key-file ./agent-api-key.txt \
  --frontend-url https://ops.example.com
```

在平台服务器安装，并指向 Agent 的内网地址：

```bash
sudo ./install-platform.sh \
  --agent-url http://10.0.0.20:2081 \
  --agent-api-key-file ./agent-api-key.txt \
  --port 3000
```

传输 `agent-api-key.txt` 时应使用受控的密钥分发渠道，安装完成后从普通工作目录删除。当前产品定位为单个可信运维团队，共享的 Agent Key 只应分发给平台服务端，不应暴露给浏览器。

### 自定义管理员密码

```bash
umask 077
printf '%s\n' 'Your-Strong-Password-Here' > admin-password.txt
sudo ./install-platform.sh --admin-password-file ./admin-password.txt
```

密码和 API Key 均通过文件传入，避免出现在进程参数与 shell 历史中。

## 7. 防火墙与 TLS

安装器默认不修改防火墙。仅在明确需要时可执行：

```bash
sudo ./install-agent.sh --open-firewall
```

建议规则：

- 平台 `3000/tcp`：仅向反向代理或可信管理网开放。
- Agent `2081/tcp`：仅向平台服务器 IP 开放。
- PostgreSQL `5432/tcp` 与 Redis `6379/tcp`：不暴露到宿主机，保持 Docker 内网访问。

对外服务必须在 Nginx、Caddy、Traefik 或云负载均衡器上配置 HTTPS。Agent 也可通过受控内网、VPN 或 TLS 反向代理接入。

## 8. 日常管理

### 平台

源码一键部署：

```bash
cd Wuhr-AI-ops
./install.sh verify
docker compose -p wuhr-ai-ops --env-file .deploy/wuhr-ai-ops/.env \
  -f docker-compose.deploy.yml logs -f --tail=200 app deployment-scheduler
```

私有离线包部署：

```bash
cd /opt/wuhr-ai-ops
sudo docker compose -p wuhr-ai-ops ps
sudo docker compose -p wuhr-ai-ops logs -f --tail=200 app
sudo docker compose -p wuhr-ai-ops logs -f --tail=200 deployment-scheduler
```

### Agent（systemd）

```bash
sudo systemctl status wuhr-agent
sudo journalctl -u wuhr-agent -f
sudo systemctl restart wuhr-agent
curl http://127.0.0.1:2081/api/health
```

OpenRC 使用 `rc-service wuhr-agent status`，SysV 使用 `service wuhr-agent status`，macOS 使用 `launchctl print system/ai.wuhr.agent`。

### 安装后诊断

```bash
sudo ./doctor.sh
```

诊断会检查 Docker、Compose、平台健康接口、Agent 健康接口、有效 API Key 与无效 API Key 拒绝行为，不会执行运维命令。

## 9. 升级

源码部署升级：

```bash
cd Wuhr-AI-ops
git pull --ff-only
sudo ./install.sh
```

脚本复用已有密钥和 Docker 数据卷，按向导选择拉取新发布镜像或重新构建源码，运行数据库迁移后再完成健康检查。

私有离线包升级：

将新发布包解压到临时目录后，重新执行与首次安装相同的命令：

```bash
sudo ./install.sh all
```

安装器会：

- 保留现有数据库、Redis 和业务数据卷。
- 保留现有随机密钥与客户已经修改过的管理员密码。
- 备份旧 `.env`、Compose 配置和 Agent 二进制。
- 启动新版本并执行健康检查。
- 新版本启动失败时恢复旧配置或 Agent 二进制。

正式升级前仍应备份数据库和 `/opt/wuhr-ai-ops/.env`、`/etc/wuhr-agent`、`/var/lib/wuhr-agent`。

## 10. 卸载

默认卸载保留业务数据：

```bash
sudo ./uninstall-platform.sh
sudo ./uninstall-agent.sh
```

永久删除全部数据必须显式使用 `--purge`：

```bash
sudo ./uninstall-platform.sh --purge
sudo ./uninstall-agent.sh --purge
```

`--purge` 不可恢复，执行前必须完成备份。

## 11. 常见问题

### 平台健康检查失败

```bash
cd /opt/wuhr-ai-ops
sudo docker compose -p wuhr-ai-ops ps
sudo docker compose -p wuhr-ai-ops logs --tail=200 app postgres redis
```

确认 `3000` 端口未被其他进程占用，磁盘空间充足，且 Docker daemon 正常。

### Agent 能健康检查但平台无法调用

确认：

- 平台 `.env` 中的 `IMPROVE_API_BASE_URL` 是平台容器可访问的地址。
- 平台与 Agent 使用同一份 API Key。
- Agent 防火墙只允许了正确的平台来源地址。
- 反向代理没有删除 `X-API-Key`、`X-Actor`、`X-Request-ID` 请求头。

### 为什么 Agent 默认使用 Ollama 占位提供商

Agent 启动时不会要求客户把模型密钥写进系统服务。实际对话使用平台“模型接入”中选定并加密保存的模型配置动态创建客户端；Ollama 仅用于安全启动默认客户端，不代表必须安装 Ollama。
