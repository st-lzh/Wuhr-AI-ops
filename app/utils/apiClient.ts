import { errorHandler, withRetry, ErrorType, AppError } from './errorHandler'
import { monitorAuthError, monitorNetworkError } from './authErrorMonitor'

// API 响应接口
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string | number
  timestamp: string
}

// API 配置接口
export interface ApiConfig {
  baseUrl: string
  timeout: number
  retries: number
  retryDelay: number
  headers?: Record<string, string>
}

// 请求选项接口
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
  retryDelay?: number
  showError?: boolean
  showLoading?: boolean
  loadingKey?: string
}

// Gemini CLI 请求接口
export interface GeminiRequest {
  model?: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  stream?: boolean
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

// Gemini CLI 响应接口
export interface GeminiResponse {
  response: string
  model: string
  timestamp: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// API 客户端类
export class ApiClient {
  private static instance: ApiClient
  private config: ApiConfig
  private abortControllers: Map<string, AbortController> = new Map()

  constructor(config?: Partial<ApiConfig>) {
    this.config = {
      baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    }
  }

  static getInstance(config?: Partial<ApiConfig>): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(config)
    }
    return ApiClient.instance
  }

  // 更新配置
  updateConfig(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config }
  }

  // 创建请求头
  private createHeaders(customHeaders?: Record<string, string>): HeadersInit {
    return {
      ...this.config.headers,
      ...customHeaders,
    }
  }

  // 创建 AbortController
  private createAbortController(key?: string): AbortController {
    const controller = new AbortController()
    
    if (key) {
      // 如果已存在相同 key 的请求，取消它
      if (this.abortControllers.has(key)) {
        this.abortControllers.get(key)!.abort()
      }
      this.abortControllers.set(key, controller)
    }

    return controller
  }

  // 清理 AbortController
  private cleanupAbortController(key?: string) {
    if (key && this.abortControllers.has(key)) {
      this.abortControllers.delete(key)
    }
  }

  // 基础请求方法
  public async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers: customHeaders,
      body,
      timeout = this.config.timeout,
      retries = this.config.retries,
      retryDelay = this.config.retryDelay,
      showError = true,
      loadingKey,
    } = options

    const url = `${this.config.baseUrl}${endpoint}`
    const controller = this.createAbortController(loadingKey)

    const requestFn = async (): Promise<ApiResponse<T>> => {
      try {
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, timeout)

        const response = await fetch(url, {
          method,
          headers: this.createHeaders(customHeaders),
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          credentials: 'include', // 确保发送cookies
        })

        clearTimeout(timeoutId)

        // 监控认证和服务器错误
        monitorAuthError(response, url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw {
            response: {
              status: response.status,
              data: errorData,
            },
          }
        }

        const data = await response.json()
        
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error('请求已取消')
        }

        // 监控网络错误
        if (error instanceof TypeError && error.message.includes('fetch')) {
          monitorNetworkError(error, url)
        }

        throw error
      } finally {
        this.cleanupAbortController(loadingKey)
      }
    }

    try {
      if (retries > 0) {
        return await withRetry(requestFn, retries, retryDelay)
      } else {
        return await requestFn()
      }
    } catch (error: any) {
      const appError = errorHandler.handleApiError(error, url)
      
      if (showError) {
        errorHandler.showErrorToUser(appError)
      }

      return {
        success: false,
        error: appError.message,
        code: appError.code,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // GET 请求
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  // POST 请求
  async post<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  // PUT 请求
  async put<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  // DELETE 请求
  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  // PATCH 请求
  async patch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body })
  }

  // 取消请求
  cancelRequest(key: string): boolean {
    if (this.abortControllers.has(key)) {
      this.abortControllers.get(key)!.abort()
      this.abortControllers.delete(key)
      return true
    }
    return false
  }

  // 取消所有请求
  cancelAllRequests(): void {
    this.abortControllers.forEach(controller => controller.abort())
    this.abortControllers.clear()
  }

  // Gemini CLI 专用方法
  async sendToGemini(request: GeminiRequest, options?: RequestOptions): Promise<ApiResponse<GeminiResponse>> {
    return this.post<GeminiResponse>('/gemini/chat', request, {
      loadingKey: 'gemini-chat',
      timeout: 60000, // Gemini 请求可能需要更长时间
      ...options,
    })
  }

  // 系统聊天
  async systemChat(message: string, options?: {
    model?: string
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
  } & RequestOptions): Promise<ApiResponse<GeminiResponse>> {
    const { model, systemPrompt, temperature, maxTokens, ...requestOptions } = options || {}

    const request: GeminiRequest = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: message },
      ],
      temperature,
      maxTokens,
    }

    return this.sendToGemini(request, requestOptions)
  }

  // 健康检查
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get('/health', {
      timeout: 5000,
      retries: 1,
      showError: false,
    })
  }

  // 获取模型列表
  async getModels(provider: string): Promise<ApiResponse<string[]>> {
    return this.get(`/models?provider=${provider}`, {
      loadingKey: 'get-models',
    })
  }

  // 验证 API 密钥
  async validateApiKey(apiKey: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post('/validate-key', { apiKey }, {
      loadingKey: 'validate-key',
      showError: false,
    })
  }
}

// 导出单例实例
export const apiClient = ApiClient.getInstance()

// 便捷的 API 调用函数
export async function callApi<T>(
  endpoint: string,
  options?: RequestOptions
): Promise<T | null> {
  const response = await apiClient.request<T>(endpoint, options)
  
  if (response.success && response.data) {
    return response.data
  }
  
  return null
}

// 系统聊天便捷函数
export async function chatWithSystem(
  message: string,
  options?: {
    model?: string
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    showError?: boolean
  }
): Promise<string | null> {
  const response = await apiClient.systemChat(message, options)

  if (response.success && response.data) {
    return response.data.response
  }

  return null
}

// 流式聊天（暂时返回普通响应，后续可扩展为 SSE）
export async function streamChatWithGemini(
  message: string,
  onChunk: (chunk: string) => void,
  options?: {
    model?: string
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<void> {
  // 暂时使用普通请求模拟流式响应
  const response = await chatWithSystem(message, options)
  
  if (response) {
    // 模拟流式输出
    const words = response.split(' ')
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50))
      onChunk(words.slice(0, i + 1).join(' '))
    }
  }
} 