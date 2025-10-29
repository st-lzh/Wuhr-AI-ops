import { PrismaClient } from '../generated/prisma';

// 简化的数据库配置
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? 
  new PrismaClient({
    log: ['error'],
    errorFormat: 'minimal'
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 简化的获取客户端函数
export const getPrismaClient = async (): Promise<PrismaClient> => {
  try {
    // 简单的连接测试
    await prisma.$queryRaw`SELECT 1`;
    return prisma;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw error;
  }
};

// 清理函数
export const cleanupDatabaseConnections = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('🧹 数据库连接已清理');
  } catch (error) {
    console.error('❌ 清理数据库连接失败:', error);
    throw error;
  }
};

// 进程退出时清理
process.on('beforeExit', () => {
  void prisma.$disconnect();
});

process.on('SIGINT', () => {
  void prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  void prisma.$disconnect(); 
  process.exit(0);
});