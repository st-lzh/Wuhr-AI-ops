// 信息通知服务 - 处理非审批类通知
import { getPrismaClient } from '../config/database'
import Redis from 'ioredis'

// Redis配置
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  // 路由模块会在 Next.js 构建阶段被加载，连接必须等到真正执行通知操作时再建立。
  lazyConnect: true,
})

redis.on('error', (error) => {
  console.error('❌ [Info Notification] Redis连接错误:', error.message)
})

export interface InfoNotificationData {
  type: string
  title: string
  content: string
  userId: string
  actionUrl?: string
  actionText?: string
  metadata?: Record<string, any>
  expiresAt?: Date
}

export class InfoNotificationService {
  private static instance: InfoNotificationService

  public static getInstance(): InfoNotificationService {
    if (!InfoNotificationService.instance) {
      InfoNotificationService.instance = new InfoNotificationService()
    }
    return InfoNotificationService.instance
  }

  // 直接使用全局Prisma客户端，不缓存
  private async getPrisma() {
    return await getPrismaClient()
  }

  // 创建信息通知
  async createNotification(data: InfoNotificationData): Promise<string> {
    try {
      const prisma = await this.getPrisma()

      const notification = await prisma.infoNotification.create({
        data: {
          type: data.type,
          title: data.title,
          content: data.content,
          userId: data.userId,
          actionUrl: data.actionUrl,
          actionText: data.actionText,
          metadata: data.metadata || {},
          expiresAt: data.expiresAt
        }
      })

      // 推送到Redis实时通知
      await this.pushToRedis(notification.userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
        metadata: notification.metadata,
        createdAt: notification.createdAt.toISOString()
      })

      console.log(`📬 [Info Notification] 信息通知已创建: ${data.title} (用户: ${data.userId})`)
      return notification.id

    } catch (error) {
      console.error('❌ [Info Notification] 创建信息通知失败:', error)
      throw error
    }
  }

  // 批量创建通知
  async createBatchNotifications(notifications: InfoNotificationData[]): Promise<string[]> {
    const ids: string[] = []

    for (const notification of notifications) {
      try {
        const id = await this.createNotification(notification)
        ids.push(id)
      } catch (error) {
        console.error('❌ [Info Notification] 批量创建通知失败:', error)
      }
    }

    return ids
  }

  // 批量创建审批通知（特殊处理）
  async createBatchApprovalNotifications(notifications: any[]): Promise<string[]> {
    const ids: string[] = []

    for (const notification of notifications) {
      try {
        // 为审批通知添加特殊标识
        const approvalNotification = {
          ...notification,
          metadata: {
            ...notification.metadata,
            isApprovalNotification: true // 标识为审批通知
          }
        }

        const id = await this.createNotification(approvalNotification)
        ids.push(id)

        // 实时通知在前端通过轮询获取，不需要单独发送

      } catch (error) {
        console.error('❌ [Info Notification] 批量创建审批通知失败:', error)
      }
    }

    return ids
  }

  // 获取用户的信息通知
  async getUserNotifications(
    userId: string,
    options: {
      includeRead?: boolean
      limit?: number
      offset?: number
      type?: string
    } = {}
  ) {
    try {
      const prisma = await this.getPrisma()
      const { includeRead = true, limit = 20, offset = 0, type } = options

      const where: any = {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }

      if (!includeRead) {
        where.isRead = false
      }

      if (type) {
        where.type = type
      }

      const [notifications, total] = await Promise.all([
        prisma.infoNotification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.infoNotification.count({ where })
      ])

      return {
        notifications,
        total,
        unreadCount: includeRead ? 
          await prisma.infoNotification.count({
            where: { ...where, isRead: false }
          }) : 
          notifications.filter((n: any) => !n.isRead).length
      }

    } catch (error) {
      console.error('❌ [Info Notification] 获取用户通知失败:', error)
      throw error
    }
  }

  // 标记通知为已读
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()
      
      const result = await prisma.infoNotification.updateMany({
        where: {
          id: notificationId,
          userId: userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

      return result.count > 0

    } catch (error) {
      console.error('❌ [Info Notification] 标记已读失败:', error)
      return false
    }
  }

  // 批量标记为已读
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const prisma = await this.getPrisma()
      
      const result = await prisma.infoNotification.updateMany({
        where: {
          userId: userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

      return result.count

    } catch (error) {
      console.error('❌ [Info Notification] 批量标记已读失败:', error)
      return 0
    }
  }

  // 删除通知
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()
      
      const result = await prisma.infoNotification.deleteMany({
        where: {
          id: notificationId,
          userId: userId
        }
      })

      return result.count > 0

    } catch (error) {
      console.error('❌ [Info Notification] 删除通知失败:', error)
      return false
    }
  }

  // 推送到Redis实时通知
  private async pushToRedis(userId: string, notification: any): Promise<void> {
    try {
      const channel = `user:${userId}:notifications`
      await redis.publish(channel, JSON.stringify({
        type: 'info_notification',
        data: notification
      }))

      // 同时存储到Redis列表中，用于离线用户
      const listKey = `user:${userId}:notification_queue`
      await redis.lpush(listKey, JSON.stringify(notification))
      await redis.ltrim(listKey, 0, 99) // 只保留最近100条
      await redis.expire(listKey, 7 * 24 * 60 * 60) // 7天过期

    } catch (error) {
      console.error('❌ [Info Notification] Redis推送失败:', error)
    }
  }

  // 获取Redis中的离线通知
  async getOfflineNotifications(userId: string): Promise<any[]> {
    try {
      const listKey = `user:${userId}:notification_queue`
      const notifications = await redis.lrange(listKey, 0, -1)
      
      // 清空队列
      await redis.del(listKey)
      
      return notifications.map(n => JSON.parse(n))

    } catch (error) {
      console.error('❌ [Info Notification] 获取离线通知失败:', error)
      return []
    }
  }

  // 清理过期通知
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const prisma = await this.getPrisma()
      
      const result = await prisma.infoNotification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })

      if (result.count > 0) {
        console.log(`🧹 [Info Notification] 清理了 ${result.count} 条过期通知`)
      }

      return result.count

    } catch (error) {
      console.error('❌ [Info Notification] 清理过期通知失败:', error)
      return 0
    }
  }
}

// 导出单例实例
export const infoNotificationService = InfoNotificationService.getInstance()

// 定期清理过期通知
if (typeof window === 'undefined') {
  setInterval(() => {
    infoNotificationService.cleanupExpiredNotifications().catch(console.error)
  }, 60 * 60 * 1000) // 每小时清理一次
}
