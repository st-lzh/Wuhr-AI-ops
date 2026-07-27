import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import {
  broadcastRealtimeNotification,
  getRealtimeBroadcastStatus,
} from '../../../../lib/notifications/realtimeBroadcastService'

// POST /api/notifications/broadcast - 广播实时通知
export async function POST(request: NextRequest) {
  try {
    // 内部API调用，跳过认证（但可以添加API密钥验证）
    const { type, deploymentId, status, userId, data } = await request.json()

    console.log('📡 [Broadcast] 广播实时通知:', { type, deploymentId, status, userId })

    await broadcastRealtimeNotification({ type, deploymentId, status, userId, data })

    return NextResponse.json({
      success: true,
      message: '实时通知已广播'
    })

  } catch (error) {
    console.error('❌ [Broadcast] 广播实时通知失败:', error)
    return NextResponse.json({
      success: false,
      error: '广播实时通知失败'
    }, { status: 500 })
  }
}

// GET /api/notifications/broadcast - 获取广播状态
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const status = await getRealtimeBroadcastStatus()

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('❌ [Broadcast] 获取广播状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取广播状态失败'
    }, { status: 500 })
  }
}
