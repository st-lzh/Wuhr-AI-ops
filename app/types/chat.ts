// 统一的聊天相关类型定义
// 整合了之前分散在多个文件中的重复定义
import type { CICDContextSelection } from './cicd-ai'

export interface ChatMessage {
  id: string
  type: 'user' | 'ai' | 'command_rejected' | 'command_approved' // 🔥 添加命令状态类型
  content: string
  timestamp: Date
  status?: 'sending' | 'success' | 'error' | 'rejected'
  metadata?: {
    model?: string
    temperature?: number
    maxTokens?: number
    provider?: string
    tokenUsage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
    executionTime?: number
    executionMode?: 'remote'
    hostId?: string
    hostName?: string
    targetHosts?: Array<{
      id: string
      name: string
      ip: string
    }>
    networkTargets?: Array<{
      id: string
      name: string
      managementIp: string
      type: string
      vendor: string
      platform: string
      readOnly: boolean
    }>
    batchMode?: boolean
    targetCount?: number
    batchLabel?: string
    cicdContext?: CICDContextSelection
    isThinking?: boolean
    approvalRejected?: boolean
    // 🔥 命令批准相关元数据
    command?: string
    reason?: string
    approvalId?: string
    tool?: string
    // 🔥 待批准的命令信息
    pendingApproval?: {
      approvalId: string
      command: string
      tool: string
      hostInfo: {
        ip: string
        port: number
      }
    }
    // 🔥 待批准的命令列表(支持多个待批准命令)
    pendingApprovals?: Array<{
      approvalId: string
      command: string
      tool: string
      hostInfo?: {
        ip: string
        port: number
      }
    }>
    // 🔥 Agent流式执行数据
    agentStreamData?: Array<{
      type: string
      content?: string
      data?: any
      timestamp: number | string // 支持number和string两种格式
      metadata?: any
    }>
  }
}

// 🔥 命令批准请求接口
export interface CommandApprovalRequest {
  approvalId: string
  command: string
  description: string
  tool: string
  timestamp: string
  metadata?: {
    sessionId?: string
    timeout?: number
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  messageCount?: number // 直接添加到主接口中
  metadata?: {
    model?: string
    provider?: string
    messageCount?: number
  }
}

// Redis聊天配置
export interface RedisChatConfig {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
  hostId?: string // 远程主机ID
  enableStreaming?: boolean // 是否启用流式传输
}

// 聊天设置
export interface ChatSettings {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  streamResponse?: boolean
}

// 文件信息接口
export interface FileInfo {
  name: string
  size: number
  type: string
  content?: string
  base64?: string
}

// 导出类型
export type MessageType = 'user' | 'ai'
export type MessageStatus = 'sending' | 'success' | 'error'
export type ExecutionMode = 'remote'
