import fs from 'fs';
import path from 'path';

export interface ConnectionEvent {
  timestamp: Date;
  type: 'connect' | 'disconnect' | 'error' | 'timeout' | 'retry' | 'health_check';
  message: string;
  details?: any;
  duration?: number; // 毫秒
  connectionId?: string;
  query?: string;
  errorCode?: string;
}

export interface ConnectionAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metrics?: any;
  actionRequired?: string;
}

class ConnectionLogger {
  private static instance: ConnectionLogger;
  private logDir: string;
  private logFile: string;
  private alertFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  private constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'database');
    this.logFile = path.join(this.logDir, 'connections.log');
    this.alertFile = path.join(this.logDir, 'alerts.log');
    this.ensureLogDirectory();
  }

  public static getInstance(): ConnectionLogger {
    if (!ConnectionLogger.instance) {
      ConnectionLogger.instance = new ConnectionLogger();
    }
    return ConnectionLogger.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 记录连接事件
   */
  public logEvent(event: ConnectionEvent): void {
    const logEntry = {
      timestamp: event.timestamp.toISOString(),
      type: event.type,
      message: event.message,
      details: event.details,
      duration: event.duration,
      connectionId: event.connectionId,
      query: event.query ? this.sanitizeQuery(event.query) : undefined,
      errorCode: event.errorCode
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      // 检查日志文件大小，必要时轮转
      this.rotateLogIfNeeded();
      
      // 写入日志
      fs.appendFileSync(this.logFile, logLine);
      
      // 如果是错误事件，同时输出到控制台
      if (event.type === 'error') {
        console.error(`🔴 [DB] ${event.message}`, event.details);
      } else if (event.type === 'timeout') {
        console.warn(`⏰ [DB] ${event.message}`, event.details);
      }
      
    } catch (error) {
      console.error('❌ 写入连接日志失败:', error);
    }
  }

  /**
   * 记录告警
   */
  public logAlert(alert: ConnectionAlert): void {
    const alertEntry = {
      timestamp: alert.timestamp.toISOString(),
      level: alert.level,
      title: alert.title,
      message: alert.message,
      metrics: alert.metrics,
      actionRequired: alert.actionRequired
    };

    const alertLine = JSON.stringify(alertEntry) + '\n';
    
    try {
      fs.appendFileSync(this.alertFile, alertLine);
      
      // 根据级别输出到控制台
      const emoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        critical: '🚨'
      };
      
      console.log(`${emoji[alert.level]} [DB Alert] ${alert.title}: ${alert.message}`);
      
      if (alert.actionRequired) {
        console.log(`   👉 建议操作: ${alert.actionRequired}`);
      }
      
    } catch (error) {
      console.error('❌ 写入告警日志失败:', error);
    }
  }

  /**
   * 日志轮转
   */
  private rotateLogIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFile)) return;
      
      const stats = fs.statSync(this.logFile);
      if (stats.size < this.maxLogSize) return;
      
      // 轮转日志文件
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // 删除最老的文件
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // 重命名当前日志文件
      fs.renameSync(this.logFile, `${this.logFile}.1`);
      
    } catch (error) {
      console.error('❌ 日志轮转失败:', error);
    }
  }

  /**
   * 清理敏感信息的查询
   */
  private sanitizeQuery(query: string): string {
    // 移除密码等敏感信息
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/password\s*=\s*"[^"]*"/gi, 'password="***"')
      .replace(/\$\d+/g, '$?') // 替换参数占位符
      .substring(0, 500); // 限制长度
  }

  /**
   * 获取最近的连接事件
   */
  public getRecentEvents(count: number = 100): ConnectionEvent[] {
    try {
      if (!fs.existsSync(this.logFile)) return [];
      
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').slice(-count);
      
      return lines
        .filter(line => line.trim())
        .map(line => {
          try {
            const parsed = JSON.parse(line);
            return {
              ...parsed,
              timestamp: new Date(parsed.timestamp)
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as ConnectionEvent[];
        
    } catch (error) {
      console.error('❌ 读取连接事件失败:', error);
      return [];
    }
  }

  /**
   * 获取最近的告警
   */
  public getRecentAlerts(count: number = 50): ConnectionAlert[] {
    try {
      if (!fs.existsSync(this.alertFile)) return [];
      
      const content = fs.readFileSync(this.alertFile, 'utf8');
      const lines = content.trim().split('\n').slice(-count);
      
      return lines
        .filter(line => line.trim())
        .map(line => {
          try {
            const parsed = JSON.parse(line);
            return {
              ...parsed,
              timestamp: new Date(parsed.timestamp)
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as ConnectionAlert[];
        
    } catch (error) {
      console.error('❌ 读取告警失败:', error);
      return [];
    }
  }

  /**
   * 分析连接模式
   */
  public analyzeConnectionPatterns(): {
    errorRate: number;
    avgConnectionDuration: number;
    mostCommonErrors: Array<{ error: string; count: number }>;
    timeoutRate: number;
    retryRate: number;
  } {
    const events = this.getRecentEvents(1000);
    
    if (events.length === 0) {
      return {
        errorRate: 0,
        avgConnectionDuration: 0,
        mostCommonErrors: [],
        timeoutRate: 0,
        retryRate: 0
      };
    }

    const errorEvents = events.filter(e => e.type === 'error');
    const timeoutEvents = events.filter(e => e.type === 'timeout');
    const retryEvents = events.filter(e => e.type === 'retry');
    const connectEvents = events.filter(e => e.type === 'connect' && e.duration);

    // 计算错误率
    const errorRate = (errorEvents.length / events.length) * 100;
    const timeoutRate = (timeoutEvents.length / events.length) * 100;
    const retryRate = (retryEvents.length / events.length) * 100;

    // 计算平均连接时长
    const avgConnectionDuration = connectEvents.length > 0
      ? connectEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / connectEvents.length
      : 0;

    // 统计最常见的错误
    const errorCounts = new Map<string, number>();
    errorEvents.forEach(e => {
      const error = e.errorCode || e.message;
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      errorRate: Math.round(errorRate * 100) / 100,
      avgConnectionDuration: Math.round(avgConnectionDuration),
      mostCommonErrors,
      timeoutRate: Math.round(timeoutRate * 100) / 100,
      retryRate: Math.round(retryRate * 100) / 100
    };
  }

  /**
   * 生成连接报告
   */
  public generateReport(): string {
    const patterns = this.analyzeConnectionPatterns();
    const recentAlerts = this.getRecentAlerts(10);
    
    let report = '📊 数据库连接分析报告\n';
    report += `生成时间: ${new Date().toLocaleString()}\n\n`;
    
    report += '📈 连接统计:\n';
    report += `  错误率: ${patterns.errorRate}%\n`;
    report += `  超时率: ${patterns.timeoutRate}%\n`;
    report += `  重试率: ${patterns.retryRate}%\n`;
    report += `  平均连接时长: ${patterns.avgConnectionDuration}ms\n\n`;
    
    if (patterns.mostCommonErrors.length > 0) {
      report += '🔴 常见错误:\n';
      patterns.mostCommonErrors.forEach(({ error, count }) => {
        report += `  ${error}: ${count}次\n`;
      });
      report += '\n';
    }
    
    if (recentAlerts.length > 0) {
      report += '🚨 最近告警:\n';
      recentAlerts.slice(0, 5).forEach(alert => {
        report += `  [${alert.level.toUpperCase()}] ${alert.title}\n`;
        report += `    时间: ${alert.timestamp.toLocaleString()}\n`;
        report += `    消息: ${alert.message}\n`;
        if (alert.actionRequired) {
          report += `    建议: ${alert.actionRequired}\n`;
        }
        report += '\n';
      });
    }
    
    return report;
  }

  /**
   * 清理旧日志
   */
  public cleanupOldLogs(daysToKeep: number = 30): void {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      // 清理轮转的日志文件
      for (let i = 1; i <= this.maxLogFiles; i++) {
        const logFile = `${this.logFile}.${i}`;
        if (fs.existsSync(logFile)) {
          const stats = fs.statSync(logFile);
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(logFile);
            console.log(`🧹 已清理旧日志文件: ${logFile}`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 清理旧日志失败:', error);
    }
  }
}

// 导出单例实例
export const connectionLogger = ConnectionLogger.getInstance();

// 便捷函数
export const logConnectionEvent = (event: Omit<ConnectionEvent, 'timestamp'>) => {
  connectionLogger.logEvent({ ...event, timestamp: new Date() });
};

export const logConnectionAlert = (alert: Omit<ConnectionAlert, 'timestamp'>) => {
  connectionLogger.logAlert({ ...alert, timestamp: new Date() });
};
