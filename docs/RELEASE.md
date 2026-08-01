# Wuhr AI Ops 发布制作手册

本文面向拥有前端与 Agent 源码的发布负责人。客户安装手册见 [`INSTALLATION.md`](./INSTALLATION.md)。

## 发布原则

- 客户包不包含前端或 Agent 仓库源码。
- 前端以 Next.js standalone Docker 运行镜像交付。
- Agent 以 `CGO_ENABLED=0` 的 Linux/macOS、amd64/arm64 二进制交付。
- PostgreSQL 与 Redis 运行镜像一并离线归档。
- 不打包 `.env`、source map、Git 元数据、私钥、开发服务器地址或历史部署脚本。
- 正式构建要求 Git 工作区干净，版本号与已审阅提交一一对应。

## 构建环境

- Docker Engine 或 Docker Desktop
- Docker Buildx
- Node.js 与项目依赖
- Go 1.24.x
- `gzip`、`tar`、`git`
- amd64 与 arm64 镜像构建所需的 BuildKit/QEMU 支持

## 正式构建

公开 GitHub Release 只上传后端 Agent 文件；前端镜像独立发布到 Docker Hub。在前端仓库根目录构建 Agent 发布包：

```bash
./packaging/build-agent-release.sh --version 1.0.0
```

构建器会按顺序执行：

1. 检查安装脚本语法与发布文件凭据边界。
2. 运行 Agent 全量 Go 测试。
3. 交叉编译 Linux/macOS、amd64/arm64 四种 Agent 二进制。
4. 每个系统架构生成独立压缩包。
5. 扫描发布目录，拒绝源码、source map、环境文件和私钥。
6. 生成在线下载器和每个文件的 SHA-256 校验文件。

输出：

```text
dist/agent/install-agent.sh
dist/agent/install-agent.sh.sha256
dist/agent/wuhr-agent-1.0.0-linux-amd64.tar.gz
dist/agent/wuhr-agent-1.0.0-linux-amd64.tar.gz.sha256
dist/agent/wuhr-agent-1.0.0-linux-arm64.tar.gz
dist/agent/wuhr-agent-1.0.0-linux-arm64.tar.gz.sha256
dist/agent/wuhr-agent-1.0.0-darwin-amd64.tar.gz
dist/agent/wuhr-agent-1.0.0-darwin-amd64.tar.gz.sha256
dist/agent/wuhr-agent-1.0.0-darwin-arm64.tar.gz
dist/agent/wuhr-agent-1.0.0-darwin-arm64.tar.gz.sha256
```

安装器根据 `uname` 选择其中一个包，优先使用 GitHub Release，失败或 SHA-256 不匹配时改用 `http://106.12.150.207/download/`。

## Docker Hub 平台镜像

平台镜像发布为同一标签下的 OCI 多架构清单，至少包含 `linux/amd64` 和 `linux/arm64`。正式发布应同时写入源码仓库、完整 Git 提交号和版本 OCI 标签，并发布三个标签：

```text
wuhrai/wuhrai:VERSION
wuhrai/wuhrai:latest
wuhrai/wuhrai:git-SHORT_COMMIT
```

发布完成后必须使用 `docker buildx imagetools inspect` 从 Docker Hub 反向确认两个架构，再分别拉取目标架构进行非 root 用户、敏感文件排除和健康启动验收。将最终多架构摘要同步到根目录 `install.sh` 的 `DEFAULT_FRONTEND_DIGEST`，一键安装器才能按不可变摘要校验代理返回的镜像。

## 平台离线包

`packaging/build-release.sh` 仍可供内部或私有交付构建完整平台离线包，但该产物不得上传到公开 GitHub Release 或国内 `/download/` 目录。

## 内部预览构建

只有内部验证可以允许未提交工作区：

```bash
./packaging/build-agent-release.sh --version 1.0.0-review --skip-tests
```

`--skip-tests` 不应出现在正式发布流水线。

## 发布前验收

```bash
for checksum in dist/agent/*.sha256; do
  (cd dist/agent && shasum -a 256 -c "$(basename "$checksum")")
done
tar -tzf dist/agent/wuhr-agent-1.0.0-linux-amd64.tar.gz
```

必须在干净的 amd64 和 arm64 Linux 虚拟机各执行一次，macOS 包也要完成解压和 `--dry-run` 验证：

```bash
sudo ./install-agent.sh --port=2081
sudo ./doctor.sh
```

验收内容：

- 首次安装成功，Agent 系统服务健康。
- Agent 拒绝无效 API Key，安全控制与人工审批默认开启。
- 重复安装不会清空 Agent 配置、经验或审计数据。
- 人为替换一个损坏 Agent 后，安装器能报告失败并恢复旧版本。
- `--purge` 之外的卸载不会删除业务数据。

## GitHub Release 上传

确认产物后，只上传：

```text
install-agent.sh
install-agent.sh.sha256
wuhr-agent-VERSION-linux-amd64.tar.gz
wuhr-agent-VERSION-linux-amd64.tar.gz.sha256
wuhr-agent-VERSION-linux-arm64.tar.gz
wuhr-agent-VERSION-linux-arm64.tar.gz.sha256
wuhr-agent-VERSION-darwin-amd64.tar.gz
wuhr-agent-VERSION-darwin-amd64.tar.gz.sha256
wuhr-agent-VERSION-darwin-arm64.tar.gz
wuhr-agent-VERSION-darwin-arm64.tar.gz.sha256
```

不要把前端镜像归档上传到 GitHub Release，也不要上传完整平台离线包、后端源码、源码自动归档、`.env`、客户日志或单独的未校验二进制。前端只发布到 Docker Hub。发布说明应列出版本、平台镜像摘要、后端来源摘要、支持架构、已知限制和升级步骤。
