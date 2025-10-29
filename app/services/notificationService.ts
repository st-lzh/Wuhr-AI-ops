import { getPrismaClient } from '../../lib/config/database'

export interface NotificationData {
  type: 'user_registration' | 'user_approved' | 'user_rejected' | 'system_alert' | 'api_key_expired'
  title: string
  message: string
  userId: string
  data?: any
}

export class NotificationService {
  /**
   * 创建通知
   */
  static async createNotification(notificationData: NotificationData) {
    try {
      const prisma = await getPrismaClient()
      const notification = await prisma.notification.create({
        data: {
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          userId: notificationData.userId,
          data: notificationData.data || {}
        }
      })
      
      console.log(`✅ 通知已创建: ${notification.title}`)
      return notification
    } catch (error) {
      console.error('❌ 创建通知失败:', error)
      throw error
    }
  }

  /**
   * 通知所有管理员用户注册
   */
  static async notifyAdminsUserRegistration(newUser: { id: string, username: string, email: string }) {
    try {
      const prisma = await getPrismaClient()
      // 获取所有管理员
      const admins = await prisma.user.findMany({
        where: {
          role: 'admin',
          isActive: true,
          approvalStatus: 'approved'
        }
      })

      // 为每个管理员创建通知
      const notifications = await Promise.all(
        admins.map(admin => 
          this.createNotification({
            type: 'user_registration',
            title: '新用户注册待审批',
            message: `用户 ${newUser.username} (${newUser.email}) 已注册，等待您的审批。`,
            userId: admin.id,
            data: {
              newUserId: newUser.id,
              newUserEmail: newUser.email,
              newUserUsername: newUser.username
            }
          })
        )
      )

      console.log(`✅ 已通知 ${admins.length} 位管理员`)
      return notifications
    } catch (error) {
      console.error('❌ 通知管理员失败:', error)
      throw error
    }
  }

  /**
   * 通知用户审批结果
   */
  static async notifyUserApprovalResult(
    userId: string, 
    status: 'approved' | 'rejected', 
    approverName: string,
    rejectedReason?: string
  ) {
    try {
      const title = status === 'approved' ? '账户已激活' : '账户审批被拒绝'
      const message = status === 'approved' 
        ? `恭喜！您的账户已被管理员 ${approverName} 激活，现在可以正常使用系统了。`
        : `很抱歉，您的账户审批被管理员 ${approverName} 拒绝。${rejectedReason ? `原因：${rejectedReason}` : ''}`

      const notification = await this.createNotification({
        type: status === 'approved' ? 'user_approved' : 'user_rejected',
        title,
        message,
        userId,
        data: {
          approverName,
          rejectedReason: status === 'rejected' ? rejectedReason : undefined
        }
      })

      return notification
    } catch (error) {
      console.error('❌ 通知用户审批结果失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的未读通知
   */
  static async getUnreadNotifications(userId: string) {
    try {
      const prisma = await getPrismaClient()
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return notifications
    } catch (error) {
      console.error('❌ 获取未读通知失败:', error)
      throw error
    }
  }

  /**
   * 标记通知为已读
   */
  static async markAsRead(notificationId: string) {
    try {
      const prisma = await getPrismaClient()
      const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      })

      return notification
    } catch (error) {
      console.error('❌ 标记通知已读失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的所有通知（分页）
   */
  static async getUserNotifications(userId: string, page = 1, limit = 20) {
    try {
      const prisma = await getPrismaClient()
      const skip = (page - 1) * limit

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.notification.count({
          where: { userId }
        })
      ])

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      console.error('❌ 获取用户通知失败:', error)
      throw error
    }
  }

  /**
   * 获取未读通知数量
   */
  static async getUnreadCount(userId: string) {
    try {
      const prisma = await getPrismaClient()
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      })

      return count
    } catch (error) {
      console.error('❌ 获取未读通知数量失败:', error)
      return 0
    }
  }
}

export default NotificationService
