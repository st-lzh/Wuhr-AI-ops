import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { notificationService } from '../../../../lib/services/notificationService'
import { infoNotificationService } from '../../../../lib/notifications/infoNotificationService'
import { logDeployment, LogLevel } from '../../../../lib/logging/cicdLogger'
import { z } from 'zod'
import { notificationManager } from '../../../../lib/notifications/manager'

// 部署任务创建验证schema
const createDeploymentSchema = z.object({
  projectId: z.string().min(1, '项目ID不能为空'),
  name: z.string().min(1, '部署任务名称不能为空').max(255, '名称过长'),
  description: z.string().optional(),
  environment: z.enum(['dev', 'test', 'staging', 'prod'], {
    errorMap: () => ({ message: '环境必须是 dev, test, staging, prod 之一' })
  }),
  templateId: z.string().optional(), // 部署模板ID
  deploymentHosts: z.array(z.string()).optional(), // 部署主机ID列表
  notificationUsers: z.array(z.string()).optional(), // 通知人员ID列表
  approvalUsers: z.array(z.string()).optional(), // 审批人员ID列表
  buildParameters: z.record(z.any()).optional(),
  selectedJobs: z.array(z.string()).optional(),
  executionOrder: z.array(z.number()).optional(),
  requireApproval: z.boolean().optional().default(false),
  approvers: z.array(z.string()).optional()
})

// 获取部署任务列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const projectId = searchParams.get('projectId')
    const environment = searchParams.get('environment')
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''
    const jenkinsOnly = searchParams.get('jenkinsOnly') === 'true'

    console.log('🔍 获取部署任务列表:', { page, limit, projectId, environment, status, search })

    const prisma = await getPrismaClient()

    // 构建查询条件
    let whereConditions: any = {
      userId: user.id // 只显示用户自己的部署任务
    }

    if (projectId) {
      whereConditions.projectId = projectId
    }

    if (environment) {
      whereConditions.environment = environment
    }

    if (status) {
      whereConditions.status = status
    }

    if (search) {
      whereConditions.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (jenkinsOnly) {
      whereConditions.isJenkinsDeployment = true
    }

    // 查询部署任务数据
    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where: whereConditions,
        select: {
          // 基本字段
          id: true,
          name: true,
          description: true,
          environment: true,
          version: true,
          status: true,
          deployScript: true,
          rollbackScript: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          deploymentHosts: true,
          notificationUsers: true,
          approvalUsers: true,
          requireApproval: true,
          // Jenkins相关字段
          isJenkinsDeployment: true,
          jenkinsJobId: true,
          jenkinsJobName: true,
          jenkinsJobIds: true,
          // 关联数据
          project: {
            select: { id: true, name: true, environment: true }
          },
          user: {
            select: { id: true, username: true, email: true }
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, username: true }
              }
            },
            orderBy: { level: 'asc' }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.deployment.count({ where: whereConditions })
    ])

    console.log(`✅ 获取部署任务列表成功，共 ${deployments.length} 个任务`)

    return NextResponse.json({
      success: true,
      data: {
        deployments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取部署任务列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取部署任务列表失败'
    }, { status: 500 })
  }
}

// 部署任务验证schema - 重构版本，支持完整CI/CD流程
const DeploymentSchema = z.object({
  projectId: z.string().min(1, '项目ID不能为空').optional(), // Jenkins部署任务可能不需要项目
  name: z.string().min(1, '部署名称不能为空').max(100, '部署名称过长'),
  description: z.string().optional(),
  environment: z.enum(['dev', 'test', 'staging', 'prod']),

  // 部署模板集成
  templateId: z.string().optional(), // 部署模板ID

  // Jenkins集成
  jenkinsJobId: z.string().optional(), // Jenkins任务ID（向后兼容）
  jenkinsJobIds: z.array(z.string()).optional(), // Jenkins任务ID列表（支持多选）
  isJenkinsDeployment: z.boolean().optional().default(false), // 是否为Jenkins部署任务

  // 系统集成
  deploymentHosts: z.array(z.string()).optional(), // 部署主机ID列表（Jenkins部署可能不需要）
  notificationUsers: z.array(z.string()).optional(), // 通知人员ID列表
  approvalUsers: z.array(z.string()).optional(), // 审批人员ID列表（可选）

  // 部署配置
  version: z.string().optional(),
  deployScript: z.string().optional(),
  rollbackScript: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  config: z.any().optional(),
  requireApproval: z.boolean().optional().default(true) // 默认需要审批
})

// 创建新部署任务
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    console.log('📥 接收到的部署任务数据:', body)

    // 验证输入数据
    const validationResult = DeploymentSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('❌ 输入数据验证失败:', validationResult.error.errors)
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    console.log('🔨 创建部署任务:', {
      projectId: data.projectId,
      name: data.name,
      environment: data.environment,
      isJenkinsDeployment: data.isJenkinsDeployment
    })

    // 验证项目是否存在且属于当前用户（非Jenkins部署任务需要）
    let project = null
    if (!data.isJenkinsDeployment && data.projectId) {
      project = await prisma.cICDProject.findFirst({
        where: {
          id: data.projectId,
          userId: user.id
        }
      })

      if (!project) {
        return NextResponse.json({
          success: false,
          error: '项目不存在或无权限访问'
        }, { status: 404 })
      }
    }



    // 验证部署模板（如果指定）
    let template = null
    if (data.templateId) {
      template = await prisma.deploymentTemplate.findUnique({
        where: { id: data.templateId },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      })

      if (!template) {
        return NextResponse.json({
          success: false,
          error: '指定的部署模板不存在'
        }, { status: 404 })
      }

      if (!template.isActive) {
        return NextResponse.json({
          success: false,
          error: '指定的部署模板已禁用'
        }, { status: 400 })
      }
    }

    // 验证Jenkins任务（如果是Jenkins部署任务）
    let jenkinsJob = null
    if (data.isJenkinsDeployment && data.jenkinsJobId) {
      // 这里可以添加Jenkins任务验证逻辑
      // 目前简单记录，后续可以扩展为实际的Jenkins API调用
      console.log('🔧 Jenkins部署任务:', data.jenkinsJobId)
    }

    // 验证部署主机是否存在且可用（非Jenkins部署任务需要）
    if (!data.isJenkinsDeployment && data.deploymentHosts && data.deploymentHosts.length > 0) {
      const servers = await prisma.server.findMany({
        where: {
          id: { in: data.deploymentHosts }
        },
        select: {
          id: true,
          name: true,
          status: true,
          hostname: true,
          ip: true,
          port: true
        }
      })

      if (servers.length !== data.deploymentHosts.length) {
        return NextResponse.json({
          success: false,
          error: '部分部署主机不存在'
        }, { status: 404 })
      }

      const offlineServers = servers.filter(s => s.status === 'offline')
      if (offlineServers.length > 0) {
        return NextResponse.json({
          success: false,
          error: `以下主机离线无法部署: ${offlineServers.map(s => s.name).join(', ')}`
        }, { status: 400 })
      }
    }



    // 处理计划部署时间
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null

    // 根据环境判断是否需要审批（现在所有部署任务都需要审批）
    const needsApproval = true // 强制所有部署任务都需要审批
    const initialStatus = 'pending' // 所有任务都从待审批状态开始

    console.log('🔍 部署审批判断:', {
      environment: data.environment,
      requireApproval: data.requireApproval,
      needsApproval,
      initialStatus
    })

    // 验证和获取Jenkins任务名称（如果是Jenkins部署任务）
    let jenkinsJobName = null
    if (data.isJenkinsDeployment && (data.jenkinsJobIds || data.jenkinsJobId)) {
      const jobNames = data.jenkinsJobIds || (data.jenkinsJobId ? [data.jenkinsJobId] : [])

      if (jobNames.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Jenkins部署任务必须选择至少一个Jenkins任务'
        }, { status: 400 })
      }

      // 验证Jenkins任务是否在服务器上存在
      const validJobNames = []
      const invalidJobNames = []

      // 获取第一个可用的Jenkins配置来验证任务
      const jenkinsConfigs = await prisma.jenkinsConfig.findMany({
        where: { isActive: true },
        select: { id: true, name: true, serverUrl: true, username: true, apiToken: true },
        orderBy: { createdAt: 'asc' }
      })

      if (jenkinsConfigs.length === 0) {
        return NextResponse.json({
          success: false,
          error: '没有可用的Jenkins配置'
        }, { status: 400 })
      }

      const jenkinsConfig = jenkinsConfigs[0]
      console.log(`🔍 [部署创建] 使用Jenkins配置验证任务: ${jenkinsConfig.name}`)

      try {
        // 创建Jenkins客户端验证任务是否存在
        let authToken = undefined
        if (jenkinsConfig.username && jenkinsConfig.apiToken) {
          authToken = `${jenkinsConfig.username}:${jenkinsConfig.apiToken}`
        } else if (jenkinsConfig.apiToken) {
          authToken = jenkinsConfig.apiToken
        }

        const { createJenkinsClient } = await import('../../../../lib/jenkins/client')
        const client = createJenkinsClient({
          jobUrl: jenkinsConfig.serverUrl,
          authToken: authToken
        })

        // 获取Jenkins服务器上的所有任务
        const availableJobs = await client.getJobs()
        const availableJobNames = availableJobs.map(job => job.name)

        console.log(`📋 [部署创建] Jenkins服务器上可用任务: ${availableJobNames.join(', ')}`)

        // 验证每个选中的任务是否存在
        for (const jobName of jobNames) {
          if (availableJobNames.includes(jobName)) {
            validJobNames.push(jobName)
            console.log(`✅ [部署创建] 任务验证通过: ${jobName}`)
          } else {
            invalidJobNames.push(jobName)
            console.warn(`⚠️ [部署创建] 任务不存在: ${jobName}`)
          }
        }

      } catch (error) {
        console.error(`❌ [部署创建] Jenkins任务验证失败:`, error)
        return NextResponse.json({
          success: false,
          error: 'Jenkins任务验证失败，请检查Jenkins服务器连接',
          details: error instanceof Error ? error.message : '未知错误'
        }, { status: 400 })
      }

      if (invalidJobNames.length > 0) {
        return NextResponse.json({
          success: false,
          error: `以下Jenkins任务在服务器上不存在: ${invalidJobNames.join(', ')}`,
          details: {
            invalidJobNames,
            validJobNames,
            suggestion: '请检查Jenkins任务名称是否正确，或者在Jenkins服务器上创建这些任务'
          }
        }, { status: 400 })
      }

      jenkinsJobName = validJobNames.join(', ')
      console.log(`🔍 [部署创建] Jenkins任务验证成功: ${validJobNames.length}个任务`)
    }

    // 创建部署任务
    const deployment = await prisma.deployment.create({
      data: {
        projectId: data.projectId || null, // Jenkins部署任务可能没有项目
        name: data.name,
        description: data.description,
        environment: data.environment,
        version: data.version,
        templateId: data.templateId, // 关联部署模板
        jenkinsJobId: data.jenkinsJobId || (data.jenkinsJobIds && data.jenkinsJobIds[0]) || null, // Jenkins任务名称（向后兼容）
        jenkinsJobIds: data.jenkinsJobIds || (data.jenkinsJobId ? [data.jenkinsJobId] : []), // Jenkins任务名称列表
        jenkinsJobName: jenkinsJobName, // Jenkins任务名称
        isJenkinsDeployment: data.isJenkinsDeployment || false, // 是否为Jenkins部署任务
        deployScript: data.deployScript,
        rollbackScript: data.rollbackScript,
        scheduledAt: scheduledAt,
        config: data.config,
        deploymentHosts: data.deploymentHosts || [],
        notificationUsers: data.notificationUsers || [],
        approvalUsers: data.approvalUsers || [],
        requireApproval: needsApproval,
        userId: user.id,
        status: initialStatus
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            environment: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    })

    console.log('✅ 部署任务创建成功:', deployment.id)

    // 如果需要审批，创建审批记录并发送通知
    if (needsApproval) {
      try {
        // 获取审批人列表
        let approvers = data.approvalUsers || []

        console.log('🔍 审批配置检查:', {
          needsApproval,
          approvalUsers: data.approvalUsers,
          approvers: approvers,
          finalApprovers: approvers,
          environment: data.environment,
          isJenkinsDeployment: data.isJenkinsDeployment
        })

        // 如果没有指定审批人，根据环境自动分配
        if (approvers.length === 0) {
          if (data.environment === 'prod') {
            // 生产环境需要管理员审批
            const adminUsers = await prisma.user.findMany({
              where: {
                OR: [
                  { role: 'admin' },
                  { role: 'manager' },
                  { permissions: { has: 'cicd:approve' } }
                ]
              },
              select: { id: true }
            })
            approvers = adminUsers.map(u => u.id)
          }
        }

        if (approvers.length > 0) {
          // 创建审批记录
          const approvals = await Promise.all(
            approvers.map(async (approverId: string) => {
              const approval = await prisma.deploymentApproval.create({
                data: {
                  deploymentId: deployment.id,
                  approverId: approverId,
                  status: 'pending',
                  level: 1,
                  comments: '等待审批'
                }
              })

              // 发送审批请求通知
              try {
                console.log(`🔔 发送审批通知给用户: ${approverId}`)

                // 创建特殊格式的通知ID，以便审批API能识别
                const notificationId = `cicd_approval_${approval.id}`

                // 确定项目/任务名称显示
                const projectDisplayName = deployment.isJenkinsDeployment
                  ? (jenkinsJobName || deployment.project?.name || 'Jenkins任务')
                  : (deployment.project?.name || '未知项目')

                await infoNotificationService.createNotification({
                  type: 'deployment_approval',
                  title: `部署审批：${deployment.name}`,
                  content: `${deployment.isJenkinsDeployment ? 'Jenkins任务' : '项目'} ${projectDisplayName} 在 ${deployment.environment.toUpperCase()} 环境的部署任务需要您的审批。申请人：${user.username}`,
                  userId: approverId,
                  actionUrl: `/notifications`, // 跳转到通知管理页面
                  actionText: '去审批',
                  metadata: {
                    deploymentId: deployment.id,
                    approvalId: approval.id, // 添加审批记录ID
                    notificationId: notificationId, // 添加特殊格式的通知ID
                    environment: deployment.environment,
                    projectName: projectDisplayName,
                    requesterName: user.username,
                    senderId: user.id,
                    action: 'approval_required',
                    isJenkinsDeployment: deployment.isJenkinsDeployment,
                    jenkinsJobName: jenkinsJobName,
                    // 添加跳转相关的元数据
                    approvalManagementUrl: `/approval-management?type=deployment&status=pending`,
                    deploymentManagementUrl: `/cicd/deployments?tab=pending`
                  }
                })

                console.log(`✅ 审批通知发送成功: ${approverId}, 审批ID: ${approval.id}`)
              } catch (notifyError) {
                console.error('❌ 发送审批请求通知失败:', notifyError)
              }

              return approval
            })
          )

          console.log(`✅ 创建了 ${approvals.length} 个审批记录`)
        } else {
          console.log('⚠️ 没有找到合适的审批人，部署任务将直接进入已审批状态')
          // 如果没有审批人，直接设置为已审批状态
          await prisma.deployment.update({
            where: { id: deployment.id },
            data: { status: 'approved' }
          })
        }
      } catch (approvalError) {
        console.error('❌ 创建审批记录失败:', approvalError)
      }
    } else {
      // 不需要审批的情况，可以考虑直接开始部署
      console.log('ℹ️ 部署任务不需要审批，状态为已审批')
    }

    // 发送通知给通知人员（避免重复通知）
    if (data.notificationUsers && data.notificationUsers.length > 0) {
      try {
        // 获取已发送审批通知的用户ID列表
        const approverIds = new Set(data.approvalUsers || [])

        // 过滤掉已经收到审批通知的用户，避免重复通知
        const uniqueNotificationUsers = data.notificationUsers.filter(userId => !approverIds.has(userId))

        if (uniqueNotificationUsers.length > 0) {
          console.log(`🔔 发送部署状态通知给 ${uniqueNotificationUsers.length} 个用户（已排除 ${data.notificationUsers.length - uniqueNotificationUsers.length} 个审批人员）`)

          // 确定项目/任务名称显示
          const projectDisplayName = deployment.isJenkinsDeployment
            ? (jenkinsJobName || deployment.project?.name || 'Jenkins任务')
            : (deployment.project?.name || '未知项目')

          // 为每个通知人员创建通知
          for (const notificationUserId of uniqueNotificationUsers) {
            await infoNotificationService.createNotification({
              type: 'deployment_notification',
              title: `部署状态更新：${deployment.name}`,
              content: `${deployment.isJenkinsDeployment ? 'Jenkins任务' : '项目'} ${projectDisplayName} 在 ${deployment.environment.toUpperCase()} 环境的部署任务已创建${needsApproval ? '，等待审批' : '，准备部署'}`,
              userId: notificationUserId,
              actionUrl: `/notifications`, // 跳转到通知管理页面
              actionText: '查看详情',
              metadata: {
                deploymentId: deployment.id,
                environment: deployment.environment,
                projectName: projectDisplayName,
                status: deployment.status,
                requesterName: user.username,
                senderId: user.id,
                action: 'status_notification',
                isJenkinsDeployment: deployment.isJenkinsDeployment,
                jenkinsJobName: jenkinsJobName,
                // 添加跳转相关的元数据
                notificationManagementUrl: `/notification-management?type=deployment`,
                deploymentManagementUrl: `/cicd/deployments`
              }
            })
          }

          console.log(`✅ 部署状态通知发送成功: ${uniqueNotificationUsers.length} 个用户`)
        } else {
          console.log('ℹ️ 所有通知人员都已收到审批通知，跳过状态通知发送')
        }

        console.log(`✅ 部署状态通知发送成功: ${data.notificationUsers.length} 个用户`)
      } catch (notifyError) {
        console.error('❌ 发送部署通知失败:', notifyError)
      }
    }

    return NextResponse.json({
      success: true,
      data: deployment,
      message: '部署任务创建成功'
    })

  } catch (error) {
    console.error('❌ 创建部署任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建部署任务失败'
    }, { status: 500 })
  }
}
