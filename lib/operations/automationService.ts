import { CronExpressionParser } from 'cron-parser'
import { getPrismaClient } from '../config/database'
import { revealSecret } from '../crypto/encryption'
import { executeSSHCommand } from '../ssh/client'
import { Prisma } from '../generated/prisma'

export type AutomationActor = { id: string; username?: string | null; email?: string | null }

const CRITICAL_PATTERNS = [
  /rm\s+-rf\s+\/(?:\s|$)/i,
  /\bmkfs(?:\.|\s)/i,
  /\bdd\s+if=.*\bof=\/dev\//i,
  /\b(drop\s+database|truncate\s+table)\b/i,
  /kubectl\s+delete\s+(namespace|ns)\b/i,
]
const HIGH_PATTERNS = [
  /\b(reboot|shutdown|poweroff|halt)\b/i,
  /iptables\s+-F\b/i,
  /\b(userdel|groupdel)\b/i,
  /systemctl\s+(stop|disable)\s+(ssh|sshd|network)/i,
  /kubectl\s+delete\b/i,
]

export function assessAutomationRisk(command: string): 'low' | 'medium' | 'high' | 'critical' {
  if (CRITICAL_PATTERNS.some(pattern => pattern.test(command))) return 'critical'
  if (HIGH_PATTERNS.some(pattern => pattern.test(command))) return 'high'
  if (/\b(sudo|systemctl|service|docker|kubectl|helm|apt|yum|dnf)\b/i.test(command)) return 'medium'
  return 'low'
}

export function nextCronDate(expression: string, from = new Date()): Date {
  return CronExpressionParser.parse(expression, { currentDate: from, tz: 'Asia/Shanghai' }).next().toDate()
}

function requiresApproval(job: { riskLevel: string; approvalMode: string; approvedVersion: number | null; version: number }) {
  if (job.riskLevel === 'high' || job.riskLevel === 'critical') return true
  if (job.approvalMode === 'every_run') return true
  if (job.approvalMode === 'version') return job.approvedVersion !== job.version
  return false
}

export async function requestAutomationRun(
  jobId: string,
  actor: AutomationActor,
  triggerType: 'manual' | 'scheduled' = 'manual'
) {
  const prisma = await getPrismaClient()
  const job = await prisma.automationJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('作业不存在')
  if (triggerType === 'scheduled' && !job.enabled) throw new Error('作业未启用')

  const approvalRequired = requiresApproval(job)
  const run = await prisma.automationRun.create({
    data: {
      jobId: job.id,
      jobName: job.name,
      triggerType,
      status: approvalRequired ? 'awaiting_approval' : 'pending',
      riskLevel: job.riskLevel,
      commandSnapshot: job.command,
      targetSnapshot: job.targetServerIds as Prisma.InputJsonValue,
      requestedById: actor.id,
      requestedByName: actor.username || actor.email || actor.id,
      summary: approvalRequired ? '等待人工审批后执行' : '已进入执行队列'
    }
  })

  await prisma.systemLog.create({
    data: {
      level: approvalRequired ? 'warn' : 'info',
      category: 'automation_job',
      message: `${triggerType === 'scheduled' ? '定时' : '人工'}触发作业：${job.name}`,
      source: 'automation-service',
      userId: actor.id,
      details: { jobId: job.id, runId: run.id, approvalRequired, riskLevel: job.riskLevel }
    }
  })

  if (!approvalRequired) setImmediate(() => executeAutomationRun(run.id).catch(error => console.error('作业执行异常:', error)))
  return run
}

export async function approveAutomationRun(runId: string, actor: AutomationActor) {
  const prisma = await getPrismaClient()
  const updated = await prisma.automationRun.updateMany({
    where: { id: runId, status: 'awaiting_approval' },
    data: {
      status: 'pending',
      approvedById: actor.id,
      approvedByName: actor.username || actor.email || actor.id,
      approvedAt: new Date(),
      summary: '审批通过，已进入执行队列'
    }
  })
  if (updated.count !== 1) throw new Error('作业不存在、无需审批或已被处理')
  setImmediate(() => executeAutomationRun(runId).catch(error => console.error('审批后作业执行异常:', error)))
  return prisma.automationRun.findUnique({ where: { id: runId } })
}

export async function executeAutomationRun(runId: string) {
  const prisma = await getPrismaClient()
  const claimed = await prisma.automationRun.updateMany({
    where: { id: runId, status: 'pending' },
    data: { status: 'running', startedAt: new Date(), error: null }
  })
  if (claimed.count !== 1) return

  const run = await prisma.automationRun.findUnique({ where: { id: runId } })
  if (!run) return
  const targetIds = Array.isArray(run.targetSnapshot) ? run.targetSnapshot.filter((id): id is string => typeof id === 'string').slice(0, 64) : []
  const servers = await prisma.server.findMany({ where: { id: { in: targetIds }, isActive: true } })
  const results: Array<Record<string, unknown>> = []

  for (let offset = 0; offset < servers.length; offset += 8) {
    const batch = servers.slice(offset, offset + 8)
    results.push(...await Promise.all(batch.map(async server => {
      const started = Date.now()
      if (server.status !== 'online') {
        return { serverId: server.id, serverName: server.name, success: false, error: `主机状态为 ${server.status}`, durationMs: 0 }
      }
      try {
        const result = await executeSSHCommand({
          host: server.ip,
          port: server.port,
          username: server.username,
          password: revealSecret(server.password) || undefined,
          privateKey: server.keyPath || undefined,
          timeout: 60_000
        }, run.commandSnapshot)
        return {
          serverId: server.id,
          serverName: server.name,
          host: server.ip,
          success: result.success,
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: Date.now() - started
        }
      } catch (error) {
        return {
          serverId: server.id,
          serverName: server.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - started
        }
      }
    })))
  }

  const missingIds = targetIds.filter(id => !servers.some(server => server.id === id))
  results.push(...missingIds.map(id => ({ serverId: id, success: false, error: '主机不存在或已停用', durationMs: 0 })))
  const succeeded = results.filter(result => result.success === true).length
  const failed = results.length - succeeded
  const success = results.length > 0 && failed === 0
  const summary = `共执行 ${results.length} 台主机，成功 ${succeeded} 台，失败 ${failed} 台`

  await prisma.$transaction([
    prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: success ? 'success' : 'failed',
        completedAt: new Date(),
        output: results as Prisma.InputJsonValue,
        summary,
        error: success ? null : (results.length ? '部分或全部主机执行失败' : '没有可执行的目标主机')
      }
    }),
    ...(run.jobId ? [prisma.automationJob.update({ where: { id: run.jobId }, data: { lastRunAt: new Date() } })] : []),
    prisma.systemLog.create({
      data: {
        level: success ? 'info' : 'error',
        category: 'automation_job',
        message: `作业执行${success ? '成功' : '失败'}：${run.jobName}`,
        source: 'automation-service',
        userId: run.requestedById,
        details: { jobId: run.jobId, runId: run.id, succeeded, failed }
      }
    })
  ])

  const fingerprint = `automation:${run.jobId || run.id}`
  if (!success) {
    await prisma.operationalIncident.upsert({
      where: { fingerprint },
      create: {
        source: 'automation', fingerprint, title: `自动化作业失败：${run.jobName}`,
        description: summary, severity: run.riskLevel === 'critical' ? 'critical' : 'warning',
        resourceType: 'automation_job', resourceId: run.jobId, metadata: { runId: run.id, results } as Prisma.InputJsonValue
      },
      update: {
        status: 'open', description: summary, lastSeenAt: new Date(), resolvedAt: null,
        occurrences: { increment: 1 }, metadata: { runId: run.id, results } as Prisma.InputJsonValue
      }
    })
  } else {
    await prisma.operationalIncident.updateMany({
      where: { fingerprint, status: { notIn: ['resolved', 'closed'] } },
      data: { status: 'resolved', resolvedAt: new Date(), lastSeenAt: new Date() }
    })
  }
}
