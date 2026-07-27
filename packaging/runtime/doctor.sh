#!/bin/sh
set -eu

INSTALL_DIR="/opt/wuhr-ai-ops"
CONFIG_DIR="/etc/wuhr-agent"
PLATFORM_URL=""
AGENT_URL="http://127.0.0.1:2081"
FAILED=0

usage() {
  cat <<'EOF'
用法：sudo ./doctor.sh [选项]
  --install-dir PATH    平台安装目录，默认 /opt/wuhr-ai-ops
  --config-dir PATH     Agent 配置目录，默认 /etc/wuhr-agent
  --platform-url URL    平台检查地址；默认读取安装配置
  --agent-url URL       Agent 检查地址，默认 http://127.0.0.1:2081
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-dir) INSTALL_DIR=$2; shift 2 ;;
    --config-dir) CONFIG_DIR=$2; shift 2 ;;
    --platform-url) PLATFORM_URL=$2; shift 2 ;;
    --agent-url) AGENT_URL=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf '%s\n' "未知参数：$1" >&2; exit 1 ;;
  esac
done

ok() {
  printf '%s\n' "  [通过] $*"
}

fail() {
  printf '%s\n' "  [失败] $*" >&2
  FAILED=1
}

info() {
  printf '%s\n' "  [信息] $*"
}

http_status() {
  url=$1
  key=${2:-}
  if command -v curl >/dev/null 2>&1; then
    if [ -n "$key" ]; then
      curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' -H "X-API-Key: $key" "$url" || true
    else
      curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' "$url" || true
    fi
  elif command -v wget >/dev/null 2>&1; then
    if [ -n "$key" ]; then
      wget --server-response --spider --header="X-API-Key: $key" "$url" 2>&1 |
        awk '/^  HTTP\\// {code=$2} END {print code ? code : "000"}'
    else
      wget --server-response --spider "$url" 2>&1 |
        awk '/^  HTTP\\// {code=$2} END {print code ? code : "000"}'
    fi
  else
    printf '%s' "000"
  fi
}

printf '%s\n' "Wuhr AI Ops 安装诊断"
printf '%s\n' "平台检查"

ENV_FILE="$INSTALL_DIR/.env"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
if [ -r "$ENV_FILE" ] && [ -r "$COMPOSE_FILE" ]; then
  ok "安装配置存在"
  mode=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || printf '?')
  [ "$mode" = "600" ] && ok ".env 权限为 600" || fail ".env 权限应为 600，当前为 $mode"
  if [ -z "$PLATFORM_URL" ]; then
    port=$(sed -n 's/^PLATFORM_PORT=//p' "$ENV_FILE" | tail -n 1)
    PLATFORM_URL="http://127.0.0.1:${port:-3000}"
  fi
else
  info "本机未发现平台安装目录，跳过容器检查"
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ok "Docker daemon 可用"
  if [ -r "$ENV_FILE" ] && [ -r "$COMPOSE_FILE" ]; then
    running_services=$(docker compose -p wuhr-ai-ops --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" ps --services --status running 2>/dev/null | wc -l | tr -d ' ')
    if [ "${running_services:-0}" -ge 4 ]; then
      ok "平台四个核心服务均在运行"
    else
      fail "平台核心服务运行数量不足，当前为 ${running_services:-0}"
    fi
  fi
else
  [ -r "$ENV_FILE" ] && fail "Docker daemon 不可用" || info "未安装本机平台，跳过 Docker 检查"
fi

if [ -n "$PLATFORM_URL" ]; then
  status=$(http_status "$PLATFORM_URL/api/health")
  [ "$status" = "200" ] && ok "平台健康接口返回 200" || fail "平台健康接口返回 $status"
fi

printf '%s\n' "Agent 检查"
status=$(http_status "$AGENT_URL/api/health")
[ "$status" = "200" ] && ok "Agent 健康接口返回 200" || fail "Agent 健康接口返回 $status"

API_KEY_RECORD="$CONFIG_DIR/agent-api-key.txt"
if [ -r "$API_KEY_RECORD" ]; then
  key=$(tr -d '\r\n' < "$API_KEY_RECORD")
  status=$(http_status "$AGENT_URL/api/config/security" "$key")
  [ "$status" = "200" ] && ok "Agent API Key 鉴权通过" || fail "Agent API Key 鉴权返回 $status"

  invalid_status=$(http_status "$AGENT_URL/api/config/security" "invalid-doctor-key")
  [ "$invalid_status" = "401" ] && ok "Agent 拒绝无效 API Key" || fail "Agent 无效 Key 检查返回 $invalid_status"
else
  info "未找到本机 Agent API Key，跳过鉴权检查"
fi

if [ "$FAILED" -ne 0 ]; then
  printf '%s\n' "诊断未通过，请根据上面的失败项检查日志。" >&2
  exit 1
fi
printf '%s\n' "全部已执行检查均通过。"
