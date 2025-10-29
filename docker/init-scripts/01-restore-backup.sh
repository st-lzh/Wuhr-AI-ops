#!/bin/bash

# PostgreSQL 初始化脚本
# 在数据库首次启动时自动导入备份数据

set -e

echo "🚀 PostgreSQL 初始化脚本开始执行..."

# 检查是否存在备份文件
BACKUP_FILE="/docker-entrypoint-initdb.d/data/backups/latest_backup.sql.gz"
BACKUP_FILE_ALT="/docker-entrypoint-initdb.d/init-data.sql"

if [ -f "$BACKUP_FILE" ]; then
    echo "📁 发现备份文件，正在导入数据..."
    echo "📊 备份文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"
    
    # 解压并导入备份数据
    gunzip -c "$BACKUP_FILE" | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
    
    if [ $? -eq 0 ]; then
        echo "✅ 备份数据导入成功！"
    else
        echo "❌ 备份数据导入失败"
        exit 1
    fi
    
elif [ -f "$BACKUP_FILE_ALT" ]; then
    echo "📁 发现初始化SQL文件，正在导入..."
    
    # 导入SQL文件
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$BACKUP_FILE_ALT"
    
    if [ $? -eq 0 ]; then
        echo "✅ 初始化数据导入成功！"
    else
        echo "❌ 初始化数据导入失败"
        exit 1
    fi
    
else
    echo "ℹ️ 未发现备份文件，将创建空数据库"
    echo "💡 如需导入数据，请将备份文件放置在 data/backups/latest_backup.sql.gz"
fi

echo "🎉 PostgreSQL 初始化完成！"
