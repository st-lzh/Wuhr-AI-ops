#!/bin/sh
set -eu

PRODUCT_NAME="Wuhr Agent"
SERVICE_NAME="wuhr-agent"
DEFAULT_PORT="2081"
DEFAULT_BIND_ADDRESS="0.0.0.0"
DEFAULT_CONFIG_DIR="/etc/wuhr-agent"
DEFAULT_DATA_DIR="/var/lib/wuhr-agent"
DEFAULT_BIN_DIR="/usr/local/bin"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT="$DEFAULT_PORT"
BIND_ADDRESS="$DEFAULT_BIND_ADDRESS"
CONFIG_DIR="$DEFAULT_CONFIG_DIR"
DATA_DIR="$DEFAULT_DATA_DIR"
BIN_DIR="$DEFAULT_BIN_DIR"
API_KEY_FILE=""
FRONTEND_URL=""
SERVICE_USER="root"
OPEN_FIREWALL=0
DRY_RUN=0

log() {
  printf '%s\n' "[Wuhr Agent] $*"
}

warn() {
  printf '%s\n' "[Wuhr Agent][警告] $*" >&2
}

die() {
  printf '%s\n' "[Wuhr Agent][错误] $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
用法：
  sudo ./install-agent.sh [选项]

选项：
  --port PORT                Agent 服务端口，默认 2081
  --bind-address ADDRESS     监听地址，默认 0.0.0.0
  --api-key-file FILE        与平台一致的 API Key 文件；未指定时自动生成
  --frontend-url URL         平台地址，用于审批通知深链接
  --config-dir PATH          配置目录，默认 /etc/wuhr-agent
  --data-dir PATH            数据目录，默认 /var/lib/wuhr-agent
  --bin-dir PATH             二进制目录，默认 /usr/local/bin
  --service-user USER        服务用户，默认 root
  --open-firewall            自动开放 Agent 端口（默认不修改防火墙）
  --dry-run                  仅识别系统与检查发布包
  -h, --help                 显示帮助

支持：
  Linux amd64/arm64：systemd、OpenRC、SysV init
  macOS amd64/arm64：launchd
EOF
}

need_value() {
  [ "$#" -ge 2 ] || die "参数 $1 缺少值"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port)
      need_value "$@"
      PORT=$2
      shift 2
      ;;
    --bind-address)
      need_value "$@"
      BIND_ADDRESS=$2
      shift 2
      ;;
    --api-key-file)
      need_value "$@"
      API_KEY_FILE=$2
      shift 2
      ;;
    --frontend-url)
      need_value "$@"
      FRONTEND_URL=$2
      shift 2
      ;;
    --config-dir)
      need_value "$@"
      CONFIG_DIR=$2
      shift 2
      ;;
    --data-dir)
      need_value "$@"
      DATA_DIR=$2
      shift 2
      ;;
    --bin-dir)
      need_value "$@"
      BIN_DIR=$2
      shift 2
      ;;
    --service-user)
      need_value "$@"
      SERVICE_USER=$2
      shift 2
      ;;
    --open-firewall)
      OPEN_FIREWALL=1
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

case "$PORT" in
  ''|*[!0-9]*) die "端口必须是 1-65535 的整数" ;;
esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || die "端口必须是 1-65535 的整数"
case "$BIND_ADDRESS" in
  *[!0-9a-fA-F.:]*) die "监听地址格式不合法" ;;
esac
for path in "$CONFIG_DIR" "$DATA_DIR" "$BIN_DIR"; do
  case "$path" in
    /*) ;;
    *) die "目录参数必须使用绝对路径：$path" ;;
  esac
  case "$path" in
    *[!A-Za-z0-9/._-]*) die "目录参数含有服务管理器不支持的字符：$path" ;;
  esac
done
case "$SERVICE_USER" in
  ''|*[!A-Za-z0-9._-]*) die "服务用户名格式不合法" ;;
esac
if [ -n "$FRONTEND_URL" ]; then
  case "$FRONTEND_URL" in
    http://*|https://*) ;;
    *) die "平台地址必须以 http:// 或 https:// 开头" ;;
  esac
  case "$FRONTEND_URL" in
    *[!A-Za-z0-9:/._\[\]-]*) die "平台地址含有服务配置不支持的字符" ;;
  esac
fi

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

SOURCE_BINARY="$SCRIPT_DIR/agent/bin/kubelet-wuhrai-$OS_ID-$ARCH_ID"
[ -f "$SOURCE_BINARY" ] || die "发布包缺少当前系统二进制：agent/bin/kubelet-wuhrai-$OS_ID-$ARCH_ID"

detect_service_manager() {
  if [ "$OS_ID" = "darwin" ]; then
    SERVICE_MANAGER="launchd"
  elif command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    SERVICE_MANAGER="systemd"
  elif command -v rc-service >/dev/null 2>&1 && [ -d /run/openrc ]; then
    SERVICE_MANAGER="openrc"
  elif [ -d /etc/init.d ]; then
    SERVICE_MANAGER="sysv"
  else
    die "无法识别服务管理器（需要 systemd、OpenRC、SysV init 或 launchd）"
  fi
}

detect_linux_distro() {
  DISTRO_ID="-"
  DISTRO_VERSION="-"
  if [ -r /etc/os-release ]; then
    DISTRO_ID=$(sed -n 's/^ID=//p' /etc/os-release | head -n 1 | tr -d '"')
    DISTRO_VERSION=$(sed -n 's/^VERSION_ID=//p' /etc/os-release | head -n 1 | tr -d '"')
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
  [ -r "$file" ] || die "无法读取 API Key 文件：$file"
  value=$(tr -d '\r\n' < "$file")
  [ -n "$value" ] || die "API Key 文件为空：$file"
  printf '%s' "$value"
}

validate_api_key() {
  case "$1" in
    *[!A-Za-z0-9._:@+-]*) die "API Key 含有不支持的字符；请只使用字母、数字及 ._:@+-" ;;
  esac
  [ "${#1}" -ge 20 ] || die "Agent API Key 至少需要 20 个字符"
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

detect_service_manager
detect_linux_distro
log "检测结果：os=$OS_ID distro=$DISTRO_ID version=$DISTRO_VERSION arch=$ARCH_ID service=$SERVICE_MANAGER"

if [ "$DRY_RUN" -eq 1 ]; then
  log "环境检查通过，已找到匹配的 Agent 二进制"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  die "安装系统服务需要 root 权限，请使用 sudo 重新运行"
fi

if [ "$SERVICE_USER" != "root" ] && ! id "$SERVICE_USER" >/dev/null 2>&1; then
  die "服务用户不存在：$SERVICE_USER"
fi
SERVICE_GROUP=$(id -gn "$SERVICE_USER")

TARGET_BINARY="$BIN_DIR/kubelet-wuhrai"
API_KEYS_YAML="$CONFIG_DIR/api-keys.yaml"
API_KEY_RECORD="$CONFIG_DIR/agent-api-key.txt"
SECURITY_CONFIG="$CONFIG_DIR/security.json"
ENV_FILE="$CONFIG_DIR/agent.env"
HOSTS_FILE="$CONFIG_DIR/hosts.yaml"
PID_FILE="$DATA_DIR/$SERVICE_NAME.pid"
BACKUP_BINARY="$TARGET_BINARY.previous"
WAS_RUNNING=0
case "$SERVICE_MANAGER" in
  systemd) SERVICE_DEFINITION="/etc/systemd/system/$SERVICE_NAME.service" ;;
  openrc|sysv) SERVICE_DEFINITION="/etc/init.d/$SERVICE_NAME" ;;
  launchd) SERVICE_DEFINITION="/Library/LaunchDaemons/ai.wuhr.agent.plist" ;;
esac

if [ -f "$TARGET_BINARY" ]; then
  case "$SERVICE_MANAGER" in
    systemd) systemctl is-active --quiet "$SERVICE_NAME" && WAS_RUNNING=1 || true ;;
    openrc) rc-service "$SERVICE_NAME" status >/dev/null 2>&1 && WAS_RUNNING=1 || true ;;
    sysv) service "$SERVICE_NAME" status >/dev/null 2>&1 && WAS_RUNNING=1 || true ;;
    launchd) launchctl print "system/ai.wuhr.agent" >/dev/null 2>&1 && WAS_RUNNING=1 || true ;;
  esac
fi

EXISTING_AGENT_PORT=""
if [ -r "$SERVICE_DEFINITION" ]; then
  EXISTING_AGENT_PORT=$(sed -n 's/.*--http-port[[:space:]]\{1,\}\([0-9][0-9]*\).*/\1/p' \
    "$SERVICE_DEFINITION" | head -n 1)
  if [ -z "$EXISTING_AGENT_PORT" ] && [ "$SERVICE_MANAGER" = "launchd" ]; then
    EXISTING_AGENT_PORT=$(awk '
      /<string>--http-port<\/string>/ {getline; gsub(/.*<string>|<\/string>.*/, ""); print; exit}
    ' "$SERVICE_DEFINITION")
  fi
fi

if port_in_use "$PORT"; then
  if [ ! -f "$TARGET_BINARY" ] || [ "${EXISTING_AGENT_PORT:-}" != "$PORT" ]; then
    die "端口 $PORT 已被占用；请使用 --port 指定其他端口"
  fi
fi

umask 077
mkdir -p "$CONFIG_DIR" "$DATA_DIR" "$DATA_DIR/skills" "$DATA_DIR/memory" \
  "$DATA_DIR/network" "$DATA_DIR/improve" "$DATA_DIR/cache" "$BIN_DIR"
ROLLBACK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/wuhr-agent-install.XXXXXX")
for current_file in "$API_KEYS_YAML" "$API_KEY_RECORD" "$ENV_FILE" "$SERVICE_DEFINITION"; do
  if [ -f "$current_file" ]; then
    cp -p "$current_file" "$ROLLBACK_DIR/$(basename "$current_file")"
  fi
done

if [ -n "$API_KEY_FILE" ]; then
  AGENT_API_KEY=$(read_secret_file "$API_KEY_FILE")
elif [ -r "$API_KEY_RECORD" ]; then
  AGENT_API_KEY=$(read_secret_file "$API_KEY_RECORD")
else
  AGENT_API_KEY="wuhr_$(random_hex 24)"
fi
validate_api_key "$AGENT_API_KEY"

if [ -f "$TARGET_BINARY" ]; then
  cp -p "$TARGET_BINARY" "$BACKUP_BINARY"
fi
install -m 0755 "$SOURCE_BINARY" "$TARGET_BINARY.new"
mv "$TARGET_BINARY.new" "$TARGET_BINARY"

cat > "$API_KEYS_YAML.new" <<EOF
keys:
  - id: platform
    secret: "$AGENT_API_KEY"
    subject: "wuhr-platform"
    roles: ["admin", "chat", "reader"]
EOF
chmod 600 "$API_KEYS_YAML.new"
mv "$API_KEYS_YAML.new" "$API_KEYS_YAML"
printf '%s\n' "$AGENT_API_KEY" > "$API_KEY_RECORD"
chmod 600 "$API_KEY_RECORD"

if [ ! -f "$SECURITY_CONFIG" ]; then
  cat > "$SECURITY_CONFIG" <<'EOF'
{
  "enabled": true,
  "requireApproval": true,
  "commandValidation": true,
  "privilegedCommandBlocking": true,
  "pathTraversalProtection": true,
  "commandHistory": true,
  "auditLogging": true,
  "rateLimiting": true,
  "sessionTimeout": 3600,
  "maxConcurrentSessions": 10
}
EOF
fi
chmod 600 "$SECURITY_CONFIG"

if [ ! -f "$HOSTS_FILE" ]; then
  cat > "$HOSTS_FILE" <<'EOF'
hosts: []
EOF
fi
chmod 600 "$HOSTS_FILE"

cat > "$ENV_FILE" <<EOF
KUBELET_WUHRAI_SECURITY_CONFIG=$SECURITY_CONFIG
KUBELET_WUHRAI_HTTP_API_KEYS_FILE=$API_KEYS_YAML
HOME=$( [ "$SERVICE_USER" = "root" ] && printf '%s' "/root" || printf '%s' "$DATA_DIR" )
EOF
chmod 600 "$ENV_FILE"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$CONFIG_DIR" "$DATA_DIR"

build_agent_args() {
  AGENT_ARGS="--http-server --http-host $BIND_ADDRESS --http-port $PORT"
  AGENT_ARGS="$AGENT_ARGS --llm-provider ollama --model qwen2.5"
  AGENT_ARGS="$AGENT_ARGS --http-auth --http-api-keys-file $API_KEYS_YAML"
  AGENT_ARGS="$AGENT_ARGS --http-rate-limit-rps 20 --http-rate-limit-burst 60"
  AGENT_ARGS="$AGENT_ARGS --hosts-file $HOSTS_FILE"
  AGENT_ARGS="$AGENT_ARGS --skills-dir $DATA_DIR/skills --skills-cache-dir $DATA_DIR/cache"
  AGENT_ARGS="$AGENT_ARGS --memory-dir $DATA_DIR/memory --network-dir $DATA_DIR/network"
  AGENT_ARGS="$AGENT_ARGS --http-skill-discovery --improve-enabled --improve-dir $DATA_DIR/improve"
  AGENT_ARGS="$AGENT_ARGS --improve-auto-reflect-interval 24h --improve-auto-reflect-min-failures 2"
  AGENT_ARGS="$AGENT_ARGS --improve-auto-reflect-window-days 7 --alsologtostderr=true"
  if [ -n "$FRONTEND_URL" ]; then
    AGENT_ARGS="$AGENT_ARGS --improve-frontend-url $FRONTEND_URL"
  fi
}
build_agent_args

install_systemd() {
  cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=Wuhr AI Ops Agent
Documentation=https://github.com/st-lzh/Wuhr-AI-ops
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
EnvironmentFile=$ENV_FILE
WorkingDirectory=$DATA_DIR
ExecStart=$TARGET_BINARY $AGENT_ARGS
Restart=on-failure
RestartSec=5s
TimeoutStopSec=30s
LimitNOFILE=65536
NoNewPrivileges=false
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
  chmod 644 "/etc/systemd/system/$SERVICE_NAME.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
}

install_openrc() {
  cat > "/etc/init.d/$SERVICE_NAME" <<EOF
#!/sbin/openrc-run
name="Wuhr AI Ops Agent"
description="Wuhr AI Ops Agent"
command="$TARGET_BINARY"
command_args="$AGENT_ARGS"
command_user="$SERVICE_USER"
directory="$DATA_DIR"
pidfile="$PID_FILE"
command_background=true
output_log="/var/log/$SERVICE_NAME.log"
error_log="/var/log/$SERVICE_NAME.err"
export KUBELET_WUHRAI_SECURITY_CONFIG="$SECURITY_CONFIG"
export KUBELET_WUHRAI_HTTP_API_KEYS_FILE="$API_KEYS_YAML"

depend() {
  need net
  after firewall
}
EOF
  chmod 755 "/etc/init.d/$SERVICE_NAME"
  rc-update add "$SERVICE_NAME" default >/dev/null 2>&1 || true
  rc-service "$SERVICE_NAME" restart
}

install_sysv() {
  cat > "/etc/init.d/$SERVICE_NAME" <<EOF
#!/bin/sh
### BEGIN INIT INFO
# Provides:          $SERVICE_NAME
# Required-Start:    \$network
# Required-Stop:     \$network
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Wuhr AI Ops Agent
### END INIT INFO
PATH=/sbin:/usr/sbin:/bin:/usr/bin:$BIN_DIR
PIDFILE="$PID_FILE"
DAEMON="$TARGET_BINARY"
ARGS="$AGENT_ARGS"
export KUBELET_WUHRAI_SECURITY_CONFIG="$SECURITY_CONFIG"
export KUBELET_WUHRAI_HTTP_API_KEYS_FILE="$API_KEYS_YAML"

case "\$1" in
  start)
    if command -v start-stop-daemon >/dev/null 2>&1; then
      start-stop-daemon --start --background --make-pidfile --pidfile "\$PIDFILE" --chdir "$DATA_DIR" --exec "\$DAEMON" -- \$ARGS
    else
      cd "$DATA_DIR" || exit 1
      nohup "\$DAEMON" \$ARGS >>/var/log/$SERVICE_NAME.log 2>&1 &
      echo \$! > "\$PIDFILE"
    fi
    ;;
  stop)
    if command -v start-stop-daemon >/dev/null 2>&1; then
      start-stop-daemon --stop --retry TERM/30/KILL/5 --pidfile "\$PIDFILE"
    elif [ -r "\$PIDFILE" ]; then
      kill "\$(cat "\$PIDFILE")" 2>/dev/null || true
    fi
    rm -f "\$PIDFILE"
    ;;
  restart)
    "\$0" stop
    "\$0" start
    ;;
  status)
    [ -r "\$PIDFILE" ] && kill -0 "\$(cat "\$PIDFILE")" 2>/dev/null
    ;;
  *)
    echo "Usage: \$0 {start|stop|restart|status}"
    exit 2
    ;;
esac
EOF
  chmod 755 "/etc/init.d/$SERVICE_NAME"
  if command -v update-rc.d >/dev/null 2>&1; then
    update-rc.d "$SERVICE_NAME" defaults
  elif command -v chkconfig >/dev/null 2>&1; then
    chkconfig --add "$SERVICE_NAME"
    chkconfig "$SERVICE_NAME" on
  fi
  service "$SERVICE_NAME" restart
}

install_launchd() {
  PLIST="/Library/LaunchDaemons/ai.wuhr.agent.plist"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.wuhr.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$TARGET_BINARY</string>
$(printf '%s\n' "$AGENT_ARGS" | awk '{for (i=1;i<=NF;i++) printf "    <string>%s</string>\\n", $i}')
  </array>
  <key>WorkingDirectory</key><string>$DATA_DIR</string>
  <key>UserName</key><string>$SERVICE_USER</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>KUBELET_WUHRAI_SECURITY_CONFIG</key><string>$SECURITY_CONFIG</string>
    <key>KUBELET_WUHRAI_HTTP_API_KEYS_FILE</key><string>$API_KEYS_YAML</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/var/log/$SERVICE_NAME.log</string>
  <key>StandardErrorPath</key><string>/var/log/$SERVICE_NAME.err</string>
</dict>
</plist>
EOF
  chmod 644 "$PLIST"
  launchctl bootout system/ai.wuhr.agent >/dev/null 2>&1 || true
  launchctl bootstrap system "$PLIST"
  launchctl enable system/ai.wuhr.agent
  launchctl kickstart -k system/ai.wuhr.agent
}

case "$SERVICE_MANAGER" in
  systemd) install_systemd ;;
  openrc) install_openrc ;;
  sysv) install_sysv ;;
  launchd) install_launchd ;;
esac

health_check() {
  attempts=30
  while [ "$attempts" -gt 0 ]; do
    if command -v curl >/dev/null 2>&1; then
      curl --noproxy '*' -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O /dev/null "http://127.0.0.1:$PORT/api/health" && return 0
    fi
    attempts=$((attempts - 1))
    sleep 1
  done
  return 1
}

restore_file_or_remove() {
  target=$1
  backup="$ROLLBACK_DIR/$(basename "$target")"
  if [ -f "$backup" ]; then
    cp -p "$backup" "$target"
  else
    rm -f "$target"
  fi
}

rollback_install() {
  warn "服务启动失败，正在恢复安装前状态"
  if [ -f "$BACKUP_BINARY" ]; then
    cp -p "$BACKUP_BINARY" "$TARGET_BINARY"
  else
    rm -f "$TARGET_BINARY"
  fi
  restore_file_or_remove "$API_KEYS_YAML"
  restore_file_or_remove "$API_KEY_RECORD"
  restore_file_or_remove "$ENV_FILE"
  restore_file_or_remove "$SERVICE_DEFINITION"

  case "$SERVICE_MANAGER" in
    systemd)
      systemctl daemon-reload || true
      if [ "$WAS_RUNNING" -eq 1 ]; then
        systemctl restart "$SERVICE_NAME" || true
      else
        systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
      fi
      ;;
    openrc)
      if [ "$WAS_RUNNING" -eq 1 ]; then
        rc-service "$SERVICE_NAME" restart || true
      else
        rc-service "$SERVICE_NAME" stop >/dev/null 2>&1 || true
      fi
      ;;
    sysv)
      if [ "$WAS_RUNNING" -eq 1 ]; then
        service "$SERVICE_NAME" restart || true
      else
        service "$SERVICE_NAME" stop >/dev/null 2>&1 || true
      fi
      ;;
    launchd)
      launchctl bootout system/ai.wuhr.agent >/dev/null 2>&1 || true
      if [ "$WAS_RUNNING" -eq 1 ] && [ -f "$SERVICE_DEFINITION" ]; then
        launchctl bootstrap system "$SERVICE_DEFINITION" || true
      fi
      ;;
  esac
  if [ ! -f "$BACKUP_BINARY" ]; then
    rm -f "$TARGET_BINARY"
  fi
}

if ! health_check; then
  case "$SERVICE_MANAGER" in
    systemd) systemctl status "$SERVICE_NAME" --no-pager >&2 || true; journalctl -u "$SERVICE_NAME" -n 100 --no-pager >&2 || true ;;
    openrc|sysv) tail -n 100 "/var/log/$SERVICE_NAME.log" >&2 2>/dev/null || true ;;
    launchd) tail -n 100 "/var/log/$SERVICE_NAME.err" >&2 2>/dev/null || true ;;
  esac
  rollback_install
  rm -rf "$ROLLBACK_DIR"
  die "Agent 健康检查失败"
fi

if [ "$OPEN_FIREWALL" -eq 1 ]; then
  if command -v firewall-cmd >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="$PORT/tcp"
    firewall-cmd --reload
  elif command -v ufw >/dev/null 2>&1; then
    ufw allow "$PORT/tcp"
  elif command -v iptables >/dev/null 2>&1; then
    warn "检测到 iptables，但不会写入不可持久化规则；请由运维人员开放 $PORT/tcp"
  else
    warn "未识别防火墙管理工具，请手工开放 $PORT/tcp"
  fi
fi

rm -f "$BACKUP_BINARY"
rm -rf "$ROLLBACK_DIR"
log "$PRODUCT_NAME 安装完成，服务管理器：$SERVICE_MANAGER"
log "健康地址：http://127.0.0.1:$PORT/api/health"
log "平台接入 API Key：$API_KEY_RECORD（权限 600）"
log "安全控制默认开启，执行变更命令仍需人工审批"
