import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


// GET /api/users/permissions - 获取用户权限列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限 - admin角色自动拥有所有权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('users:read')) {
      return NextResponse.json(
        { success: false, error: '没有权限查看用户权限' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    
    // 获取URL参数
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const role = searchParams.get('role')
    
    console.log('🔐 [用户权限API] 获取用户权限列表:', {
      requestUserId: user.id,
      targetUserId: userId,
      page,
      pageSize,
      role
    })

    // 构建查询条件
    const whereClause: any = {}
    if (userId) {
      whereClause.id = userId
    }
    if (role) {
      whereClause.role = role
    }

    // 查询用户
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          username: true,
          email: true,
          realName: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereClause })
    ])

    // 获取所有权限定义用于显示权限名称
    const allPermissions = await prisma.permission.findMany({
      select: {
        code: true,
        name: true,
        category: true
      }
    })

    const permissionMap: Record<string, any> = {}
    allPermissions.forEach(perm => {
      permissionMap[perm.code] = perm
    })

    // 格式化用户数据，添加权限详情
    const formattedUsers = users.map(user => ({
      ...user,
      permissionDetails: user.permissions.map(permCode => ({
        code: permCode,
        name: permissionMap[permCode]?.name || permCode,
        category: permissionMap[permCode]?.category || '未知'
      }))
    }))

    console.log('✅ [用户权限API] 查询成功:', {
      totalUsers: total,
      returnedUsers: users.length,
      totalPermissions: allPermissions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [用户权限API] 获取用户权限列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取用户权限列表失败' },
      { status: 500 }
    )
  }
}

// PUT /api/users/permissions - 更新用户权限
export async function PUT(request: NextRequest) {
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
        { success: false, error: '没有权限修改用户权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, permissions, action } = body

    console.log('🔐 [用户权限API] 更新用户权限:', {
      requestUserId: user.id,
      targetUserId: userId,
      action,
      permissionsCount: permissions?.length
    })

    // 验证必填字段
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '用户ID为必填项' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 防止用户修改自己的权限（除非是超级管理员）
    if (userId === user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '不能修改自己的权限' },
        { status: 403 }
      )
    }

    let newPermissions = []

    if (action === 'replace') {
      // 替换所有权限
      newPermissions = permissions || []
    } else if (action === 'add') {
      // 添加权限
      newPermissions = Array.from(new Set([...targetUser.permissions, ...(permissions || [])]))
    } else if (action === 'remove') {
      // 移除权限
      newPermissions = targetUser.permissions.filter(perm => !permissions.includes(perm))
    } else {
      return NextResponse.json(
        { success: false, error: '无效的操作类型' },
        { status: 400 }
      )
    }

    // 验证权限代码是否有效
    if (newPermissions.length > 0) {
      const validPermissions = await prisma.permission.findMany({
        where: {
          code: { in: newPermissions }
        },
        select: { code: true }
      })

      const validCodes = validPermissions.map(p => p.code)
      const invalidCodes = newPermissions.filter((code: string) => !validCodes.includes(code))

      if (invalidCodes.length > 0) {
        return NextResponse.json(
          { success: false, error: `无效的权限代码: ${invalidCodes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // 更新用户权限
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        permissions: newPermissions,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        role: true,
        permissions: true,
        updatedAt: true
      }
    })

    console.log('✅ [用户权限API] 用户权限更新成功:', {
      userId: updatedUser.id,
      username: updatedUser.username,
      oldPermissionsCount: targetUser.permissions.length,
      newPermissionsCount: updatedUser.permissions.length
    })

    return NextResponse.json({
      success: true,
      data: {
        user: updatedUser,
        changes: {
          action,
          oldPermissions: targetUser.permissions,
          newPermissions: updatedUser.permissions,
          added: updatedUser.permissions.filter(p => !targetUser.permissions.includes(p)),
          removed: targetUser.permissions.filter(p => !updatedUser.permissions.includes(p))
        }
      },
      message: '用户权限更新成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [用户权限API] 更新用户权限失败:', error)
    return NextResponse.json(
      { success: false, error: '更新用户权限失败' },
      { status: 500 }
    )
  }
}
