import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { hasPermission } from '../../../../lib/auth/permissions'
import { getPrismaClient } from '../../../../lib/config/database'

// 获取单个服务器信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const prisma = await getPrismaClient()
    const server = await prisma.server.findFirst({
      where: {
        id: params.id,
        userId: authResult.user.id,
        isActive: true
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    if (!server) {
      return NextResponse.json(
        { success: false, error: '服务器不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: server
    })
  } catch (error) {
    console.error('获取服务器详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取服务器详情失败' },
      { status: 500 }
    )
  }
}

// 更新服务器信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    if (!hasPermission(authResult.user.permissions, 'servers:write')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { groupId } = body

    const prisma = await getPrismaClient()
    
    // 验证服务器是否存在且属于当前用户
    const server = await prisma.server.findFirst({
      where: {
        id: params.id,
        userId: authResult.user.id,
        isActive: true
      }
    })

    if (!server) {
      return NextResponse.json(
        { success: false, error: '服务器不存在' },
        { status: 404 }
      )
    }

    // 如果提供了groupId，验证组是否存在且属于当前用户
    if (groupId) {
      const group = await prisma.serverGroup.findFirst({
        where: {
          id: groupId,
          userId: authResult.user.id,
          isActive: true
        }
      })

      if (!group) {
        return NextResponse.json(
          { success: false, error: '指定的主机组不存在' },
          { status: 400 }
        )
      }
    }

    // 更新服务器
    const updatedServer = await prisma.server.update({
      where: { id: params.id },
      data: { 
        groupId: groupId || null,
        updatedAt: new Date()
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    console.log(`✅ 服务器 ${server.name} 的组信息已更新`)

    return NextResponse.json({
      success: true,
      data: updatedServer
    })
  } catch (error) {
    console.error('更新服务器失败:', error)
    return NextResponse.json(
      { success: false, error: '更新服务器失败' },
      { status: 500 }
    )
  }
}