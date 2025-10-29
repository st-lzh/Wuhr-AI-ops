import { getPrismaClient } from '../config/database'
import { dbConnectionManager } from './connectionManager'
import { connectionLeakDetector } from './leakDetector'

// 健康检查结果接口
export interface HealthCheckResult {
  healthy: boolean
  timestamp: Date
  checks: {
    database: {
      connected: boolean
      responseTime: number
      error?: string
    }
    connectionPool: {
      healthy: boolean
      stats: {
        activeConnections: number
        idleConnections: number
        totalConnections: number
        usagePercentage: number
      }
      issues: string[]
    }
    leakDetection: {
      healthy: boolean
      stats: {
        activeOperations: number
        longestRunningOperation: {
          id: string
          name: string
          duration: number
        } | null
        averageDuration: number
      }
    }
    performance: {
      healthy: boolean
      metrics: {
        avgQueryTime: number
        slowQueries: number
        longRunningTransactions: number
      }
    }
  }
  recommendations: string[]
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical'
    message: string
    timestamp: Date
  }>
}

// 数据库健康检查器
export class DatabaseHealthChecker {
  private static instance: DatabaseHealthChecker
  private checkInterval: NodeJS.Timeout | null = null
  private lastHealthCheck: HealthCheckResult | null = null
  private alertCallbacks: Array<(alert: any) => void> = []

  private constructor() {}

  public static getInstance(): DatabaseHealthChecker {
    if (!DatabaseHealthChecker.instance) {
      DatabaseHealthChecker.instance = new DatabaseHealthChecker()
    }
    return DatabaseHealthChecker.instance
  }

  // 启动定期健康检查
  public startPeriodicChecks(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    console.log(`🏥 启动数据库健康检查，间隔: ${intervalMs / 1000}秒`)

    this.checkInterval = setInterval(async () => {
      try {
        const result = await this.performHealthCheck()
        this.processHealthCheckResult(result)
      } catch (error) {
        console.error('❌ 健康检查执行失败:', error)
      }
    }, intervalMs)

    // 立即执行一次检查
    this.performHealthCheck().then(result => {
      this.processHealthCheckResult(result)
    }).catch(error => {
      console.error('❌ 初始健康检查失败:', error)
    })
  }

  // 停止定期健康检查
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('🛑 数据库健康检查已停止')
    }
  }

  // 执行完整的健康检查
  public async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date()
    const alerts: Array<any> = []
    const recommendations: string[] = []

    try {
      // 1. 数据库连接检查
      const databaseCheck = await this.checkDatabaseConnection()
      
      // 2. 连接池状态检查
      const connectionPoolCheck = await this.checkConnectionPool()
      
      // 3. 连接泄漏检查
      const leakDetectionCheck = this.checkLeakDetection()
      
      // 4. 性能指标检查
      const performanceCheck = await this.checkPerformanceMetrics()

      // 生成告警和建议
      this.generateAlertsAndRecommendations(
        { databaseCheck, connectionPoolCheck, leakDetectionCheck, performanceCheck },
        alerts,
        recommendations
      )

      const result: HealthCheckResult = {
        healthy: databaseCheck.connected && 
                connectionPoolCheck.healthy && 
                leakDetectionCheck.healthy && 
                performanceCheck.healthy,
        timestamp,
        checks: {
          database: databaseCheck,
          connectionPool: connectionPoolCheck,
          leakDetection: leakDetectionCheck,
          performance: performanceCheck
        },
        recommendations,
        alerts
      }

      this.lastHealthCheck = result
      return result

    } catch (error) {
      console.error('❌ 健康检查失败:', error)
      
      return {
        healthy: false,
        timestamp,
        checks: {
          database: { connected: false, responseTime: 0, error: error instanceof Error ? error.message : '未知错误' },
          connectionPool: { healthy: false, stats: { activeConnections: 0, idleConnections: 0, totalConnections: 0, usagePercentage: 0 }, issues: ['健康检查失败'] },
          leakDetection: { healthy: false, stats: { activeOperations: 0, longestRunningOperation: null, averageDuration: 0 } },
          performance: { healthy: false, metrics: { avgQueryTime: 0, slowQueries: 0, longRunningTransactions: 0 } }
        },
        recommendations: ['系统出现严重问题，请立即检查'],
        alerts: [{
          level: 'critical',
          message: `健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp
        }]
      }
    }
  }

  // 检查数据库连接
  private async checkDatabaseConnection(): Promise<any> {
    const startTime = Date.now()
    
    try {
      const prisma = await getPrismaClient()
      await prisma.$queryRaw`SELECT 1 as health_check`
      const responseTime = Date.now() - startTime

      return {
        connected: true,
        responseTime
      }
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : '连接失败'
      }
    }
  }

  // 检查连接池状态
  private async checkConnectionPool(): Promise<any> {
    try {
      const healthCheck = await dbConnectionManager.healthCheck()
      const stats = healthCheck.stats
      
      return {
        healthy: healthCheck.healthy,
        stats: {
          activeConnections: stats.activeConnections,
          idleConnections: stats.idleConnections,
          totalConnections: stats.totalConnections,
          usagePercentage: Math.round((stats.activeConnections / stats.totalConnections) * 100)
        },
        issues: healthCheck.issues
      }
    } catch (error) {
      return {
        healthy: false,
        stats: { activeConnections: 0, idleConnections: 0, totalConnections: 0, usagePercentage: 0 },
        issues: ['连接池检查失败']
      }
    }
  }

  // 检查连接泄漏
  private checkLeakDetection(): any {
    try {
      const stats = connectionLeakDetector.getLeakStats()
      
      return {
        healthy: stats.activeOperations < 30, // 活跃操作少于30个认为健康
        stats
      }
    } catch (error) {
      return {
        healthy: false,
        stats: { activeOperations: 0, longestRunningOperation: null, averageDuration: 0 }
      }
    }
  }

  // 检查性能指标
  private async checkPerformanceMetrics(): Promise<any> {
    try {
      const prisma = await getPrismaClient()
      
      // 获取慢查询和长事务信息
      const slowQueries = await prisma.$queryRaw`
        SELECT count(*) as slow_query_count
        FROM pg_stat_activity 
        WHERE (now() - query_start) > interval '5 seconds'
          AND state != 'idle'
          AND datname = current_database()
      ` as any[]

      const longTransactions = await prisma.$queryRaw`
        SELECT count(*) as long_transaction_count
        FROM pg_stat_activity 
        WHERE (now() - xact_start) > interval '1 minute'
          AND state != 'idle'
          AND datname = current_database()
      ` as any[]

      const slowQueryCount = parseInt(slowQueries[0]?.slow_query_count || '0')
      const longTransactionCount = parseInt(longTransactions[0]?.long_transaction_count || '0')

      return {
        healthy: slowQueryCount < 5 && longTransactionCount < 3,
        metrics: {
          avgQueryTime: 0, // 这里可以添加更详细的查询时间统计
          slowQueries: slowQueryCount,
          longRunningTransactions: longTransactionCount
        }
      }
    } catch (error) {
      return {
        healthy: false,
        metrics: { avgQueryTime: 0, slowQueries: 0, longRunningTransactions: 0 }
      }
    }
  }

  // 生成告警和建议
  private generateAlertsAndRecommendations(
    checks: any,
    alerts: Array<any>,
    recommendations: string[]
  ): void {
    const { databaseCheck, connectionPoolCheck, leakDetectionCheck, performanceCheck } = checks

    // 数据库连接告警
    if (!databaseCheck.connected) {
      alerts.push({
        level: 'critical',
        message: '数据库连接失败',
        timestamp: new Date()
      })
      recommendations.push('立即检查数据库服务状态和网络连接')
    } else if (databaseCheck.responseTime > 1000) {
      alerts.push({
        level: 'warning',
        message: `数据库响应缓慢: ${databaseCheck.responseTime}ms`,
        timestamp: new Date()
      })
      recommendations.push('检查数据库性能和网络延迟')
    }

    // 连接池告警
    if (connectionPoolCheck.stats.usagePercentage > 80) {
      alerts.push({
        level: 'warning',
        message: `连接池使用率过高: ${connectionPoolCheck.stats.usagePercentage}%`,
        timestamp: new Date()
      })
      recommendations.push('考虑增加连接池大小或优化查询性能')
    }

    // 连接泄漏告警
    if (leakDetectionCheck.stats.activeOperations > 20) {
      alerts.push({
        level: 'warning',
        message: `活跃数据库操作过多: ${leakDetectionCheck.stats.activeOperations}`,
        timestamp: new Date()
      })
      recommendations.push('检查是否存在连接泄漏或长时间运行的查询')
    }

    // 性能告警
    if (performanceCheck.metrics.slowQueries > 3) {
      alerts.push({
        level: 'warning',
        message: `慢查询过多: ${performanceCheck.metrics.slowQueries}`,
        timestamp: new Date()
      })
      recommendations.push('优化慢查询或添加适当的索引')
    }

    if (performanceCheck.metrics.longRunningTransactions > 1) {
      alerts.push({
        level: 'warning',
        message: `长时间运行的事务: ${performanceCheck.metrics.longRunningTransactions}`,
        timestamp: new Date()
      })
      recommendations.push('检查并优化长时间运行的事务')
    }
  }

  // 处理健康检查结果
  private processHealthCheckResult(result: HealthCheckResult): void {
    // 记录健康状态
    const status = result.healthy ? '✅ 健康' : '❌ 异常'
    console.log(`🏥 数据库健康检查 ${status}`)

    // 处理告警
    result.alerts.forEach(alert => {
      const emoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        critical: '🚨'
      }[alert.level]

      console.log(`${emoji} ${alert.level.toUpperCase()}: ${alert.message}`)
      
      // 触发告警回调
      this.alertCallbacks.forEach(callback => {
        try {
          callback(alert)
        } catch (error) {
          console.error('告警回调执行失败:', error)
        }
      })
    })

    // 显示建议
    if (result.recommendations.length > 0) {
      console.log('💡 建议:')
      result.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }
  }

  // 注册告警回调
  public onAlert(callback: (alert: any) => void): void {
    this.alertCallbacks.push(callback)
  }

  // 获取最后一次健康检查结果
  public getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck
  }
}

// 导出单例实例
export const databaseHealthChecker = DatabaseHealthChecker.getInstance()
