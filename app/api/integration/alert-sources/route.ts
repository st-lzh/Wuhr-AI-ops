import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sourceType: z.enum(['alertmanager', 'generic_webhook']).default('alertmanager')
})

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'monitoring:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const sources = await prisma.alertSource.findMany({
    select: { id: true, name: true, sourceType: true, enabled: true, lastReceivedAt: true, lastError: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ success: true, data: sources })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'monitoring:write')
  if (!auth.success) return auth.response
  try {
    const data = sourceSchema.parse(await request.json())
    const token = randomBytes(32).toString('base64url')
    const prisma = await getPrismaClient()
    const source = await prisma.alertSource.create({ data: { ...data, tokenHash: hashToken(token), createdById: auth.user.id } })
    await prisma.systemLog.create({ data: { level: 'info', category: 'alert_source', message: `创建告警源：${source.name}`, source: 'integration-api', userId: auth.user.id, details: { alertSourceId: source.id, sourceType: source.sourceType } } })
    return NextResponse.json({
      success: true,
      data: { id: source.id, name: source.name, sourceType: source.sourceType, enabled: source.enabled, token },
      message: '接入密钥只显示本次，请立即复制保存'
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '创建告警源失败' }, { status: 400 })
  }
}
