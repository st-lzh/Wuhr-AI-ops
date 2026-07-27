import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../../lib/config/database'

export const dynamic = 'force-dynamic'

type NormalizedAlert = {
  fingerprint: string
  title: string
  description?: string
  severity: string
  status: 'open' | 'resolved'
  externalId?: string
  resourceType?: string
  resourceId?: string
  metadata: Record<string, unknown>
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeSeverity(value: unknown): string {
  const severity = String(value || 'warning').toLowerCase()
  if (['critical', 'high', 'error'].includes(severity)) return 'critical'
  if (['warning', 'warn', 'medium'].includes(severity)) return 'warning'
  return 'info'
}

function normalizeAlertmanager(body: any): NormalizedAlert[] {
  if (!Array.isArray(body?.alerts)) throw new Error('Alertmanager 请求缺少 alerts 数组')
  return body.alerts.slice(0, 100).map((alert: any) => {
    const labels = alert?.labels && typeof alert.labels === 'object' ? alert.labels : {}
    const annotations = alert?.annotations && typeof alert.annotations === 'object' ? alert.annotations : {}
    const stable = alert?.fingerprint || `${labels.alertname || 'alert'}:${labels.instance || labels.pod || labels.job || 'unknown'}`
    return {
      fingerprint: String(stable),
      externalId: alert?.fingerprint ? String(alert.fingerprint) : undefined,
      title: String(annotations.summary || annotations.title || labels.alertname || '外部告警').slice(0, 255),
      description: String(annotations.description || annotations.message || ''),
      severity: normalizeSeverity(labels.severity),
      status: alert?.status === 'resolved' || body.status === 'resolved' ? 'resolved' : 'open',
      resourceType: labels.resource_type || (labels.instance ? 'instance' : labels.pod ? 'pod' : undefined),
      resourceId: labels.instance || labels.pod || labels.job,
      metadata: { labels, annotations, startsAt: alert?.startsAt, endsAt: alert?.endsAt, generatorURL: alert?.generatorURL, receiver: body?.receiver }
    }
  })
}

function normalizeGeneric(body: any): NormalizedAlert[] {
  const alerts = Array.isArray(body) ? body : Array.isArray(body?.alerts) ? body.alerts : [body]
  return alerts.slice(0, 100).map((alert: any) => {
    if (!alert?.title) throw new Error('通用告警请求缺少 title')
    const stable = String(alert.fingerprint || alert.externalId || `${alert.title}:${alert.resourceId || ''}`)
    return {
      fingerprint: stable,
      externalId: alert.externalId ? String(alert.externalId) : undefined,
      title: String(alert.title).slice(0, 255),
      description: alert.description ? String(alert.description) : undefined,
      severity: normalizeSeverity(alert.severity),
      status: ['resolved', 'closed', 'ok'].includes(String(alert.status).toLowerCase()) ? 'resolved' : 'open',
      resourceType: alert.resourceType ? String(alert.resourceType) : undefined,
      resourceId: alert.resourceId ? String(alert.resourceId) : undefined,
      metadata: alert.metadata && typeof alert.metadata === 'object' ? alert.metadata : {}
    }
  })
}

export async function POST(request: NextRequest, { params }: { params: { sourceId: string } }) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ success: false, error: '缺少 Bearer 接入密钥' }, { status: 401 })
  const prisma = await getPrismaClient()
  const source = await prisma.alertSource.findFirst({ where: { id: params.sourceId, tokenHash: hash(token), enabled: true } })
  if (!source) return NextResponse.json({ success: false, error: '告警源不存在、已停用或密钥错误' }, { status: 401 })

  try {
    const body = await request.json()
    const alerts = source.sourceType === 'alertmanager' ? normalizeAlertmanager(body) : normalizeGeneric(body)
    const now = new Date()
    for (const alert of alerts) {
      const fingerprint = `external:${source.id}:${hash(alert.fingerprint)}`
      const existing = await prisma.operationalIncident.findUnique({ where: { fingerprint }, select: { id: true } })
      if (existing) {
        await prisma.operationalIncident.update({
          where: { fingerprint },
          data: {
            title: alert.title, description: alert.description, severity: alert.severity,
            status: alert.status, externalId: alert.externalId, resourceType: alert.resourceType,
            resourceId: alert.resourceId, lastSeenAt: now,
            ...(alert.status === 'resolved' ? { resolvedAt: now } : { resolvedAt: null, occurrences: { increment: 1 } }),
            metadata: { ...alert.metadata, alertSourceId: source.id, alertSourceName: source.name }
          }
        })
      } else {
        await prisma.operationalIncident.create({
          data: {
            source: source.sourceType, fingerprint, externalId: alert.externalId, title: alert.title,
            description: alert.description, severity: alert.severity, status: alert.status,
            resourceType: alert.resourceType, resourceId: alert.resourceId,
            firstSeenAt: now, lastSeenAt: now, resolvedAt: alert.status === 'resolved' ? now : null,
            metadata: { ...alert.metadata, alertSourceId: source.id, alertSourceName: source.name }
          }
        })
      }
    }
    await prisma.alertSource.update({ where: { id: source.id }, data: { lastReceivedAt: now, lastError: null } })
    await prisma.systemLog.create({ data: { level: 'info', category: 'alert_ingest', message: `告警源 ${source.name} 接收 ${alerts.length} 条告警`, source: 'alert-webhook', details: { alertSourceId: source.id, count: alerts.length } } })
    return NextResponse.json({ success: true, accepted: alerts.length })
  } catch (error) {
    const detail = error instanceof Error ? error.message : '告警载荷处理失败'
    await prisma.alertSource.update({ where: { id: source.id }, data: { lastError: detail } })
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}
