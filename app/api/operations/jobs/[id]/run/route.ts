import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../../lib/auth/apiHelpers'
import { requestAutomationRun } from '../../../../../../lib/operations/automationService'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'servers:write')
  if (!auth.success) return auth.response
  try {
    const run = await requestAutomationRun(params.id, auth.user, 'manual')
    return NextResponse.json({ success: true, data: run }, { status: 202 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '触发作业失败' }, { status: 400 })
  }
}
