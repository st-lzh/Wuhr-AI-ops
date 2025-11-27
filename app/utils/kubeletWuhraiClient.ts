import { 
  KubeletWuhraiRequest, 
  KubeletWuhraiResponse, 
  ProviderType,
  TokenUsage,
  ToolCall 
} from '../types/api'

// kubelet-wuhrai CLI 客户端类 - 浏览器端版本
export class KubeletWuhraiClient {
  private static instance: KubeletWuhraiClient
  private apiEndpoint: string
  private baseUrl: string
  private defaultTimeout: number = 120000 // 120秒默认超时（kubelet-wuhrai可能需要更长时间）

  constructor() {
    // 检查运行环境，在服务端使用绝对URL
    const isServer = typeof window === 'undefined'
    this.baseUrl = isServer ? 'http://localhost:3000' : ''
    this.apiEndpoint = isServer
      ? 'http://localhost:3000/api/kubelet-wuhrai/chat'
      : '/api/kubelet-wuhrai/chat'
  }

  static getInstance(): KubeletWuhraiClient {
    if (!KubeletWuhraiClient.instance) {
      KubeletWuhraiClient.instance = new KubeletWuhraiClient()
    }
    return KubeletWuhraiClient.instance
  }

  // 执行kubelet-wuhrai命令
  async execute(request: KubeletWuhraiRequest, authToken?: string): Promise<KubeletWuhraiResponse> {
    try {


      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // 如果提供了认证token，添加到headers中
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.defaultTimeout),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result: KubeletWuhraiResponse = await response.json()
      
      console.log('✅ kubelet-wuhrai API 调用成功:', {
        success: result.success,
        responseLength: result.response?.length || 0,
        executionTime: result.metadata?.execution_time || 'unknown'
      })

      return result
    } catch (error) {
      console.error('❌ kubelet-wuhrai API 调用失败:', error)
      
      const errorResponse: KubeletWuhraiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString(),
      }
      
      return errorResponse
    }
  }

  // 流式执行kubelet-wuhrai命令
  async executeStream(
    request: KubeletWuhraiRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: KubeletWuhraiResponse) => void,
    onError: (error: string) => void,
    authToken?: string
  ): Promise<void> {
    try {
      console.log('🌊 开始流式调用 kubelet-wuhrai API')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // 使用新的流式API端点
      const response = await fetch(`${this.baseUrl}/api/kubelet-wuhrai/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...request,
          stream: true
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                return
              }

              try {
                const parsed = JSON.parse(data)
                
                // 处理不同类型的流式数据
                switch (parsed.type) {
                  case 'thinking':
                    onChunk(`🤔 ${parsed.content}`)
                    break
                  case 'command':
                    onChunk(`💻 执行: ${parsed.content}`)
                    break
                  case 'output':
                    onChunk(parsed.content)
                    break
                  case 'text':
                    onChunk(parsed.content)
                    break
                  case 'done':
                    onComplete({
                      success: true,
                      response: '',
                      timestamp: parsed.timestamp || new Date().toISOString(),
                      metadata: parsed.metadata
                    })
                    return
                  case 'error':
                    onError(parsed.content)
                    return
                  default:
                    // 兼容旧格式
                    if (parsed.delta) {
                      onChunk(parsed.delta)
                    } else if (parsed.response) {
                      onComplete(parsed)
                      return
                    }
                }
              } catch (e) {
                console.warn('解析流数据失败:', e)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('❌ 流式调用失败:', error)
      onError(error instanceof Error ? error.message : '未知错误')
    }
  }

  // 测试连接
  async testConnection(config: {
    provider: ProviderType
    apiKey?: string
    baseUrl?: string
    model: string
  }): Promise<boolean> {
    try {
      const testRequest: KubeletWuhraiRequest = {
        message: 'test connection',
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        quiet: true, // 使用quiet模式进行测试
      }

      const result = await this.execute(testRequest)
      return result.success
    } catch (error) {
      console.error('连接测试失败:', error)
      return false
    }
  }

  // 测试提供商配置
  async testProvider(config: {
    provider: ProviderType
    apiKey?: string
    baseUrl?: string
    model: string
  }): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now()
    
    try {
      const isConnected = await this.testConnection(config)
      const latency = Date.now() - startTime
      
      if (isConnected) {
        return { success: true, latency }
      } else {
        return { success: false, error: '连接测试失败' }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency
      }
    }
  }

  // 获取可用模型列表
  async getAvailableModels(provider: ProviderType): Promise<string[]> {
    try {
      // kubelet-wuhrai支持的模型列表
      const modelsByProvider: Record<ProviderType, string[]> = {
        'deepseek': [
          'deepseek-chat',
          'deepseek-coder',
          'deepseek-reasoner'
        ],
        'openai-compatible': [
          'gpt-4o',
          'gpt-4',
          'gpt-3.5-turbo',
          'claude-3-sonnet',
          'claude-3-haiku'
        ],
        'gemini': [
          'gemini-2.0-flash-thinking-exp',
          'gemini-pro',
          'gemini-pro-vision',
          'gemini-1.5-pro',
          'gemini-1.5-flash'
        ],
        'qwen': [
          'qwen-plus',
          'qwen-turbo',
          'qwen-max'
        ],
        'doubao': [
          'doubao-pro-4k',
          'doubao-lite-4k'
        ],
        'ollama': [
          'llama3.3:70b',
          'qwen2.5:32b',
          'deepseek-r1:32b',
          'gemma2:27b',
          'mixtral:8x7b',
          'codellama:13b'
        ],
        'local-deployment': []
      }

      return modelsByProvider[provider] || []
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return []
    }
  }
}

// 导出单例实例
export const kubeletWuhraiClient = KubeletWuhraiClient.getInstance()

// 便捷函数
export async function callKubeletWuhrai(request: KubeletWuhraiRequest): Promise<KubeletWuhraiResponse> {
  return kubeletWuhraiClient.execute(request)
}

export async function testKubeletWuhraiConnection(
  provider: ProviderType,
  apiKey?: string,
  baseUrl?: string,
  model: string = 'deepseek-chat'
): Promise<boolean> {
  return kubeletWuhraiClient.testConnection({
    provider,
    apiKey,
    baseUrl,
    model,
  })
}

export async function testProviderConfig(config: {
  provider: ProviderType
  apiKey?: string
  baseUrl?: string
  model: string
}): Promise<{ success: boolean; error?: string; latency?: number }> {
  return kubeletWuhraiClient.testProvider(config)
}
