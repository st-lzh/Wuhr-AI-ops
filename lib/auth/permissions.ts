// 权限管理系统
// 定义系统中所有模块的权限粒度

export interface Permission {
  id: string
  name: string
  code: string
  description: string
  category: string
  createdAt: string
  updatedAt: string
}

export interface PermissionCategory {
  name: string
  description: string
  permissions: Permission[]
}

// 权限命名规范：模块名:操作类型
// 操作类型：read（只读）、write（读写）
export const PERMISSION_CODES = {
  // 用户管理
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',

  // 权限管理
  PERMISSIONS_READ: 'permissions:read',
  PERMISSIONS_WRITE: 'permissions:write',

  // 主机管理
  SERVERS_READ: 'servers:read',
  SERVERS_WRITE: 'servers:write',

  // 网络设备管理
  NETWORK_READ: 'network:read',
  NETWORK_WRITE: 'network:write',

  // CI/CD管理
  CICD_READ: 'cicd:read',
  CICD_WRITE: 'cicd:write',

  // 审批管理
  APPROVALS_READ: 'approvals:read',
  APPROVALS_WRITE: 'approvals:write',

  // 通知管理
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_WRITE: 'notifications:write',

  // 配置管理
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',

  // AI助手
  AI_READ: 'ai:read',
  AI_WRITE: 'ai:write',

  // 系统监控
  MONITORING_READ: 'monitoring:read',
  MONITORING_WRITE: 'monitoring:write',

  // Grafana监控
  GRAFANA_READ: 'grafana:read',
  GRAFANA_WRITE: 'grafana:write',

  // AI 资产管理（self-improving lesson loop / outcomes / skills 浏览 / memory）
  // 后端接口走 /api/v1/improve/*；写操作需 backend admin role API key
  IMPROVE_READ: 'improve:read',
  IMPROVE_WRITE: 'improve:write',
} as const

// 权限定义
export const SYSTEM_PERMISSIONS: Permission[] = [
  // 用户管理权限
  {
    id: 'perm_users_read',
    name: '用户查看',
    code: PERMISSION_CODES.USERS_READ,
    description: '查看用户列表、用户信息等，但不能修改',
    category: '用户管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_users_write',
    name: '用户管理',
    code: PERMISSION_CODES.USERS_WRITE,
    description: '创建、编辑、删除用户，修改用户状态等',
    category: '用户管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 权限管理权限
  {
    id: 'perm_permissions_read',
    name: '权限查看',
    code: PERMISSION_CODES.PERMISSIONS_READ,
    description: '查看权限列表、用户权限分配等，但不能修改',
    category: '权限管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_permissions_write',
    name: '权限管理',
    code: PERMISSION_CODES.PERMISSIONS_WRITE,
    description: '分配和撤销用户权限，管理权限配置等',
    category: '权限管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 主机管理权限
  {
    id: 'perm_servers_read',
    name: '主机查看',
    code: PERMISSION_CODES.SERVERS_READ,
    description: '查看服务器列表、服务器状态、监控数据等',
    category: '主机管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_servers_write',
    name: '主机管理',
    code: PERMISSION_CODES.SERVERS_WRITE,
    description: '添加、编辑、删除服务器，执行服务器操作等',
    category: '主机管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 网络设备管理权限
  {
    id: 'perm_network_read',
    name: '网络查看',
    code: PERMISSION_CODES.NETWORK_READ,
    description: '查看网络设备、配置版本、拓扑、巡检、告警和变更记录',
    category: '网络管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_network_write',
    name: '网络管理',
    code: PERMISSION_CODES.NETWORK_WRITE,
    description: '管理设备凭据、创建并审批网络变更、执行巡检和配置操作',
    category: '网络管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // CI/CD管理权限
  {
    id: 'perm_cicd_read',
    name: 'CI/CD查看',
    code: PERMISSION_CODES.CICD_READ,
    description: '查看持续集成项目、持续部署任务、构建历史、部署模板等',
    category: 'CI/CD管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_cicd_write',
    name: 'CI/CD管理',
    code: PERMISSION_CODES.CICD_WRITE,
    description: '创建持续集成项目、执行持续部署任务、管理部署模板等',
    category: 'CI/CD管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 审批管理权限
  {
    id: 'perm_approvals_read',
    name: '审批查看',
    code: PERMISSION_CODES.APPROVALS_READ,
    description: '查看审批任务列表、审批历史等',
    category: '审批管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_approvals_write',
    name: '审批管理',
    code: PERMISSION_CODES.APPROVALS_WRITE,
    description: '处理审批任务、通过或拒绝审批等',
    category: '审批管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 通知管理权限
  {
    id: 'perm_notifications_read',
    name: '通知查看',
    code: PERMISSION_CODES.NOTIFICATIONS_READ,
    description: '查看通知列表、通知历史等',
    category: '通知管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_notifications_write',
    name: '通知管理',
    code: PERMISSION_CODES.NOTIFICATIONS_WRITE,
    description: '发送通知、管理通知配置、删除通知等',
    category: '通知管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 配置管理权限
  {
    id: 'perm_config_read',
    name: '配置查看',
    code: PERMISSION_CODES.CONFIG_READ,
    description: '查看系统配置、API配置等',
    category: '配置管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_config_write',
    name: '配置管理',
    code: PERMISSION_CODES.CONFIG_WRITE,
    description: '修改系统配置、API密钥、模型配置等',
    category: '配置管理',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // AI助手权限
  {
    id: 'perm_ai_read',
    name: 'AI助手查看',
    code: PERMISSION_CODES.AI_READ,
    description: '查看AI对话历史、模型配置等',
    category: 'AI功能',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_ai_write',
    name: 'AI助手使用',
    code: PERMISSION_CODES.AI_WRITE,
    description: '使用AI助手功能、创建对话、管理对话历史等',
    category: 'AI功能',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // 系统监控权限
  {
    id: 'perm_monitoring_read',
    name: '监控查看',
    code: PERMISSION_CODES.MONITORING_READ,
    description: '查看系统监控数据、性能指标等',
    category: '系统监控',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_monitoring_write',
    name: '监控管理',
    code: PERMISSION_CODES.MONITORING_WRITE,
    description: '配置监控规则、管理告警设置等',
    category: '系统监控',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Grafana监控权限
  {
    id: 'perm_grafana_read',
    name: 'Grafana查看',
    code: PERMISSION_CODES.GRAFANA_READ,
    description: '查看Grafana仪表板、监控数据等',
    category: 'Grafana监控',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_grafana_write',
    name: 'Grafana管理',
    code: PERMISSION_CODES.GRAFANA_WRITE,
    description: '配置Grafana服务器、管理仪表板等',
    category: 'Grafana监控',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // AI 资产管理
  {
    id: 'perm_improve_read',
    name: 'AI 资产查看',
    code: PERMISSION_CODES.IMPROVE_READ,
    description: '查看 lesson 库 / 执行历史 / 技能源码 / 记忆条目',
    category: 'AI 资产',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'perm_improve_write',
    name: 'AI 资产管理',
    code: PERMISSION_CODES.IMPROVE_WRITE,
    description: '批准/拒绝 lesson 提案、触发反思、写入记忆、删除 lesson 等写操作',
    category: 'AI 资产',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// 按类别分组的权限
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    name: '用户管理',
    description: '用户账户和基本信息管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '用户管理')
  },
  {
    name: '权限管理',
    description: '系统权限和角色管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '权限管理')
  },
  {
    name: '主机管理',
    description: '服务器和主机资源管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '主机管理')
  },
  {
    name: 'CI/CD管理',
    description: '持续集成、持续部署和模板管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === 'CI/CD管理')
  },
  {
    name: '网络管理',
    description: '路由器、交换机、防火墙等网络设备与变更管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '网络管理')
  },
  {
    name: '审批管理',
    description: '工作流审批和流程管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '审批管理')
  },
  {
    name: '通知管理',
    description: '系统通知和消息管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '通知管理')
  },
  {
    name: '配置管理',
    description: '系统配置和参数管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '配置管理')
  },
  {
    name: 'AI功能',
    description: 'AI助手和智能功能',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === 'AI功能')
  },
  {
    name: '系统监控',
    description: '系统监控和性能管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === '系统监控')
  },
  {
    name: 'Grafana监控',
    description: 'Grafana仪表板和监控数据管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === 'Grafana监控')
  },
  {
    name: 'AI 资产',
    description: 'lesson 库、执行历史、技能源码、记忆管理',
    permissions: SYSTEM_PERMISSIONS.filter(p => p.category === 'AI 资产')
  }
]

// 权限检查工具函数
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  // 检查是否有通配符权限（超级管理员）
  if (userPermissions.includes('*')) {
    return true
  }
  // 精确匹配权限
  return userPermissions.includes(requiredPermission)
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
  // 检查是否有通配符权限（超级管理员）
  if (userPermissions.includes('*')) {
    return true
  }
  return requiredPermissions.some(permission => userPermissions.includes(permission))
}

export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  // 检查是否有通配符权限（超级管理员）
  if (userPermissions.includes('*')) {
    return true
  }
  return requiredPermissions.every(permission => userPermissions.includes(permission))
}

// 获取模块的读写权限
export function getModulePermissions(module: string): { read: string; write: string } {
  return {
    read: `${module}:read`,
    write: `${module}:write`
  }
}

// 预定义角色权限
export const ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSION_CODES), // 管理员拥有所有权限
  manager: [
    PERMISSION_CODES.USERS_READ,
    PERMISSION_CODES.SERVERS_READ,
    PERMISSION_CODES.SERVERS_WRITE,
    PERMISSION_CODES.NETWORK_READ,
    PERMISSION_CODES.NETWORK_WRITE,
    PERMISSION_CODES.CICD_READ,
    PERMISSION_CODES.CICD_WRITE,
    PERMISSION_CODES.APPROVALS_READ,
    PERMISSION_CODES.APPROVALS_WRITE,
    PERMISSION_CODES.NOTIFICATIONS_READ,
    PERMISSION_CODES.CONFIG_READ,
    PERMISSION_CODES.AI_READ,
    PERMISSION_CODES.AI_WRITE,
    PERMISSION_CODES.MONITORING_READ,
    PERMISSION_CODES.MONITORING_WRITE,
    PERMISSION_CODES.GRAFANA_READ,
    PERMISSION_CODES.GRAFANA_WRITE
  ],
  developer: [
    PERMISSION_CODES.USERS_READ,
    PERMISSION_CODES.SERVERS_READ,
    PERMISSION_CODES.SERVERS_WRITE,
    PERMISSION_CODES.NETWORK_READ,
    PERMISSION_CODES.NETWORK_WRITE,
    PERMISSION_CODES.CICD_READ,
    PERMISSION_CODES.CICD_WRITE,
    PERMISSION_CODES.APPROVALS_READ,
    PERMISSION_CODES.NOTIFICATIONS_READ,
    PERMISSION_CODES.NOTIFICATIONS_WRITE,
    PERMISSION_CODES.AI_READ,
    PERMISSION_CODES.AI_WRITE,
    PERMISSION_CODES.MONITORING_READ,
    PERMISSION_CODES.GRAFANA_READ
  ],
  viewer: [
    PERMISSION_CODES.USERS_READ,
    PERMISSION_CODES.SERVERS_READ,
    PERMISSION_CODES.NETWORK_READ,
    PERMISSION_CODES.CICD_READ,
    PERMISSION_CODES.APPROVALS_READ,
    PERMISSION_CODES.NOTIFICATIONS_READ,
    PERMISSION_CODES.CONFIG_READ,
    PERMISSION_CODES.AI_READ,
    PERMISSION_CODES.AI_WRITE,
    PERMISSION_CODES.MONITORING_READ,
    PERMISSION_CODES.GRAFANA_READ
  ]
} as const
