import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { canWriteTeamAssets } from '../../../../../../lib/auth/teamAccess'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { stopRunningDeployment } from '../../../../../../lib/services/deploymentTriggerService'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    if (!canWriteTeamAssets(auth.user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有停止部署的权限' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    if (body.confirmed !== true) {
      return NextResponse.json({ success: false, state: 'confirmation_required', error: '停止部署需要显式确认' }, { status: 409 })
    }
    const prisma = await getPrismaClient()
    const result = await stopRunningDeployment(params.id, auth.user.id, prisma)
    return NextResponse.json({ success: true, data: result, message: '部署已停止' })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '停止部署失败' }, { status: 400 })
  }
}
