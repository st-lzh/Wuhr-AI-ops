// 认证错误监控和处理工具

interface AuthErrorEvent {
  type: 'token_expired' | 'token_invalid' | 'network_error' | 'server_error'
  status?: number
  message?: string
  timestamp: Date
  url?: string
}

class AuthErrorMonitor {
  private errorHistory: AuthErrorEvent[] = []
  private maxHistorySize = 50
  private retryAttempts = 0
  private maxRetryAttempts = 3
  private retryDelay = 1000 // 1秒

  // 记录认证错误
  recordError(error: Omit<AuthErrorEvent, 'timestamp'>) {
    const errorEvent: AuthErrorEvent = {
      ...error,
      timestamp: new Date()
    }

    this.errorHistory.unshift(errorEvent)
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize)
    }

    console.warn('🚨 认证错误记录:', errorEvent)

    // 触发自定义事件，供UI组件监听
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-error', {
        detail: errorEvent
      }))
    }

    // 根据错误类型决定处理策略
    this.handleError(errorEvent)
  }

  // 处理认证错误
  private async handleError(error: AuthErrorEvent) {
    switch (error.type) {
      case 'token_expired':
        await this.handleTokenExpired()
        break
      case 'token_invalid':
        await this.handleTokenInvalid()
        break
      case 'network_error':
        await this.handleNetworkError()
        break
      case 'server_error':
        await this.handleServerError()
        break
    }
  }

  // 处理token过期
  private async handleTokenExpired() {
    if (this.retryAttempts < this.maxRetryAttempts) {
      this.retryAttempts++
      console.log(`🔄 尝试刷新token (${this.retryAttempts}/${this.maxRetryAttempts})`)
      
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            console.log('✅ Token刷新成功')
            this.retryAttempts = 0
            return
          }
        }
      } catch (error) {
        console.error('Token刷新失败:', error)
      }
    }

    // 刷新失败，跳转到登录页
    this.redirectToLogin()
  }

  // 处理token无效
  private async handleTokenInvalid() {
    console.log('🚫 Token无效，需要重新登录')
    this.redirectToLogin()
  }

  // 处理网络错误
  private async handleNetworkError() {
    if (this.retryAttempts < this.maxRetryAttempts) {
      this.retryAttempts++
      console.log(`🌐 网络错误，等待重试 (${this.retryAttempts}/${this.maxRetryAttempts})`)
      
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryAttempts))
      
      // 可以在这里重试最后一次失败的请求
      return
    }

    console.error('🌐 网络连接持续失败')
  }

  // 处理服务器错误
  private async handleServerError() {
    console.error('🔥 服务器错误，请稍后重试')
  }

  // 跳转到登录页
  private redirectToLogin() {
    if (typeof window !== 'undefined') {
      // 清除认证相关存储
      sessionStorage.setItem('user_logged_out', 'true')
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      
      // 跳转到登录页
      window.location.href = '/login'
    }
  }

  // 获取错误历史
  getErrorHistory(): AuthErrorEvent[] {
    return [...this.errorHistory]
  }

  // 获取错误统计
  getErrorStats() {
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

    const recent24h = this.errorHistory.filter(e => e.timestamp > last24Hours)
    const recent1h = this.errorHistory.filter(e => e.timestamp > lastHour)

    return {
      total: this.errorHistory.length,
      last24Hours: recent24h.length,
      lastHour: recent1h.length,
      byType: this.errorHistory.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }

  // 清除错误历史
  clearHistory() {
    this.errorHistory = []
    this.retryAttempts = 0
  }

  // 重置重试计数
  resetRetryAttempts() {
    this.retryAttempts = 0
  }
}

// 导出单例实例
export const authErrorMonitor = new AuthErrorMonitor()

// 便捷函数：监控fetch请求的认证错误
export function monitorAuthError(response: Response, url?: string) {
  if (response.status === 401) {
    authErrorMonitor.recordError({
      type: 'token_invalid',
      status: response.status,
      message: 'Unauthorized',
      url
    })
  } else if (response.status >= 500) {
    authErrorMonitor.recordError({
      type: 'server_error',
      status: response.status,
      message: 'Server Error',
      url
    })
  }
}

// 便捷函数：监控网络错误
export function monitorNetworkError(error: Error, url?: string) {
  authErrorMonitor.recordError({
    type: 'network_error',
    message: error.message,
    url
  })
}
