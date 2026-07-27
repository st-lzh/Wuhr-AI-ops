# Wuhr AI Ops 安装与升级手册

本文面向拿到正式发布包的系统管理员。发布包只包含前端运行镜像、Wuhr Agent 编译后二进制、安装脚本和校验文件，不包含前后端源码。

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

## 3. 校验发布包

以 `1.0.0` 为例：

下载来源：

- GitHub：`https://github.com/st-lzh/Wuhr-AI-ops/releases/tag/v1.0.0`
- 国内镜像：`http://106.12.150.207/download/`

完整平台请选择 `wuhr-ai-ops-1.0.0.tar.gz`；仅安装 Agent 请选择
`wuhr-agent-1.0.0.tar.gz`。两个压缩包都必须同时下载对应的 `.sha256`
文件进行校验。

```bash
sha256sum -c wuhr-ai-ops-1.0.0.tar.gz.sha256
tar -xzf wuhr-ai-ops-1.0.0.tar.gz
cd wuhr-ai-ops-1.0.0
```

macOS 可使用：

```bash
shasum -a 256 -c wuhr-ai-ops-1.0.0.tar.gz.sha256
```

不要安装校验失败的文件。

## 4. 一键同机安装

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

完成后，初始管理员账号、随机密码和 Agent API Key 写入：

```text
/opt/wuhr-ai-ops/initial-credentials.txt
```

该文件权限为 `600`。首次登录并安全保存凭据后，请立即修改管理员密码并删除此文件。

## 5. 平台与 Agent 分开安装

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

## 6. 防火墙与 TLS

安装器默认不修改防火墙。仅在明确需要时可执行：

```bash
sudo ./install-agent.sh --open-firewall
```

建议规则：

- 平台 `3000/tcp`：仅向反向代理或可信管理网开放。
- Agent `2081/tcp`：仅向平台服务器 IP 开放。
- PostgreSQL `5432/tcp` 与 Redis `6379/tcp`：不暴露到宿主机，保持 Docker 内网访问。

对外服务必须在 Nginx、Caddy、Traefik 或云负载均衡器上配置 HTTPS。Agent 也可通过受控内网、VPN 或 TLS 反向代理接入。

## 7. 日常管理

### 平台

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

## 8. 升级

将新发布包解压到临时目录后，重新执行与首次安装相同的命令：

```bash
sudo ./install.sh all
```

安装器会：

- 保留现有数据库、Redis 和业务数据卷。
- 保留现有随机密钥与管理员密码。
- 备份旧 `.env`、Compose 配置和 Agent 二进制。
- 启动新版本并执行健康检查。
- 新版本启动失败时恢复旧配置或 Agent 二进制。

正式升级前仍应备份数据库和 `/opt/wuhr-ai-ops/.env`、`/etc/wuhr-agent`、`/var/lib/wuhr-agent`。

## 9. 卸载

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

## 10. 常见问题

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
