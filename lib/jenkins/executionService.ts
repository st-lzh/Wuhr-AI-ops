// Jenkins任务执行服务
import { getPrismaClient } from '../config/database'

// 执行Jenkins任务的函数
export async function executeJenkinsJob(execution: any) {
  const prisma = await getPrismaClient()
  
  try {
    // 获取Jenkins配置
    const config = await prisma.jenkinsConfig.findUnique({
      where: { id: execution.configId }
    })

    if (!config) {
      throw new Error('Jenkins配置不存在')
    }

    // 构建Jenkins API URL
    const baseUrl = config.serverUrl.replace(/\/$/, '')
    const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64')
    
    let apiUrl: string
    let method: string = 'POST'
    
    // 根据操作类型构建不同的API URL
    switch (execution.operationType) {
      case 'build':
      case 'batch_build':
        apiUrl = `${baseUrl}/job/${encodeURIComponent(execution.jobName)}/build`
        break
      case 'enable':
      case 'batch_enable':
        apiUrl = `${baseUrl}/job/${encodeURIComponent(execution.jobName)}/enable`
        break
      case 'disable':
      case 'batch_disable':
        apiUrl = `${baseUrl}/job/${encodeURIComponent(execution.jobName)}/disable`
        break
      case 'delete':
      case 'batch_delete':
        apiUrl = `${baseUrl}/job/${encodeURIComponent(execution.jobName)}/doDelete`
        break
      default:
        throw new Error(`不支持的操作类型: ${execution.operationType}`)
    }

    // 发送请求到Jenkins
    const response = await fetch(apiUrl, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: execution.parameters ? new URLSearchParams(execution.parameters).toString() : undefined
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Jenkins API请求失败: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // 更新执行状态为完成
    await prisma.jenkinsJobExecution.update({
      where: { id: execution.id },
      data: { 
        status: 'completed',
        completedAt: new Date(),
        executionResult: {
          success: true,
          timestamp: new Date().toISOString(),
          response: response.status
        }
      }
    })

    console.log(`✅ Jenkins任务执行成功: ${execution.jobName} (${execution.operationType})`)
    
    return {
      success: true,
      status: response.status
    }
    
  } catch (error) {
    console.error(`❌ Jenkins任务执行失败: ${execution.jobName}`, error)
    
    // 更新执行状态为失败
    await prisma.jenkinsJobExecution.update({
      where: { id: execution.id },
      data: { 
        status: 'failed',
        completedAt: new Date(),
        executionResult: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      }
    })
    
    throw error
  }
}
