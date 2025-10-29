// 数据访问接口定义
import { User, UserRole, AuthSession, Role } from '../auth/types'

// 基础数据访问接口
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>
  findAll(): Promise<T[]>
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T | null>
  delete(id: string): Promise<boolean>
}

// 用户数据仓库接口
export interface IUserRepository extends IBaseRepository<User> {
  findByUsername(username: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByCredentials(identifier: string): Promise<User | null> // 用户名或邮箱
  updatePassword(id: string, hashedPassword: string): Promise<boolean>
  updateLastLogin(id: string): Promise<boolean>
  findByRole(role: UserRole): Promise<User[]>
  setActive(id: string, isActive: boolean): Promise<boolean>
  count(): Promise<number>
  search(query: string): Promise<User[]>
}

// 角色权限仓库接口
export interface IRoleRepository extends IBaseRepository<Role> {
  findByName(name: UserRole): Promise<Role | null>
  updatePermissions(name: UserRole, permissions: Role['permissions']): Promise<boolean>
  getDefaultRole(): Promise<Role>
}

// 会话管理仓库接口
export interface ISessionRepository extends IBaseRepository<AuthSession> {
  findByUserId(userId: string): Promise<AuthSession[]>
  findByRefreshTokenId(refreshTokenId: string): Promise<AuthSession | null>
  invalidateByUserId(userId: string): Promise<boolean>
  invalidateExpired(): Promise<number>
  updateLastUsed(id: string): Promise<boolean>
  findActiveSessions(userId: string): Promise<AuthSession[]>
}

// 认证日志接口
export interface IAuthLogRepository {
  log(event: AuthLogEvent): Promise<void>
  getLogs(filters: AuthLogFilters): Promise<AuthLogEntry[]>
  clearOldLogs(daysToKeep: number): Promise<number>
}

// 认证日志事件类型
export interface AuthLogEvent {
  userId?: string
  username?: string
  email?: string
  action: 'login' | 'logout' | 'register' | 'password_change' | 'failed_login' | 'token_refresh'
  success: boolean
  ipAddress?: string
  userAgent?: string
  details?: string
  timestamp?: Date
}

// 认证日志条目
export interface AuthLogEntry extends AuthLogEvent {
  id: string
  timestamp: Date
}

// 日志过滤器
export interface AuthLogFilters {
  userId?: string
  action?: AuthLogEvent['action']
  success?: boolean
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

// 数据库事务接口
export interface ITransaction {
  commit(): Promise<void>
  rollback(): Promise<void>
}

// 数据库连接接口
export interface IDatabase {
  users: IUserRepository
  roles: IRoleRepository
  sessions: ISessionRepository
  authLogs: IAuthLogRepository
  
  // 事务支持
  beginTransaction(): Promise<ITransaction>
  
  // 数据库维护
  backup(): Promise<string> // 返回备份文件路径
  restore(backupPath: string): Promise<void>
  initialize(): Promise<void>
  close(): Promise<void>
}

// 存储配置
export interface StorageConfig {
  dataPath: string
  backupPath: string
  maxBackups: number
  autoBackup: boolean
  backupInterval: number // 小时
  enableCompression: boolean
  enableEncryption: boolean
  encryptionKey?: string
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// 查询选项
export interface QueryOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, any>
}

// 批量操作结果
export interface BulkOperationResult {
  success: number
  failed: number
  errors: string[]
}

// 数据验证结果
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  value?: any
}

// 存储提供商接口（为不同存储后端预留）
export interface IStorageProvider {
  type: 'file' | 'postgres' | 'mysql' | 'mongodb'
  connect(config: any): Promise<IDatabase>
  disconnect(): Promise<void>
  healthCheck(): Promise<boolean>
} 