#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.deploy.yml"
AGENT_BOOTSTRAP="$ROOT_DIR/packaging/runtime/install-agent-bootstrap.sh"

MODE=${1:-all}
case "$MODE" in
  all|platform|verify|down)
    [ "$#" -eq 0 ] || shift
    ;;
  -h|--help|help)
    MODE=help
    [ "$#" -eq 0 ] || shift
    ;;
  *)
    MODE=all
    ;;
esac

PROJECT_NAME="wuhr-ai-ops"
PLATFORM_PORT="3000"
PLATFORM_BIND_ADDRESS="0.0.0.0"
AGENT_PORT="2081"
AGENT_URL=""
AGENT_API_KEY_FILE=""
AGENT_ENV_FILE=""
PLATFORM_ENV_FILE=""
ADMIN_PASSWORD_FILE=""
STATE_DIR=""
FRONTEND_IMAGE=""
SKIP_BUILD=0
SKIP_DOCKER_INSTALL=0

log() {
  printf '%s\n' "[Wuhr 部署] $*"
}

warn() {
  printf '%s\n' "[Wuhr 部署][警告] $*" >&2
}

die() {
  printf '%s\n' "[Wuhr 部署][错误] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Wuhr AI Ops 源码一键部署

用法：
  sudo ./deploy.sh all [选项]       Linux 同机部署：Agent 系统服务 + Docker 平台
  ./deploy.sh platform [选项]       只部署 Docker 平台，连接已有 Agent
  ./deploy.sh verify [选项]         验证已部署的平台、数据库、Redis、调度器和 Agent
  ./deploy.sh down [选项]           停止容器但保留全部数据卷

常用选项：
  --project-name NAME                Docker Compose 项目名，默认 wuhr-ai-ops
  --port PORT                        平台端口，默认 3000
  --bind-address ADDRESS             平台监听地址，默认 0.0.0.0
  --state-dir PATH                   密钥与部署状态目录，默认 .deploy/项目名
  --platform-env-file FILE           接管旧部署时导入数据库/JWT/加密配置
  --image IMAGE                      前端镜像名，默认按当前 Git 提交生成
  --skip-build                       复用已存在的前端镜像
  --skip-docker-install              Docker 缺失时不尝试自动安装

Agent 选项：
  --agent-port PORT                  all 模式本机 Agent 端口，默认 2081
  --agent-url URL                    platform 模式已有 Agent 地址
  --agent-api-key-file FILE          已有 Agent API Key 文件
  --agent-env-file FILE              从现有环境文件读取 IMPROVE_API_BASE_URL/KEY

账号选项：
  --admin-password-file FILE         首次管理员密码文件；未指定时自动生成

示例：
  sudo ./deploy.sh all
  ./deploy.sh platform --agent-env-file .env.local
  ./deploy.sh platform --platform-env-file .env --agent-env-file .env.local
  ./deploy.sh platform --project-name wuhr-test --port 3100 \
    --agent-url http://10.0.0.20:2081 --agent-api-key-file ./agent-api-key.txt
EOF
}

need_value() {
  [ "$#" -ge 2 ] || die "参数 $1 缺少值"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-name)
      need_value "$@"
      PROJECT_NAME=$2
      shift 2
      ;;
    --port|--platform-port)
      need_value "$@"
      PLATFORM_PORT=$2
      shift 2
      ;;
    --bind-address|--platform-bind-address)
      need_value "$@"
      PLATFORM_BIND_ADDRESS=$2
      shift 2
      ;;
    --agent-port)
      need_value "$@"
      AGENT_PORT=$2
      shift 2
      ;;
    --agent-url)
      need_value "$@"
      AGENT_URL=$2
      shift 2
      ;;
    --agent-api-key-file)
      need_value "$@"
      AGENT_API_KEY_FILE=$2
      shift 2
      ;;
    --agent-env-file)
      need_value "$@"
      AGENT_ENV_FILE=$2
      shift 2
      ;;
    --platform-env-file)
      need_value "$@"
      PLATFORM_ENV_FILE=$2
      shift 2
      ;;
    --admin-password-file)
      need_value "$@"
      ADMIN_PASSWORD_FILE=$2
      shift 2
      ;;
    --state-dir)
      need_value "$@"
      STATE_DIR=$2
      shift 2
      ;;
    --image)
      need_value "$@"
      FRONTEND_IMAGE=$2
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-docker-install)
      SKIP_DOCKER_INSTALL=1
      shift
      ;;
    -h|--help)
      MODE=help
      shift
      ;;
    *)
      die "未知参数：$1"
      ;;
  esac
done

[ "$MODE" != "help" ] || {
  usage
  exit 0
}

case "$PROJECT_NAME" in
  ''|[!a-z0-9]*|*[!a-z0-9_-]*)
    die "项目名只允许小写字母、数字、下划线和连字符"
    ;;
esac

validate_port() {
  label=$1
  value=$2
  case "$value" in
    ''|*[!0-9]*) die "$label 必须是 1-65535 的整数" ;;
  esac
  [ "$value" -ge 1 ] && [ "$value" -le 65535 ] ||
    die "$label 必须是 1-65535 的整数"
}

validate_port "平台端口" "$PLATFORM_PORT"
validate_port "Agent 端口" "$AGENT_PORT"
case "$PLATFORM_BIND_ADDRESS" in
  *[!0-9a-fA-F.:]*) die "平台监听地址格式不合法" ;;
esac

if [ -z "$STATE_DIR" ]; then
  STATE_DIR="$ROOT_DIR/.deploy/$PROJECT_NAME"
fi
case "$STATE_DIR" in
  /*) ;;
  *) STATE_DIR="$ROOT_DIR/$STATE_DIR" ;;
esac

ENV_FILE="$STATE_DIR/.env"
CREDENTIALS_FILE="$STATE_DIR/initial-credentials.txt"
SHARED_AGENT_KEY_FILE="$STATE_DIR/agent-api-key.txt"

read_env_value() {
  key=$1
  file=$2
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

read_secret_file() {
  file=$1
  [ -r "$file" ] || die "无法读取密钥文件：$file"
  value=$(tr -d '\r\n' < "$file")
  [ -n "$value" ] || die "密钥文件为空：$file"
  printf '%s' "$value"
}

validate_secret() {
  label=$1
  value=$2
  case "$value" in
    *[!A-Za-z0-9._:@+-]*) die "$label 含有不支持的字符" ;;
  esac
  [ "${#value}" -ge 12 ] || die "$label 至少需要 12 个字符"
}

random_hex() {
  bytes=$1
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

install_docker() {
  [ "$SKIP_DOCKER_INSTALL" -eq 0 ] ||
    die "未检测到 Docker，且指定了 --skip-docker-install"
  [ "$(uname -s)" = "Linux" ] ||
    die "请先安装并启动 Docker Desktop"
  [ "$(id -u)" -eq 0 ] ||
    die "自动安装 Docker 需要 root 权限"

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates docker.io
    apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker docker-compose-plugin
  elif command -v yum >/dev/null 2>&1; then
    yum install -y docker docker-compose-plugin
  elif command -v zypper >/dev/null 2>&1; then
    zypper --non-interactive install docker docker-compose
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache docker docker-cli-compose
  else
    die "无法识别包管理器，请先安装 Docker Engine 与 Compose v2"
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "未检测到 Docker，开始安装"
    install_docker
  fi
  if ! docker info >/dev/null 2>&1; then
    if [ "$(uname -s)" = "Linux" ] && [ "$(id -u)" -eq 0 ]; then
      if command -v systemctl >/dev/null 2>&1; then
        systemctl enable --now docker
      elif command -v rc-service >/dev/null 2>&1; then
        rc-update add docker default >/dev/null 2>&1 || true
        rc-service docker start
      fi
    fi
  fi
  docker info >/dev/null 2>&1 || die "无法连接 Docker daemon"
  docker compose version >/dev/null 2>&1 ||
    die "需要 Docker Compose v2"
}

compose() {
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" "$@"
}

health_check() {
  attempts=90
  while [ "$attempts" -gt 0 ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl --noproxy '*' -fsS \
        "http://127.0.0.1:$PLATFORM_PORT/api/health" >/dev/null 2>&1; then
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q -O /dev/null \
        "http://127.0.0.1:$PLATFORM_PORT/api/health"; then
        return 0
      fi
    elif compose exec -T app node -e \
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts - 1))
    sleep 2
  done
  return 1
}

verify_stack() {
  health_check || die "平台健康检查失败"
  compose exec -T postgres sh -c \
    'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null ||
    die "PostgreSQL 健康检查失败"
  compose exec -T redis sh -c \
    'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping' |
    grep -q PONG || die "Redis 健康检查失败"
  compose ps --status running --services | grep -qx app ||
    die "平台应用容器未运行"
  compose ps --status running --services | grep -qx deployment-scheduler ||
    die "交付调度器容器未运行"
  compose exec -T app sh -c \
    'curl -fsS -H "X-API-Key: $IMPROVE_API_KEY" \
      "$IMPROVE_API_BASE_URL/api/health" >/dev/null' ||
    die "平台容器无法连接 Agent，请检查 Agent 地址、防火墙和 API Key"
  log "验收通过：平台、PostgreSQL、Redis、交付调度器和 Agent 均可用"
}

[ -f "$COMPOSE_FILE" ] || die "缺少 docker-compose.deploy.yml"

if [ "$MODE" = "verify" ] || [ "$MODE" = "down" ]; then
  [ -f "$ENV_FILE" ] || die "找不到部署状态：$ENV_FILE"
  STORED_PLATFORM_PORT=$(read_env_value PLATFORM_PORT "$ENV_FILE")
  [ -z "$STORED_PLATFORM_PORT" ] || PLATFORM_PORT=$STORED_PLATFORM_PORT
  ensure_docker
  if [ "$MODE" = "down" ]; then
    compose down --remove-orphans
    log "容器已停止，数据库和其他数据卷均已保留"
  else
    verify_stack
    compose ps
  fi
  exit 0
fi

ensure_docker

FIRST_INSTALL=0
[ -f "$ENV_FILE" ] || FIRST_INSTALL=1
ADOPT_EXISTING=0
if [ "$FIRST_INSTALL" -eq 1 ] &&
  docker volume inspect "${PROJECT_NAME}_postgres_data" >/dev/null 2>&1; then
  ADOPT_EXISTING=1
  [ -n "$PLATFORM_ENV_FILE" ] ||
    die "检测到项目 $PROJECT_NAME 的旧 PostgreSQL 数据卷；请使用 --platform-env-file 导入旧数据库密钥后再接管"
  log "检测到旧 PostgreSQL 数据卷，将保留原账号、密钥和业务数据"
fi
umask 077
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

EXISTING_AGENT_URL=$(read_env_value IMPROVE_API_BASE_URL "$ENV_FILE")
EXISTING_AGENT_KEY=$(read_env_value IMPROVE_API_KEY "$ENV_FILE")

if [ -n "$AGENT_ENV_FILE" ]; then
  [ -r "$AGENT_ENV_FILE" ] || die "无法读取 Agent 环境文件：$AGENT_ENV_FILE"
  ENV_AGENT_URL=$(read_env_value IMPROVE_API_BASE_URL "$AGENT_ENV_FILE")
  ENV_AGENT_KEY=$(read_env_value IMPROVE_API_KEY "$AGENT_ENV_FILE")
  [ -n "$AGENT_URL" ] || AGENT_URL=$ENV_AGENT_URL
  [ -z "$ENV_AGENT_KEY" ] || EXISTING_AGENT_KEY=$ENV_AGENT_KEY
fi
if [ -n "$AGENT_API_KEY_FILE" ]; then
  AGENT_API_KEY=$(read_secret_file "$AGENT_API_KEY_FILE")
elif [ -n "$EXISTING_AGENT_KEY" ]; then
  AGENT_API_KEY=$EXISTING_AGENT_KEY
else
  AGENT_API_KEY="wuhr_$(random_hex 24)"
fi
validate_secret "Agent API Key" "$AGENT_API_KEY"

if [ "$MODE" = "all" ]; then
  [ "$(uname -s)" = "Linux" ] ||
    die "all 模式需要 Linux；macOS/Windows 请使用 platform 模式连接 Linux Agent"
  [ "$(id -u)" -eq 0 ] ||
    die "安装 Agent 系统服务需要 root 权限，请使用 sudo ./deploy.sh all"
  [ -f "$AGENT_BOOTSTRAP" ] || die "缺少 Agent 在线安装器"

  printf '%s\n' "$AGENT_API_KEY" > "$SHARED_AGENT_KEY_FILE"
  chmod 600 "$SHARED_AGENT_KEY_FILE"
  log "安装或升级本机 Agent 系统服务"
  sh "$AGENT_BOOTSTRAP" \
    --api-key-file "$SHARED_AGENT_KEY_FILE" \
    --port "$AGENT_PORT" \
    --frontend-url "http://127.0.0.1:$PLATFORM_PORT"
  AGENT_URL="http://host.docker.internal:$AGENT_PORT"
else
  [ -n "$AGENT_URL" ] || AGENT_URL=$EXISTING_AGENT_URL
  [ -n "$AGENT_URL" ] ||
    die "platform 模式首次部署必须提供 --agent-url 或 --agent-env-file"
fi

case "$AGENT_URL" in
  http://*|https://*) ;;
  *) die "Agent URL 必须以 http:// 或 https:// 开头" ;;
esac

if [ -z "$FRONTEND_IMAGE" ]; then
  SOURCE_REVISION=$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || printf '%s' local)
  if [ -n "$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true)" ]; then
    SOURCE_REVISION="$SOURCE_REVISION-dirty"
  fi
  FRONTEND_IMAGE="wuhr-ai-ops:source-$SOURCE_REVISION"
fi
case "$FRONTEND_IMAGE" in
  *[!A-Za-z0-9_./:-]*) die "前端镜像名称含有非法字符" ;;
esac

DB_NAME=$(read_env_value DB_NAME "$ENV_FILE")
DB_USER=$(read_env_value DB_USER "$ENV_FILE")
DB_PASSWORD=$(read_env_value DB_PASSWORD "$ENV_FILE")
REDIS_PASSWORD=$(read_env_value REDIS_PASSWORD "$ENV_FILE")
JWT_SECRET=$(read_env_value JWT_SECRET "$ENV_FILE")
ENCRYPTION_KEY=$(read_env_value ENCRYPTION_KEY "$ENV_FILE")

if [ -n "$PLATFORM_ENV_FILE" ]; then
  [ -r "$PLATFORM_ENV_FILE" ] ||
    die "无法读取平台环境文件：$PLATFORM_ENV_FILE"
  [ -n "$DB_NAME" ] || DB_NAME=$(read_env_value DB_NAME "$PLATFORM_ENV_FILE")
  [ -n "$DB_USER" ] || DB_USER=$(read_env_value DB_USER "$PLATFORM_ENV_FILE")
  [ -n "$DB_PASSWORD" ] || DB_PASSWORD=$(read_env_value DB_PASSWORD "$PLATFORM_ENV_FILE")
  [ -n "$REDIS_PASSWORD" ] || REDIS_PASSWORD=$(read_env_value REDIS_PASSWORD "$PLATFORM_ENV_FILE")
  [ -n "$JWT_SECRET" ] || JWT_SECRET=$(read_env_value JWT_SECRET "$PLATFORM_ENV_FILE")
  [ -n "$ENCRYPTION_KEY" ] || ENCRYPTION_KEY=$(read_env_value ENCRYPTION_KEY "$PLATFORM_ENV_FILE")
fi

if [ "$ADOPT_EXISTING" -eq 1 ]; then
  [ -n "$DB_NAME" ] || die "旧环境文件缺少 DB_NAME，已停止接管以保护现有数据"
  [ -n "$DB_USER" ] || die "旧环境文件缺少 DB_USER，已停止接管以保护现有数据"
  [ -n "$DB_PASSWORD" ] || die "旧环境文件缺少 DB_PASSWORD，已停止接管以保护现有数据"
  [ -n "$REDIS_PASSWORD" ] || die "旧环境文件缺少 REDIS_PASSWORD，已停止接管以保护现有数据"
  [ -n "$JWT_SECRET" ] || die "旧环境文件缺少 JWT_SECRET，已停止接管以保护现有会话"
  [ -n "$ENCRYPTION_KEY" ] || die "旧环境文件缺少 ENCRYPTION_KEY，已停止接管以保护现有加密数据"
fi

DB_NAME=${DB_NAME:-wuhr_ai_ops}
DB_USER=${DB_USER:-wuhr}
DB_PASSWORD=${DB_PASSWORD:-$(random_hex 24)}
REDIS_PASSWORD=${REDIS_PASSWORD:-$(random_hex 24)}
JWT_SECRET=${JWT_SECRET:-$(random_hex 48)}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(random_hex 32)}

ADMIN_PASSWORD=$(read_env_value DEFAULT_ADMIN_PASSWORD "$ENV_FILE")
if [ "$ADOPT_EXISTING" -eq 1 ] && [ -n "$ADMIN_PASSWORD_FILE" ]; then
  die "接管旧数据卷不会重置管理员密码；请移除 --admin-password-file 并使用原密码登录"
fi
if { [ "$FIRST_INSTALL" -eq 1 ] && [ "$ADOPT_EXISTING" -eq 0 ]; } ||
  [ -n "$ADMIN_PASSWORD" ]; then
  if [ -n "$ADMIN_PASSWORD_FILE" ]; then
    ADMIN_PASSWORD=$(read_secret_file "$ADMIN_PASSWORD_FILE")
  elif [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD="WuhrA1-$(random_hex 10)"
  fi
  validate_secret "管理员密码" "$ADMIN_PASSWORD"
fi

cat > "$ENV_FILE.new" <<EOF
WUHR_RUNTIME_ENV_FILE=$ENV_FILE
WUHR_FRONTEND_IMAGE=$FRONTEND_IMAGE
PLATFORM_BIND_ADDRESS=$PLATFORM_BIND_ADDRESS
PLATFORM_PORT=$PLATFORM_PORT
TZ=Asia/Shanghai
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRY=7d
ENCRYPTION_KEY=$ENCRYPTION_KEY
IMPROVE_API_BASE_URL=$AGENT_URL
IMPROVE_API_KEY=$AGENT_API_KEY
DEPLOYMENT_SCHEDULER_INTERVAL_MS=30000
EOF
if [ -n "$ADMIN_PASSWORD" ]; then
  printf 'DEFAULT_ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD" >> "$ENV_FILE.new"
fi
chmod 600 "$ENV_FILE.new"
mv "$ENV_FILE.new" "$ENV_FILE"

compose config -q || die "Docker Compose 配置校验失败"

if [ "$SKIP_BUILD" -eq 0 ]; then
  log "构建当前源码的前端 Docker 镜像：$FRONTEND_IMAGE"
  compose build app
else
  docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1 ||
    die "--skip-build 指定的镜像不存在：$FRONTEND_IMAGE"
fi

log "启动 PostgreSQL、Redis、平台和交付调度器"
compose up -d --remove-orphans
health_check || {
  compose ps >&2 || true
  compose logs --tail=160 app postgres redis >&2 || true
  die "平台启动后健康检查失败"
}

if [ -n "$ADMIN_PASSWORD" ]; then
  if [ ! -f "$CREDENTIALS_FILE" ]; then
  cat > "$CREDENTIALS_FILE" <<EOF
Wuhr AI Ops 初始凭据
生成时间：$(date '+%Y-%m-%d %H:%M:%S %z')
平台地址：http://127.0.0.1:$PLATFORM_PORT
管理员账号：admin
管理员密码：$ADMIN_PASSWORD
Agent 地址：$AGENT_URL
Agent API Key：$AGENT_API_KEY

首次登录后请立即修改管理员密码，并在安全保存后删除本文件。
EOF
    chmod 600 "$CREDENTIALS_FILE"
  fi

  sed '/^DEFAULT_ADMIN_PASSWORD=/d' "$ENV_FILE" > "$ENV_FILE.without-admin"
  chmod 600 "$ENV_FILE.without-admin"
  mv "$ENV_FILE.without-admin" "$ENV_FILE"
  compose up -d --force-recreate app deployment-scheduler
  health_check || die "移除初始管理员明文密码后平台健康检查失败"
fi

verify_stack
compose ps
log "部署完成：http://127.0.0.1:$PLATFORM_PORT"
if [ -f "$CREDENTIALS_FILE" ]; then
  log "初始凭据：${CREDENTIALS_FILE}（权限 600）"
fi
log "再次验证：./deploy.sh verify --project-name $PROJECT_NAME"
log "停止容器：./deploy.sh down --project-name $PROJECT_NAME"
