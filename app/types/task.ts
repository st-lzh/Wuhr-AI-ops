// 定时任务相关类型定义

export interface Task {
  id: string
  name: string
  description?: string
  type: TaskType
  cronExpression: string
  deploymentId: string
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lastRun?: Date
  lastSuccessAt?: Date
  lastError?: string
  executionCount: number
  failureCount: number
}

export interface TaskWithRelations extends Task {
  deployment: {
    id: string
    name: string
    environment: string
    project: {
      id: string
      name: string
    }
  }
  creator: {
    id: string
    username: string
    email: string
  }
}

export type TaskType = 'scheduled_deployment' | 'monitoring' | 'cleanup'

export type TaskStatus = 'active' | 'inactive' | 'running' | 'error'

export interface CreateTaskRequest {
  name: string
  description?: string
  type: TaskType
  cronExpression: string
  deploymentId: string
  isActive?: boolean
}

export interface UpdateTaskRequest {
  name?: string
  description?: string
  cronExpression?: string
  isActive?: boolean
}

export interface TaskListResponse {
  tasks: TaskWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface TaskResponse {
  task: TaskWithRelations
}

export interface TaskExecutionResponse {
  success: boolean
  message: string
  executionId?: string
  result?: any
}

export interface TaskStats {
  totalTasks: number
  activeTasks: number
  recentExecutions: number
  successRate: number
  averageExecutionTime: number
}

export interface CronValidationResult {
  isValid: boolean
  description?: string
  nextRuns?: Date[]
  error?: string
}

// 任务类型选项
export const TASK_TYPE_OPTIONS = [
  { value: 'scheduled_deployment', label: '定时部署', color: 'blue' },
  { value: 'monitoring', label: '监控任务', color: 'green' },
  { value: 'cleanup', label: '清理任务', color: 'orange' },
] as const

// 常用的Cron表达式模板
export const CRON_TEMPLATES = [
  { label: '每分钟', value: '* * * * *', description: '每分钟执行一次' },
  { label: '每小时', value: '0 * * * *', description: '每小时的第0分钟执行' },
  { label: '每天凌晨', value: '0 0 * * *', description: '每天凌晨00:00执行' },
  { label: '每天早上9点', value: '0 9 * * *', description: '每天早上09:00执行' },
  { label: '每周一早上9点', value: '0 9 * * 1', description: '每周一早上09:00执行' },
  { label: '每月1号凌晨', value: '0 0 1 * *', description: '每月1号凌晨00:00执行' },
  { label: '工作日早上9点', value: '0 9 * * 1-5', description: '工作日(周一到周五)早上09:00执行' },
  { label: '每15分钟', value: '*/15 * * * *', description: '每15分钟执行一次' },
  { label: '每30分钟', value: '*/30 * * * *', description: '每30分钟执行一次' },
  { label: '每2小时', value: '0 */2 * * *', description: '每2小时执行一次' }
] as const

// 获取任务类型显示信息
export function getTaskTypeDisplay(type: TaskType) {
  return TASK_TYPE_OPTIONS.find(option => option.value === type) || TASK_TYPE_OPTIONS[0]
}

// 验证Cron表达式
export function validateCronExpression(expression: string): CronValidationResult {
  try {
    // 基本格式验证 - 5个字段的Cron表达式
    const parts = expression.trim().split(/\s+/)
    if (parts.length !== 5) {
      return {
        isValid: false,
        error: 'Cron表达式必须包含5个字段: 分钟 小时 日期 月份 星期'
      }
    }

    // 各字段范围验证
    const [minute, hour, day, month, week] = parts
    
    // 简化的验证逻辑
    if (!isValidCronField(minute, 0, 59) ||
        !isValidCronField(hour, 0, 23) ||
        !isValidCronField(day, 1, 31) ||
        !isValidCronField(month, 1, 12) ||
        !isValidCronField(week, 0, 7)) {
      return {
        isValid: false,
        error: '字段值超出有效范围'
      }
    }

    // 生成描述和下次运行时间
    const description = getCronDescription(expression)
    const nextRuns = getNextRunTimes(expression, 3)

    return {
      isValid: true,
      description,
      nextRuns
    }

  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : '表达式格式错误'
    }
  }
}

// 验证Cron字段
function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true
  
  // 处理范围 (e.g., 1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number)
    return start >= min && end <= max && start <= end
  }
  
  // 处理步长 (e.g., */5)
  if (field.includes('/')) {
    const [range, step] = field.split('/')
    const stepNum = Number(step)
    if (range === '*') return stepNum > 0 && stepNum <= max
    
    const rangeNum = Number(range)
    return rangeNum >= min && rangeNum <= max && stepNum > 0
  }
  
  // 处理列表 (e.g., 1,3,5)
  if (field.includes(',')) {
    return field.split(',').every(part => {
      const num = Number(part.trim())
      return num >= min && num <= max
    })
  }
  
  // 单个数字
  const num = Number(field)
  return !isNaN(num) && num >= min && num <= max
}

// 获取Cron表达式描述
function getCronDescription(expression: string): string {
  try {
    // 这里可以集成cronstrue库来生成更好的描述
    return `定时表达式: ${expression}`
  } catch (error) {
    return `定时表达式: ${expression}`
  }
}

// 获取下次运行时间
function getNextRunTimes(expression: string, count: number): Date[] {
  // 简化实现，实际项目中需要更精确的计算
  const now = new Date()
  const times: Date[] = []
  
  for (let i = 1; i <= count; i++) {
    const nextTime = new Date(now.getTime() + i * 60000) // 简单示例：每分钟
    times.push(nextTime)
  }
  
  return times
}

// 计算任务执行成功率
export function calculateSuccessRate(task: Task): number {
  if (task.executionCount === 0) return 0
  const successCount = task.executionCount - task.failureCount
  return Math.round((successCount / task.executionCount) * 100)
}

// 获取任务状态
export function getTaskStatus(task: Task): TaskStatus {
  if (!task.isActive) return 'inactive'
  if (task.lastError) return 'error'
  if (task.lastRun && task.lastSuccessAt && task.lastRun > task.lastSuccessAt) return 'error'
  return 'active'
}

// 格式化执行统计
export function formatExecutionStats(task: Task) {
  const successRate = calculateSuccessRate(task)
  const status = getTaskStatus(task)
  
  return {
    executionCount: task.executionCount,
    failureCount: task.failureCount,
    successCount: task.executionCount - task.failureCount,
    successRate,
    status,
    lastRun: task.lastRun,
    lastSuccess: task.lastSuccessAt,
    lastError: task.lastError
  }
}
