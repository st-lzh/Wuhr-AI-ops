import { PrismaClient } from '../generated/prisma';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  // 连接池配置 - 保守设置避免连接中断
  connectionLimit: number;      // 连接池大小
  connectionTimeout: number;    // 连接超时（秒）
  idleTimeout: number;         // 空闲超时（秒）
  statementTimeout: number;    // 语句超时（秒）
  queryTimeout: number;        // 查询超时（秒）
  // 重试配置
  maxRetries: number;          // 最大重试次数
  retryDelay: number;          // 重试延迟（毫秒）
}

// 全局单例Prisma客户端 - 确保复用
let globalPrisma: PrismaClient | undefined;

// 连接状态监控
interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: Date;
}

let connectionStats: ConnectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  errors: 0
};

class OptimizedDatabaseManager {
  private static instance: OptimizedDatabaseManager;
  private config: DatabaseConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): OptimizedDatabaseManager {
    if (!OptimizedDatabaseManager.instance) {
      OptimizedDatabaseManager.instance = new OptimizedDatabaseManager();
    }
    return OptimizedDatabaseManager.instance;
  }

  private loadConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'wuhr_ai_ops',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      
      // 保守的连接池配置，避免连接中断
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),    // 降低到10
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '20'), // 20秒
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300'),           // 5分钟
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30'),   // 30秒
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60'),          // 60秒
      
      // 重试配置
      maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
    };
  }

  private buildConnectionString(): string {
    const { host, port, database, username, password, ssl } = this.config;

    // 构建优化的连接字符串
    const params = new URLSearchParams();
    
    // SSL配置
    if (ssl) {
      params.set('sslmode', 'require');
    } else {
      params.set('sslmode', 'prefer'); // 优先使用SSL，但不强制
    }

    // 连接池和超时配置
    params.set('connect_timeout', this.config.connectionTimeout.toString());
    params.set('statement_timeout', `${this.config.statementTimeout * 1000}`); // 毫秒
    params.set('idle_in_transaction_session_timeout', `${this.config.idleTimeout * 1000}`);
    params.set('application_name', 'wuhr_ai_ops');
    
    // 连接池配置
    params.set('pool_timeout', '20'); // 获取连接的超时时间
    params.set('connection_limit', this.config.connectionLimit.toString());

    const paramString = params.toString();
    return `postgresql://${username}:${password}@${host}:${port}/${database}?${paramString}`;
  }

  public async getClient(): Promise<PrismaClient> {
    if (!globalPrisma) {
      await this.createClient();
    }

    // 检查连接健康状态
    if (globalPrisma && !await this.isHealthy()) {
      console.warn('🔄 数据库连接不健康，重新创建连接...');
      await this.reconnect();
    }

    return globalPrisma!;
  }

  private async createClient(): Promise<void> {
    try {
      const connectionString = this.buildConnectionString();

      globalPrisma = new PrismaClient({
        datasources: {
          db: {
            url: connectionString,
          },
        },
        log: [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ],
        errorFormat: 'pretty',
      });

      // 设置事件监听器
      this.setupEventListeners();

      // 测试连接
      await this.testConnection();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ 数据库连接已建立');
      console.log(`🔧 连接池配置: limit=${this.config.connectionLimit}, timeout=${this.config.connectionTimeout}s`);

    } catch (error) {
      console.error('❌ 创建数据库连接失败:', error);
      this.handleConnectionError(error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!globalPrisma) return;

    // 监听查询事件
    // globalPrisma.$on('warn', (e) => {
    //   console.warn('⚠️ Prisma警告:', e);
    // });

    // globalPrisma.$on('error', (e) => {
    //   console.error('❌ Prisma错误:', e);
    //   connectionStats.errors++;
    //   connectionStats.lastError = e.message;
    //   connectionStats.lastErrorTime = new Date();
    //
    //   // 如果是连接相关错误，尝试重连
    //   if (this.isConnectionError(e.message)) {
    //     this.handleConnectionError(e);
    //   }
    // });
  }

  private isConnectionError(errorMessage: string): boolean {
    const connectionErrorPatterns = [
      'terminating connection due to administrator command',
      'connection terminated',
      'server closed the connection unexpectedly',
      'connection refused',
      'timeout expired',
      'too many clients',
      'database is closed'
    ];

    return connectionErrorPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private async handleConnectionError(error: any): Promise<void> {
    console.error('🔄 处理连接错误:', error.message);
    
    this.isConnected = false;
    
    // 如果重连次数未超限，尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      await this.reconnect();
    } else {
      console.error('❌ 达到最大重连次数，停止重连');
    }
  }

  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    
    console.log(`🔄 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    try {
      // 断开现有连接
      if (globalPrisma) {
        await globalPrisma.$disconnect();
        globalPrisma = undefined;
      }

      // 等待一段时间后重连
      const delay = this.config.retryDelay * this.reconnectAttempts;
      await new Promise(resolve => setTimeout(resolve, delay));

      // 重新创建连接
      await this.createClient();
      
      console.log('✅ 数据库重连成功');
      
    } catch (error) {
      console.error(`❌ 重连失败 (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // 继续尝试重连
        setTimeout(() => this.reconnect(), this.config.retryDelay * 2);
      }
    }
  }

  private async testConnection(): Promise<void> {
    if (!globalPrisma) throw new Error('Prisma客户端未初始化');
    
    try {
      await globalPrisma.$queryRaw`SELECT 1 as connection_test`;
    } catch (error) {
      throw new Error(`数据库连接测试失败: ${error}`);
    }
  }

  public async isHealthy(): Promise<boolean> {
    if (!globalPrisma || !this.isConnected) return false;
    
    try {
      await globalPrisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.warn('🔍 健康检查失败:', error);
      return false;
    }
  }

  public async getConnectionStats(): Promise<ConnectionStats> {
    if (!globalPrisma) return connectionStats;
    
    try {
      // 查询PostgreSQL连接统计
      const stats = await globalPrisma.$queryRaw<Array<{
        total: bigint;
        active: bigint;
        idle: bigint;
      }>>`
        SELECT 
          count(*) as total,
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity 
        WHERE datname = current_database()
        AND application_name = 'wuhr_ai_ops'
      `;

      if (stats && stats.length > 0) {
        connectionStats.totalConnections = Number(stats[0].total);
        connectionStats.activeConnections = Number(stats[0].active);
        connectionStats.idleConnections = Number(stats[0].idle);
      }
    } catch (error) {
      console.warn('⚠️ 获取连接统计失败:', error);
    }
    
    return { ...connectionStats };
  }

  public async disconnect(): Promise<void> {
    if (globalPrisma) {
      await globalPrisma.$disconnect();
      globalPrisma = undefined;
      this.isConnected = false;
      console.log('🔌 数据库连接已断开');
    }
  }

  // 优雅关闭
  public async gracefulShutdown(): Promise<void> {
    console.log('🛑 开始优雅关闭数据库连接...');
    await this.disconnect();
    console.log('✅ 数据库连接优雅关闭完成');
  }
}

// 导出单例实例
export const optimizedDb = OptimizedDatabaseManager.getInstance();

// 导出Prisma客户端获取函数
export const getPrismaClient = async (): Promise<PrismaClient> => {
  return await optimizedDb.getClient();
};

// 导出连接统计函数
export const getConnectionStats = async (): Promise<ConnectionStats> => {
  return await optimizedDb.getConnectionStats();
};

// 导出健康检查函数
export const isDbHealthy = async (): Promise<boolean> => {
  return await optimizedDb.isHealthy();
};

// 进程退出时优雅关闭
process.on('beforeExit', async () => {
  await optimizedDb.gracefulShutdown();
});

process.on('SIGINT', async () => {
  await optimizedDb.gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await optimizedDb.gracefulShutdown();
  process.exit(0);
});
