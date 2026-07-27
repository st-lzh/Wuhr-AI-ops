import { PrismaClient } from '../generated/prisma';

// 简化的数据库配置
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaShutdownHooksRegistered: boolean | undefined;
};

export const prisma = globalForPrisma.prisma ?? 
  new PrismaClient({
    log: ['error'],
    errorFormat: 'minimal'
  });

// Next.js 会把不同 API route 编译为独立模块；生产环境同样必须复用连接池。
globalForPrisma.prisma = prisma;

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

// HMR 和多个 route bundle 只能注册一组退出钩子，否则会触发
// MaxListenersExceededWarning。使用 once，交由宿主进程决定最终退出时机。
if (!globalForPrisma.prismaShutdownHooksRegistered) {
  const disconnect = () => {
    void prisma.$disconnect();
  };

  process.once('beforeExit', disconnect);
  process.once('SIGINT', disconnect);
  process.once('SIGTERM', disconnect);
  globalForPrisma.prismaShutdownHooksRegistered = true;
}
