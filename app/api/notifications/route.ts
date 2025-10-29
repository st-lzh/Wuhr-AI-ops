// 系统通知API路由
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers'
import { systemNotificationService } from '../../../lib/notifications/system'

// GET /api/notifications - 获取用户通知
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user
    
    const url = new URL(request.url)
    const includeRead = url.searchParams.get('includeRead') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const messages = await systemNotificationService.getMessages(user.id, {
      includeRead,
      limit,
      offset
    })

    const unreadCount = includeRead 
      ? (await systemNotificationService.getUnreadMessages(user.id)).length
      : messages.filter(msg => !msg.isRead).length

    return NextResponse.json({
      success: true,
      data: {
        messages,
        total: messages.length,
        unreadCount,
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit
        }
      }
    })

  } catch (error) {
    console.error('获取通知失败:', error)
    return NextResponse.json(
      { success: false, error: '获取通知失败' },
      { status: 500 }
    )
  }
}

// POST /api/notifications - 创建通知 (管理员功能)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user
    
    // 检查权限
    if (!user.roles.some((role: any) => ['admin', 'manager'].includes(role.name))) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, type, title, content, actionUrl, actionText, expiredAt } = body

    if (!userId || !type || !title || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const message = await systemNotificationService.createMessage(
      userId,
      type,
      title,
      content,
      {
        actionUrl,
        actionText,
        expiredAt: expiredAt ? new Date(expiredAt) : undefined
      }
    )

    return NextResponse.json({
      success: true,
      data: message
    })

  } catch (error) {
    console.error('创建通知失败:', error)
    return NextResponse.json(
      { success: false, error: '创建通知失败' },
      { status: 500 }
    )
  }
}
