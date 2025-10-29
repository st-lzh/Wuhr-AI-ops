import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../lib/config/database'
import { ProviderType } from '../../types/api'
import {
  getDefaultModels,
  getAllSupportedProviders,
  getProviderDisplayInfo
} from '../../config/kubelet-wuhrai-providers'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 预设模型列表 - 基于kubelet-wuhrai配置
const PRESET_MODELS = Object.fromEntries(
  getAllSupportedProviders().map(provider => [
    provider,
    getDefaultModels(provider)
  ])
)

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')
    const apiKeyId = searchParams.get('apiKeyId')

    const prisma = await getPrismaClient()

    // 如果指定了API密钥ID，返回该密钥的模型列表
    if (apiKeyId) {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: apiKeyId,
          userId: user.id,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          provider: true,
          config: true
        }
      })

      if (!apiKey) {
        return NextResponse.json({
          success: false,
          error: 'API密钥不存在'
        }, { status: 404 })
      }

      // 获取预设模型
      const presetModels = PRESET_MODELS[apiKey.provider as keyof typeof PRESET_MODELS] || []

      // 获取自定义模型
      const customModels = (apiKey.config as any)?.customModels || []

      // 合并模型列表
      const allModels = [...presetModels, ...customModels]

      return NextResponse.json({
        success: true,
        data: {
          models: allModels,
          presetModels,
          customModels,
          provider: apiKey.provider,
          apiKeyName: apiKey.name
        }
      })
    }

    // 获取用户所有API密钥的模型列表
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        provider: true,
        config: true,
        isDefault: true
      }
    })

    const modelsByApiKey = apiKeys.map(key => {
      const presetModels = PRESET_MODELS[key.provider as keyof typeof PRESET_MODELS] || []
      const customModels = (key.config as any)?.customModels || []
      const allModels = [...presetModels, ...customModels]

      return {
        apiKeyId: key.id,
        apiKeyName: key.name,
        provider: key.provider,
        isDefault: key.isDefault,
        models: allModels,
        presetModels,
        customModels
      }
    })

    // 如果指定了提供商，只返回该提供商的模型
    if (provider) {
      const filteredKeys = modelsByApiKey.filter(key => key.provider === provider)
      return NextResponse.json({
        success: true,
        data: {
          modelsByApiKey: filteredKeys,
          provider
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        modelsByApiKey,
        totalApiKeys: apiKeys.length
      }
    })

  } catch (error: any) {
    console.error('❌ 获取模型列表失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取模型列表失败',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}