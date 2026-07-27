#!/bin/sh
set -eu

PRODUCT_NAME="Wuhr AI Ops"
PROJECT_NAME="wuhr-ai-ops"
DEFAULT_INSTALL_DIR="/opt/wuhr-ai-ops"
DEFAULT_PORT="3000"
DEFAULT_BIND_ADDRESS="0.0.0.0"
MIN_FREE_KB="6291456"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="$DEFAULT_INSTALL_DIR"
PLATFORM_PORT="$DEFAULT_PORT"
PLATFORM_BIND_ADDRESS="$DEFAULT_BIND_ADDRESS"
AGENT_URL="http://host.docker.internal:2081"
AGENT_API_KEY_FILE=""
ADMIN_PASSWORD_FILE=""
SKIP_DOCKER_INSTALL=0
NON_INTERACTIVE=0
DRY_RUN=0

log() {
  printf '%s\n' "[Wuhr] $*"
}

warn() {
  printf '%s\n' "[Wuhr][警告] $*" >&2
}

die() {
  printf '%s\n' "[Wuhr][错误] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
用法：
  sudo ./install-platform.sh [选项]

选项：
  --install-dir PATH          安装目录，默认 /opt/wuhr-ai-ops
  --port PORT                 平台访问端口，默认 3000
  --bind-address ADDRESS      监听地址，默认 0.0.0.0
  --agent-url URL             中央 Agent 地址，默认 http://host.docker.internal:2081
  --agent-api-key-file FILE   Agent API Key 文件（推荐）
  --admin-password-file FILE  首次管理员密码文件（推荐）
  --skip-docker-install       Docker 缺失时不自动安装
  --non-interactive           非交互安装
  --dry-run                   仅执行环境检查，不写入系统
  -h, --help                  显示帮助

环境变量：
  WUHR_INSTALL_DIR、WUHR_PLATFORM_PORT、WUHR_BIND_ADDRESS、
  WUHR_AGENT_URL、WUHR_AGENT_API_KEY_FILE、WUHR_ADMIN_PASSWORD_FILE
EOF
}

need_value() {
  [ "$#" -ge 2 ] || die "参数 $1 缺少值"
}

INSTALL_DIR=${WUHR_INSTALL_DIR:-$INSTALL_DIR}
PLATFORM_PORT=${WUHR_PLATFORM_PORT:-$PLATFORM_PORT}
PLATFORM_BIND_ADDRESS=${WUHR_BIND_ADDRESS:-$PLATFORM_BIND_ADDRESS}
AGENT_URL=${WUHR_AGENT_URL:-$AGENT_URL}
AGENT_API_KEY_FILE=${WUHR_AGENT_API_KEY_FILE:-$AGENT_API_KEY_FILE}
ADMIN_PASSWORD_FILE=${WUHR_ADMIN_PASSWORD_FILE:-$ADMIN_PASSWORD_FILE}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-dir)
      need_value "$@"
      INSTALL_DIR=$2
      shift 2
      ;;
    --port)
      need_value "$@"
      PLATFORM_PORT=$2
      shift 2
      ;;
    --bind-address)
      need_value "$@"
      PLATFORM_BIND_ADDRESS=$2
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
    --admin-password-file)
      need_value "$@"
      ADMIN_PASSWORD_FILE=$2
      shift 2
      ;;
    --skip-docker-install)
      SKIP_DOCKER_INSTALL=1
      shift
      ;;
    --non-interactive)
      NON_INTERACTIVE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

case "$INSTALL_DIR" in
  /*) ;;
  *) die "--install-dir 必须是绝对路径" ;;
esac

case "$PLATFORM_PORT" in
  ''|*[!0-9]*) die "端口必须是 1-65535 的整数" ;;
esac
[ "$PLATFORM_PORT" -ge 1 ] && [ "$PLATFORM_PORT" -le 65535 ] || die "端口必须是 1-65535 的整数"

case "$PLATFORM_BIND_ADDRESS" in
  *[!0-9a-fA-F.:]*) die "监听地址格式不合法" ;;
esac

case "$AGENT_URL" in
  http://*|https://*) ;;
  *) die "Agent URL 必须以 http:// 或 https:// 开头" ;;
esac

if [ "$(uname -s)" != "Linux" ]; then
  die "平台 Docker 一键安装器当前仅支持 Linux；macOS/Windows 请安装 Docker Desktop 后手工运行发布包中的 Compose"
fi

if [ "$(id -u)" -ne 0 ]; then
  die "安装平台需要 root 权限，请使用 sudo 重新运行"
fi

SOURCE_COMPOSE="$SCRIPT_DIR/docker-compose.yml"
RELEASE_MANIFEST="$SCRIPT_DIR/release.json"

[ -f "$SOURCE_COMPOSE" ] || die "发布包缺少 docker-compose.yml"
[ -f "$RELEASE_MANIFEST" ] || die "发布包缺少 release.json"

get_json_string() {
  key=$1
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$RELEASE_MANIFEST" | head -n 1
}

RELEASE_VERSION=$(get_json_string version)
[ -n "$RELEASE_VERSION" ] || die "release.json 缺少 version"

MACHINE_ARCH=$(uname -m)
case "$MACHINE_ARCH" in
  x86_64|amd64)
    ARCH_ID="amd64"
    FRONTEND_IMAGE=$(get_json_string frontendImageLinuxAmd64)
    ;;
  arm64|aarch64)
    ARCH_ID="arm64"
    FRONTEND_IMAGE=$(get_json_string frontendImageLinuxArm64)
    ;;
  *)
    die "不支持的平台 CPU 架构：$MACHINE_ARCH"
    ;;
esac
PAYLOAD_ARCHIVE="$SCRIPT_DIR/payload/platform-images-linux-$ARCH_ID.tar.gz"
[ -f "$PAYLOAD_ARCHIVE" ] || die "发布包缺少当前架构的离线镜像：payload/platform-images-linux-$ARCH_ID.tar.gz"
[ -n "$FRONTEND_IMAGE" ] || die "release.json 未声明 linux/$ARCH_ID 平台镜像"

detect_distro() {
  DISTRO_ID="unknown"
  if [ -r /etc/os-release ]; then
    DISTRO_ID=$(sed -n 's/^ID=//p' /etc/os-release | head -n 1 | tr -d '"')
  fi
  log "检测到 Linux 发行版：$DISTRO_ID，架构：$MACHINE_ARCH"
}

install_docker() {
  [ "$SKIP_DOCKER_INSTALL" -eq 0 ] || die "未检测到 Docker，且指定了 --skip-docker-install"
  [ "$NON_INTERACTIVE" -eq 0 ] || warn "非交互模式将尝试通过系统软件源安装 Docker"

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates docker.io
    apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker docker-compose-plugin || dnf install -y docker docker-compose
  elif command -v yum >/dev/null 2>&1; then
    yum install -y docker docker-compose-plugin || yum install -y docker docker-compose
  elif command -v zypper >/dev/null 2>&1; then
    zypper --non-interactive install docker docker-compose
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache docker docker-cli-compose
  else
    die "无法识别包管理器，请先按 Docker 官方文档安装 Docker Engine 与 Compose v2"
  fi
}

start_docker() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker
  elif command -v rc-service >/dev/null 2>&1; then
    rc-update add docker default >/dev/null 2>&1 || true
    rc-service docker start
  elif command -v service >/dev/null 2>&1; then
    service docker start
  fi
}

set_compose_command() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_STYLE="plugin"
  else
    die "需要 Docker Compose v2；当前系统无法执行 'docker compose'"
  fi
}

compose() {
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

available_kb() {
  df -Pk "$1" 2>/dev/null | awk 'NR==2 {print $4}'
}

port_in_use() {
  port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$port$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$port$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

random_hex() {
  bytes=$1
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

read_secret_file() {
  file=$1
  [ -r "$file" ] || die "无法读取密钥文件：$file"
  value=$(tr -d '\r\n' < "$file")
  [ -n "$value" ] || die "密钥文件为空：$file"
  printf '%s' "$value"
}

validate_env_secret() {
  label=$1
  value=$2
  case "$value" in
    *[!A-Za-z0-9._:@+-]*) die "$label 含有不支持的字符；请只使用字母、数字及 ._:@+-" ;;
  esac
  [ "${#value}" -ge 12 ] || die "$label 至少需要 12 个字符"
}

read_existing_env() {
  key=$1
  file=$2
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

health_check() {
  attempts=60
  while [ "$attempts" -gt 0 ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl --noproxy '*' -fsS "http://127.0.0.1:$PLATFORM_PORT/api/health" >/dev/null 2>&1; then
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q -O /dev/null "http://127.0.0.1:$PLATFORM_PORT/api/health"; then
        return 0
      fi
    else
      if compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        return 0
      fi
    fi
    attempts=$((attempts - 1))
    sleep 2
  done
  return 1
}

detect_distro

free_kb=$(available_kb "$(dirname "$INSTALL_DIR")")
if [ -n "$free_kb" ] && [ "$free_kb" -lt "$MIN_FREE_KB" ]; then
  die "安装目录所在磁盘至少需要 6 GiB 可用空间"
fi

if ! command -v docker >/dev/null 2>&1; then
  [ "$DRY_RUN" -eq 0 ] || die "环境检查失败：未安装 Docker"
  log "未检测到 Docker，开始使用系统软件源安装"
  install_docker
fi

if ! docker info >/dev/null 2>&1; then
  [ "$DRY_RUN" -eq 0 ] || die "环境检查失败：Docker daemon 未运行"
  start_docker
fi
docker info >/dev/null 2>&1 || die "无法连接 Docker daemon"
set_compose_command

EXISTING_PLATFORM_PORT=$(read_existing_env PLATFORM_PORT "$INSTALL_DIR/.env")
if port_in_use "$PLATFORM_PORT"; then
  if [ ! -f "$INSTALL_DIR/.env" ] || [ "${EXISTING_PLATFORM_PORT:-}" != "$PLATFORM_PORT" ]; then
    die "端口 $PLATFORM_PORT 已被占用；请使用 --port 指定其他端口"
  fi
fi

if [ "$DRY_RUN" -eq 1 ]; then
  log "环境检查通过：Docker、Compose、磁盘、端口和发布包均可用"
  exit 0
fi

umask 077
FIRST_INSTALL=0
[ -f "$INSTALL_DIR/.env" ] || FIRST_INSTALL=1
mkdir -p "$INSTALL_DIR"
ENV_FILE="$INSTALL_DIR/.env"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
CREDENTIALS_FILE="$INSTALL_DIR/initial-credentials.txt"
ROLLBACK_DIR="$INSTALL_DIR/.rollback-$(date +%Y%m%d%H%M%S)"
mkdir -p "$ROLLBACK_DIR"

if [ -f "$ENV_FILE" ]; then
  cp -p "$ENV_FILE" "$ROLLBACK_DIR/.env"
fi
if [ -f "$COMPOSE_FILE" ]; then
  cp -p "$COMPOSE_FILE" "$ROLLBACK_DIR/docker-compose.yml"
fi

DB_NAME=$(read_existing_env DB_NAME "$ENV_FILE")
DB_USER=$(read_existing_env DB_USER "$ENV_FILE")
DB_PASSWORD=$(read_existing_env DB_PASSWORD "$ENV_FILE")
REDIS_PASSWORD=$(read_existing_env REDIS_PASSWORD "$ENV_FILE")
JWT_SECRET=$(read_existing_env JWT_SECRET "$ENV_FILE")
ENCRYPTION_KEY=$(read_existing_env ENCRYPTION_KEY "$ENV_FILE")
DEFAULT_ADMIN_PASSWORD=$(read_existing_env DEFAULT_ADMIN_PASSWORD "$ENV_FILE")
EXISTING_AGENT_KEY=$(read_existing_env IMPROVE_API_KEY "$ENV_FILE")

DB_NAME=${DB_NAME:-wuhr_ai_ops}
DB_USER=${DB_USER:-wuhr}
DB_PASSWORD=${DB_PASSWORD:-$(random_hex 24)}
REDIS_PASSWORD=${REDIS_PASSWORD:-$(random_hex 24)}
JWT_SECRET=${JWT_SECRET:-$(random_hex 48)}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(random_hex 32)}

if [ -n "$ADMIN_PASSWORD_FILE" ]; then
  DEFAULT_ADMIN_PASSWORD=$(read_secret_file "$ADMIN_PASSWORD_FILE")
elif [ -z "$DEFAULT_ADMIN_PASSWORD" ] && [ "$FIRST_INSTALL" -eq 1 ]; then
  DEFAULT_ADMIN_PASSWORD="WuhrA1-$(random_hex 10)"
fi

if [ -n "$AGENT_API_KEY_FILE" ]; then
  AGENT_API_KEY=$(read_secret_file "$AGENT_API_KEY_FILE")
elif [ -n "$EXISTING_AGENT_KEY" ]; then
  AGENT_API_KEY=$EXISTING_AGENT_KEY
else
  AGENT_API_KEY="wuhr_$(random_hex 24)"
fi

[ -z "$DEFAULT_ADMIN_PASSWORD" ] || validate_env_secret "管理员密码" "$DEFAULT_ADMIN_PASSWORD"
validate_env_secret "Agent API Key" "$AGENT_API_KEY"

cat > "$ENV_FILE.new" <<EOF
WUHR_FRONTEND_IMAGE=$FRONTEND_IMAGE
WUHR_RELEASE_VERSION=$RELEASE_VERSION
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
if [ -n "$DEFAULT_ADMIN_PASSWORD" ]; then
  printf 'DEFAULT_ADMIN_PASSWORD=%s\n' "$DEFAULT_ADMIN_PASSWORD" >> "$ENV_FILE.new"
fi
chmod 600 "$ENV_FILE.new"
mv "$ENV_FILE.new" "$ENV_FILE"
install -m 0644 "$SOURCE_COMPOSE" "$COMPOSE_FILE"
printf '%s\n' "$RELEASE_VERSION" > "$INSTALL_DIR/.release-version"

log "校验并导入离线 Docker 镜像"
if [ -f "$SCRIPT_DIR/SHA256SUMS" ]; then
  (
    cd "$SCRIPT_DIR"
    sha256sum -c SHA256SUMS
  )
fi
gzip -dc "$PAYLOAD_ARCHIVE" | docker load
docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1 || die "镜像归档中缺少 $FRONTEND_IMAGE"

rollback() {
  warn "新版本启动失败，正在恢复升级前配置"
  if [ -f "$ROLLBACK_DIR/.env" ]; then
    cp -p "$ROLLBACK_DIR/.env" "$ENV_FILE"
  fi
  if [ -f "$ROLLBACK_DIR/docker-compose.yml" ]; then
    cp -p "$ROLLBACK_DIR/docker-compose.yml" "$COMPOSE_FILE"
  fi
  if [ -f "$ROLLBACK_DIR/.env" ] && [ -f "$ROLLBACK_DIR/docker-compose.yml" ]; then
    compose up -d >/dev/null 2>&1 || true
  else
    compose down --remove-orphans >/dev/null 2>&1 || true
  fi
}

log "启动数据库、缓存、平台与交付调度器"
if ! compose config -q; then
  rollback
  die "Docker Compose 配置校验失败"
fi
if ! compose up -d --remove-orphans; then
  rollback
  die "平台容器启动失败"
fi
if ! health_check; then
  compose ps >&2 || true
  compose logs --tail=120 app >&2 || true
  rollback
  die "平台健康检查失败，已尝试恢复旧配置"
fi

if [ "$FIRST_INSTALL" -eq 1 ]; then
  cat > "$CREDENTIALS_FILE" <<EOF
$PRODUCT_NAME 初始凭据
生成时间：$(date '+%Y-%m-%d %H:%M:%S %z')
平台地址：http://$(hostname -f 2>/dev/null || hostname):$PLATFORM_PORT
管理员账号：admin
管理员密码：$DEFAULT_ADMIN_PASSWORD
Agent API Key：$AGENT_API_KEY

首次登录后请立即修改管理员密码。确认已安全保存后，请删除本文件。
EOF
  chmod 600 "$CREDENTIALS_FILE"
fi

# DEFAULT_ADMIN_PASSWORD 只在首次建库/恢复缺失管理员时需要。健康检查通过后从
# 长期环境文件移除，避免管理员明文密码伴随每次容器启动。
sed '/^DEFAULT_ADMIN_PASSWORD=/d' "$ENV_FILE" > "$ENV_FILE.without-admin-password"
chmod 600 "$ENV_FILE.without-admin-password"
mv "$ENV_FILE.without-admin-password" "$ENV_FILE"

rm -rf "$ROLLBACK_DIR"
log "安装完成"
log "平台地址：http://$(hostname -f 2>/dev/null || hostname):$PLATFORM_PORT"
if [ "$FIRST_INSTALL" -eq 1 ]; then
  log "初始凭据：$CREDENTIALS_FILE（权限 600，请妥善保存后删除）"
else
  log "升级已保留现有账号、密钥和持久化数据"
fi
log "查看状态：cd $INSTALL_DIR && docker compose -p $PROJECT_NAME ps"
