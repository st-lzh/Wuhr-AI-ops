import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../lib/config/database'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限 - admin角色自动拥有所有权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:read')) {
      return NextResponse.json(
        { success: false, error: '没有权限查看权限组列表' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()

    console.log('🔐 [权限组API] 获取权限组列表:', {
      userId: user.id,
      userRole: user.role
    })

    // 获取权限组列表，包含关联的权限和用户数量
    const permissionGroups = await prisma.permissionGroup.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 格式化数据
    const formattedGroups = permissionGroups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      permissionCount: group.permissions.length,
      userCount: group.users.length,
      permissions: group.permissions.map(p => p.permission),
      users: group.users.map(u => u.user)
    }))

    console.log('✅ [权限组API] 权限组列表获取成功:', formattedGroups.length)

    return NextResponse.json({
      success: true,
      data: formattedGroups,
      message: '权限组列表获取成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组API] 获取权限组列表错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取权限组列表失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
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
    const user = authResult.user

    // 检查权限 - admin角色自动拥有所有权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限创建权限组' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description } = body

    console.log('🔐 [权限组API] 创建权限组:', {
      userId: user.id,
      name,
      description
    })

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { success: false, error: '权限组名称为必填项' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限组名称是否已存在
    const existingGroup = await prisma.permissionGroup.findFirst({
      where: { name }
    })

    if (existingGroup) {
      return NextResponse.json(
        { success: false, error: '权限组名称已存在' },
        { status: 400 }
      )
    }

    // 创建权限组
    const permissionGroup = await prisma.permissionGroup.create({
      data: {
        name,
        description
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    console.log('✅ [权限组API] 权限组创建成功:', permissionGroup.id)

    // 格式化返回数据
    const formattedGroup = {
      id: permissionGroup.id,
      name: permissionGroup.name,
      description: permissionGroup.description,
      createdAt: permissionGroup.createdAt,
      updatedAt: permissionGroup.updatedAt,
      permissionCount: permissionGroup.permissions.length,
      userCount: permissionGroup.users.length,
      permissions: permissionGroup.permissions.map(p => p.permission),
      users: permissionGroup.users.map(u => u.user)
    }

    return NextResponse.json({
      success: true,
      data: formattedGroup,
      message: '权限组创建成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组API] 创建权限组错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: '创建权限组失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}