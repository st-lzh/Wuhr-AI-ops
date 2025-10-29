import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 模型配置接口
interface ModelConfigRequest {
  modelName: string
  displayName: string
  provider: string
  apiKey: string
  baseUrl?: string
  description?: string
  isDefault?: boolean // 新增默认模型字段
}

// 获取用户的模型配置列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    const modelConfigs = await prisma.modelConfig.findMany({
      where: {
        userId: user.id
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      models: modelConfigs,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 获取模型配置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取模型配置失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 创建新的模型配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body: ModelConfigRequest = await request.json()

    const {
      modelName,
      displayName,
      provider,
      apiKey,
      baseUrl,
      description,
      isDefault = false
    } = body

    // 验证必需字段
    if (!modelName || !displayName || !provider || !apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: '模型名称、显示名称、提供商和API密钥为必填项',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 如果设置为默认模型，先将用户的其他模型的isDefault设为false
    if (isDefault) {
      await prisma.modelConfig.updateMany({
        where: {
          userId: user.id,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    // 检查是否已存在相同的模型名称
    const existingConfig = await prisma.modelConfig.findUnique({
      where: {
        userId_modelName: {
          userId: user.id,
          modelName: modelName
        }
      }
    })

    if (existingConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '该模型名称已存在，请使用不同的模型名称',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    // 创建新的模型配置
    const newConfig = await prisma.modelConfig.create({
      data: {
        userId: user.id,
        modelName,
        displayName,
        provider,
        apiKey,
        baseUrl,
        description,
        isDefault, // 设置默认状态
        isActive: true
      }
    })



    return NextResponse.json({
      success: true,
      data: newConfig,
      message: '模型配置创建成功',
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 创建模型配置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '创建模型配置失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 更新模型配置
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: '模型配置ID不能为空',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    console.log('📝 更新模型配置:', { userId: user.id, configId: id })

    // 验证配置是否属于当前用户
    const existingConfig = await prisma.modelConfig.findFirst({
      where: {
        id: id,
        userId: user.id
      }
    })

    if (!existingConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '模型配置不存在或无权限访问',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }

    // 如果要设置为默认模型，先将用户的其他模型的isDefault设为false
    if (updateData.isDefault) {
      await prisma.modelConfig.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
          id: { not: id } // 排除当前更新的模型
        },
        data: {
          isDefault: false
        }
      })
    }

    // 更新配置
    const updatedConfig = await prisma.modelConfig.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    })

    console.log('✅ 模型配置更新成功:', updatedConfig.id)

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: '模型配置更新成功',
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 更新模型配置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新模型配置失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 删除模型配置
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: '模型配置ID不能为空',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    console.log('🗑️ 删除模型配置:', { userId: user.id, configId: id })

    // 验证配置是否属于当前用户
    const existingConfig = await prisma.modelConfig.findFirst({
      where: {
        id: id,
        userId: user.id
      }
    })

    if (!existingConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '模型配置不存在或无权限访问',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }

    // 删除配置
    await prisma.modelConfig.delete({
      where: { id }
    })

    console.log('✅ 模型配置删除成功:', id)

    return NextResponse.json({
      success: true,
      message: '模型配置删除成功',
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 删除模型配置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '删除模型配置失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
