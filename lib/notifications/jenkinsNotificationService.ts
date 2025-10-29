// Jenkins通知服务 - 处理Jenkins相关的通知
import { infoNotificationService } from './infoNotificationService'
import { getPrismaClient } from '../config/database'

export interface JenkinsNotificationContext {
  executionId: string
  jobName: string
  operationType: string
  configName: string
  serverUrl: string
  requesterName: string
  reason?: string
  approverName?: string
  comments?: string
}

export class JenkinsNotificationService {
  private static instance: JenkinsNotificationService

  public static getInstance(): JenkinsNotificationService {
    if (!JenkinsNotificationService.instance) {
      JenkinsNotificationService.instance = new JenkinsNotificationService()
    }
    return JenkinsNotificationService.instance
  }

  // 直接使用全局Prisma客户端，不缓存
  private async getPrisma() {
    return await getPrismaClient()
  }

  // 发送审批提交通知
  async notifyOnSubmit(context: JenkinsNotificationContext): Promise<void> {
    try {
      const notifiers = await this.getNotifiers(context.executionId, 'notifyOnSubmit')
      
      // 区分审批通知和信息通知
      const approvalNotifications: any[] = []
      const infoNotifications: any[] = []

      for (const notifier of notifiers) {
        // 检查是否是审批人员
        const isApprover = await this.isApprover(context.executionId, notifier.notifierId)

        if (isApprover) {
          // 审批人员收到审批通知
          approvalNotifications.push({
            id: `jenkins_job_${context.executionId}_${notifier.notifierId}`,
            type: 'jenkins_approval',
            title: '📋 Jenkins任务审批申请',
            content: `${context.requesterName} 申请执行Jenkins任务：${context.jobName} (${this.getOperationText(context.operationType)})`,
            userId: notifier.notifierId,
            actionUrl: '/notifications',
            actionText: '立即审批',
            metadata: {
              executionId: context.executionId,
              jobName: context.jobName,
              operationType: context.operationType,
              configName: context.configName,
              serverUrl: context.serverUrl,
              requesterName: context.requesterName,
              reason: context.reason,
              isApproval: true
            },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
          })
        }

        // 所有通知人员都收到信息通知（包括审批人员）
        infoNotifications.push({
          type: 'jenkins_submit',
          title: '📋 Jenkins任务申请通知',
          content: `${context.requesterName} 申请执行Jenkins任务：${context.jobName} (${this.getOperationText(context.operationType)})`,
          userId: notifier.notifierId,
          actionUrl: '/notifications',
          actionText: '查看详情',
          metadata: {
            executionId: context.executionId,
            jobName: context.jobName,
            operationType: context.operationType,
            configName: context.configName,
            serverUrl: context.serverUrl,
            requesterName: context.requesterName,
            reason: context.reason,
            isApproval: false,
            isApprover: isApprover // 标记是否也是审批人
          },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
        })
      }

      // 发送审批通知
      if (approvalNotifications.length > 0) {
        await infoNotificationService.createBatchApprovalNotifications(approvalNotifications)
        console.log(`📬 [Jenkins Notification] 审批通知已发送给 ${approvalNotifications.length} 个审批人员`)
      }

      // 发送信息通知
      if (infoNotifications.length > 0) {
        await infoNotificationService.createBatchNotifications(infoNotifications)
        console.log(`📬 [Jenkins Notification] 信息通知已发送给 ${infoNotifications.length} 个通知人员`)
      }

      console.log(`📬 [Jenkins Notification] 审批提交通知处理完成，共 ${approvalNotifications.length + infoNotifications.length} 个用户`)

    } catch (error) {
      console.error('❌ [Jenkins Notification] 发送提交通知失败:', error)
    }
  }

  // 发送审批通过通知
  async notifyOnApprove(context: JenkinsNotificationContext): Promise<void> {
    try {
      const notifiers = await this.getNotifiers(context.executionId, 'notifyOnApprove')
      
      const notifications = notifiers.map(notifier => ({
        type: 'jenkins_approve',
        title: '✅ Jenkins任务审批通过',
        content: `${context.approverName} 批准了Jenkins任务：${context.jobName} (${this.getOperationText(context.operationType)})`,
        userId: notifier.notifierId,
        actionUrl: '/cicd/approvals',
        actionText: '查看详情',
        metadata: {
          executionId: context.executionId,
          jobName: context.jobName,
          operationType: context.operationType,
          configName: context.configName,
          serverUrl: context.serverUrl,
          requesterName: context.requesterName,
          approverName: context.approverName,
          comments: context.comments
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
      }))

      await infoNotificationService.createBatchNotifications(notifications)
      console.log(`📬 [Jenkins Notification] 审批通过通知已发送给 ${notifications.length} 个用户`)

    } catch (error) {
      console.error('❌ [Jenkins Notification] 发送审批通过通知失败:', error)
    }
  }

  // 发送审批拒绝通知
  async notifyOnReject(context: JenkinsNotificationContext): Promise<void> {
    try {
      const notifiers = await this.getNotifiers(context.executionId, 'notifyOnReject')
      
      const notifications = notifiers.map(notifier => ({
        type: 'jenkins_reject',
        title: '❌ Jenkins任务审批被拒绝',
        content: `${context.approverName} 拒绝了Jenkins任务：${context.jobName} (${this.getOperationText(context.operationType)})`,
        userId: notifier.notifierId,
        actionUrl: '/cicd/approvals',
        actionText: '查看详情',
        metadata: {
          executionId: context.executionId,
          jobName: context.jobName,
          operationType: context.operationType,
          configName: context.configName,
          serverUrl: context.serverUrl,
          requesterName: context.requesterName,
          approverName: context.approverName,
          comments: context.comments
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
      }))

      await infoNotificationService.createBatchNotifications(notifications)
      console.log(`📬 [Jenkins Notification] 审批拒绝通知已发送给 ${notifications.length} 个用户`)

    } catch (error) {
      console.error('❌ [Jenkins Notification] 发送审批拒绝通知失败:', error)
    }
  }

  // 发送任务执行通知
  async notifyOnExecute(context: JenkinsNotificationContext): Promise<void> {
    try {
      const notifiers = await this.getNotifiers(context.executionId, 'notifyOnExecute')
      
      const notifications = notifiers.map(notifier => ({
        type: 'jenkins_execute',
        title: '🚀 Jenkins任务开始执行',
        content: `Jenkins任务开始执行：${context.jobName} (${this.getOperationText(context.operationType)})`,
        userId: notifier.notifierId,
        actionUrl: '/jenkins/jobs',
        actionText: '查看执行状态',
        metadata: {
          executionId: context.executionId,
          jobName: context.jobName,
          operationType: context.operationType,
          configName: context.configName,
          serverUrl: context.serverUrl,
          requesterName: context.requesterName
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
      }))

      await infoNotificationService.createBatchNotifications(notifications)
      console.log(`📬 [Jenkins Notification] 任务执行通知已发送给 ${notifications.length} 个用户`)

    } catch (error) {
      console.error('❌ [Jenkins Notification] 发送执行通知失败:', error)
    }
  }

  // 发送任务完成通知
  async notifyOnComplete(context: JenkinsNotificationContext & { success: boolean }): Promise<void> {
    try {
      const notifiers = await this.getNotifiers(context.executionId, 'notifyOnComplete')
      
      const notifications = notifiers.map(notifier => ({
        type: 'jenkins_complete',
        title: context.success ? '✅ Jenkins任务执行成功' : '❌ Jenkins任务执行失败',
        content: `Jenkins任务执行${context.success ? '成功' : '失败'}：${context.jobName} (${this.getOperationText(context.operationType)})`,
        userId: notifier.notifierId,
        actionUrl: '/jenkins/jobs',
        actionText: '查看执行结果',
        metadata: {
          executionId: context.executionId,
          jobName: context.jobName,
          operationType: context.operationType,
          configName: context.configName,
          serverUrl: context.serverUrl,
          requesterName: context.requesterName,
          success: context.success
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
      }))

      await infoNotificationService.createBatchNotifications(notifications)
      console.log(`📬 [Jenkins Notification] 任务完成通知已发送给 ${notifications.length} 个用户`)

    } catch (error) {
      console.error('❌ [Jenkins Notification] 发送完成通知失败:', error)
    }
  }

  // 检查用户是否是审批人员
  private async isApprover(executionId: string, userId: string): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()

      const approval = await prisma.jenkinsJobApproval.findFirst({
        where: {
          executionId,
          approverId: userId
        }
      })

      return !!approval
    } catch (error) {
      console.error('❌ [Jenkins Notification] 检查审批人员失败:', error)
      return false
    }
  }

  // 获取指定执行记录的通知人员
  private async getNotifiers(executionId: string, notifyType: string): Promise<any[]> {
    try {
      const prisma = await this.getPrisma()

      // 获取配置的通知人员
      const whereCondition: any = {
        executionId,
        isActive: true
      }

      // 根据通知类型添加条件
      whereCondition[notifyType] = true

      const notifiers = await prisma.jenkinsJobNotifier.findMany({
        where: whereCondition,
        include: {
          notifier: {
            select: {
              id: true,
              username: true,
              realName: true,
              email: true
            }
          }
        }
      })

      // 获取审批人员（确保审批人员也能收到通知）
      const approvers = await prisma.jenkinsJobApproval.findMany({
        where: {
          executionId,
          isRequired: true
        },
        include: {
          approver: {
            select: {
              id: true,
              username: true,
              realName: true,
              email: true
            }
          }
        }
      })

      // 合并通知人员和审批人员，确保不重复
      const allNotifiers = [...notifiers]

      // 将审批人员添加到通知列表中（如果不存在）
      for (const approver of approvers) {
        if (!allNotifiers.some(n => n.notifierId === approver.approverId)) {
          // 创建一个完整的通知对象
          const notifierObj: any = {
            id: `approver-${approver.id}`,
            executionId,
            notifierId: approver.approverId,
            notifier: approver.approver,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            notifyOnSubmit: false,
            notifyOnApprove: false,
            notifyOnReject: false,
            notifyOnExecute: false,
            notifyOnComplete: false
          };

          // 设置当前通知类型为true
          notifierObj[notifyType] = true;

          allNotifiers.push(notifierObj);
        }
      }

      return allNotifiers

    } catch (error) {
      console.error('❌ [Jenkins Notification] 获取通知人员失败:', error)
      return []
    }
  }

  // 获取操作类型的中文描述
  private getOperationText(operationType: string): string {
    const operationMap: Record<string, string> = {
      'build': '构建',
      'enable': '启用',
      'disable': '禁用',
      'delete': '删除',
      'batch_build': '批量构建',
      'batch_enable': '批量启用',
      'batch_disable': '批量禁用',
      'batch_delete': '批量删除'
    }
    
    return operationMap[operationType] || operationType
  }

  // 添加通知人员到执行记录
  async addNotifiers(executionId: string, notifierIds: string[]): Promise<void> {
    try {
      const prisma = await this.getPrisma()
      
      const notifierData = notifierIds.map(notifierId => ({
        executionId,
        notifierId,
        notifyOnSubmit: true,
        notifyOnApprove: true,
        notifyOnReject: true,
        notifyOnExecute: true,
        notifyOnComplete: true,
        isActive: true
      }))

      await prisma.jenkinsJobNotifier.createMany({
        data: notifierData,
        skipDuplicates: true
      })

      console.log(`📬 [Jenkins Notification] 已为执行记录 ${executionId} 添加 ${notifierIds.length} 个通知人员`)

    } catch (error) {
      console.error('❌ [Jenkins Notification] 添加通知人员失败:', error)
    }
  }
}

// 导出单例实例
export const jenkinsNotificationService = JenkinsNotificationService.getInstance()
