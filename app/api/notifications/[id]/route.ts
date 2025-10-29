// 单个通知操作API路由
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { systemNotificationService } from '../../../../lib/notifications/system'

// PATCH /api/notifications/[id] - 标记为已读
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user
    const messageId = params.id

    const body = await request.json()
    const { action } = body

    if (action === 'markAsRead') {
      const success = await systemNotificationService.markAsRead(user.id, messageId)
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: '已标记为已读'
        })
      } else {
        return NextResponse.json(
          { success: false, error: '消息不存在或已被删除' },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { success: false, error: '不支持的操作' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('操作通知失败:', error)
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications/[id] - 删除通知
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user
    const messageId = params.id

    const success = await systemNotificationService.deleteMessage(user.id, messageId)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: '通知已删除'
      })
    } else {
      return NextResponse.json(
        { success: false, error: '消息不存在或已被删除' },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('删除通知失败:', error)
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    )
  }
}
