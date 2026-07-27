import type { PrismaClient } from '../generated/prisma'
import { createJenkinsClient } from '../jenkins/client'
import { getPrismaClient } from '../config/database'
import { deploymentExecutionService } from './deploymentExecutionService'

export type DeploymentTriggerState =
  | 'started'
  | 'queued'
  | 'awaiting_approval'
  | 'already_running'
  | 'quality_gate_required'
  | 'quality_gate_blocked'

export interface DeploymentTriggerResult {
  success: boolean
  state: DeploymentTriggerState
  deploymentId: string
  status: string
  message: string
  results?: unknown
}

/**
 * 按需同步 Jenkins 队列与构建结果。只有 Jenkins 明确返回终态后才更新为成功或失败。
 */
export async function refreshJenkinsDeploymentStatus(prisma: PrismaClient, deployment: any) {
  if (!deployment?.isJenkinsDeployment || deployment.status !== 'deploying') return deployment
  const storedConfig = deployment.config && typeof deployment.config === 'object'
    ? deployment.config as Record<string, any>
    : {}
  const executions = Array.isArray(storedConfig.jenkinsExecutions) ? storedConfig.jenkinsExecutions : []
  if (executions.length === 0) return deployment

  const config = await prisma.jenkinsConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' }
  })
  if (!config) return deployment
  const client = createJenkinsClient({
    jobUrl: config.serverUrl,
    authToken: config.username && config.apiToken
      ? `${config.username}:${config.apiToken}`
      : config.apiToken || undefined
  })

  const refreshed = await Promise.all(executions.map(async (execution: any) => {
    try {
      let buildNumber = execution.buildNumber
      let buildUrl = execution.buildUrl
      if (!buildNumber && execution.queueId) {
        const queue = await client.getQueueItem(Number(execution.queueId))
        if (queue.cancelled) return { ...execution, status: 'failed', result: 'CANCELLED' }
        buildNumber = queue.executable?.number
        buildUrl = queue.executable?.url
        if (!buildNumber) return { ...execution, status: 'queued' }
      }

      const build = await client.getBuild(execution.jobName, Number(buildNumber))
      if (build.building || !build.result) {
        return { ...execution, status: 'running', buildNumber, buildUrl: build.url || buildUrl }
      }
      const status = build.result === 'SUCCESS' ? 'success' : 'failed'
      const consoleLog = await client.getBuildLog(execution.jobName, Number(buildNumber)).catch(() => '')
      return {
        ...execution,
        status,
        result: build.result,
        buildNumber,
        buildUrl: build.url || buildUrl,
        duration: build.duration,
        log: consoleLog.slice(-12_000)
      }
    } catch (error) {
      return {
        ...execution,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }))

  const terminal = refreshed.every(item => ['success', 'failed'].includes(item.status))
  const success = terminal && refreshed.every(item => item.status === 'success')
  const logs = refreshed.map(item => {
    const header = `[${String(item.status).toUpperCase()}] ${item.jobName}${item.buildNumber ? ` #${item.buildNumber}` : ''}`
    return item.log ? `${header}\n${item.log}` : `${header}${item.error ? `\n${item.error}` : ''}`
  }).join('\n\n')

  const updatedDeployment = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      status: terminal ? (success ? 'success' : 'failed') : 'deploying',
      completedAt: terminal ? new Date() : null,
      duration: terminal && deployment.startedAt ? Date.now() - new Date(deployment.startedAt).getTime() : deployment.duration,
      logs,
      config: { ...storedConfig, jenkinsExecutions: refreshed, lastSyncedAt: new Date().toISOString() },
      updatedAt: new Date()
    },
    include: {
      project: { select: { id: true, name: true } },
      user: { select: { id: true, username: true } }
    }
  })
  if (terminal && success) {
    const { schedulePostDeploymentVerification } = await import('../ai/cicdReports')
    schedulePostDeploymentVerification(deployment.id, deployment.userId)
  }
  return updatedDeployment
}

/**
 * 统一触发已经审批通过的部署。抢占状态成功后才调用外部系统，避免重复点击产生重复发布。
 */
export async function triggerApprovedDeployment(
  deploymentId: string,
  actorId: string,
  existingPrisma?: PrismaClient
): Promise<DeploymentTriggerResult> {
  const prisma = existingPrisma || await getPrismaClient()
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } })

  if (!deployment) throw new Error('部署任务不存在')
  if (deployment.status === 'deploying') {
    return {
      success: true,
      state: 'already_running',
      deploymentId,
      status: deployment.status,
      message: '部署任务已经在执行中'
    }
  }
  if (deployment.status !== 'approved') {
    return {
      success: false,
      state: 'awaiting_approval',
      deploymentId,
      status: deployment.status,
      message: deployment.status === 'pending' ? '部署任务正在等待审批' : `当前状态 ${deployment.status} 不允许执行`
    }
  }

  const deploymentConfig = deployment.config && typeof deployment.config === 'object' && !Array.isArray(deployment.config)
    ? deployment.config as Record<string, unknown>
    : {}
  const qualityGateEnabled = deployment.environment === 'prod' || deploymentConfig.aiQualityGateEnabled === true
  if (qualityGateEnabled) {
    const latestGate = await prisma.cICDAIReport.findFirst({
      where: {
        deploymentId,
        reportType: 'pre_deploy_risk',
        status: 'completed',
        createdAt: { gte: deployment.updatedAt }
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, verdict: true, riskLevel: true, createdAt: true }
    })
    if (!latestGate) {
      return {
        success: false,
        state: 'quality_gate_required',
        deploymentId,
        status: deployment.status,
        message: '该发布启用了 AI 质量门禁，请先生成最新的“发布前风险门禁”报告',
        results: { reportType: 'pre_deploy_risk' }
      }
    }
    if (latestGate.verdict === 'block') {
      return {
        success: false,
        state: 'quality_gate_blocked',
        deploymentId,
        status: deployment.status,
        message: '最新发布前质量门禁判定为阻止，请先修复阻断项并重新生成报告',
        results: latestGate
      }
    }
  }

  const claimed = await prisma.deployment.updateMany({
    where: { id: deploymentId, status: 'approved' },
    data: { status: 'deploying', scheduledAt: null, startedAt: new Date(), completedAt: null, updatedAt: new Date() }
  })
  if (claimed.count !== 1) {
    return {
      success: true,
      state: 'already_running',
      deploymentId,
      status: 'deploying',
      message: '部署任务已被其他请求触发'
    }
  }

  if (deployment.isJenkinsDeployment) {
    return triggerJenkinsDeployment(prisma, deployment, actorId)
  }

  await prisma.systemLog.create({
    data: {
      level: 'info',
      category: 'cicd_deployment',
      message: `部署开始执行：${deployment.name}`,
      source: 'deployment-trigger',
      userId: actorId,
      details: { deploymentId, action: 'start', executionType: 'ssh' }
    }
  })

  setImmediate(async () => {
    try {
      await deploymentExecutionService.triggerDeployment(deploymentId)
    } catch (error) {
      console.error('后台部署执行异常:', error)
    }
  })

  return {
    success: true,
    state: 'started',
    deploymentId,
    status: 'deploying',
    message: '部署已开始执行，结果会持续写入执行记录'
  }
}

/** 停止真实部署：Jenkins 构建/队列调用远端停止接口，SSH 部署关闭活动通道。 */
export async function stopRunningDeployment(
  deploymentId: string,
  actorId: string,
  existingPrisma?: PrismaClient
) {
  const prisma = existingPrisma || await getPrismaClient()
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } })
  if (!deployment) throw new Error('部署任务不存在')
  if (deployment.status !== 'deploying') throw new Error(`当前状态 ${deployment.status} 不是执行中，不能停止`)

  const stopResults: Array<Record<string, string | number | boolean>> = []
  if (deployment.isJenkinsDeployment) {
    const config = await prisma.jenkinsConfig.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } })
    if (!config) throw new Error('没有可用的 Jenkins 配置，无法停止远端构建')
    const client = createJenkinsClient({
      jobUrl: config.serverUrl,
      authToken: config.username && config.apiToken ? `${config.username}:${config.apiToken}` : config.apiToken || undefined
    })
    const stored = deployment.config && typeof deployment.config === 'object'
      ? deployment.config as Record<string, any>
      : {}
    const executions = Array.isArray(stored.jenkinsExecutions) ? stored.jenkinsExecutions : []
    for (const execution of executions) {
      if (execution.buildNumber) {
        await client.stopBuild(execution.jobName, Number(execution.buildNumber))
        stopResults.push({ jobName: execution.jobName, buildNumber: execution.buildNumber, action: 'stop_build' })
      } else if (execution.queueId) {
        await client.cancelQueueItem(Number(execution.queueId))
        stopResults.push({ jobName: execution.jobName, queueId: execution.queueId, action: 'cancel_queue' })
      }
    }
  } else {
    const channelClosed = deploymentExecutionService.cancelDeploymentExecution(deploymentId)
    stopResults.push({ action: 'close_ssh_channels', activeChannelFound: channelClosed })
  }

  const completedAt = new Date()
  await prisma.$transaction([
    prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'cancelled', completedAt,
        duration: deployment.startedAt ? completedAt.getTime() - deployment.startedAt.getTime() : deployment.duration,
        logs: `${deployment.logs || ''}\n⛔ 部署已由用户停止。\n`,
        config: {
          ...(deployment.config && typeof deployment.config === 'object' ? deployment.config : {}),
          cancelledAt: completedAt.toISOString(), cancelledBy: actorId, stopResults
        }
      }
    }),
    prisma.systemLog.create({
      data: {
        level: 'warn', category: 'cicd_deployment', source: 'deployment-stop', userId: actorId,
        message: `部署已停止：${deployment.name}`,
        details: { deploymentId, stopResults }
      }
    })
  ])
  return { deploymentId, status: 'cancelled', stopResults }
}

async function triggerJenkinsDeployment(prisma: PrismaClient, deployment: any, actorId: string): Promise<DeploymentTriggerResult> {
  try {
    const config = await prisma.jenkinsConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    })
    if (!config) throw new Error('没有可用的 Jenkins 配置')

    const jobs = Array.isArray(deployment.jenkinsJobIds)
      ? deployment.jenkinsJobIds.filter((item: unknown): item is string => typeof item === 'string' && item.trim() !== '')
      : []
    if (jobs.length === 0) throw new Error('部署任务没有配置 Jenkins 作业')

    const client = createJenkinsClient({
      jobUrl: config.serverUrl,
      authToken: config.username && config.apiToken
        ? `${config.username}:${config.apiToken}`
        : config.apiToken || undefined
    })
    const storedConfig = deployment.config && typeof deployment.config === 'object'
      ? deployment.config as Record<string, unknown>
      : {}
    const execution = await client.buildJobs({
      jobs,
      parameters: (storedConfig.buildParameters && typeof storedConfig.buildParameters === 'object')
        ? storedConfig.buildParameters as Record<string, unknown>
        : undefined
    })
    const failed = execution.executions.filter(item => item.status === 'failed')
    const logs = execution.executions.map(item =>
      `[${item.status.toUpperCase()}] ${item.jobName}${item.queueId ? ` queueId=${item.queueId}` : ''}${item.error ? ` ${item.error}` : ''}`
    ).join('\n')

    await prisma.$transaction([
      prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: failed.length > 0 ? 'failed' : 'deploying',
          completedAt: failed.length > 0 ? new Date() : null,
          logs,
          jenkinsQueueId: execution.executions[0]?.queueId || null,
          jenkinsQueueUrl: execution.executions[0]?.queueUrl || null,
          config: {
            ...storedConfig,
            jenkinsExecutions: execution.executions,
            queuedAt: new Date().toISOString()
          },
          updatedAt: new Date()
        }
      }),
      prisma.systemLog.create({
        data: {
          level: failed.length > 0 ? 'error' : 'info',
          category: 'cicd_deployment',
          message: failed.length > 0
            ? `Jenkins 部署部分任务入队失败：${deployment.name}`
            : `Jenkins 部署已进入队列：${deployment.name}`,
          source: 'deployment-trigger',
          userId: actorId,
          details: {
            deploymentId: deployment.id,
            action: 'start',
            executionType: 'jenkins',
            executions: execution.executions
          }
        }
      })
    ])

    return {
      success: failed.length === 0,
      state: 'queued',
      deploymentId: deployment.id,
      status: failed.length > 0 ? 'failed' : 'deploying',
      message: failed.length > 0 ? '部分 Jenkins 作业未能进入队列' : 'Jenkins 作业已进入队列，尚未判定构建成功',
      results: execution.executions
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        logs: `Jenkins 触发失败：${errorMessage}`,
        updatedAt: new Date()
      }
    })
    throw error
  }
}
