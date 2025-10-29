// CI/CD专用日志记录器
import { getPrismaClient } from '../config/database'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export enum LogCategory {
  PROJECT = 'project',
  PIPELINE = 'pipeline',
  BUILD = 'build',
  DEPLOYMENT = 'deployment',
  JENKINS = 'jenkins',
  APPROVAL = 'approval',
  SYSTEM = 'system'
}

export interface LogEntry {
  level: LogLevel
  category: LogCategory
  action: string
  message: string
  details?: any
  userId?: string
  resourceId?: string
  resourceType?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface AuditLogEntry extends LogEntry {
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

class CICDLogger {
  private static instance: CICDLogger
  private prisma: any

  private constructor() {
    this.initializePrisma()
  }

  public static getInstance(): CICDLogger {
    if (!CICDLogger.instance) {
      CICDLogger.instance = new CICDLogger()
    }
    return CICDLogger.instance
  }

  private async initializePrisma() {
    this.prisma = await getPrismaClient()
  }

  // 记录日志到控制台和数据库
  async log(entry: LogEntry): Promise<void> {
    const timestamp = new Date()
    const logMessage = this.formatLogMessage(entry, timestamp)

    // 控制台输出
    this.logToConsole(entry.level, logMessage)

    // 数据库存储（异步，不阻塞主流程）
    this.logToDatabase(entry, timestamp).catch(error => {
      console.error('❌ 日志存储失败:', error)
    })
  }

  // 记录审计日志
  async auditLog(entry: AuditLogEntry): Promise<void> {
    const timestamp = new Date()
    const logMessage = this.formatAuditLogMessage(entry, timestamp)

    // 控制台输出
    this.logToConsole(entry.level, logMessage)

    // 数据库存储
    this.logToDatabase(entry, timestamp).catch(error => {
      console.error('❌ 审计日志存储失败:', error)
    })
  }

  // 项目相关日志
  async logProject(action: string, message: string, options: {
    level?: LogLevel
    projectId?: string
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.PROJECT,
      action,
      message,
      details: options.details,
      userId: options.userId,
      resourceId: options.projectId,
      resourceType: 'project',
      timestamp: new Date()
    })
  }

  // 流水线相关日志
  async logPipeline(action: string, message: string, options: {
    level?: LogLevel
    pipelineId?: string
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.PIPELINE,
      action,
      message,
      details: options.details,
      userId: options.userId,
      resourceId: options.pipelineId,
      resourceType: 'pipeline',
      timestamp: new Date()
    })
  }

  // 构建相关日志
  async logBuild(action: string, message: string, options: {
    level?: LogLevel
    buildId?: string
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.BUILD,
      action,
      message,
      details: options.details,
      userId: options.userId,
      resourceId: options.buildId,
      resourceType: 'build',
      timestamp: new Date()
    })
  }

  // 部署相关日志
  async logDeployment(action: string, message: string, options: {
    level?: LogLevel
    deploymentId?: string
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.DEPLOYMENT,
      action,
      message,
      details: options.details,
      userId: options.userId,
      resourceId: options.deploymentId,
      resourceType: 'deployment',
      timestamp: new Date()
    })
  }

  // Jenkins相关日志
  async logJenkins(action: string, message: string, options: {
    level?: LogLevel
    jenkinsConfigId?: string
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.JENKINS,
      action,
      message,
      details: options.details,
      userId: options.userId,
      resourceId: options.jenkinsConfigId,
      resourceType: 'jenkins_config',
      timestamp: new Date()
    })
  }

  // 审批相关日志
  async logApproval(action: string, message: string, options: {
    level?: LogLevel
    approvalId?: string
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.APPROVAL,
      action,
      message,
      details: options.details,
      userId: options.userId,
      resourceId: options.approvalId,
      resourceType: 'approval',
      timestamp: new Date()
    })
  }

  // 系统相关日志
  async logSystem(action: string, message: string, options: {
    level?: LogLevel
    userId?: string
    details?: any
  } = {}) {
    await this.log({
      level: options.level || LogLevel.INFO,
      category: LogCategory.SYSTEM,
      action,
      message,
      details: options.details,
      userId: options.userId,
      timestamp: new Date()
    })
  }

  // 格式化日志消息
  private formatLogMessage(entry: LogEntry, timestamp: Date): string {
    const timeStr = timestamp.toISOString()
    const levelStr = entry.level.toUpperCase().padEnd(5)
    const categoryStr = entry.category.toUpperCase().padEnd(10)
    
    let message = `[${timeStr}] ${levelStr} [${categoryStr}] ${entry.action}: ${entry.message}`
    
    if (entry.resourceId) {
      message += ` (${entry.resourceType}:${entry.resourceId})`
    }
    
    if (entry.userId) {
      message += ` [user:${entry.userId}]`
    }

    return message
  }

  // 格式化审计日志消息
  private formatAuditLogMessage(entry: AuditLogEntry, timestamp: Date): string {
    let message = this.formatLogMessage(entry, timestamp)
    
    if (entry.ipAddress) {
      message += ` [ip:${entry.ipAddress}]`
    }
    
    if (entry.sessionId) {
      message += ` [session:${entry.sessionId}]`
    }

    return message
  }

  // 控制台输出
  private logToConsole(level: LogLevel, message: string): void {
    const emoji = this.getLevelEmoji(level)
    const coloredMessage = this.colorizeMessage(level, message)
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${emoji} ${coloredMessage}`)
        break
      case LogLevel.INFO:
        console.info(`${emoji} ${coloredMessage}`)
        break
      case LogLevel.WARN:
        console.warn(`${emoji} ${coloredMessage}`)
        break
      case LogLevel.ERROR:
        console.error(`${emoji} ${coloredMessage}`)
        break
    }
  }

  // 数据库存储
  private async logToDatabase(entry: LogEntry, timestamp: Date): Promise<void> {
    if (!this.prisma) {
      await this.initializePrisma()
    }

    try {
      // 这里可以存储到专门的日志表
      // 由于当前schema可能没有日志表，我们先存储到系统日志或者直接跳过
      // 在实际项目中，应该创建专门的日志表
      
      console.debug('📝 日志已记录:', {
        level: entry.level,
        category: entry.category,
        action: entry.action,
        message: entry.message,
        resourceId: entry.resourceId,
        userId: entry.userId,
        timestamp
      })
    } catch (error) {
      console.error('数据库日志存储失败:', error)
    }
  }

  // 获取级别对应的emoji
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍'
      case LogLevel.INFO:
        return '📝'
      case LogLevel.WARN:
        return '⚠️'
      case LogLevel.ERROR:
        return '❌'
      default:
        return '📝'
    }
  }

  // 着色消息（在支持的终端中）
  private colorizeMessage(level: LogLevel, message: string): string {
    // 简单的颜色支持，可以根据需要扩展
    return message
  }
}

// 导出单例实例
export const cicdLogger = CICDLogger.getInstance()

// 便捷方法
export const logProject = cicdLogger.logProject.bind(cicdLogger)
export const logPipeline = cicdLogger.logPipeline.bind(cicdLogger)
export const logBuild = cicdLogger.logBuild.bind(cicdLogger)
export const logDeployment = cicdLogger.logDeployment.bind(cicdLogger)
export const logJenkins = cicdLogger.logJenkins.bind(cicdLogger)
export const logApproval = cicdLogger.logApproval.bind(cicdLogger)
export const logSystem = cicdLogger.logSystem.bind(cicdLogger)
