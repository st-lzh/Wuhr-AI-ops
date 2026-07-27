import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { canWriteTeamAssets } from '../../../../../../lib/auth/teamAccess'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { deploymentExecutionService } from '../../../../../../lib/services/deploymentExecutionService'

const RollbackSchema = z.object({
  targetVersion: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(2).max(500),
  confirmed: z.literal(true)
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    if (!canWriteTeamAssets(auth.user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有回滚部署的权限' }, { status: 403 })
    }
    const parsed = RollbackSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '请填写目标版本、回滚原因并显式确认' }, { status: 400 })
    }
    const prisma = await getPrismaClient()
    const deployment = await prisma.deployment.findUnique({ where: { id: params.id } })
    if (!deployment) return NextResponse.json({ success: false, error: '部署任务不存在' }, { status: 404 })
    if (!['success', 'failed', 'cancelled'].includes(deployment.status)) {
      return NextResponse.json({ success: false, error: `当前状态 ${deployment.status} 不允许回滚` }, { status: 409 })
    }
    if (!deployment.rollbackScript?.trim()) {
      return NextResponse.json({ success: false, error: '未配置真实回滚脚本，已阻止回滚' }, { status: 409 })
    }

    setImmediate(async () => {
      try {
        await deploymentExecutionService.rollbackDeployment(
          params.id, auth.user.id, parsed.data.targetVersion, parsed.data.reason
        )
      } catch (error) {
        console.error('后台回滚执行失败:', error)
      }
    })
    return NextResponse.json({
      success: true,
      data: { deploymentId: params.id, status: 'deploying', targetVersion: parsed.data.targetVersion },
      message: '回滚已开始，真实结果将写入部署日志'
    }, { status: 202 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '启动回滚失败' }, { status: 500 })
  }
}
