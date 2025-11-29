# =============================================================================
# Wuhr AI Ops 前端 Dockerfile - 国内优化版
# 针对国内网络环境优化，使用国内镜像源加速构建
# =============================================================================

# -----------------------------------------------------------------------------
# 阶段1: 依赖安装
# -----------------------------------------------------------------------------
FROM node:20-slim AS deps

WORKDIR /app

# 配置国内apt镜像源（Debian bookworm）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 安装必要的构建工具（bcrypt等原生模块需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 配置npm/pnpm使用国内镜像
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm@10.7.1 && \
    pnpm config set registry https://registry.npmmirror.com/

# 先只复制依赖文件，利用Docker缓存层
COPY package.json pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# 阶段2: 构建应用
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# 配置国内apt镜像源
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 安装构建工具（某些包在build时可能需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 配置pnpm
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm@10.7.1

# 从deps阶段复制node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# 复制源代码
COPY . .

# 设置构建时环境变量
ENV NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1 \
    DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" \
    REDIS_URL="redis://placeholder:6379"

# 生成Prisma客户端并构建应用
RUN pnpm prisma generate && pnpm build

# -----------------------------------------------------------------------------
# 阶段3: 生产运行环境（最小化镜像）
# -----------------------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

# 配置国内apt镜像源
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 设置环境变量
ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    NEXT_TELEMETRY_DISABLED=1

# 安装运行时依赖（最小化安装）
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 配置pnpm
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm@10.7.1

# 创建非root用户
RUN groupadd -g 1001 wuhr && \
    useradd -u 1001 -g wuhr -s /bin/bash -m wuhr

# 从builder阶段复制构建产物
COPY --from=builder --chown=wuhr:wuhr /app/.next/standalone ./
COPY --from=builder --chown=wuhr:wuhr /app/.next/static ./.next/static
COPY --from=builder --chown=wuhr:wuhr /app/prisma ./prisma
COPY --from=builder --chown=wuhr:wuhr /app/package.json ./
COPY --from=builder --chown=wuhr:wuhr /app/node_modules ./node_modules

# 创建必要目录
RUN mkdir -p /app/data /app/logs /app/public && chown -R wuhr:wuhr /app

# 修复pnpm符号链接问题
RUN cd /app/node_modules && \
    rm -f ssh2 2>/dev/null || true && \
    ln -sf .pnpm/ssh2@*/node_modules/ssh2 ssh2 && \
    ln -sf .pnpm/ssh2-streams@*/node_modules/ssh2-streams ssh2-streams

# 切换到非root用户
USER wuhr

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
