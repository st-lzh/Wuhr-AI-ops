'use client'

import { useCallback } from 'react'
import { useGlobalState } from '../contexts/GlobalStateContext'
import { AuthUser } from '../types/global'
import { PERMISSION_CODES, hasPermission, hasAnyPermission, hasAllPermissions, getModulePermissions } from '../../lib/auth/permissions'

// 角色层级定义
const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  developer: 2,
  viewer: 1,
} as const

// 路径权限映射
const ROLE_PATH_PERMISSIONS = {
  admin: ['/admin', '/config', '/monitor', '/servers', '/tools', '/ai'],
  manager: ['/monitor', '/servers', '/tools', '/ai'],
  developer: ['/tools', '/ai'],
  viewer: ['/monitor', '/ai'],
} as const

// 权限检查Hook
export function usePermissions() {
  const { state } = useGlobalState()
  const { auth } = state

  // 基础权限检查
  const hasPermissionLocal = useCallback((permission: string): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true // 管理员拥有所有权限
    return hasPermission(auth.permissions || [], permission)
  }, [auth.isAuthenticated, auth.user, auth.permissions])

  const hasAnyPermissionLocal = useCallback((permissions: string[]): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true
    return hasAnyPermission(auth.permissions || [], permissions)
  }, [auth.isAuthenticated, auth.user, auth.permissions])

  const hasAllPermissionsLocal = useCallback((permissions: string[]): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true
    return hasAllPermissions(auth.permissions || [], permissions)
  }, [auth.isAuthenticated, auth.user, auth.permissions])

  const hasRole = useCallback((role: AuthUser['role']): boolean => {
    return auth.user?.role === role
  }, [auth.user])

  const canAccess = useCallback((resource: string, action: string): boolean => {
    return hasPermissionLocal(`${resource}:${action}`)
  }, [hasPermissionLocal])

  // 新的模块权限检查方法
  const checkModulePermission = useCallback((module: string, action: 'read' | 'write'): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true

    const modulePermissions = getModulePermissions(module)
    const requiredPermission = action === 'read' ? modulePermissions.read : modulePermissions.write
    return hasPermissionLocal(requiredPermission)
  }, [auth.isAuthenticated, auth.user, hasPermissionLocal])

  // 具体模块权限检查
  const canAccessUsers = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('users', action)
  }, [checkModulePermission])

  const canAccessPermissions = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('permissions', action)
  }, [checkModulePermission])

  const canAccessServers = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('servers', action)
  }, [checkModulePermission])

  const canAccessCICD = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('cicd', action)
  }, [checkModulePermission])

  const canAccessApprovals = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('approvals', action)
  }, [checkModulePermission])

  const canAccessNotifications = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('notifications', action)
  }, [checkModulePermission])

  const canAccessConfig = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('config', action)
  }, [checkModulePermission])

  const canAccessAI = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('ai', action)
  }, [checkModulePermission])

  const canAccessMonitoring = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('monitoring', action)
  }, [checkModulePermission])

  const canAccessGrafana = useCallback((action: 'read' | 'write' = 'read'): boolean => {
    return checkModulePermission('grafana', action)
  }, [checkModulePermission])

  // 检查角色权限（支持层级）
  const checkRole = useCallback((requiredRole: AuthUser['role']): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    
    const userRoleLevel = ROLE_HIERARCHY[auth.user.role as keyof typeof ROLE_HIERARCHY] || 0
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0
    
    return userRoleLevel >= requiredRoleLevel
  }, [auth.isAuthenticated, auth.user])

  // 检查具体权限
  const checkPermission = useCallback((permission: string): boolean => {
    return hasPermissionLocal(permission)
  }, [hasPermissionLocal])

  // 检查资源访问权限
  const checkResourceAccess = useCallback((resourcePath: string): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true
    
    const allowedPaths = ROLE_PATH_PERMISSIONS[auth.user.role as keyof typeof ROLE_PATH_PERMISSIONS] || []
    return allowedPaths.some(path => resourcePath.startsWith(path))
  }, [auth.isAuthenticated, auth.user])

  // 检查是否为当前用户的资源
  const checkOwnership = useCallback((resourceUserId: string): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    return auth.user.id === resourceUserId || auth.user.role === 'admin'
  }, [auth.isAuthenticated, auth.user])

  // 获取用户可访问的路径列表
  const getAccessiblePaths = useCallback((): string[] => {
    if (!auth.isAuthenticated || !auth.user) return []
    return [...(ROLE_PATH_PERMISSIONS[auth.user.role as keyof typeof ROLE_PATH_PERMISSIONS] || [])]
  }, [auth.isAuthenticated, auth.user])

  // 检查是否可以执行特定操作
  const canExecuteAction = useCallback((action: string, context?: any): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    
    switch (action) {
      case 'create_user':
      case 'delete_user':
      case 'modify_permissions':
        return auth.user.role === 'admin'
      
      case 'view_system_logs':
      case 'manage_servers':
        return checkRole('manager')
      
      case 'deploy_code':
      case 'run_scripts':
        return checkRole('developer')
      
      case 'view_monitoring':
      case 'use_ai_chat':
        return checkRole('viewer')
      
      default:
        return hasPermissionLocal(action)
    }
  }, [auth.isAuthenticated, auth.user, checkRole, hasPermissionLocal])

  // 权限验证组合函数
  const verifyAccess = useCallback((
    options: {
      requiredRole?: AuthUser['role']
      requiredPermissions?: string[]
      resourcePath?: string
      resourceUserId?: string
      action?: string
      mode?: 'all' | 'any'
    }
  ): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false

    const {
      requiredRole,
      requiredPermissions = [],
      resourcePath,
      resourceUserId,
      action,
      mode = 'all'
    } = options

    // 检查角色权限
    if (requiredRole && !checkRole(requiredRole)) {
      return false
    }

    // 检查具体权限
    if (requiredPermissions.length > 0) {
      const hasPermissions = mode === 'all'
        ? hasAllPermissionsLocal(requiredPermissions)
        : hasAnyPermissionLocal(requiredPermissions)

      if (!hasPermissions) {
        return false
      }
    }

    // 检查资源访问权限
    if (resourcePath && !checkResourceAccess(resourcePath)) {
      return false
    }

    // 检查资源所有权
    if (resourceUserId && !checkOwnership(resourceUserId)) {
      return false
    }

    // 检查操作权限
    if (action && !canExecuteAction(action)) {
      return false
    }

    return true
  }, [
    auth.isAuthenticated,
    auth.user,
    checkRole,
    hasAllPermissionsLocal,
    hasAnyPermissionLocal,
    checkResourceAccess,
    checkOwnership,
    canExecuteAction
  ])

  // 获取权限摘要信息
  const getPermissionSummary = useCallback(() => {
    if (!auth.isAuthenticated || !auth.user) {
      return {
        role: null,
        roleLevel: 0,
        accessiblePaths: [],
        permissions: [],
        canManageUsers: false,
        canManageServers: false,
        canDeploy: false,
        canViewLogs: false,
      }
    }

    const roleLevel = ROLE_HIERARCHY[auth.user.role as keyof typeof ROLE_HIERARCHY] || 0

    return {
      role: auth.user.role,
      roleLevel,
      accessiblePaths: getAccessiblePaths(),
      permissions: auth.permissions,
      canManageUsers: canExecuteAction('create_user'),
      canManageServers: canExecuteAction('manage_servers'),
      canDeploy: canExecuteAction('deploy_code'),
      canViewLogs: canExecuteAction('view_system_logs'),
    }
  }, [auth.isAuthenticated, auth.user, auth.permissions, getAccessiblePaths, canExecuteAction])

  return {
    // 基础权限检查
    hasPermission: hasPermissionLocal,
    hasAnyPermission: hasAnyPermissionLocal,
    hasAllPermissions: hasAllPermissionsLocal,
    hasRole,
    canAccess,

    // 增强权限检查
    checkRole,
    checkPermission,
    checkResourceAccess,
    checkOwnership,
    canExecuteAction,
    verifyAccess,

    // 模块权限检查
    checkModulePermission,
    canAccessUsers,
    canAccessPermissions,
    canAccessServers,
    canAccessCICD,
    canAccessApprovals,
    canAccessNotifications,
    canAccessConfig,
    canAccessAI,
    canAccessMonitoring,
    canAccessGrafana,

    // 工具方法
    getAccessiblePaths,
    getPermissionSummary,

    // 状态信息
    permissions: auth.permissions,
    role: auth.user?.role,
    roleLevel: auth.user ? ROLE_HIERARCHY[auth.user.role as keyof typeof ROLE_HIERARCHY] || 0 : 0,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
  }
} 