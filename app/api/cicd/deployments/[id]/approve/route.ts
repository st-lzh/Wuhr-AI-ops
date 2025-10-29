import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { notificationService } from '../../../../../../lib/services/notificationService'
import { infoNotificationService } from '../../../../../../lib/notifications/infoNotificationService'
import { deploymentExecutionService } from '../../../../../../lib/services/deploymentExecutionService'

// 处理部署审批
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const deploymentId = params.id
    const { action, comment } = await request.json()

    console.log(`🔍 处理部署审批: ${deploymentId} - ${action} by ${user.username}`)

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: '无效的审批操作'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 查找部署任务
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            username: true
          }
        },
        approvals: {
          where: {
            approverId: user.id,
            status: 'pending'
          }
        }
      }
    })

    if (!deployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在'
      }, { status: 404 })
    }

    // 检查是否有待审批的记录
    if (deployment.approvals.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有找到待审批的记录或您无权限审批此任务'
      }, { status: 403 })
    }

    const approval = deployment.approvals[0]

    // 更新审批记录
    await prisma.deploymentApproval.update({
      where: { id: approval.id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        comments: comment || null,
        approvedAt: new Date()
      }
    })

    console.log(`✅ 审批记录已更新: ${action}`)

    // 清理审批通知
    await notificationService.clearApprovalNotifications(deploymentId, user.id)

    let newDeploymentStatus = deployment.status

    if (action === 'approve') {
      // 检查是否所有审批都已完成
      const allApprovals = await prisma.deploymentApproval.findMany({
        where: { deploymentId }
      })

      const pendingApprovals = allApprovals.filter(a => a.status === 'pending')
      
      if (pendingApprovals.length === 0) {
        // 所有审批都已完成，更新部署状态为已审批
        newDeploymentStatus = 'approved'
        
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status: 'approved',
            updatedAt: new Date()
          }
        })

        console.log('🎉 所有审批已完成，部署任务状态更新为已审批')

        // 发送审批完成通知给申请人
        try {
          await infoNotificationService.createNotification({
            type: 'deployment_approved',
            title: `部署审批通过：${deployment.name}`,
            content: `您的部署任务"${deployment.name}"已通过审批，可以开始执行部署。审批人：${user.username}`,
            userId: deployment.user.id,
            actionUrl: `/notifications`, // 跳转到通知管理页面
            actionText: '查看详情',
            metadata: {
              deploymentId: deploymentId,
              environment: deployment.environment,
              projectName: deployment.project?.name || '未知项目',
              approverName: user.username,
              approverId: user.id,
              action: 'approved',
              // 添加跳转相关的元数据
              notificationManagementUrl: `/notification-management?type=deployment&status=approved`,
              deploymentManagementUrl: `/cicd/deployments`,
              approvalManagementUrl: `/approval-management?type=deployment&status=approved`
            }
          })
          console.log(`✅ 审批完成通知发送成功: ${deployment.user.id}`)
        } catch (notifyError) {
          console.error('❌ 发送审批完成通知失败:', notifyError)
        }

        // 发送实时通知更新
        try {
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'deployment_status_update',
              deploymentId,
              status: 'approved',
              userId: deployment.user.id
            })
          })
        } catch (broadcastError) {
          console.error('❌ 发送实时状态更新失败:', broadcastError)
        }

        // 发送通知给通知人员
        if (deployment.notificationUsers && Array.isArray(deployment.notificationUsers)) {
          const notificationUserIds = deployment.notificationUsers as string[]
          if (notificationUserIds.length > 0) {
            try {
              // 为每个通知人员创建通知
              for (const notificationUserId of notificationUserIds) {
                await infoNotificationService.createNotification({
                  type: 'deployment_notification',
                  title: `部署状态更新：${deployment.name}`,
                  content: `部署任务"${deployment.name}"已通过审批，即将开始执行。项目：${deployment.project?.name || '未知项目'}，环境：${deployment.environment.toUpperCase()}`,
                  userId: notificationUserId,
                  actionUrl: `/cicd/deployments`,
                  actionText: '查看详情',
                  metadata: {
                    deploymentId: deploymentId,
                    environment: deployment.environment,
                    projectName: deployment.project?.name || '未知项目',
                    status: 'approved',
                    action: 'status_update'
                  }
                })
              }
              console.log(`✅ 通知人员通知发送成功: ${notificationUserIds.length} 人`)
            } catch (notifyError) {
              console.error('❌ 发送通知人员通知失败:', notifyError)
            }
          }
        }

        // 触发自动部署执行
        console.log('🚀 触发自动部署执行...')
        try {
          // 异步触发部署，不阻塞审批响应
          setImmediate(async () => {
            const deploymentSuccess = await deploymentExecutionService.triggerDeployment(deploymentId)
            if (deploymentSuccess) {
              console.log(`✅ 自动部署执行成功: ${deploymentId}`)
            } else {
              console.log(`❌ 自动部署执行失败: ${deploymentId}`)
            }
          })
        } catch (deployError) {
          console.error('❌ 触发自动部署失败:', deployError)
          // 不影响审批流程，只记录错误
        }
        
      } else {
        console.log(`⏳ 还有 ${pendingApprovals.length} 个审批待处理`)
      }
    } else {
      // 审批被拒绝，更新部署状态
      newDeploymentStatus = 'rejected'
      
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'rejected',
          updatedAt: new Date()
        }
      })

      console.log('❌ 审批被拒绝，部署任务状态更新为已拒绝')

      // 发送拒绝通知给申请人
      await notificationService.createDeploymentStatusNotification(
        deploymentId,
        deployment.name,
        deployment.project?.name || '未知项目',
        'rejected',
        deployment.environment,
        [deployment.user.id],
        user.id
      )

      // 发送通知给通知人员
      if (deployment.notificationUsers && Array.isArray(deployment.notificationUsers)) {
        const notificationUserIds = deployment.notificationUsers as string[]
        if (notificationUserIds.length > 0) {
          await notificationService.createDeploymentStatusNotification(
            deploymentId,
            deployment.name,
            deployment.project?.name || '未知项目',
            'rejected',
            deployment.environment,
            notificationUserIds,
            user.id
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `审批${action === 'approve' ? '通过' : '拒绝'}成功`,
      data: {
        deploymentId,
        action,
        status: newDeploymentStatus,
        approver: {
          id: user.id,
          username: user.username
        },
        approvedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ 处理部署审批失败:', error)
    return NextResponse.json({
      success: false,
      error: '处理审批失败'
    }, { status: 500 })
  }
}

// 获取部署审批状态
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const deploymentId = params.id

    const prisma = await getPrismaClient()

    // 查找部署任务和审批记录
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            username: true
          }
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                username: true,
                realName: true
              }
            }
          },
          orderBy: {
            level: 'asc'
          }
        }
      }
    })

    if (!deployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在'
      }, { status: 404 })
    }

    // 统计审批状态
    const approvalStats = {
      total: deployment.approvals.length,
      pending: deployment.approvals.filter(a => a.status === 'pending').length,
      approved: deployment.approvals.filter(a => a.status === 'approved').length,
      rejected: deployment.approvals.filter(a => a.status === 'rejected').length
    }

    // 检查当前用户是否有待审批的任务
    const userPendingApproval = deployment.approvals.find(
      a => a.approverId === user.id && a.status === 'pending'
    )

    return NextResponse.json({
      success: true,
      data: {
        deployment: {
          id: deployment.id,
          name: deployment.name,
          status: deployment.status,
          environment: deployment.environment,
          project: deployment.project,
          user: deployment.user,
          requireApproval: deployment.requireApproval,
          createdAt: deployment.createdAt,
          updatedAt: deployment.updatedAt
        },
        approvals: deployment.approvals,
        stats: approvalStats,
        userCanApprove: !!userPendingApproval,
        userApproval: userPendingApproval
      }
    })

  } catch (error) {
    console.error('❌ 获取部署审批状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取审批状态失败'
    }, { status: 500 })
  }
}
