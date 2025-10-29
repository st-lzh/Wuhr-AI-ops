import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../../lib/config/database'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { hasPermission } from '../../../../../lib/auth/permissions'

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
    const group = await prisma.serverGroup.findFirst({
      where: {
        id: params.id,
        userId: authResult.user.id,
        isActive: true
      },
      include: {
        servers: {
          where: {
            isActive: true
          }
        },
        _count: {
          select: {
            servers: true
          }
        }
      }
    })

    if (!group) {
      return NextResponse.json(
        { success: false, error: '主机组不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...group,
        serverCount: group._count.servers
      }
    })
  } catch (error) {
    console.error('获取主机组详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取主机组详情失败' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const { name, description, color, icon, tags } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: '主机组名称不能为空' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    const existingGroup = await prisma.serverGroup.findFirst({
      where: {
        id: params.id,
        userId: authResult.user.id,
        isActive: true
      }
    })

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: '主机组不存在' },
        { status: 404 }
      )
    }

    const nameConflict = await prisma.serverGroup.findFirst({
      where: {
        name: name.trim(),
        userId: authResult.user.id,
        isActive: true,
        NOT: {
          id: params.id
        }
      }
    })

    if (nameConflict) {
      return NextResponse.json(
        { success: false, error: '主机组名称已存在' },
        { status: 400 }
      )
    }

    const group = await prisma.serverGroup.update({
      where: {
        id: params.id
      },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#1890ff',
        icon: icon || 'server',
        tags: tags || []
      },
      include: {
        servers: {
          where: {
            isActive: true
          }
        },
        _count: {
          select: {
            servers: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...group,
        serverCount: group._count.servers
      }
    })
  } catch (error) {
    console.error('更新主机组失败:', error)
    return NextResponse.json(
      { success: false, error: '更新主机组失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const prisma = await getPrismaClient()
    const group = await prisma.serverGroup.findFirst({
      where: {
        id: params.id,
        userId: authResult.user.id,
        isActive: true
      },
      include: {
        _count: {
          select: {
            servers: true
          }
        }
      }
    })

    if (!group) {
      return NextResponse.json(
        { success: false, error: '主机组不存在' },
        { status: 404 }
      )
    }

    if (group._count.servers > 0) {
      return NextResponse.json(
        { success: false, error: '主机组中还有主机，请先移除所有主机后再删除组' },
        { status: 400 }
      )
    }

    await prisma.serverGroup.update({
      where: {
        id: params.id
      },
      data: {
        isActive: false
      }
    })

    return NextResponse.json({
      success: true,
      data: { message: '主机组删除成功' }
    })
  } catch (error) {
    console.error('删除主机组失败:', error)
    return NextResponse.json(
      { success: false, error: '删除主机组失败' },
      { status: 500 }
    )
  }
}