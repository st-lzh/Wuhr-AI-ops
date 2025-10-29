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

// 模拟项目创建过程的日志记录
export async function recordProjectCreationLogs(
  projectId: string, 
  userId: string, 
  projectData: any
): Promise<void> {
  try {
    // 开始创建
    addProjectLog(projectId, 'info', 'project_create', '开始创建项目...', { 
      step: 'start',
      userId 
    })
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 验证配置
    addProjectLog(projectId, 'info', 'validation', '验证项目配置...', { 
      step: 'validation',
      name: projectData.name,
      environment: projectData.environment
    })
    
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Git仓库检查
    if (projectData.repositoryUrl) {
      addProjectLog(projectId, 'info', 'git_validation', '检查Git仓库连接...', { 
        step: 'git_check',
        repository: projectData.repositoryUrl
      })
      
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      addProjectLog(projectId, 'success', 'git_validation', 'Git仓库连接成功', { 
        step: 'git_check',
        repository: projectData.repositoryUrl
      })
    }
    
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // 构建脚本配置
    if (projectData.buildScript) {
      addProjectLog(projectId, 'info', 'build_config', '配置构建脚本...', { 
        step: 'build_setup',
        hasScript: true
      })
      
      await new Promise(resolve => setTimeout(resolve, 400))
      
      addProjectLog(projectId, 'success', 'build_config', '构建脚本配置完成', { 
        step: 'build_setup',
        hasScript: true
      })
    }
    
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 部署脚本配置
    if (projectData.deployScript) {
      addProjectLog(projectId, 'info', 'deploy_config', '配置部署脚本...', { 
        step: 'deploy_setup',
        hasScript: true
      })
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      addProjectLog(projectId, 'success', 'deploy_config', '部署脚本配置完成', { 
        step: 'deploy_setup',
        hasScript: true
      })
    }
    
    await new Promise(resolve => setTimeout(resolve, 400))
    
    // 完成创建
    addProjectLog(projectId, 'success', 'project_create', '项目创建完成！', { 
      step: 'completed',
      projectId: projectId
    })
    
  } catch (error) {
    addProjectLog(projectId, 'error', 'project_create', `项目创建失败: ${error}`, { 
      step: 'error',
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
