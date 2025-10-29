// 接入管理统一类型定义
// 包含服务器管理、Git凭证管理、SSH连接等相关类型

// ========================================
// SSH连接相关类型
// ========================================

export interface SSHConnectionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
}

export interface SSHConnectionResult {
  success: boolean
  message: string
  connected: boolean
  systemInfo?: {
    uptime: string
    memory: string
    disk: string
  }
  connectionTime?: number
  error?: string
}

// ========================================
// Git认证相关类型
// ========================================

export type GitPlatform = 'github' | 'gitlab' | 'gitee' | 'bitbucket' | 'other'
export type GitAuthType = 'token' | 'ssh' | 'username_password'

export interface GitCredentialData {
  // GitHub/GitLab Token
  token?: string
  
  // SSH密钥
  privateKey?: string
  publicKey?: string
  passphrase?: string
  
  // 用户名密码
  username?: string
  password?: string
  email?: string
}

export interface GitCredential {
  id: string
  name: string
  platform: GitPlatform
  authType: GitAuthType
  credentials: GitCredentialData
  isDefault: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface GitRepositoryInfo {
  url: string
  type: 'git' | 'svn'
  accessible: boolean
  branches?: string[]
  defaultBranch?: string
  projectType?: string
  packageManager?: string
  hasDockerfile?: boolean
  hasCI?: boolean
  error?: string
}

export interface GitValidationOptions {
  credentials?: GitCredentialData
  platform?: GitPlatform
  authType?: GitAuthType
}

// ========================================
// 服务器管理相关类型
// ========================================

export type ServerStatus = 'online' | 'offline' | 'warning' | 'error'
export type ServerAuthType = 'password' | 'key' | 'local'

export interface ServerInfo {
  id: string
  name: string
  hostname: string
  ip: string
  port: number
  status: ServerStatus
  os: string
  version: string
  location: string
  tags: string[]
  description?: string
  username: string
  password?: string
  keyPath?: string
  authType: ServerAuthType
  isActive: boolean
  isDefault?: boolean // 新增默认主机字段
  datacenter?: string
  lastConnectedAt?: Date | null
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface ServerMetrics {
  id: string
  serverId: string
  timestamp: Date
  cpu: {
    usage: number // 百分比
    cores: number
    loadAverage: [number, number, number] // 1分钟, 5分钟, 15分钟
  }
  memory: {
    total: number // GB
    used: number // GB
    free: number // GB
    usage: number // 百分比
  }
  disk: {
    total: number // GB
    used: number // GB
    free: number // GB
    usage: number // 百分比
  }
  network: {
    inbound: number // MB/s
    outbound: number // MB/s
  }
  uptime: number // 秒
}

export interface ServerAlert {
  id: string
  serverId: string
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'service' | 'custom'
  level: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  threshold?: number
  currentValue?: number
  isResolved: boolean
  createdAt: Date
  resolvedAt?: Date
  userId: string
}

export interface ServerLog {
  id: string
  serverId: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string // 日志来源，如 'system', 'nginx', 'mysql' 等
  message: string
  metadata?: Record<string, any>
  timestamp: Date
}

// ========================================
// 表单和API相关类型
// ========================================

export interface ServerFormData {
  name: string
  hostname: string
  ip: string
  port: number
  username: string
  password?: string
  keyPath?: string
  authType: ServerAuthType
  os?: string
  version?: string
  location?: string
  tags: string[]
  description?: string
}

export interface GitCredentialFormData {
  name: string
  platform: GitPlatform
  authType: GitAuthType
  credentials: GitCredentialData
  isDefault: boolean
}

// ========================================
// 统计和监控相关类型
// ========================================

export interface ServerStats {
  total: number
  online: number
  offline: number
  warning: number
  error: number
  alerts: {
    total: number
    unresolved: number
    critical: number
  }
}

export interface ChartData {
  time: string
  value: number
  category?: string
}

export interface MonitoringData {
  cpu: ChartData[]
  memory: ChartData[]
  disk: ChartData[]
  network: ChartData[]
}

// ========================================
// 配置相关类型
// ========================================

export interface ServerConfig {
  ssh: SSHConnectionConfig
  monitoring: {
    enabled: boolean
    interval: number // 秒
    metrics: string[]
  }
  alerts: {
    enabled: boolean
    rules: AlertRule[]
  }
}

export interface AlertRule {
  id: string
  name: string
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number
  duration: number // 秒
  severity: 'info' | 'warning' | 'error' | 'critical'
  enabled: boolean
}

// ========================================
// API响应类型
// ========================================

export interface ServerListResponse {
  servers: ServerInfo[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface GitCredentialListResponse {
  credentials: GitCredential[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ConnectionTestResponse {
  success: boolean
  message: string
  connected: boolean
  systemInfo?: {
    uptime: string
    memory: string
    disk: string
  }
  connectionTime?: number
  error?: string
}

// ========================================
// 工具函数类型
// ========================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface OperationResult<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
