// 简单的内存日志管理器
// 在生产环境中应该使用Redis或数据库

export interface ProjectLogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  action: string
  message: string
  details?: any
}

class ProjectLogManager {
  private static instance: ProjectLogManager
  private logs: Map<string, ProjectLogEntry[]> = new Map()
  private maxLogsPerProject = 1000

  private constructor() {}

  public static getInstance(): ProjectLogManager {
    if (!ProjectLogManager.instance) {
      ProjectLogManager.instance = new ProjectLogManager()
    }
    return ProjectLogManager.instance
  }

  // 添加日志
  addLog(projectId: string, log: Omit<ProjectLogEntry, 'timestamp'>): void {
    const logEntry: ProjectLogEntry = {
      ...log,
      timestamp: new Date().toISOString()
    }

    if (!this.logs.has(projectId)) {
      this.logs.set(projectId, [])
    }

    const projectLogs = this.logs.get(projectId)!
    projectLogs.push(logEntry)

    // 限制日志数量
    if (projectLogs.length > this.maxLogsPerProject) {
      projectLogs.splice(0, projectLogs.length - this.maxLogsPerProject)
    }

    console.log(`📝 [${projectId}] ${log.level.toUpperCase()}: ${log.message}`)
  }

  // 获取项目日志
  getLogs(projectId: string, lines?: number): ProjectLogEntry[] {
    const projectLogs = this.logs.get(projectId) || []
    
    if (lines && lines > 0) {
      return projectLogs.slice(-lines)
    }
    
    return [...projectLogs]
  }

  // 清空项目日志
  clearLogs(projectId: string): void {
    this.logs.delete(projectId)
  }

  // 获取所有项目的日志统计
  getStats(): { projectCount: number, totalLogs: number } {
    let totalLogs = 0
    this.logs.forEach((logs) => {
      totalLogs += logs.length
    })

    return {
      projectCount: this.logs.size,
      totalLogs
    }
  }
}

export const projectLogManager = ProjectLogManager.getInstance()

// 便捷的日志记录函数
export function addProjectLog(
  projectId: string, 
  level: ProjectLogEntry['level'], 
  action: string, 
  message: string, 
  details?: any
): void {
  projectLogManager.addLog(projectId, {
    level,
    action,
    message,
    details
  })
}

// 项目创建成功后写入持久化审计日志，不伪造并不存在的中间执行阶段。
export async function recordProjectCreationLogs(
  projectId: string, 
  userId: string, 
  projectData: any
): Promise<void> {
  const { getPrismaClient } = await import('../config/database')
  const prisma = await getPrismaClient()
  await prisma.systemLog.create({
    data: {
      level: 'info',
      category: 'cicd_project',
      message: `CI/CD 项目「${projectData.name}」创建成功`,
      source: 'project-api',
      userId,
      details: {
        projectId,
        environment: projectData.environment,
        repositoryType: projectData.repositoryType,
        hasBuildScript: Boolean(projectData.buildScript)
      }
    }
  })
}
