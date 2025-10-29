import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'

// 审批工作流更新验证schema
const UpdateApprovalWorkflowSchema = z.object({
  name: z.string().min(1, '工作流名称不能为空').max(100, '工作流名称过长').optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  config: z.object({
    levels: z.array(z.object({
      level: z.number().int().positive(),
      name: z.string(),
      description: z.string().optional(),
      approvers: z.array(z.string()),
      requiredApprovals: z.number().int().positive().default(1),
      isParallel: z.boolean().default(false),
      timeout: z.number().int().positive().optional(),
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
  }).optional()
})

// 获取单个审批工作流详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const workflowId = params.id
    const prisma = await getPrismaClient()

    // 查询工作流详情
    const workflow = await prisma.approvalWorkflow.findFirst({
      where: {
        id: workflowId,
        userId: user.id
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            environment: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    })

    if (!workflow) {
      return NextResponse.json({
        success: false,
        error: '审批工作流不存在或无权限访问'
      }, { status: 404 })
    }

    // 获取审批人详细信息
    const config = workflow.config as any
    if (config.levels) {
      const allApproverIds = config.levels.flatMap((level: any) => level.approvers)
      const uniqueApproverIds = Array.from(new Set(allApproverIds)) as string[]
      
      const approvers = await prisma.user.findMany({
        where: {
          id: { in: uniqueApproverIds }
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true
        }
      })

      // 将审批人信息添加到配置中
      config.levels = config.levels.map((level: any) => ({
        ...level,
        approverDetails: level.approvers.map((approverId: string) => 
          approvers.find(a => a.id === approverId)
        ).filter(Boolean)
      }))
    }

    console.log('✅ 获取审批工作流详情成功:', workflow.id)

    return NextResponse.json({
      success: true,
      data: {
        ...workflow,
        config
      }
    })

  } catch (error) {
    console.error('❌ 获取审批工作流详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取审批工作流详情失败'
    }, { status: 500 })
  }
}

// 更新审批工作流
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const workflowId = params.id
    const body = await request.json()

    // 验证输入数据
    const validationResult = UpdateApprovalWorkflowSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 验证工作流是否存在且属于当前用户
    const existingWorkflow = await prisma.approvalWorkflow.findFirst({
      where: {
        id: workflowId,
        userId: user.id
      }
    })

    if (!existingWorkflow) {
      return NextResponse.json({
        success: false,
        error: '审批工作流不存在或无权限访问'
      }, { status: 404 })
    }

    // 如果更新配置，验证审批人是否存在
    if (data.config?.levels) {
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
    }

    // 如果设置为默认工作流，先取消其他默认工作流
    if (data.isDefault === true) {
      await prisma.approvalWorkflow.updateMany({
        where: {
          userId: user.id,
          environment: existingWorkflow.environment,
          projectId: existingWorkflow.projectId,
          isDefault: true,
          id: { not: workflowId }
        },
        data: { isDefault: false }
      })
    }

    // 更新工作流
    const updatedWorkflow = await prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: data,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            environment: true
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

    console.log('✅ 审批工作流更新成功:', updatedWorkflow.id)

    return NextResponse.json({
      success: true,
      data: updatedWorkflow,
      message: '审批工作流更新成功'
    })

  } catch (error) {
    console.error('❌ 更新审批工作流失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新审批工作流失败'
    }, { status: 500 })
  }
}

// 删除审批工作流
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const workflowId = params.id
    const prisma = await getPrismaClient()

    // 验证工作流是否存在且属于当前用户
    const existingWorkflow = await prisma.approvalWorkflow.findFirst({
      where: {
        id: workflowId,
        userId: user.id
      }
    })

    if (!existingWorkflow) {
      return NextResponse.json({
        success: false,
        error: '审批工作流不存在或无权限访问'
      }, { status: 404 })
    }

    // 检查是否有正在使用的审批任务
    const activeApprovals = await prisma.deploymentApproval.count({
      where: {
        status: 'pending',
        deployment: {
          environment: existingWorkflow.environment,
          projectId: existingWorkflow.projectId || undefined
        }
      }
    })

    if (activeApprovals > 0) {
      return NextResponse.json({
        success: false,
        error: `无法删除工作流，存在 ${activeApprovals} 个正在使用的审批任务`
      }, { status: 400 })
    }

    // 删除工作流
    await prisma.approvalWorkflow.delete({
      where: { id: workflowId }
    })

    console.log('✅ 审批工作流删除成功:', workflowId)

    return NextResponse.json({
      success: true,
      message: '审批工作流删除成功'
    })

  } catch (error) {
    console.error('❌ 删除审批工作流失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除审批工作流失败'
    }, { status: 500 })
  }
}
