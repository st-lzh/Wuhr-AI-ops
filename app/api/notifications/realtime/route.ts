import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import Redis from 'ioredis'

// Redis配置 - 优化连接管理
const createRedisConnection = () => new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

// GET /api/notifications/realtime - 建立SSE连接获取实时通知
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    console.log('🔗 [Realtime Notifications] 建立SSE连接:', { userId: user.id })

    // 创建SSE响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        let isControllerClosed = false
        let subscriber: Redis | null = null
        let heartbeatInterval: NodeJS.Timeout | null = null
        
        // 发送初始连接确认
        const sendMessage = (data: any) => {
          if (isControllerClosed) return
          try {
            const message = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(message))
          } catch (error) {
            console.error('❌ [Realtime Notifications] 发送消息失败:', error)
          }
        }

        sendMessage({
          type: 'connected',
          message: '实时通知连接已建立',
          timestamp: new Date().toISOString()
        })

        // 创建Redis订阅连接
        subscriber = createRedisConnection()
        const channel = `user:${user.id}:notifications`
        
        subscriber.on('connect', () => {
          console.log(`📡 [Realtime Notifications] Redis连接已建立，订阅频道: ${channel}`)
        })

        subscriber.on('error', (err) => {
          console.error('❌ [Realtime Notifications] Redis连接错误:', err)
          cleanup()
        })
        
        subscriber.subscribe(channel, (err) => {
          if (err) {
            console.error('❌ [Realtime Notifications] Redis订阅失败:', err)
            cleanup()
            return
          }
          console.log(`📡 [Realtime Notifications] 已订阅频道: ${channel}`)
        })

        subscriber.on('message', (receivedChannel, message) => {
          if (receivedChannel === channel && !isControllerClosed) {
            try {
              const notification = JSON.parse(message)
              sendMessage(notification)
              console.log(`📬 [Realtime Notifications] 推送通知给用户 ${user.id}:`, notification.type)
            } catch (error) {
              console.error('❌ [Realtime Notifications] 解析通知消息失败:', error)
            }
          }
        })

        // 优化心跳机制 - 减少频率，增加错误处理
        heartbeatInterval = setInterval(() => {
          if (isControllerClosed) {
            cleanup()
            return
          }
          
          sendMessage({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })
        }, 60000) // 改为60秒心跳，减少频率

        // 清理函数
        const cleanup = () => {
          if (isControllerClosed) return
          
          console.log(`🔌 [Realtime Notifications] 清理用户 ${user.id} 的连接`)
          isControllerClosed = true
          
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          
          if (subscriber) {
            try {
              subscriber.unsubscribe(channel)
              subscriber.disconnect()
            } catch (error) {
              console.error('❌ [Realtime Notifications] 清理Redis连接失败:', error)
            }
            subscriber = null
          }
          
          try {
            controller.close()
          } catch (error) {
            // 忽略关闭错误
          }
        }

        // 处理连接关闭
        request.signal.addEventListener('abort', cleanup)
        
        // 添加额外的清理保护
        setTimeout(() => {
          if (request.signal.aborted) {
            cleanup()
          }
        }, 1000)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error: any) {
    console.error('❌ [Realtime Notifications] 建立SSE连接失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '建立实时连接失败'
    }, { status: 500 })
  }
}

// POST /api/notifications/realtime - 测试推送通知（开发用）
export async function POST(request: NextRequest) {
  let redis: Redis | null = null
  
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 只有管理员可以测试推送
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '您没有权限测试推送通知'
      }, { status: 403 })
    }

    const body = await request.json()
    const { targetUserId, type = 'test', title = '测试通知', content = '这是一条测试通知' } = body

    if (!targetUserId) {
      return NextResponse.json({
        success: false,
        error: '目标用户ID不能为空'
      }, { status: 400 })
    }

    console.log('🧪 [Realtime Notifications] 测试推送通知:', {
      targetUserId,
      type,
      title,
      adminId: user.id
    })

    // 创建Redis连接用于推送
    redis = createRedisConnection()
    await redis.connect()
    
    // 推送测试通知
    const channel = `user:${targetUserId}:notifications`
    const notification = {
      type: 'info_notification',
      data: {
        id: `test_${Date.now()}`,
        type,
        title,
        content,
        actionUrl: '/notifications',
        actionText: '查看详情',
        metadata: {
          isTest: true,
          sentBy: user.realName || user.username
        },
        createdAt: new Date().toISOString()
      }
    }

    await redis.publish(channel, JSON.stringify(notification))
    await redis.disconnect()

    return NextResponse.json({
      success: true,
      data: {
        message: '测试通知已推送',
        targetUserId,
        notification
      }
    })

  } catch (error: any) {
    console.error('❌ [Realtime Notifications] 测试推送失败:', error)
    
    // 确保清理连接
    if (redis) {
      try {
        redis.disconnect()
      } catch (err) {
        console.error('清理Redis连接失败:', err)
      }
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || '测试推送失败'
    }, { status: 500 })
  }
}
