import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../lib/config/database'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { hasPermission } from '../../../../lib/auth/permissions'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const prisma = await getPrismaClient()
    const groups = await prisma.serverGroup.findMany({
      where: {
        userId: authResult.user.id,
        isActive: true
      },
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
      },
      orderBy: [
        {
          isDefault: 'desc'  // 默认主机组排在前面
        },
        {
          name: 'asc'
        }
      ]
    })

    const formattedGroups = groups.map(group => ({
      ...group,
      serverCount: group._count.servers
    }))

    return NextResponse.json({
      success: true,
      data: formattedGroups
    })
  } catch (error) {
    console.error('获取主机组列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取主机组列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
        name: name.trim(),
        userId: authResult.user.id,
        isActive: true
      }
    })

    if (existingGroup) {
      return NextResponse.json(
        { success: false, error: '主机组名称已存在' },
        { status: 400 }
      )
    }

    const group = await prisma.serverGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#1890ff',
        icon: icon || 'server',
        tags: tags || [],
        userId: authResult.user.id
      },
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

    return NextResponse.json({
      success: true,
      data: {
        ...group,
        serverCount: group._count.servers
      }
    })
  } catch (error) {
    console.error('创建主机组失败:', error)
    return NextResponse.json(
      { success: false, error: '创建主机组失败' },
      { status: 500 }
    )
  }
}