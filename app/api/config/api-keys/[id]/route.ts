import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { protectSecret } from '../../../../../lib/crypto/encryption'

// 预设模型列表
const PRESET_MODELS = {
  'openai-compatible': [
    'gpt-4o',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-sonnet',
    'claude-3-haiku'
  ],
  'deepseek': [
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-reasoner'
  ],
  'gemini': [
    'gemini-2.0-flash-thinking-exp',
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]
}

// 获取单个API密钥详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()
    const apiKeyId = params.id

    console.log('🔍 获取API密钥详情:', { userId: user.id, apiKeyId })

    // 查询API密钥
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
        baseUrl: true,
        isDefault: true,
        isActive: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        // 为了安全，不返回实际的API密钥
        apiKey: false
      }
    })

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API密钥不存在',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    // 处理模型信息
    const presetModels = PRESET_MODELS[apiKey.provider as keyof typeof PRESET_MODELS] || []
    const customModels = (apiKey.config as any)?.customModels || []
    const allModels = [...presetModels, ...customModels]

    const responseData = {
      ...apiKey,
      hasApiKey: true,
      key: '***',
      models: allModels,
      presetModels,
      customModels
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKey: responseData
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 获取API密钥详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取API密钥详情失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 更新API密钥
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()
    const apiKeyId = params.id
    const body = await request.json()

    const { name, provider, apiKey, baseUrl, isDefault, customModels } = body as any

    console.log('🔨 更新API密钥:', {
      userId: user.id,
      apiKeyId,
      name,
      provider,
      hasNewApiKey: !!apiKey
    })

    // 检查API密钥是否存在且属于当前用户
    const existingApiKey = await prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId: user.id,
        isActive: true
      }
    })

    if (!existingApiKey) {
      return NextResponse.json({
        success: false,
        error: 'API密钥不存在',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    // 如果设置为默认，先清除其他默认设置
    if (isDefault && !existingApiKey.isDefault) {
      await prisma.apiKey.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
          id: { not: apiKeyId }
        },
        data: { isDefault: false }
      })
    }

    // 处理自定义模型
    const processedCustomModels = Array.isArray(customModels) ? customModels : []
    const config = {
      customModels: processedCustomModels
    }

    // 准备更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (provider !== undefined) updateData.provider = provider
    if (apiKey !== undefined && apiKey !== '***') updateData.apiKey = protectSecret(apiKey)
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl
    if (isDefault !== undefined) updateData.isDefault = isDefault
    updateData.config = config
    updateData.updatedAt = new Date()

    // 更新API密钥
    const updatedApiKey = await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        provider: true,
        baseUrl: true,
        isDefault: true,
        isActive: true,
        config: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // 处理返回数据，包含模型信息
    const presetModels = PRESET_MODELS[updatedApiKey.provider as keyof typeof PRESET_MODELS] || []
    const allModels = [...presetModels, ...processedCustomModels]

    const responseData = {
      ...updatedApiKey,
      hasApiKey: true,
      key: '***',
      models: allModels,
      presetModels,
      customModels: processedCustomModels
    }

    console.log('✅ API密钥更新成功:', {
      id: updatedApiKey.id,
      name: updatedApiKey.name,
      totalModels: allModels.length
    })

    return NextResponse.json({
      success: true,
      data: {
        apiKey: responseData
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 更新API密钥失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新API密钥失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 删除API密钥
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()
    const apiKeyId = params.id

    console.log('🗑️ 删除API密钥:', { userId: user.id, apiKeyId })

    // 检查API密钥是否存在且属于当前用户
    const existingApiKey = await prisma.apiKey.findFirst({
      where: { 
        id: apiKeyId,
        userId: user.id,
        isActive: true
      }
    })

    if (!existingApiKey) {
      return NextResponse.json({
        success: false,
        error: 'API密钥不存在',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    // 软删除：设置为不活跃
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'API密钥删除成功'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 删除API密钥失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除API密钥失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
