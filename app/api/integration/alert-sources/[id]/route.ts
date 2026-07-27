import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

export const dynamic = 'force-dynamic'

const schema = z.object({ enabled: z.boolean().optional(), regenerateToken: z.boolean().optional() })

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'monitoring:write')
  if (!auth.success) return auth.response
  try {
    const data = schema.parse(await request.json())
    const token = data.regenerateToken ? randomBytes(32).toString('base64url') : undefined
    const prisma = await getPrismaClient()
    const source = await prisma.alertSource.update({
      where: { id: params.id },
      data: { ...(data.enabled !== undefined ? { enabled: data.enabled } : {}), ...(token ? { tokenHash: createHash('sha256').update(token).digest('hex') } : {}) },
      select: { id: true, name: true, sourceType: true, enabled: true, lastReceivedAt: true, lastError: true, updatedAt: true }
    })
    await prisma.systemLog.create({ data: { level: 'warn', category: 'alert_source', message: token ? `轮换告警源密钥：${source.name}` : `${source.enabled ? '启用' : '停用'}告警源：${source.name}`, source: 'integration-api', userId: auth.user.id, details: { alertSourceId: source.id } } })
    return NextResponse.json({ success: true, data: { ...source, ...(token ? { token } : {}) }, ...(token ? { message: '新密钥只显示本次，请立即复制保存' } : {}) })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '更新告警源失败' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'monitoring:write')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const source = await prisma.alertSource.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
  if (!source) return NextResponse.json({ success: false, error: '告警源不存在' }, { status: 404 })
  await prisma.alertSource.delete({ where: { id: params.id } })
  await prisma.systemLog.create({ data: { level: 'warn', category: 'alert_source', message: `删除告警源：${source.name}`, source: 'integration-api', userId: auth.user.id, details: { alertSourceId: source.id } } })
  return NextResponse.json({ success: true })
}
