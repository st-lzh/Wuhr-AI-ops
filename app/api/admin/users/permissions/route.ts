import { NextRequest } from 'next/server'
import {
  validateRequest,
  successResponse,
  errorResponse,
  serverErrorResponse,
  requirePermission,
  ensureDbInitialized
} from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 更新用户权限
export async function PUT(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDbInitialized()

    // 权限检查 - 需要用户写入权限
    const authResult = await requirePermission(request, 'users:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 获取请求数据
    const body = await request.json()
    const { userId, permissions, role } = body

    if (!userId) {
      return errorResponse('缺少用户ID', undefined, 400)
    }

    if (!permissions && !role) {
      return errorResponse('需要提供权限列表或角色', undefined, 400)
    }

    // 检查用户是否存在
    const prisma = await getPrismaClient()
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })
    if (!existingUser) {
      return errorResponse('用户不存在', undefined, 404)
    }

    // 防止修改超级管理员权限
    if (existingUser.email === 'admin@wuhr.ai') {
      return errorResponse('不能修改超级管理员的权限', undefined, 403)
    }

    // 准备更新数据
    const updateData: any = {}
    
    if (permissions) {
      updateData.permissions = permissions
    }
    
    if (role) {
      updateData.role = role
    }

    // 更新用户权限
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    // 返回安全的用户信息
    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      permissions: updatedUser.permissions,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    }

    console.log('✅ 管理员更新用户权限成功:', { 
      userId, 
      username: updatedUser.username,
      newRole: role,
      newPermissions: permissions 
    })

    return successResponse({
      user: safeUser,
      message: '用户权限更新成功'
    })

  } catch (error) {
    console.error('❌ 更新用户权限错误:', error)
    return serverErrorResponse(error)
  }
}

// 获取可用权限列表
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'users:read')
    if (!authResult.success) {
      return authResult.response
    }

    // 定义可用权限
    const availablePermissions = [
      {
        category: '用户管理',
        permissions: [
          { name: 'users:read', description: '查看用户信息' },
          { name: 'users:write', description: '创建和编辑用户' },
          { name: 'users:delete', description: '删除用户' }
        ]
      },
      {
        category: 'CI/CD管理',
        permissions: [
          { name: 'cicd:read', description: '查看CI/CD信息' },
          { name: 'cicd:write', description: '创建和编辑CI/CD配置' },
          { name: 'cicd:deploy', description: '执行部署操作' },
          { name: 'cicd:all', description: 'CI/CD完全控制权限' }
        ]
      },
      {
        category: '服务器管理',
        permissions: [
          { name: 'servers:read', description: '查看服务器信息' },
          { name: 'servers:write', description: '管理服务器配置' },
          { name: 'servers:all', description: '服务器完全控制权限' }
        ]
      },
      {
        category: '系统配置',
        permissions: [
          { name: 'config:read', description: '查看系统配置' },
          { name: 'config:write', description: '修改系统配置' },
          { name: 'config:all', description: '系统配置完全控制权限' }
        ]
      }
    ]

    // 定义可用角色
    const availableRoles = [
      {
        name: 'admin',
        displayName: '系统管理员',
        description: '拥有所有权限的超级管理员',
        permissions: ['*']
      },
      {
        name: 'manager',
        displayName: '项目管理员', 
        description: '可以管理项目和部署',
        permissions: ['users:read', 'users:write', 'cicd:all', 'servers:read', 'config:read']
      },
      {
        name: 'developer',
        displayName: '开发者',
        description: '可以查看和操作CI/CD',
        permissions: ['users:read', 'cicd:read', 'cicd:write', 'servers:read', 'config:read']
      },
      {
        name: 'viewer',
        displayName: '只读用户',
        description: '只能查看系统信息',
        permissions: ['users:read', 'cicd:read', 'servers:read', 'config:read']
      }
    ]

    return successResponse({
      permissions: availablePermissions,
      roles: availableRoles
    })

  } catch (error) {
    console.error('❌ 获取权限列表错误:', error)
    return serverErrorResponse(error)
  }
}
