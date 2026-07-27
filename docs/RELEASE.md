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

在前端仓库根目录运行：

```bash
./packaging/build-release.sh --version 1.0.0
```

构建器会按顺序执行：

1. 检查安装脚本语法与发布文件凭据边界。
2. 拒绝未提交的 Git 工作区。
3. 运行前端单元测试、TypeScript 检查和 Agent 全量 Go 测试。
4. 构建 linux/amd64 与 linux/arm64 前端运行镜像。
5. 交叉编译四种 Agent 二进制。
6. 导出各架构的前端、PostgreSQL 与 Redis 离线镜像。
7. 扫描发布目录，拒绝源码、source map、环境文件和私钥。
8. 生成文件级 `SHA256SUMS`、发布压缩包与压缩包校验文件。

输出：

```text
dist/wuhr-ai-ops-1.0.0.tar.gz
dist/wuhr-ai-ops-1.0.0.tar.gz.sha256
dist/wuhr-agent-1.0.0.tar.gz
dist/wuhr-agent-1.0.0.tar.gz.sha256
```

## 内部预览构建

只有内部验证可以允许未提交工作区：

```bash
./packaging/build-release.sh \
  --version 1.0.0-review \
  --architectures arm64 \
  --reuse-image wuhr-ai-ops:local \
  --use-local-dependency-images \
  --skip-tests \
  --allow-dirty
```

`--skip-tests`、`--reuse-image`、`--allow-dirty` 不应出现在正式发布流水线。

只检查脚本和发布边界：

```bash
./packaging/build-release.sh --validate-only
```

## 发布前验收

```bash
shasum -a 256 -c dist/wuhr-ai-ops-1.0.0.tar.gz.sha256
tar -tzf dist/wuhr-ai-ops-1.0.0.tar.gz
```

必须在干净的 amd64 和 arm64 Linux 虚拟机各执行一次：

```bash
sudo ./install.sh all
sudo ./doctor.sh
```

验收内容：

- 首次安装成功，四个 Docker 核心服务与 Agent 系统服务均健康。
- 随机管理员密码可登录，删除凭据文件后不影响重启。
- Agent 拒绝无效 API Key，安全控制与人工审批默认开启。
- 重复安装不会清空数据库、Redis、审批、作业、交付、经验或审计数据。
- 人为替换一个损坏镜像/Agent 后，安装器能报告失败并恢复旧版本。
- `--purge` 之外的卸载不会删除业务数据。

## GitHub Release 上传

确认产物后，只上传：

```text
wuhr-ai-ops-VERSION.tar.gz
wuhr-ai-ops-VERSION.tar.gz.sha256
wuhr-agent-VERSION.tar.gz
wuhr-agent-VERSION.tar.gz.sha256
```

不要上传源码自动归档、源码压缩包、`.env`、客户日志或单独的未校验二进制。发布说明应列出版本、提交、支持架构、数据库迁移影响、已知限制和升级步骤。
