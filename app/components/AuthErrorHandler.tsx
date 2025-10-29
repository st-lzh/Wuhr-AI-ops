'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Button, Space, Typography, Collapse } from 'antd'
import { ReloadOutlined, LoginOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

interface AuthErrorHandlerProps {
  onRetry?: () => void
  onLogin?: () => void
}

export default function AuthErrorHandler({ onRetry, onLogin }: AuthErrorHandlerProps) {
  const [errorCount, setErrorCount] = useState(0)
  const [lastError, setLastError] = useState<Date | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // 监听认证错误事件
    const handleAuthError = (event: CustomEvent) => {
      setErrorCount(prev => prev + 1)
      setLastError(new Date())
      console.log('🚨 认证错误事件:', event.detail)
    }

    window.addEventListener('auth-error' as any, handleAuthError)
    return () => window.removeEventListener('auth-error' as any, handleAuthError)
  }, [])

  const handleRetry = () => {
    setErrorCount(0)
    setLastError(null)
    onRetry?.()
  }

  const handleLogin = () => {
    window.location.href = '/login'
  }

  if (errorCount === 0) return null

  return (
    <div style={{ 
      position: 'fixed', 
      top: 20, 
      right: 20, 
      zIndex: 9999, 
      maxWidth: 400,
      minWidth: 300
    }}>
      <Alert
        message="认证状态异常"
        description={
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>
              检测到认证问题，这可能是由于以下原因：
            </Text>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>登录会话已过期</li>
              <li>网络连接不稳定</li>
              <li>浏览器清除了登录信息</li>
            </ul>
            <Space>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />} 
                onClick={handleRetry}
                size="small"
              >
                重试
              </Button>
              <Button 
                icon={<LoginOutlined />} 
                onClick={handleLogin}
                size="small"
              >
                重新登录
              </Button>
              <Button 
                type="text" 
                icon={<InfoCircleOutlined />} 
                onClick={() => setShowDetails(!showDetails)}
                size="small"
              >
                详情
              </Button>
            </Space>
            
            {showDetails && (
              <Collapse size="small" style={{ marginTop: 8 }}>
                <Panel header="错误详情" key="1">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text type="secondary">
                      错误次数: {errorCount}
                    </Text>
                    {lastError && (
                      <Text type="secondary">
                        最后错误时间: {lastError.toLocaleString()}
                      </Text>
                    )}
                    <Paragraph copyable={{ text: `错误次数: ${errorCount}, 时间: ${lastError?.toISOString()}` }}>
                      <Text code>
                        HTTP 401 - 认证失败
                      </Text>
                    </Paragraph>
                  </Space>
                </Panel>
              </Collapse>
            )}
          </Space>
        }
        type="warning"
        showIcon
        closable
        onClose={() => setErrorCount(0)}
      />
    </div>
  )
}
