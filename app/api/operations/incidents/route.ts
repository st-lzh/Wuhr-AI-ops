import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().max(5000).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('warning'),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().max(150).optional()
})

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'monitoring:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const status = new URL(request.url).searchParams.get('status')
  const incidents = await prisma.operationalIncident.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
    take: 500
  })
  return NextResponse.json({ success: true, data: incidents })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'monitoring:write')
  if (!auth.success) return auth.response
  try {
    const data = createSchema.parse(await request.json())
    const prisma = await getPrismaClient()
    const fingerprint = `manual:${crypto.randomUUID()}`
    const incident = await prisma.operationalIncident.create({ data: { source: 'manual', fingerprint, ...data } })
    await prisma.systemLog.create({ data: { level: 'warn', category: 'incident', message: `创建事件：${incident.title}`, source: 'operations-api', userId: auth.user.id, details: { incidentId: incident.id, severity: incident.severity } } })
    return NextResponse.json({ success: true, data: incident }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '创建事件失败' }, { status: 400 })
  }
}
