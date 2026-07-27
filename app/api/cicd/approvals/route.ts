import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { withLeakDetection } from '../../../../lib/database/leakDetector'
import { broadcastRealtimeNotification } from '../../../../lib/notifications/realtimeBroadcastService'
import { triggerApprovedDeployment } from '../../../../lib/services/deploymentTriggerService'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


// 获取统一的审批列表
export async function GET(request: NextRequest) {
  return await withLeakDetection('get-unified-approvals', async () => {
    try {
      const authResult = await requireAuth(request)
      if (!authResult.success) {
        return authResult.response
      }

      const { user } = authResult
      const prisma = await getPrismaClient()

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || 'pending'
      const page = parseInt(searchParams.get('page') || '1')
      const pageSize = parseInt(searchParams.get('pageSize') || '20')
      const type = searchParams.get('type') // 'deployment', 'jenkins', 'all'

      console.log('📋 [Unified Approvals API] 查询审批列表:', { status, page, pageSize, type, userId: user.id })

      // 计算分页
      const skip = (page - 1) * pageSize
      const take = pageSize

      // 构建查询条件
      let whereCondition: any = {}

      if (status === 'pending') {
        // 待审批：只显示当前用户需要审批的待处理任务
        whereCondition = {
          status: 'pending',
          approverId: user.id
        }
      } else if (status === 'processed') {
        // 已处理：显示当前用户已处理的审批记录
        whereCondition = {
          status: { in: ['approved', 'rejected'] },
          approverId: user.id
        }
      } else if (status === 'all') {
        // 全部审批：根据用户角色限制查询范围
        if (user.role !== 'admin') {
          whereCondition.approverId = user.id
        }
        // 管理员可以看到所有审批记录，不添加额外条件
      } else {
        // 其他状态按原来的逻辑处理
        whereCondition.status = status as any
        if (user.role !== 'admin') {
          whereCondition.approverId = user.id
        }
      }

      const allApprovals: any[] = []

      // 查询用户注册审批（只有管理员可以看到）
      if (user.role === 'admin' || user.permissions.includes('admin:users')) {
        if (!type || type === 'all' || type === 'user_registration') {
          let userRegistrationCondition: any = {}

          if (status === 'pending') {
            userRegistrationCondition.status = 'PENDING'
          } else if (status === 'processed') {
            userRegistrationCondition.status = { in: ['APPROVED', 'REJECTED'] }
          } else if (status !== 'all') {
            // 对于其他状态，映射到用户注册状态
            if (status === 'approved') {
              userRegistrationCondition.status = 'APPROVED'
            } else if (status === 'rejected') {
              userRegistrationCondition.status = 'REJECTED'
            }
          }

          const userRegistrations = await prisma.userRegistration.findMany({
            where: userRegistrationCondition,
            orderBy: { submittedAt: 'desc' }
          })

          // 转换为统一格式
          const formattedUserRegistrations = userRegistrations.map(registration => ({
            id: `user_registration_${registration.id}`,
            type: 'user_registration' as const,
            deploymentId: null,
            approverId: registration.reviewedBy || user.id, // 默认当前管理员为审批人
            status: registration.status.toLowerCase() === 'pending' ? 'pending' :
                   registration.status.toLowerCase() === 'approved' ? 'approved' : 'rejected',
            comments: registration.reviewNote,
            approvedAt: registration.reviewedAt,
            level: 1,
            isRequired: true,
            createdAt: registration.submittedAt,
            updatedAt: registration.reviewedAt || registration.submittedAt,
            deployment: null,
            approver: registration.reviewedBy ? { id: registration.reviewedBy } : null,
            // 用户注册特有的字段
            registration: {
              id: registration.id,
              username: registration.username,
              email: registration.email,
              realName: registration.realName,
              reason: registration.reason,
              status: registration.status
            }
          }))

          allApprovals.push(...formattedUserRegistrations)
        }
      }

      // 查询部署审批
      if (!type || type === 'all' || type === 'deployment') {
        const deploymentApprovals = await prisma.deploymentApproval.findMany({
          where: whereCondition,
          include: {
            deployment: {
              include: {
                project: {
                  select: { id: true, name: true }
                },
                user: {
                  select: { id: true, username: true, email: true }
                }
              }
            },
            approver: {
              select: { id: true, username: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        const formattedDeploymentApprovals = deploymentApprovals.map(approval => ({
          id: approval.id,
          type: 'deployment' as const,
          deploymentId: approval.deploymentId,
          approverId: approval.approverId,
          status: approval.status,
          comments: approval.comments,
          approvedAt: approval.approvedAt,
          level: approval.level,
          isRequired: approval.isRequired,
          createdAt: approval.createdAt,
          updatedAt: approval.updatedAt,
          deployment: {
            id: approval.deployment.id,
            name: approval.deployment.name,
            environment: approval.deployment.environment,
            description: approval.deployment.description,
            project: approval.deployment.project,
            creator: approval.deployment.user
          },
          approver: approval.approver
        }))

        allApprovals.push(...formattedDeploymentApprovals)
      }

      // 查询Jenkins任务审批
      if (!type || type === 'all' || type === 'jenkins') {
        const jenkinsApprovals = await prisma.jenkinsJobApproval.findMany({
          where: whereCondition,
          include: {
            execution: {
              include: {
                config: {
                  select: { id: true, name: true, serverUrl: true }
                },
                requester: {
                  select: { id: true, username: true, email: true, role: true }
                }
              }
            },
            approver: {
              select: { id: true, username: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        const formattedJenkinsApprovals = jenkinsApprovals.map(approval => ({
          id: approval.id,
          type: 'jenkins' as const,
          deploymentId: approval.executionId,
          approverId: approval.approverId,
          status: approval.status,
          comments: approval.comments,
          approvedAt: approval.approvedAt,
          level: approval.level,
          isRequired: approval.isRequired,
          createdAt: approval.createdAt,
          updatedAt: approval.updatedAt,
          deployment: {
            id: approval.execution.id,
            name: `Jenkins任务: ${approval.execution.jobName}`,
            environment: approval.execution.operationType,
            description: approval.execution.reason || `${approval.execution.operationType} 操作`,
            project: {
              id: approval.execution.config.id,
              name: approval.execution.config.name
            },
            creator: approval.execution.requester
          },
          approver: approval.approver,
          jenkinsJob: {
            jobName: approval.execution.jobName,
            operationType: approval.execution.operationType,
            configName: approval.execution.config.name,
            serverUrl: approval.execution.config.serverUrl
          }
        }))

        allApprovals.push(...formattedJenkinsApprovals)
      }

      // 按创建时间排序
      allApprovals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      // 分页处理
      const total = allApprovals.length
      const paginatedApprovals = allApprovals.slice(skip, skip + take)

      console.log(`✅ [Unified Approvals API] 查询成功: ${paginatedApprovals.length}/${total} 条记录`)

      return NextResponse.json({
        success: true,
        data: {
          approvals: paginatedApprovals,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      })

    } catch (error) {
      console.error('❌ [Unified Approvals API] 查询失败:', error)
      return NextResponse.json({
        success: false,
        error: '获取审批列表失败'
      }, { status: 500 })
    }
  })
}

// 处理审批操作
export async function PUT(request: NextRequest) {
  return await withLeakDetection('update-approval', async () => {
    try {
      const authResult = await requireAuth(request)
      if (!authResult.success) {
        return authResult.response
      }

      const { user } = authResult
      const prisma = await getPrismaClient()

      const body = await request.json()
      const { approvalId, action, comments, type } = body

      console.log('📋 [Unified Approvals API] 处理审批操作:', { approvalId, action, type, userId: user.id })

      if (!approvalId || !action || !['approve', 'reject'].includes(action)) {
        return NextResponse.json({
          success: false,
          error: '参数无效'
        }, { status: 400 })
      }

      let result

      if (type === 'user_registration') {
        // 处理用户注册审批
        const registrationId = approvalId.replace('user_registration_', '')

        // 检查权限
        if (user.role !== 'admin' && !user.permissions.includes('admin:users')) {
          return NextResponse.json({
            success: false,
            error: '权限不足',
            details: '只有管理员可以审批用户注册'
          }, { status: 403 })
        }

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
            reviewNote: comments || (action === 'approve' ? '审批通过' : '审批拒绝')
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

        result = {
          type: 'user_registration',
          registration: updatedRegistration,
          newUser: newUser,
          message: action === 'approve' ? '注册申请已批准，用户账户已创建' : '注册申请已拒绝'
        }

      } else if (type === 'jenkins') {
        // 处理Jenkins任务审批
        const approval = await prisma.jenkinsJobApproval.findUnique({
          where: { id: approvalId },
          include: { execution: true }
        })

        if (!approval) {
          return NextResponse.json({
            success: false,
            error: '审批记录不存在'
          }, { status: 404 })
        }

        if (approval.approverId !== user.id && user.role !== 'admin') {
          return NextResponse.json({
            success: false,
            error: '无权限操作此审批'
          }, { status: 403 })
        }

        if (approval.status !== 'pending') {
          return NextResponse.json({
            success: false,
            error: '审批已处理，无法重复操作'
          }, { status: 400 })
        }

        result = await prisma.jenkinsJobApproval.update({
          where: { id: approvalId },
          data: {
            status: action === 'approve' ? 'approved' : 'rejected',
            comments: comments || null,
            approvedAt: new Date()
          }
        })

      } else {
        // 处理部署审批
        const approval = await prisma.deploymentApproval.findUnique({
          where: { id: approvalId },
          include: { deployment: true }
        })

        if (!approval) {
          return NextResponse.json({
            success: false,
            error: '审批记录不存在'
          }, { status: 404 })
        }

        if (approval.approverId !== user.id && user.role !== 'admin') {
          return NextResponse.json({
            success: false,
            error: '无权限操作此审批'
          }, { status: 403 })
        }

        if (approval.status !== 'pending') {
          return NextResponse.json({
            success: false,
            error: '审批已处理，无法重复操作'
          }, { status: 400 })
        }

        result = await prisma.deploymentApproval.update({
          where: { id: approvalId },
          data: {
            status: action === 'approve' ? 'approved' : 'rejected',
            comments: comments || null,
            approvedAt: new Date()
          }
        })

        // 检查是否所有审批都已完成，并更新部署任务状态
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

        await prisma.infoNotification.updateMany({
          where: {
            userId: user.id,
            type: 'deployment_approval',
            isRead: false,
            metadata: { path: ['approvalId'], equals: approvalId }
          },
          data: { isRead: true, readAt: new Date() }
        })

        // 更新部署任务状态
        if (newDeploymentStatus !== approval.deployment.status) {
          await prisma.deployment.update({
            where: { id: approval.deploymentId },
            data: {
              status: newDeploymentStatus,
              updatedAt: new Date()
            }
          })

          console.log('✅ 部署任务状态已更新:', {
            deploymentId: approval.deploymentId,
            oldStatus: approval.deployment.status,
            newStatus: newDeploymentStatus
          })

          // 向审批人和申请人广播状态变化。
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

          // 所有审批通过后只调用统一触发器一次，避免绕过生产质量门禁。
          if (newDeploymentStatus === 'approved') {
            await triggerApprovedDeployment(approval.deploymentId, user.id, prisma)
          }
        }
      }

      console.log(`✅ [Unified Approvals API] 审批操作成功: ${action}`)

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

        // 通知所有相关用户审批状态更新
        const admins = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'admin' },
              { role: 'manager' },
              { permissions: { has: 'cicd:write' } }
            ],
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
              approvalType: type || 'deployment',
              action: action,
              approvalId: approvalId
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
        data: result
      })

    } catch (error) {
      console.error('❌ [Unified Approvals API] 审批操作失败:', error)
      return NextResponse.json({
        success: false,
        error: '审批操作失败'
      }, { status: 500 })
    }
  })
}
