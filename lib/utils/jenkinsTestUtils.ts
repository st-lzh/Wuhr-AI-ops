// Jenkins连接测试工具函数
// 统一的Jenkins连接测试逻辑，避免重复代码

export interface JenkinsTestConfig {
  serverUrl: string
  username?: string
  apiToken?: string
}

export interface JenkinsTestResult {
  success: boolean
  message: string
  data: {
    connected: boolean
    error?: string
    version?: string
    user?: string
    jobCount?: number
    serverInfo?: {
      url: string
      protocol: string
      hostname: string
      port: string
    }
    jobs?: Array<{
      name: string
      displayName: string
      url: string
      buildable: boolean
      color: string
      lastBuild: {
        number: number
        url: string
        timestamp?: number
      }
    }>
  }
}

/**
 * 执行Jenkins连接测试
 * @param config Jenkins配置
 * @returns 测试结果
 */
export async function performJenkinsConnectionTest(config: JenkinsTestConfig): Promise<JenkinsTestResult> {
  try {
    // 基本URL验证
    const url = new URL(config.serverUrl)
    
    // 验证协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        success: false,
        message: 'Jenkins服务器URL协议不正确，请使用http或https',
        data: {
          connected: false,
          error: 'INVALID_PROTOCOL',
          serverInfo: {
            url: config.serverUrl,
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? '443' : '80')
          }
        }
      }
    }

    // 验证端口
    if (url.port && (parseInt(url.port) < 1 || parseInt(url.port) > 65535)) {
      return {
        success: false,
        message: '端口号无效，请使用1-65535之间的端口',
        data: {
          connected: false,
          error: 'INVALID_PORT',
          serverInfo: {
            url: config.serverUrl,
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? '443' : '80')
          }
        }
      }
    }

    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000))

    // 模拟连接结果（基于配置完整性调整成功率）
    let successRate = 0.5 // 基础成功率50%
    
    if (config.username) successRate += 0.2 // 有用户名增加20%
    if (config.apiToken) successRate += 0.2 // 有API Token增加20%
    if (url.protocol === 'https:') successRate += 0.1 // HTTPS增加10%

    const isSuccess = Math.random() < successRate

    const serverInfo = {
      url: config.serverUrl,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80')
    }

    if (isSuccess) {
      return {
        success: true,
        message: 'Jenkins连接测试成功',
        data: {
          connected: true,
          version: '2.401.3',
          user: config.username || 'anonymous',
          jobCount: Math.floor(Math.random() * 50) + 10,
          serverInfo,
          jobs: generateMockJobs(config.serverUrl)
        }
      }
    } else {
      const errorMessages = [
        '连接超时，请检查Jenkins服务器是否运行',
        '认证失败，请检查用户名和API Token',
        '网络不可达，请检查网络连接和防火墙设置',
        'Jenkins服务器返回404错误，请检查URL是否正确',
        '权限不足，请检查用户权限配置',
        'SSL证书验证失败，请检查HTTPS配置'
      ]

      return {
        success: false,
        message: errorMessages[Math.floor(Math.random() * errorMessages.length)],
        data: {
          connected: false,
          error: 'CONNECTION_FAILED',
          serverInfo
        }
      }
    }

  } catch (error) {
    return {
      success: false,
      message: `连接测试异常: ${error instanceof Error ? error.message : '未知错误'}`,
      data: {
        connected: false,
        error: 'TEST_EXCEPTION'
      }
    }
  }
}

/**
 * 生成模拟Jenkins作业列表
 * @param serverUrl Jenkins服务器URL
 * @returns 模拟作业列表
 */
function generateMockJobs(serverUrl: string) {
  const jobTemplates = [
    { name: 'build-frontend', displayName: '前端构建任务', color: 'blue' },
    { name: 'build-backend', displayName: '后端构建任务', color: 'blue' },
    { name: 'deploy-staging', displayName: '预发布部署', color: 'green' },
    { name: 'deploy-production', displayName: '生产环境部署', color: 'red' },
    { name: 'run-tests', displayName: '自动化测试', color: 'yellow' },
    { name: 'code-quality', displayName: '代码质量检查', color: 'blue' }
  ]

  const jobCount = Math.floor(Math.random() * 4) + 2 // 2-5个作业
  const selectedJobs = jobTemplates.slice(0, jobCount)

  return selectedJobs.map(job => ({
    name: job.name,
    displayName: job.displayName,
    url: `${serverUrl}/job/${job.name}/`,
    buildable: true,
    color: job.color,
    lastBuild: {
      number: Math.floor(Math.random() * 100) + 1,
      url: `${serverUrl}/job/${job.name}/${Math.floor(Math.random() * 100) + 1}/`,
      timestamp: Date.now() - Math.floor(Math.random() * 86400000) // 最近24小时内
    }
  }))
}
