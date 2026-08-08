# Wuhr AI Ops Platform - 安装指南

## 📋 系统要求

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **磁盘空间**: 至少 5GB
- **端口**: 3000, 5432, 6379 需要空闲

## 🚀 一键安装

### 方式一：使用安装脚本（推荐）

```bash
# 1. 下载项目
git clone https://github.com/st-lzh/Wuhr-AI-ops.git
cd Wuhr-AI-ops

# 2. 运行一键安装脚本
chmod +x install-docker.sh
./install-docker.sh

# 3. 首次安装可能需要几分钟构建镜像，请耐心等待
```

### 方式二：手动安装

```bash
# 1. 启动服务
docker compose build app
docker compose up -d

# 2. 等待服务启动（约30秒）
docker compose ps

# 3. 运行数据库迁移
docker compose exec app pnpm prisma migrate deploy

# 4. 初始化管理员账户
docker compose exec app node -e "
const { getPrismaClient } = require('/app/lib/config/database');
const bcrypt = require('bcryptjs');
(async () => {
  const prisma = await getPrismaClient();
  const hash = await bcrypt.hash('WuhrAI@2026!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@wuhr.ai' },
    update: { password: hash, role: 'admin', permissions: ['*'] },
    create: {
      username: 'admin',
      email: 'admin@wuhr.ai',
      password: hash,
      realName: '超级管理员',
      role: 'admin',
      permissions: ['*'],
      isActive: true,
      approvalStatus: 'approved'
    }
  });
  console.log('✅ 管理员账户已创建');
  await prisma.\$disconnect();
})();
"
```

## 🔧 环境配置

### 修改默认密码和密钥（生产环境必须修改！）

编辑 `.env.docker` 文件：

```env
# 数据库密码
DATABASE_URL="postgresql://wuhr_admin:YOUR_DB_PASSWORD@postgres:5432/wuhr_ai_ops..."

# JWT密钥（至少32位随机字符串）
JWT_SECRET="your_super_secure_jwt_secret_change_this"

# 加密密钥（64位十六进制字符串）
ENCRYPTION_KEY="your_64_char_hex_encryption_key_change_this_in_production"

# Redis密码
REDIS_PASSWORD="your_redis_password"
```

或修改 `docker-compose.yml` 中的环境变量。

## 🌐 访问应用

安装完成后，访问：

- **Web界面**: http://localhost:3000
- **默认管理员账户**:
  - 邮箱: `admin@wuhr.ai`
  - 用户名: `admin`
  - 密码: `WuhrAI@2026!`

⚠️ **首次登录后请立即修改密码！**

## 📊 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f app        # 应用日志
docker compose logs -f postgres   # 数据库日志
docker compose logs -f redis      # Redis日志

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 停止并删除所有数据（谨慎使用！）
docker compose down -v

# 进入容器
docker compose exec app sh        # 进入应用容器
docker compose exec postgres sh   # 进入数据库容器

# 备份数据库
docker compose exec postgres pg_dump -U wuhr_admin wuhr_ai_ops > backup.sql

# 恢复数据库
cat backup.sql | docker compose exec -T postgres psql -U wuhr_admin -d wuhr_ai_ops
```

## 🛠️ 故障排查

### 1. 端口被占用

```bash
# 查看端口占用
lsof -i :3000
lsof -i :5432
lsof -i :6379

# 杀死占用进程
kill -9 <PID>
```

### 2. 容器启动失败

```bash
# 查看详细日志
docker compose logs app

# 重新构建镜像
docker compose build --no-cache app
docker compose up -d
```

### 3. 数据库连接失败

```bash
# 检查数据库是否就绪
docker compose exec postgres pg_isready -U wuhr_admin -d wuhr_ai_ops

# 查看数据库日志
docker compose logs postgres

# 重启数据库
docker compose restart postgres
```

### 4. 磁盘空间不足

```bash
# 清理 Docker 缓存
docker system prune -a

# 查看磁盘使用
docker system df
```

### 5. 应用无法访问

```bash
# 检查应用健康状态
curl http://localhost:3000/api/health

# 查看应用日志
docker compose logs -f app

# 重启应用
docker compose restart app
```

## 🔄 升级指南

```bash
# 1. 停止服务
docker compose down

# 2. 备份数据库
docker compose exec postgres pg_dump -U wuhr_admin wuhr_ai_ops > backup-$(date +%Y%m%d).sql

# 3. 拉取最新代码
git pull

# 4. 重新构建并启动
./install-docker.sh
```

## 🔐 安全建议

1. **修改默认密码**: 首次登录后立即修改管理员密码
2. **修改密钥**: 生产环境必须修改 `JWT_SECRET` 和 `ENCRYPTION_KEY`
3. **修改数据库密码**: 在 `docker-compose.yml` 中修改 PostgreSQL 和 Redis 密码
4. **使用 HTTPS**: 生产环境建议使用 Nginx + SSL
5. **定期备份**: 设置自动备份数据库任务

## 📝 生产环境部署建议

1. **使用预构建镜像**:
   ```bash
   # 使用 GitHub Container Registry 预构建镜像
   docker pull ghcr.io/st-lzh/wuhr-ai-ops:latest
   ```

2. **配置反向代理**:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **持久化数据**: 确保 volumes 目录有足够权限和备份

4. **监控和日志**: 配置日志收集和监控系统

## 💬 获取帮助

- 问题反馈: [GitHub Issues](https://github.com/st-lzh/Wuhr-AI-ops/issues)
- 查看日志: `docker compose logs -f`

## 📄 许可证

本项目遵循相应的开源许可证。
