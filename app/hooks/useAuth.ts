'use client'

import { useCallback } from 'react'
import { useGlobalState } from '../contexts/GlobalStateContext'
import { AuthUser } from '../types/global'
import { LoginRequest, RegisterRequest, UpdateProfileRequest } from '../types/api'

// API调用工具函数 - 直接使用完整的endpoint
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    credentials: 'include', // 默认使用cookie认证
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || '请求失败')
  }

  return data.data as T
}

// 获取Authorization头
function getAuthHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 认证Hook
export function useAuth() {
  const { state, dispatch } = useGlobalState()
  const { auth } = state

  // 登录
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      dispatch({ type: 'AUTH_LOGIN_START' })

      const response = await apiCall<{
        user: AuthUser
        tokens: {
          accessToken: string
          expiresIn: number
        }
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })

      // 清除退出标记
      sessionStorage.removeItem('user_logged_out')

      dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: {
          user: response.user,
          accessToken: response.tokens.accessToken,
          expiresIn: response.tokens.expiresIn,
        },
      })

      console.log('✅ 登录成功:', response.user.username)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      dispatch({ type: 'AUTH_LOGIN_FAILURE', payload: errorMessage })
      throw error
    }
  }, [dispatch])

  // 注册
  const register = useCallback(async (userData: RegisterRequest) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true })

      await apiCall<{
        user: {
          id: string
          username: string
          email: string
          role: string
        }
        message: string
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      })

      dispatch({ type: 'AUTH_SET_LOADING', payload: false })
      console.log('✅ 注册成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '注册失败'
      dispatch({ type: 'AUTH_SET_ERROR', payload: errorMessage })
      throw error
    }
  }, [dispatch])

  // 登出
  const logout = useCallback(async () => {
    try {
      if (auth.accessToken) {
        await apiCall('/api/auth/logout', {
          method: 'POST',
          headers: getAuthHeaders(auth.accessToken),
        })
      }
    } catch (error) {
      console.warn('登出API调用失败:', error)
    } finally {

      
      dispatch({ type: 'AUTH_LOGOUT' })
      console.log('✅ 已登出')
    }
  }, [auth.accessToken, dispatch])



  // 更新用户资料
  const updateProfile = useCallback(async (data: UpdateProfileRequest) => {
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true })

      const response = await apiCall<AuthUser>('/api/auth/profile', {
        method: 'PUT',
        headers: getAuthHeaders(auth.accessToken),
        body: JSON.stringify(data),
      })

      dispatch({
        type: 'AUTH_UPDATE_USER',
        payload: response,
      })

      dispatch({ type: 'AUTH_SET_LOADING', payload: false })
      console.log('✅ 用户资料更新成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新失败'
      dispatch({ type: 'AUTH_SET_ERROR', payload: errorMessage })
      throw error
    }
  }, [auth.accessToken, dispatch])

  // 验证当前session
  const verifySession = useCallback(async () => {
    try {
      if (!auth.accessToken) {
        return false
      }

      const response = await apiCall<{
        valid: boolean
        user?: AuthUser
      }>('/api/auth/verify', {
        method: 'GET',
        headers: getAuthHeaders(auth.accessToken),
      })

      if (response.valid && response.user) {
        dispatch({
          type: 'AUTH_UPDATE_USER',
          payload: response.user,
        })
        return true
      } else {
        dispatch({ type: 'AUTH_SESSION_EXPIRED' })
        return false
      }
    } catch (error) {
      console.warn('Session验证失败:', error)
      dispatch({ type: 'AUTH_SESSION_EXPIRED' })
      return false
    }
  }, [auth.accessToken, dispatch])

  // 获取用户资料
  const getUserProfile = useCallback(async () => {
    try {
      const response = await apiCall<AuthUser>('/api/auth/profile', {
        method: 'GET',
        credentials: 'include', // 使用cookie认证
      })

      dispatch({
        type: 'AUTH_UPDATE_USER',
        payload: response,
      })

      return response
    } catch (error) {
      console.error('获取用户资料失败:', error)
      throw error
    }
  }, [auth.accessToken, dispatch])

  // 清除错误
  const clearError = useCallback(() => {
    dispatch({ type: 'AUTH_SET_ERROR', payload: null })
  }, [dispatch])

  // 权限检查函数
  const hasPermission = useCallback((permission: string): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true // 管理员拥有所有权限
    return auth.permissions.includes(permission)
  }, [auth.isAuthenticated, auth.user, auth.permissions])

  const canAccessAI = useCallback((action: 'read' | 'write') => {
    return hasPermission(`ai:${action}`)
  }, [hasPermission])

  const canAccessServers = useCallback((action: 'read' | 'write') => {
    return hasPermission(`servers:${action}`)
  }, [hasPermission])

  const canAccessCICD = useCallback((action: 'read' | 'write') => {
    return hasPermission(`cicd:${action}`)
  }, [hasPermission])

  const canAccessApprovals = useCallback((action: 'read' | 'write') => {
    return hasPermission(`approvals:${action}`)
  }, [hasPermission])

  const canAccessMonitoring = useCallback((action: 'read' | 'write') => {
    return hasPermission(`monitoring:${action}`)
  }, [hasPermission])

  const canAccessGrafana = useCallback((action: 'read' | 'write') => {
    return hasPermission(`grafana:${action}`)
  }, [hasPermission])

  const canAccessNotifications = useCallback((action: 'read' | 'write') => {
    return hasPermission(`notifications:${action}`)
  }, [hasPermission])

  const canAccessUsers = useCallback((action: 'read' | 'write') => {
    return hasPermission(`users:${action}`)
  }, [hasPermission])

  const canAccessPermissions = useCallback((action: 'read' | 'write') => {
    return hasPermission(`permissions:${action}`)
  }, [hasPermission])

  const canAccessConfig = useCallback((action: 'read' | 'write') => {
    return hasPermission(`config:${action}`)
  }, [hasPermission])

  return {
    // 状态
    ...auth,
    
    // 便捷属性
    isAdmin: auth.user?.role === 'admin',
    isManager: auth.user?.role === 'manager',
    isDeveloper: auth.user?.role === 'developer',
    isViewer: auth.user?.role === 'viewer',
    
    // 操作方法
    login,
    register,
    logout,
    updateProfile,
    verifySession,
    getUserProfile,
    clearError,

    // 权限检查方法
    hasPermission,
    canAccessAI,
    canAccessServers,
    canAccessCICD,
    canAccessApprovals,
    canAccessMonitoring,
    canAccessGrafana,
    canAccessNotifications,
    canAccessUsers,
    canAccessPermissions,
    canAccessConfig,
  }
}

// 权限检查Hook
export function usePermissions() {
  const { state } = useGlobalState()
  const { auth } = state

  // 角色层级定义
  const roleHierarchy = {
    admin: 4,
    manager: 3,
    developer: 2,
    viewer: 1,
  }

  // 路径权限映射
  const rolePathPermissions = {
    admin: ['/admin', '/config', '/monitor', '/servers', '/tools', '/ai', '/cicd'],
    manager: ['/monitor', '/servers', '/tools', '/ai', '/cicd'],
    developer: ['/tools', '/ai', '/cicd'],
    viewer: ['/monitor', '/ai'],
  }

  const hasPermission = useCallback((permission: string): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true // 管理员拥有所有权限
    return auth.permissions.includes(permission)
  }, [auth.isAuthenticated, auth.user, auth.permissions])

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }, [hasPermission])

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission))
  }, [hasPermission])

  const hasRole = useCallback((role: AuthUser['role']): boolean => {
    return auth.user?.role === role
  }, [auth.user])

  const canAccess = useCallback((resource: string, action: string): boolean => {
    return hasPermission(`${resource}:${action}`)
  }, [hasPermission])

  // 检查角色权限（支持层级）
  const checkRole = useCallback((requiredRole: AuthUser['role']): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    
    const userRoleLevel = roleHierarchy[auth.user.role as keyof typeof roleHierarchy] || 0
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0
    
    return userRoleLevel >= requiredRoleLevel
  }, [auth.isAuthenticated, auth.user])

  // 检查具体权限
  const checkPermission = useCallback((permission: string): boolean => {
    return hasPermission(permission)
  }, [hasPermission])

  // 检查资源访问权限
  const checkResourceAccess = useCallback((resourcePath: string): boolean => {
    if (!auth.isAuthenticated || !auth.user) return false
    if (auth.user.role === 'admin') return true
    
    const allowedPaths = rolePathPermissions[auth.user.role as keyof typeof rolePathPermissions] || []
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
    return rolePathPermissions[auth.user.role as keyof typeof rolePathPermissions] || []
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
        return hasPermission(action)
    }
  }, [auth.isAuthenticated, auth.user, checkRole, hasPermission])

  // 具体权限检查函数
  const canAccessAI = useCallback((action: 'read' | 'write') => {
    return hasPermission(`ai:${action}`)
  }, [hasPermission])

  const canAccessServers = useCallback((action: 'read' | 'write') => {
    return hasPermission(`servers:${action}`)
  }, [hasPermission])

  const canAccessCICD = useCallback((action: 'read' | 'write') => {
    return hasPermission(`cicd:${action}`)
  }, [hasPermission])

  const canAccessApprovals = useCallback((action: 'read' | 'write') => {
    return hasPermission(`approvals:${action}`)
  }, [hasPermission])

  const canAccessMonitoring = useCallback((action: 'read' | 'write') => {
    return hasPermission(`monitoring:${action}`)
  }, [hasPermission])

  const canAccessGrafana = useCallback((action: 'read' | 'write') => {
    return hasPermission(`grafana:${action}`)
  }, [hasPermission])

  const canAccessNotifications = useCallback((action: 'read' | 'write') => {
    return hasPermission(`notifications:${action}`)
  }, [hasPermission])

  const canAccessUsers = useCallback((action: 'read' | 'write') => {
    return hasPermission(`users:${action}`)
  }, [hasPermission])

  const canAccessPermissions = useCallback((action: 'read' | 'write') => {
    return hasPermission(`permissions:${action}`)
  }, [hasPermission])

  const canAccessConfig = useCallback((action: 'read' | 'write') => {
    return hasPermission(`config:${action}`)
  }, [hasPermission])

  return {
    // 基础权限检查
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccess,

    // 增强权限检查
    checkRole,
    checkPermission,
    checkResourceAccess,
    checkOwnership,
    canExecuteAction,

    // 具体权限检查函数
    canAccessAI,
    canAccessServers,
    canAccessCICD,
    canAccessApprovals,
    canAccessMonitoring,
    canAccessGrafana,
    canAccessNotifications,
    canAccessUsers,
    canAccessPermissions,
    canAccessConfig,

    // 工具方法
    getAccessiblePaths,

    // 状态信息
    permissions: auth.permissions,
    role: auth.user?.role,
    roleLevel: auth.user ? roleHierarchy[auth.user.role as keyof typeof roleHierarchy] || 0 : 0,
    isAuthenticated: auth.isAuthenticated,
  }
}

// 认证状态检查Hook
export function useAuthStatus() {
  const { state } = useGlobalState()
  const { auth } = state

  const isTokenExpiringSoon = useCallback((): boolean => {
    if (!auth.sessionExpiresAt) return true
    const fiveMinutes = 5 * 60 * 1000
    return (auth.sessionExpiresAt.getTime() - Date.now()) < fiveMinutes
  }, [auth.sessionExpiresAt])

  const timeToExpiry = useCallback((): number => {
    if (!auth.sessionExpiresAt) return 0
    return Math.max(0, auth.sessionExpiresAt.getTime() - Date.now())
  }, [auth.sessionExpiresAt])

  const isSessionValid = useCallback((): boolean => {
    return auth.isAuthenticated && 
           auth.accessToken !== null && 
           auth.user !== null &&
           timeToExpiry() > 0
  }, [auth.isAuthenticated, auth.accessToken, auth.user, timeToExpiry])

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.loading,
    error: auth.error,
    isTokenExpiringSoon: isTokenExpiringSoon(),
    timeToExpiry: timeToExpiry(),
    isSessionValid: isSessionValid(),
    lastLoginAt: auth.lastLoginAt,
    sessionExpiresAt: auth.sessionExpiresAt,
  }
} 