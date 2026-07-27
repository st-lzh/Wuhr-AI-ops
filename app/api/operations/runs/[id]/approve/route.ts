import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../../lib/auth/apiHelpers'
import { approveAutomationRun } from '../../../../../../lib/operations/automationService'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'approvals:write')
  if (!auth.success) return auth.response
  try {
    const run = await approveAutomationRun(params.id, auth.user)
    return NextResponse.json({ success: true, data: run })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '审批作业失败' }, { status: 409 })
  }
}
