import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

const schema = z.object({
  action: z.enum(['acknowledge', 'investigate', 'resolve', 'close', 'reopen', 'assign']),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional()
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'monitoring:write')
  if (!auth.success) return auth.response
  try {
    const data = schema.parse(await request.json())
    const prisma = await getPrismaClient()
    const statusMap: Record<string, string> = { acknowledge: 'acknowledged', investigate: 'investigating', resolve: 'resolved', close: 'closed', reopen: 'open' }
    const incident = await prisma.operationalIncident.update({
      where: { id: params.id },
      data: data.action === 'assign'
        ? { assigneeId: data.assigneeId || auth.user.id, assigneeName: data.assigneeName || auth.user.username }
        : {
            status: statusMap[data.action],
            ...(data.action === 'acknowledge' ? { acknowledgedAt: new Date() } : {}),
            ...(data.action === 'resolve' || data.action === 'close' ? { resolvedAt: new Date() } : {}),
            ...(data.action === 'reopen' ? { resolvedAt: null } : {})
          }
    })
    await prisma.systemLog.create({ data: { level: 'info', category: 'incident', message: `事件处理：${incident.title}（${data.action}）`, source: 'operations-api', userId: auth.user.id, details: { incidentId: incident.id, action: data.action } } })
    return NextResponse.json({ success: true, data: incident })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '处理事件失败' }, { status: 400 })
  }
}
