'use client'

import React, { Component, ReactNode } from 'react'
import { Result, Button } from 'antd'
import { BugOutlined, ReloadOutlined } from '@ant-design/icons'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // 调用外部错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 更新状态包含错误信息
    this.setState({
      error,
      errorInfo,
    })

    // 这里可以将错误日志上报给日志服务
    this.logErrorToService(error, errorInfo)
  }

  private logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // 在生产环境中，这里应该上报到错误监控服务
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    // 开发环境下只打印到控制台
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary - Error Details')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Full Error Data:', errorData)
      console.groupEnd()
    }

    // 生产环境可以发送到错误监控服务
    // try {
    //   fetch('/api/error-report', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(errorData)
    //   })
    // } catch (reportError) {
    //   console.error('Failed to report error:', reportError)
    // }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // 如果有自定义的 fallback UI，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认的错误 UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full mx-4">
            <Result
              status="error"
              icon={<BugOutlined className="text-red-500" />}
              title="页面出现错误"
              subTitle={
                <div className="space-y-2">
                  <p className="text-gray-600 dark:text-gray-400">
                    抱歉，页面遇到了一个意外错误。请尝试刷新页面或联系技术支持。
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left">
                      <summary className="cursor-pointer font-medium text-red-600 dark:text-red-400">
                        错误详情 (开发模式)
                      </summary>
                      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        <p><strong>错误消息:</strong> {this.state.error.message}</p>
                        {this.state.error.stack && (
                          <pre className="mt-2 overflow-auto text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded">
                            {this.state.error.stack}
                          </pre>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              }
              extra={[
                <Button key="reset" onClick={this.handleReset}>
                  重试
                </Button>,
                <Button
                  key="reload"
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={this.handleReload}
                >
                  刷新页面
                </Button>,
              ]}
            />
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

// 便捷的 HOC 包装器
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
} 