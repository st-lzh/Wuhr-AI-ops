import { PrismaClient } from '../generated/prisma'
import { getPrismaClient } from '../config/database'
import { connectionLeakDetector } from './leakDetector'

// 连接池状态监控
interface ConnectionPoolStats {
  activeConnections: number
  idleConnections: number
  totalConnections: number
  pendingRequests: number
  lastUpdate: Date
}

// 数据库操作包装器
export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager
  private connectionStats: ConnectionPoolStats = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    pendingRequests: 0,
    lastUpdate: new Date()
  }
  private operationTimeouts: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {
    // 启动连接池监控
    this.startConnectionMonitoring()
  }

  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager()
    }
    return DatabaseConnectionManager.instance
  }

  // 安全的数据库操作包装器
  public async withConnection<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    options: {
      timeout?: number
      operationName?: string
      retries?: number
    } = {}
  ): Promise<T> {
    const {
      timeout = 30000, // 30秒默认超时
      operationName = 'unknown',
      retries = 1
    } = options

    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`🔄 开始数据库操作: ${operationName} (ID: ${operationId})`)

    // 注册到泄漏检测器
    connectionLeakDetector.registerOperation(operationId, operationName)

    let attempt = 0
    while (attempt <= retries) {
      let prisma: PrismaClient | null = null
      let timeoutHandle: NodeJS.Timeout | null = null

      try {
        // 设置操作超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`数据库操作超时: ${operationName} (${timeout}ms)`))
          }, timeout)
        })

        // 获取数据库连接
        prisma = await getPrismaClient()
        
        // 更新连接统计
        this.updateConnectionStats()
        
        // 执行操作
        const operationPromise = operation(prisma)
        
        // 等待操作完成或超时
        const result = await Promise.race([operationPromise, timeoutPromise])
        
        console.log(`✅ 数据库操作成功: ${operationName} (ID: ${operationId})`)
        return result

      } catch (error) {
        attempt++
        console.error(`❌ 数据库操作失败 (尝试 ${attempt}/${retries + 1}): ${operationName}`, error)
        
        if (attempt > retries) {
          throw new Error(`数据库操作失败: ${operationName} - ${error instanceof Error ? error.message : '未知错误'}`)
        }
        
        // 重试前等待一段时间
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        
      } finally {
        // 清理超时定时器
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }

        // 清理操作记录
        this.operationTimeouts.delete(operationId)

        // 从泄漏检测器注销操作
        connectionLeakDetector.unregisterOperation(operationId)

        // 注意：不要在这里断开连接，因为我们使用的是连接池
        // 连接会自动返回到池中
      }
    }

    throw new Error(`数据库操作最终失败: ${operationName}`)
  }

  // 事务操作包装器
  public async withTransaction<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    options: {
      timeout?: number
      operationName?: string
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
    } = {}
  ): Promise<T> {
    const {
      timeout = 60000, // 事务默认60秒超时
      operationName = 'transaction',
      isolationLevel = 'ReadCommitted'
    } = options

    return this.withConnection(async (prisma) => {
      return await prisma.$transaction(async (tx) => {
        console.log(`🔄 开始事务: ${operationName}`)
        const result = await operation(tx as PrismaClient)
        console.log(`✅ 事务完成: ${operationName}`)
        return result
      }, {
        timeout,
        isolationLevel
      })
    }, { timeout, operationName: `transaction-${operationName}` })
  }

  // 批量操作包装器
  public async withBatch<T>(
    operations: Array<(prisma: PrismaClient) => Promise<T>>,
    options: {
      timeout?: number
      operationName?: string
      failFast?: boolean
    } = {}
  ): Promise<T[]> {
    const {
      timeout = 120000, // 批量操作默认2分钟超时
      operationName = 'batch',
      failFast = true
    } = options

    return this.withConnection(async (prisma) => {
      console.log(`🔄 开始批量操作: ${operationName} (${operations.length} 个操作)`)
      
      if (failFast) {
        // 快速失败模式：任何一个操作失败就停止
        const results: T[] = []
        for (let i = 0; i < operations.length; i++) {
          const result = await operations[i](prisma)
          results.push(result)
        }
        return results
      } else {
        // 并行执行所有操作
        return await Promise.all(operations.map(op => op(prisma)))
      }
    }, { timeout, operationName: `batch-${operationName}` })
  }

  // 连接池状态监控
  private startConnectionMonitoring(): void {
    setInterval(() => {
      this.updateConnectionStats()
      this.logConnectionStats()
      this.checkConnectionHealth()
    }, 30000) // 每30秒检查一次
  }

  private updateConnectionStats(): void {
    // 这里可以添加实际的连接池状态获取逻辑
    // 目前使用模拟数据
    this.connectionStats = {
      activeConnections: this.operationTimeouts.size,
      idleConnections: Math.max(0, 20 - this.operationTimeouts.size),
      totalConnections: 20,
      pendingRequests: 0,
      lastUpdate: new Date()
    }
  }

  private logConnectionStats(): void {
    const stats = this.connectionStats
    console.log(`📊 连接池状态: 活跃=${stats.activeConnections}, 空闲=${stats.idleConnections}, 总计=${stats.totalConnections}, 待处理=${stats.pendingRequests}`)
  }

  private checkConnectionHealth(): void {
    const stats = this.connectionStats
    
    // 检查连接池是否接近满载
    if (stats.activeConnections > stats.totalConnections * 0.8) {
      console.warn(`⚠️ 连接池使用率过高: ${stats.activeConnections}/${stats.totalConnections} (${Math.round(stats.activeConnections / stats.totalConnections * 100)}%)`)
    }
    
    // 检查是否有长时间运行的操作
    const now = Date.now()
    for (const entry of Array.from(this.operationTimeouts.entries())) {
      const [operationId, timeout] = entry
      const startTime = parseInt(operationId.split('-')[1])
      const duration = now - startTime
      
      if (duration > 60000) { // 超过1分钟的操作
        console.warn(`⚠️ 长时间运行的数据库操作: ${operationId} (${Math.round(duration / 1000)}秒)`)
      }
    }
  }

  // 获取连接池状态
  public getConnectionStats(): ConnectionPoolStats {
    return { ...this.connectionStats }
  }

  // 强制清理超时操作
  public cleanupTimeoutOperations(): void {
    const now = Date.now()
    const timeoutThreshold = 300000 // 5分钟

    for (const entry of Array.from(this.operationTimeouts.entries())) {
      const [operationId, timeout] = entry
      const startTime = parseInt(operationId.split('-')[1])
      if (now - startTime > timeoutThreshold) {
        console.warn(`🧹 清理超时操作: ${operationId}`)
        clearTimeout(timeout)
        this.operationTimeouts.delete(operationId)
      }
    }
  }

  // 健康检查
  public async healthCheck(): Promise<{
    healthy: boolean
    stats: ConnectionPoolStats
    issues: string[]
  }> {
    const stats = this.getConnectionStats()
    const issues: string[] = []
    
    // 检查连接池使用率
    if (stats.activeConnections > stats.totalConnections * 0.9) {
      issues.push('连接池使用率过高')
    }
    
    // 检查待处理请求
    if (stats.pendingRequests > 10) {
      issues.push('待处理请求过多')
    }
    
    // 尝试执行简单查询
    try {
      await this.withConnection(async (prisma) => {
        await prisma.$queryRaw`SELECT 1`
      }, { operationName: 'health-check', timeout: 5000 })
    } catch (error) {
      issues.push('数据库连接测试失败')
    }
    
    return {
      healthy: issues.length === 0,
      stats,
      issues
    }
  }
}

// 导出单例实例
export const dbConnectionManager = DatabaseConnectionManager.getInstance()

// 便捷的包装函数
export const withDbConnection = dbConnectionManager.withConnection.bind(dbConnectionManager)
export const withDbTransaction = dbConnectionManager.withTransaction.bind(dbConnectionManager)
export const withDbBatch = dbConnectionManager.withBatch.bind(dbConnectionManager)
