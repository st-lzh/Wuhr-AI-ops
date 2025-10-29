import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  successResponse,
  errorResponse,
  serverErrorResponse
} from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取当前用户资料
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user

    // 从数据库获取完整的用户信息
    const prisma = await getPrismaClient()
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        approvalStatus: true,
        createdAt: true,
        lastLoginAt: true,
        approvedAt: true,
        realName: true,
        phone: true,
        department: true,
        avatar: true,
        approver: {
          select: {
            username: true
          }
        }
      }
    })

    if (!userProfile) {
      return errorResponse('用户不存在', '找不到用户信息', 404)
    }

    return successResponse({
      user: userProfile
    })

  } catch (error) {
    console.error('❌ 获取用户资料失败:', error)
    return serverErrorResponse(error)
  }
}

// 更新当前用户资料
export async function PUT(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user
    const body = await request.json()
    const { email, realName, phone, department } = body

    // 验证输入数据
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('邮箱格式错误', '请输入有效的邮箱地址', 400)
    }

    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return errorResponse('手机号格式错误', '请输入有效的手机号码', 400)
    }

    const prisma = await getPrismaClient()

    // 检查邮箱是否已被其他用户使用
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser && existingUser.id !== user.id) {
        return errorResponse('邮箱已被使用', '该邮箱地址已被其他用户使用', 400)
      }
    }

    // 构建更新数据
    const updateData: any = {
      updatedAt: new Date()
    }

    if (email) updateData.email = email
    if (realName !== undefined) updateData.realName = realName || null
    if (phone !== undefined) updateData.phone = phone || null
    if (department !== undefined) updateData.department = department || null

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        approvalStatus: true,
        createdAt: true,
        lastLoginAt: true,
        approvedAt: true,
        realName: true,
        phone: true,
        department: true,
        avatar: true,
        updatedAt: true
      }
    })

    return successResponse({
      user: updatedUser,
      message: '个人资料更新成功'
    })

  } catch (error) {
    console.error('❌ 更新用户资料失败:', error)
    return serverErrorResponse(error)
  }
}