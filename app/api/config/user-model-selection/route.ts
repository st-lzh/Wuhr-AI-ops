import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 获取用户当前选择的模型
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    console.log('📋 获取用户模型选择:', { userId: user.id })

    const userSelection = await prisma.userModelSelection.findUnique({
      where: {
        userId: user.id
      },
      include: {
        selectedModel: true
      }
    })

    if (!userSelection) {
      // 如果用户没有选择，尝试获取默认模型
      const defaultModel = await prisma.modelConfig.findFirst({
        where: {
          userId: user.id,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (defaultModel) {
        // 自动创建用户选择记录
        const newSelection = await prisma.userModelSelection.create({
          data: {
            userId: user.id,
            selectedModelId: defaultModel.id
          },
          include: {
            selectedModel: true
          }
        })

        console.log('✅ 自动选择默认模型:', defaultModel.modelName)

        return NextResponse.json({
          success: true,
          data: newSelection,
          timestamp: new Date().toISOString(),
        })
      }

      return NextResponse.json({
        success: true,
        data: null,
        message: '用户尚未选择模型',
        timestamp: new Date().toISOString(),
      })
    }

    console.log('✅ 获取用户模型选择成功:', userSelection.selectedModel.modelName)

    return NextResponse.json({
      success: true,
      data: userSelection,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 获取用户模型选择失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取用户模型选择失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 设置用户选择的模型
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()
    const { selectedModelId } = body

    if (!selectedModelId) {
      return NextResponse.json(
        {
          success: false,
          error: '选择的模型ID不能为空',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    console.log('📝 设置用户模型选择:', { userId: user.id, selectedModelId })

    // 验证模型是否属于当前用户
    const modelConfig = await prisma.modelConfig.findFirst({
      where: {
        id: selectedModelId,
        userId: user.id,
        isActive: true
      }
    })

    if (!modelConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '选择的模型不存在或无权限访问',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }

    // 更新或创建用户选择
    const userSelection = await prisma.userModelSelection.upsert({
      where: {
        userId: user.id
      },
      update: {
        selectedModelId: selectedModelId,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        selectedModelId: selectedModelId
      },
      include: {
        selectedModel: true
      }
    })

    console.log('✅ 用户模型选择设置成功:', modelConfig.modelName)

    return NextResponse.json({
      success: true,
      data: userSelection,
      message: `已选择模型: ${modelConfig.displayName}`,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 设置用户模型选择失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '设置用户模型选择失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 获取用户可选择的模型列表
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    console.log('📋 获取用户可选择的模型列表:', { userId: user.id })

    const availableModels = await prisma.modelConfig.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: [
        { displayName: 'asc' }
      ]
    })

    console.log('✅ 获取到', availableModels.length, '个可用模型')

    return NextResponse.json({
      success: true,
      data: availableModels,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 获取可选择模型列表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取可选择模型列表失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
