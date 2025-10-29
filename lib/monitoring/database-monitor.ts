import { PrismaClient } from '../generated/prisma';

export interface ConnectionMetrics {
  timestamp: Date;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  idleInTransaction: number;
  longestQueryDuration: number; // 秒
  connectionErrors: number;
  applicationConnections: number;
}

export interface DatabaseHealth {
  isHealthy: boolean;
  connectionUsage: number; // 百分比
  avgResponseTime: number; // 毫秒
  errorRate: number; // 百分比
  lastError?: string;
  lastErrorTime?: Date;
  recommendations: string[];
}

class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private prisma: PrismaClient;
  private metrics: ConnectionMetrics[] = [];
  private maxMetricsHistory = 100; // 保留最近100条记录
  private errorCount = 0;
  private totalQueries = 0;
  private lastHealthCheck?: Date;

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public static getInstance(prisma: PrismaClient): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor(prisma);
    }
    return DatabaseMonitor.instance;
  }

  /**
   * 收集连接指标
   */
  public async collectMetrics(): Promise<ConnectionMetrics> {
    try {
      const startTime = Date.now();
      
      // 查询连接统计
      const connectionStats = await this.prisma.$queryRaw<Array<{
        total_connections: bigint;
        active_connections: bigint;
        idle_connections: bigint;
        idle_in_transaction: bigint;
        longest_query_duration: number;
        app_connections: bigint;
      }>>`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          COALESCE(EXTRACT(EPOCH FROM max(now() - query_start)), 0) as longest_query_duration,
          count(*) FILTER (WHERE application_name = 'wuhr_ai_ops') as app_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const responseTime = Date.now() - startTime;
      this.totalQueries++;

      const stats = connectionStats[0];
      const metrics: ConnectionMetrics = {
        timestamp: new Date(),
        totalConnections: Number(stats.total_connections),
        activeConnections: Number(stats.active_connections),
        idleConnections: Number(stats.idle_connections),
        idleInTransaction: Number(stats.idle_in_transaction),
        longestQueryDuration: stats.longest_query_duration,
        connectionErrors: this.errorCount,
        applicationConnections: Number(stats.app_connections)
      };

      // 保存指标历史
      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }

      return metrics;

    } catch (error) {
      this.errorCount++;
      console.error('❌ 收集数据库指标失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  public async checkHealth(): Promise<DatabaseHealth> {
    try {
      const startTime = Date.now();
      
      // 执行简单查询测试连接
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      
      const responseTime = Date.now() - startTime;
      this.lastHealthCheck = new Date();

      // 获取最新指标
      const metrics = await this.collectMetrics();
      
      // 计算健康状态
      const maxConnections = await this.getMaxConnections();
      const connectionUsage = (metrics.totalConnections / maxConnections) * 100;
      const errorRate = this.totalQueries > 0 ? (this.errorCount / this.totalQueries) * 100 : 0;

      // 生成建议
      const recommendations = this.generateRecommendations(metrics, connectionUsage, errorRate);

      const health: DatabaseHealth = {
        isHealthy: connectionUsage < 90 && errorRate < 5 && responseTime < 1000,
        connectionUsage,
        avgResponseTime: responseTime,
        errorRate,
        recommendations
      };

      return health;

    } catch (error) {
      this.errorCount++;
      return {
        isHealthy: false,
        connectionUsage: 0,
        avgResponseTime: 0,
        errorRate: 100,
        lastError: error instanceof Error ? error.message : String(error),
        lastErrorTime: new Date(),
        recommendations: ['数据库连接失败，请检查数据库服务状态']
      };
    }
  }

  /**
   * 获取最大连接数配置
   */
  private async getMaxConnections(): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ setting: string }>>`
        SELECT setting FROM pg_settings WHERE name = 'max_connections'
      `;
      return parseInt(result[0]?.setting || '100');
    } catch {
      return 100; // 默认值
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    metrics: ConnectionMetrics, 
    connectionUsage: number, 
    errorRate: number
  ): string[] {
    const recommendations: string[] = [];

    // 连接使用率建议
    if (connectionUsage > 80) {
      recommendations.push('连接使用率过高，考虑增加最大连接数或优化连接池配置');
    }

    // 空闲连接建议
    if (metrics.idleConnections > metrics.activeConnections * 2) {
      recommendations.push('空闲连接过多，考虑减少连接池大小或设置更短的空闲超时');
    }

    // 长时间运行查询建议
    if (metrics.longestQueryDuration > 300) {
      recommendations.push(`发现长时间运行查询(${Math.round(metrics.longestQueryDuration)}秒)，请检查查询性能`);
    }

    // 事务中空闲连接建议
    if (metrics.idleInTransaction > 0) {
      recommendations.push('存在事务中空闲连接，可能导致锁等待，请检查事务管理');
    }

    // 错误率建议
    if (errorRate > 5) {
      recommendations.push('数据库错误率较高，请检查应用程序和数据库日志');
    }

    // 应用连接数建议
    if (metrics.applicationConnections === 0) {
      recommendations.push('未检测到应用程序连接，请检查连接配置');
    }

    if (recommendations.length === 0) {
      recommendations.push('数据库连接状态良好');
    }

    return recommendations;
  }

  /**
   * 获取指标历史
   */
  public getMetricsHistory(): ConnectionMetrics[] {
    return [...this.metrics];
  }

  /**
   * 获取连接统计摘要
   */
  public getConnectionSummary(): {
    avgConnections: number;
    maxConnections: number;
    avgActiveConnections: number;
    totalErrors: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgConnections: 0,
        maxConnections: 0,
        avgActiveConnections: 0,
        totalErrors: this.errorCount
      };
    }

    const avgConnections = this.metrics.reduce((sum, m) => sum + m.totalConnections, 0) / this.metrics.length;
    const maxConnections = Math.max(...this.metrics.map(m => m.totalConnections));
    const avgActiveConnections = this.metrics.reduce((sum, m) => sum + m.activeConnections, 0) / this.metrics.length;

    return {
      avgConnections: Math.round(avgConnections),
      maxConnections,
      avgActiveConnections: Math.round(avgActiveConnections),
      totalErrors: this.errorCount
    };
  }

  /**
   * 查找长时间运行的查询
   */
  public async getLongRunningQueries(thresholdSeconds: number = 30): Promise<Array<{
    pid: number;
    duration: string;
    query: string;
    state: string;
    application_name: string;
  }>> {
    try {
      const queries = await this.prisma.$queryRaw<Array<{
        pid: number;
        duration: string;
        query: string;
        state: string;
        application_name: string;
      }>>`
        SELECT 
          pid,
          now() - pg_stat_activity.query_start AS duration,
          query,
          state,
          application_name
        FROM pg_stat_activity 
        WHERE (now() - pg_stat_activity.query_start) > interval '${thresholdSeconds} seconds'
        AND state != 'idle'
        AND pid != pg_backend_pid()
        ORDER BY query_start ASC
      `;

      return queries;
    } catch (error) {
      console.error('❌ 获取长时间运行查询失败:', error);
      return [];
    }
  }

  /**
   * 安全地终止空闲连接（仅限空闲状态）
   */
  public async terminateIdleConnections(idleThresholdMinutes: number = 30): Promise<number> {
    try {
      // 只终止真正空闲的连接，不影响活跃连接
      const result = await this.prisma.$queryRaw<Array<{ terminated_count: bigint }>>`
        SELECT count(*) as terminated_count
        FROM (
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity 
          WHERE datname = current_database()
          AND state = 'idle'
          AND application_name = 'wuhr_ai_ops'
          AND now() - state_change > interval '${idleThresholdMinutes} minutes'
          AND pid != pg_backend_pid()
        ) as terminated
      `;

      const terminatedCount = Number(result[0]?.terminated_count || 0);
      
      if (terminatedCount > 0) {
        console.log(`🧹 已安全终止 ${terminatedCount} 个空闲连接`);
      }

      return terminatedCount;
    } catch (error) {
      console.error('❌ 终止空闲连接失败:', error);
      return 0;
    }
  }

  /**
   * 重置错误计数
   */
  public resetErrorCount(): void {
    this.errorCount = 0;
    this.totalQueries = 0;
  }

  /**
   * 生成监控报告
   */
  public generateReport(): string {
    const summary = this.getConnectionSummary();
    const latestMetrics = this.metrics[this.metrics.length - 1];
    
    let report = '📊 数据库连接监控报告\n';
    report += `生成时间: ${new Date().toLocaleString()}\n\n`;
    
    if (latestMetrics) {
      report += '📈 当前状态:\n';
      report += `  总连接数: ${latestMetrics.totalConnections}\n`;
      report += `  活跃连接: ${latestMetrics.activeConnections}\n`;
      report += `  空闲连接: ${latestMetrics.idleConnections}\n`;
      report += `  应用连接: ${latestMetrics.applicationConnections}\n`;
      report += `  最长查询: ${Math.round(latestMetrics.longestQueryDuration)}秒\n\n`;
    }
    
    report += '📊 历史统计:\n';
    report += `  平均连接数: ${summary.avgConnections}\n`;
    report += `  峰值连接数: ${summary.maxConnections}\n`;
    report += `  平均活跃连接: ${summary.avgActiveConnections}\n`;
    report += `  总错误数: ${summary.totalErrors}\n`;
    
    return report;
  }
}

// 导出监控器工厂函数
export const createDatabaseMonitor = (prisma: PrismaClient): DatabaseMonitor => {
  return DatabaseMonitor.getInstance(prisma);
};

// 导出类型
export { DatabaseMonitor };
