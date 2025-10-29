import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取操作类型的中文描述
function getOperationText(type: string): string {
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
  return operationMap[type] || type
}

// 获取待审批任务通知
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user

    // 获取待审批的用户注册
    const prisma = await getPrismaClient()
    const pendingUsers = await prisma.userRegistration.findMany({
      where: {
        status: 'PENDING'
      },
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        reason: true,
        status: true,
        submittedAt: true
      },
      orderBy: {
        submittedAt: 'asc'
      }
    })

    // 获取待审批的CI/CD任务（如果用户有权限）
    let pendingCICDApprovals: any[] = []
    if (user.permissions.includes('cicd:read') || user.role === 'admin' || user.role === 'manager') {
      try {
        const prisma = await getPrismaClient()
        pendingCICDApprovals = await prisma.deploymentApproval.findMany({
          where: {
            status: 'pending',
            approverId: user.id
          },
          include: {
            deployment: {
              select: {
                id: true,
                name: true,
                environment: true,
                isJenkinsDeployment: true,
                jenkinsJobName: true,
                jenkinsJobId: true,
                project: {
                  select: { id: true, name: true }
                },
                user: {
                  select: { id: true, username: true }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          },
          take: 10 // 限制数量
        })

        console.log('🔍 查询到的CI/CD审批记录数量:', pendingCICDApprovals.length)

        // 检查数据完整性并过滤无效记录
        pendingCICDApprovals = pendingCICDApprovals.filter((approval, index) => {
          if (!approval.deployment) {
            console.warn(`⚠️ 审批记录 ${index} 缺少部署信息:`, approval.id)
            return false
          } else if (!approval.deployment.user) {
            console.warn(`⚠️ 部署记录 ${approval.deployment.id} 缺少用户信息`)
            return false
          } else if (!approval.deployment.user.username) {
            console.warn(`⚠️ 用户记录 ${approval.deployment.user.id} 缺少用户名`)
            return false
          }
          return true
        })
      } catch (error) {
        console.warn('获取CI/CD审批任务失败:', error)
        // 继续执行，不影响用户审批
      }
    }

    // 获取待审批的Jenkins任务（如果用户有权限）
    let pendingJenkinsApprovals: any[] = []
    if (user.permissions.includes('jenkins:read') || user.role === 'admin' || user.role === 'manager') {
      try {
        const prisma = await getPrismaClient()
        pendingJenkinsApprovals = await prisma.jenkinsJobApproval.findMany({
          where: {
            status: 'pending',
            approverId: user.id
          },
          include: {
            execution: {
              include: {
                config: {
                  select: { id: true, name: true }
                },
                requester: {
                  select: { id: true, username: true, realName: true }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          },
          take: 10 // 限制数量
        })

        console.log('🔍 查询到的Jenkins审批记录数量:', pendingJenkinsApprovals.length)

        // 检查数据完整性并过滤无效记录
        pendingJenkinsApprovals = pendingJenkinsApprovals.filter((approval, index) => {
          if (!approval.execution) {
            console.warn(`⚠️ Jenkins审批记录 ${index} 缺少执行信息:`, approval.id)
            return false
          } else if (!approval.execution.requester) {
            console.warn(`⚠️ Jenkins执行记录 ${approval.execution.id} 缺少请求者信息`)
            return false
          }
          return true
        })
      } catch (error) {
        console.warn('获取Jenkins审批任务失败:', error)
        // 继续执行，不影响其他审批
      }
    }

    // 构建通知数据
    const notifications = []

    // 添加用户注册审批通知
    for (const registration of pendingUsers) {
      notifications.push({
        id: `user_registration_${registration.id}`,
        type: 'user_registration',
        title: '新用户注册待审批',
        message: `用户 ${registration.username} (${registration.email}) 已注册，等待您的审批`,
        data: {
          registrationId: registration.id,
          username: registration.username,
          email: registration.email,
          realName: registration.realName,
          reason: registration.reason,
          role: 'viewer',
          createdAt: registration.submittedAt
        },
        createdAt: registration.submittedAt,
        canApprove: user.role === 'admin' || user.permissions?.includes('admin:users')
      })
    }

    // 添加CI/CD审批通知
    for (const approval of pendingCICDApprovals) {
      // 安全获取项目名称，支持Jenkins部署任务
      const projectName = approval.deployment.project?.name ||
                         approval.deployment.jenkinsJobName ||
                         '未知项目'

      const isJenkinsDeployment = approval.deployment.isJenkinsDeployment || false
      const taskType = isJenkinsDeployment ? 'Jenkins任务' : '项目'

      notifications.push({
        id: `cicd_approval_${approval.id}`,
        type: 'cicd_approval',
        title: `${taskType}部署审批`,
        message: `${taskType} ${projectName} 的部署任务等待您的审批`,
        data: {
          approvalId: approval.id,
          deploymentId: approval.deploymentId,
          deploymentName: approval.deployment.name,
          projectName: projectName,
          creatorName: approval.deployment.user?.username || '未知用户',
          environment: approval.deployment.environment,
          isJenkinsDeployment: isJenkinsDeployment,
          jenkinsJobName: approval.deployment.jenkinsJobName || null,
          createdAt: approval.createdAt
        },
        createdAt: approval.createdAt,
        canApprove: true
      })
    }

    // 添加Jenkins任务审批通知
    for (const approval of pendingJenkinsApprovals) {
      notifications.push({
        id: `jenkins_job_${approval.id}`,
        type: 'jenkins_approval',
        title: 'Jenkins任务审批',
        message: `Jenkins任务 ${approval.execution.jobName} (${getOperationText(approval.execution.operationType)}) 等待您的审批`,
        data: {
          approvalId: approval.id,
          executionId: approval.executionId,
          jobName: approval.execution.jobName,
          operationType: approval.execution.operationType,
          configName: approval.execution.config?.name || '未知配置',
          requesterName: approval.execution.requester?.realName || approval.execution.requester?.username || '未知用户',
          reason: approval.execution.reason,
          createdAt: approval.createdAt
        },
        createdAt: approval.createdAt,
        canApprove: true
      })
    }

    // 按创建时间排序
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total: notifications.length,
        counts: {
          user: pendingUsers.length,
          cicd: pendingCICDApprovals.length,
          jenkins: pendingJenkinsApprovals.length
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取待审批通知失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取待审批通知失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
