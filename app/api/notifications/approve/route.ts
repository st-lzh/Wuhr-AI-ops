import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import ApprovalRecordService from '../../../services/approvalRecordService'
import { getPrismaClient } from '../../../../lib/config/database'
import { executeJenkinsJob } from '../../../../lib/jenkins/executionService'
import { jenkinsNotificationService } from '../../../../lib/notifications/jenkinsNotificationService'
import { broadcastRealtimeNotification } from '../../../../lib/notifications/realtimeBroadcastService'
import { triggerApprovedDeployment } from '../../../../lib/services/deploymentTriggerService'

// 处理审批操作
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user
    const body = await request.json()
    const { notificationId, action, comment } = body

    if (!notificationId || !action) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数',
        details: 'notificationId 和 action 是必需的'
      }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: '无效的操作',
        details: 'action 必须是 approve 或 reject'
      }, { status: 400 })
    }

    // 解析通知ID，确定审批类型
    if (notificationId.startsWith('user_registration_')) {
      // 用户注册审批
      const registrationId = notificationId.replace('user_registration_', '')

      // 检查权限
      if (user.role !== 'admin' && !user.permissions.includes('admin:users')) {
        return NextResponse.json({
          success: false,
          error: '权限不足',
          details: '只有管理员可以审批用户注册'
        }, { status: 403 })
      }

      // 处理用户注册审批
      const prisma = await getPrismaClient()

      // 获取注册申请信息
      const registration = await prisma.userRegistration.findUnique({
        where: { id: registrationId }
      })

      if (!registration) {
        return NextResponse.json({
          success: false,
          error: '注册申请不存在'
        }, { status: 404 })
      }

      if (registration.status !== 'PENDING') {
        return NextResponse.json({
          success: false,
          error: '注册申请已经被处理过了'
        }, { status: 400 })
      }

      // 更新注册申请状态
      const updatedRegistration = await prisma.userRegistration.update({
        where: { id: registrationId },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: user.id,
          reviewNote: comment || (action === 'approve' ? '审批通过' : '审批拒绝')
        }
      })

      let newUser = null

      // 如果批准，创建用户账户
      if (action === 'approve') {
        newUser = await prisma.user.create({
          data: {
            username: registration.username,
            email: registration.email,
            password: registration.password,
            realName: registration.realName,
            role: 'viewer',
            permissions: [
              'users:read',
              'cicd:read',
              'servers:read',
              'config:read'
            ],
            isActive: true,
            approvalStatus: 'approved',
            approvedBy: user.id,
            approvedAt: new Date()
          }
        })

        console.log('✅ 用户账户已创建:', {
          userId: newUser.id,
          username: newUser.username,
          email: newUser.email
        })
      }

      // 创建审批记录
      try {
        await ApprovalRecordService.createRecord({
          approvalType: 'user_registration',
          targetId: registrationId,
          targetName: registration.username,
          operatorId: user.id,
          operatorName: user.username,
          action: action === 'approve' ? 'approved' : 'rejected',
          comment: comment || (action === 'approve' ? '审批通过' : '审批拒绝'),
          metadata: {
            userEmail: registration.email,
            realName: registration.realName,
            reason: registration.reason,
            approvalTime: new Date().toISOString(),
            newUserId: newUser?.id
          }
        })
      } catch (recordError) {
        console.error('❌ 创建审批记录失败:', recordError)
        // 不影响主流程，继续执行
      }

      // 触发实时通知更新
      try {
        const Redis = require('ioredis')
        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        })

        // 通知所有管理员审批状态更新
        const prisma = await getPrismaClient()
        const admins = await prisma.user.findMany({
          where: {
            role: 'admin',
            isActive: true,
            approvalStatus: 'approved'
          },
          select: { id: true }
        })

        for (const admin of admins) {
          const notificationUpdate = {
            type: 'approval_update',
            message: '审批状态已更新',
            timestamp: new Date().toISOString(),
            data: {
              approvalType: 'user_registration',
              action: action,
              targetName: registration.username
            }
          }

          await redis.publish(`user:${admin.id}:notifications`, JSON.stringify(notificationUpdate))
        }

        redis.disconnect()
        console.log('✅ 实时通知更新已发送')
      } catch (notificationError) {
        console.error('❌ 发送实时通知更新失败:', notificationError)
        // 不影响主流程
      }

      return NextResponse.json({
        success: true,
        data: {
          type: 'user_registration',
          registration: updatedRegistration,
          newUser: newUser,
          message: action === 'approve' ? '注册申请已批准，用户账户已创建' : '注册申请已拒绝'
        }
      })

    } else if (notificationId.startsWith('cicd_approval_')) {
      // CI/CD审批
      const approvalId = notificationId.replace('cicd_approval_', '')

      console.log('🔍 CI/CD审批处理:', { notificationId, approvalId, userId: user.id })

      // 检查权限
      if (!user.permissions.includes('cicd:write') && user.role !== 'admin' && user.role !== 'manager') {
        return NextResponse.json({
          success: false,
          error: '权限不足',
          details: '您没有CI/CD审批权限'
        }, { status: 403 })
      }

      const prisma = await getPrismaClient()

      if (!prisma) {
        console.error('❌ Prisma客户端初始化失败')
        return NextResponse.json({
          success: false,
          error: '数据库连接失败'
        }, { status: 500 })
      }

      // 验证审批任务是否存在且属于当前用户
      console.log('🔍 查询审批任务:', { approvalId, prismaClient: !!prisma, deploymentApprovalModel: !!prisma.deploymentApproval })

      const approval = await prisma.deploymentApproval.findUnique({
        where: { id: approvalId },
        include: {
          deployment: {
            include: {
              project: { select: { name: true } },
              user: { select: { username: true } }
            }
          }
        }
      })

      if (!approval) {
        return NextResponse.json({
          success: false,
          error: '审批任务不存在',
          details: '找不到指定的审批任务'
        }, { status: 404 })
      }

      if (approval.approverId !== user.id && user.role !== 'admin') {
        return NextResponse.json({
          success: false,
          error: '权限不足',
          details: '您不是该任务的指定审批人'
        }, { status: 403 })
      }

      if (approval.status !== 'pending') {
        return NextResponse.json({
          success: false,
          error: '任务已处理',
          details: '该审批任务已经被处理过了'
        }, { status: 400 })
      }

      // 更新审批状态
      const updatedApproval = await prisma.deploymentApproval.update({
        where: { id: approvalId },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          comments: comment || (action === 'approve' ? '已批准' : '已拒绝'),
          approvedAt: new Date()
        }
      })

      // 创建审批记录
      try {
        await ApprovalRecordService.createRecord({
          approvalType: 'deployment',
          targetId: approval.deploymentId,
          targetName: `${approval.deployment.project?.name || '未知项目'} - 部署任务`,
          operatorId: user.id,
          operatorName: user.username,
          action: action === 'approve' ? 'approved' : 'rejected',
          comment: comment || (action === 'approve' ? '部署审批通过' : '部署审批拒绝'),
          metadata: {
            projectName: approval.deployment.project?.name || '未知项目',
            deploymentId: approval.deploymentId,
            approvalId: approvalId,
            requestUser: approval.deployment.user.username,
            approvalTime: new Date().toISOString()
          }
        })
      } catch (recordError) {
        console.error('❌ 创建部署审批记录失败:', recordError)
        // 不影响主流程，继续执行
      }

      // 检查是否所有必需的审批都已完成
      const allApprovals = await prisma.deploymentApproval.findMany({
        where: { deploymentId: approval.deploymentId }
      })

      const pendingApprovals = allApprovals.filter(a => a.status === 'pending')
      const rejectedApprovals = allApprovals.filter(a => a.status === 'rejected')

      let newDeploymentStatus = approval.deployment.status

      if (action === 'reject' || rejectedApprovals.length > 0) {
        // 如果有任何审批被拒绝，部署任务状态改为拒绝
        newDeploymentStatus = 'rejected'
      } else if (pendingApprovals.length === 0) {
        // 如果所有审批都已完成且没有拒绝，部署任务状态改为已审批
        newDeploymentStatus = 'approved'
      }

      // 更新部署任务状态
      const updatedDeployment = await prisma.deployment.update({
        where: { id: approval.deploymentId },
        data: {
          status: newDeploymentStatus,
          updatedAt: new Date()
        }
      })

      // 审批任务处理后，将对应的持久化通知标记为已读，避免通知中心残留失效入口。
      await prisma.infoNotification.updateMany({
        where: {
          userId: user.id,
          type: 'deployment_approval',
          isRead: false,
          metadata: { path: ['approvalId'], equals: approvalId }
        },
        data: { isRead: true, readAt: new Date() }
      })

      console.log('✅ 部署任务状态已更新:', {
        deploymentId: approval.deploymentId,
        oldStatus: approval.deployment.status,
        newStatus: newDeploymentStatus
      })

      // 向审批人和申请人广播状态变化，其他页面可立即刷新角标和部署状态。
      try {
        const recipientIds = new Set([user.id, approval.deployment.userId])
        await Promise.all(Array.from(recipientIds).map(userId =>
          broadcastRealtimeNotification({
            type: 'deployment_status_update',
            deploymentId: approval.deploymentId,
            status: newDeploymentStatus,
            userId,
            data: {
              deploymentName: approval.deployment.name,
              approverName: user.username,
              timestamp: new Date().toISOString()
            }
          })
        ))
        console.log('📡 部署状态更新广播已发送')
      } catch (broadcastError) {
        console.error('❌ 发送状态更新广播失败:', broadcastError)
      }

      // 所有审批通过后只调用统一触发器一次；生产质量门禁也在该入口执行。
      let deploymentTrigger: Awaited<ReturnType<typeof triggerApprovedDeployment>> | null = null
      if (newDeploymentStatus === 'approved') {
        deploymentTrigger = await triggerApprovedDeployment(approval.deploymentId, user.id, prisma)
      }

      const responseMessage = action === 'reject'
        ? 'CI/CD任务审批拒绝'
        : pendingApprovals.length > 0
          ? `审批通过，仍有 ${pendingApprovals.length} 人待审批`
          : deploymentTrigger?.message || 'CI/CD任务审批通过'

      return NextResponse.json({
        success: true,
        data: {
          type: 'cicd_approval',
          result: updatedApproval,
          deployment: updatedDeployment,
          trigger: deploymentTrigger,
          message: responseMessage
        }
      })

    } else if (notificationId.startsWith('jenkins_job_')) {
      // Jenkins任务审批
      const approvalId = notificationId.replace('jenkins_job_', '')

      console.log('🔍 Jenkins任务审批处理:', { notificationId, approvalId, userId: user.id })

      // 检查权限
      if (!user.permissions.includes('jenkins:write') && user.role !== 'admin' && user.role !== 'manager') {
        return NextResponse.json({
          success: false,
          error: '权限不足',
          details: '您没有Jenkins任务审批权限'
        }, { status: 403 })
      }

      const prisma = await getPrismaClient()

      // 验证审批任务是否存在且属于当前用户
      const approval = await prisma.jenkinsJobApproval.findUnique({
        where: { id: approvalId },
        include: {
          execution: {
            include: {
              config: { select: { name: true, serverUrl: true, username: true, apiToken: true } }
            }
          }
        }
      })

      if (!approval) {
        return NextResponse.json({
          success: false,
          error: '审批任务不存在',
          details: '找不到指定的Jenkins任务审批'
        }, { status: 404 })
      }

      if (approval.approverId !== user.id && user.role !== 'admin') {
        return NextResponse.json({
          success: false,
          error: '权限不足',
          details: '您不是该任务的指定审批人'
        }, { status: 403 })
      }

      if (approval.status !== 'pending') {
        return NextResponse.json({
          success: false,
          error: '任务已处理',
          details: '该审批任务已经被处理过了'
        }, { status: 400 })
      }

      // 更新审批状态
      const updatedApproval = await prisma.jenkinsJobApproval.update({
        where: { id: approvalId },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          comments: comment || (action === 'approve' ? '已批准' : '已拒绝'),
          approvedAt: new Date()
        }
      })

      // 创建审批记录
      try {
        await ApprovalRecordService.createRecord({
          approvalType: 'jenkins_job',
          targetId: approval.executionId,
          targetName: `Jenkins任务: ${approval.execution.jobName}`,
          operatorId: user.id,
          operatorName: user.username,
          action: action === 'approve' ? 'approved' : 'rejected',
          comment: comment || (action === 'approve' ? 'Jenkins任务审批通过' : 'Jenkins任务审批拒绝'),
          metadata: {
            configName: approval.execution.config.name,
            jobName: approval.execution.jobName,
            operationType: approval.execution.operationType,
            executionId: approval.executionId,
            approvalId: approvalId,
            approvalTime: new Date().toISOString()
          }
        })
      } catch (recordError) {
        console.error('❌ 创建Jenkins审批记录失败:', recordError)
        // 不影响主流程，继续执行
      }

      // 检查是否所有必需的审批都已完成
      const allApprovals = await prisma.jenkinsJobApproval.findMany({
        where: { executionId: approval.executionId }
      })

      const pendingApprovals = allApprovals.filter(a => a.status === 'pending')
      const rejectedApprovals = allApprovals.filter(a => a.status === 'rejected')

      let newExecutionStatus = approval.execution.status

      if (action === 'reject' || rejectedApprovals.length > 0) {
        // 如果有任何审批被拒绝，执行状态改为拒绝
        newExecutionStatus = 'rejected'
      } else if (pendingApprovals.length === 0) {
        // 如果所有审批都已完成且没有拒绝，执行状态改为已审批
        newExecutionStatus = 'approved'
      }

      // 更新执行状态
      const updatedExecution = await prisma.jenkinsJobExecution.update({
        where: { id: approval.executionId },
        data: {
          status: newExecutionStatus,
          updatedAt: new Date()
        }
      })

      console.log('✅ Jenkins任务状态已更新:', {
        executionId: approval.executionId,
        oldStatus: approval.execution.status,
        newStatus: newExecutionStatus
      })

      // 如果审批通过且所有审批都完成，自动执行Jenkins任务
      if (newExecutionStatus === 'approved') {
        console.log('🚀 开始自动执行Jenkins任务:', approval.executionId)

        // 异步触发Jenkins任务执行，不阻塞审批响应
        setTimeout(async () => {
          try {
            const prisma = await getPrismaClient()

            // 更新执行状态为执行中
            await prisma.jenkinsJobExecution.update({
              where: { id: approval.executionId },
              data: {
                status: 'executing',
                executedAt: new Date()
              }
            })

            // 发送任务执行通知
            await jenkinsNotificationService.notifyOnExecute({
              executionId: approval.executionId,
              jobName: approval.execution.jobName,
              operationType: approval.execution.operationType,
              configName: approval.execution.config.name,
              serverUrl: approval.execution.config.serverUrl,
              requesterName: user.username,
              approverName: user.username
            })

            // 执行Jenkins任务
            try {
              const result = await executeJenkinsJob(approval.execution)

              // 更新执行结果
              await prisma.jenkinsJobExecution.update({
                where: { id: approval.executionId },
                data: {
                  status: 'completed',
                  completedAt: new Date(),
                  executionResult: {
                    success: true,
                    timestamp: new Date().toISOString(),
                    response: result
                  }
                }
              })

              // 发送任务完成通知
              await jenkinsNotificationService.notifyOnComplete({
                executionId: approval.executionId,
                jobName: approval.execution.jobName,
                operationType: approval.execution.operationType,
                configName: approval.execution.config.name,
                serverUrl: approval.execution.config.serverUrl,
                requesterName: user.username,
                approverName: user.username,
                success: true
              })

              console.log('✅ Jenkins任务执行成功:', approval.executionId)

            } catch (executeError) {
              console.error('❌ Jenkins任务执行失败:', executeError)

              // 更新为失败状态
              await prisma.jenkinsJobExecution.update({
                where: { id: approval.executionId },
                data: {
                  status: 'failed',
                  completedAt: new Date(),
                  executionResult: {
                    success: false,
                    error: executeError instanceof Error ? executeError.message : String(executeError),
                    timestamp: new Date().toISOString()
                  }
                }
              })

              // 发送任务失败通知
              await jenkinsNotificationService.notifyOnComplete({
                executionId: approval.executionId,
                jobName: approval.execution.jobName,
                operationType: approval.execution.operationType,
                configName: approval.execution.config.name,
                serverUrl: approval.execution.config.serverUrl,
                requesterName: user.username,
                approverName: user.username,
                success: false
              })
            }
          } catch (error) {
            console.error('❌ Jenkins任务执行异常:', error)
          }
        }, 1000) // 1秒后开始执行
      }

      return NextResponse.json({
        success: true,
        data: {
          type: 'jenkins_job_approval',
          result: updatedApproval,
          execution: updatedExecution,
          message: `Jenkins任务${action === 'approve' ? '审批通过' : '审批拒绝'}${newExecutionStatus === 'approved' ? '，即将开始执行' : ''}`
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '无效的通知ID',
        details: '不支持的通知类型'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 审批操作失败:', error)
    return NextResponse.json({
      success: false,
      error: '审批操作失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
