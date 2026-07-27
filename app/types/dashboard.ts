import type { DashboardRange, DashboardTrendBucket } from '../../lib/dashboard/metrics'

export type DashboardSeverity = 'success' | 'info' | 'warning' | 'critical'
export type DashboardSourceStatus = 'healthy' | 'degraded' | 'unavailable' | 'hidden'

export interface DashboardRiskSummary {
  pendingApprovals: number
  criticalAlerts: number
  unhealthyAssets: number
  failedTasks: number
  highRiskChanges: number
  serverCriticalAlerts: number
  networkCriticalAlerts: number
  operationalCriticalIncidents: number
  failedAutomationRuns: number
}

export interface DashboardAssetCategory {
  total: number
  online: number
  offline: number
  warning: number
  error: number
  unknown: number
}

export interface DashboardAssetHealth {
  total: number
  healthy: number
  unhealthy: number
  healthRate: number
  hosts: DashboardAssetCategory
  networkDevices: DashboardAssetCategory
  clusters: DashboardAssetCategory
}

export interface DashboardDeliveryHealth {
  total: number
  success: number
  failed: number
  running: number
  rolledBack: number
  successRate: number
  averageDurationMs: number
  buildFailures: number
}

export interface DashboardAIHealth {
  available: boolean
  chatSessions: number
  executions: number
  success: number
  failed: number
  skipped: number
  successRate: number
  averageDurationMs: number
  topSkills: Array<{ name: string; count: number }>
}

export interface DashboardPendingItem {
  id: string
  type: 'registration' | 'deployment' | 'jenkins' | 'network' | 'automation'
  title: string
  description: string
  severity: DashboardSeverity
  createdAt: string
  href: string
}

export interface DashboardActivity {
  id: string
  type: 'ai' | 'deployment' | 'user' | 'server_alert' | 'network_alert' | 'network_change' | 'automation' | 'incident'
  title: string
  description: string
  status: DashboardSeverity
  occurredAt: string
  href: string
}

export interface DashboardServiceHealth {
  key: 'console' | 'database' | 'redis' | 'backend'
  name: string
  status: 'healthy' | 'degraded' | 'unavailable'
  description: string
  latencyMs?: number
}

export interface DashboardDataSource {
  name: string
  status: DashboardSourceStatus
  message?: string
}

export interface DashboardData {
  range: DashboardRange
  generatedAt: string
  risk: DashboardRiskSummary
  assets: DashboardAssetHealth
  delivery: DashboardDeliveryHealth
  ai: DashboardAIHealth
  trend: DashboardTrendBucket[]
  pendingItems: DashboardPendingItem[]
  recentActivities: DashboardActivity[]
  services: DashboardServiceHealth[]
  dataSources: Record<'database' | 'redis' | 'network' | 'ai', DashboardDataSource>
  warnings: string[]
}
