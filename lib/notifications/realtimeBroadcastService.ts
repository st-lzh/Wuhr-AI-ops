import Redis from 'ioredis'

export interface RealtimeNotificationPayload {
  type: string
  deploymentId?: string
  status?: string
  userId?: string
  data?: unknown
}

const globalForRealtimeRedis = globalThis as typeof globalThis & {
  realtimeNotificationRedis?: Redis
}

function getRealtimeRedis(): Redis {
  if (!globalForRealtimeRedis.realtimeNotificationRedis) {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })

    redis.on('error', (error) => {
      console.error('❌ [RealtimeNotification] Redis连接错误:', error.message)
    })

    globalForRealtimeRedis.realtimeNotificationRedis = redis
  }

  return globalForRealtimeRedis.realtimeNotificationRedis
}

export async function broadcastRealtimeNotification(
  payload: RealtimeNotificationPayload
): Promise<void> {
  const redis = getRealtimeRedis()
  const notificationData = {
    type: payload.type,
    deploymentId: payload.deploymentId,
    status: payload.status,
    timestamp: new Date().toISOString(),
    data: payload.data,
  }

  if (payload.userId) {
    await redis.publish(
      `user:${payload.userId}:notifications`,
      JSON.stringify({
        type: 'deployment_status_update',
        data: notificationData,
      })
    )
  }

  if (payload.type === 'system_announcement') {
    await redis.publish(
      'global:notifications',
      JSON.stringify({
        type: 'system_notification',
        data: notificationData,
      })
    )
  }
}

export async function getRealtimeBroadcastStatus() {
  const redis = getRealtimeRedis()
  const connectedClients = await redis.pubsub('NUMSUB', 'global:notifications')

  return {
    redisStatus: redis.status,
    connectedClients: connectedClients[1] || 0,
    timestamp: new Date().toISOString(),
  }
}
