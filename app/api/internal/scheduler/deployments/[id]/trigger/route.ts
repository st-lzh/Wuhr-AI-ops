import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../../../../lib/config/database'
import { triggerApprovedDeployment } from '../../../../../../../lib/services/deploymentTriggerService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifySchedulerSignature(request: NextRequest, deploymentId: string): boolean {
  const secret = process.env.JWT_SECRET?.trim()
  const timestamp = request.headers.get('x-scheduler-timestamp') || ''
  const signature = request.headers.get('x-scheduler-signature') || ''
  if (!secret || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false

  const age = Math.abs(Date.now() - Number(timestamp))
  if (!Number.isFinite(age) || age > 60_000) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}:${deploymentId}`).digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

/** 仅供 Docker 内部调度 Worker 调用；HMAC 防止公网伪造触发发布。 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifySchedulerSignature(request, params.id)) {
    return NextResponse.json({ success: false, error: '调度器签名无效' }, { status: 401 })
  }

  const prisma = await getPrismaClient()
  const deployment = await prisma.deployment.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, scheduledAt: true, status: true }
  })
  if (!deployment) return NextResponse.json({ success: false, error: '部署任务不存在' }, { status: 404 })
  if (!deployment.scheduledAt || deployment.scheduledAt.getTime() > Date.now()) {
    return NextResponse.json({ success: false, error: '部署任务尚未到计划时间' }, { status: 409 })
  }

  const result = await triggerApprovedDeployment(deployment.id, deployment.userId, prisma)
  return NextResponse.json({ success: result.success, data: result }, { status: result.success ? 200 : 409 })
}
