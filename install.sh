#!/bin/sh
# Wuhr AI Ops 仓库根目录交互式安装入口。
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.deploy.yml"
AGENT_BOOTSTRAP="$ROOT_DIR/packaging/runtime/install-agent-bootstrap.sh"

DEFAULT_FRONTEND_IMAGE="wuhrai/wuhrai:1.0.0"
DEFAULT_FRONTEND_DIGEST="sha256:0569c83772ca02830ac2b53f630b08cd04e35c28fe7641f88c72afaab7009261"
DEFAULT_NODE_BASE_IMAGE="node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0"

MODE_EXPLICIT=0
MODE=${1:-all}
case "$MODE" in
  all|platform|agent|verify|down)
    MODE_EXPLICIT=1
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
FRONTEND_IMAGE_DIGEST=""
IMAGE_MODE=""
IMAGE_PROXY=${WUHR_DOCKER_IMAGE_PROXY:-}
PREFER_IMAGE_PROXY=0
PULL_RETRIES=${WUHR_DOCKER_PULL_RETRIES:-3}
OS_FAMILY=${WUHR_OS_FAMILY:-auto}
AGENT_DOWNLOAD_SOURCE=${WUHR_AGENT_DOWNLOAD_SOURCE:-mirror-first}
FRONTEND_URL=""
OPEN_AGENT_FIREWALL=0
SKIP_DOCKER_INSTALL=0
INTERACTIVE=0
NON_INTERACTIVE=0
DRY_RUN=0
PLAN_PRINTED=0
PLATFORM_PORT_SET=0
PLATFORM_BIND_ADDRESS_SET=0
AGENT_URL_SET=0
FRONTEND_IMAGE_SET=0
IMAGE_MODE_SET=0

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
Wuhr AI Ops 交互式一键部署

用法：
  sudo ./install.sh                     启动交互式安装向导（推荐）
  sudo ./install.sh all [选项]       Linux/macOS 同机部署：Agent 系统服务 + Docker 平台
  ./install.sh platform [选项]       只部署 Docker 平台，连接已有 Agent
  sudo ./install.sh agent [选项]      只安装或升级本机 Agent 系统服务
  ./install.sh verify [选项]         验证已部署的平台、数据库、Redis、调度器和 Agent
  ./install.sh down [选项]           停止容器但保留全部数据卷

常用选项：
  --project-name NAME                Docker Compose 项目名，默认 wuhr-ai-ops
  --port PORT                        平台端口，默认 3000
  --bind-address ADDRESS             平台监听地址，默认 0.0.0.0
  --state-dir PATH                   密钥与部署状态目录，默认 .deploy/项目名
  --platform-env-file FILE           显式保留旧数据时导入数据库/JWT/加密配置
  --image-mode MODE                  pull（推荐）、build 或 existing
  --image IMAGE                      前端镜像，pull 默认 wuhrai/wuhrai:1.0.0
  --image-digest SHA256              拉取镜像的预期摘要；官方 1.0.0 自动校验
  --image-proxy PREFIX               国内/企业镜像代理前缀，如 registry.example.com/docker.io
  --prefer-image-proxy               优先代理，失败后回退 Docker Hub
  --pull-retries COUNT               每个镜像来源的重试次数，默认 3
  --skip-build                       兼容旧参数，等同 --image-mode existing
  --skip-docker-install              Docker 缺失时不尝试自动安装
  --os-family FAMILY                 auto、debian、rhel、suse 或 alpine
  --interactive                      强制启动交互向导
  --non-interactive                  禁用交互，适合自动化
  --dry-run                          只显示部署计划，不修改系统

Agent 选项：
  --agent-port PORT                  all 模式本机 Agent 端口，默认 2081
  --agent-url URL                    platform 模式已有 Agent 地址
  --agent-api-key-file FILE          已有 Agent API Key 文件
  --agent-env-file FILE              从现有环境文件读取 IMPROVE_API_BASE_URL/KEY
  --agent-download-source SOURCE     mirror-first、github-first、mirror-only 或 github-only
  --frontend-url URL                 agent 模式的平台地址，用于审批通知链接
  --open-agent-firewall              安装本机 Agent 时开放 2081/自定义端口

账号选项：
  --admin-password-file FILE         首次管理员密码文件；未指定时自动生成

示例：
  sudo ./install.sh
  sudo ./install.sh all --non-interactive --image-mode pull
  sudo ./install.sh all
  ./install.sh platform --agent-env-file .env.local
  ./install.sh platform --image-mode pull --image-proxy registry.example.com/docker.io \
    --prefer-image-proxy --agent-env-file .env.local
  ./install.sh platform --image-mode build --agent-env-file .env.local
  ./install.sh platform --platform-env-file .env --agent-env-file .env.local
  ./install.sh platform --project-name wuhr-test --port 3100 \
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
      PLATFORM_PORT_SET=1
      shift 2
      ;;
    --bind-address|--platform-bind-address)
      need_value "$@"
      PLATFORM_BIND_ADDRESS=$2
      PLATFORM_BIND_ADDRESS_SET=1
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
      AGENT_URL_SET=1
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
      FRONTEND_IMAGE_SET=1
      shift 2
      ;;
    --image-mode)
      need_value "$@"
      IMAGE_MODE=$2
      IMAGE_MODE_SET=1
      shift 2
      ;;
    --image-digest)
      need_value "$@"
      FRONTEND_IMAGE_DIGEST=$2
      shift 2
      ;;
    --image-proxy)
      need_value "$@"
      IMAGE_PROXY=$2
      shift 2
      ;;
    --prefer-image-proxy)
      PREFER_IMAGE_PROXY=1
      shift
      ;;
    --pull-retries)
      need_value "$@"
      PULL_RETRIES=$2
      shift 2
      ;;
    --skip-build)
      IMAGE_MODE=existing
      IMAGE_MODE_SET=1
      shift
      ;;
    --pull-image)
      IMAGE_MODE=pull
      IMAGE_MODE_SET=1
      shift
      ;;
    --build-image)
      IMAGE_MODE=build
      IMAGE_MODE_SET=1
      shift
      ;;
    --skip-docker-install)
      SKIP_DOCKER_INSTALL=1
      shift
      ;;
    --os-family)
      need_value "$@"
      OS_FAMILY=$2
      shift 2
      ;;
    --agent-download-source)
      need_value "$@"
      AGENT_DOWNLOAD_SOURCE=$2
      shift 2
      ;;
    --frontend-url)
      need_value "$@"
      FRONTEND_URL=$2
      shift 2
      ;;
    --open-agent-firewall|--open-firewall)
      OPEN_AGENT_FIREWALL=1
      shift
      ;;
    --interactive)
      INTERACTIVE=1
      shift
      ;;
    --non-interactive)
      NON_INTERACTIVE=1
      shift
      ;;
    --dry-run|--plan)
      DRY_RUN=1
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

detect_system() {
  DETECTED_OS=$(uname -s 2>/dev/null || printf '%s' unknown)
  DETECTED_ARCH=$(uname -m 2>/dev/null || printf '%s' unknown)
  DETECTED_DISTRO="-"
  DETECTED_OS_FAMILY="auto"
  if [ "$DETECTED_OS" = "Linux" ] && [ -r /etc/os-release ]; then
    DETECTED_DISTRO=$(sed -n 's/^PRETTY_NAME=//p' /etc/os-release | head -n 1 | tr -d '"')
    DISTRO_ID=$(sed -n 's/^ID=//p' /etc/os-release | head -n 1 | tr -d '"')
    DISTRO_LIKE=$(sed -n 's/^ID_LIKE=//p' /etc/os-release | head -n 1 | tr -d '"')
    case "$DISTRO_ID $DISTRO_LIKE" in
      *debian*|*ubuntu*) DETECTED_OS_FAMILY="debian" ;;
      *rhel*|*fedora*|*centos*|*rocky*|*almalinux*) DETECTED_OS_FAMILY="rhel" ;;
      *suse*|*opensuse*) DETECTED_OS_FAMILY="suse" ;;
      *alpine*) DETECTED_OS_FAMILY="alpine" ;;
    esac
  elif [ "$DETECTED_OS" = "Darwin" ]; then
    DETECTED_DISTRO="macOS"
  fi
}

prompt_text() {
  prompt_label=$1
  prompt_default=${2:-}
  if [ -n "$prompt_default" ]; then
    printf '%s' "$prompt_label [$prompt_default]：" >&2
  else
    printf '%s' "${prompt_label}：" >&2
  fi
  if ! IFS= read -r prompt_answer; then
    die "交互输入已结束"
  fi
  PROMPT_VALUE=${prompt_answer:-$prompt_default}
}

prompt_choice() {
  choice_label=$1
  choice_default=$2
  choice_max=$3
  while :; do
    prompt_text "$choice_label" "$choice_default"
    case "$PROMPT_VALUE" in
      ''|*[!0-9]*) warn "请输入 1-$choice_max" ;;
      *)
        if [ "$PROMPT_VALUE" -ge 1 ] && [ "$PROMPT_VALUE" -le "$choice_max" ]; then
          return 0
        fi
        warn "请输入 1-$choice_max"
        ;;
    esac
  done
}

prompt_yes_no() {
  yes_no_label=$1
  yes_no_default=${2:-y}
  while :; do
    prompt_text "$yes_no_label (y/n)" "$yes_no_default"
    case "$PROMPT_VALUE" in
      y|Y|yes|YES|Yes) PROMPT_VALUE=y; return 0 ;;
      n|N|no|NO|No) PROMPT_VALUE=n; return 0 ;;
      *) warn "请输入 y 或 n" ;;
    esac
  done
}

print_plan() {
  case "$MODE" in
    all) mode_label="平台 + 本机 Agent" ;;
    platform) mode_label="仅平台，连接已有 Agent" ;;
    agent) mode_label="仅安装/升级本机 Agent" ;;
    verify) mode_label="验收现有部署" ;;
    down) mode_label="停止平台并保留数据" ;;
    *) mode_label=$MODE ;;
  esac
  plan_state_dir=${STATE_DIR:-$ROOT_DIR/.deploy/$PROJECT_NAME}
  case "$plan_state_dir" in
    /*) ;;
    *) plan_state_dir="$ROOT_DIR/$plan_state_dir" ;;
  esac
  printf '\n%s\n' "========== Wuhr 部署计划 =========="
  printf '  实际系统：%s / %s / %s\n' "$DETECTED_OS" "$DETECTED_DISTRO" "$DETECTED_ARCH"
  printf '  系统类型：%s\n' "$OS_FAMILY"
  printf '  部署方式：%s\n' "$mode_label"
  printf '  状态目录：%s\n' "$plan_state_dir"
  if [ "$MODE" = "all" ] || [ "$MODE" = "platform" ]; then
    printf '  平台端口：%s:%s\n' "$PLATFORM_BIND_ADDRESS" "$PLATFORM_PORT"
    printf '  镜像方式：%s\n' "$IMAGE_MODE"
    printf '  平台镜像：%s\n' "$FRONTEND_IMAGE"
    if [ -n "$IMAGE_PROXY" ]; then
      printf '  镜像代理：%s（%s）\n' "$IMAGE_PROXY" \
        "$( [ "$PREFER_IMAGE_PROXY" -eq 1 ] && printf '%s' 优先 || printf '%s' 回退 )"
    else
      printf '  镜像代理：未配置，使用 Docker 当前配置\n'
    fi
  fi
  if [ "$MODE" = "all" ] || [ "$MODE" = "agent" ]; then
    printf '  Agent：宿主机系统服务，端口 %s\n' "$AGENT_PORT"
    printf '  Agent 下载：%s\n' "$AGENT_DOWNLOAD_SOURCE"
  elif [ "$MODE" = "platform" ]; then
    printf '  Agent 地址：%s\n' "${AGENT_URL:-从已有配置读取}"
  fi
  printf '%s\n\n' "===================================="
}

load_saved_deploy_defaults() {
  saved_state_dir=${STATE_DIR:-$ROOT_DIR/.deploy/$PROJECT_NAME}
  case "$saved_state_dir" in
    /*) ;;
    *) saved_state_dir="$ROOT_DIR/$saved_state_dir" ;;
  esac
  saved_env_file="$saved_state_dir/.env"
  [ -r "$saved_env_file" ] || return 0

  saved_platform_port=$(sed -n 's/^PLATFORM_PORT=//p' "$saved_env_file" | tail -n 1)
  saved_bind_address=$(sed -n 's/^PLATFORM_BIND_ADDRESS=//p' "$saved_env_file" | tail -n 1)
  saved_agent_url=$(sed -n 's/^IMPROVE_API_BASE_URL=//p' "$saved_env_file" | tail -n 1)
  saved_frontend_image=$(sed -n 's/^WUHR_FRONTEND_IMAGE=//p' "$saved_env_file" | tail -n 1)
  saved_image_mode=$(sed -n 's/^WUHR_DEPLOY_IMAGE_MODE=//p' "$saved_env_file" | tail -n 1)
  if [ -z "$saved_image_mode" ]; then
    case "$saved_frontend_image" in
      wuhr-ai-ops:source-*) saved_image_mode=build ;;
    esac
  fi

  if [ "$PLATFORM_PORT_SET" -eq 0 ] && [ -n "$saved_platform_port" ]; then
    PLATFORM_PORT=$saved_platform_port
  fi
  if [ "$PLATFORM_BIND_ADDRESS_SET" -eq 0 ] && [ -n "$saved_bind_address" ]; then
    PLATFORM_BIND_ADDRESS=$saved_bind_address
  fi
  if [ "$AGENT_URL_SET" -eq 0 ] && [ -n "$saved_agent_url" ]; then
    AGENT_URL=$saved_agent_url
  fi
  if [ "$IMAGE_MODE_SET" -eq 0 ] && [ -n "$saved_image_mode" ]; then
    IMAGE_MODE=$saved_image_mode
  fi
  if [ "$FRONTEND_IMAGE_SET" -eq 0 ] && [ -n "$saved_frontend_image" ]; then
    if [ "$IMAGE_MODE_SET" -eq 0 ] || [ "$IMAGE_MODE" = "$saved_image_mode" ]; then
      FRONTEND_IMAGE=$saved_frontend_image
    fi
  fi
}

run_wizard() {
  printf '\n%s\n' "Wuhr AI Ops 交互式安装向导"
  printf '%s\n' "检测到：$DETECTED_OS / $DETECTED_DISTRO / $DETECTED_ARCH"

  if [ "$DETECTED_OS" = "Linux" ]; then
    printf '%s\n' "请选择服务器操作系统类型："
    printf '%s\n' "  1) 自动识别：${DETECTED_OS_FAMILY}（推荐）"
    printf '%s\n' "  2) Debian / Ubuntu"
    printf '%s\n' "  3) RHEL / CentOS / Rocky / AlmaLinux"
    printf '%s\n' "  4) openSUSE / SLES"
    printf '%s\n' "  5) Alpine Linux"
    prompt_choice "系统类型" 1 5
    case "$PROMPT_VALUE" in
      1) OS_FAMILY=$DETECTED_OS_FAMILY ;;
      2) OS_FAMILY=debian ;;
      3) OS_FAMILY=rhel ;;
      4) OS_FAMILY=suse ;;
      5) OS_FAMILY=alpine ;;
    esac
  fi

  if [ "$MODE_EXPLICIT" -eq 0 ]; then
    printf '%s\n' "请选择部署任务："
    printf '%s\n' "  1) 平台 + 本机 Agent（推荐，Agent 使用系统服务）"
    printf '%s\n' "  2) 仅部署平台，连接已有远程 Agent"
    printf '%s\n' "  3) 仅安装或升级本机 Agent"
    printf '%s\n' "  4) 验收现有部署"
    printf '%s\n' "  5) 停止平台，保留数据"
    prompt_choice "部署任务" 1 5
    case "$PROMPT_VALUE" in
      1) MODE=all ;;
      2) MODE=platform ;;
      3) MODE=agent ;;
      4) MODE=verify ;;
      5) MODE=down ;;
    esac
  fi

  if [ "$MODE" = "all" ] || [ "$MODE" = "platform" ]; then
    printf '%s\n' "请选择前端镜像方式："
    printf '%s\n' "  1) 拉取官方多架构镜像（推荐，速度快）"
    printf '%s\n' "  2) 使用当前源码本机构建（适合二次开发）"
    printf '%s\n' "  3) 使用本机已有镜像"
    case "$IMAGE_MODE" in pull) image_default=1 ;; build) image_default=2 ;; existing) image_default=3 ;; *) image_default=1 ;; esac
    previous_image_mode=$IMAGE_MODE
    prompt_choice "镜像方式" "$image_default" 3
    case "$PROMPT_VALUE" in
      1) IMAGE_MODE=pull ;;
      2) IMAGE_MODE=build ;;
      3) IMAGE_MODE=existing ;;
    esac
    if [ "$IMAGE_MODE" != "$previous_image_mode" ] && [ "$FRONTEND_IMAGE_SET" -eq 0 ]; then
      FRONTEND_IMAGE=""
    fi

    if [ "$IMAGE_MODE" = "pull" ]; then
      prompt_text "镜像名称" "${FRONTEND_IMAGE:-$DEFAULT_FRONTEND_IMAGE}"
      FRONTEND_IMAGE=$PROMPT_VALUE
      printf '%s\n' "国内拉取方式："
      printf '%s\n' "  1) 使用 Docker 当前配置，直接拉取（推荐）"
      printf '%s\n' "  2) 优先使用企业/国内镜像代理，失败回退 Docker Hub"
      printf '%s\n' "  3) 先用 Docker Hub，失败后使用镜像代理"
      proxy_default=1
      [ -z "$IMAGE_PROXY" ] || { [ "$PREFER_IMAGE_PROXY" -eq 1 ] && proxy_default=2 || proxy_default=3; }
      prompt_choice "拉取方式" "$proxy_default" 3
      proxy_choice=$PROMPT_VALUE
      if [ "$proxy_choice" -ne 1 ]; then
        prompt_text "镜像代理前缀（不要包含 http://，示例 registry.example.com/docker.io）" "$IMAGE_PROXY"
        IMAGE_PROXY=$PROMPT_VALUE
        [ "$proxy_choice" -ne 2 ] || PREFER_IMAGE_PROXY=1
        [ "$proxy_choice" -ne 3 ] || PREFER_IMAGE_PROXY=0
      else
        IMAGE_PROXY=""
        PREFER_IMAGE_PROXY=0
      fi
    elif [ "$IMAGE_MODE" = "build" ]; then
      wizard_revision=$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || printf '%s' local)
      prompt_text "构建后的本地镜像名称" "${FRONTEND_IMAGE:-wuhr-ai-ops:source-$wizard_revision}"
      FRONTEND_IMAGE=$PROMPT_VALUE
    elif [ "$IMAGE_MODE" = "existing" ]; then
      prompt_text "本机镜像名称" "${FRONTEND_IMAGE:-$DEFAULT_FRONTEND_IMAGE}"
      FRONTEND_IMAGE=$PROMPT_VALUE
    fi

    prompt_text "平台端口" "$PLATFORM_PORT"
    PLATFORM_PORT=$PROMPT_VALUE
    printf '%s\n' "平台监听范围："
    printf '%s\n' "  1) 0.0.0.0，允许通过服务器 IP 访问（推荐）"
    printf '%s\n' "  2) 127.0.0.1，仅允许本机/反向代理访问"
    bind_default=1
    [ "$PLATFORM_BIND_ADDRESS" != "127.0.0.1" ] || bind_default=2
    prompt_choice "监听范围" "$bind_default" 2
    [ "$PROMPT_VALUE" -eq 1 ] && PLATFORM_BIND_ADDRESS=0.0.0.0 || PLATFORM_BIND_ADDRESS=127.0.0.1
  fi

  if [ "$MODE" = "all" ] || [ "$MODE" = "agent" ]; then
    prompt_text "Agent 端口" "$AGENT_PORT"
    AGENT_PORT=$PROMPT_VALUE
    printf '%s\n' "请选择后端 Agent 下载来源："
    printf '%s\n' "  1) 国内下载优先，失败回退 GitHub（推荐）"
    printf '%s\n' "  2) GitHub 优先，失败回退国内下载"
    printf '%s\n' "  3) 仅使用国内下载"
    printf '%s\n' "  4) 仅使用 GitHub"
    case "$AGENT_DOWNLOAD_SOURCE" in mirror-first) agent_source_default=1 ;; github-first) agent_source_default=2 ;; mirror-only) agent_source_default=3 ;; github-only) agent_source_default=4 ;; *) agent_source_default=1 ;; esac
    prompt_choice "Agent 下载来源" "$agent_source_default" 4
    case "$PROMPT_VALUE" in
      1) AGENT_DOWNLOAD_SOURCE=mirror-first ;;
      2) AGENT_DOWNLOAD_SOURCE=github-first ;;
      3) AGENT_DOWNLOAD_SOURCE=mirror-only ;;
      4) AGENT_DOWNLOAD_SOURCE=github-only ;;
    esac
    prompt_yes_no "是否自动开放 Agent 端口（仅在确有远程访问需求时选择 y）" n
    [ "$PROMPT_VALUE" = y ] && OPEN_AGENT_FIREWALL=1 || OPEN_AGENT_FIREWALL=0
    if [ "$MODE" = "agent" ]; then
      prompt_text "平台访问地址（可留空，用于审批通知链接）" "$FRONTEND_URL"
      FRONTEND_URL=$PROMPT_VALUE
    fi
  elif [ "$MODE" = "platform" ]; then
    wizard_state_dir=${STATE_DIR:-$ROOT_DIR/.deploy/$PROJECT_NAME}
    case "$wizard_state_dir" in
      /*) ;;
      *) wizard_state_dir="$ROOT_DIR/$wizard_state_dir" ;;
    esac
    wizard_env_file="$wizard_state_dir/.env"
    wizard_saved_agent_url=""
    wizard_saved_agent_key=0
    if [ -r "$wizard_env_file" ]; then
      wizard_saved_agent_url=$(sed -n 's/^IMPROVE_API_BASE_URL=//p' "$wizard_env_file" | tail -n 1)
      grep -q '^IMPROVE_API_KEY=.' "$wizard_env_file" && wizard_saved_agent_key=1 || true
    fi
    prompt_text "已有 Agent 地址" "${AGENT_URL:-${wizard_saved_agent_url:-http://10.0.0.20:2081}}"
    AGENT_URL=$PROMPT_VALUE
    if [ "$wizard_saved_agent_key" -eq 1 ]; then
      printf '%s\n' "将复用现有部署状态中保存的 Agent API Key。"
    elif [ -z "$AGENT_ENV_FILE" ] && [ -z "$AGENT_API_KEY_FILE" ]; then
      printf '%s\n' "请选择 Agent API Key 的读取方式（密钥不会显示在命令行）："
      printf '%s\n' "  1) 从 Agent/平台环境文件读取"
      printf '%s\n' "  2) 从只包含 API Key 的文件读取"
      prompt_choice "密钥读取方式" 1 2
      if [ "$PROMPT_VALUE" -eq 1 ]; then
        prompt_text "环境文件路径" ".env.local"
        AGENT_ENV_FILE=$PROMPT_VALUE
      else
        prompt_text "API Key 文件路径" "agent-api-key.txt"
        AGENT_API_KEY_FILE=$PROMPT_VALUE
      fi
    fi
  fi

  print_plan
  PLAN_PRINTED=1
  prompt_yes_no "确认按以上计划继续" y
  [ "$PROMPT_VALUE" = y ] || die "用户取消部署"
}

load_saved_deploy_defaults
detect_system
if [ "$NON_INTERACTIVE" -eq 1 ]; then
  INTERACTIVE=0
elif [ "$INTERACTIVE" -eq 1 ] || { [ -t 0 ] && [ -t 1 ]; }; then
  INTERACTIVE=1
fi
if [ "$INTERACTIVE" -eq 1 ]; then
  run_wizard
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "platform" ]; then
  IMAGE_MODE=${IMAGE_MODE:-pull}
  if [ "$IMAGE_MODE" = "pull" ] || [ "$IMAGE_MODE" = "existing" ]; then
    FRONTEND_IMAGE=${FRONTEND_IMAGE:-$DEFAULT_FRONTEND_IMAGE}
  fi
  if [ "$IMAGE_MODE" = "pull" ] && [ "$FRONTEND_IMAGE" = "$DEFAULT_FRONTEND_IMAGE" ] &&
    [ -z "$FRONTEND_IMAGE_DIGEST" ]; then
    FRONTEND_IMAGE_DIGEST=$DEFAULT_FRONTEND_DIGEST
  fi
fi

case "$PROJECT_NAME" in
  ''|[!a-z0-9]*|*[!a-z0-9_-]*)
    die "项目名只允许小写字母、数字、下划线和连字符"
    ;;
esac

case "$OS_FAMILY" in
  auto|debian|rhel|suse|alpine) ;;
  *) die "--os-family 只支持 auto、debian、rhel、suse 或 alpine" ;;
esac
case "$AGENT_DOWNLOAD_SOURCE" in
  mirror-first|github-first|mirror-only|github-only) ;;
  *) die "--agent-download-source 参数不合法" ;;
esac
case "$PULL_RETRIES" in
  ''|*[!0-9]*) die "--pull-retries 必须是 1-10 的整数" ;;
esac
[ "$PULL_RETRIES" -ge 1 ] && [ "$PULL_RETRIES" -le 10 ] ||
  die "--pull-retries 必须是 1-10 的整数"
if [ "$MODE" = "all" ] || [ "$MODE" = "platform" ]; then
  case "$IMAGE_MODE" in
    pull|build|existing) ;;
    *) die "--image-mode 只支持 pull、build 或 existing" ;;
  esac
fi
if [ -n "$IMAGE_PROXY" ]; then
  case "$IMAGE_PROXY" in
    http://*|https://*) die "--image-proxy 只填写镜像仓库前缀，不要包含 http:// 或 https://" ;;
    /*|*/|*//*|*[!A-Za-z0-9._:/-]*) die "镜像代理前缀格式不合法" ;;
  esac
fi
if [ -n "$FRONTEND_IMAGE_DIGEST" ]; then
  case "$FRONTEND_IMAGE_DIGEST" in
    sha256:*) ;;
    *) die "--image-digest 必须以 sha256: 开头" ;;
  esac
  digest_hex=${FRONTEND_IMAGE_DIGEST#sha256:}
  case "$digest_hex" in
    *[!A-Fa-f0-9]*) die "--image-digest 含有非十六进制字符" ;;
  esac
  [ "${#digest_hex}" -eq 64 ] || die "--image-digest 必须包含 64 位 SHA-256"
fi
if [ -n "$FRONTEND_URL" ]; then
  case "$FRONTEND_URL" in
    http://*|https://*) ;;
    *) die "--frontend-url 必须以 http:// 或 https:// 开头" ;;
  esac
fi

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

if { [ "$MODE" = "all" ] || [ "$MODE" = "platform" ]; } &&
  [ "$IMAGE_MODE" = "build" ] && [ -z "$FRONTEND_IMAGE" ]; then
  SOURCE_REVISION=$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || printf '%s' local)
  if [ -n "$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true)" ]; then
    SOURCE_REVISION="$SOURCE_REVISION-dirty"
  fi
  FRONTEND_IMAGE="wuhr-ai-ops:source-$SOURCE_REVISION"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  [ "$PLAN_PRINTED" -eq 1 ] || print_plan
  log "计划检查完成；--dry-run 未修改系统、未下载镜像、未写入密钥"
  exit 0
fi

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

  install_family=$OS_FAMILY
  if [ "$install_family" = "auto" ]; then
    install_family=$DETECTED_OS_FAMILY
    if [ "$install_family" = "auto" ]; then
      if command -v apt-get >/dev/null 2>&1; then
        install_family=debian
      elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
        install_family=rhel
      elif command -v zypper >/dev/null 2>&1; then
        install_family=suse
      elif command -v apk >/dev/null 2>&1; then
        install_family=alpine
      fi
    fi
  fi
  case "$install_family" in
    debian)
      command -v apt-get >/dev/null 2>&1 || die "所选 Debian/Ubuntu 安装方式需要 apt-get"
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y ca-certificates curl docker.io
      apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin
      ;;
    rhel)
      if command -v dnf >/dev/null 2>&1; then
        dnf install -y ca-certificates curl docker docker-compose-plugin ||
          dnf install -y ca-certificates curl docker docker-compose
      elif command -v yum >/dev/null 2>&1; then
        yum install -y ca-certificates curl docker docker-compose-plugin ||
          yum install -y ca-certificates curl docker docker-compose
      else
        die "所选 RHEL 系安装方式需要 dnf 或 yum"
      fi
      ;;
    suse)
      command -v zypper >/dev/null 2>&1 || die "所选 SUSE 安装方式需要 zypper"
      zypper --non-interactive install ca-certificates curl docker docker-compose
      ;;
    alpine)
      command -v apk >/dev/null 2>&1 || die "所选 Alpine 安装方式需要 apk"
      apk add --no-cache ca-certificates curl docker docker-cli-compose
      ;;
    *)
      die "无法识别包管理器，请用 --os-family 指定系统类型或先安装 Docker Engine 与 Compose v2"
      ;;
  esac
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

image_repository() {
  repository_input=$1
  repository_input=${repository_input%@*}
  repository_last=${repository_input##*/}
  case "$repository_last" in
    *:*) repository_input=${repository_input%:*} ;;
  esac
  IMAGE_REPOSITORY=$repository_input
}

proxy_image_name() {
  proxy_target=${1#docker.io/}
  case "$proxy_target" in
    */*) ;;
    *) proxy_target="library/$proxy_target" ;;
  esac
  PROXY_IMAGE="$IMAGE_PROXY/$proxy_target"
}

pull_ref_with_retry() {
  pull_source=$1
  pull_target=$2
  pull_digest=${3:-}
  pull_label=$4
  image_repository "$pull_source"
  pull_request=$pull_source
  if [ -n "$pull_digest" ]; then
    pull_request="$IMAGE_REPOSITORY@$pull_digest"
  fi

  pull_attempt=1
  while [ "$pull_attempt" -le "$PULL_RETRIES" ]; do
    log "拉取 ${pull_label}（第 $pull_attempt/$PULL_RETRIES 次）：$pull_request"
    if docker pull "$pull_request"; then
      if [ "$pull_request" != "$pull_target" ]; then
        docker tag "$pull_request" "$pull_target"
      fi
      return 0
    fi
    pull_attempt=$((pull_attempt + 1))
    [ "$pull_attempt" -gt "$PULL_RETRIES" ] || sleep 2
  done
  return 1
}

pull_image_with_fallback() {
  target_image=$1
  expected_digest=${2:-}
  image_label=$3

  if [ -n "$IMAGE_PROXY" ]; then
    proxy_image_name "$target_image"
    proxy_candidate=$PROXY_IMAGE
  else
    proxy_candidate=""
  fi

  if [ "$PREFER_IMAGE_PROXY" -eq 1 ] && [ -n "$proxy_candidate" ]; then
    if pull_ref_with_retry "$proxy_candidate" "$target_image" "$expected_digest" "${image_label}（镜像代理）"; then
      return 0
    fi
    warn "$image_label 通过镜像代理拉取失败，切换 Docker Hub"
  fi

  if pull_ref_with_retry "$target_image" "$target_image" "$expected_digest" "${image_label}（Docker Hub）"; then
    return 0
  fi

  if [ "$PREFER_IMAGE_PROXY" -eq 0 ] && [ -n "$proxy_candidate" ]; then
    warn "$image_label 通过 Docker Hub 拉取失败，切换镜像代理"
    if pull_ref_with_retry "$proxy_candidate" "$target_image" "$expected_digest" "${image_label}（镜像代理）"; then
      return 0
    fi
  fi
  return 1
}

prepare_platform_dependencies() {
  if docker image inspect "postgres:15-alpine" >/dev/null 2>&1; then
    log "复用本机 PostgreSQL 镜像：postgres:15-alpine"
  else
    pull_image_with_fallback "postgres:15-alpine" "" "PostgreSQL 镜像" ||
      die "无法拉取 PostgreSQL 镜像；请在交互向导中配置镜像代理"
  fi
  if docker image inspect "redis:7-alpine" >/dev/null 2>&1; then
    log "复用本机 Redis 镜像：redis:7-alpine"
  else
    pull_image_with_fallback "redis:7-alpine" "" "Redis 镜像" ||
      die "无法拉取 Redis 镜像；请在交互向导中配置镜像代理"
  fi
}

local_image_matches_digest() {
  digest_image=$1
  digest_expected=$2
  [ -n "$digest_expected" ] || return 1
  docker image inspect "$digest_image" --format '{{range .RepoDigests}}{{println .}}{{end}}' \
    2>/dev/null | grep -Fq "@$digest_expected"
}

verify_frontend_image() {
  docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1 ||
    die "前端镜像不存在：$FRONTEND_IMAGE"
  image_user=$(docker image inspect "$FRONTEND_IMAGE" --format '{{.Config.User}}' 2>/dev/null || true)
  image_source=$(docker image inspect "$FRONTEND_IMAGE" \
    --format '{{index .Config.Labels "org.opencontainers.image.source"}}' 2>/dev/null || true)
  if [ "$FRONTEND_IMAGE" = "$DEFAULT_FRONTEND_IMAGE" ]; then
    [ "$image_user" = "wuhr" ] || die "官方平台镜像未使用预期的非 root 用户"
    [ "$image_source" = "https://github.com/st-lzh/Wuhr-AI-ops" ] ||
      die "官方平台镜像的来源标签校验失败"
  fi
}

build_frontend_from_source() {
  official_base=$DEFAULT_NODE_BASE_IMAGE
  proxy_base=""
  if [ -n "$IMAGE_PROXY" ]; then
    proxy_image_name "node:20-slim"
    proxy_base="$PROXY_IMAGE@${DEFAULT_NODE_BASE_IMAGE#*@}"
  fi

  if [ "$PREFER_IMAGE_PROXY" -eq 1 ] && [ -n "$proxy_base" ]; then
    log "通过镜像代理获取 Node 基础镜像并构建：$FRONTEND_IMAGE"
    if compose build --build-arg "NODE_BASE_IMAGE=$proxy_base" app; then
      return 0
    fi
    warn "通过镜像代理构建失败，切换 Docker Hub 基础镜像"
  fi

  log "使用 Docker Hub Node 基础镜像构建：$FRONTEND_IMAGE"
  if compose build --build-arg "NODE_BASE_IMAGE=$official_base" app; then
    return 0
  fi

  if [ "$PREFER_IMAGE_PROXY" -eq 0 ] && [ -n "$proxy_base" ]; then
    warn "通过 Docker Hub 构建失败，切换镜像代理基础镜像"
    if compose build --build-arg "NODE_BASE_IMAGE=$proxy_base" app; then
      return 0
    fi
  fi
  return 1
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

install_local_agent() {
  [ "$DETECTED_OS" = "Linux" ] || [ "$DETECTED_OS" = "Darwin" ] ||
    die "本机 Agent 仅支持 Linux 或 macOS"
  [ -f "$AGENT_BOOTSTRAP" ] || die "缺少 Agent 在线安装器"

  agent_frontend_url=$FRONTEND_URL
  (
    set -- --api-key-file "$SHARED_AGENT_KEY_FILE" --port "$AGENT_PORT"
    [ -z "$agent_frontend_url" ] || set -- "$@" --frontend-url "$agent_frontend_url"
    [ "$OPEN_AGENT_FIREWALL" -eq 0 ] || set -- "$@" --open-firewall
    if [ "$(id -u)" -eq 0 ]; then
      WUHR_AGENT_DOWNLOAD_PREFERENCE="$AGENT_DOWNLOAD_SOURCE" \
        sh "$AGENT_BOOTSTRAP" "$@"
    elif [ "$DETECTED_OS" = "Darwin" ] && command -v sudo >/dev/null 2>&1; then
      log "macOS 安装 Agent 系统服务需要管理员权限"
      sudo env WUHR_AGENT_DOWNLOAD_PREFERENCE="$AGENT_DOWNLOAD_SOURCE" \
        sh "$AGENT_BOOTSTRAP" "$@"
    else
      die "安装 Agent 系统服务需要 root 权限，请使用 sudo 重新运行"
    fi
  )
}

project_has_stale_resources() {
  if [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT_NAME")" ]; then
    return 0
  fi
  for stale_volume in \
    postgres_data redis_data platform_data deployment_data app_logs; do
    if docker volume inspect "${PROJECT_NAME}_${stale_volume}" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

reset_stale_project() {
  log "首次安装检测到同名旧部署，自动清理遗留容器和数据卷"
  stale_containers=$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT_NAME")
  if [ -n "$stale_containers" ]; then
    # 这里的值只来自 Docker 容器 ID 列表，需要保留按空白分词。
    # shellcheck disable=SC2086
    docker rm -f $stale_containers >/dev/null
  fi
  for stale_volume in \
    postgres_data redis_data platform_data deployment_data app_logs; do
    stale_volume_name="${PROJECT_NAME}_${stale_volume}"
    if docker volume inspect "$stale_volume_name" >/dev/null 2>&1; then
      docker volume rm -f "$stale_volume_name" >/dev/null
    fi
  done
  docker network rm "${PROJECT_NAME}_wuhr_internal" >/dev/null 2>&1 || true
  rm -f "$CREDENTIALS_FILE" "$SHARED_AGENT_KEY_FILE"
  log "旧部署已清理，将创建全新数据库并导入最新迁移和初始化数据"
}

verify_database_initialization() {
  schema_ready=$(compose exec -T postgres psql -v ON_ERROR_STOP=1 \
    -U "$DB_USER" -d "$DB_NAME" -Atqc \
    "SELECT (to_regclass('public.users') IS NOT NULL AND to_regclass('public.model_provider_catalogs') IS NOT NULL);")
  [ "$schema_ready" = "t" ] || die "数据库结构未完整初始化"

  admin_count=$(compose exec -T postgres psql -v ON_ERROR_STOP=1 \
    -U "$DB_USER" -d "$DB_NAME" -Atqc \
    "SELECT COUNT(*) FROM users WHERE username = 'admin';")
  provider_count=$(compose exec -T postgres psql -v ON_ERROR_STOP=1 \
    -U "$DB_USER" -d "$DB_NAME" -Atqc \
    'SELECT COUNT(*) FROM model_provider_catalogs WHERE "isActive" = true;')
  [ "$admin_count" -ge 1 ] || die "管理员初始化数据未写入"
  [ "$provider_count" -ge 1 ] || die "模型厂商初始化数据未写入"
  log "数据库初始化验证通过：管理员 $admin_count 个，模型厂商 $provider_count 个"
}

[ -f "$COMPOSE_FILE" ] || die "缺少 docker-compose.deploy.yml"

if [ "$MODE" = "agent" ]; then
  umask 077
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  EXISTING_AGENT_KEY=$(read_env_value IMPROVE_API_KEY "$ENV_FILE")
  if [ -n "$AGENT_ENV_FILE" ]; then
    [ -r "$AGENT_ENV_FILE" ] || die "无法读取 Agent 环境文件：$AGENT_ENV_FILE"
    ENV_AGENT_KEY=$(read_env_value IMPROVE_API_KEY "$AGENT_ENV_FILE")
    [ -z "$ENV_AGENT_KEY" ] || EXISTING_AGENT_KEY=$ENV_AGENT_KEY
  fi
  if [ -n "$AGENT_API_KEY_FILE" ]; then
    AGENT_API_KEY=$(read_secret_file "$AGENT_API_KEY_FILE")
  elif [ -n "$EXISTING_AGENT_KEY" ]; then
    AGENT_API_KEY=$EXISTING_AGENT_KEY
  elif [ -r "$SHARED_AGENT_KEY_FILE" ]; then
    AGENT_API_KEY=$(read_secret_file "$SHARED_AGENT_KEY_FILE")
  else
    AGENT_API_KEY="wuhr_$(random_hex 24)"
  fi
  validate_secret "Agent API Key" "$AGENT_API_KEY"
  printf '%s\n' "$AGENT_API_KEY" > "$SHARED_AGENT_KEY_FILE"
  chmod 600 "$SHARED_AGENT_KEY_FILE"
  log "安装或升级本机 Agent 系统服务"
  install_local_agent
  log "Agent 部署完成：http://127.0.0.1:$AGENT_PORT/api/health"
  log "Agent API Key 文件：${SHARED_AGENT_KEY_FILE}（权限 600）"
  exit 0
fi

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
if [ "$FIRST_INSTALL" -eq 1 ]; then
  if [ -n "$PLATFORM_ENV_FILE" ] &&
    docker volume inspect "${PROJECT_NAME}_postgres_data" >/dev/null 2>&1; then
    ADOPT_EXISTING=1
    log "已显式提供旧平台配置，将保留原账号、密钥和业务数据"
  elif project_has_stale_resources; then
    reset_stale_project
  fi
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
if [ "$MODE" = "platform" ] && [ "$FIRST_INSTALL" -eq 1 ] &&
  [ -z "$EXISTING_AGENT_KEY" ] && [ -z "$AGENT_API_KEY_FILE" ]; then
  die "首次连接远程 Agent 必须通过 --agent-env-file 或 --agent-api-key-file 提供 API Key"
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
  [ "$DETECTED_OS" = "Linux" ] || [ "$DETECTED_OS" = "Darwin" ] ||
    die "all 模式仅支持 Linux 或 macOS"
  if [ "$DETECTED_OS" = "Linux" ] && [ "$(id -u)" -ne 0 ]; then
    die "Linux 安装 Agent 系统服务需要 root 权限，请使用 sudo ./install.sh all"
  fi
  printf '%s\n' "$AGENT_API_KEY" > "$SHARED_AGENT_KEY_FILE"
  chmod 600 "$SHARED_AGENT_KEY_FILE"
  log "安装或升级本机 Agent 系统服务"
  FRONTEND_URL=${FRONTEND_URL:-"http://127.0.0.1:$PLATFORM_PORT"}
  install_local_agent
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

[ -n "$FRONTEND_IMAGE" ] || die "未指定前端镜像"
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
WUHR_DEPLOY_IMAGE_MODE=$IMAGE_MODE
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

prepare_platform_dependencies
case "$IMAGE_MODE" in
  pull)
    if ! pull_image_with_fallback "$FRONTEND_IMAGE" "$FRONTEND_IMAGE_DIGEST" "Wuhr 平台镜像"; then
      if local_image_matches_digest "$FRONTEND_IMAGE" "$FRONTEND_IMAGE_DIGEST"; then
        warn "远程拉取失败，复用本机已通过发布摘要校验的平台镜像"
      else
        die "Docker Hub 与配置的镜像代理均无法提供平台镜像，且本机没有匹配发布摘要的缓存"
      fi
    fi
    verify_frontend_image
    ;;
  build)
    log "构建当前源码的前端 Docker 镜像：$FRONTEND_IMAGE"
    build_frontend_from_source || die "源码镜像构建失败"
    verify_frontend_image
    ;;
  existing)
    verify_frontend_image
    ;;
esac

if [ "$FIRST_INSTALL" -eq 1 ] && [ "$ADOPT_EXISTING" -eq 0 ]; then
  log "启动全新 PostgreSQL、Redis、平台和交付调度器，并执行最新数据库迁移与初始化数据"
else
  log "启动 PostgreSQL、Redis、平台和交付调度器，并执行数据库迁移与幂等初始化"
fi
compose up -d --remove-orphans
health_check || {
  compose ps >&2 || true
  compose logs --tail=160 app postgres redis >&2 || true
  die "平台启动后健康检查失败"
}
verify_database_initialization

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
log "再次验证：./install.sh verify --project-name $PROJECT_NAME"
log "停止容器：./install.sh down --project-name $PROJECT_NAME"
