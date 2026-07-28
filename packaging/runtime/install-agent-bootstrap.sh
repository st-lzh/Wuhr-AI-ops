#!/bin/sh
set -eu

VERSION=${WUHR_AGENT_VERSION:-1.0.0}
GITHUB_BASE=${WUHR_AGENT_GITHUB_BASE:-"https://github.com/st-lzh/Wuhr-AI-ops/releases/download/v$VERSION"}
MIRROR_BASE=${WUHR_AGENT_MIRROR_BASE:-"http://106.12.150.207/download"}
DOWNLOAD_TIMEOUT=${WUHR_AGENT_DOWNLOAD_TIMEOUT:-30}
TEMP_DIR=""

log() {
  printf '%s\n' "[Wuhr Agent 下载器] $*"
}

warn() {
  printf '%s\n' "[Wuhr Agent 下载器][警告] $*" >&2
}

die() {
  printf '%s\n' "[Wuhr Agent 下载器][错误] $*" >&2
  exit 1
}

cleanup() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup 0 HUP INT TERM

case "$VERSION" in
  ''|*[!A-Za-z0-9._-]*) die "版本号为空或含有非法字符：$VERSION" ;;
esac
case "$DOWNLOAD_TIMEOUT" in
  ''|*[!0-9]*) die "下载超时必须是正整数秒数" ;;
esac
[ "$DOWNLOAD_TIMEOUT" -ge 1 ] || die "下载超时必须大于 0 秒"

OS=$(uname -s)
case "$OS" in
  Linux) OS_ID="linux" ;;
  Darwin) OS_ID="darwin" ;;
  *) die "不支持的操作系统：$OS" ;;
esac

ARCH=$(uname -m)
case "$ARCH" in
  x86_64|amd64) ARCH_ID="amd64" ;;
  arm64|aarch64) ARCH_ID="arm64" ;;
  *) die "不支持的 CPU 架构：$ARCH" ;;
esac

PACKAGE_NAME="wuhr-agent-$VERSION-$OS_ID-$ARCH_ID.tar.gz"
CHECKSUM_NAME="$PACKAGE_NAME.sha256"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/wuhr-agent-download.XXXXXX")

download_file() {
  url=$1
  output=$2

  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error \
      --connect-timeout 10 --max-time "$DOWNLOAD_TIMEOUT" \
      --retry 1 --retry-max-time "$DOWNLOAD_TIMEOUT" \
      --output "$output" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet --timeout=15 --read-timeout="$DOWNLOAD_TIMEOUT" \
      --tries=2 --output-document="$output" "$url"
  else
    die "缺少下载工具，请先安装 curl 或 wget"
  fi
}

verify_package() {
  (
    cd "$TEMP_DIR"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c "$CHECKSUM_NAME"
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 -c "$CHECKSUM_NAME"
    else
      die "缺少 SHA-256 校验工具"
    fi
  )
}

download_from() {
  base_url=$1
  source_name=$2

  rm -f "$TEMP_DIR/$PACKAGE_NAME" "$TEMP_DIR/$CHECKSUM_NAME"
  log "正在从${source_name}下载 $PACKAGE_NAME"
  download_file "$base_url/$PACKAGE_NAME" "$TEMP_DIR/$PACKAGE_NAME" || return 1
  download_file "$base_url/$CHECKSUM_NAME" "$TEMP_DIR/$CHECKSUM_NAME" || return 1
  verify_package || return 1
  log "${source_name}下载及 SHA-256 校验通过"
}

if ! download_from "$GITHUB_BASE" "GitHub"; then
  warn "GitHub 下载失败或校验未通过，自动切换国内镜像"
  download_from "$MIRROR_BASE" "国内镜像" ||
    die "GitHub 与国内镜像均无法提供有效的 $PACKAGE_NAME"
fi

tar -C "$TEMP_DIR" -xzf "$TEMP_DIR/$PACKAGE_NAME"
PACKAGE_DIR="$TEMP_DIR/wuhr-agent-$VERSION-$OS_ID-$ARCH_ID"
LOCAL_INSTALLER="$PACKAGE_DIR/install-agent.sh"
[ -f "$LOCAL_INSTALLER" ] || die "发布包缺少 install-agent.sh"
chmod 0755 "$LOCAL_INSTALLER"

log "已选择 os=$OS_ID arch=$ARCH_ID version=$VERSION"
"$LOCAL_INSTALLER" "$@"
