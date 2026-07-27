import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { canWriteTeamAssets } from '../../../../../lib/auth/teamAccess'
import { z } from 'zod'

const DeploymentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  environment: z.enum(['dev', 'test', 'staging', 'prod']),
  version: z.string().max(100).optional().nullable(),
  deployScript: z.string().max(100000).optional().nullable(),
  rollbackScript: z.string().max(100000).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  deploymentHosts: z.array(z.string().min(1)).min(1).max(64),
  notificationUsers: z.array(z.string().min(1)).max(100).default([]),
  approvalUsers: z.array(z.string().min(1)).min(1).max(20)
})

// 获取部署详情
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

    const deploymentId = params.id

    console.log(`📋 获取部署详情: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 获取部署详情
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repositoryUrl: true,
            branch: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            realName: true
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

    console.log(`✅ 获取部署详情成功: ${deployment.name}`)

    return NextResponse.json({
      success: true,
      data: {
        deployment
      }
    })

  } catch (error) {
    console.error('❌ 获取部署详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取部署详情失败'
    }, { status: 500 })
  }
}

// 更新部署任务
export async function PUT(
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
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有部署任务写入权限' }, { status: 403 })
    }
    const deploymentId = params.id
    const parsed = DeploymentUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: '部署任务信息校验失败', details: parsed.error.flatten() }, { status: 400 })
    const body = parsed.data

    console.log(`📝 更新部署任务: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 部署任务属于可信团队共享资产。
    const existingDeployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId
      }
    })

    if (!existingDeployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在或无权限修改'
      }, { status: 404 })
    }

    if (!['pending', 'rejected', 'failed'].includes(existingDeployment.status)) {
      return NextResponse.json({ success: false, error: `当前状态 ${existingDeployment.status} 不允许修改；已审批任务请新建部署版本，避免审批后配置被替换` }, { status: 409 })
    }
    if (body.environment === 'prod' && !body.rollbackScript?.trim()) {
      return NextResponse.json({ success: false, error: '生产环境必须配置真实回滚脚本' }, { status: 400 })
    }

    const [serverCount, eligibleApprovers] = await Promise.all([
      prisma.server.count({ where: { id: { in: body.deploymentHosts }, isActive: true } }),
      prisma.user.findMany({
        where: {
          id: { in: body.approvalUsers }, isActive: true, approvalStatus: 'approved',
          OR: [{ role: 'admin' }, { role: 'manager' }, { permissions: { has: 'cicd:write' } }]
        },
        select: { id: true }
      })
    ])
    if (serverCount !== new Set(body.deploymentHosts).size) return NextResponse.json({ success: false, error: '部分部署主机不存在或已停用' }, { status: 400 })
    if (eligibleApprovers.length !== new Set(body.approvalUsers).size) return NextResponse.json({ success: false, error: '部分审批人员不可用或没有部署审批权限' }, { status: 400 })

    // 修改执行配置后删除旧审批并重新生成，防止“审批 A、执行 B”。
    const updatedDeployment = await prisma.$transaction(async tx => {
      await tx.deploymentApproval.deleteMany({ where: { deploymentId } })
      const deployment = await tx.deployment.update({
        where: { id: deploymentId },
        data: {
          name: body.name, description: body.description, environment: body.environment,
          version: body.version, deployScript: body.deployScript, rollbackScript: body.rollbackScript,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          deploymentHosts: Array.from(new Set(body.deploymentHosts)),
          notificationUsers: Array.from(new Set(body.notificationUsers)),
          approvalUsers: Array.from(new Set(body.approvalUsers)),
          requireApproval: true, status: 'pending', startedAt: null, completedAt: null,
          updatedAt: new Date()
        }
      })
      await tx.deploymentApproval.createMany({ data: Array.from(new Set(body.approvalUsers)).map((approverId, index) => ({ deploymentId, approverId, status: 'pending', level: index + 1, isRequired: true })) })
      await tx.systemLog.create({ data: { level: 'warn', category: 'deployment', message: `更新部署并重置审批：${deployment.name}`, source: 'cicd-api', userId: user.id, details: { deploymentId, environment: deployment.environment, hostCount: body.deploymentHosts.length } } })
      return deployment
    })

    console.log(`✅ 部署任务更新成功: ${updatedDeployment.name}`)

    return NextResponse.json({
      success: true,
      data: {
        deployment: updatedDeployment
      },
      message: '部署任务更新成功'
    })

  } catch (error) {
    console.error('❌ 更新部署任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新部署任务失败'
    }, { status: 500 })
  }
}

// 删除部署任务
export async function DELETE(
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
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有部署任务写入权限' }, { status: 403 })
    }
    const deploymentId = params.id

    console.log(`🗑️ 删除部署任务: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 部署任务属于可信团队共享资产。
    const existingDeployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId
      }
    })

    if (!existingDeployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在或无权限删除'
      }, { status: 404 })
    }

    // 检查部署状态
    if (existingDeployment.status === 'deploying') {
      return NextResponse.json({
        success: false,
        error: '正在部署的任务不能删除'
      }, { status: 400 })
    }

    // 删除部署任务（级联删除相关记录）
    await prisma.deployment.delete({
      where: { id: deploymentId }
    })

    console.log(`✅ 部署任务删除成功: ${existingDeployment.name}`)

    return NextResponse.json({
      success: true,
      message: '部署任务删除成功'
    })

  } catch (error) {
    console.error('❌ 删除部署任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除部署任务失败'
    }, { status: 500 })
  }
}
