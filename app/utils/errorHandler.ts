import { message, notification } from 'antd'

// 错误类型枚举
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 错误信息接口
export interface AppError {
  type: ErrorType
  message: string
  code?: string | number
  details?: any
  timestamp: string
  url?: string
  stack?: string
}

// 错误消息映射
const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络状态',
  [ErrorType.API_ERROR]: 'API 请求失败，请稍后重试',
  [ErrorType.VALIDATION_ERROR]: '输入数据验证失败',
  [ErrorType.AUTHORIZATION_ERROR]: '身份验证失败，请重新登录',
  [ErrorType.SERVER_ERROR]: '服务器内部错误，请联系技术支持',
  [ErrorType.TIMEOUT_ERROR]: '请求超时，请稍后重试',
  [ErrorType.UNKNOWN_ERROR]: '发生未知错误，请稍后重试',
}

// 创建标准化错误对象
export function createAppError(
  type: ErrorType,
  message?: string,
  code?: string | number,
  details?: any
): AppError {
  return {
    type,
    message: message || ERROR_MESSAGES[type],
    code,
    details,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    stack: new Error().stack,
  }
}

// HTTP 状态码到错误类型的映射
export function getErrorTypeFromStatus(status: number): ErrorType {
  if (status >= 500) return ErrorType.SERVER_ERROR
  if (status === 401 || status === 403) return ErrorType.AUTHORIZATION_ERROR
  if (status === 400) return ErrorType.VALIDATION_ERROR
  if (status === 408) return ErrorType.TIMEOUT_ERROR
  return ErrorType.API_ERROR
}

// 错误处理器类
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorQueue: AppError[] = []
  private maxQueueSize = 100

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // 处理 API 错误
  handleApiError(error: any, url?: string): AppError {
    let appError: AppError

    if (error.response) {
      // 服务器响应了错误状态码
      const { status, data } = error.response
      const errorType = getErrorTypeFromStatus(status)
      
      appError = createAppError(
        errorType,
        data?.message || data?.error || ERROR_MESSAGES[errorType],
        status,
        { response: data, url }
      )
    } else if (error.request) {
      // 请求发出但没有收到响应
      appError = createAppError(
        ErrorType.NETWORK_ERROR,
        '网络请求失败，请检查网络连接',
        'NETWORK_ERROR',
        { url }
      )
    } else {
      // 其他错误
      appError = createAppError(
        ErrorType.UNKNOWN_ERROR,
        error.message || '未知错误',
        'UNKNOWN_ERROR',
        { originalError: error, url }
      )
    }

    this.logError(appError)
    return appError
  }

  // 处理网络错误
  handleNetworkError(error: Error, url?: string): AppError {
    const appError = createAppError(
      ErrorType.NETWORK_ERROR,
      error.message || '网络连接失败',
      'NETWORK_ERROR',
      { originalError: error, url }
    )

    this.logError(appError)
    return appError
  }

  // 处理验证错误
  handleValidationError(message: string, details?: any): AppError {
    const appError = createAppError(
      ErrorType.VALIDATION_ERROR,
      message,
      'VALIDATION_ERROR',
      details
    )

    this.logError(appError)
    return appError
  }

  // 显示错误消息给用户
  showErrorToUser(error: AppError, options?: {
    useNotification?: boolean
    duration?: number
  }) {
    const { useNotification = false, duration = 4.5 } = options || {}

    if (useNotification) {
      notification.error({
        message: '操作失败',
        description: error.message,
        duration,
        placement: 'topRight',
      })
    } else {
      message.error(error.message, duration)
    }
  }

  // 显示成功消息
  showSuccess(text: string, useNotification = false) {
    if (useNotification) {
      notification.success({
        message: '操作成功',
        description: text,
        duration: 3,
        placement: 'topRight',
      })
    } else {
      message.success(text)
    }
  }

  // 显示警告消息
  showWarning(text: string, useNotification = false) {
    if (useNotification) {
      notification.warning({
        message: '注意',
        description: text,
        duration: 4,
        placement: 'topRight',
      })
    } else {
      message.warning(text)
    }
  }

  // 显示信息消息
  showInfo(text: string, useNotification = false) {
    if (useNotification) {
      notification.info({
        message: '提示',
        description: text,
        duration: 3,
        placement: 'topRight',
      })
    } else {
      message.info(text)
    }
  }

  // 记录错误
  private logError(error: AppError) {
    // 添加到错误队列
    this.errorQueue.push(error)
    
    // 保持队列大小
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift()
    }

    // 开发环境下打印详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Handler - ${error.type}`)
      console.error('Message:', error.message)
      console.error('Code:', error.code)
      console.error('Details:', error.details)
      console.error('Timestamp:', error.timestamp)
      console.error('URL:', error.url)
      if (error.stack) {
        console.error('Stack:', error.stack)
      }
      console.groupEnd()
    }

    // 生产环境可以发送到错误监控服务
    this.reportError(error)
  }

  // 上报错误到监控服务
  private async reportError(error: AppError) {
    try {
      // 这里可以集成 Sentry、LogRocket 等错误监控服务
      // await fetch('/api/error-report', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(error)
      // })
    } catch (reportError) {
      console.error('Failed to report error:', reportError)
    }
  }

  // 获取错误历史
  getErrorHistory(): AppError[] {
    return [...this.errorQueue]
  }

  // 清除错误历史
  clearErrorHistory() {
    this.errorQueue = []
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance()

// 便捷的错误处理函数
export function handleError(error: any, options?: {
  showToUser?: boolean
  useNotification?: boolean
  customMessage?: string
  url?: string
}): AppError {
  const { 
    showToUser = true, 
    useNotification = false, 
    customMessage,
    url 
  } = options || {}

  let appError: AppError

  if (error instanceof Error) {
    appError = errorHandler.handleNetworkError(error, url)
  } else {
    appError = errorHandler.handleApiError(error, url)
  }

  // 如果有自定义消息，覆盖默认消息
  if (customMessage) {
    appError = { ...appError, message: customMessage }
  }

  // 显示给用户
  if (showToUser) {
    errorHandler.showErrorToUser(appError, { useNotification })
  }

  return appError
}

// 重试机制
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (i === maxRetries) {
        throw error
      }

      // 指数退避延迟
      const retryDelay = delay * Math.pow(2, i)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  throw lastError
} 