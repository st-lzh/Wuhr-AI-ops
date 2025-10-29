'use client'

import React from 'react'
import { Result, Button } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { usePermissions } from '../../hooks/usePermissions'

interface PermissionGuardProps {
  children: React.ReactNode
  // 权限检查选项
  permission?: string
  permissions?: string[]
  module?: string
  action?: 'read' | 'write'
  role?: string
  // 检查模式
  mode?: 'all' | 'any'
  // 自定义检查函数
  check?: () => boolean
  // 无权限时的显示
  fallback?: React.ReactNode
  // 是否显示默认的无权限页面
  showFallback?: boolean
}

/**
 * 权限守卫组件
 * 根据用户权限控制内容的显示
 */
export function PermissionGuard({
  children,
  permission,
  permissions = [],
  module,
  action = 'read',
  role,
  mode = 'all',
  check,
  fallback,
  showFallback = true
}: PermissionGuardProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkModulePermission,
    checkRole,
    isAuthenticated
  } = usePermissions()

  // 如果用户未登录，不显示内容
  if (!isAuthenticated) {
    return showFallback ? (
      <Result
        status="403"
        title="未登录"
        subTitle="请先登录后再访问此页面"
        extra={
          <Button type="primary" onClick={() => window.location.href = '/login'}>
            去登录
          </Button>
        }
      />
    ) : null
  }

  let hasAccess = true

  // 自定义检查函数优先级最高
  if (check) {
    hasAccess = check()
  } else {
    // 角色检查
    if (role && !checkRole(role as any)) {
      hasAccess = false
    }

    // 模块权限检查
    if (hasAccess && module && !checkModulePermission(module, action)) {
      hasAccess = false
    }

    // 单个权限检查
    if (hasAccess && permission && !hasPermission(permission)) {
      hasAccess = false
    }

    // 多个权限检查
    if (hasAccess && permissions.length > 0) {
      if (mode === 'all') {
        hasAccess = hasAllPermissions(permissions)
      } else {
        hasAccess = hasAnyPermission(permissions)
      }
    }
  }

  // 如果有权限，显示内容
  if (hasAccess) {
    return <>{children}</>
  }

  // 如果有自定义fallback，显示自定义内容
  if (fallback) {
    return <>{fallback}</>
  }

  // 如果不显示fallback，返回null
  if (!showFallback) {
    return null
  }

  // 显示默认的无权限页面
  return (
    <Result
      status="403"
      title="权限不足"
      subTitle="您没有权限访问此内容，请联系管理员"
      icon={<LockOutlined />}
      extra={
        <Button type="primary" onClick={() => window.history.back()}>
          返回上一页
        </Button>
      }
    />
  )
}

/**
 * 权限按钮组件
 * 根据权限控制按钮的显示和禁用状态
 */
interface PermissionButtonProps {
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  module?: string
  action?: 'read' | 'write'
  role?: string
  mode?: 'all' | 'any'
  check?: () => boolean
  // 无权限时是否隐藏按钮
  hideWhenNoPermission?: boolean
  // 无权限时是否禁用按钮
  disableWhenNoPermission?: boolean
  // 其他按钮属性
  [key: string]: any
}

export function PermissionButton({
  children,
  permission,
  permissions = [],
  module,
  action = 'read',
  role,
  mode = 'all',
  check,
  hideWhenNoPermission = false,
  disableWhenNoPermission = true,
  ...buttonProps
}: PermissionButtonProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkModulePermission,
    checkRole,
    isAuthenticated
  } = usePermissions()

  // 如果用户未登录，隐藏按钮
  if (!isAuthenticated) {
    return hideWhenNoPermission ? null : (
      <Button {...buttonProps} disabled>
        {children}
      </Button>
    )
  }

  let hasAccess = true

  // 自定义检查函数优先级最高
  if (check) {
    hasAccess = check()
  } else {
    // 角色检查
    if (role && !checkRole(role as any)) {
      hasAccess = false
    }

    // 模块权限检查
    if (hasAccess && module && !checkModulePermission(module, action)) {
      hasAccess = false
    }

    // 单个权限检查
    if (hasAccess && permission && !hasPermission(permission)) {
      hasAccess = false
    }

    // 多个权限检查
    if (hasAccess && permissions.length > 0) {
      if (mode === 'all') {
        hasAccess = hasAllPermissions(permissions)
      } else {
        hasAccess = hasAnyPermission(permissions)
      }
    }
  }

  // 如果有权限，显示正常按钮
  if (hasAccess) {
    return <Button {...buttonProps}>{children}</Button>
  }

  // 如果无权限且需要隐藏，返回null
  if (hideWhenNoPermission) {
    return null
  }

  // 如果无权限且需要禁用，显示禁用按钮
  if (disableWhenNoPermission) {
    return (
      <Button {...buttonProps} disabled>
        {children}
      </Button>
    )
  }

  // 默认显示正常按钮
  return <Button {...buttonProps}>{children}</Button>
}