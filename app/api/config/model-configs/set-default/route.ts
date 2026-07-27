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

    // 单个可信运维团队共享模型：默认模型是团队级唯一配置。
    const targetModel = await prisma.modelConfig.findFirst({
      where: {
        id: modelId,
        isActive: true
      }
    })

    if (!targetModel) {
      return NextResponse.json(
        { success: false, error: '模型不存在或无权限访问' },
        { status: 404 }
      )
    }

    // 始终保留一个团队默认模型，不允许通过重复点击取消。
    await prisma.$transaction(async (tx) => {
      await tx.modelConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      await tx.modelConfig.update({ where: { id: modelId }, data: { isDefault: true } })
      await tx.model_providers.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      if (targetModel.providerConnectionId) {
        await tx.model_providers.update({
          where: { id: targetModel.providerConnectionId },
          data: { isDefault: true }
        })
      }
    })

    console.log(`✅ 用户 ${user.username} 设置团队默认模型成功: ${targetModel.displayName}`)

    return NextResponse.json({
      success: true,
      message: '团队默认模型设置成功',
      data: {
        modelId,
        modelName: targetModel.displayName,
        isDefault: true
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
