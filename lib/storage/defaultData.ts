// 默认数据初始化
import { v4 as uuidv4 } from 'uuid'
import { User, Role, DEFAULT_ROLES } from '../auth/types'
import { hashPassword } from '../auth/password'

// 默认管理员账户
export async function createDefaultAdmin(): Promise<User> {
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!'
  const hashedPassword = await hashPassword(adminPassword)
  
  return {
    id: uuidv4(),
    username: 'admin',
    email: 'admin@wuhr.ai',
    role: 'admin',
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'cicd:all', 'servers:all', 'config:all'
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    // 注意：密码hash需要单独存储，这里不包含在User对象中
    passwordHash: hashedPassword
  } as User & { passwordHash: string }
}

// 创建默认角色数据
export function createDefaultRoles(): Role[] {
  return DEFAULT_ROLES.map(role => ({
    ...role,
    id: uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date()
  })) as (Role & { id: string; createdAt: Date; updatedAt: Date })[]
}

// 初始化系统设置
export interface SystemSettings {
  initialized: boolean
  version: string
  firstSetup: boolean
  maintenanceMode: boolean
  allowRegistration: boolean
  emailVerificationRequired: boolean
  maxLoginAttempts: number
  lockoutDuration: number // 分钟
  sessionTimeout: number // 分钟
  backupSchedule: string // cron表达式
  lastBackup?: Date
}

export function getDefaultSystemSettings(): SystemSettings {
  return {
    initialized: false,
    version: '1.0.0',
    firstSetup: true,
    maintenanceMode: false,
    allowRegistration: true,
    emailVerificationRequired: false,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    sessionTimeout: 60 * 24 * 7, // 7天
    backupSchedule: '0 2 * * *' // 每天凌晨2点
  }
}

// 示例数据生成器（用于开发/测试）
export async function createDemoUsers(): Promise<(User & { passwordHash: string })[]> {
  const demoPassword = 'Demo123!'
  const hashedPassword = await hashPassword(demoPassword)
  
  const users: (User & { passwordHash: string })[] = [
    {
      id: uuidv4(),
      username: 'manager',
      email: 'manager@wuhr.ai',
      role: 'manager',
      permissions: [
        'users:read', 'cicd:read', 'cicd:write', 'cicd:execute',
        'servers:read', 'servers:write', 'config:read', 'config:write'
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      passwordHash: hashedPassword
    },
    {
      id: uuidv4(),
      username: 'developer',
      email: 'developer@wuhr.ai',
      role: 'developer',
      permissions: [
        'users:read', 'cicd:read', 'cicd:execute',
        'servers:read', 'config:read'
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      passwordHash: hashedPassword
    },
    {
      id: uuidv4(),
      username: 'viewer',
      email: 'viewer@wuhr.ai',
      role: 'viewer',
      permissions: [
        'users:read', 'cicd:read', 'servers:read', 'config:read'
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      passwordHash: hashedPassword
    }
  ]
  
  return users
}

// 数据验证器
export function validateUserData(user: Partial<User>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!user.username || user.username.length < 3) {
    errors.push('用户名至少3个字符')
  }
  
  if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    errors.push('邮箱格式无效')
  }
  
  if (!user.role || !['admin', 'manager', 'developer', 'viewer'].includes(user.role)) {
    errors.push('无效的用户角色')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateRoleData(role: Partial<Role>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!role.name || !['admin', 'manager', 'developer', 'viewer'].includes(role.name)) {
    errors.push('无效的角色名称')
  }
  
  if (!role.displayName || role.displayName.length < 2) {
    errors.push('角色显示名至少2个字符')
  }
  
  if (!role.permissions || !Array.isArray(role.permissions)) {
    errors.push('权限配置无效')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// 数据迁移工具
export interface MigrationTask {
  version: string
  description: string
  up: () => Promise<void>
  down: () => Promise<void>
}

export const migrations: MigrationTask[] = [
  {
    version: '1.0.0',
    description: '初始化数据库结构',
    up: async () => {
      // 创建初始数据结构
      console.log('初始化数据库结构...')
    },
    down: async () => {
      // 回滚操作
      console.log('回滚数据库结构...')
    }
  }
] 