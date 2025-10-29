// API 相关类型定义

// 提供商类型 - 与kubelet-wuhrai完全匹配
export type ProviderType = 'deepseek' | 'openai-compatible' | 'gemini' | 'qwen' | 'doubao' | 'local-deployment'

// API 提供商配置
export interface ApiProvider {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string
  apiKey: string
  isDefault?: boolean
  isActive?: boolean
  description?: string
  models: string[]
  supportedFeatures: ApiFeature[]
  rateLimits?: RateLimit
  lastTested?: string
  testStatus?: 'success' | 'failed' | 'pending'
  testError?: string
  createdAt?: string | Date
  updatedAt?: string | Date
  // kubelet-wuhrai特定配置
  environmentVariable?: string // 对应的环境变量名
}

// API 功能特性
export interface ApiFeature {
  name: 'chat' | 'tools' | 'streaming' | 'embedding' | 'image'
  supported: boolean
  description?: string
}

// 速率限制配置
export interface RateLimit {
  requestsPerMinute?: number
  tokensPerMinute?: number
  maxConcurrent?: number
}

// 模型配置
export interface ModelInfo {
  id: string
  name: string
  displayName: string
  provider: string
  contextLength?: number
  maxTokens?: number

  supportedFeatures: string[]
  description?: string
}

// Gemini CLI 请求接口
export interface GeminiCliRequest {
  message: string
  provider?: ProviderType  // 可选，后端会从数据库获取
  apiKey?: string
  baseUrl?: string
  model: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: Tool[]
  systemPrompt?: string
}

// 工具定义
export interface Tool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

// Gemini CLI 响应接口
export interface GeminiCliResponse {
  success: boolean
  response?: string
  model: string
  timestamp: string
  usage?: TokenUsage
  toolCalls?: ToolCall[]
  error?: string
  details?: string
}

// kubelet-wuhrai CLI 请求接口
export interface KubeletWuhraiRequest {
  message: string
  provider?: ProviderType
  apiKey?: string
  baseUrl?: string
  model: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  quiet?: boolean // kubelet-wuhrai特有的quiet模式
  stream?: boolean // 流式响应
  sessionId?: string // 会话ID
  sessionContext?: { // 会话上下文信息
    session_id: string
    user_id: string
    conversation_history: number
    created_at: string
    updated_at: string
  }
  isK8sMode?: boolean // K8s命令模式，true为K8s集群模式，false为Linux系统模式
  context?: {
    namespace?: string
    cluster?: string
    environment?: string
    [key: string]: any
  }
}

// kubelet-wuhrai CLI 响应接口
export interface KubeletWuhraiResponse {
  success: boolean
  response?: string
  error?: string
  usage?: TokenUsage
  toolCalls?: ToolCall[]
  executionTime?: number
  timestamp: string
  sessionId?: string
  status?: 'completed' | 'processing' | 'error'
  metadata?: {
    model?: string
    provider?: string
    requestId?: string
    query_length?: string
    processed_at?: string
    execution_time?: string
    tools_used?: string[]
    model_used?: string
    [key: string]: any
  }
}

// Token 使用统计
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// 工具调用
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

// API 测试结果
export interface ApiTestResult {
  providerId: string
  success: boolean
  responseTime: number
  error?: string
  details?: {
    models?: string[]
    features?: ApiFeature[]
    latency?: number
  }
  timestamp: string
}

// 聊天消息
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  model?: string
  usage?: TokenUsage
  toolCalls?: ToolCall[]
  error?: string
}

// 聊天会话
export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  provider: string
  model: string
  createdAt: string
  updatedAt: string
  settings?: ChatSettings
}

// 聊天设置
export interface ChatSettings {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  streamResponse?: boolean
}

// API 配置验证结果
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// API 统计信息
export interface ApiStats {
  providerId: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokens: number

  averageResponseTime: number
  lastRequestAt?: string
  period: 'day' | 'week' | 'month'
}

// 导出预设的提供商配置
export const DEFAULT_PROVIDERS: Omit<ApiProvider, 'id' | 'apiKey'>[] = [
  {
    name: 'Wuhr AI (推荐)',
    type: 'openai-compatible',
    baseUrl: 'https://ai.wuhrai.com/v1',
    isDefault: true,
    isActive: true,
    description: '高质量的 OpenAI 兼容 API 服务',
    models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet', 'gemini-2.0-flash-exp'],
    supportedFeatures: [
      { name: 'chat', supported: true, description: '文本对话' },
      { name: 'tools', supported: true, description: '工具调用' },
      { name: 'streaming', supported: true, description: '流式响应' },
      { name: 'embedding', supported: true, description: '文本嵌入' },
      { name: 'image', supported: true, description: '图像理解' },
    ],
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      maxConcurrent: 5,
    },
  },
  {
    name: 'DeepSeek',
    type: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    isDefault: false,
    isActive: false,
    description: 'DeepSeek 官方 API 服务',
    models: ['deepseek-chat', 'deepseek-coder'],
    supportedFeatures: [
      { name: 'chat', supported: true, description: '文本对话' },
      { name: 'tools', supported: true, description: '工具调用' },
      { name: 'streaming', supported: true, description: '流式响应' },
      { name: 'embedding', supported: false, description: '文本嵌入' },
      { name: 'image', supported: false, description: '图像理解' },
    ],
    rateLimits: {
      requestsPerMinute: 100,
      tokensPerMinute: 200000,
      maxConcurrent: 10,
    },
  },
  {
    name: 'Google Gemini',
    type: 'gemini',
    isDefault: false,
    isActive: false,
    description: 'Google Gemini 官方 API',
    models: ['gemini-pro', 'gemini-pro-vision', 'gemini-2.0-flash-exp'],
    supportedFeatures: [
      { name: 'chat', supported: true, description: '文本对话' },
      { name: 'tools', supported: true, description: '工具调用' },
      { name: 'streaming', supported: true, description: '流式响应' },
      { name: 'embedding', supported: false, description: '文本嵌入' },
      { name: 'image', supported: true, description: '图像理解' },
    ],
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      maxConcurrent: 5,
    },
  },
]

// 预设的模型信息
export const DEFAULT_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'gpt-4o',
    displayName: 'GPT-4o (推荐)',
    provider: 'openai-compatible',
    contextLength: 128000,
    maxTokens: 4096,

    supportedFeatures: ['chat', 'tools', 'image'],
    description: '最新的 GPT-4 Omni 模型，支持文本和图像理解',
  },
  {
    id: 'gpt-4',
    name: 'gpt-4',
    displayName: 'GPT-4',
    provider: 'openai-compatible',
    contextLength: 8192,
    maxTokens: 4096,

    supportedFeatures: ['chat', 'tools'],
    description: '强大的 GPT-4 模型，适合复杂任务',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    provider: 'openai-compatible',
    contextLength: 16384,
    maxTokens: 4096,

    supportedFeatures: ['chat', 'tools'],
    description: '快速且经济的 GPT-3.5 模型',
  },
  {
    id: 'deepseek-chat',
    name: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'deepseek',
    contextLength: 32768,
    maxTokens: 4096,

    supportedFeatures: ['chat', 'tools'],
    description: 'DeepSeek 对话模型，性价比高',
  },
  {
    id: 'deepseek-coder',
    name: 'deepseek-coder',
    displayName: 'DeepSeek Coder',
    provider: 'deepseek',
    contextLength: 16384,
    maxTokens: 4096,

    supportedFeatures: ['chat', 'tools'],
    description: 'DeepSeek 代码专用模型',
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash (实验)',
    provider: 'gemini',
    contextLength: 1000000,
    maxTokens: 8192,

    supportedFeatures: ['chat', 'tools', 'image'],
    description: 'Google 最新的 Gemini 2.0 实验模型',
  },
]

// ======================== 认证相关类型定义 ========================

// 标准API响应格式
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: string
  timestamp: string
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

// 登录响应
export interface LoginResponse {
  user: {
    id: string
    username: string
    email: string
    role: string
    permissions: string[]
  }
  tokens: {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }
}

// 注册请求
export interface RegisterRequest {
  username: string
  email: string
  password: string
  confirmPassword: string
}

// 注册响应
export interface RegisterResponse {
  user: {
    id: string
    username: string
    email: string
    role: string
  }
  message: string
}

// Token刷新请求
export interface RefreshTokenRequest {
  refreshToken: string
}

// Token刷新响应
export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// Token验证响应
export interface VerifyTokenResponse {
  valid: boolean
  user?: {
    id: string
    username: string
    email: string
    role: string
    permissions: string[]
  }
  expiresAt?: string
}

// 用户资料更新请求
export interface UpdateProfileRequest {
  email?: string
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

// 用户资料响应
export interface UserProfileResponse {
  id: string
  username: string
  email: string
  role: string
  permissions: string[]
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
}

// 认证错误类型
export interface AuthError {
  code: string
  message: string
  field?: string
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean
  user: UserProfileResponse | null
  accessToken: string | null
  permissions: string[]
  loading: boolean
  error: string | null
}