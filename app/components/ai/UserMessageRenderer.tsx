'use client'

import React, { useState } from 'react'
import { Card, Button, Space, Tooltip, Typography } from 'antd'
import { 
  CopyOutlined,
  UserOutlined,
  EditOutlined
} from '@ant-design/icons'

const { Text } = Typography

interface UserMessageRendererProps {
  content: string
  timestamp?: string
  className?: string
}

const UserMessageRenderer: React.FC<UserMessageRendererProps> = ({ 
  content, 
  timestamp,
  className = '' 
}) => {
  const [copied, setCopied] = useState(false)

  // 复制内容到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  return (
    <div className={`user-message-container ${className}`}>
      <Card
        className="user-message-card"
        size="small"
        styles={{
          body: { 
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)'
          }
        }}
        bordered={false}
      >
        {/* 消息头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20">
              <UserOutlined className="text-sm text-green-400" />
            </div>
            <Text className="text-gray-300 font-medium">您的请求</Text>
            {timestamp && (
              <Text className="text-gray-500 text-xs">
                {new Date(timestamp).toLocaleTimeString()}
              </Text>
            )}
          </div>
          
          <Space size="small">
            <Tooltip title={copied ? '已复制' : '复制内容'}>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                className={`text-gray-400 hover:text-gray-200 ${copied ? 'text-green-400' : ''}`}
              />
            </Tooltip>
          </Space>
        </div>

        {/* 消息内容 */}
        <div className="user-message-content">
          <div className="user-message-text leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </Card>

      <style jsx>{`
        .user-message-card {
          border: 1px solid rgba(16, 185, 129, 0.3) !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          backdrop-filter: blur(8px) !important;
          transition: all 0.3s ease;
        }
        
        .user-message-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
          border-color: rgba(16, 185, 129, 0.4) !important;
        }
        
        .user-message-content {
          font-size: 14px;
          line-height: 1.6;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }

        .user-message-text {
          color: #1f2937;
        }

        :global(.dark) .user-message-text {
          color: #e5e7eb;
        }

        :global(.light) .user-message-text {
          color: #1f2937;
        }
      `}</style>
    </div>
  )
}

export default UserMessageRenderer
