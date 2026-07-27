import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { triggerApprovedDeployment } from '../../../../../lib/services/deploymentTriggerService'
import { CICDContextError, resolveCICDContext } from '../../../../../lib/ai/cicdContext'

const ActionSchema = z.object({
  action: z.literal('deploy'),
  cicdContext: z.object({
    projectId: z.string().optional(),
    pipelineId: z.string().optional(),
    deploymentId: z.string().min(1, '请选择发布任务'),
    buildId: z.string().optional()
  })
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const { user } = authResult

    if (user.role !== 'admin' && user.role !== 'manager' && !user.permissions.includes('cicd:write')) {
      return NextResponse.json({ success: false, error: '没有 CI/CD 执行权限' }, { status: 403 })
    }

    const parsed = ActionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '交付操作参数无效', details: parsed.error.errors }, { status: 400 })
    }

    const prisma = await getPrismaClient()
    const context = await resolveCICDContext(prisma, parsed.data.cicdContext)
    if (!context?.deployment) {
      return NextResponse.json({ success: false, error: '发布执行必须选择具体发布任务' }, { status: 400 })
    }

    const deployment = await prisma.deployment.findUnique({
      where: { id: context.deployment.id },
      include: { approvals: true }
    })
    if (!deployment) return NextResponse.json({ success: false, error: '发布任务不存在' }, { status: 404 })

    if (deployment.status === 'pending') {
      let pendingApprovals = deployment.approvals.filter(item => item.status === 'pending')
      if (pendingApprovals.length === 0) {
        const configuredApprovers = Array.isArray(deployment.approvalUsers)
          ? deployment.approvalUsers.filter((item): item is string => typeof item === 'string')
          : []
        const fallbackApprovers = configuredApprovers.length > 0
          ? []
          : await prisma.user.findMany({
            where: {
              isActive: true,
              OR: [
                { role: 'admin' },
                { role: 'manager' },
                { permissions: { has: 'approvals:write' } }
              ]
            },
            select: { id: true }
          })
        const approverIds = Array.from(new Set([
          ...configuredApprovers,
          ...fallbackApprovers.map(item => item.id)
        ]))

        if (approverIds.length === 0) {
          await prisma.systemLog.create({
            data: {
              level: 'warn',
              category: 'ai_cicd',
              message: `AI 发布请求被阻止：${deployment.name} 没有审批人`,
              source: 'ai-assistant',
              userId: user.id,
              details: { action: 'deploy_blocked', deploymentId: deployment.id, reason: 'no_approver' }
            }
          })
          return NextResponse.json({
            success: false,
            state: 'approval_unconfigured',
            error: '发布任务没有可用审批人，已阻止执行；请先配置审批人员'
          }, { status: 409 })
        }

        await prisma.$transaction([
          ...approverIds.map((approverId, index) => prisma.deploymentApproval.create({
            data: {
              deploymentId: deployment.id,
              approverId,
              status: 'pending',
              level: index + 1,
              comments: '由 AI 助手提交发布申请'
            }
          })),
          prisma.deployment.update({
            where: { id: deployment.id },
            data: { requireApproval: true, approvalUsers: approverIds, updatedAt: new Date() }
          }),
          prisma.systemLog.create({
            data: {
              level: 'info',
              category: 'ai_cicd',
              message: `AI 助手提交发布审批：${deployment.name}`,
              source: 'ai-assistant',
              userId: user.id,
              details: {
                action: 'deploy_approval_requested',
                deploymentId: deployment.id,
                projectId: deployment.projectId,
                approverIds
              }
            }
          })
        ])
        pendingApprovals = approverIds.map((approverId, index) => ({
          id: '',
          deploymentId: deployment.id,
          approverId,
          status: 'pending' as const,
          comments: null,
          approvedAt: null,
          level: index + 1,
          isRequired: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      }

      return NextResponse.json({
        success: true,
        state: 'awaiting_approval',
        data: {
          deploymentId: deployment.id,
          deploymentName: deployment.name,
          environment: deployment.environment,
          status: deployment.status,
          pendingApprovals: pendingApprovals.length,
          approvalUrl: '/approval-management?type=deployment&status=pending'
        },
        message: '发布申请已提交，审批通过后才会执行'
      }, { status: 202 })
    }

    const result = await triggerApprovedDeployment(deployment.id, user.id, prisma)
    await prisma.systemLog.create({
      data: {
        level: result.success ? 'info' : 'warn',
        category: 'ai_cicd',
        message: `AI 交付操作：${deployment.name} - ${result.message}`,
        source: 'ai-assistant',
        userId: user.id,
        details: {
          action: 'deploy',
          deploymentId: deployment.id,
          projectId: deployment.projectId,
          state: result.state,
          status: result.status
        }
      }
    })

    return NextResponse.json({ success: result.success, state: result.state, data: result, message: result.message }, {
      status: result.success ? 200 : 409
    })
  } catch (error) {
    if (error instanceof CICDContextError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('AI 交付操作失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '交付操作失败'
    }, { status: 500 })
  }
}
