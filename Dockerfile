# Ubuntu基础镜像 - 完整支持原生模块
# 默认通过 DaoCloud 公共镜像加速获取 Node 20 slim，并固定已验收摘要；
# 构建参数仍允许安装器在 DaoCloud 不可用时切换到同摘要的 Docker Hub 源。
ARG NODE_BASE_IMAGE=m.daocloud.io/docker.io/library/node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0
FROM ${NODE_BASE_IMAGE} AS deps
WORKDIR /app
# 安装必要的构建工具
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get -o Acquire::Retries=5 update && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml* ./
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm install -g pnpm@10.7.1 && \
    pnpm config set registry https://registry.npmmirror.com/ && \
    pnpm install --frozen-lockfile

FROM ${NODE_BASE_IMAGE} AS builder
WORKDIR /app
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get -o Acquire::Retries=5 update && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* && \
    npm config set registry https://registry.npmmirror.com/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm install -g pnpm@10.7.1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=4096" \
    SKIP_ENV_VALIDATION=1 \
    PRISMA_ENGINES_MIRROR="https://registry.npmmirror.com/-/binary/prisma" \
    DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" \
    REDIS_URL="redis://placeholder:6379"
RUN pnpm prisma generate && pnpm build

FROM ${NODE_BASE_IMAGE} AS runner
WORKDIR /app
# Docker 会自动注入 HOSTNAME=<容器 ID>；Next standalone 若直接使用该值，
# 会只监听容器自身地址，导致宿主机 3000 端口转发返回 502。
ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# 安装运行时依赖
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get -o Acquire::Retries=5 update && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
    postgresql-client \
    subversion \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    groupadd -g 1001 wuhr && \
    useradd -u 1001 -g wuhr -s /bin/bash -m wuhr

COPY --from=builder --chown=wuhr:wuhr /app/.next/standalone ./
COPY --from=builder --chown=wuhr:wuhr /app/.next/static ./.next/static
COPY --from=builder --chown=wuhr:wuhr /app/public ./public
COPY --from=builder --chown=wuhr:wuhr /app/prisma ./prisma
COPY --from=builder --chown=wuhr:wuhr /app/lib/config/db-seed.cjs ./lib/config/db-seed.cjs
COPY --from=builder --chown=wuhr:wuhr /app/lib/generated/prisma ./lib/generated/prisma
COPY --from=builder --chown=wuhr:wuhr /app/scripts/deployment-scheduler-worker.cjs ./scripts/deployment-scheduler-worker.cjs
COPY --from=builder --chown=wuhr:wuhr /app/package.json ./
COPY --from=builder --chown=wuhr:wuhr /app/node_modules ./node_modules

RUN mkdir -p /app/data /app/logs /app/public && chown -R wuhr:wuhr /app/data /app/logs /app/public

# Next.js 文件追踪可能把动态 import 对应的 TypeScript 原文件和 Prisma 类型声明
# 一并带入 standalone。运行时只使用已编译 JS，发布镜像必须移除这些应用源码、
# source map 与环境文件。
RUN rm -f /app/lib/logging/projectLogManager.ts /app/utils/httpApiClient.ts && \
    find /app/lib/generated/prisma -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.map' \) -delete && \
    find /app -maxdepth 2 -type f \( -name '.env' -o -name '.env.*' \) -delete

# 修复pnpm符号链接问题 - 为ssh2创建直接软链接
RUN cd /app/node_modules && \
    rm -f ssh2 2>/dev/null || true && \
    ln -s .pnpm/ssh2@*/node_modules/ssh2 ssh2 && \
    ln -s .pnpm/ssh2-streams@*/node_modules/ssh2-streams ssh2-streams

USER wuhr
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node lib/config/db-seed.cjs && exec node server.js"]
