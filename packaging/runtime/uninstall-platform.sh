#!/bin/sh
set -eu

INSTALL_DIR="/opt/wuhr-ai-ops"
PURGE=0
REMOVE_IMAGES=0

usage() {
  cat <<'EOF'
用法：sudo ./uninstall-platform.sh [选项]
  --install-dir PATH  安装目录，默认 /opt/wuhr-ai-ops
  --purge             同时删除数据库、Redis 和平台持久卷（不可恢复）
  --remove-images     同时删除 Wuhr 平台镜像

默认只停止并删除容器，保留配置和全部数据卷。
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-dir) INSTALL_DIR=$2; shift 2 ;;
    --purge) PURGE=1; shift ;;
    --remove-images) REMOVE_IMAGES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf '%s\n' "未知参数：$1" >&2; exit 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || {
  printf '%s\n' "请使用 sudo 运行卸载脚本" >&2
  exit 1
}

ENV_FILE="$INSTALL_DIR/.env"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
IMAGE=""
if [ -r "$ENV_FILE" ]; then
  IMAGE=$(sed -n 's/^WUHR_FRONTEND_IMAGE=//p' "$ENV_FILE" | tail -n 1)
fi

if [ -r "$ENV_FILE" ] && [ -r "$COMPOSE_FILE" ] && command -v docker >/dev/null 2>&1; then
  if [ "$PURGE" -eq 1 ]; then
    docker compose -p wuhr-ai-ops --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --volumes --remove-orphans
  else
    docker compose -p wuhr-ai-ops --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --remove-orphans
  fi
fi

if [ "$REMOVE_IMAGES" -eq 1 ] && [ -n "$IMAGE" ]; then
  docker image rm "$IMAGE" >/dev/null 2>&1 || true
fi

if [ "$PURGE" -eq 1 ]; then
  rm -rf "$INSTALL_DIR"
  printf '%s\n' "平台、配置和数据卷已删除。"
else
  printf '%s\n' "平台容器已删除，配置与数据卷仍保留在 $INSTALL_DIR 和 Docker 中。"
fi
