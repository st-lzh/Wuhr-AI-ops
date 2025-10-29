'use client'

import React, { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Spin } from 'antd'
import { useAuth } from '../../hooks/useAuth'

interface AuthGuardProps {
  children: ReactNode
  requiredRole?: 'admin' | 'manager' | 'developer' | 'viewer'
  requiredPermissions?: string[]
  fallback?: ReactNode
}

export default function AuthGuard({ 
  children, 
  requiredRole,
  requiredPermissions = [],
  fallback 
}: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, loading, user } = useAuth()

  // 公开路径，不需要认证
  const publicPaths = ['/login', '/register', '/auth']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  useEffect(() => {
    // 如果是公开路径，直接返回
    if (isPublicPath) return

    // 如果正在加载，等待
    if (loading) return

    // 如果未认证，重定向到登录页
    if (!isAuthenticated || !user) {
      const returnUrl = encodeURIComponent(pathname)
      router.replace(`/login?returnUrl=${returnUrl}`)
      return
    }

    // 检查角色权限
    if (requiredRole && user.role !== requiredRole) {
      // 角色层级检查
      const roleHierarchy = {
        admin: 4,
        manager: 3,
        developer: 2,
        viewer: 1,
      }
      
      const userLevel = roleHierarchy[user.role] || 0
      const requiredLevel = roleHierarchy[requiredRole] || 0
      
      if (userLevel < requiredLevel) {
        router.replace('/auth/403')
        return
      }
    }

    // 检查具体权限
    if (requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every(permission => 
        user.permissions.includes(permission) || user.role === 'admin'
      )
      
      if (!hasPermission) {
        router.replace('/auth/403')
        return
      }
    }
  }, [isAuthenticated, loading, user, pathname, requiredRole, requiredPermissions, router, isPublicPath])

  // 公开路径直接显示内容
  if (isPublicPath) {
    return <>{children}</>
  }

  // 显示加载状态
  if (loading) {
    return fallback || null
  }

  // 未认证显示加载（等待重定向）
  if (!isAuthenticated || !user) {
    return fallback || null
  }

  // 权限检查通过，显示内容
  return <>{children}</>
}
