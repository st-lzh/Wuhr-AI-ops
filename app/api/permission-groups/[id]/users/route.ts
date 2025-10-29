import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

// GET /api/permission-groups/[id]/users - 获取权限组的用户列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:read')) {
      return NextResponse.json(
        { success: false, error: '没有权限查看权限组用户' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    const groupId = params.id

    console.log('🔐 [权限组用户API] 获取权限组用户:', {
      userId: user.id,
      groupId
    })

    // 检查权限组是否存在
    const permissionGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                lastLoginAt: true
              }
            }
          }
        }
      }
    })

    if (!permissionGroup) {
      return NextResponse.json(
        { success: false, error: '权限组不存在' },
        { status: 404 }
      )
    }

    // 获取所有可用用户（排除已在权限组中的用户）
    const groupUserIds = permissionGroup.users.map(u => u.user.id)
    const availableUsers = await prisma.user.findMany({
      where: {
        id: { notIn: groupUserIds },
        isActive: true,
        approvalStatus: 'approved'
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: [
        { role: 'asc' },
        { username: 'asc' }
      ]
    })

    // 格式化数据
    const groupUsers = permissionGroup.users.map(u => u.user)

    console.log('✅ [权限组用户API] 权限组用户获取成功:', groupId)

    return NextResponse.json({
      success: true,
      data: {
        group: {
          id: permissionGroup.id,
          name: permissionGroup.name,
          description: permissionGroup.description
        },
        assignedUsers: groupUsers,
        availableUsers: availableUsers
      },
      message: '权限组用户获取成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组用户API] 获取权限组用户错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取权限组用户失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// PUT /api/permission-groups/[id]/users - 更新权限组的用户
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限修改权限组用户' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userIds } = body
    const groupId = params.id

    console.log('🔐 [权限组用户API] 更新权限组用户:', {
      userId: user.id,
      groupId,
      userIds
    })

    // 验证输入
    if (!Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: '用户ID列表格式错误' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限组是否存在
    const permissionGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId }
    })

    if (!permissionGroup) {
      return NextResponse.json(
        { success: false, error: '权限组不存在' },
        { status: 404 }
      )
    }

    // 验证所有用户ID是否有效
    if (userIds.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          isActive: true,
          approvalStatus: 'approved'
        }
      })

      if (validUsers.length !== userIds.length) {
        return NextResponse.json(
          { success: false, error: '包含无效的用户ID或用户未激活' },
          { status: 400 }
        )
      }
    }

    // 使用事务更新权限组用户
    await prisma.$transaction(async (tx) => {
      // 删除现有的用户关联
      await tx.userPermissionGroup.deleteMany({
        where: { groupId }
      })

      // 添加新的用户关联
      if (userIds.length > 0) {
        await tx.userPermissionGroup.createMany({
          data: userIds.map((userId: string) => ({
            groupId,
            userId
          }))
        })
      }
    })

    // 获取更新后的权限组信息
    const updatedGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                lastLoginAt: true
              }
            }
          }
        }
      }
    })

    console.log('✅ [权限组用户API] 权限组用户更新成功:', groupId)

    return NextResponse.json({
      success: true,
      data: {
        group: {
          id: updatedGroup!.id,
          name: updatedGroup!.name,
          description: updatedGroup!.description
        },
        users: updatedGroup!.users.map(u => u.user)
      },
      message: '权限组用户更新成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组用户API] 更新权限组用户错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '更新权限组用户失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
