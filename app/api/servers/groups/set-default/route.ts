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
    if (!hasPermission(user.permissions, 'servers:write')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { groupId } = body

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: '主机组ID不能为空' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 验证主机组是否存在且属于当前用户
    const targetGroup = await prisma.serverGroup.findFirst({
      where: {
        id: groupId,
        userId: user.id,
        isActive: true
      }
    })

    if (!targetGroup) {
      return NextResponse.json(
        { success: false, error: '主机组不存在或无权限访问' },
        { status: 404 }
      )
    }

    // 使用事务处理默认设置（支持切换功能）
    let isSetAsDefault = false
    await prisma.$transaction(async (tx) => {
      if (targetGroup.isDefault) {
        // 如果当前主机组已经是默认，则取消默认状态
        await tx.serverGroup.update({
          where: {
            id: groupId
          },
          data: {
            isDefault: false
          }
        })
        isSetAsDefault = false
      } else {
        // 如果当前主机组不是默认，则设为默认并取消用户其他主机组的默认状态
        await tx.serverGroup.updateMany({
          where: {
            userId: user.id,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        })

        await tx.serverGroup.update({
          where: {
            id: groupId
          },
          data: {
            isDefault: true
          }
        })
        isSetAsDefault = true
      }
    })

    console.log(`✅ 用户 ${user.username} ${isSetAsDefault ? '设置' : '取消'}默认主机组成功: ${targetGroup.name}`)

    return NextResponse.json({
      success: true,
      message: isSetAsDefault ? '默认主机组设置成功' : '默认主机组已取消',
      data: {
        groupId,
        groupName: targetGroup.name,
        isDefault: isSetAsDefault
      }
    })

  } catch (error) {
    console.error('❌ 设置默认主机组失败:', error)
    return NextResponse.json(
      { success: false, error: '设置默认主机组失败' },
      { status: 500 }
    )
  }
}