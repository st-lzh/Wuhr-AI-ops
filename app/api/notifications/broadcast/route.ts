import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import Redis from 'ioredis'

// Redis配置
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
})

// POST /api/notifications/broadcast - 广播实时通知
export async function POST(request: NextRequest) {
  try {
    // 内部API调用，跳过认证（但可以添加API密钥验证）
    const { type, deploymentId, status, userId, data } = await request.json()

    console.log('📡 [Broadcast] 广播实时通知:', { type, deploymentId, status, userId })

    // 构建通知数据
    const notificationData = {
      type,
      deploymentId,
      status,
      timestamp: new Date().toISOString(),
      data
    }

    // 发送给特定用户
    if (userId) {
      const userChannel = `user:${userId}:notifications`
      await redis.publish(userChannel, JSON.stringify({
        type: 'deployment_status_update',
        data: notificationData
      }))
      console.log(`📡 [Broadcast] 已发送给用户 ${userId}`)
    }

    // 发送给所有在线用户（可选）
    if (type === 'system_announcement') {
      await redis.publish('global:notifications', JSON.stringify({
        type: 'system_notification',
        data: notificationData
      }))
      console.log('📡 [Broadcast] 已发送全局通知')
    }

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

    // 检查Redis连接状态
    const redisStatus = redis.status
    const connectedClients = await redis.pubsub('NUMSUB', 'global:notifications')

    return NextResponse.json({
      success: true,
      data: {
        redisStatus,
        connectedClients: connectedClients[1] || 0,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ [Broadcast] 获取广播状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取广播状态失败'
    }, { status: 500 })
  }
}
