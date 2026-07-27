import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { emailNotificationService } from '../../../../lib/notifications/email'

// 获取注册申请列表
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '权限不足，只有管理员可以查看注册申请'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    console.log('📋 获取注册申请列表:', { status, page, limit })

    const prisma = await getPrismaClient()

    // 获取注册申请列表
    const registrations = await prisma.userRegistration.findMany({
      where: status === 'ALL' ? {} : { status: status as any },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        reason: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedBy: true,
        reviewNote: true
      }
    })

    // 获取总数
    const total = await prisma.userRegistration.count({
      where: status === 'ALL' ? {} : { status: status as any }
    })

    console.log('✅ 获取注册申请成功:', { count: registrations.length, total })

    return NextResponse.json({
      success: true,
      data: {
        registrations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取注册申请失败:', error)
    return NextResponse.json({
      success: false,
      message: '获取注册申请失败'
    }, { status: 500 })
  }
}

// 审批注册申请
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '权限不足，只有管理员可以审批注册申请'
      }, { status: 403 })
    }

    const body = await request.json()
    const { registrationId, action, reviewNote } = body

    if (!registrationId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({
        success: false,
        message: '参数错误'
      }, { status: 400 })
    }

    console.log('🔍 审批注册申请:', { registrationId, action, reviewNote })

    const prisma = await getPrismaClient()

    // 获取注册申请
    const registration = await prisma.userRegistration.findUnique({
      where: { id: registrationId }
    })

    if (!registration) {
      return NextResponse.json({
        success: false,
        message: '注册申请不存在'
      }, { status: 404 })
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        message: '该申请已被处理'
      }, { status: 400 })
    }

    // 审批状态与账号创建必须在同一事务中，避免出现“已批准但无账号”。
    const updatedRegistration = await prisma.$transaction(async tx => {
      const updated = await tx.userRegistration.update({
        where: { id: registrationId },
        data: {
          status: action,
          reviewedAt: new Date(),
          reviewedBy: authResult.user.id,
          reviewNote
        }
      })
      if (action === 'APPROVED') {
        await tx.user.create({
          data: {
            username: registration.username,
            email: registration.email,
            password: registration.password,
            realName: registration.realName,
            role: 'viewer',
            permissions: ['users:read', 'cicd:read', 'servers:read', 'config:read'],
            isActive: true,
            approvalStatus: 'approved',
            approvedBy: authResult.user.id,
            approvedAt: new Date()
          }
        })
      }
      return updated
    })

    const emailResult = await emailNotificationService.sendEmail({
      to: [registration.email],
      subject: action === 'APPROVED' ? 'Wuhr AI Ops 注册申请已通过' : 'Wuhr AI Ops 注册申请结果',
      textContent: action === 'APPROVED'
        ? `您好 ${registration.username}，您的注册申请已通过，现在可以登录 Wuhr AI Ops。`
        : `您好 ${registration.username}，您的注册申请未通过。${reviewNote ? `审核说明：${reviewNote}` : ''}`,
      htmlContent: action === 'APPROVED'
        ? `<p>您好 ${escapeHtml(registration.username)}，您的注册申请已通过，现在可以登录 Wuhr AI Ops。</p>`
        : `<p>您好 ${escapeHtml(registration.username)}，您的注册申请未通过。</p>${reviewNote ? `<p>审核说明：${escapeHtml(reviewNote)}</p>` : ''}`
    })

    console.log('✅ 注册申请审批完成:', {
      registrationId,
      action,
      username: registration.username
    })

    return NextResponse.json({
      success: true,
      message: action === 'APPROVED' ? '申请已批准，用户账户已创建' : '申请已拒绝',
      data: updatedRegistration,
      notification: { sent: emailResult.success, error: emailResult.error }
    })

  } catch (error) {
    console.error('❌ 审批注册申请失败:', error)
    return NextResponse.json({
      success: false,
      message: '审批失败'
    }, { status: 500 })
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] || character)
}
