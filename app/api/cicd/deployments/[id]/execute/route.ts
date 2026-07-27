import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { triggerApprovedDeployment } from '../../../../../../lib/services/deploymentTriggerService'
import { canWriteTeamAssets } from '../../../../../../lib/auth/teamAccess'

/** 普通部署和 Jenkins 部署共用同一真实触发入口。 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    if (!canWriteTeamAssets(authResult.user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有部署执行权限' }, { status: 403 })
    }

    const prisma = await getPrismaClient()
    const result = await triggerApprovedDeployment(params.id, authResult.user.id, prisma)
    return NextResponse.json({ success: result.success, data: result, message: result.message, error: result.success ? undefined : result.message }, {
      status: result.success ? 200 : result.state === 'awaiting_approval' ? 409 : 400
    })
  } catch (error) {
    console.error('执行部署任务失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '执行部署任务失败'
    }, { status: 500 })
  }
}
