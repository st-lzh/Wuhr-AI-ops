// 认证相关类型定义

export interface AuthTokens {
  accessToken: string      // 访问令牌（2小时有效）
  refreshToken: string     // 刷新令牌（7天有效）
  expiresAt: number       // 访问令牌过期时间戳
  refreshExpiresAt: number // 刷新令牌过期时间戳
}

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  permissions: string[]
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  isActive: boolean
}

export type UserRole = 'admin' | 'manager' | 'developer' | 'viewer'

export interface LoginCredentials {
  identifier: string  // 用户名或邮箱
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
  agreeToTerms: boolean
}

export interface JWTPayload {
  userId: string
  username: string
  email: string
  role: UserRole
  permissions: string[]
  type: 'access' | 'refresh'
  iat: number
  exp: number
  jti?: string  // JWT ID for refresh token
}

export interface AuthConfig {
  jwtSecret: string
  accessTokenExpiry: string   // '2h'
  refreshTokenExpiry: string  // '7d'
  bcryptRounds: number        // 12
}

export interface AuthSession {
  id: string
  userId: string
  refreshTokenId: string
  userAgent?: string
  ipAddress?: string
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
  isActive: boolean
}

// 权限相关类型
export interface Permission {
  resource: string    // 'users', 'cicd', 'servers', 'config'
  actions: string[]   // ['read', 'write', 'delete', 'execute']
}

export interface Role {
  name: UserRole
  displayName: string
  description: string
  permissions: Permission[]
}

// API 响应类型
export interface AuthResponse {
  success: boolean
  user?: User
  tokens?: AuthTokens
  message?: string
  error?: string
}

// 错误类型
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  TOKEN_GENERATION_FAILED: 'TOKEN_GENERATION_FAILED',
} as const

// 默认角色权限配置
export const DEFAULT_ROLES: Role[] = [
  {
    name: 'admin',
    displayName: '超级管理员',
    description: '拥有所有权限的系统管理员',
    permissions: [
      { resource: 'users', actions: ['read', 'write', 'delete'] },
      { resource: 'cicd', actions: ['read', 'write', 'delete', 'execute'] },
      { resource: 'servers', actions: ['read', 'write', 'delete', 'execute'] },
      { resource: 'config', actions: ['read', 'write', 'delete'] },
    ]
  },
  {
    name: 'manager', 
    displayName: '项目经理',
    description: '项目管理和团队协调',
    permissions: [
      { resource: 'users', actions: ['read'] },
      { resource: 'cicd', actions: ['read', 'write', 'execute'] },
      { resource: 'servers', actions: ['read', 'write'] },
      { resource: 'config', actions: ['read', 'write'] },
    ]
  },
  {
    name: 'developer',
    displayName: '开发者',
    description: '开发和部署相关权限',
    permissions: [
      { resource: 'users', actions: ['read'] },
      { resource: 'cicd', actions: ['read', 'execute'] },
      { resource: 'servers', actions: ['read'] },
      { resource: 'config', actions: ['read'] },
    ]
  },
  {
    name: 'viewer',
    displayName: '观察者',
    description: '只读权限用户',
    permissions: [
      { resource: 'users', actions: ['read'] },
      { resource: 'cicd', actions: ['read'] },
      { resource: 'servers', actions: ['read'] },
      { resource: 'config', actions: ['read'] },
    ]
  }
] 