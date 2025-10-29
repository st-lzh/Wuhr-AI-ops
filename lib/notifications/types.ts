// 通知系统类型定义

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export type NotificationChannel = 'system' | 'email' | 'webhook'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  channel: NotificationChannel
  userId?: string
  metadata?: Record<string, any>
  createdAt: Date
  readAt?: Date
  expiredAt?: Date
}

export interface EmailNotification {
  to: string[]
  cc?: string[]
  subject: string
  htmlContent: string
  textContent?: string
  metadata?: Record<string, any>
}

export interface SystemMessage {
  id: string
  type: NotificationType
  title: string
  content: string
  userId: string
  isRead: boolean
  createdAt: Date
  expiredAt?: Date
  actionUrl?: string
  actionText?: string
}

export interface WebhookNotification {
  url: string
  method: 'POST' | 'PUT'
  headers?: Record<string, string>
  body: Record<string, any>
}

// CI/CD 相关通知事件
export type CICDEvent = 
  | 'deployment_started'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'task_scheduled'
  | 'task_executed'
  | 'task_failed'
  | 'project_created'
  | 'jenkins_configured'

export interface CICDNotificationData {
  event: CICDEvent
  resourceType: 'project' | 'deployment' | 'approval' | 'task' | 'jenkins'
  resourceId: string
  resourceName: string
  userId: string
  userName: string
  details?: Record<string, any>
  timestamp: Date
}

// 通知模板
export interface NotificationTemplate {
  event: CICDEvent
  channel: NotificationChannel
  title: string
  messageTemplate: string
  emailSubjectTemplate?: string
  emailContentTemplate?: string
}

// 用户通知偏好
export interface UserNotificationPreference {
  userId: string
  enableEmail: boolean
  enableSystem: boolean
  enableWebhook: boolean
  webhookUrl?: string
  emailAddress?: string
  events: {
    [K in CICDEvent]?: {
      email: boolean
      system: boolean
      webhook: boolean
    }
  }
}

// 通知发送结果
export interface NotificationResult {
  success: boolean
  channel: NotificationChannel
  messageId?: string
  error?: string
  sentAt: Date
}
