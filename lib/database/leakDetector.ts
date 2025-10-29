import { PrismaClient } from '../generated/prisma'
import { getPrismaClient } from '../config/database'

// 连接泄漏检测器
export class ConnectionLeakDetector {
  private static instance: ConnectionLeakDetector
  private activeOperations: Map<string, {
    startTime: number
    operationName: string
    stackTrace: string
    timeout?: NodeJS.Timeout
  }> = new Map()
  
  private leakThreshold = 60000 // 1分钟
  private maxActiveOperations = 50
  private detectionInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.startLeakDetection()
  }

  public static getInstance(): ConnectionLeakDetector {
    if (!ConnectionLeakDetector.instance) {
      ConnectionLeakDetector.instance = new ConnectionLeakDetector()
    }
    return ConnectionLeakDetector.instance
  }

  // 注册数据库操作
  public registerOperation(operationId: string, operationName: string): void {
    const stackTrace = new Error().stack || 'No stack trace available'
    
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      operationName,
      stackTrace,
      timeout: setTimeout(() => {
        this.reportPotentialLeak(operationId)
      }, this.leakThreshold)
    })

    // 检查是否超过最大活跃操作数
    if (this.activeOperations.size > this.maxActiveOperations) {
      console.warn(`⚠️ 活跃数据库操作过多: ${this.activeOperations.size}/${this.maxActiveOperations}`)
      this.reportActiveOperations()
    }
  }

  // 注销数据库操作
  public unregisterOperation(operationId: string): void {
    const operation = this.activeOperations.get(operationId)
    if (operation) {
      if (operation.timeout) {
        clearTimeout(operation.timeout)
      }
      this.activeOperations.delete(operationId)
    }
  }

  // 报告潜在的连接泄漏
  private reportPotentialLeak(operationId: string): void {
    const operation = this.activeOperations.get(operationId)
    if (!operation) return

    const duration = Date.now() - operation.startTime
    console.error(`🚨 检测到潜在的连接泄漏:`)
    console.error(`  操作ID: ${operationId}`)
    console.error(`  操作名称: ${operation.operationName}`)
    console.error(`  运行时间: ${Math.round(duration / 1000)}秒`)
    console.error(`  调用栈:`)
    console.error(operation.stackTrace)

    // 可以在这里添加更多的处理逻辑，比如发送告警
    this.sendLeakAlert(operationId, operation, duration)
  }

  // 发送泄漏告警
  private async sendLeakAlert(operationId: string, operation: any, duration: number): Promise<void> {
    try {
      // 这里可以集成告警系统，比如发送邮件、Slack消息等
      console.log(`📧 发送连接泄漏告警: ${operationId}`)
      
      // 记录到数据库（如果数据库可用）
      const prisma = await getPrismaClient()
      await prisma.systemLog.create({
        data: {
          level: 'error',
          category: 'DATABASE',
          message: `连接泄漏检测: ${operation.operationName}`,
          details: {
            operationId,
            operationName: operation.operationName,
            duration,
            stackTrace: operation.stackTrace
          },
          // createdAt: new Date() // 自动生成
        }
      }).catch(error => {
        console.warn('无法记录泄漏日志到数据库:', error)
      })
    } catch (error) {
      console.error('发送泄漏告警失败:', error)
    }
  }

  // 报告当前活跃操作
  private reportActiveOperations(): void {
    console.log(`📊 当前活跃的数据库操作 (${this.activeOperations.size}):`)
    
    const sortedOperations = Array.from(this.activeOperations.entries())
      .sort(([, a], [, b]) => a.startTime - b.startTime)
    
    sortedOperations.forEach(([operationId, operation]) => {
      const duration = Date.now() - operation.startTime
      console.log(`  ${operationId}: ${operation.operationName} (${Math.round(duration / 1000)}s)`)
    })
  }

  // 启动泄漏检测
  private startLeakDetection(): void {
    this.detectionInterval = setInterval(() => {
      this.performLeakDetection()
    }, 30000) // 每30秒检查一次
  }

  // 执行泄漏检测
  private performLeakDetection(): void {
    const now = Date.now()
    const longRunningOperations: string[] = []

    for (const entry of Array.from(this.activeOperations.entries())) {
      const [operationId, operation] = entry
      const duration = now - operation.startTime
      
      if (duration > this.leakThreshold) {
        longRunningOperations.push(operationId)
      }
    }

    if (longRunningOperations.length > 0) {
      console.warn(`⚠️ 发现 ${longRunningOperations.length} 个长时间运行的数据库操作`)
      this.reportActiveOperations()
    }

    // 清理超时的操作记录
    this.cleanupStaleOperations()
  }

  // 清理过期的操作记录
  private cleanupStaleOperations(): void {
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5分钟

    for (const entry of Array.from(this.activeOperations.entries())) {
      const [operationId, operation] = entry
      if (now - operation.startTime > staleThreshold) {
        console.warn(`🧹 清理过期操作记录: ${operationId}`)
        this.unregisterOperation(operationId)
      }
    }
  }

  // 获取泄漏检测统计
  public getLeakStats(): {
    activeOperations: number
    longestRunningOperation: {
      id: string
      name: string
      duration: number
    } | null
    averageDuration: number
  } {
    const now = Date.now()
    let longestDuration = 0
    let longestOperation: { id: string; name: string; duration: number } | null = null
    let totalDuration = 0

    for (const entry of Array.from(this.activeOperations.entries())) {
      const [operationId, operation] = entry
      const duration = now - operation.startTime
      totalDuration += duration

      if (duration > longestDuration) {
        longestDuration = duration
        longestOperation = {
          id: operationId,
          name: operation.operationName,
          duration
        }
      }
    }

    return {
      activeOperations: this.activeOperations.size,
      longestRunningOperation: longestOperation,
      averageDuration: this.activeOperations.size > 0 ? totalDuration / this.activeOperations.size : 0
    }
  }

  // 强制清理所有操作
  public forceCleanup(): void {
    console.log(`🧹 强制清理所有活跃操作 (${this.activeOperations.size} 个)`)
    
    for (const entry of Array.from(this.activeOperations.entries())) {
      const [, operation] = entry
      if (operation.timeout) {
        clearTimeout(operation.timeout)
      }
    }
    
    this.activeOperations.clear()
  }

  // 停止泄漏检测
  public stop(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
      this.detectionInterval = null
    }
    this.forceCleanup()
  }

  // 设置检测参数
  public configure(options: {
    leakThreshold?: number
    maxActiveOperations?: number
  }): void {
    if (options.leakThreshold) {
      this.leakThreshold = options.leakThreshold
    }
    if (options.maxActiveOperations) {
      this.maxActiveOperations = options.maxActiveOperations
    }
  }
}

// 导出单例实例
export const connectionLeakDetector = ConnectionLeakDetector.getInstance()

// 装饰器函数，用于自动检测连接泄漏
export function detectLeaks(operationName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      try {
        connectionLeakDetector.registerOperation(operationId, operationName)
        const result = await originalMethod.apply(this, args)
        return result
      } finally {
        connectionLeakDetector.unregisterOperation(operationId)
      }
    }

    return descriptor
  }
}

// 包装函数，用于检测数据库操作
export async function withLeakDetection<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  try {
    connectionLeakDetector.registerOperation(operationId, operationName)
    return await operation()
  } finally {
    connectionLeakDetector.unregisterOperation(operationId)
  }
}
