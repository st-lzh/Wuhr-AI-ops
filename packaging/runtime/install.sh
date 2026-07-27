#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MODE=${1:-all}
if [ "$#" -gt 0 ]; then
  shift
fi

usage() {
  cat <<'EOF'
Wuhr AI Ops 一键安装

用法：
  sudo ./install.sh all       同机安装平台与 Agent（推荐）
  sudo ./install.sh platform  仅安装 Docker 平台
  sudo ./install.sh agent     仅安装本机 Agent
  sudo ./install.sh doctor    运行安装后检查

平台默认端口：3000
Agent 默认端口：2081

all 模式选项：
  --platform-port PORT          平台端口，默认 3000
  --agent-port PORT             Agent 端口，默认 2081
  --platform-bind-address ADDR  平台监听地址，默认 0.0.0.0
  --agent-bind-address ADDR     Agent 监听地址，默认 0.0.0.0
  --admin-password-file FILE    首次管理员密码文件
  --skip-docker-install         不自动安装 Docker
  --open-firewall               开放 Agent 端口

更多高级参数请直接运行 install-platform.sh 或 install-agent.sh。
EOF
}

case "$MODE" in
  -h|--help|help)
    usage
    exit 0
    ;;
  all)
    [ "$(id -u)" -eq 0 ] || {
      printf '%s\n' "请使用 sudo ./install.sh all" >&2
      exit 1
    }
    PLATFORM_PORT=3000
    AGENT_PORT=2081
    PLATFORM_BIND_ADDRESS=0.0.0.0
    AGENT_BIND_ADDRESS=0.0.0.0
    ADMIN_PASSWORD_FILE=""
    SKIP_DOCKER_INSTALL=0
    OPEN_FIREWALL=0
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --platform-port) PLATFORM_PORT=$2; shift 2 ;;
        --agent-port) AGENT_PORT=$2; shift 2 ;;
        --platform-bind-address) PLATFORM_BIND_ADDRESS=$2; shift 2 ;;
        --agent-bind-address) AGENT_BIND_ADDRESS=$2; shift 2 ;;
        --admin-password-file) ADMIN_PASSWORD_FILE=$2; shift 2 ;;
        --skip-docker-install) SKIP_DOCKER_INSTALL=1; shift ;;
        --open-firewall) OPEN_FIREWALL=1; shift ;;
        *)
          printf '%s\n' "all 模式不支持参数：$1" >&2
          usage >&2
          exit 1
          ;;
      esac
    done
    umask 077
    SHARED_KEY_FILE=$(mktemp "${TMPDIR:-/tmp}/wuhr-agent-key.XXXXXX")
    trap 'rm -f "$SHARED_KEY_FILE"' EXIT HUP INT TERM
    if command -v openssl >/dev/null 2>&1; then
      printf 'wuhr_%s\n' "$(openssl rand -hex 24)" > "$SHARED_KEY_FILE"
    else
      printf 'wuhr_%s\n' "$(od -An -N 24 -tx1 /dev/urandom | tr -d ' \n')" > "$SHARED_KEY_FILE"
    fi
    set -- --api-key-file "$SHARED_KEY_FILE" \
      --port "$AGENT_PORT" --bind-address "$AGENT_BIND_ADDRESS"
    [ "$OPEN_FIREWALL" -eq 0 ] || set -- "$@" --open-firewall
    "$SCRIPT_DIR/install-agent.sh" "$@"

    set -- --agent-api-key-file "$SHARED_KEY_FILE" \
      --agent-url "http://host.docker.internal:$AGENT_PORT" \
      --port "$PLATFORM_PORT" --bind-address "$PLATFORM_BIND_ADDRESS"
    [ "$SKIP_DOCKER_INSTALL" -eq 0 ] || set -- "$@" --skip-docker-install
    [ -z "$ADMIN_PASSWORD_FILE" ] || set -- "$@" --admin-password-file "$ADMIN_PASSWORD_FILE"
    "$SCRIPT_DIR/install-platform.sh" \
      "$@"
    "$SCRIPT_DIR/doctor.sh" \
      --platform-url "http://127.0.0.1:$PLATFORM_PORT" \
      --agent-url "http://127.0.0.1:$AGENT_PORT"
    ;;
  platform)
    exec "$SCRIPT_DIR/install-platform.sh" "$@"
    ;;
  agent)
    exec "$SCRIPT_DIR/install-agent.sh" "$@"
    ;;
  doctor)
    exec "$SCRIPT_DIR/doctor.sh" "$@"
    ;;
  *)
    printf '%s\n' "未知安装模式：$MODE" >&2
    usage >&2
    exit 1
    ;;
esac
