import { getPrismaClient } from '../config/database'

export interface NotificationData {
  title: string
  content: string
  category: 'deployment' | 'approval' | 'system' | 'alert'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  recipientIds: string[]
  senderId?: string
  relatedId?: string
  relatedType?: string
  metadata?: any
}

export interface ApprovalNotificationData {
  deploymentId: string
  deploymentName: string
  projectName: string
  environment: string
  requesterName: string
  approverIds: string[]
  senderId: string
}

/**
 * 通知服务 - 处理持续部署系统的通知创建和管理
 */
export class NotificationService {
  private prisma: any

  constructor() {
    this.prisma = null
  }

  private async getPrisma() {
    if (!this.prisma) {
      this.prisma = await getPrismaClient()
    }
    return this.prisma
  }

  /**
   * 创建通用通知
   */
  async createNotification(data: NotificationData): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()

      console.log(`🔔 创建通知: ${data.title} -> ${data.recipientIds.length} 个接收者`)

      // 为每个接收者创建通知记录（使用InfoNotification表结构）
      const notifications = data.recipientIds.map(recipientId => ({
        type: data.category, // 通知类型
        title: data.title, // 通知标题
        content: data.content, // 通知内容
        userId: recipientId, // 接收人ID
        isRead: false, // 是否已读
        actionUrl: data.metadata?.actionUrl || null, // 操作链接
        actionText: data.metadata?.actionText || null, // 操作按钮文本
        metadata: {
          ...data.metadata,
          senderId: data.senderId,
          relatedId: data.relatedId,
          relatedType: data.relatedType,
          priority: data.priority
        } // 元数据
      }))

      // 使用InfoNotification表来存储部署相关通知
      await prisma.infoNotification.createMany({
        data: notifications
      })

      console.log(`✅ 通知创建成功: ${notifications.length} 条`)
      return true

    } catch (error) {
      console.error('❌ 创建通知失败:', error)
      return false
    }
  }

  /**
   * 创建部署审批通知
   */
  async createApprovalNotification(data: ApprovalNotificationData): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()

      console.log(`🔔 创建审批通知: ${data.deploymentName} -> ${data.approverIds.length} 个审批人`)

      // 创建审批通知
      const notificationData: NotificationData = {
        title: `部署审批：${data.deploymentName}`,
        content: `项目 ${data.projectName} 在 ${data.environment.toUpperCase()} 环境的部署任务需要您的审批。申请人：${data.requesterName}`,
        category: 'approval',
        priority: data.environment === 'prod' ? 'high' : 'medium',
        recipientIds: data.approverIds,
        senderId: data.senderId,
        relatedId: data.deploymentId,
        relatedType: 'deployment',
        metadata: {
          deploymentId: data.deploymentId,
          environment: data.environment,
          projectName: data.projectName,
          action: 'approval_required',
          actionUrl: `/cicd/deployments?tab=pending`, // 审批页面链接
          actionText: '去审批' // 操作按钮文本
        }
      }

      return await this.createNotification(notificationData)

    } catch (error) {
      console.error('❌ 创建审批通知失败:', error)
      return false
    }
  }

  /**
   * 创建部署状态通知
   */
  async createDeploymentStatusNotification(
    deploymentId: string,
    deploymentName: string,
    projectName: string,
    status: string,
    environment: string,
    recipientIds: string[],
    senderId?: string
  ): Promise<boolean> {
    try {
      const statusMessages = {
        'pending': '已创建，等待审批',
        'approved': '审批通过，准备部署',
        'deploying': '正在部署中',
        'success': '部署成功完成',
        'failed': '部署失败',
        'cancelled': '部署已取消'
      }

      const statusColors = {
        'pending': 'medium',
        'approved': 'medium',
        'deploying': 'medium',
        'success': 'low',
        'failed': 'high',
        'cancelled': 'medium'
      }

      const message = statusMessages[status as keyof typeof statusMessages] || status
      const priority = statusColors[status as keyof typeof statusColors] || 'medium'

      const notificationData: NotificationData = {
        title: `部署状态更新：${deploymentName}`,
        content: `项目 ${projectName} 在 ${environment.toUpperCase()} 环境的部署任务${message}`,
        category: 'deployment',
        priority: priority as any,
        recipientIds,
        senderId,
        relatedId: deploymentId,
        relatedType: 'deployment',
        metadata: {
          deploymentId,
          status,
          environment,
          projectName,
          action: 'status_update'
        }
      }

      return await this.createNotification(notificationData)

    } catch (error) {
      console.error('❌ 创建部署状态通知失败:', error)
      return false
    }
  }

  /**
   * 清理已处理的审批通知
   */
  async clearApprovalNotifications(deploymentId: string, approverId: string): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()

      console.log(`🧹 清理审批通知: ${deploymentId} -> ${approverId}`)

      // 标记相关的审批通知为已读
      await prisma.notification.updateMany({
        where: {
          recipientId: approverId,
          relatedId: deploymentId,
          relatedType: 'deployment',
          category: 'approval',
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      })

      console.log('✅ 审批通知已清理')
      return true

    } catch (error) {
      console.error('❌ 清理审批通知失败:', error)
      return false
    }
  }

  /**
   * 清理已完成部署的通知
   */
  async clearDeploymentNotifications(deploymentId: string): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()

      console.log(`🧹 清理部署通知: ${deploymentId}`)

      // 标记相关的部署通知为已读（除了最终状态通知）
      await prisma.notification.updateMany({
        where: {
          relatedId: deploymentId,
          relatedType: 'deployment',
          category: 'deployment',
          isRead: false,
          NOT: {
            metadata: {
              path: ['action'],
              equals: 'status_update'
            }
          }
        },
        data: {
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      })

      console.log('✅ 部署通知已清理')
      return true

    } catch (error) {
      console.error('❌ 清理部署通知失败:', error)
      return false
    }
  }

  /**
   * 获取用户未读通知统计
   */
  async getUnreadStats(userId: string): Promise<{
    total: number
    byCategory: Record<string, number>
  }> {
    try {
      const prisma = await this.getPrisma()

      const notifications = await prisma.notification.findMany({
        where: {
          recipientId: userId,
          isRead: false
        },
        select: {
          category: true
        }
      })

      const byCategory: Record<string, number> = {}
      notifications.forEach((n: any) => {
        byCategory[n.category] = (byCategory[n.category] || 0) + 1
      })

      return {
        total: notifications.length,
        byCategory
      }

    } catch (error) {
      console.error('❌ 获取未读通知统计失败:', error)
      return { total: 0, byCategory: {} }
    }
  }
}

// 导出单例实例
export const notificationService = new NotificationService()
