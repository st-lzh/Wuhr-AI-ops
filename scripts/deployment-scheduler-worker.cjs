const { createHmac } = require('crypto')
const { PrismaClient } = require('../lib/generated/prisma')

const prisma = new PrismaClient()
const appUrl = (process.env.SCHEDULER_APP_URL || 'http://app:3000').replace(/\/$/, '')
const secret = (process.env.JWT_SECRET || '').trim()
const intervalMs = Math.max(10_000, Number(process.env.DEPLOYMENT_SCHEDULER_INTERVAL_MS || 30_000))
let checking = false
let timer

if (!secret) {
  console.error('[部署调度] 缺少 JWT_SECRET，Worker 拒绝启动')
  process.exit(1)
}

async function trigger(deploymentId) {
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', secret).update(`${timestamp}:${deploymentId}`).digest('hex')
  const response = await fetch(`${appUrl}/api/internal/scheduler/deployments/${encodeURIComponent(deploymentId)}/trigger`, {
    method: 'POST',
    headers: {
      'x-scheduler-timestamp': timestamp,
      'x-scheduler-signature': signature
    }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok && response.status !== 409) {
    throw new Error(body.error || `HTTP ${response.status}`)
  }
  return body
}

async function triggerJob(jobId) {
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', secret).update(`${timestamp}:${jobId}`).digest('hex')
  const response = await fetch(`${appUrl}/api/internal/scheduler/jobs/${encodeURIComponent(jobId)}/trigger`, {
    method: 'POST',
    headers: { 'x-scheduler-timestamp': timestamp, 'x-scheduler-signature': signature }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok && response.status !== 409) throw new Error(body.error || `HTTP ${response.status}`)
  return body
}

async function checkDueDeployments() {
  if (checking) return
  checking = true
  try {
    const due = await prisma.deployment.findMany({
      where: { status: 'approved', scheduledAt: { lte: new Date() } },
      select: { id: true, name: true },
      orderBy: { scheduledAt: 'asc' },
      take: 50
    })
    for (const deployment of due) {
      try {
        const result = await trigger(deployment.id)
        console.log(`[部署调度] 已处理 ${deployment.name} (${deployment.id})：${result.data?.state || 'unknown'}`)
      } catch (error) {
        console.error(`[部署调度] 触发 ${deployment.name} 失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const jobs = await prisma.automationJob.findMany({
      where: { enabled: true, nextRunAt: { lte: new Date() } },
      select: { id: true, name: true },
      orderBy: { nextRunAt: 'asc' },
      take: 50
    })
    for (const job of jobs) {
      try {
        const result = await triggerJob(job.id)
        console.log(`[作业调度] 已处理 ${job.name} (${job.id})：${result.data?.status || 'claimed'}`)
      } catch (error) {
        console.error(`[作业调度] 触发 ${job.name} 失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    console.error(`[部署调度] 查询到期任务失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    checking = false
  }
}

async function waitForSchema() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await prisma.automationJob.count()
      return
    } catch (error) {
      if (attempt === 30) throw error
      if (attempt === 1) console.log('[部署调度] 等待应用完成数据库迁移...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function shutdown(signal) {
  console.log(`[部署调度] 收到 ${signal}，正在退出`)
  if (timer) clearInterval(timer)
  await prisma.$disconnect()
  process.exit(0)
}

async function main() {
  console.log(`[部署调度] Worker 已启动，检查间隔 ${intervalMs}ms`)
  await waitForSchema()
  await checkDueDeployments()
  timer = setInterval(checkDueDeployments, intervalMs)
}

main().catch(error => {
  console.error(`[部署调度] 启动失败：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
