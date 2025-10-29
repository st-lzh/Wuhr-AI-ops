// kubelet-wuhrai 提供商配置
import { ProviderType } from '../types/api'

// 提供商信息接口
export interface ProviderInfo {
  name: string
  displayName: string
  description: string
  apiKeyRequired: boolean
  baseUrlRequired: boolean
  defaultModels: string[]
}

// 支持的提供商配置
export const PROVIDER_CONFIGS: Record<ProviderType, ProviderInfo> = {
  'deepseek': {
    name: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek AI模型',
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultModels: [
      'deepseek-chat',
      'deepseek-coder',
      'deepseek-reasoner'
    ]
  },
  'openai-compatible': {
    name: 'openai-compatible',
    displayName: 'OpenAI Compatible',
    description: 'OpenAI兼容的API服务',
    apiKeyRequired: true,
    baseUrlRequired: true,
    defaultModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'gemini-2.0-flash-exp'
    ]
  },
  'gemini': {
    name: 'gemini',
    displayName: 'Google Gemini',
    description: 'Google Gemini模型',
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultModels: [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ]
  },
  'qwen': {
    name: 'qwen',
    displayName: 'Qwen',
    description: '阿里云通义千问模型',
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultModels: [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max'
    ]
  },
  'doubao': {
    name: 'doubao',
    displayName: 'Doubao',
    description: '字节跳动豆包模型',
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultModels: [
      'doubao-pro-4k',
      'doubao-pro-32k',
      'doubao-lite-4k'
    ]
  },
  'local-deployment': {
    name: 'local-deployment',
    displayName: 'Local Deployment',
    description: 'Locally deployed models without API key requirements',
    apiKeyRequired: false,
    baseUrlRequired: true,
    defaultModels: []
  }
}

// 获取所有支持的提供商
export function getAllSupportedProviders(): ProviderType[] {
  return Object.keys(PROVIDER_CONFIGS) as ProviderType[]
}

// 获取提供商的默认模型
export function getDefaultModels(provider: ProviderType): string[] {
  return PROVIDER_CONFIGS[provider]?.defaultModels || []
}

// 获取提供商显示信息
export function getProviderDisplayInfo(provider: ProviderType): ProviderInfo | null {
  return PROVIDER_CONFIGS[provider] || null
}

// 检查提供商是否需要API密钥
export function isApiKeyRequired(provider: ProviderType): boolean {
  return PROVIDER_CONFIGS[provider]?.apiKeyRequired || false
}

// 检查提供商是否需要Base URL
export function isBaseUrlRequired(provider: ProviderType): boolean {
  return PROVIDER_CONFIGS[provider]?.baseUrlRequired || false
}

// 获取提供商的显示名称
export function getProviderDisplayName(provider: ProviderType): string {
  return PROVIDER_CONFIGS[provider]?.displayName || provider
}

// 验证提供商是否支持
export function isProviderSupported(provider: string): provider is ProviderType {
  return provider in PROVIDER_CONFIGS
}

// 获取所有模型列表
export function getAllModels(): Record<ProviderType, string[]> {
  const result: Record<string, string[]> = {}
  
  for (const provider of getAllSupportedProviders()) {
    result[provider] = getDefaultModels(provider)
  }
  
  return result as Record<ProviderType, string[]>
}

// 根据模型名称查找提供商
export function findProviderByModel(modelName: string): ProviderType | null {
  for (const provider of getAllSupportedProviders()) {
    const models = getDefaultModels(provider)
    if (models.includes(modelName)) {
      return provider
    }
  }
  return null
}

// 获取推理模型列表（o1系列）
export function getReasoningModels(): string[] {
  const allModels = getAllModels()
  const reasoningModels: string[] = []
  
  for (const models of Object.values(allModels)) {
    for (const model of models) {
      if (model.includes('o1')) {
        reasoningModels.push(model)
      }
    }
  }
  
  return reasoningModels
}

// 检查是否为推理模型
export function isReasoningModel(modelName: string): boolean {
  return modelName.toLowerCase().includes('o1')
}

// 环境变量映射
export const PROVIDER_ENV_MAP: Record<ProviderType, string> = {
  'deepseek': 'DEEPSEEK_API_KEY',
  'openai-compatible': 'OPENAI_API_KEY',
  'gemini': 'GEMINI_API_KEY',
  'qwen': 'QWEN_API_KEY',
  'doubao': 'DOUBAO_API_KEY',
  'local-deployment': 'OPENAI_API_KEY'
}

// 根据提供商获取环境变量名
export function getEnvironmentVariable(provider: ProviderType): string {
  return PROVIDER_ENV_MAP[provider] || 'OPENAI_API_KEY'
}

// 构建kubelet-wuhrai环境变量
export function buildEnvironmentVariables(
  modelName: string,
  apiKey: string,
  baseUrl?: string,
  provider?: ProviderType
): Record<string, string> {
  // 如果明确指定了提供商，使用指定的；否则根据模型名称查找
  const actualProvider = provider || findProviderByModel(modelName) || 'openai-compatible'
  const envVar = getEnvironmentVariable(actualProvider)

  const env: Record<string, string> = {}

  // 检查是否为本地部署提供商
  const isLocalDeployment = actualProvider === 'local-deployment'

  // 检查是否为自定义部署（有baseUrl）
  const isCustomDeployment = baseUrl && baseUrl.trim().length > 0

  // 检查API密钥是否有效（不是测试值或空值）
  const isValidApiKey = apiKey &&
    apiKey.trim().length > 0 &&
    !['test', 'asdasd', 'placeholder', 'not-needed', 'none'].includes(apiKey.toLowerCase())

  // 设置API密钥
  if (isLocalDeployment) {
    // 本地部署提供商：完全不需要API密钥
    console.log('🔧 本地部署模式，无需API密钥')
  } else if (isCustomDeployment) {
    // 对于自定义部署，只有在API密钥明确有效时才设置
    if (isValidApiKey) {
      env[envVar] = apiKey
      console.log('🔧 自定义部署使用提供的API密钥')
    } else {
      // 自定义部署且无有效API密钥，完全不设置API密钥环境变量
      console.log('🔧 自定义部署无需API密钥，跳过设置')
    }
  } else {
    // 对于云服务提供商，必须有有效的API密钥
    if (isValidApiKey) {
      env[envVar] = apiKey
    } else {
      env[envVar] = 'not-needed'
      console.log('🔧 使用默认API密钥值')
    }
  }

  // 对于OpenAI兼容的提供商或本地部署，设置Base URL
  if ((actualProvider === 'openai-compatible' || actualProvider === 'local-deployment') && baseUrl) {
    env.OPENAI_API_BASE = baseUrl  // 使用OPENAI_API_BASE与远程执行保持一致
  }

  return env
}

// 验证配置
export function validateModelConfig(
  modelName: string,
  apiKey: string,
  baseUrl?: string,
  provider?: ProviderType
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 如果明确指定了提供商，使用指定的；否则根据模型名称查找
  const actualProvider = provider || findProviderByModel(modelName)

  // 对于本地部署提供商，允许任何模型名称且不需要API密钥
  if (provider === 'local-deployment') {
    console.log('🔧 本地部署提供商，允许任何模型名称且无需API密钥')

    // 本地部署必须有Base URL
    if (!baseUrl || baseUrl.trim().length === 0) {
      errors.push('本地部署提供商必须设置Base URL')
    }
  } else {
    // 对于openai-compatible提供商，如果有baseUrl，则允许任何模型名称
    if (!actualProvider) {
      if (baseUrl && baseUrl.trim().length > 0) {
        // 有baseUrl的情况下，认为是openai-compatible提供商，允许任何模型
        console.log('🔧 检测到自定义模型配置:', { modelName, baseUrl })
      } else {
        errors.push(`不支持的模型: ${modelName}`)
      }
    }

    // 检查API密钥 - 对于自定义baseUrl的情况，API密钥可以为空
    const isCustomProvider = baseUrl && baseUrl.trim().length > 0
    if (!isCustomProvider && (!apiKey || apiKey.trim().length === 0)) {
      errors.push('API密钥不能为空')
    }

    // 对于自定义提供商，如果API密钥为空，给出提示但不阻止
    if (isCustomProvider && (!apiKey || apiKey.trim().length === 0)) {
      console.log('ℹ️ 自定义模型未设置API密钥，将使用空密钥（适用于无认证的本地部署）')
    }
  }

  // 检查Base URL（如果提供了的话）
  if (baseUrl && baseUrl.trim().length > 0) {
    try {
      new URL(baseUrl)
    } catch {
      errors.push('Base URL格式不正确')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// 生成kubelet-wuhrai命令参数
export function generateKubeletArgs(modelName: string, quiet: boolean = true, provider?: ProviderType): string[] {
  const actualProvider = provider || findProviderByModel(modelName) || 'openai-compatible'

  // 将提供商类型映射到kubelet-wuhrai支持的提供商
  let kubeletProvider: string = actualProvider
  if (actualProvider === 'openai-compatible' || actualProvider === 'local-deployment') {
    kubeletProvider = 'openai'
  }

  const args = [
    '--llm-provider', kubeletProvider,
    '--model', modelName
  ]

  if (quiet) {
    args.push('--quiet')
  }

  return args
}

// 获取默认配置
export function getDefaultConfig() {
  return {
    model: 'deepseek-chat',
    baseUrl: 'https://ai.wuhrai.com/v1',
    apiKey: ''
  }
}

// 兼容性函数：根据模型名称获取提供商类型
export function getProviderFromModel(modelName: string): ProviderType {
  return findProviderByModel(modelName) || 'openai-compatible'
}
