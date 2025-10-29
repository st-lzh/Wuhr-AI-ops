import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 验证新密码强度
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: '新密码至少8个字符' },
        { status: 400 }
      )
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: '密码必须包含大小写字母和数字' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 获取当前用户信息
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.id },
      select: { id: true, password: true }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 400 }
      )
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return NextResponse.json(
        { success: false, error: '新密码不能与当前密码相同' },
        { status: 400 }
      )
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // 更新密码
    await prisma.user.update({
      where: { id: authResult.user.id },
      data: { 
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    })

    // 记录密码修改日志
    try {
      await prisma.authLog.create({
        data: {
          userId: authResult.user.id,
          action: 'password_change',
          success: true,
          ipAddress: request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          timestamp: new Date()
        }
      })
    } catch (logError) {
      console.error('记录密码修改日志失败:', logError)
    }

    return NextResponse.json({
      success: true,
      data: { message: '密码修改成功' }
    })

  } catch (error) {
    console.error('修改密码失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    )
  }
}