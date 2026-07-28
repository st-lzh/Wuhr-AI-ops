#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKEND_DIR=${WUHR_BACKEND_DIR:-"$ROOT_DIR/../v1/backend"}
OUTPUT_DIR=${WUHR_RELEASE_OUTPUT_DIR:-"$ROOT_DIR/dist/agent"}
RUNTIME_DIR="$ROOT_DIR/packaging/runtime"
VERSION=""
TARGETS="linux-amd64,linux-arm64,darwin-amd64,darwin-arm64"
SKIP_TESTS=0

log() {
  printf '%s\n' "[agent-release] $*"
}

die() {
  printf '%s\n' "[agent-release][错误] $*" >&2
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
用法：./packaging/build-agent-release.sh [选项]

选项：
  --version VERSION      发布版本，默认读取 package.json
  --targets LIST         默认 linux-amd64,linux-arm64,darwin-amd64,darwin-arm64
  --backend-dir PATH     Agent 源码目录
  --output-dir PATH      输出目录，默认 ./dist/agent
  --skip-tests           跳过 Go 测试（正式发布不建议）
  -h, --help             显示帮助

本脚本只生成编译后的后端 Agent 分架构包，不构建、不导出前端 Docker 镜像。
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
    --targets)
      need_value "$@"
      TARGETS=$2
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

[ -f "$BACKEND_DIR/go.mod" ] || die "Agent 目录缺少 go.mod：$BACKEND_DIR"
for command_name in go gzip tar; do
  command -v "$command_name" >/dev/null 2>&1 || die "缺少构建命令：$command_name"
done
for file in install-agent.sh uninstall-agent.sh doctor.sh install-agent-bootstrap.sh; do
  [ -f "$RUNTIME_DIR/$file" ] || die "发布运行时缺少 $file"
done
for script in "$RUNTIME_DIR/install-agent.sh" "$RUNTIME_DIR/uninstall-agent.sh" \
  "$RUNTIME_DIR/doctor.sh" "$RUNTIME_DIR/install-agent-bootstrap.sh" "$0"; do
  sh -n "$script" || die "Shell 语法检查失败：$script"
done

OLD_IFS=$IFS
IFS=','
for target in $TARGETS; do
  case "$target" in
    linux-amd64|linux-arm64|darwin-amd64|darwin-arm64) ;;
    *) die "不支持的目标：$target" ;;
  esac
done
IFS=$OLD_IFS

if [ "$SKIP_TESTS" -eq 0 ]; then
  log "运行 Agent Go 测试"
  (
    cd "$BACKEND_DIR"
    go test ./...
  )
fi

AGENT_SOURCE_SHA256=$(
  cd "$BACKEND_DIR"
  find . -type f \( -name '*.go' -o -name 'go.mod' -o -name 'go.sum' \) -print |
    LC_ALL=C sort |
    while IFS= read -r source_file; do
      checksum_file "$source_file"
    done |
    checksum_stream
)
AGENT_COMMIT=$(git -C "$BACKEND_DIR" rev-parse --short=12 HEAD 2>/dev/null || true)
if [ -z "$AGENT_COMMIT" ]; then
  AGENT_COMMIT="source-$(printf '%s' "$AGENT_SOURCE_SHA256" | cut -c1-12)"
fi
BUILD_DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

mkdir -p "$OUTPUT_DIR"
rm -rf "$OUTPUT_DIR/.stage"
mkdir -p "$OUTPUT_DIR/.stage"

OLD_IFS=$IFS
IFS=','
for target in $TARGETS; do
  IFS=$OLD_IFS
  goos=${target%-*}
  goarch=${target#*-}
  release_name="wuhr-agent-$VERSION-$target"
  stage="$OUTPUT_DIR/.stage/$release_name"
  archive="$OUTPUT_DIR/$release_name.tar.gz"

  log "构建 $target"
  mkdir -p "$stage/agent/bin"
  (
    cd "$BACKEND_DIR"
    CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
      go build -trimpath \
      -ldflags "-s -w -X main.version=$VERSION -X main.commit=$AGENT_COMMIT -X main.date=$BUILD_DATE" \
      -o "$stage/agent/bin/kubelet-wuhrai-$target" ./cmd
  )

  cp "$RUNTIME_DIR/install-agent.sh" "$RUNTIME_DIR/uninstall-agent.sh" \
    "$RUNTIME_DIR/doctor.sh" "$stage/"
  chmod 0755 "$stage"/*.sh "$stage/agent/bin/kubelet-wuhrai-$target"

  cat > "$stage/release.json" <<EOF
{
  "product": "Wuhr Agent",
  "version": "$VERSION",
  "target": "$target",
  "agentCommit": "$AGENT_COMMIT",
  "agentSourceSha256": "$AGENT_SOURCE_SHA256",
  "buildDate": "$BUILD_DATE",
  "sourceIncluded": false
}
EOF

  if find "$stage" -type f \( -name '*.go' -o -name '*.ts' -o -name '*.tsx' \
    -o -name '*.map' -o -name '.env' -o -name '*.pem' -o -name '*.key' \) |
    grep -q .; then
    die "$target 发布目录中发现源码、环境文件或私钥"
  fi

  (
    cd "$stage"
    find . -type f ! -name SHA256SUMS -print | LC_ALL=C sort |
      while IFS= read -r file; do
        checksum_file "$file"
      done > SHA256SUMS
  )

  rm -f "$archive" "$archive.sha256"
  COPYFILE_DISABLE=1 tar --no-xattrs -C "$OUTPUT_DIR/.stage" -czf "$archive" "$release_name"
  (
    cd "$OUTPUT_DIR"
    checksum_file "$release_name.tar.gz" > "$release_name.tar.gz.sha256"
  )

  if tar -tzf "$archive" |
    grep -E '\.(go|ts|tsx|map)$|/(^|\.)(env|git)(/|$)' >/dev/null 2>&1; then
    die "$archive 中发现不应交付的源码或环境文件"
  fi
  IFS=','
done
IFS=$OLD_IFS

cp "$RUNTIME_DIR/install-agent-bootstrap.sh" "$OUTPUT_DIR/install-agent.sh"
chmod 0755 "$OUTPUT_DIR/install-agent.sh"
(
  cd "$OUTPUT_DIR"
  checksum_file "install-agent.sh" > "install-agent.sh.sha256"
)
rm -rf "$OUTPUT_DIR/.stage"

log "后端 Agent 分架构发布包已生成：$OUTPUT_DIR"
log "发布目录不包含前端镜像、前端源码或后端源码"
