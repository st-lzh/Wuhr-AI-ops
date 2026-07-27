// Jenkins REST API 客户端
import { 
  JenkinsClientConfig, 
  JenkinsJob, 
  JenkinsBuild, 
  JenkinsJobParameter,
  JenkinsExecutionRequest,
  JenkinsExecutionResponse,
  JenkinsConnectionTest,
  JenkinsError,
  JenkinsJobExecuteRequest,
  JenkinsJobExecuteResponse
} from './types'
import { isEncryptedSecret, revealSecret } from '../crypto/encryption'

export class JenkinsClient {
  private baseUrl: string
  private auth?: string
  private timeout: number

  constructor(config: JenkinsClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // 移除末尾斜杠
    this.timeout = config.timeout || 30000

    // 设置认证
    if (config.username && config.token) {
      this.auth = Buffer.from(`${config.username}:${revealSecret(config.token)}`).toString('base64')
    }
  }

  // 构建请求头
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    if (this.auth) {
      headers['Authorization'] = `Basic ${this.auth}`
    }

    return headers
  }

  // 发送HTTP请求
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      const error: JenkinsError = {
        statusCode: response.status,
        message: response.statusText,
      }

      try {
        const errorData = await response.json()
        error.details = errorData
        error.message = errorData.message || error.message
      } catch {
        // 忽略JSON解析错误
      }

      throw error
    }

    // 如果响应为空，返回空对象
    if (response.status === 204) {
      return {} as T
    }

    return await response.json()
  }

  // 测试连接
  async testConnection(): Promise<JenkinsConnectionTest> {
    try {
      // 获取Jenkins版本信息
      const response = await this.request<any>('/api/json?pretty=true')
      
      // 获取作业数量
      const jobs = response.jobs ? response.jobs.length : 0
      
      return {
        success: true,
        version: response.version || 'Unknown',
        jobs,
        user: response.primaryView?.name || 'Unknown'
      }
    } catch (error) {
      console.error('Jenkins连接测试失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 获取所有作业列表
  async getJobs(): Promise<JenkinsJob[]> {
    try {
      const response = await this.request<{jobs: JenkinsJob[]}>('/api/json?tree=jobs[name,displayName,description,url,buildable,color,lastBuild[number,url,timestamp,result,duration],nextBuildNumber,inQueue,keepDependencies,healthReport[description,iconClassName,iconUrl,score]]')
      return response.jobs || []
    } catch (error) {
      console.error('获取Jenkins作业列表失败:', error)
      throw error
    }
  }

  // 获取指定作业详情
  async getJob(jobName: string): Promise<JenkinsJob> {
    try {
      const encodedJobName = encodeURIComponent(jobName)
      return await this.request<JenkinsJob>(`/job/${encodedJobName}/api/json`)
    } catch (error) {
      console.error(`获取Jenkins作业详情失败 (${jobName}):`, error)
      throw error
    }
  }

  // 获取作业参数
  async getJobParameters(jobName: string): Promise<JenkinsJobParameter[]> {
    try {
      const job = await this.getJob(jobName)
      const parameterActions = job.property?.filter(prop => 
        prop._class === 'hudson.model.ParametersDefinitionProperty'
      )

      if (parameterActions.length > 0) {
        return parameterActions[0].parameterDefinitions || []
      }

      return []
    } catch (error) {
      console.error(`获取Jenkins作业参数失败 (${jobName}):`, error)
      return []
    }
  }

  // 执行作业（单个）
  async buildJob(request: JenkinsExecutionRequest): Promise<JenkinsExecutionResponse> {
    try {
      console.log(`🔧 [Jenkins API] 准备执行作业: ${request.jobName}`)

      const encodedJobName = encodeURIComponent(request.jobName)
      let endpoint = `/job/${encodedJobName}/build`

      // 如果有参数，使用buildWithParameters端点
      if (request.parameters && Object.keys(request.parameters).length > 0) {
        endpoint = `/job/${encodedJobName}/buildWithParameters`
        console.log(`📝 [Jenkins API] 使用参数化构建端点: ${endpoint}`)
      } else {
        console.log(`🔧 [Jenkins API] 使用简单构建端点: ${endpoint}`)
      }

      const formData = new URLSearchParams()
      
      // 添加参数
      if (request.parameters) {
        Object.entries(request.parameters).forEach(([key, value]) => {
          formData.append(key, String(value))
        })
      }

      // 添加token（如果提供）
      if (request.token) {
        formData.append('token', request.token)
      }

      const fullUrl = `${this.baseUrl}${endpoint}`
      console.log(`🌐 [Jenkins API] 发送请求: POST ${fullUrl}`)
      console.log(`📋 [Jenkins API] 请求体:`, formData.toString())

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(this.timeout),
      })

      console.log(`📡 [Jenkins API] 响应状态: ${response.status} ${response.statusText}`)
      console.log(`📋 [Jenkins API] 响应头:`, Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const responseText = await response.text()
        console.error(`❌ [Jenkins API] 请求失败:`, {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        })
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText.substring(0, 200)}`)
      }

      // Jenkins返回的是201状态码，Location头包含队列URL
      const location = response.headers.get('Location')
      if (!location) {
        throw new Error('未获取到队列信息')
      }

      // 从队列URL中提取队列ID
      const queueIdMatch = location.match(/\/queue\/item\/(\d+)\//)
      const queueId = queueIdMatch ? parseInt(queueIdMatch[1]) : 0

      return {
        queueId,
        queueUrl: location
      }
    } catch (error) {
      console.error(`执行Jenkins作业失败 (${request.jobName}):`, error)
      throw error
    }
  }

  // 批量执行作业（支持多选和顺序）
  async buildJobs(request: JenkinsJobExecuteRequest): Promise<JenkinsJobExecuteResponse> {
    const results: JenkinsJobExecuteResponse['executions'] = []
    
    // 根据执行顺序排序作业
    const sortedJobs = request.jobs.map((jobName, index) => ({
      jobName,
      originalIndex: index,
      order: request.executionOrder?.[index] ?? index
    })).sort((a, b) => a.order - b.order)

    // 逐个执行作业
    for (const { jobName, order } of sortedJobs) {
      try {
        console.log(`🚀 [Jenkins客户端] 执行作业: ${jobName} (顺序: ${order})`)
        console.log(`📝 [Jenkins客户端] 作业参数:`, request.parameters)
        console.log(`🔗 [Jenkins客户端] Jenkins服务器: ${this.baseUrl}`)

        const result = await this.buildJob({
          jobName,
          parameters: request.parameters
        })

        console.log(`✅ [Jenkins客户端] 作业执行成功: ${jobName}`, {
          queueId: result.queueId,
          queueUrl: result.queueUrl
        })

        results.push({
          jobName,
          queueId: result.queueId,
          queueUrl: result.queueUrl,
          order,
          status: 'queued'
        })

        // 可选：添加延迟避免过快的连续请求
        if (sortedJobs.indexOf(sortedJobs.find(j => j.jobName === jobName)!) < sortedJobs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`❌ [Jenkins客户端] 执行作业失败 (${jobName}):`, error)

        // 提供更详细的错误信息
        let errorDetails = '未知错误'
        if (error instanceof Error) {
          errorDetails = error.message
          console.error(`❌ [Jenkins客户端] 错误详情:`, {
            message: error.message,
            stack: error.stack,
            name: error.name
          })
        } else if (typeof error === 'object' && error !== null) {
          errorDetails = JSON.stringify(error)
        }

        results.push({
          jobName,
          queueId: 0,
          queueUrl: '',
          order,
          status: 'failed',
          error: errorDetails
        })
      }
    }

    return { executions: results }
  }

  // 获取队列信息
  async getQueueItem(queueId: number): Promise<any> {
    try {
      return await this.request<any>(`/queue/item/${queueId}/api/json`)
    } catch (error) {
      console.error(`获取队列信息失败 (${queueId}):`, error)
      throw error
    }
  }

  // 取消尚未分配构建号的队列项
  async cancelQueueItem(queueId: number): Promise<void> {
    if (!Number.isInteger(queueId) || queueId <= 0) throw new Error('无效的 Jenkins 队列 ID')
    await this.request(`/queue/cancelItem?id=${queueId}`, { method: 'POST' })
  }

  // 获取构建详情
  async getBuild(jobName: string, buildNumber: number): Promise<JenkinsBuild> {
    try {
      const encodedJobName = encodeURIComponent(jobName)
      return await this.request<JenkinsBuild>(`/job/${encodedJobName}/${buildNumber}/api/json`)
    } catch (error) {
      console.error(`获取构建详情失败 (${jobName}#${buildNumber}):`, error)
      throw error
    }
  }

  // 获取构建日志
  async getBuildLog(jobName: string, buildNumber: number): Promise<string> {
    try {
      const encodedJobName = encodeURIComponent(jobName)
      const response = await fetch(`${this.baseUrl}/job/${encodedJobName}/${buildNumber}/consoleText`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.text()
    } catch (error) {
      console.error(`获取构建日志失败 (${jobName}#${buildNumber}):`, error)
      throw error
    }
  }

  // 停止构建
  async stopBuild(jobName: string, buildNumber: number): Promise<void> {
    try {
      const encodedJobName = encodeURIComponent(jobName)
      await this.request(`/job/${encodedJobName}/${buildNumber}/stop`, {
        method: 'POST'
      })
    } catch (error) {
      console.error(`停止构建失败 (${jobName}#${buildNumber}):`, error)
      throw error
    }
  }
}

// 工厂函数：从Jenkins配置创建客户端
export function createJenkinsClient(config: {
  jobUrl: string
  authToken?: string
}): JenkinsClient {
  // 从jobUrl提取baseUrl
  const url = new URL(config.jobUrl)
  const baseUrl = `${url.protocol}//${url.host}`
  
  // 解析认证信息
  let username: string | undefined
  let token: string | undefined
  
  if (config.authToken) {
    // 支持格式：username:token 或 直接token
    if (isEncryptedSecret(config.authToken)) {
      token = revealSecret(config.authToken)
    } else if (config.authToken.includes(':')) {
      const separator = config.authToken.indexOf(':')
      username = config.authToken.slice(0, separator)
      token = revealSecret(config.authToken.slice(separator + 1))
    } else {
      token = revealSecret(config.authToken)
    }
  }

  return new JenkinsClient({
    baseUrl,
    username,
    token,
    timeout: 30000
  })
}
