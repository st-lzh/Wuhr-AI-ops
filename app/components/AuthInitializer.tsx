'use client'

import { useEffect, useContext } from 'react'
import { GlobalStateContext } from '../contexts/GlobalStateContext'

interface AuthInitializerProps {
  children: React.ReactNode
}

export function AuthInitializer({ children }: AuthInitializerProps) {
  const context = useContext(GlobalStateContext)
  if (!context) {
    throw new Error('AuthInitializer must be used within a GlobalStateProvider')
  }
  const { dispatch } = context

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 检查是否有明确的退出标记
        const logoutFlag = sessionStorage.getItem('user_logged_out')
        if (logoutFlag === 'true') {
          console.log('ℹ️ 用户已主动退出，跳过自动认证')
          return
        }

        // 首先尝试验证当前认证状态
        console.log('🔍 开始验证认证状态...')
        const verifyResponse = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        console.log('🔍 验证响应状态:', verifyResponse.status)

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json()
          console.log('🔍 验证响应数据:', verifyData)

          if (verifyData.success && verifyData.data && verifyData.data.valid) {
            console.log('✅ 认证状态有效，用户:', verifyData.data.user?.username)
            // 清除退出标记
            sessionStorage.removeItem('user_logged_out')
            // 更新全局状态
            dispatch({
              type: 'AUTH_LOGIN_SUCCESS',
              payload: {
                user: verifyData.data.user,
                accessToken: 'valid', // 实际token在httpOnly cookie中
                expiresIn: 7200 // 2小时，与登录API保持一致
              }
            })
            return
          } else {
            console.log('❌ 认证状态无效:', verifyData)
          }
        } else {
          console.log('❌ 验证请求失败:', verifyResponse.status)
        }

        // 如果是401错误，说明用户未认证
        if (verifyResponse.status === 401) {
          console.log('🔍 检测到401错误，用户未认证')
        }

        console.log('ℹ️ 未找到有效的认证状态，用户需要重新登录')

        // 只有在非登录页面时才强制退出
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          // 强制退出用户
          dispatch({ type: 'AUTH_LOGOUT' })

          // 清除所有认证相关的存储
          sessionStorage.setItem('user_logged_out', 'true')
          document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'

          // 跳转到登录页面
          window.location.href = '/login'
        }

      } catch (error) {
        console.warn('认证初始化失败:', error)

        // 只有在非登录页面时才处理错误
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          // 发生错误时也强制退出
          dispatch({ type: 'AUTH_LOGOUT' })
          sessionStorage.setItem('user_logged_out', 'true')

          window.location.href = '/login'
        }
      }
    }

    initializeAuth()
  }, [dispatch]) // 依赖dispatch

  return <>{children}</>
}
