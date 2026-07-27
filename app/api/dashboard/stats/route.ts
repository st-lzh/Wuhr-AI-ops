import { NextRequest } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { successResponse, errorResponse } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { fetchBackendData } from '../../../../lib/improve/backendProxy'
import {
  addTrendEvent,
  calculateRate,
  createTrendBuckets,
  getDashboardSince,
  parseDashboardRange,
  sortByOccurredAt,
} from '../../../../lib/dashboard/metrics'
import RedisChatHistoryManager from '../../../utils/redisChatHistory'
import type { NetworkAlert, NetworkChange, NetworkDevice, InspectionRun } from '../../../types/network'
import type { Outcome, OutcomeStats } from '../../../types/improve'
import type {
  DashboardActivity,
  DashboardAssetCategory,
  DashboardDataSource,
  DashboardPendingItem,
  DashboardServiceHealth,
  DashboardSeverity,
} from '../../../types/dashboard'

export const dynamic = 'force-dynamic'

interface RemoteSource<T> {
  ok: boolean
  data: T
  durationMs: number
  error?: string
}

interface OutcomeListResponse {
  count: number
  outcomes: Outcome[]
}

async function readBackendSource<T>(path: string, fallback: T, actor: string): Promise<RemoteSource<T>> {
  const startedAt = Date.now()
  try {
    return {
      ok: true,
      data: await fetchBackendData<T>(path, { actor, timeoutMs: 12_000 }),
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      data: fallback,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function can(user: any, permission: string): boolean {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : []
  return user?.role === 'admin' || permissions.includes('*') || permissions.includes(permission)
}

function assetCategory(statuses: string[], network = false): DashboardAssetCategory {
  return {
    total: statuses.length,
    online: statuses.filter(status => status === 'online').length,
    offline: statuses.filter(status => status === 'offline').length,
    warning: statuses.filter(status => status === 'warning' || status === 'maintenance').length,
    error: statuses.filter(status => status === 'error').length,
    unknown: network ? statuses.filter(status => status === 'unknown').length : 0,
  }
}

function activitySeverity(status: string): DashboardSeverity {
  if (['failed', 'error', 'critical', 'rejected', 'cancelled'].includes(status)) return 'critical'
  if (['warning', 'unstable', 'rolled_back', 'high'].includes(status)) return 'warning'
  if (['success', 'approved', 'online', 'resolved'].includes(status)) return 'success'
  return 'info'
}

function sourceState(name: string, allowed: boolean, sources: Array<RemoteSource<unknown>>): DashboardDataSource {
  if (!allowed) return { name, status: 'hidden', message: '当前角色无权读取该数据源' }
  const healthy = sources.filter(source => source.ok).length
  if (healthy === sources.length) return { name, status: 'healthy' }
  if (healthy > 0) return { name, status: 'degraded', message: '部分接口暂时不可用' }
  return { name, status: 'unavailable', message: sources.find(source => source.error)?.error || '数据源不可用' }
}

/** 风险优先的运维驾驶舱聚合接口。所有计数来自持久化数据或真实后端，部分来源失败时显式降级。 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const user = authResult.user as any
    const range = parseDashboardRange(new URL(request.url).searchParams.get('range'))
    const now = new Date()
    const since = getDashboardSince(range, now)
    const sinceSeconds = Math.max(1, Math.round((now.getTime() - since.getTime()) / 1000))
    const prisma = await getPrismaClient()
    const actor = String(user.email || user.username || user.id || 'dashboard-readonly')
    const canNetwork = can(user, 'network:read') || can(user, 'network:write')
    const canImprove = can(user, 'improve:read') || can(user, 'improve:write')
    const canCICD = can(user, 'cicd:read') || can(user, 'cicd:write')
    const canOperate = can(user, 'servers:write')
    const canApproveRegistrations = user.role === 'admin' || can(user, 'admin:users')

    const chatSnapshotPromise = loadTeamChatSnapshot(prisma)
    const databasePromise = Promise.all([
      prisma.server.findMany({ select: { id: true, name: true, status: true, updatedAt: true } }),
      prisma.deployment.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        include: { project: { select: { name: true } }, user: { select: { username: true } } },
      }),
      prisma.build.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: { id: true, jenkinsJobName: true, status: true, duration: true, createdAt: true },
      }),
      prisma.serverAlert.findMany({
        where: { OR: [{ isResolved: false }, { createdAt: { gte: since } }] },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        include: { server: { select: { name: true } } },
      }),
      canApproveRegistrations ? prisma.userRegistration.findMany({
        where: { status: 'PENDING' }, orderBy: { submittedAt: 'asc' }, take: 50,
        select: { id: true, username: true, realName: true, submittedAt: true },
      }) : Promise.resolve([]),
      canCICD ? prisma.deploymentApproval.findMany({
        where: { status: 'pending', approverId: user.id }, orderBy: { createdAt: 'asc' }, take: 50,
        include: { deployment: { include: { project: { select: { name: true } }, user: { select: { username: true } } } } },
      }) : Promise.resolve([]),
      canCICD ? prisma.jenkinsJobApproval.findMany({
        where: { status: 'pending', approverId: user.id }, orderBy: { createdAt: 'asc' }, take: 50,
        include: { execution: { include: { config: { select: { name: true } }, requester: { select: { username: true, realName: true } } } } },
      }) : Promise.resolve([]),
      prisma.user.findMany({
        where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, username: true, createdAt: true },
      }),
      prisma.operationalIncident.findMany({
        where: { OR: [{ status: { notIn: ['resolved', 'closed'] } }, { lastSeenAt: { gte: since } }] },
        orderBy: { lastSeenAt: 'desc' }, take: 1000,
      }),
      prisma.automationRun.findMany({
        where: { OR: [{ createdAt: { gte: since } }, ...(canOperate ? [{ status: 'awaiting_approval' }] : [])] },
        orderBy: { createdAt: 'desc' }, take: 1000,
      }),
      prisma.k8sCluster.findMany({ select: { id: true, name: true, status: true, updatedAt: true } }),
    ])

    const hiddenSource = <T,>(fallback: T): Promise<RemoteSource<T>> => Promise.resolve({ ok: false, data: fallback, durationMs: 0 })
    const devicesPromise = canNetwork ? readBackendSource<NetworkDevice[]>('/api/network/devices', [], actor) : hiddenSource<NetworkDevice[]>([])
    const networkAlertsPromise = canNetwork ? readBackendSource<NetworkAlert[]>('/api/network/alerts', [], actor) : hiddenSource<NetworkAlert[]>([])
    const networkChangesPromise = canNetwork ? readBackendSource<NetworkChange[]>('/api/network/changes', [], actor) : hiddenSource<NetworkChange[]>([])
    const inspectionsPromise = canNetwork ? readBackendSource<InspectionRun[]>('/api/network/inspections', [], actor) : hiddenSource<InspectionRun[]>([])
    const outcomeStatsPromise = canImprove
      ? readBackendSource<OutcomeStats>(`/api/v1/improve/outcomes/stats?since_seconds=${sinceSeconds}`, emptyOutcomeStats(sinceSeconds), actor)
      : hiddenSource<OutcomeStats>(emptyOutcomeStats(sinceSeconds))
    const outcomesPromise = canImprove
      ? readBackendSource<OutcomeListResponse>(`/api/v1/improve/outcomes?since_seconds=${sinceSeconds}&limit=1000`, { count: 0, outcomes: [] }, actor)
      : hiddenSource<OutcomeListResponse>({ count: 0, outcomes: [] })
    const backendHealthPromise = readBackendSource<Record<string, unknown>>('/api/health', {}, actor)

    const [
      [servers, deployments, builds, serverAlerts, pendingUsers, pendingDeployments, pendingJenkins, recentUsers, incidents, automationRuns, clusters],
      chatSnapshot,
      devicesSource,
      networkAlertsSource,
      networkChangesSource,
      inspectionsSource,
      outcomeStatsSource,
      outcomesSource,
      backendHealthSource,
    ] = await Promise.all([
      databasePromise,
      chatSnapshotPromise,
      devicesPromise,
      networkAlertsPromise,
      networkChangesPromise,
      inspectionsPromise,
      outcomeStatsPromise,
      outcomesPromise,
      backendHealthPromise,
    ])

    const devices = devicesSource.data
    const networkAlerts = networkAlertsSource.data
    const networkChanges = networkChangesSource.data
    const inspections = inspectionsSource.data
    const outcomeStats = outcomeStatsSource.data
    const outcomes = outcomesSource.data.outcomes || []
    const hostAssets = assetCategory(servers.map(server => server.status))
    const networkAssets = assetCategory(devices.map(device => device.status), true)
    const clusterAssets = assetCategory(clusters.map(cluster => cluster.status), true)
    const totalAssets = hostAssets.total + networkAssets.total + clusterAssets.total
    const healthyAssets = hostAssets.online + networkAssets.online + clusterAssets.online
    const serverCriticalAlerts = serverAlerts.filter(alert => !alert.isResolved && ['error', 'critical'].includes(alert.level)).length
    const networkCriticalAlerts = networkAlerts.filter(alert => !alert.resolved && ['error', 'critical'].includes(alert.level)).length
    const operationalCriticalIncidents = incidents.filter(incident => !['resolved', 'closed'].includes(incident.status) && incident.severity === 'critical').length
    const failedAutomationRuns = automationRuns.filter(run => run.createdAt >= since && run.status === 'failed').length
    const pendingAutomationRuns = canOperate ? automationRuns.filter(run => run.status === 'awaiting_approval') : []

    const failedDeploymentStatuses = new Set(['failed', 'cancelled', 'rolled_back'])
    const failedBuildStatuses = new Set(['failed', 'aborted', 'unstable'])
    const successfulDeployments = deployments.filter(deployment => deployment.status === 'success').length
    const failedDeployments = deployments.filter(deployment => failedDeploymentStatuses.has(deployment.status)).length
    const runningDeployments = deployments.filter(deployment => ['pending', 'approved', 'scheduled', 'deploying'].includes(deployment.status)).length
    const rolledBackDeployments = deployments.filter(deployment => deployment.status === 'rolled_back').length
    const buildFailures = builds.filter(build => failedBuildStatuses.has(build.status)).length
    const inspectionFailures = inspections.filter(run => new Date(run.createdAt) >= since && run.status === 'failed').length
    const completedDurations = deployments.map(deployment => deployment.duration).filter((duration): duration is number => typeof duration === 'number' && duration >= 0)
    const averageDurationMs = completedDurations.length
      ? Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length)
      : 0

    const pendingNetworkChanges = networkChanges.filter(change => change.status === 'pending')
    const highRiskChanges = pendingNetworkChanges.filter(change => ['high', 'critical'].includes(change.riskLevel)).length
    const pendingItems = buildPendingItems(pendingUsers, pendingDeployments, pendingJenkins, pendingNetworkChanges, pendingAutomationRuns)
    const trend = createTrendBuckets(range, now)
    deployments.forEach(deployment => {
      addTrendEvent(trend, deployment.createdAt, 'deployments')
      if (failedDeploymentStatuses.has(deployment.status)) addTrendEvent(trend, deployment.createdAt, 'deploymentFailures')
    })
    outcomes.forEach(outcome => {
      addTrendEvent(trend, outcome.timestamp, 'aiExecutions')
      if (['failure', 'error'].includes(outcome.status)) addTrendEvent(trend, outcome.timestamp, 'aiFailures')
    })
    serverAlerts.forEach(alert => addTrendEvent(trend, alert.createdAt, 'alerts'))
    networkAlerts.forEach(alert => addTrendEvent(trend, alert.createdAt, 'alerts'))
    incidents.forEach(incident => addTrendEvent(trend, incident.firstSeenAt, 'alerts'))

    const recentActivities = buildActivities(
      chatSnapshot.sessions,
      deployments,
      recentUsers,
      serverAlerts,
      networkAlerts,
      networkChanges,
      outcomes,
      automationRuns,
      incidents,
    )
    const warnings: string[] = []
    const remoteSources = [devicesSource, networkAlertsSource, networkChangesSource, inspectionsSource]
    if (canNetwork && remoteSources.some(source => !source.ok)) warnings.push('网络管理数据源部分不可用，相关计数可能不完整')
    if (canImprove && (!outcomeStatsSource.ok || !outcomesSource.ok)) warnings.push('AI 执行数据源不可用，智能运营指标暂时降级')
    if (!chatSnapshot.redisHealthy) warnings.push('Redis 对话数据源不可用，AI 对话次数暂时无法统计')
    if (outcomesSource.ok && outcomesSource.data.count > outcomes.length) warnings.push('AI 趋势仅展示最近 1000 条执行记录，汇总计数仍为完整值')

    const services: DashboardServiceHealth[] = [
      { key: 'console', name: '管理控制台', status: 'healthy', description: '当前请求处理正常' },
      { key: 'database', name: 'PostgreSQL', status: 'healthy', description: '持久化数据库查询正常' },
      {
        key: 'redis', name: 'Redis', status: chatSnapshot.redisHealthy ? 'healthy' : 'unavailable',
        description: chatSnapshot.redisHealthy ? '对话与缓存服务正常' : '对话数据读取失败',
      },
      {
        key: 'backend', name: 'Agent 后端', status: backendHealthSource.ok ? 'healthy' : 'unavailable',
        description: backendHealthSource.ok ? '远端 v1 服务可达' : (backendHealthSource.error || '远端 v1 服务不可达'),
        latencyMs: backendHealthSource.durationMs,
      },
    ]

    return successResponse({
      range,
      generatedAt: now.toISOString(),
      risk: {
        pendingApprovals: pendingItems.length,
        criticalAlerts: serverCriticalAlerts + networkCriticalAlerts + operationalCriticalIncidents,
        unhealthyAssets: totalAssets - healthyAssets,
        failedTasks: failedDeployments + buildFailures + inspectionFailures + failedAutomationRuns,
        highRiskChanges,
        serverCriticalAlerts,
        networkCriticalAlerts,
        operationalCriticalIncidents,
        failedAutomationRuns,
      },
      assets: {
        total: totalAssets,
        healthy: healthyAssets,
        unhealthy: totalAssets - healthyAssets,
        healthRate: calculateRate(healthyAssets, totalAssets),
        hosts: hostAssets,
        networkDevices: networkAssets,
        clusters: clusterAssets,
      },
      delivery: {
        total: deployments.length,
        success: successfulDeployments,
        failed: failedDeployments,
        running: runningDeployments,
        rolledBack: rolledBackDeployments,
        successRate: calculateRate(successfulDeployments, successfulDeployments + failedDeployments),
        averageDurationMs,
        buildFailures,
      },
      ai: {
        available: outcomeStatsSource.ok,
        chatSessions: chatSnapshot.sessions.filter(session => session.createdAt >= since).length,
        executions: outcomeStats.total,
        success: outcomeStats.success,
        failed: outcomeStats.failure + outcomeStats.error,
        skipped: outcomeStats.skipped,
        successRate: calculateRate(outcomeStats.success, outcomeStats.success + outcomeStats.failure + outcomeStats.error),
        averageDurationMs: Math.round(outcomeStats.avg_ms || 0),
        topSkills: outcomeStats.top_skills || [],
      },
      trend,
      pendingItems: pendingItems.slice(0, 8),
      recentActivities,
      services,
      dataSources: {
        database: { name: '业务数据库', status: 'healthy' },
        redis: { name: '对话数据', status: chatSnapshot.redisHealthy ? 'healthy' : 'unavailable', message: chatSnapshot.redisHealthy ? undefined : 'Redis 不可用' },
        network: sourceState('网络管理', canNetwork, remoteSources),
        ai: sourceState('AI 执行', canImprove, [outcomeStatsSource, outcomesSource]),
      },
      warnings: Array.from(new Set(warnings)),
    })
  } catch (error) {
    console.error('获取仪表盘数据失败:', error)
    return errorResponse('获取仪表盘数据失败', undefined, 500)
  }
}

function emptyOutcomeStats(sinceSeconds: number): OutcomeStats {
  return { since_seconds: sinceSeconds, total: 0, success: 0, failure: 0, error: 0, skipped: 0, avg_ms: 0, by_status: {}, top_skills: [] }
}

async function loadTeamChatSnapshot(prisma: Awaited<ReturnType<typeof getPrismaClient>>) {
  try {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, username: true } })
    const manager = RedisChatHistoryManager.getInstance()
    if (!(await manager.healthCheck())) return { sessions: [] as any[], redisHealthy: false }
    const results = await Promise.allSettled(users.map(async user => {
      const sessions = await manager.getSessions(user.id)
      return sessions.map(session => ({ ...session, username: user.username }))
    }))
    return {
      sessions: results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      redisHealthy: true,
    }
  } catch (error) {
    console.error('读取团队 Redis 对话统计失败:', error)
    return { sessions: [] as any[], redisHealthy: false }
  }
}

function buildPendingItems(users: any[], deployments: any[], jenkins: any[], changes: NetworkChange[], automationRuns: any[]): DashboardPendingItem[] {
  const items: DashboardPendingItem[] = [
    ...users.map(user => ({
      id: `registration-${user.id}`, type: 'registration' as const, title: '用户注册审批',
      description: `${user.realName || user.username} 等待加入运维团队`, severity: 'info' as const,
      createdAt: user.submittedAt.toISOString(), href: '/users/info',
    })),
    ...deployments.map(approval => ({
      id: `deployment-${approval.id}`, type: 'deployment' as const, title: '部署任务审批',
      description: `${approval.deployment?.project?.name || approval.deployment?.name || '部署任务'} · ${approval.deployment?.environment || '未指定环境'}`,
      severity: approval.deployment?.environment === 'prod' ? 'warning' as const : 'info' as const,
      createdAt: approval.createdAt.toISOString(), href: '/cicd/approvals',
    })),
    ...jenkins.map(approval => ({
      id: `jenkins-${approval.id}`, type: 'jenkins' as const, title: 'Jenkins 任务审批',
      description: `${approval.execution?.jobName || '任务'} · ${approval.execution?.operationType || '执行'}`,
      severity: 'info' as const, createdAt: approval.createdAt.toISOString(), href: '/cicd/approvals',
    })),
    ...changes.map(change => ({
      id: `network-${change.id}`, type: 'network' as const, title: '网络变更审批',
      description: `${change.title || change.intent} · ${change.targets?.length || 0} 台设备`,
      severity: ['high', 'critical'].includes(change.riskLevel) ? 'critical' as const : change.riskLevel === 'medium' ? 'warning' as const : 'info' as const,
      createdAt: change.createdAt, href: `/network/changes?changeId=${encodeURIComponent(change.id)}`,
    })),
    ...automationRuns.map(run => ({
      id: `automation-${run.id}`, type: 'automation' as const, title: '自动化作业审批',
      description: `${run.jobName} · ${run.riskLevel} 风险`,
      severity: ['high', 'critical'].includes(run.riskLevel) ? 'critical' as const : 'warning' as const,
      createdAt: run.createdAt.toISOString(), href: `/operations/runs?runId=${encodeURIComponent(run.id)}`,
    })),
  ]
  const priority: Record<DashboardSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 }
  return items.sort((a, b) => priority[a.severity] - priority[b.severity] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function buildActivities(
  chats: any[], deployments: any[], users: any[], serverAlerts: any[], networkAlerts: NetworkAlert[],
  networkChanges: NetworkChange[], outcomes: Outcome[], automationRuns: any[], incidents: any[],
): DashboardActivity[] {
  const activities: DashboardActivity[] = [
    ...chats.slice(0, 8).map(session => ({
      id: `chat-${session.id}`, type: 'ai' as const, title: '智能助手对话',
      description: `${session.username} 更新了「${session.title}」`, status: 'success' as const,
      occurredAt: session.updatedAt.toISOString(), href: '/ai/system',
    })),
    ...outcomes.slice(0, 8).map(outcome => ({
      id: `outcome-${outcome.timestamp}-${outcome.skill_name}`, type: 'ai' as const, title: 'AI 技能执行',
      description: `${outcome.actor || 'Agent'} 执行 ${outcome.skill_name}`, status: activitySeverity(outcome.status),
      occurredAt: outcome.timestamp, href: '/improve/outcomes',
    })),
    ...deployments.slice(0, 8).map(deployment => ({
      id: `deployment-${deployment.id}`, type: 'deployment' as const, title: '交付任务',
      description: `${deployment.user?.username || '用户'} · ${deployment.project?.name || deployment.name} · ${deployment.environment}`,
      status: activitySeverity(deployment.status), occurredAt: deployment.updatedAt.toISOString(), href: `/cicd/deployments/${deployment.id}`,
    })),
    ...users.map(user => ({
      id: `user-${user.id}`, type: 'user' as const, title: '团队成员', description: `${user.username} 加入团队`,
      status: 'info' as const, occurredAt: user.createdAt.toISOString(), href: '/users/info',
    })),
    ...serverAlerts.slice(0, 8).map(alert => ({
      id: `server-alert-${alert.id}`, type: 'server_alert' as const, title: '主机告警',
      description: `${alert.server?.name || '主机'} · ${alert.title}`, status: alert.isResolved ? 'success' as const : activitySeverity(alert.level),
      occurredAt: alert.createdAt.toISOString(), href: '/monitor',
    })),
    ...networkAlerts.slice(0, 8).map(alert => ({
      id: `network-alert-${alert.id}`, type: 'network_alert' as const, title: '网络告警',
      description: `${alert.deviceName || '网络设备'} · ${alert.title}`, status: alert.resolved ? 'success' as const : activitySeverity(alert.level),
      occurredAt: alert.createdAt, href: '/network/alerts',
    })),
    ...networkChanges.slice(0, 8).map(change => ({
      id: `network-change-${change.id}`, type: 'network_change' as const, title: '网络变更',
      description: `${change.title || change.intent} · ${change.targets?.length || 0} 台设备`, status: activitySeverity(change.status),
      occurredAt: change.updatedAt || change.createdAt, href: `/network/changes?changeId=${encodeURIComponent(change.id)}`,
    })),
    ...automationRuns.slice(0, 8).map(run => ({
      id: `automation-${run.id}`, type: 'automation' as const, title: '自动化作业',
      description: `${run.jobName} · ${run.summary || run.status}`, status: activitySeverity(run.status),
      occurredAt: run.updatedAt.toISOString(), href: `/operations/runs?runId=${encodeURIComponent(run.id)}`,
    })),
    ...incidents.slice(0, 8).map(incident => ({
      id: `incident-${incident.id}`, type: 'incident' as const, title: '运维事件',
      description: `${incident.source} · ${incident.title}`, status: incident.status === 'resolved' ? 'success' as const : activitySeverity(incident.severity),
      occurredAt: incident.lastSeenAt.toISOString(), href: `/events?incidentId=${encodeURIComponent(incident.id)}`,
    })),
  ]
  return sortByOccurredAt(activities).slice(0, 10)
}
