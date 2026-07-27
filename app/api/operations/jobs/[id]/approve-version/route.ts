import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../../lib/config/database'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'approvals:write')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const current = await prisma.automationJob.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ success: false, error: '作业不存在' }, { status: 404 })
  if (['high', 'critical'].includes(current.riskLevel)) {
    return NextResponse.json({ success: false, error: '高风险作业必须每次执行前审批' }, { status: 409 })
  }
  const job = await prisma.automationJob.update({ where: { id: params.id }, data: { approvedVersion: current.version, approvalMode: 'version' } })
  await prisma.systemLog.create({ data: { level: 'warn', category: 'automation_job', message: `批准作业版本：${job.name} v${job.version}`, source: 'operations-api', userId: auth.user.id, details: { jobId: job.id, version: job.version } } })
  return NextResponse.json({ success: true, data: job })
}
