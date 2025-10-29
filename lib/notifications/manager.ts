// 通知管理器 - 统一管理所有通知渠道
import { CICDEvent, CICDNotificationData, NotificationResult } from './types'
import { systemNotificationService } from './system'
import { emailNotificationService } from './email'
import { getPrismaClient } from '../config/database'

class NotificationManager {
  // 发送CI/CD事件通知
  async sendCICDNotification(data: CICDNotificationData): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    try {
      console.log(`📢 发送CI/CD通知: ${data.event} - ${data.resourceName}`)

      // 获取相关用户
      const recipients = await this.getNotificationRecipients(data)

      // 发送系统消息
      for (const recipient of recipients) {
        try {
          const systemMessage = await this.createSystemMessage(data, recipient)
          if (systemMessage) {
            results.push({
              success: true,
              channel: 'system',
              messageId: systemMessage.id,
              sentAt: new Date()
            })
          }
        } catch (error) {
          console.error(`发送系统消息失败 (用户: ${recipient}):`, error)
          results.push({
            success: false,
            channel: 'system',
            error: error instanceof Error ? error.message : '未知错误',
            sentAt: new Date()
          })
        }
      }

      // 发送邮件通知（如果配置了邮箱）
      const emailRecipients = await this.getEmailRecipients(recipients)
      if (emailRecipients.length > 0) {
        try {
          const emailResult = await emailNotificationService.sendCICDNotification(
            data.event,
            emailRecipients,
            {
              resourceName: data.resourceName,
              resourceType: data.resourceType,
              userName: data.userName,
              details: data.details
            }
          )
          results.push(emailResult)
        } catch (error) {
          console.error('发送邮件通知失败:', error)
          results.push({
            success: false,
            channel: 'email',
            error: error instanceof Error ? error.message : '未知错误',
            sentAt: new Date()
          })
        }
      }

      console.log(`✅ CI/CD通知发送完成: ${results.length} 个结果`)
      return results

    } catch (error) {
      console.error('发送CI/CD通知失败:', error)
      return [{
        success: false,
        channel: 'system',
        error: error instanceof Error ? error.message : '未知错误',
        sentAt: new Date()
      }]
    }
  }

  // 快速发送通知的便捷方法
  async notifyDeploymentStarted(deploymentId: string, deploymentName: string, userId: string, userName: string) {
    return await this.sendCICDNotification({
      event: 'deployment_started',
      resourceType: 'deployment',
      resourceId: deploymentId,
      resourceName: deploymentName,
      userId,
      userName,
      timestamp: new Date()
    })
  }

  async notifyDeploymentCompleted(deploymentId: string, deploymentName: string, userId: string, userName: string) {
    return await this.sendCICDNotification({
      event: 'deployment_completed',
      resourceType: 'deployment',
      resourceId: deploymentId,
      resourceName: deploymentName,
      userId,
      userName,
      timestamp: new Date()
    })
  }

  async notifyDeploymentFailed(deploymentId: string, deploymentName: string, userId: string, userName: string, error?: string) {
    return await this.sendCICDNotification({
      event: 'deployment_failed',
      resourceType: 'deployment',
      resourceId: deploymentId,
      resourceName: deploymentName,
      userId,
      userName,
      details: { error },
      timestamp: new Date()
    })
  }

  async notifyApprovalRequested(approvalId: string, deploymentName: string, requesterId: string, requesterName: string, approverId: string) {
    return await this.sendCICDNotification({
      event: 'approval_requested',
      resourceType: 'approval',
      resourceId: approvalId,
      resourceName: deploymentName,
      userId: approverId, // 通知审批人
      userName: requesterName, // 申请人姓名
      timestamp: new Date()
    })
  }

  async notifyApprovalApproved(approvalId: string, deploymentName: string, approverId: string, approverName: string, requesterId: string) {
    return await this.sendCICDNotification({
      event: 'approval_approved',
      resourceType: 'approval',
      resourceId: approvalId,
      resourceName: deploymentName,
      userId: requesterId, // 通知申请人
      userName: approverName, // 审批人姓名
      timestamp: new Date()
    })
  }

  async notifyTaskScheduled(taskId: string, taskName: string, userId: string, userName: string) {
    return await this.sendCICDNotification({
      event: 'task_scheduled',
      resourceType: 'task',
      resourceId: taskId,
      resourceName: taskName,
      userId,
      userName,
      timestamp: new Date()
    })
  }

  // 获取通知接收者
  private async getNotificationRecipients(data: CICDNotificationData): Promise<string[]> {
    const recipients = new Set<string>()

    try {
      // 总是包含操作用户
      recipients.add(data.userId)

      // 根据资源类型获取相关用户
      switch (data.resourceType) {
        case 'deployment':
          // 获取项目相关用户
          const prisma = await getPrismaClient()
          const deployment = await prisma.deployment.findUnique({
            where: { id: data.resourceId },
            include: {
              project: {
                include: {
                  user: true // 项目创建者
                }
              },
              user: true // 部署创建者
            }
          })

          if (deployment) {
            // 添加项目创建者
            if (deployment.project?.user?.id) {
              recipients.add(deployment.project.user.id)
            }
            // 添加部署创建者
            recipients.add(deployment.user.id)
          }
          break

        case 'approval':
          // 获取审批相关用户 - 使用Deployment模型
          const prismaForApproval = await getPrismaClient()
          const approvalDeployment = await prismaForApproval.deployment.findUnique({
            where: { id: data.resourceId },
            include: {
              project: {
                include: {
                  user: true // 项目创建者
                }
              },
              user: true // 部署创建者
            }
          })

          if (approvalDeployment) {
            // 添加项目创建者
            if (approvalDeployment.project?.user?.id) {
              recipients.add(approvalDeployment.project.user.id)
            }
            // 添加部署创建者
            recipients.add(approvalDeployment.user.id)
          }
          break

        case 'task':
          // 获取任务相关用户 - 使用Deployment模型
          const prismaForTask = await getPrismaClient()
          const taskDeployment = await prismaForTask.deployment.findUnique({
            where: { id: data.resourceId },
            include: {
              project: {
                include: {
                  user: true // 项目创建者
                }
              },
              user: true // 部署创建者
            }
          })

          if (taskDeployment) {
            // 添加项目创建者
            if (taskDeployment.project?.user?.id) {
              recipients.add(taskDeployment.project.user.id)
            }
            // 添加部署创建者
            recipients.add(taskDeployment.user.id)
          }
          break
      }

      return Array.from(recipients)
    } catch (error) {
      console.error('获取通知接收者失败:', error)
      return [data.userId] // 至少通知操作用户
    }
  }

  // 获取邮箱地址
  private async getEmailRecipients(userIds: string[]): Promise<string[]> {
    try {
      const prisma = await getPrismaClient()
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { email: true }
      })

      return users.map((user: { email: string | null }) => user.email).filter(Boolean) as string[]
    } catch (error) {
      console.error('获取邮箱地址失败:', error)
      return []
    }
  }

  // 创建系统消息
  private async createSystemMessage(data: CICDNotificationData, userId: string) {
    const templates = this.getSystemMessageTemplates()
    const template = templates[data.event as keyof typeof templates]

    if (!template) {
      console.warn(`未找到事件 ${data.event} 的系统消息模板`)
      return null
    }

    const title = this.renderTemplate(template.title, data)
    const content = this.renderTemplate(template.content, data)

    return await systemNotificationService.createMessage(
      userId,
      template.type,
      title,
      content,
      {
        actionUrl: template.actionUrl ? this.renderTemplate(template.actionUrl, data) : undefined,
        actionText: template.actionText,
        expiredAt: template.expiredAt ? new Date(Date.now() + template.expiredAt) : undefined
      }
    )
  }

  // 模板渲染
  private renderTemplate(template: string, data: CICDNotificationData): string {
    return template
      .replace(/{{resourceName}}/g, data.resourceName)
      .replace(/{{resourceType}}/g, data.resourceType)
      .replace(/{{userName}}/g, data.userName)
      .replace(/{{timestamp}}/g, data.timestamp.toLocaleString())
      .replace(/{{resourceId}}/g, data.resourceId)
  }

  // 获取系统消息模板
  private getSystemMessageTemplates() {
    return {
      deployment_started: {
        type: 'info' as const,
        title: '🚀 部署任务开始',
        content: '{{userName}} 开始执行部署任务：{{resourceName}}',
        actionUrl: '/cicd/deployments',
        actionText: '查看详情',
        expiredAt: 24 * 60 * 60 * 1000 // 24小时
      },
      deployment_completed: {
        type: 'success' as const,
        title: '✅ 部署任务完成',
        content: '部署任务 {{resourceName}} 已成功完成',
        actionUrl: '/cicd/deployments',
        actionText: '查看详情',
        expiredAt: 7 * 24 * 60 * 60 * 1000 // 7天
      },
      deployment_failed: {
        type: 'error' as const,
        title: '❌ 部署任务失败',
        content: '部署任务 {{resourceName}} 执行失败，请检查日志',
        actionUrl: '/cicd/deployments',
        actionText: '查看详情',
        expiredAt: 7 * 24 * 60 * 60 * 1000 // 7天
      },
      approval_requested: {
        type: 'warning' as const,
        title: '📋 审批请求',
        content: '{{userName}} 请求审批部署任务：{{resourceName}}',
        actionUrl: '/cicd/approvals',
        actionText: '立即审批',
        expiredAt: 3 * 24 * 60 * 60 * 1000 // 3天
      },
      approval_approved: {
        type: 'success' as const,
        title: '✅ 审批通过',
        content: '您的部署任务 {{resourceName}} 已获得审批',
        actionUrl: '/cicd/deployments',
        actionText: '查看详情',
        expiredAt: 7 * 24 * 60 * 60 * 1000 // 7天
      },
      approval_rejected: {
        type: 'error' as const,
        title: '❌ 审批被拒绝',
        content: '您的部署任务 {{resourceName}} 审批被拒绝',
        actionUrl: '/cicd/deployments',
        actionText: '查看详情',
        expiredAt: 7 * 24 * 60 * 60 * 1000 // 7天
      },
      task_scheduled: {
        type: 'info' as const,
        title: '⏰ 定时任务已创建',
        content: '定时任务 {{resourceName}} 已成功创建并启动',
        actionUrl: '/cicd/tasks',
        actionText: '查看任务',
        expiredAt: 24 * 60 * 60 * 1000 // 24小时
      },
      task_executed: {
        type: 'info' as const,
        title: '⚡ 定时任务执行',
        content: '定时任务 {{resourceName}} 已执行',
        actionUrl: '/cicd/tasks',
        actionText: '查看详情',
        expiredAt: 24 * 60 * 60 * 1000 // 24小时
      },
      task_failed: {
        type: 'error' as const,
        title: '❌ 定时任务失败',
        content: '定时任务 {{resourceName}} 执行失败',
        actionUrl: '/cicd/tasks',
        actionText: '查看详情',
        expiredAt: 7 * 24 * 60 * 60 * 1000 // 7天
      }
    }
  }
}

// 全局通知管理器实例
export const notificationManager = new NotificationManager()

export default NotificationManager
