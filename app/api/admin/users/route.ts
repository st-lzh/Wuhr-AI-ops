import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  requirePermission
} from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { hashPassword, validatePassword } from '../../../../lib/auth/password'

// 获取用户列表
export async function GET(request: NextRequest) {
  try {
    // 权限检查 - 需要用户读取权限
    const authResult = await requirePermission(request, 'users:read')
    if (!authResult.success) {
      return authResult.response
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''
    const isActive = searchParams.get('isActive')

    const prisma = await getPrismaClient()

    // 构建查询条件
    const where: any = {}
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }
    if (role) {
      where.role = role
    }
    if (status) {
      where.approvalStatus = status
    }
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // 获取用户列表
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        approvalStatus: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        approvedBy: true,
        approvedAt: true,
        rejectedReason: true
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    // 获取总数
    const totalUsers = await prisma.user.count({ where })

    return successResponse({
      users,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    })

  } catch (error) {
    console.error('❌ 获取用户列表错误:', error)
    return serverErrorResponse(error)
  }
}

// 创建新用户
export async function POST(request: NextRequest) {
  try {
    // 权限检查 - 需要用户写入权限
    const authResult = await requirePermission(request, 'users:write')
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const {
      username,
      email,
      password,
      role = 'viewer',
      permissions = [],
      realName,
      phone,
      department
    } = body

    console.log(`📝 创建新用户 - 操作者: ${authResult.user.username}, 目标用户: ${username}`)

    // 参数验证
    if (!username || !email || !password) {
      return errorResponse('参数缺失', '用户名、邮箱和密码为必填项', 400)
    }

    // 用户名长度验证
    if (username.length < 3 || username.length > 50) {
      return errorResponse('用户名长度错误', '用户名长度必须在3-50个字符之间', 400)
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return errorResponse('邮箱格式错误', '邮箱格式不正确', 400)
    }

    // 角色验证
    const validRoles = ['admin', 'manager', 'developer', 'viewer']
    if (!validRoles.includes(role)) {
      return errorResponse('角色无效', '无效的角色', 400)
    }

    // 密码强度验证
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return errorResponse('密码不符合要求', passwordValidation.errors.join('; '), 400)
    }

    const prisma = await getPrismaClient()

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUsername) {
      return errorResponse('用户名已存在', '用户名已存在', 400)
    }

    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return errorResponse('邮箱已注册', '邮箱已被注册', 400)
    }

    // 加密密码
    const hashedPassword = await hashPassword(password)

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        permissions,
        realName,
        phone,
        department,
        isActive: true,
        approvalStatus: 'approved' // 管理员创建的用户直接通过审批
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        realName: true,
        phone: true,
        department: true,
        createdAt: true,
        updatedAt: true
      }
    })

    console.log(`✅ 用户创建成功: ${newUser.username} (${newUser.email})`)

    return successResponse({
      message: '用户创建成功',
      user: newUser
    })

  } catch (error) {
    console.error('❌ 创建用户失败:', error)
    return serverErrorResponse(error)
  }
}

// 更新用户信息
export async function PUT(request: NextRequest) {
  try {
    // 权限检查 - 需要用户写入权限
    const authResult = await requirePermission(request, 'users:write')
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { id, username, email, role, permissions } = body

    // 验证必要参数
    if (!id) {
      return errorResponse('缺少用户ID', '用户ID是必需的', 400)
    }

    const prisma = await getPrismaClient()

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return errorResponse('用户不存在', '指定的用户不存在', 404)
    }

    // 检查用户名和邮箱是否已被其他用户使用
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username }
      })
      if (usernameExists && usernameExists.id !== id) {
        return errorResponse('用户名已存在', '该用户名已被其他用户使用', 400)
      }
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      })
      if (emailExists && emailExists.id !== id) {
        return errorResponse('邮箱已存在', '该邮箱已被其他用户使用', 400)
      }
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(username && { username }),
        ...(email && { email }),
        ...(role && { role }),
        ...(permissions && { permissions }),
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        approvalStatus: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    console.log(`✅ 用户信息更新成功: ${updatedUser.username}`)

    return successResponse({
      message: '用户信息更新成功',
      user: updatedUser
    })

  } catch (error) {
    console.error('❌ 更新用户信息失败:', error)
    return serverErrorResponse(error)
  }
}

// 更新用户状态（激活/暂停、审批等）
export async function PATCH(request: NextRequest) {
  try {
    // 权限检查 - 需要用户写入权限
    const authResult = await requirePermission(request, 'users:write')
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { id, action, ...updateData } = body

    // 验证必要参数
    if (!id || !action) {
      return errorResponse('缺少必要参数', 'id和action是必需的', 400)
    }

    const prisma = await getPrismaClient()

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return errorResponse('用户不存在', '指定的用户不存在', 404)
    }

    let updatedUser
    let message = ''

    switch (action) {
      case 'toggle_status':
        // 切换用户激活状态
        const newIsActive = !existingUser.isActive
        updatedUser = await prisma.user.update({
          where: { id },
          data: {
            isActive: newIsActive,
            updatedAt: new Date()
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            permissions: true,
            isActive: true,
            approvalStatus: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true
          }
        })
        message = `用户已${newIsActive ? '激活' : '暂停'}`
        console.log(`✅ 用户状态切换成功: ${updatedUser.username} -> ${newIsActive ? '激活' : '暂停'}`)
        break

      case 'approve':
        // 审批用户
        // 检查用户状态
        const targetUser = await prisma.user.findUnique({
          where: { id },
          select: { username: true, email: true, approvalStatus: true }
        })

        if (!targetUser) {
          return errorResponse('用户不存在', '找不到指定的用户', 404)
        }

        if (targetUser.approvalStatus !== 'pending') {
          return errorResponse('用户已审批', '用户已经被审批过了', 400)
        }

        // 更新用户状态
        updatedUser = await prisma.user.update({
          where: { id },
          data: {
            approvalStatus: 'approved',
            isActive: true,
            approvedBy: authResult.user.id,
            approvedAt: new Date()
          }
        })

        message = '用户审批通过'
        console.log(`✅ 用户审批成功: ${updatedUser.username}`)
        break

      case 'reject':
        // 拒绝用户
        const { rejectedReason } = updateData
        if (!rejectedReason) {
          return errorResponse('缺少拒绝原因', '拒绝用户时必须提供原因', 400)
        }

        // 检查用户状态
        const targetUserReject = await prisma.user.findUnique({
          where: { id },
          select: { username: true, email: true, approvalStatus: true }
        })

        if (!targetUserReject) {
          return errorResponse('用户不存在', '找不到指定的用户', 404)
        }

        if (targetUserReject.approvalStatus !== 'pending') {
          return errorResponse('用户已审批', '用户已经被审批过了', 400)
        }

        // 更新用户状态
        updatedUser = await prisma.user.update({
          where: { id },
          data: {
            approvalStatus: 'rejected',
            isActive: false,
            approvedBy: authResult.user.id,
            approvedAt: new Date(),
            rejectedReason
          }
        })

        message = '用户已拒绝'
        console.log(`✅ 用户拒绝成功: ${updatedUser.username}`)
        break

      default:
        return errorResponse('无效的操作', `不支持的操作: ${action}`, 400)
    }

    return successResponse({
      message,
      user: updatedUser
    })

  } catch (error) {
    console.error('❌ 更新用户状态失败:', error)
    return serverErrorResponse(error)
  }
}

// 删除用户
export async function DELETE(request: NextRequest) {
  try {
    // 权限检查 - 需要用户删除权限
    const authResult = await requirePermission(request, 'users:delete')
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // 验证必要参数
    if (!id) {
      return errorResponse('缺少用户ID', '用户ID是必需的', 400)
    }

    const prisma = await getPrismaClient()

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true
      }
    })

    if (!existingUser) {
      return errorResponse('用户不存在', '指定的用户不存在', 404)
    }

    // 🛡️ 特别保护admin@wuhr.ai用户不被删除
    if (existingUser.email === 'admin@wuhr.ai') {
      return errorResponse(
        '无法删除系统核心管理员',
        'admin@wuhr.ai是系统核心管理员账户，受到特殊保护无法删除',
        403
      )
    }

    // 防止删除其他管理员账户
    if (existingUser.role === 'admin') {
      return errorResponse('无法删除管理员', '不能删除管理员账户', 403)
    }

    // 防止用户删除自己
    if (existingUser.id === authResult.user.id) {
      return errorResponse('无法删除自己', '不能删除自己的账户', 403)
    }

    // 删除用户
    await prisma.user.delete({
      where: { id }
    })

    console.log(`✅ 用户删除成功: ${existingUser.username}`)

    return successResponse({
      message: '用户删除成功',
      deletedUser: {
        id: existingUser.id,
        username: existingUser.username
      }
    })

  } catch (error) {
    console.error('❌ 删除用户失败:', error)
    return serverErrorResponse(error)
  }
}
