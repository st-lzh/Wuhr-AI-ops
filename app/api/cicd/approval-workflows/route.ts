import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// 审批工作流验证schema
const ApprovalWorkflowSchema = z.object({
  name: z.string().min(1, '工作流名称不能为空').max(100, '工作流名称过长'),
  description: z.string().optional(),
  environment: z.enum(['dev', 'test', 'prod']),
  projectId: z.string().optional(),
  isDefault: z.boolean().default(false),
  config: z.object({
    levels: z.array(z.object({
      level: z.number().int().positive(),
      name: z.string(),
      description: z.string().optional(),
      approvers: z.array(z.string()), // 用户ID数组
      requiredApprovals: z.number().int().positive().default(1),
      isParallel: z.boolean().default(false), // 是否并行审批
      timeout: z.number().int().positive().optional(), // 超时时间（小时）
      conditions: z.object({
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
        requiresReason: z.boolean().default(false),
        allowSelfApproval: z.boolean().default(false)
      }).optional()
    })),
    autoApproval: z.object({
      enabled: z.boolean().default(false),
      conditions: z.object({
        environments: z.array(z.string()).optional(),
        maxRisk: z.enum(['low', 'medium', 'high']).optional(),
        timeWindows: z.array(z.object({
          start: z.string(),
          end: z.string(),
          days: z.array(z.number())
        })).optional()
      }).optional()
    }).optional(),
    notifications: z.object({
      enabled: z.boolean().default(true),
      channels: z.array(z.enum(['email', 'slack', 'webhook'])).default(['email']),
      escalation: z.object({
        enabled: z.boolean().default(false),
        timeoutHours: z.number().int().positive().default(24),
        escalateTo: z.array(z.string()).optional()
      }).optional()
    }).optional()
  })
})

// 获取审批工作流列表
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
    const environment = searchParams.get('environment')
    const projectId = searchParams.get('projectId')
    const isDefault = searchParams.get('isDefault')

    const prisma = await getPrismaClient()

    // 构建查询条件
    const where: any = {
      userId: user.id
    }

    if (environment) {
      where.environment = environment
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (isDefault !== null) {
      where.isDefault = isDefault === 'true'
    }

    // 查询工作流列表
    const [workflows, total] = await Promise.all([
      prisma.approvalWorkflow.findMany({
        where,
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.approvalWorkflow.count({ where })
    ])

    console.log(`✅ 获取审批工作流列表成功，共 ${workflows.length} 个工作流`)

    return NextResponse.json({
      success: true,
      data: {
        workflows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取审批工作流列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取审批工作流列表失败'
    }, { status: 500 })
  }
}

// 创建审批工作流
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = ApprovalWorkflowSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    console.log('🔨 创建审批工作流:', { name: data.name, environment: data.environment })

    // 验证项目是否存在（如果指定了项目）
    if (data.projectId) {
      const project = await prisma.cICDProject.findFirst({
        where: {
          id: data.projectId,
          userId: user.id
        }
      })

      if (!project) {
        return NextResponse.json({
          success: false,
          error: '指定的项目不存在或无权限访问'
        }, { status: 404 })
      }
    }

    // 验证审批人是否存在
    const allApproverIds = data.config.levels.flatMap(level => level.approvers)
    const uniqueApproverIds = Array.from(new Set(allApproverIds))
    
    const existingUsers = await prisma.user.findMany({
      where: {
        id: { in: uniqueApproverIds }
      },
      select: { id: true }
    })

    const existingUserIds = existingUsers.map(u => u.id)
    const invalidApproverIds = uniqueApproverIds.filter(id => !existingUserIds.includes(id))

    if (invalidApproverIds.length > 0) {
      return NextResponse.json({
        success: false,
        error: `以下审批人不存在: ${invalidApproverIds.join(', ')}`
      }, { status: 400 })
    }

    // 如果设置为默认工作流，先取消其他默认工作流
    if (data.isDefault) {
      await prisma.approvalWorkflow.updateMany({
        where: {
          userId: user.id,
          environment: data.environment,
          projectId: data.projectId || null,
          isDefault: true
        },
        data: { isDefault: false }
      })
    }

    // 创建审批工作流
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        name: data.name,
        description: data.description,
        environment: data.environment,
        projectId: data.projectId,
        isDefault: data.isDefault,
        config: data.config,
        userId: user.id
      },
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
        }
      }
    })

    console.log('✅ 审批工作流创建成功:', workflow.id)

    return NextResponse.json({
      success: true,
      data: workflow,
      message: '审批工作流创建成功'
    })

  } catch (error) {
    console.error('❌ 创建审批工作流失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建审批工作流失败'
    }, { status: 500 })
  }
}
