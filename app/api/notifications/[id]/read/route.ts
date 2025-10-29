import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import NotificationService from '../../../../services/notificationService'

// 标记通知为已读
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const notificationId = params.id

    if (!notificationId) {
      return NextResponse.json({
        success: false,
        error: '缺少通知ID'
      }, { status: 400 })
    }

    // 标记通知为已读
    const notification = await NotificationService.markAsRead(notificationId)

    return NextResponse.json({
      success: true,
      data: {
        message: '通知已标记为已读',
        notification
      }
    })

  } catch (error) {
    console.error('❌ 标记通知已读失败:', error)
    return NextResponse.json({
      success: false,
      error: '标记通知已读失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
