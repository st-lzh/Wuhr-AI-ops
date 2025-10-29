// 审批管理相关类型定义

export interface Approval {
  id: string
  deploymentId: string
  approverId: string
  status: ApprovalStatus
  comment?: string
  approvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ApprovalWithRelations extends Approval {
  type?: 'deployment' | 'jenkins' | 'user_registration'
  deployment?: {
    id: string
    name: string
    environment: string
    description?: string
    project: {
      id: string
      name: string
    }
    creator: {
      id: string
      username: string
      email: string
    }
  }
  approver?: {
    id: string
    username: string
    email: string
    role: string
  }
  // Jenkins任务审批特有字段
  jenkinsJob?: {
    jobName: string
    operationType: string
    configName: string
    serverUrl: string
  }
  // 用户注册审批特有字段
  registration?: {
    id: string
    username: string
    email: string
    realName?: string
    reason?: string
    status: string
  }
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalAction {
  action: 'approve' | 'reject'
  comment?: string
}

export interface ApprovalListResponse {
  approvals: ApprovalWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApprovalResponse {
  approval: ApprovalWithRelations
}

export interface ApprovalStats {
  totalApprovals: number
  pendingApprovals: number
  approvedToday: number
  rejectedToday: number
  myPendingApprovals: number
  averageApprovalTime: number
  // 新增统计字段
  todayTotal?: number
  weeklyTotal?: number
  monthlyTotal?: number
  myTodayProcessed?: number
  myWeeklyProcessed?: number
  recentApprovals?: Array<{
    id: string
    status: string
    approvedAt: Date | null
    deploymentName: string
    projectName: string
    environment: string
  }>
}

export interface CreateApprovalRequest {
  deploymentId: string
  approvers: string[]
}

// 审批状态选项
export const APPROVAL_STATUS_OPTIONS = [
  { value: 'pending', label: '待审批', color: 'warning' },
  { value: 'approved', label: '已批准', color: 'success' },
  { value: 'rejected', label: '已拒绝', color: 'error' },
] as const

// 获取状态显示信息
export function getApprovalStatusDisplay(status: ApprovalStatus) {
  return APPROVAL_STATUS_OPTIONS.find(option => option.value === status) || APPROVAL_STATUS_OPTIONS[0]
}

// 审批权限检查
export function canUserApprove(
  userRole: string,
  userPermissions: string[],
  deploymentEnvironment: string,
  isProjectOwner: boolean
): boolean {
  // 管理员可以审批所有部署
  if (userRole === 'admin' || userPermissions.includes('*')) {
    return true
  }

  // 项目所有者可以审批自己项目的部署
  if (isProjectOwner) {
    return true
  }

  // Manager可以审批所有环境
  if (userRole === 'manager' && userPermissions.includes('cicd:deploy')) {
    return true
  }

  // Developer只能审批dev和test环境
  if (userRole === 'developer' && 
      userPermissions.includes('cicd:write') && 
      ['dev', 'test'].includes(deploymentEnvironment)) {
    return true
  }

  return false
}

// 获取审批所需角色
export function getRequiredApprovalRoles(environment: string): string[] {
  switch (environment) {
    case 'prod':
      return ['admin', 'manager']
    case 'staging':
      return ['admin', 'manager', 'developer']
    case 'test':
      return ['admin', 'manager', 'developer']
    case 'dev':
      return ['admin', 'manager', 'developer']
    default:
      return ['admin']
  }
}
