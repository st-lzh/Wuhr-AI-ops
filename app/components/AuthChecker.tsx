'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { FullScreenLoading } from './LoadingAnimation'

interface AuthCheckerProps {
  children: React.ReactNode
}

export default function AuthChecker({ children }: AuthCheckerProps) {
  const [isChecking, setIsChecking] = useState(true)
  const { isAuthenticated, user, verifySession } = useAuth()

  useEffect(() => {
    async function checkAuth() {
      try {
        // 如果localStorage中有用户信息但没有有效的session，尝试验证
        if (user && !isAuthenticated) {
          console.log('🔍 检测到已保存的用户信息，验证session中...')
          await verifySession()
        }
      } catch (error) {
        console.warn('Session验证失败:', error)
      } finally {
        setIsChecking(false)
      }
    }

    // 延迟一点确保localStorage已经加载
    const timer = setTimeout(checkAuth, 100)
    return () => clearTimeout(timer)
  }, [user, isAuthenticated, verifySession])

  if (isChecking) {
    return <FullScreenLoading text="验证登录状态..." />
  }

  return <>{children}</>
}