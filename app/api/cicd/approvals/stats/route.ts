import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { withLeakDetection } from '../../../../../lib/database/leakDetector'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


// 获取审批统计数据
export async function GET(request: NextRequest) {
  return await withLeakDetection('get-approval-stats', async () => {
    try {
      const authResult = await requireAuth(request)
      if (!authResult.success) {
        return authResult.response
      }

      const { user } = authResult
      const prisma = await getPrismaClient()

      console.log('📊 获取审批统计数据:', { userId: user.id })

      // 获取今天的开始和结束时间
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      // 获取本周的开始时间
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // 获取本月的开始时间
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

      // 1. 总体统计 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [deploymentApprovals, jenkinsApprovals, userRegistrationApprovals] = await Promise.all([
        prisma.deploymentApproval.count(),
        prisma.jenkinsJobApproval.count(),
        prisma.userRegistration.count()
      ])
      const totalApprovals = deploymentApprovals + jenkinsApprovals + userRegistrationApprovals

      const [pendingDeploymentApprovals, pendingJenkinsApprovals, pendingUserRegistrations] = await Promise.all([
        prisma.deploymentApproval.count({ where: { status: 'pending' } }),
        prisma.jenkinsJobApproval.count({ where: { status: 'pending' } }),
        prisma.userRegistration.count({ where: { status: 'PENDING' } })
      ])
      const pendingApprovals = pendingDeploymentApprovals + pendingJenkinsApprovals + pendingUserRegistrations

      // 2. 今日处理统计 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [todayDeploymentApproved, todayJenkinsApproved, todayUserRegistrationApproved] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            status: 'approved',
            approvedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            status: 'approved',
            approvedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        prisma.userRegistration.count({
          where: {
            status: 'APPROVED',
            reviewedAt: { gte: startOfDay, lt: endOfDay }
          }
        })
      ])
      const todayApproved = todayDeploymentApproved + todayJenkinsApproved + todayUserRegistrationApproved

      const [todayDeploymentRejected, todayJenkinsRejected, todayUserRegistrationRejected] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            status: 'rejected',
            approvedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            status: 'rejected',
            approvedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        prisma.userRegistration.count({
          where: {
            status: 'REJECTED',
            reviewedAt: { gte: startOfDay, lt: endOfDay }
          }
        })
      ])
      const todayRejected = todayDeploymentRejected + todayJenkinsRejected + todayUserRegistrationRejected

      // 3. 我的待审批数量 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [myPendingDeploymentApprovals, myPendingJenkinsApprovals, myPendingUserRegistrations] = await Promise.all([
        prisma.deploymentApproval.count({
          where: { approverId: user.id, status: 'pending' }
        }),
        prisma.jenkinsJobApproval.count({
          where: { approverId: user.id, status: 'pending' }
        }),
        // 用户注册审批：只有管理员可以审批
        (user.role === 'admin' || user.permissions.includes('admin:users'))
          ? prisma.userRegistration.count({ where: { status: 'PENDING' } })
          : Promise.resolve(0)
      ])
      const myPendingApprovals = myPendingDeploymentApprovals + myPendingJenkinsApprovals + myPendingUserRegistrations

      // 4. 计算平均审批时间 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [completedDeploymentApprovals, completedJenkinsApprovals, completedUserRegistrations] = await Promise.all([
        prisma.deploymentApproval.findMany({
          where: {
            status: { in: ['approved', 'rejected'] },
            approvedAt: { not: null },
            createdAt: { gte: startOfMonth }
          },
          select: { createdAt: true, approvedAt: true }
        }),
        prisma.jenkinsJobApproval.findMany({
          where: {
            status: { in: ['approved', 'rejected'] },
            approvedAt: { not: null },
            createdAt: { gte: startOfMonth }
          },
          select: { createdAt: true, approvedAt: true }
        }),
        prisma.userRegistration.findMany({
          where: {
            status: { in: ['APPROVED', 'REJECTED'] },
            reviewedAt: { not: null },
            submittedAt: { gte: startOfMonth }
          },
          select: { submittedAt: true, reviewedAt: true }
        })
      ])
      // 合并所有已完成的审批记录，统一处理时间计算
      const allCompletedApprovals = [
        ...completedDeploymentApprovals.map(a => ({
          createdAt: a.createdAt,
          approvedAt: a.approvedAt
        })),
        ...completedJenkinsApprovals.map(a => ({
          createdAt: a.createdAt,
          approvedAt: a.approvedAt
        })),
        ...completedUserRegistrations.map(a => ({
          createdAt: a.submittedAt,
          approvedAt: a.reviewedAt
        }))
      ]

      let averageApprovalTime = 0
      if (allCompletedApprovals.length > 0) {
        const totalTime = allCompletedApprovals.reduce((sum, approval) => {
          if (approval.approvedAt) {
            const timeDiff = approval.approvedAt.getTime() - approval.createdAt.getTime()
            return sum + timeDiff
          }
          return sum
        }, 0)

        // 转换为小时
        averageApprovalTime = totalTime / allCompletedApprovals.length / (1000 * 60 * 60)
      }

      // 5. 本周处理统计 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [weeklyDeploymentApproved, weeklyJenkinsApproved, weeklyUserRegistrationApproved] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            status: 'approved',
            approvedAt: { gte: startOfWeek, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            status: 'approved',
            approvedAt: { gte: startOfWeek, lt: endOfDay }
          }
        }),
        prisma.userRegistration.count({
          where: {
            status: 'APPROVED',
            reviewedAt: { gte: startOfWeek, lt: endOfDay }
          }
        })
      ])
      const weeklyApproved = weeklyDeploymentApproved + weeklyJenkinsApproved + weeklyUserRegistrationApproved

      const [weeklyDeploymentRejected, weeklyJenkinsRejected, weeklyUserRegistrationRejected] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            status: 'rejected',
            approvedAt: { gte: startOfWeek, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            status: 'rejected',
            approvedAt: { gte: startOfWeek, lt: endOfDay }
          }
        }),
        prisma.userRegistration.count({
          where: {
            status: 'REJECTED',
            reviewedAt: { gte: startOfWeek, lt: endOfDay }
          }
        })
      ])
      const weeklyRejected = weeklyDeploymentRejected + weeklyJenkinsRejected + weeklyUserRegistrationRejected

      // 6. 本月处理统计 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [monthlyDeploymentApproved, monthlyJenkinsApproved, monthlyUserRegistrationApproved] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            status: 'approved',
            approvedAt: { gte: startOfMonth, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            status: 'approved',
            approvedAt: { gte: startOfMonth, lt: endOfDay }
          }
        }),
        prisma.userRegistration.count({
          where: {
            status: 'APPROVED',
            reviewedAt: { gte: startOfMonth, lt: endOfDay }
          }
        })
      ])
      const monthlyApproved = monthlyDeploymentApproved + monthlyJenkinsApproved + monthlyUserRegistrationApproved

      const [monthlyDeploymentRejected, monthlyJenkinsRejected, monthlyUserRegistrationRejected] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            status: 'rejected',
            approvedAt: { gte: startOfMonth, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            status: 'rejected',
            approvedAt: { gte: startOfMonth, lt: endOfDay }
          }
        }),
        prisma.userRegistration.count({
          where: {
            status: 'REJECTED',
            reviewedAt: { gte: startOfMonth, lt: endOfDay }
          }
        })
      ])
      const monthlyRejected = monthlyDeploymentRejected + monthlyJenkinsRejected + monthlyUserRegistrationRejected

      // 7. 我的处理统计 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [myTodayDeploymentProcessed, myTodayJenkinsProcessed, myTodayUserRegistrationProcessed] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            approverId: user.id,
            status: { in: ['approved', 'rejected'] },
            approvedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            approverId: user.id,
            status: { in: ['approved', 'rejected'] },
            approvedAt: { gte: startOfDay, lt: endOfDay }
          }
        }),
        // 用户注册审批：只有管理员可以审批
        (user.role === 'admin' || user.permissions.includes('admin:users'))
          ? prisma.userRegistration.count({
              where: {
                reviewedBy: user.id,
                status: { in: ['APPROVED', 'REJECTED'] },
                reviewedAt: { gte: startOfDay, lt: endOfDay }
              }
            })
          : Promise.resolve(0)
      ])
      const myTodayProcessed = myTodayDeploymentProcessed + myTodayJenkinsProcessed + myTodayUserRegistrationProcessed

      const [myWeeklyDeploymentProcessed, myWeeklyJenkinsProcessed, myWeeklyUserRegistrationProcessed] = await Promise.all([
        prisma.deploymentApproval.count({
          where: {
            approverId: user.id,
            status: { in: ['approved', 'rejected'] },
            approvedAt: { gte: startOfWeek, lt: endOfDay }
          }
        }),
        prisma.jenkinsJobApproval.count({
          where: {
            approverId: user.id,
            status: { in: ['approved', 'rejected'] },
            approvedAt: { gte: startOfWeek, lt: endOfDay }
          }
        }),
        // 用户注册审批：只有管理员可以审批
        (user.role === 'admin' || user.permissions.includes('admin:users'))
          ? prisma.userRegistration.count({
              where: {
                reviewedBy: user.id,
                status: { in: ['APPROVED', 'REJECTED'] },
                reviewedAt: { gte: startOfWeek, lt: endOfDay }
              }
            })
          : Promise.resolve(0)
      ])
      const myWeeklyProcessed = myWeeklyDeploymentProcessed + myWeeklyJenkinsProcessed + myWeeklyUserRegistrationProcessed

      // 8. 获取最近的审批活动 - 包含部署审批、Jenkins任务审批和用户注册审批
      const [recentDeploymentApprovals, recentJenkinsApprovals, recentUserRegistrationApprovals] = await Promise.all([
        prisma.deploymentApproval.findMany({
          where: {
            status: { in: ['approved', 'rejected'] },
            approvedAt: { gte: startOfDay, lt: endOfDay }
          },
          include: {
            deployment: {
              select: {
                name: true,
                environment: true,
                project: { select: { name: true } }
              }
            }
          },
          orderBy: { approvedAt: 'desc' },
          take: 5
        }),
        prisma.jenkinsJobApproval.findMany({
          where: {
            status: { in: ['approved', 'rejected'] },
            approvedAt: { gte: startOfDay, lt: endOfDay }
          },
          include: {
            execution: {
              select: {
                jobName: true,
                operationType: true,
                config: { select: { name: true } }
              }
            }
          },
          orderBy: { approvedAt: 'desc' },
          take: 5
        }),
        prisma.userRegistration.findMany({
          where: {
            status: { in: ['APPROVED', 'REJECTED'] },
            reviewedAt: { gte: startOfDay, lt: endOfDay }
          },
          orderBy: { reviewedAt: 'desc' },
          take: 5
        })
      ])

      // 合并并排序最近的审批活动
      const allRecentApprovals = [
        ...recentDeploymentApprovals.map(approval => ({
          id: approval.id,
          status: approval.status,
          approvedAt: approval.approvedAt,
          type: 'deployment' as const,
          deploymentName: approval.deployment.name,
          projectName: approval.deployment.project?.name || '未知项目',
          environment: approval.deployment.environment
        })),
        ...recentJenkinsApprovals.map(approval => ({
          id: approval.id,
          status: approval.status,
          approvedAt: approval.approvedAt,
          type: 'jenkins' as const,
          deploymentName: approval.execution.jobName,
          projectName: approval.execution.config?.name || '未知配置',
          environment: approval.execution.operationType
        })),
        ...recentUserRegistrationApprovals.map(approval => ({
          id: approval.id,
          status: approval.status.toLowerCase(),
          approvedAt: approval.reviewedAt,
          type: 'user_registration' as const,
          deploymentName: `用户注册 - ${approval.username}`,
          projectName: approval.realName || approval.username,
          environment: approval.status === 'APPROVED' ? '已批准' : '已拒绝'
        }))
      ].sort((a, b) => {
        if (!a.approvedAt || !b.approvedAt) return 0
        return b.approvedAt.getTime() - a.approvedAt.getTime()
      }).slice(0, 10)

      const stats = {
        // 总体统计
        totalApprovals,
        pendingApprovals,
        
        // 今日统计
        todayApproved,
        todayRejected,
        todayTotal: todayApproved + todayRejected,
        
        // 本周统计
        weeklyApproved,
        weeklyRejected,
        weeklyTotal: weeklyApproved + weeklyRejected,
        
        // 本月统计
        monthlyApproved,
        monthlyRejected,
        monthlyTotal: monthlyApproved + monthlyRejected,
        
        // 个人统计
        myPendingApprovals,
        myTodayProcessed,
        myWeeklyProcessed,
        
        // 平均审批时间（小时）
        averageApprovalTime: Math.round(averageApprovalTime * 100) / 100,
        
        // 最近活动
        recentApprovals: allRecentApprovals
      }

      console.log('✅ 审批统计数据获取成功:', {
        totalApprovals: stats.totalApprovals,
        pendingApprovals: stats.pendingApprovals,
        todayTotal: stats.todayTotal,
        averageApprovalTime: stats.averageApprovalTime
      })

      return NextResponse.json({
        success: true,
        data: stats
      })

    } catch (error) {
      console.error('❌ 获取审批统计数据失败:', error)
      return NextResponse.json({
        success: false,
        error: '获取审批统计数据失败'
      }, { status: 500 })
    }
  })
}
