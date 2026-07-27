import type { PrismaClient } from '../generated/prisma'
import { revealSecret } from '../crypto/encryption'
import { readProviderApiKey } from './modelProviders'

export interface RuntimeModelConfig {
  model: string
  provider: string
  apiKey: string
  baseUrl?: string
  modelConfigId?: string
}

interface ResolveRuntimeModelOptions {
  prisma: PrismaClient
  userId: string
  model?: string | null
  provider?: string | null
  apiKey?: string | null
  baseUrl?: string | null
}

/**
 * 在服务端解析真正用于调用模型的凭据。浏览器不需要也不会拿到数据库密钥；
 * 前端未提交密钥时优先使用指定模型，其次使用当前用户选择，最后使用团队默认模型。
 */
export async function resolveRuntimeModelConfig(options: ResolveRuntimeModelOptions): Promise<RuntimeModelConfig> {
  const providedKey = options.apiKey?.trim()
  if (providedKey && providedKey !== '***') {
    if (!options.model?.trim()) throw new Error('使用临时 API Key 时必须指定模型')
    return {
      model: options.model.trim(),
      provider: options.provider?.trim() || 'openai-compatible',
      apiKey: providedKey,
      baseUrl: options.baseUrl?.trim() || undefined
    }
  }

  let modelConfig = options.model?.trim()
    ? await options.prisma.modelConfig.findFirst({
        where: { modelName: options.model.trim(), isActive: true },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        include: { providerConnection: true }
      })
    : null

  if (!modelConfig) {
    const selection = await options.prisma.userModelSelection.findUnique({
      where: { userId: options.userId },
      include: {
        selectedModel: { include: { providerConnection: true } }
      }
    })
    modelConfig = selection?.selectedModel?.isActive ? selection.selectedModel : null
  }

  if (!modelConfig) {
    modelConfig = await options.prisma.modelConfig.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: { providerConnection: true }
    })
  }

  if (!modelConfig) throw new Error('没有可用的模型配置，请先在模型管理中完成连接配置')

  const apiKey = revealSecret(modelConfig.apiKey)
    || (modelConfig.providerConnection ? readProviderApiKey(modelConfig.providerConnection) : '')
  const providerKey = modelConfig.providerConnection?.providerKey
  const keylessProvider = providerKey === 'ollama'
    || providerKey === 'vllm'
    || providerKey === 'local-deployment'
  if (!apiKey && !keylessProvider) throw new Error(`模型 ${modelConfig.displayName} 未配置 API Key`)
  if (keylessProvider && !(modelConfig.baseUrl || modelConfig.providerConnection?.baseUrl)) {
    throw new Error(`本地模型 ${modelConfig.displayName} 未配置 Base URL`)
  }

  return {
    model: modelConfig.modelName,
    provider: keylessProvider ? providerKey! : modelConfig.provider,
    apiKey,
    baseUrl: modelConfig.baseUrl || modelConfig.providerConnection?.baseUrl || undefined,
    modelConfigId: modelConfig.id
  }
}
