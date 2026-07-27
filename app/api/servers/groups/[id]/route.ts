import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../../lib/config/database'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { canWriteTeamAssets } from '../../../../../lib/auth/teamAccess'

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

    if (!canWriteTeamAssets(authResult.user, 'servers:write')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, color, icon, tags, serverIds = [] } = body  // 🔥 接收serverIds

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

    // 🔥 使用事务更新主机组并重新关联主机
    const result = await prisma.$transaction(async (tx) => {
      // 更新主机组基本信息
      const group = await tx.serverGroup.update({
        where: {
          id: params.id
        },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          color: color || '#1890ff',
          icon: icon || 'server',
          tags: tags || []
        }
      })

      // 先将该组的所有主机的groupId设为null（解除关联）
      await tx.server.updateMany({
        where: {
          groupId: params.id
        },
        data: {
          groupId: null
        }
      })

      // 然后将选中的主机重新关联到该组
      if (serverIds && serverIds.length > 0) {
        await tx.server.updateMany({
          where: {
            id: { in: serverIds },
            isActive: true
          },
          data: {
            groupId: params.id
          }
        })
      }

      // 返回包含主机列表的完整主机组信息
      return await tx.serverGroup.findUnique({
        where: { id: params.id },
        include: {
          servers: {
            where: {
              isActive: true
            },
            select: {
              id: true,
              name: true,
              hostname: true,
              ip: true,
              status: true,
              os: true
            }
          },
          _count: {
            select: {
              servers: true
            }
          }
        }
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        serverCount: result?._count.servers || 0
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

    if (!canWriteTeamAssets(authResult.user, 'servers:write')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    const group = await prisma.serverGroup.findFirst({
      where: {
        id: params.id,
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
