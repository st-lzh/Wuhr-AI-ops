import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../../../../lib/config/database'
import { nextCronDate, requestAutomationRun } from '../../../../../../../lib/operations/automationService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verified(request: NextRequest, id: string) {
  const secret = process.env.JWT_SECRET?.trim()
  const timestamp = request.headers.get('x-scheduler-timestamp') || ''
  const signature = request.headers.get('x-scheduler-signature') || ''
  if (!secret || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false
  if (Math.abs(Date.now() - Number(timestamp)) > 60_000) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}:${id}`).digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verified(request, params.id)) return NextResponse.json({ success: false, error: '调度器签名无效' }, { status: 401 })
  const prisma = await getPrismaClient()
  const job = await prisma.automationJob.findUnique({ where: { id: params.id } })
  if (!job || !job.enabled || !job.cronExpression || !job.nextRunAt || job.nextRunAt > new Date()) {
    return NextResponse.json({ success: false, error: '作业未启用或尚未到执行时间' }, { status: 409 })
  }

  const claimed = await prisma.automationJob.updateMany({
    where: { id: job.id, enabled: true, nextRunAt: { lte: new Date() } },
    data: { nextRunAt: nextCronDate(job.cronExpression) }
  })
  if (claimed.count !== 1) return NextResponse.json({ success: false, error: '作业已由其他调度器处理' }, { status: 409 })
  const run = await requestAutomationRun(job.id, { id: job.createdById, username: job.createdByName }, 'scheduled')
  return NextResponse.json({ success: true, data: run }, { status: 202 })
}
