import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../lib/config/database'
import { hashPassword, validatePassword } from '../../../lib/auth/password'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'

// 检查是否为管理员
function isAdmin(user: any): boolean {
  return user.role === 'admin'
}

// 获取用户列表
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const currentUser = authResult.user

    // 管理员可以看到所有用户详情，普通用户只能看到基本信息
    const isAdminUser = isAdmin(currentUser)

    console.log(`📋 获取用户列表 - 请求者: ${currentUser.username} (${currentUser.role})`)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100)
    const role = searchParams.get('role')
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'

    const prisma = await getPrismaClient()

    // 构建查询条件
    const where: any = {}

    // 状态过滤
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }
    // status === 'all' 时不设置isActive过滤

    // 搜索条件
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { realName: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 角色过滤
    if (role && role !== 'all') {
      where.role = role
    }

    // 获取总数
    const total = await prisma.user.count({ where })

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
        realName: true,
        phone: true,
        department: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        // 不返回敏感信息
        password: false
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    })

    console.log(`✅ 获取用户列表成功，共 ${users.length}/${total} 个用户`)

    return NextResponse.json({
      success: true,
      data: {
        users,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    })

  } catch (error) {
    console.error('❌ 获取用户列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取用户列表失败'
    }, { status: 500 })
  }
}

// 创建新用户
export async function POST(request: NextRequest) {
  try {
    // 权限检查 - 只有管理员可以创建用户
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const currentUser = authResult.user
    if (!isAdmin(currentUser)) {
      return NextResponse.json({
        success: false,
        error: '权限不足，只有管理员可以创建用户'
      }, { status: 403 })
    }

    // 获取请求数据
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

    console.log(`📝 创建新用户 - 操作者: ${currentUser.username}, 目标用户: ${username}`)

    // 参数验证
    if (!username || !email || !password) {
      return NextResponse.json({
        success: false,
        error: '用户名、邮箱和密码为必填项'
      }, { status: 400 })
    }

    // 用户名长度验证
    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({
        success: false,
        error: '用户名长度必须在3-50个字符之间'
      }, { status: 400 })
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: '邮箱格式不正确'
      }, { status: 400 })
    }

    // 角色验证
    const validRoles = ['admin', 'manager', 'developer', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({
        success: false,
        error: '无效的角色'
      }, { status: 400 })
    }

    // 密码强度验证
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: '密码不符合要求',
        details: passwordValidation.errors.join('; ')
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUsername) {
      return NextResponse.json({
        success: false,
        error: '用户名已存在'
      }, { status: 400 })
    }

    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return NextResponse.json({
        success: false,
        error: '邮箱已被注册'
      }, { status: 400 })
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
        approvalStatus: true,
        realName: true,
        phone: true,
        department: true,
        createdAt: true
      }
    })

    console.log(`✅ 创建用户成功: ${newUser.username} (${newUser.role})`)

    return NextResponse.json({
      success: true,
      data: newUser,
      message: '用户创建成功'
    }, { status: 201 })

  } catch (error) {
    console.error('❌ 创建用户失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建用户失败'
    }, { status: 500 })
  }
}

// 更新用户
export async function PUT(request: NextRequest) {
  try {
    // 权限检查 - 只有管理员可以更新用户
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const currentUser = authResult.user
    if (!isAdmin(currentUser)) {
      return NextResponse.json({
        success: false,
        error: '权限不足，只有管理员可以更新用户'
      }, { status: 403 })
    }

    // 获取请求数据
    const body = await request.json()
    const {
      id,
      username,
      email,
      password, // 可选，不填则不修改
      role,
      permissions,
      isActive,
      realName,
      phone,
      department
    } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '用户ID为必填项'
      }, { status: 400 })
    }

    console.log(`📝 更新用户 - 操作者: ${currentUser.username}, 目标用户ID: ${id}`)

    const prisma = await getPrismaClient()

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 不能修改自己的角色和权限
    if (targetUser.id === currentUser.id && (role || permissions)) {
      return NextResponse.json({
        success: false,
        error: '不能修改自己的角色和权限'
      }, { status: 403 })
    }

    // 构建更新数据
    const updateData: any = {}

    // 如果要更新用户名，检查是否重复（排除自己）
    if (username && username !== targetUser.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username }
      })
      if (existingUsername && existingUsername.id !== id) {
        return NextResponse.json({
          success: false,
          error: '用户名已存在'
        }, { status: 400 })
      }
      updateData.username = username
    }

    // 如果要更新邮箱，检查是否重复（排除自己）
    if (email && email !== targetUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({
          success: false,
          error: '邮箱格式不正确'
        }, { status: 400 })
      }

      const existingEmail = await prisma.user.findUnique({
        where: { email }
      })
      if (existingEmail && existingEmail.id !== id) {
        return NextResponse.json({
          success: false,
          error: '邮箱已被注册'
        }, { status: 400 })
      }
      updateData.email = email
    }

    // 如果提供了新密码，验证并加密
    if (password) {
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        return NextResponse.json({
          success: false,
          error: '密码不符合要求',
          details: passwordValidation.errors.join('; ')
        }, { status: 400 })
      }
      updateData.password = await hashPassword(password)
    }

    // 更新其他字段
    if (role !== undefined) {
      const validRoles = ['admin', 'manager', 'developer', 'viewer']
      if (!validRoles.includes(role)) {
        return NextResponse.json({
          success: false,
          error: '无效的角色'
        }, { status: 400 })
      }
      updateData.role = role
    }

    if (permissions !== undefined) {
      updateData.permissions = permissions
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    if (realName !== undefined) {
      updateData.realName = realName
    }

    if (phone !== undefined) {
      updateData.phone = phone
    }

    if (department !== undefined) {
      updateData.department = department
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
        lastLoginAt: true
      }
    })

    console.log(`✅ 更新用户成功: ${updatedUser.username}`)

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: '用户更新成功'
    })

  } catch (error) {
    console.error('❌ 更新用户失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新用户失败'
    }, { status: 500 })
  }
}

// 删除用户（软删除）
export async function DELETE(request: NextRequest) {
  try {
    // 权限检查 - 只有管理员可以删除用户
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const currentUser = authResult.user
    if (!isAdmin(currentUser)) {
      return NextResponse.json({
        success: false,
        error: '权限不足，只有管理员可以删除用户'
      }, { status: 403 })
    }

    // 从URL参数获取用户ID
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '用户ID为必填项'
      }, { status: 400 })
    }

    console.log(`🗑️ 删除用户 - 操作者: ${currentUser.username}, 目标用户ID: ${id}`)

    // 不能删除自己
    if (id === currentUser.id) {
      return NextResponse.json({
        success: false,
        error: '不能删除自己'
      }, { status: 403 })
    }

    const prisma = await getPrismaClient()

    // 检查用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 禁止删除超级管理员
    if (targetUser.email === 'admin@wuhr.ai' || targetUser.username === 'admin') {
      return NextResponse.json({
        success: false,
        error: '超级管理员用户不能被删除'
      }, { status: 403 })
    }

    // 真删除：从数据库中删除用户记录
    await prisma.user.delete({
      where: { id }
    })

    console.log(`✅ 删除用户成功: ${targetUser.username}`)

    return NextResponse.json({
      success: true,
      message: '用户已删除'
    })

  } catch (error) {
    console.error('❌ 删除用户失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除用户失败'
    }, { status: 500 })
  }
}
