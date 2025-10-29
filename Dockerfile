# Ubuntu基础镜像 - 完整支持原生模块
FROM node:20-slim AS deps
WORKDIR /app
# 安装必要的构建工具
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml* ./
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm@10.7.1 && \
    pnpm config set registry https://registry.npmmirror.com/ && \
    pnpm install --frozen-lockfile

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1 \
    DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" \
    REDIS_URL="redis://placeholder:6379"
RUN npx pnpm prisma generate && npx pnpm build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Shanghai NEXT_TELEMETRY_DISABLED=1
# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@10.7.1 && \
    groupadd -g 1001 wuhr && \
    useradd -u 1001 -g wuhr -s /bin/bash -m wuhr

COPY --from=builder --chown=wuhr:wuhr /app/.next/standalone ./
COPY --from=builder --chown=wuhr:wuhr /app/.next/static ./.next/static
COPY --from=builder --chown=wuhr:wuhr /app/prisma ./prisma
COPY --from=builder --chown=wuhr:wuhr /app/package.json ./
COPY --from=builder --chown=wuhr:wuhr /app/node_modules ./node_modules

RUN mkdir -p /app/data /app/logs /app/public && chown -R wuhr:wuhr /app

# 修复pnpm符号链接问题 - 为ssh2创建直接软链接
RUN cd /app/node_modules && \
    rm -f ssh2 2>/dev/null || true && \
    ln -s .pnpm/ssh2@*/node_modules/ssh2 ssh2 && \
    ln -s .pnpm/ssh2-streams@*/node_modules/ssh2-streams ssh2-streams

USER wuhr
EXPOSE 3000
CMD ["node", "server.js"]
