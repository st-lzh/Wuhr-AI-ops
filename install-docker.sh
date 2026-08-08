#!/bin/bash

# Wuhr AI Ops Platform Docker 启动脚本
# Docker startup script for Wuhr AI Ops Platform

set -e

# 语言选择（默认中文，设置 LANG=en 使用英文）
LANG="${LANG:-zh}"

# 输出函数
log() {
    if [ "$LANG" = "en" ]; then
        echo "$2"
    else
        echo "$1"
    fi
}

log "🚀 启动 Wuhr AI Ops Platform Docker 服务..." "🚀 Starting Wuhr AI Ops Platform Docker services..."

# 统一使用 docker compose 命令（检测新旧版本）
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    log "✅ 检测到 Docker Compose v2 插件" "✅ Detected Docker Compose v2 plugin"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    log "⚠️  检测到旧版 docker-compose，建议升级到 Docker Compose v2" "⚠️  Detected legacy docker-compose, upgrade to Docker Compose v2 recommended"
else
    log "❌ Docker Compose 未安装，请先安装 Docker Compose" "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# 检查 Docker 是否安装和运行
if ! command -v docker &> /dev/null; then
    log "❌ Docker 未安装，请先安装 Docker" "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    log "❌ Docker daemon 未运行，请启动 Docker" "❌ Docker daemon is not running. Please start Docker."
    exit 1
fi

# 检查端口占用
log "🔍 检查端口占用情况..." "🔍 Checking port availability..."
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        log "⚠️  端口 $port ($service) 已被占用，请先释放该端口" "⚠️  Port $port ($service) is already in use, please free it first"
        return 1
    fi
    return 0
}

PORT_CHECK_FAILED=0
check_port 3000 "应用服务/Application" || PORT_CHECK_FAILED=1
check_port 5432 "PostgreSQL" || PORT_CHECK_FAILED=1
check_port 6379 "Redis" || PORT_CHECK_FAILED=1

if [ $PORT_CHECK_FAILED -eq 1 ]; then
    log "❌ 端口检查失败，请处理端口冲突后重试" "❌ Port check failed, please resolve port conflicts and retry"
    exit 1
fi

# 检查磁盘空间（至少需要5GB）
log "💾 检查磁盘空间..." "💾 Checking disk space..."
AVAILABLE_SPACE=$(df -k . | tail -1 | awk '{print $4}')
REQUIRED_SPACE=$((5 * 1024 * 1024)) # 5GB in KB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    log "⚠️  磁盘空间不足（可用: $(($AVAILABLE_SPACE / 1024 / 1024))GB，需要: 5GB）" \
        "⚠️  Insufficient disk space (Available: $(($AVAILABLE_SPACE / 1024 / 1024))GB, Required: 5GB)"
    log "❌ 请清理磁盘空间后重试" "❌ Please free up disk space and retry"
    exit 1
fi

# 检查必需文件
log "📄 检查必需文件..." "📄 Checking required files..."
REQUIRED_FILES=(
    "docker-compose.yml"
    "Dockerfile"
    "prisma/schema.prisma"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        log "❌ 缺少必需文件: $file" "❌ Missing required file: $file"
        exit 1
    fi
done

# 检查环境变量文件
log "🔧 检查环境变量配置..." "🔧 Checking environment configuration..."
if [ ! -f .env.docker ]; then
    log "⚠️  .env.docker 文件不存在，将使用 docker-compose.yml 中的默认配置" \
        "⚠️  .env.docker file not found, using default configuration from docker-compose.yml"
else
    # 验证关键环境变量
    REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY")
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${var}=" .env.docker; then
            log "⚠️  环境变量 $var 未在 .env.docker 中配置" "⚠️  Environment variable $var not configured in .env.docker"
        fi
    done
fi

# 创建必要的目录
log "📁 创建必要的目录..." "📁 Creating necessary directories..."
mkdir -p data/backups
mkdir -p deployments/projects
mkdir -p logs

# 停止现有服务（如果运行中）
log "🛑 停止现有服务..." "🛑 Stopping existing services..."
$DOCKER_COMPOSE down --remove-orphans || true

# 清理旧的镜像和容器（可选）
if [ "$1" = "--clean" ]; then
    log "🧹 清理旧镜像和未使用的卷..." "🧹 Cleaning old images and unused volumes..."
    docker system prune -f || true
fi

# 构建并启动服务
log "🔨 构建应用镜像..." "🔨 Building application image..."
$DOCKER_COMPOSE build app

log "🚀 启动所有服务..." "🚀 Starting all services..."
$DOCKER_COMPOSE up -d

# 等待服务启动
log "⏳ 等待服务启动..." "⏳ Waiting for services to start..."
sleep 10

# 检查服务状态
log "🔍 检查服务状态..." "🔍 Checking service status..."
$DOCKER_COMPOSE ps

# 等待数据库就绪（增加超时时间到120秒）
log "⏳ 等待数据库就绪..." "⏳ Waiting for database to be ready..."
timeout=120
counter=0
while ! $DOCKER_COMPOSE exec -T postgres pg_isready -U wuhr_admin -d wuhr_ai_ops > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        log "❌ 数据库启动超时" "❌ Database startup timeout"
        log "📋 查看数据库日志：" "📋 Check database logs:"
        $DOCKER_COMPOSE logs postgres
        exit 1
    fi
    if [ $((counter % 10)) -eq 0 ]; then
        log "⏳ 等待数据库启动... ($counter/$timeout)" "⏳ Waiting for database... ($counter/$timeout)"
    fi
    sleep 2
    counter=$((counter + 2))
done
log "✅ 数据库已就绪" "✅ Database is ready"

# 检查数据库是否已有数据
log "🔍 检查数据库状态..." "🔍 Checking database status..."
TABLE_COUNT=$($DOCKER_COMPOSE exec -T postgres psql -U wuhr_admin -d wuhr_ai_ops -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "⚠️  数据库中已存在 $TABLE_COUNT 个表" "⚠️  Database already contains $TABLE_COUNT tables"

    # 在生产环境中，应该询问用户是否继续
    if [ "$FORCE_RESET" != "true" ]; then
        log "💡 如需重新初始化数据库，请设置环境变量: FORCE_RESET=true" \
            "💡 To reinitialize database, set environment variable: FORCE_RESET=true"
        log "🔄 同步数据库Schema..." "🔄 Syncing database schema..."

        # 🔥 即使数据库有数据，也要同步schema确保表结构最新
        if $DOCKER_COMPOSE exec app npx prisma db push --skip-generate > /tmp/prisma-sync.log 2>&1; then
            log "✅ 数据库Schema同步成功" "✅ Database schema synced successfully"
        else
            log "⚠️  数据库Schema同步失败，详情见 /tmp/prisma-sync.log" "⚠️  Database schema sync failed, see /tmp/prisma-sync.log"
            cat /tmp/prisma-sync.log
        fi
    else
        log "🧹 强制重置数据库..." "🧹 Force resetting database..."
        $DOCKER_COMPOSE exec -T postgres psql -U wuhr_admin -d wuhr_ai_ops -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" || {
            log "❌ 清空数据库失败" "❌ Failed to clean database"
            exit 1
        }
        TABLE_COUNT=0
    fi
fi

# 运行 Prisma 数据库迁移（仅当数据库为空时）
if [ "$TABLE_COUNT" -eq 0 ]; then
    log "🔄 运行 Prisma 数据库迁移..." "🔄 Running Prisma database migration..."
    if $DOCKER_COMPOSE exec app npx prisma db push --accept-data-loss --skip-generate > /tmp/prisma-migrate.log 2>&1; then
        log "✅ 数据库迁移成功" "✅ Database migration completed successfully"
    else
        log "❌ 数据库迁移失败" "❌ Database migration failed"
        log "📋 查看详细错误信息：" "📋 Check detailed error information:"
        cat /tmp/prisma-migrate.log
        exit 1
    fi
else
    log "ℹ️  数据库已存在表，跳过迁移" "ℹ️  Database tables exist, skipping migration"
fi

# 生成 Prisma 客户端
# Prisma 客户端已在 Docker 构建阶段生成，跳过此步骤
log "ℹ️  Prisma 客户端已在构建时生成" "ℹ️  Prisma client generated during build"


# 初始化超级管理员账户
log "👤 初始化超级管理员账户..." "👤 Initializing super admin account..."
if $DOCKER_COMPOSE exec -T postgres psql -U wuhr_admin -d wuhr_ai_ops > /tmp/admin-init.log 2>&1 << 'EOF'
INSERT INTO users (id, username, email, password, "realName", role, permissions, "isActive", "approvalStatus", "approvedAt", "createdAt", "updatedAt")
VALUES (
  'admin-' || md5(random()::text),
  'admin',
  'admin@wuhr.ai',
  '$2a$12$2Ip8szOs60R808pRyl5UAeKfRINofYl/VQO9luzKKMuk.b6e6b33C',
  '超级管理员',
  'admin',
  ARRAY['*'],
  true,
  'approved',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  "isActive" = EXCLUDED."isActive",
  "approvalStatus" = EXCLUDED."approvalStatus";
EOF
then
    log "✅ 管理员账户初始化成功" "✅ Admin account initialized successfully"
    log "📧 邮箱 / Email: admin@wuhr.ai" "📧 Email: admin@wuhr.ai"
    log "🔑 密码 / Password: WuhrAI@2026!" "🔑 Password: WuhrAI@2026!"
else
    ERROR_MSG=$(cat /tmp/admin-init.log)
    if echo "$ERROR_MSG" | grep -q "duplicate key"; then
        log "✅ 管理员账户已存在" "✅ Admin account already exists"
    else
        log "❌ 管理员账户初始化失败" "❌ Admin account initialization failed"
        cat /tmp/admin-init.log
        log "⚠️  您可以稍后手动创建管理员" "⚠️  You can manually create admin account later"
    fi
fi

# 初始化预设AI模型
log "🤖 初始化预设AI模型..." "🤖 Initializing preset AI models..."
if $DOCKER_COMPOSE exec -T postgres psql -U wuhr_admin -d wuhr_ai_ops < prisma/init-preset-models.sql > /tmp/models-init.log 2>&1; then
    MODEL_COUNT=$($DOCKER_COMPOSE exec -T postgres psql -U wuhr_admin -d wuhr_ai_ops -t -c "SELECT COUNT(*) FROM preset_models WHERE \"isActive\" = true;" | tr -d ' ')
    log "✅ 预设AI模型初始化成功 (共 $MODEL_COUNT 个模型)" "✅ Preset AI models initialized successfully ($MODEL_COUNT models)"
else
    log "⚠️  预设AI模型初始化失败，详情见 /tmp/models-init.log" "⚠️  Preset AI models initialization failed, see /tmp/models-init.log"
    cat /tmp/models-init.log
fi

# 检查应用健康状态（增加超时时间到120秒）
log "🏥 检查应用健康状态..." "🏥 Checking application health..."
timeout=120
counter=0
APP_HEALTHY=false

while [ $counter -lt $timeout ]; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        APP_HEALTHY=true
        break
    fi

    if [ $((counter % 10)) -eq 0 ]; then
        log "⏳ 等待应用就绪... ($counter/$timeout)" "⏳ Waiting for application... ($counter/$timeout)"
    fi
    sleep 2
    counter=$((counter + 2))
done

if [ "$APP_HEALTHY" = false ]; then
    log "❌ 应用健康检查超时" "❌ Application health check timeout"
    log "📋 查看应用日志：" "📋 Check application logs:"
    $DOCKER_COMPOSE logs app | tail -50
    exit 1
fi

log "✅ 应用健康检查通过" "✅ Application health check passed"

LOGIN_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    --data '{"username":"admin@wuhr.ai","password":"WuhrAI@2026!"}' \
    http://localhost:3000/api/auth/login || true)
if [ "$LOGIN_STATUS" != "200" ]; then
    log "❌ 管理员固定初始密码登录验收失败（HTTP $LOGIN_STATUS）" \
        "❌ Fixed administrator password login verification failed (HTTP $LOGIN_STATUS)"
    exit 1
fi
log "✅ 管理员账号和固定初始密码真实登录验收通过" \
    "✅ Administrator account and fixed password login verified"

echo ""
log "🎉 Wuhr AI Ops Platform 启动成功！" "🎉 Wuhr AI Ops Platform started successfully!"
echo ""
log "🌐 访问地址：" "🌐 Access URLs:"
echo "   - 主应用: http://localhost:3000"
echo ""
log "👤 默认管理员账户：" "👤 Default admin account:"
echo "   - 邮箱: admin@wuhr.ai"
echo "   - 用户名: admin"
echo "   - 密码: WuhrAI@2026!"
echo ""
log "📊 服务状态：" "📊 Service Status:"
$DOCKER_COMPOSE ps
echo ""
log "📝 常用命令：" "📝 Useful commands:"
echo "   查看日志: $DOCKER_COMPOSE logs -f app"
echo "   停止服务: $DOCKER_COMPOSE down"
echo "   重启服务: $DOCKER_COMPOSE restart"
echo "   查看状态: $DOCKER_COMPOSE ps"
echo ""
log "💡 提示：首次启动可能需要几分钟时间来构建镜像和初始化数据库" \
    "💡 Tip: First startup may take a few minutes to build images and initialize database"
