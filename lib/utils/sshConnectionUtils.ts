// SSH连接工具函数
// 统一的SSH连接测试和管理逻辑，避免重复代码

// 延迟加载 SSH 客户端以避免在构建时加载原生模块
// import { SSHClient } from '../ssh/client'
import { SSHConnectionConfig, SSHConnectionResult } from '../../app/types/access-management'

/**
 * 执行SSH连接测试
 * @param config SSH连接配置
 * @param serverName 服务器名称（用于错误消息）
 * @returns 连接测试结果
 */
export async function performSSHConnectionTest(
  config: SSHConnectionConfig,
  serverName?: string
): Promise<SSHConnectionResult> {
  try {
    // 验证必要参数
    if (!config.host || !config.username) {
      return {
        success: false,
        message: '缺少必要的连接参数',
        connected: false,
        error: 'MISSING_PARAMS'
      }
    }

    // 验证认证信息
    const hasValidPassword = config.password && config.password.trim() !== ''
    const hasValidKeyPath = config.privateKey && config.privateKey.trim() !== ''

    if (!hasValidPassword && !hasValidKeyPath) {
      return {
        success: false,
        message: '缺少认证信息，必须提供密码或SSH密钥',
        connected: false,
        error: 'MISSING_AUTH'
      }
    }

    // 动态加载 SSH 客户端
    const { SSHClient } = await import('../ssh/client')

    // 创建SSH客户端
    const sshClient = new SSHClient({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey
    })

    try {
      // 执行连接测试
      await sshClient.connect()

      // 获取系统信息
      const systemInfo = await getSystemInfo(sshClient)

      const successMessage = serverName
        ? `主机 "${serverName}" 连接测试成功`
        : 'SSH连接测试成功'

      return {
        success: true,
        message: successMessage,
        connected: true,
        systemInfo,
        connectionTime: Date.now()
      }

    } catch (connectionError) {
      const errorMessage = serverName
        ? `主机 "${serverName}" 连接测试失败`
        : 'SSH连接测试失败'

      return {
        success: false,
        message: errorMessage,
        connected: false,
        error: connectionError instanceof Error ? connectionError.message : '未知连接错误'
      }
    } finally {
      // 确保连接被正确关闭
      try {
        await sshClient.disconnect()
      } catch (disconnectError) {
        console.warn('SSH连接关闭时出现警告:', disconnectError)
      }
    }

  } catch (error) {
    return {
      success: false,
      message: 'SSH连接测试异常',
      connected: false,
      error: error instanceof Error ? error.message : '未知异常'
    }
  }
}

/**
 * 获取系统信息
 * @param sshClient SSH客户端实例
 * @returns 系统信息对象
 */
async function getSystemInfo(sshClient: any): Promise<{
  uptime: string
  memory: string
  disk: string
} | undefined> {
  try {
    const [uptimeResult, memoryResult, diskResult] = await Promise.allSettled([
      sshClient.executeCommand('uptime'),
      sshClient.executeCommand('free -h'),
      sshClient.executeCommand('df -h /')
    ])

    return {
      uptime: uptimeResult.status === 'fulfilled' 
        ? uptimeResult.value.stdout?.trim() || '未知'
        : '获取失败',
      memory: memoryResult.status === 'fulfilled'
        ? memoryResult.value.stdout?.split('\n')[1]?.trim() || '未知'
        : '获取失败',
      disk: diskResult.status === 'fulfilled'
        ? diskResult.value.stdout?.split('\n')[1]?.trim() || '未知'
        : '获取失败'
    }
  } catch (error) {
    console.warn('获取系统信息失败:', error)
    return undefined
  }
}

/**
 * 验证SSH连接配置
 * @param config SSH连接配置
 * @returns 验证结果
 */
export function validateSSHConfig(config: Partial<SSHConnectionConfig>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.host) {
    errors.push('主机地址不能为空')
  }

  if (!config.username) {
    errors.push('用户名不能为空')
  }

  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('端口必须在1-65535之间')
  }

  // 验证IP格式（如果host是IP地址）
  if (config.host) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const isIP = ipRegex.test(config.host)
    
    if (isIP) {
      // 如果是IP地址，验证格式
      if (!ipRegex.test(config.host)) {
        errors.push('IP地址格式不正确')
      }
    }
    // 如果不是IP地址，假设是域名，不进行额外验证
  }

  const hasValidPassword = config.password && config.password.trim() !== ''
  const hasValidKeyPath = config.privateKey && config.privateKey.trim() !== ''

  if (!hasValidPassword && !hasValidKeyPath) {
    errors.push('必须提供密码或SSH密钥路径')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 创建SSH连接配置对象
 * @param params 连接参数
 * @returns SSH连接配置
 */
export function createSSHConfig(params: {
  host: string
  port?: number
  username: string
  password?: string
  privateKey?: string
}): SSHConnectionConfig {
  return {
    host: params.host,
    port: params.port || 22,
    username: params.username,
    password: params.password,
    privateKey: params.privateKey
  }
}

/**
 * 从服务器对象创建SSH连接配置
 * @param server 服务器对象
 * @returns SSH连接配置
 */
export function createSSHConfigFromServer(server: {
  ip: string
  port: number
  username: string
  password?: string | null
  keyPath?: string | null
}): SSHConnectionConfig {
  return {
    host: server.ip,
    port: server.port,
    username: server.username,
    password: server.password || undefined,
    privateKey: server.keyPath || undefined
  }
}
