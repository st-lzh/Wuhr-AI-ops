import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { assessAutomationRisk, nextCronDate } from '../../../../lib/operations/automationService'

export const dynamic = 'force-dynamic'

const jobSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  command: z.string().trim().min(1).max(20000),
  targetServerIds: z.array(z.string().min(1)).min(1).max(64),
  cronExpression: z.string().trim().max(100).optional().nullable(),
  enabled: z.boolean().default(false),
  approvalMode: z.enum(['none', 'version', 'every_run']).default('every_run')
})

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'servers:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const jobs = await prisma.automationJob.findMany({
    include: { runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' }
  })
  return NextResponse.json({ success: true, data: jobs })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'servers:write')
  if (!auth.success) return auth.response
  try {
    const data = jobSchema.parse(await request.json())
    const prisma = await getPrismaClient()
    const targetServerIds = Array.from(new Set(data.targetServerIds))
    const count = await prisma.server.count({ where: { id: { in: targetServerIds }, isActive: true } })
    if (count !== targetServerIds.length) return NextResponse.json({ success: false, error: '部分目标主机不存在或已停用' }, { status: 400 })

    const riskLevel = assessAutomationRisk(data.command)
    const approvalMode = ['high', 'critical'].includes(riskLevel) ? 'every_run' : data.approvalMode
    let nextRunAt: Date | null = null
    if (data.cronExpression) nextRunAt = nextCronDate(data.cronExpression)
    if (data.enabled && !data.cronExpression) return NextResponse.json({ success: false, error: '启用定时作业前必须设置 Cron 表达式' }, { status: 400 })

    const job = await prisma.automationJob.create({
      data: {
        name: data.name, description: data.description, command: data.command, targetServerIds,
        cronExpression: data.cronExpression, enabled: data.enabled, riskLevel, approvalMode,
        nextRunAt: data.enabled ? nextRunAt : null,
        createdById: auth.user.id, createdByName: auth.user.username || auth.user.email
      }
    })
    await prisma.systemLog.create({
      data: { level: 'info', category: 'automation_job', message: `创建作业：${job.name}`, source: 'operations-api', userId: auth.user.id, details: { jobId: job.id, riskLevel } }
    })
    return NextResponse.json({ success: true, data: job }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '创建作业失败' }, { status: 400 })
  }
}
