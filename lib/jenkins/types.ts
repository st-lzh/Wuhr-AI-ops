// Jenkins API 相关类型定义
// 注意：基础的JenkinsConfig类型已移至 app/types/cicd.ts 统一管理
// 这里只保留Jenkins API特定的类型定义

import { JenkinsConfig } from '../../app/types/cicd'

export interface JenkinsJob {
  name: string
  displayName?: string
  description?: string
  url: string
  buildable: boolean
  color: string // 表示job状态的颜色代码
  lastBuild?: {
    number: number
    url: string
    timestamp: number
    result: string
    duration: number
  }
  nextBuildNumber: number
  inQueue: boolean
  keepDependencies: boolean
  property: any[]
  healthReport?: {
    description: string
    iconClassName: string
    iconUrl: string
    score: number
  }[]
}

export interface JenkinsBuild {
  id: string
  number: number
  url: string
  timestamp: number
  estimatedDuration: number
  duration: number
  result: string // SUCCESS, FAILURE, UNSTABLE, ABORTED, null(running)
  building: boolean
  description?: string
  displayName: string
  fullDisplayName: string
  culprits: any[]
  changeSets: any[]
  artifacts: any[]
  actions: any[]
}

export interface JenkinsJobParameter {
  name: string
  type: string
  description?: string
  defaultParameterValue?: {
    name: string
    value: any
  }
  choices?: string[]
}

export interface JenkinsExecutionRequest {
  jobName: string
  parameters?: Record<string, any>
  token?: string
}

export interface JenkinsExecutionResponse {
  queueId: number
  queueUrl: string
  buildNumber?: number
  buildUrl?: string
}

export interface JenkinsConnectionTest {
  success: boolean
  version?: string
  error?: string
  jobs?: number
  user?: string
}

// API 请求/响应类型
// 注意：CreateJenkinsConfigRequest 和 UpdateJenkinsConfigRequest 已移至 app/types/cicd.ts

export interface JenkinsJobListResponse {
  jobs: JenkinsJob[]
  total: number
}

export interface JenkinsJobExecuteRequest {
  jobs: string[] // job名称数组，支持多选
  parameters?: Record<string, any>
  executionOrder?: number[] // 执行顺序，对应jobs数组的索引
}

export interface JenkinsJobExecuteResponse {
  executions: Array<{
    jobName: string
    queueId: number
    queueUrl: string
    order: number
    status: 'queued' | 'started' | 'success' | 'failed'
    error?: string
  }>
}

// Jenkins 连接配置
export interface JenkinsClientConfig {
  baseUrl: string
  username?: string
  token?: string
  timeout?: number
}

// Jenkins API 错误响应
export interface JenkinsError {
  statusCode: number
  message: string
  details?: any
}
