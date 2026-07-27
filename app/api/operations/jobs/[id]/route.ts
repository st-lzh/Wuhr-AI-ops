import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { assessAutomationRisk, nextCronDate } from '../../../../../lib/operations/automationService'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  command: z.string().trim().min(1).max(20000).optional(),
  targetServerIds: z.array(z.string().min(1)).min(1).max(64).optional(),
  cronExpression: z.string().trim().max(100).nullable().optional(),
  enabled: z.boolean().optional(),
  approvalMode: z.enum(['none', 'version', 'every_run']).optional()
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'servers:write')
  if (!auth.success) return auth.response
  try {
    const data = updateSchema.parse(await request.json())
    const prisma = await getPrismaClient()
    const current = await prisma.automationJob.findUnique({ where: { id: params.id } })
    if (!current) return NextResponse.json({ success: false, error: '作业不存在' }, { status: 404 })

    const targetServerIds = data.targetServerIds ? Array.from(new Set(data.targetServerIds)) : undefined
    if (targetServerIds) {
      const count = await prisma.server.count({ where: { id: { in: targetServerIds }, isActive: true } })
      if (count !== targetServerIds.length) return NextResponse.json({ success: false, error: '部分目标主机不存在或已停用' }, { status: 400 })
    }

    const commandChanged = data.command !== undefined && data.command !== current.command
    const command = data.command || current.command
    const riskLevel = assessAutomationRisk(command)
    const cronExpression = data.cronExpression !== undefined ? data.cronExpression : current.cronExpression
    const enabled = data.enabled !== undefined ? data.enabled : current.enabled
    if (enabled && !cronExpression) return NextResponse.json({ success: false, error: '启用定时作业前必须设置 Cron 表达式' }, { status: 400 })
    const requestedMode = data.approvalMode || current.approvalMode
    const approvalMode = ['high', 'critical'].includes(riskLevel) ? 'every_run' : requestedMode

    const job = await prisma.automationJob.update({
      where: { id: params.id },
      data: {
        name: data.name, description: data.description, command: data.command, targetServerIds,
        cronExpression: data.cronExpression, enabled, riskLevel, approvalMode,
        nextRunAt: enabled && cronExpression ? nextCronDate(cronExpression) : null,
        ...(commandChanged ? { version: { increment: 1 }, approvedVersion: null } : {})
      }
    })
    await prisma.systemLog.create({
      data: { level: 'info', category: 'automation_job', message: `更新作业：${job.name}`, source: 'operations-api', userId: auth.user.id, details: { jobId: job.id, commandChanged } }
    })
    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '更新作业失败' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'servers:write')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const activeRuns = await prisma.automationRun.count({ where: { jobId: params.id, status: { in: ['running', 'pending', 'awaiting_approval'] } } })
  if (activeRuns) return NextResponse.json({ success: false, error: '作业存在运行中或待审批记录，暂不能删除' }, { status: 409 })
  const job = await prisma.automationJob.delete({ where: { id: params.id } }).catch(() => null)
  if (!job) return NextResponse.json({ success: false, error: '作业不存在' }, { status: 404 })
  await prisma.systemLog.create({ data: { level: 'warn', category: 'automation_job', message: `删除作业：${job.name}`, source: 'operations-api', userId: auth.user.id, details: { jobId: job.id } } })
  return NextResponse.json({ success: true })
}
