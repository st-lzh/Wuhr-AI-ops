#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKEND_DIR=${WUHR_BACKEND_DIR:-"$ROOT_DIR/../v1/backend"}
OUTPUT_DIR=${WUHR_RELEASE_OUTPUT_DIR:-"$ROOT_DIR/dist"}
RUNTIME_DIR="$ROOT_DIR/packaging/runtime"
VERSION=""
ARCHITECTURES="amd64,arm64"
SKIP_TESTS=0
VALIDATE_ONLY=0
REUSE_IMAGE=""
OFFLINE_BUILD=0
USE_LOCAL_DEPENDENCY_IMAGES=0
ALLOW_DIRTY=0

log() {
  printf '%s\n' "[release] $*"
}

die() {
  printf '%s\n' "[release][错误] $*" >&2
  exit 1
}

checksum_file() {
  file=$1
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file"
  else
    shasum -a 256 "$file"
  fi
}

checksum_stream() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    shasum -a 256 | awk '{print $1}'
  fi
}

usage() {
  cat <<'EOF'
用法：./packaging/build-release.sh [选项]

选项：
  --version VERSION          发布版本，默认读取 package.json
  --architectures LIST       平台镜像架构，默认 amd64,arm64
  --backend-dir PATH         Agent 源码目录
  --output-dir PATH          输出目录，默认 ./dist
  --skip-tests               跳过前后端测试（正式发布不建议）
  --validate-only            只校验发布脚本与源码边界，不构建产物
  --reuse-image IMAGE        复用已有的单架构前端镜像
  --offline-build            使用 Dockerfile.offline 构建前端镜像
  --use-local-dependency-images
                             不拉取 PostgreSQL/Redis，复用本地同架构镜像
  --allow-dirty              允许从未提交工作区构建（仅用于内部预览）
  -h, --help                 显示帮助

正式产物：
  dist/wuhr-ai-ops-VERSION.tar.gz
  dist/wuhr-ai-ops-VERSION.tar.gz.sha256

发布包包含编译后的 Docker 镜像和 Agent 二进制，不包含前后端源码。
EOF
}

need_value() {
  [ "$#" -ge 2 ] || die "参数 $1 缺少值"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      need_value "$@"
      VERSION=$2
      shift 2
      ;;
    --architectures)
      need_value "$@"
      ARCHITECTURES=$2
      shift 2
      ;;
    --backend-dir)
      need_value "$@"
      BACKEND_DIR=$2
      shift 2
      ;;
    --output-dir)
      need_value "$@"
      OUTPUT_DIR=$2
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=1
      shift
      ;;
    --validate-only)
      VALIDATE_ONLY=1
      shift
      ;;
    --reuse-image)
      need_value "$@"
      REUSE_IMAGE=$2
      shift 2
      ;;
    --offline-build)
      OFFLINE_BUILD=1
      shift
      ;;
    --use-local-dependency-images)
      USE_LOCAL_DEPENDENCY_IMAGES=1
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数：$1"
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT_DIR/package.json" | head -n 1)
fi
case "$VERSION" in
  ''|*[!A-Za-z0-9._-]*) die "版本号为空或含有非法字符：$VERSION" ;;
esac

case "$ARCHITECTURES" in
  amd64|arm64|amd64,arm64|arm64,amd64) ;;
  *) die "--architectures 仅支持 amd64、arm64 或 amd64,arm64" ;;
esac

[ -d "$BACKEND_DIR" ] || die "找不到 Agent 源码目录：$BACKEND_DIR"
[ -f "$BACKEND_DIR/go.mod" ] || die "Agent 目录缺少 go.mod"
[ -d "$RUNTIME_DIR" ] || die "找不到发布运行时目录：$RUNTIME_DIR"
[ -f "$ROOT_DIR/README.md" ] || die "缺少 GitHub README 文档"
[ -f "$ROOT_DIR/docs/INSTALLATION.md" ] || die "缺少客户安装文档"
[ -f "$ROOT_DIR/docs/RELEASE.md" ] || die "缺少发布制作文档"

for file in install.sh install-platform.sh install-agent.sh doctor.sh \
  uninstall-platform.sh uninstall-agent.sh docker-compose.yml; do
  [ -f "$RUNTIME_DIR/$file" ] || die "发布运行时缺少 $file"
done

for script in "$RUNTIME_DIR"/*.sh "$0"; do
  sh -n "$script" || die "Shell 语法检查失败：$script"
done

command -v rg >/dev/null 2>&1 || die "缺少发布边界扫描命令：rg (ripgrep)"
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -s sh "$RUNTIME_DIR"/*.sh "$0"
fi

if rg -n '47\.99\.137\.248|Wuhrai_mlops\+1|BEGIN (RSA |OPENSSH )?PRIVATE KEY' "$RUNTIME_DIR" \
  "$ROOT_DIR/README.md" "$ROOT_DIR/docs/INSTALLATION.md" 2>/dev/null; then
  die "发布文件中发现禁止出现的服务器地址或凭据"
fi

if [ "$VALIDATE_ONLY" -eq 1 ]; then
  log "发布脚本、必需文件和凭据边界校验通过"
  exit 0
fi

for command_name in docker go git gzip tar; do
  command -v "$command_name" >/dev/null 2>&1 || die "缺少构建命令：$command_name"
done
docker info >/dev/null 2>&1 || die "Docker daemon 不可用"
docker buildx version >/dev/null 2>&1 || die "需要 Docker Buildx"

if [ "$ALLOW_DIRTY" -eq 0 ] && [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  die "正式发布要求 Git 工作区干净；请先审阅并提交改动，或仅在内部预览时使用 --allow-dirty"
fi

if [ "$SKIP_TESTS" -eq 0 ]; then
  log "运行前端单元测试与 TypeScript 检查"
  (
    cd "$ROOT_DIR"
    npm run test:unit
    npm exec tsc -- --noEmit
  )
  log "运行 Agent Go 测试"
  (
    cd "$BACKEND_DIR"
    go test ./...
  )
else
  log "已按参数跳过测试"
fi

FRONTEND_COMMIT=$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || printf '%s' "unknown")
AGENT_COMMIT=$(git -C "$BACKEND_DIR" rev-parse --short=12 HEAD 2>/dev/null || printf '%s' "unknown")
AGENT_SOURCE_SHA256=$(
  cd "$BACKEND_DIR"
  find . -type f \( -name '*.go' -o -name 'go.mod' -o -name 'go.sum' \) -print |
    LC_ALL=C sort |
    while IFS= read -r source_file; do
      checksum_file "$source_file"
    done |
    checksum_stream
)
if [ "$AGENT_COMMIT" = "unknown" ]; then
  AGENT_COMMIT="source-$(printf '%s' "$AGENT_SOURCE_SHA256" | cut -c1-12)"
fi
BUILD_DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
RELEASE_NAME="wuhr-ai-ops-$VERSION"
STAGE="$OUTPUT_DIR/$RELEASE_NAME"
ARCHIVE="$OUTPUT_DIR/$RELEASE_NAME.tar.gz"
AGENT_RELEASE_NAME="wuhr-agent-$VERSION"
AGENT_STAGE="$OUTPUT_DIR/$AGENT_RELEASE_NAME"
AGENT_ARCHIVE="$OUTPUT_DIR/$AGENT_RELEASE_NAME.tar.gz"

rm -rf "$STAGE" "$AGENT_STAGE"
mkdir -p "$STAGE/payload" "$STAGE/agent/bin" "$OUTPUT_DIR"
cp "$RUNTIME_DIR/install.sh" "$RUNTIME_DIR/install-platform.sh" \
  "$RUNTIME_DIR/install-agent.sh" "$RUNTIME_DIR/doctor.sh" \
  "$RUNTIME_DIR/uninstall-platform.sh" "$RUNTIME_DIR/uninstall-agent.sh" \
  "$RUNTIME_DIR/docker-compose.yml" "$STAGE/"
cp "$ROOT_DIR/docs/INSTALLATION.md" "$STAGE/INSTALL.md"
chmod 0755 "$STAGE"/*.sh

log "交叉编译 Agent 二进制"
for target in linux-amd64 linux-arm64 darwin-amd64 darwin-arm64; do
  goos=${target%-*}
  goarch=${target#*-}
  (
    cd "$BACKEND_DIR"
    CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
      go build -trimpath \
      -ldflags "-s -w -X main.version=$VERSION -X main.commit=$AGENT_COMMIT -X main.date=$BUILD_DATE" \
      -o "$STAGE/agent/bin/kubelet-wuhrai-$target" ./cmd
  )
  chmod 0755 "$STAGE/agent/bin/kubelet-wuhrai-$target"
done

image_amd64=""
image_arm64=""
OLD_IFS=$IFS
IFS=','
for arch in $ARCHITECTURES; do
  IFS=$OLD_IFS
  image="wuhr-ai-ops:$VERSION-linux-$arch"
  image_archive="$STAGE/payload/platform-images-linux-$arch.tar.gz"

  if [ -n "$REUSE_IMAGE" ]; then
    source_arch=$(docker image inspect --format '{{.Architecture}}' "$REUSE_IMAGE" 2>/dev/null || true)
    [ "$source_arch" = "$arch" ] || die "复用镜像架构为 $source_arch，无法用于 linux/$arch"
    docker tag "$REUSE_IMAGE" "$image"
  else
    dockerfile="$ROOT_DIR/Dockerfile"
    [ "$OFFLINE_BUILD" -eq 0 ] || dockerfile="$ROOT_DIR/Dockerfile.offline"
    log "构建前端镜像 linux/$arch"
    docker buildx build --platform "linux/$arch" --load \
      -t "$image" -f "$dockerfile" "$ROOT_DIR"
  fi

  image_source_files=$(docker run --rm --entrypoint sh "$image" -c \
    'find /app -path /app/node_modules -prune -o -path "*/node_modules" -prune -o -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.map" -o -name ".env" -o -name ".env.*" \) -print')
  if [ -n "$image_source_files" ]; then
    printf '%s\n' "$image_source_files" >&2
    die "前端运行镜像中发现应用源码、source map 或环境文件"
  fi

  if [ "$USE_LOCAL_DEPENDENCY_IMAGES" -eq 0 ]; then
    docker pull --platform "linux/$arch" m.daocloud.io/docker.io/library/postgres:15-alpine
    docker pull --platform "linux/$arch" m.daocloud.io/docker.io/library/redis:7-alpine
  fi
  for dependency in \
    m.daocloud.io/docker.io/library/postgres:15-alpine \
    m.daocloud.io/docker.io/library/redis:7-alpine; do
    dependency_arch=$(docker image inspect --format '{{.Architecture}}' "$dependency" 2>/dev/null || true)
    [ "$dependency_arch" = "$arch" ] || die "$dependency 的本地架构为 $dependency_arch，期望 $arch"
  done

  log "导出 linux/$arch 离线镜像归档"
  docker save "$image" \
    m.daocloud.io/docker.io/library/postgres:15-alpine \
    m.daocloud.io/docker.io/library/redis:7-alpine | gzip -9 > "$image_archive"
  case "$arch" in
    amd64) image_amd64=$image ;;
    arm64) image_arm64=$image ;;
  esac
  IFS=','
done
IFS=$OLD_IFS

cat > "$STAGE/release.json" <<EOF
{
  "product": "Wuhr AI Ops",
  "version": "$VERSION",
  "frontendCommit": "$FRONTEND_COMMIT",
  "agentCommit": "$AGENT_COMMIT",
  "agentSourceSha256": "$AGENT_SOURCE_SHA256",
  "buildDate": "$BUILD_DATE",
  "frontendImageLinuxAmd64": "$image_amd64",
  "frontendImageLinuxArm64": "$image_arm64",
  "agentTargets": [
    "linux-amd64",
    "linux-arm64",
    "darwin-amd64",
    "darwin-arm64"
  ],
  "sourceIncluded": false
}
EOF

if find "$STAGE" -type f \( -name '*.go' -o -name '*.ts' -o -name '*.tsx' \
  -o -name '*.map' -o -name '.env' -o -name '*.pem' -o -name '*.key' \) | grep -q .; then
  find "$STAGE" -type f \( -name '*.go' -o -name '*.ts' -o -name '*.tsx' \
    -o -name '*.map' -o -name '.env' -o -name '*.pem' -o -name '*.key' \) >&2
  die "发布目录中发现源码、环境文件或私钥"
fi
if find "$STAGE" -type d -name .git | grep -q .; then
  die "发布目录中发现 .git"
fi

(
  cd "$STAGE"
  find . -type f ! -name SHA256SUMS -print | LC_ALL=C sort | while IFS= read -r file; do
    checksum_file "$file"
  done > SHA256SUMS
)

mkdir -p "$AGENT_STAGE/agent/bin"
cp "$STAGE/install-agent.sh" "$STAGE/uninstall-agent.sh" "$STAGE/doctor.sh" "$AGENT_STAGE/"
cp "$STAGE/agent/bin/"* "$AGENT_STAGE/agent/bin/"
chmod 0755 "$AGENT_STAGE"/*.sh "$AGENT_STAGE/agent/bin/"*
cat > "$AGENT_STAGE/release.json" <<EOF
{
  "product": "Wuhr Agent",
  "version": "$VERSION",
  "agentCommit": "$AGENT_COMMIT",
  "agentSourceSha256": "$AGENT_SOURCE_SHA256",
  "buildDate": "$BUILD_DATE",
  "agentTargets": [
    "linux-amd64",
    "linux-arm64",
    "darwin-amd64",
    "darwin-arm64"
  ],
  "sourceIncluded": false
}
EOF
(
  cd "$AGENT_STAGE"
  find . -type f ! -name SHA256SUMS -print | LC_ALL=C sort | while IFS= read -r file; do
    checksum_file "$file"
  done > SHA256SUMS
)

rm -f "$ARCHIVE" "$ARCHIVE.sha256" "$AGENT_ARCHIVE" "$AGENT_ARCHIVE.sha256"
tar -C "$OUTPUT_DIR" -czf "$ARCHIVE" "$RELEASE_NAME"
tar -C "$OUTPUT_DIR" -czf "$AGENT_ARCHIVE" "$AGENT_RELEASE_NAME"
(
  cd "$OUTPUT_DIR"
  checksum_file "$RELEASE_NAME.tar.gz" > "$RELEASE_NAME.tar.gz.sha256"
  checksum_file "$AGENT_RELEASE_NAME.tar.gz" > "$AGENT_RELEASE_NAME.tar.gz.sha256"
)

log "发布包已生成：$ARCHIVE"
log "校验文件已生成：$ARCHIVE.sha256"
log "Agent 包已生成：$AGENT_ARCHIVE"
log "Agent 校验文件已生成：$AGENT_ARCHIVE.sha256"
log "发布包不包含前端或 Agent 源码"
