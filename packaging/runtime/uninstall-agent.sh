#!/bin/sh
set -eu

CONFIG_DIR="/etc/wuhr-agent"
DATA_DIR="/var/lib/wuhr-agent"
BIN_DIR="/usr/local/bin"
PURGE=0

usage() {
  cat <<'EOF'
用法：sudo ./uninstall-agent.sh [选项]
  --config-dir PATH  配置目录，默认 /etc/wuhr-agent
  --data-dir PATH    数据目录，默认 /var/lib/wuhr-agent
  --bin-dir PATH     二进制目录，默认 /usr/local/bin
  --purge            同时删除配置、API Key、记忆、审计与网络资产数据

默认移除服务和二进制，但保留配置与业务数据。
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --config-dir) CONFIG_DIR=$2; shift 2 ;;
    --data-dir) DATA_DIR=$2; shift 2 ;;
    --bin-dir) BIN_DIR=$2; shift 2 ;;
    --purge) PURGE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf '%s\n' "未知参数：$1" >&2; exit 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || {
  printf '%s\n' "请使用 sudo 运行卸载脚本" >&2
  exit 1
}

if [ "$(uname -s)" = "Darwin" ]; then
  launchctl bootout system/ai.wuhr.agent >/dev/null 2>&1 || true
  rm -f /Library/LaunchDaemons/ai.wuhr.agent.plist
elif command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl disable --now wuhr-agent >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/wuhr-agent.service
  systemctl daemon-reload
elif command -v rc-service >/dev/null 2>&1; then
  rc-service wuhr-agent stop >/dev/null 2>&1 || true
  rc-update del wuhr-agent default >/dev/null 2>&1 || true
  rm -f /etc/init.d/wuhr-agent
else
  service wuhr-agent stop >/dev/null 2>&1 || true
  if command -v update-rc.d >/dev/null 2>&1; then
    update-rc.d -f wuhr-agent remove >/dev/null 2>&1 || true
  elif command -v chkconfig >/dev/null 2>&1; then
    chkconfig --del wuhr-agent >/dev/null 2>&1 || true
  fi
  rm -f /etc/init.d/wuhr-agent
fi

rm -f "$BIN_DIR/kubelet-wuhrai" "$BIN_DIR/kubelet-wuhrai.previous"
if [ "$PURGE" -eq 1 ]; then
  rm -rf "$CONFIG_DIR" "$DATA_DIR"
  printf '%s\n' "Agent 服务、配置与持久数据已删除。"
else
  printf '%s\n' "Agent 服务和二进制已删除；配置与数据仍保留。"
fi
