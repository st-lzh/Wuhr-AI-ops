import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'permissions:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const limit = Math.min(500, Math.max(20, Number(new URL(request.url).searchParams.get('limit') || 200)))
  const [system, authLogs] = await Promise.all([
    prisma.systemLog.findMany({ orderBy: { timestamp: 'desc' }, take: limit }),
    prisma.authLog.findMany({ orderBy: { timestamp: 'desc' }, take: limit })
  ])
  const entries = [
    ...system.map(item => ({ id: item.id, kind: 'system', level: item.level, category: item.category, action: item.message, actorId: item.userId, source: item.source, details: item.details, timestamp: item.timestamp })),
    ...authLogs.map(item => ({ id: item.id, kind: 'auth', level: item.success ? 'info' : 'warn', category: 'authentication', action: item.action, actorId: item.userId, actorName: item.username || item.email, source: item.ipAddress, details: item.details, timestamp: item.timestamp }))
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
  return NextResponse.json({ success: true, data: entries })
}
