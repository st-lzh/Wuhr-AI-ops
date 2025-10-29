// 部署管理相关类型定义
// 注意：基础的Deployment类型已移至 app/types/cicd.ts 统一管理
// 这里保留部署管理特定的扩展类型

import { Deployment } from './cicd'

export interface DeploymentWithRelations extends Deployment {
  project: {
    id: string
    name: string
  }
  jenkinsConfig?: {
    id: string
    name: string
    jobUrl: string
  }
  creator: {
    id: string
    username: string
    email: string
  }
  approvals?: Array<{
    id: string
    approverId: string
    status: ApprovalStatus
    comment?: string
    approvedAt?: Date
    approver: {
      id: string
      username: string
    }
  }>
}

export type DeploymentStatus = 'pending' | 'pending_approval' | 'ready' | 'running' | 'success' | 'failed' | 'cancelled'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface CreateDeploymentRequest {
  projectId: string
  jenkinsConfigId?: string
  name: string
  description?: string
  environment: string
  buildParameters?: Record<string, any>
  selectedJobs?: string[]
  executionOrder?: number[]
  requireApproval?: boolean
  approvers?: string[]
}

export interface UpdateDeploymentRequest {
  name?: string
  description?: string
  environment?: string
  status?: DeploymentStatus
}

export interface ExecuteDeploymentRequest {
  buildParameters?: Record<string, any>
  selectedJobs?: string[]
  executionOrder?: number[]
}

export interface DeploymentListResponse {
  deployments: DeploymentWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface DeploymentResponse {
  deployment: DeploymentWithRelations
}

export interface DeploymentStatusResponse {
  deployment: {
    id: string
    status: DeploymentStatus
    startedAt?: Date
    completedAt?: Date
    duration?: number
    buildNumber?: string
  }
  jenkinsStatus?: {
    queueId?: number
    buildNumber?: number
    building?: boolean
    result?: string
  }
}

export interface DeploymentLogsResponse {
  logs: string
  lastUpdate: Date
  isComplete: boolean
}

export interface DeploymentStats {
  totalDeployments: number
  runningDeployments: number
  successRate: number
  averageDuration: number
  deploymentsToday: number
  failedDeployments: number
}

// 部署环境选项
export const DEPLOYMENT_ENVIRONMENTS = [
  { value: 'dev', label: '开发环境', color: 'blue' },
  { value: 'test', label: '测试环境', color: 'orange' },
  { value: 'staging', label: '预发布环境', color: 'purple' },
  { value: 'prod', label: '生产环境', color: 'red' },
] as const

// 部署状态选项
export const DEPLOYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: '等待中', color: 'default' },
  { value: 'pending_approval', label: '待审批', color: 'warning' },
  { value: 'ready', label: '准备就绪', color: 'cyan' },
  { value: 'running', label: '执行中', color: 'processing' },
  { value: 'success', label: '成功', color: 'success' },
  { value: 'failed', label: '失败', color: 'error' },
  { value: 'cancelled', label: '已取消', color: 'warning' },
] as const

// 获取状态显示信息
export function getStatusDisplay(status: DeploymentStatus) {
  return DEPLOYMENT_STATUS_OPTIONS.find(option => option.value === status) || DEPLOYMENT_STATUS_OPTIONS[0]
}

// 获取环境显示信息
export function getEnvironmentDisplay(environment: string) {
  return DEPLOYMENT_ENVIRONMENTS.find(env => env.value === environment) || { value: environment, label: environment, color: 'default' }
}
