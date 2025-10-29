import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { hasPermission } from '../../../../../lib/auth/permissions'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult

    // 检查权限
    if (!hasPermission(user.permissions, 'config:write')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { modelId } = body

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: '模型ID不能为空' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 验证模型是否存在且属于当前用户
    const targetModel = await prisma.modelConfig.findFirst({
      where: {
        id: modelId,
        userId: user.id,
        isActive: true
      }
    })

    if (!targetModel) {
      return NextResponse.json(
        { success: false, error: '模型不存在或无权限访问' },
        { status: 404 }
      )
    }

    // 使用事务处理默认设置（支持切换功能）
    let isSetAsDefault = false
    await prisma.$transaction(async (tx) => {
      if (targetModel.isDefault) {
        // 如果当前模型已经是默认，则取消默认状态
        await tx.modelConfig.update({
          where: {
            id: modelId
          },
          data: {
            isDefault: false
          }
        })
        isSetAsDefault = false
      } else {
        // 如果当前模型不是默认，则设为默认并取消用户其他模型的默认状态
        await tx.modelConfig.updateMany({
          where: {
            userId: user.id,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        })

        await tx.modelConfig.update({
          where: {
            id: modelId
          },
          data: {
            isDefault: true
          }
        })
        isSetAsDefault = true
      }
    })

    console.log(`✅ 用户 ${user.username} ${isSetAsDefault ? '设置' : '取消'}默认模型成功: ${targetModel.displayName}`)

    return NextResponse.json({
      success: true,
      message: isSetAsDefault ? '默认模型设置成功' : '默认模型已取消',
      data: {
        modelId,
        modelName: targetModel.displayName,
        isDefault: isSetAsDefault
      }
    })

  } catch (error) {
    console.error('❌ 设置默认模型失败:', error)
    return NextResponse.json(
      { success: false, error: '设置默认模型失败' },
      { status: 500 }
    )
  }
}