import { databaseHealthChecker } from './healthChecker'
import { connectionLeakDetector } from './leakDetector'
import { dbConnectionManager } from './connectionManager'

// 数据库系统初始化
export class DatabaseSystemInitializer {
  private static initialized = false

  public static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('📊 数据库系统已初始化，跳过重复初始化')
      return
    }

    console.log('🚀 初始化数据库监控系统...')

    try {
      // 1. 配置连接泄漏检测器
      connectionLeakDetector.configure({
        leakThreshold: parseInt(process.env.DB_LEAK_THRESHOLD || '60000'),
        maxActiveOperations: parseInt(process.env.DB_MAX_ACTIVE_OPERATIONS || '50')
      })

      // 2. 启动健康检查器
      const healthCheckInterval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30') * 1000
      databaseHealthChecker.startPeriodicChecks(healthCheckInterval)

      // 3. 注册告警处理器
      databaseHealthChecker.onAlert((alert) => {
        this.handleDatabaseAlert(alert)
      })

      // 4. 执行初始健康检查
      const initialHealthCheck = await databaseHealthChecker.performHealthCheck()
      
      if (initialHealthCheck.healthy) {
        console.log('✅ 数据库系统健康检查通过')
      } else {
        console.warn('⚠️ 数据库系统存在健康问题:')
        initialHealthCheck.alerts.forEach(alert => {
          console.warn(`  - ${alert.level}: ${alert.message}`)
        })
      }

      // 5. 设置优雅关闭处理
      this.setupGracefulShutdown()

      this.initialized = true
      console.log('🎉 数据库监控系统初始化完成')

    } catch (error) {
      console.error('❌ 数据库监控系统初始化失败:', error)
      throw error
    }
  }

  // 处理数据库告警
  private static handleDatabaseAlert(alert: any): void {
    const timestamp = new Date().toISOString()
    
    switch (alert.level) {
      case 'critical':
        console.error(`🚨 [${timestamp}] CRITICAL: ${alert.message}`)
        // 这里可以集成告警系统，如发送邮件、Slack通知等
        this.sendCriticalAlert(alert)
        break
        
      case 'error':
        console.error(`❌ [${timestamp}] ERROR: ${alert.message}`)
        this.sendErrorAlert(alert)
        break
        
      case 'warning':
        console.warn(`⚠️ [${timestamp}] WARNING: ${alert.message}`)
        this.sendWarningAlert(alert)
        break
        
      case 'info':
        console.info(`ℹ️ [${timestamp}] INFO: ${alert.message}`)
        break
        
      default:
        console.log(`📝 [${timestamp}] ${alert.message}`)
    }
  }

  // 发送严重告警
  private static async sendCriticalAlert(alert: any): Promise<void> {
    try {
      // 这里可以集成实际的告警系统
      console.log('📧 发送严重告警通知...')
      
      // 示例：记录到系统日志
      await this.logToDatabase('CRITICAL', alert.message, alert)
      
      // 示例：发送到监控系统
      // await this.sendToMonitoringSystem(alert)
      
    } catch (error) {
      console.error('发送严重告警失败:', error)
    }
  }

  // 发送错误告警
  private static async sendErrorAlert(alert: any): Promise<void> {
    try {
      console.log('📧 发送错误告警通知...')
      await this.logToDatabase('ERROR', alert.message, alert)
    } catch (error) {
      console.error('发送错误告警失败:', error)
    }
  }

  // 发送警告告警
  private static async sendWarningAlert(alert: any): Promise<void> {
    try {
      console.log('📧 发送警告通知...')
      await this.logToDatabase('WARNING', alert.message, alert)
    } catch (error) {
      console.error('发送警告通知失败:', error)
    }
  }

  // 记录到数据库
  private static async logToDatabase(level: string, message: string, details: any): Promise<void> {
    try {
      await dbConnectionManager.withConnection(async (prisma) => {
        await prisma.systemLog.create({
          data: {
            level: level as any,
            category: 'DATABASE_HEALTH',
            message,
            details,
            // createdAt: new Date() // 自动生成
          }
        })
      }, {
        operationName: 'log-database-alert',
        timeout: 5000
      })
    } catch (error) {
      console.error('记录数据库日志失败:', error)
    }
  }

  // 设置优雅关闭
  private static setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`📡 收到 ${signal} 信号，正在关闭数据库监控系统...`)
      
      try {
        // 停止健康检查
        databaseHealthChecker.stopPeriodicChecks()
        
        // 停止连接泄漏检测
        connectionLeakDetector.stop()
        
        console.log('✅ 数据库监控系统已优雅关闭')
      } catch (error) {
        console.error('❌ 数据库监控系统关闭失败:', error)
      }
    }

    // 注册信号处理器
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('beforeExit', () => gracefulShutdown('beforeExit'))
  }

  // 获取系统状态
  public static getSystemStatus(): {
    initialized: boolean
    healthChecker: any
    leakDetector: any
  } {
    return {
      initialized: this.initialized,
      healthChecker: databaseHealthChecker.getLastHealthCheck(),
      leakDetector: connectionLeakDetector.getLeakStats()
    }
  }

  // 手动触发健康检查
  public static async triggerHealthCheck(): Promise<any> {
    if (!this.initialized) {
      throw new Error('数据库监控系统未初始化')
    }
    
    return await databaseHealthChecker.performHealthCheck()
  }

  // 强制清理资源
  public static forceCleanup(): void {
    console.log('🧹 强制清理数据库监控资源...')
    
    try {
      databaseHealthChecker.stopPeriodicChecks()
      connectionLeakDetector.forceCleanup()
      
      this.initialized = false
      console.log('✅ 数据库监控资源清理完成')
    } catch (error) {
      console.error('❌ 强制清理失败:', error)
    }
  }
}

// 便捷的初始化函数
export const initializeDatabaseSystem = DatabaseSystemInitializer.initialize.bind(DatabaseSystemInitializer)
export const getDatabaseSystemStatus = DatabaseSystemInitializer.getSystemStatus.bind(DatabaseSystemInitializer)
export const triggerDatabaseHealthCheck = DatabaseSystemInitializer.triggerHealthCheck.bind(DatabaseSystemInitializer)
export const cleanupDatabaseSystem = DatabaseSystemInitializer.forceCleanup.bind(DatabaseSystemInitializer)
