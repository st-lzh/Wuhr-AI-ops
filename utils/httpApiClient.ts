
/**
 * kubelet-wuhrai HTTP API 客户端
 * 用于替换SSH调用，直接与kubelet-wuhrai HTTP服务器通信
 */

// HTTP API请求接口
export interface HTTPQueryRequest {
  query: string
  sessionId?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  isK8sMode?: boolean // 🔥 关键：添加K8s模式参数
  customTools?: any[]
  mcpServers?: Array<{
    name: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    url?: string
  }>
  config?: {
    provider?: string
    model?: string
    apiKey?: string
    baseUrl?: string
    hostId?: string
    maxIterations?: number
    streamingOutput?: boolean
    isK8sMode?: boolean // 🔥 关键：config中也要包含
    mcpClientEnabled?: boolean
    requireApproval?: boolean
    batchMode?: boolean
    batchHosts?: Array<{
      id: string
      name: string
      hostname?: string
      ip: string
      port: number
      username: string
      password?: string
      keyPath?: string
      authType: string
      tags?: string[]
    }>
    networkDeviceIds?: string[]
    networkBatchLabel?: string
    networkActor?: string
  }
}

// HTTP API响应接口 - 与后端QueryResponse结构匹配
export interface HTTPQueryResponse {
  sessionId: string
  success: boolean
  data?: string
  message?: string
  error?: string
  code?: string
  timestamp: string
  blocks?: Array<{
    type: string
    index: number
    text?: string
    description?: string
    result?: any
    color?: string
  }>
  metadata?: any
}

// 流式数据接口
export interface StreamData {
  type: 'text' | 'command' | 'output' | 'error' | 'done' | 'thinking' | 'connection' | 'command_approval_request' | 'command_approved' | 'command_rejected'
  content: string
  timestamp: string
  metadata?: any
  approvalId?: string
  command?: string
  description?: string
  tool?: string
  reason?: string
}

// 流式回调接口
export interface StreamCallbacks {
  onData: (data: StreamData) => void
  onError: (error: string) => void
  onComplete: () => void
}

// HTTP API客户端配置
export interface HTTPApiClientConfig {
  baseUrl: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  maxRetryDelay?: number
  enableAutoReconnect?: boolean
  reconnectAttempts?: number
}

/**
 * 后端 admin API key 注入：启用 --http-auth 后所有 /api/* 必须带这个 header
 * 仅 server-side 可用（process.env.IMPROVE_API_KEY 不带 NEXT_PUBLIC_ 前缀，不会泄到浏览器）
 */
function authHeader(): Record<string, string> {
  const key = typeof process !== 'undefined' ? process.env?.IMPROVE_API_KEY : undefined
  return key ? { 'X-API-Key': key } : {}
}

/**
 * kubelet-wuhrai HTTP API 客户端类
 */
export class HTTPApiClient {
  private config: HTTPApiClientConfig
  private defaultTimeout = 180000 // 180秒默认超时（增加60秒）
  private connectionState: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected'
  private reconnectAttempt = 0
  private heartbeatInterval: NodeJS.Timeout | null = null
  private lastHeartbeat: number = 0
  private connectionStartTime: number = 0

  constructor(config: HTTPApiClientConfig) {
    this.config = {
      timeout: this.defaultTimeout,
      retryAttempts: 3,
      retryDelay: 2000, // 增加重试延迟到2秒
      maxRetryDelay: 60000, // 增加最大延迟到60秒
      enableAutoReconnect: true,
      reconnectAttempts: 8, // 增加重连尝试次数到8次
      ...config
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): string {
    return this.connectionState
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.stopHeartbeat() // 确保没有重复的心跳
    this.heartbeatInterval = setInterval(() => {
      this.lastHeartbeat = Date.now()
    }, 5000) // 每5秒更新一次心跳
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 健康检查
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    const response = await this.makeRequest('/api/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
    })

    if (!response.ok) {
      throw new Error(`健康检查失败: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * 执行查询（非流式）
   */
  async query(request: HTTPQueryRequest): Promise<HTTPQueryResponse> {
    console.log('🔍 执行HTTP API查询:', {
      query: request.query.substring(0, 100) + (request.query.length > 100 ? '...' : ''),
      isK8sMode: request.isK8sMode,
      configIsK8sMode: request.config?.isK8sMode
    })

    const response = await this.makeRequest('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`查询失败: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ HTTP API查询完成:', {
      success: result.success,
      dataLength: result.data?.length || 0,
      sessionId: result.sessionId
    })

    return result
  }

  /**
   * 执行流式查询
   */
  async stream(request: HTTPQueryRequest, callbacks: StreamCallbacks): Promise<void> {
    console.log('🌊 开始HTTP API流式查询:', {
      query: request.query.substring(0, 100) + (request.query.length > 100 ? '...' : ''),
      isK8sMode: request.isK8sMode,
      configIsK8sMode: request.config?.isK8sMode
    })

    // 🔥 对于流式请求使用15分钟超时（匹配后端10分钟批准超时 + 5分钟执行时间）
    const response = await this.makeRequest('/api/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...authHeader(),
      },
      body: JSON.stringify(request),
    }, 15 * 60 * 1000) // 🔥 15分钟超时用于流式请求

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`流式查询失败: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // 处理SSE流式响应
    await this.handleSSEStream(response, callbacks)
  }

  /**
   * 处理SSE流式响应（支持重连）
   */
  private async handleSSEStreamWithReconnect(
    response: Response,
    callbacks: StreamCallbacks,
    originalRequest: HTTPQueryRequest
  ): Promise<void> {
    return this.handleSSEStream(response, callbacks)
  }

  /**
   * 处理SSE流式响应
   */
  private async handleSSEStream(response: Response, callbacks: StreamCallbacks): Promise<void> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let hasReceivedData = false
    let isCompleted = false
    let lastProcessedContent = new Set<string>() // 防止重复处理相同内容
    let lastDataTime = Date.now()
    let dataCount = 0

    // 启动连接状态监控
    this.connectionState = 'connected'
    this.connectionStartTime = Date.now()
    this.lastHeartbeat = Date.now()
    this.startHeartbeat()

    console.log('🌊 开始处理SSE流式响应')

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('🔚 HTTP API流式传输完成', {
            hasReceivedData,
            isCompleted,
            dataCount,
            duration: Date.now() - this.connectionStartTime
          })
          // Only call onComplete if we haven't already processed a 'done' event
          if (hasReceivedData && !isCompleted) {
            isCompleted = true
            this.stopHeartbeat()
            callbacks.onComplete()
          }
          break
        }

        // 解码数据块
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        lastDataTime = Date.now()
        dataCount++

        // 处理SSE消息
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行

        for (const line of lines) {
          if (line.trim() === '') continue // 跳过空行

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (!jsonStr) continue

              const data = JSON.parse(jsonStr) as StreamData
              hasReceivedData = true

              // 创建内容唯一标识，防止重复处理
              // 🔥 对于command类型，需要包含result状态来区分第一次和第二次发送
              const hasResult = data.type === 'command' && data.metadata?.result ? ':with-result' : ''
              // 🔥 对于批准相关事件，使用approvalId作为唯一标识
              const approvalKey = (data.type === 'command_approval_request' || data.type === 'command_approved' || data.type === 'command_rejected') && data.approvalId
                ? `:${data.approvalId}`
                : ''
              const contentKey = `${data.type}:${data.content?.substring(0, 50) || ''}${hasResult}${approvalKey}`

              // 跳过connection事件和重复内容
              if (data.type === 'connection' || lastProcessedContent.has(contentKey)) {
                console.log('⏭️ 跳过重复内容:', contentKey)
                continue
              }

              lastProcessedContent.add(contentKey)

              // 更详细的数据接收日志
              if (dataCount % 10 === 0 || data.type === 'error' || data.type === 'done') {
                console.log('📨 收到SSE数据:', {
                  type: data.type,
                  contentLength: data.content?.length || 0,
                  dataCount,
                  timeSinceStart: Date.now() - this.connectionStartTime
                })
              }

              // 根据数据类型处理
              if (data.type === 'text' || data.type === 'command' || data.type === 'output' || data.type === 'thinking') {
                callbacks.onData(data)
              } else if (data.type === 'command_approval_request' || data.type === 'command_approved' || data.type === 'command_rejected') {
                // 🔥 命令批准相关事件 - 必须转发给前端
                console.log('🔐 [SSE转发] 命令批准事件:', data.type)
                callbacks.onData(data)
              } else if (data.type === 'error') {
                console.error('❌ 服务器错误:', data.content)
                if (!isCompleted) {
                  isCompleted = true
                  callbacks.onError(data.content)
                }
                return // 错误时直接返回，不继续处理
              } else if (data.type === 'done') {
                console.log('✅ 流式传输完成:', data.content)
                if (!isCompleted) {
                  isCompleted = true
                  callbacks.onData(data)
                  callbacks.onComplete()
                }
                return // 完成时直接返回
              } else if (data.type === 'connection') {
                // 跳过connection事件
                continue
              } else {
                // 兼容其他格式
                callbacks.onData(data)
              }
            } catch (parseError) {
              console.warn('⚠️ 解析SSE数据失败:', line, parseError)
              // 继续处理其他行，不因为单行解析失败而中断
            }
          } else if (line.startsWith('event: ')) {
            // 处理事件类型行，但主要依赖data中的type字段
            const eventType = line.slice(7).trim()
            if (eventType !== 'connection') {
              console.log('📡 SSE事件类型:', eventType)
            }
          }
        }
      }
    } catch (error) {
      console.error('💥 SSE流处理错误:', {
        error: error instanceof Error ? error.message : '未知错误',
        hasReceivedData,
        dataCount,
        connectionDuration: Date.now() - this.connectionStartTime,
        timeSinceLastData: Date.now() - lastDataTime
      })

      this.stopHeartbeat()
      this.connectionState = 'disconnected'

      if (!isCompleted) {
        isCompleted = true
        const errorMessage = error instanceof Error ? error.message : '流式传输错误'

        // 更详细的错误分类
        if (errorMessage.includes('terminated') || errorMessage.includes('closed')) {
          // 连接中断时，如果已经有数据，则认为是正常完成
          if (hasReceivedData && dataCount > 0) {
            console.log('🔌 连接中断，但已接收到数据，视为正常完成', {
              dataCount,
              duration: Date.now() - this.connectionStartTime
            })
            callbacks.onComplete()
          } else {
            console.log('🔌 连接中断且无有效数据')
            callbacks.onError('连接中断，未接收到完整数据')
          }
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
          console.log('⏰ 连接超时')
          callbacks.onError('连接超时，请检查网络状况')
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
          console.log('🌐 网络错误')
          callbacks.onError('网络连接失败，请检查网络设置')
        } else {
          console.log('❌ 其他错误:', errorMessage)
          callbacks.onError(errorMessage)
        }
      }
    } finally {
      try {
        reader.releaseLock()
      } catch (releaseError) {
        console.warn('⚠️ 释放reader锁失败:', releaseError)
      }
      this.stopHeartbeat()
    }
  }

  /**
   * 发起HTTP请求（带重试机制）
   * @param endpoint API端点
   * @param options 请求选项
   * @param customTimeout 自定义超时时间（毫秒），如果不提供则使用默认配置
   */
  private async makeRequest(endpoint: string, options: RequestInit, customTimeout?: number): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`
    let lastError: Error
    const timeout = customTimeout || this.config.timeout

    for (let attempt = 1; attempt <= (this.config.retryAttempts || 3); attempt++) {
      try {
        console.log(`🔗 HTTP请求 (尝试 ${attempt}/${this.config.retryAttempts}):`, endpoint, `超时: ${timeout}ms`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        return response

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('请求失败')
        console.warn(`⚠️ HTTP请求失败 (尝试 ${attempt}/${this.config.retryAttempts}):`, lastError.message)

        // 如果不是最后一次尝试，等待后重试
        if (attempt < (this.config.retryAttempts || 3)) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
        }
      }
    }

    throw lastError!
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.health()
      return true
    } catch (error) {
      console.error('连接测试失败:', error)
      return false
    }
  }
}

/**
 * 创建HTTP API客户端实例
 */
export function createHTTPApiClient(hostInfo: {
  ip: string
  port?: number
}): HTTPApiClient {
  const port = hostInfo.port || 2081 // 默认使用2081端口
  const baseUrl = `http://${hostInfo.ip}:${port}`
  
  return new HTTPApiClient({
    baseUrl,
    timeout: 120000, // 120秒超时
    retryAttempts: 3,
    retryDelay: 1000
  })
}

/**
 * 便捷函数：执行HTTP API查询
 */
export async function executeHTTPQuery(
  hostInfo: { ip: string; port?: number },
  request: HTTPQueryRequest
): Promise<HTTPQueryResponse> {
  const client = createHTTPApiClient(hostInfo)
  return await client.query(request)
}

/**
 * 便捷函数：执行HTTP API流式查询
 */
export async function executeHTTPStream(
  hostInfo: { ip: string; port?: number },
  request: HTTPQueryRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const client = createHTTPApiClient(hostInfo)
  return await client.stream(request, callbacks)
}

/**
 * 🔥 批准命令执行 - 通过Next.js API路由代理
 */
export async function approveCommand(
  hostInfo: { ip: string; port?: number },
  approvalId: string
): Promise<{ success: boolean; message?: string }> {
  // 🔥 使用Next.js API路由避免CORS问题
  const response = await fetch(`/api/approval/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      approvalId,
      hostInfo
    }),
  })

  if (!response.ok) {
    throw new Error(`批准命令失败: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * 🔥 拒绝命令执行 - 通过Next.js API路由代理
 */
export async function rejectCommand(
  hostInfo: { ip: string; port?: number },
  approvalId: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  // 🔥 使用Next.js API路由避免CORS问题
  const response = await fetch(`/api/approval/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      approvalId,
      hostInfo,
      reason: reason || '用户拒绝',
    }),
  })

  if (!response.ok) {
    throw new Error(`拒绝命令失败: ${response.statusText}`)
  }

  return await response.json()
}
