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
    const { serverId } = body

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: '服务器ID不能为空' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 验证服务器是否存在
    const targetServer = await prisma.server.findFirst({
      where: {
        id: serverId,
        isActive: true
      }
    })

    if (!targetServer) {
      return NextResponse.json(
        { success: false, error: '服务器不存在' },
        { status: 404 }
      )
    }

    // 使用事务处理默认设置（支持切换功能）
    let isSetAsDefault = false
    await prisma.$transaction(async (tx) => {
      if (targetServer.isDefault) {
        // 如果当前服务器已经是默认，则取消默认状态
        await tx.server.update({
          where: {
            id: serverId
          },
          data: {
            isDefault: false
          }
        })
        isSetAsDefault = false
      } else {
        // 如果当前服务器不是默认，则设为默认并取消其他服务器的默认状态
        await tx.server.updateMany({
          where: {
            isDefault: true
          },
          data: {
            isDefault: false
          }
        })

        await tx.server.update({
          where: {
            id: serverId
          },
          data: {
            isDefault: true
          }
        })
        isSetAsDefault = true
      }
    })

    console.log(`✅ 用户 ${user.username} ${isSetAsDefault ? '设置' : '取消'}默认服务器成功: ${targetServer.name}`)

    return NextResponse.json({
      success: true,
      message: isSetAsDefault ? '默认服务器设置成功' : '默认服务器已取消',
      data: {
        serverId,
        serverName: targetServer.name,
        isDefault: isSetAsDefault
      }
    })

  } catch (error) {
    console.error('❌ 设置默认服务器失败:', error)
    return NextResponse.json(
      { success: false, error: '设置默认服务器失败' },
      { status: 500 }
    )
  }
}