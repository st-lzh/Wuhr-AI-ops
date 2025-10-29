'use client'

import React, { useState } from 'react'
import { Card, Tag, Typography, Divider, Button, Space, Tooltip } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  ExpandAltOutlined,
  CompressOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import EnhancedMarkdownRenderer from './EnhancedMarkdownRenderer'

const { Text, Paragraph } = Typography

interface AIMessageRendererProps {
  content: string
  isError?: boolean
  isStreaming?: boolean
  metadata?: {
    model?: string
    provider?: string
    execution_time?: string
    tools_used?: string[]
    model_used?: string
    hostId?: string
    hostName?: string
    executionMode?: string
  }
  className?: string
}

const AIMessageRenderer: React.FC<AIMessageRendererProps> = ({
  content,
  isError = false,
  isStreaming = false,
  metadata,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  // 前端额外的ANSI清理保护
  const cleanContent = (text: string) => {
    return text
      .replace(/\x1b\[[0-9;]*[mGKHfABCDsuJnpqr]/g, '')
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      .replace(/\x1b\[[\d;]*[A-Za-z]/g, '')
      .replace(/\x1b\[[?]?[0-9;]*[hlc]/g, '')
      .replace(/\x1b\]/g, '')
      .replace(/\x1b\\/g, '')
      .replace(/\x1b[()][AB012]/g, '')
      .replace(/\x1b[=>]/g, '')
      .replace(/\x1b[78]/g, '')
      .replace(/\x1b[DEHMN]/g, '')
      .replace(/\x1b\[[\d;]*[~]/g, '')
      .replace(/\x1b\[[0-9;]*[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/g, '')
      .replace(/\x1b\[[0-9;]*[abcdefghijklmnopqrstuvwxyz]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
  }

  const cleanedContent = cleanContent(content)

  // 复制内容到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  // 解析执行结果类型
  const getExecutionStatus = () => {
    if (isError) {
      return {
        status: 'error',
        color: 'red',
        icon: <ExclamationCircleOutlined />,
        text: '执行失败'
      }
    }

    if (cleanedContent.toLowerCase().includes('error') || cleanedContent.toLowerCase().includes('failed')) {
      return {
        status: 'warning',
        color: 'orange',
        icon: <ExclamationCircleOutlined />,
        text: '部分异常'
      }
    }

    return {
      status: 'success',
      color: 'green',
      icon: <CheckCircleOutlined />,
      text: '执行成功'
    }
  }

  const executionStatus = getExecutionStatus()

  return (
    <div className={`ai-message-container ${className}`}>
      <Card
        className={`ai-message-card ${isError ? 'error-card' : 'success-card'}`}
        size="small"
        styles={{
          body: { 
            padding: '16px',
            background: isError 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.02) 100%)'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)'
          }
        }}
        bordered={false}
      >
        {/* 消息头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isError ? 'bg-red-500/20' : 'bg-blue-500/20'
            }`}>
              <RobotOutlined className={`text-sm ${
                isError ? 'text-red-400' : 'text-blue-400'
              }`} />
            </div>
            <Text className="text-gray-300 font-medium">AI助手回复</Text>
            <Tag 
              color={executionStatus.color} 
              icon={executionStatus.icon}
              className="text-xs"
            >
              {executionStatus.text}
            </Tag>
          </div>
          
          <Space size="small">
            {metadata?.execution_time && (
              <Tooltip title="执行时间">
                <Tag icon={<ClockCircleOutlined />} color="blue" className="text-xs">
                  {metadata.execution_time}
                </Tag>
              </Tooltip>
            )}
            
            {metadata?.executionMode === 'remote' && metadata?.hostName && (
              <Tooltip title="远程执行">
                <Tag icon={<ThunderboltOutlined />} color="purple" className="text-xs">
                  {metadata.hostName}
                </Tag>
              </Tooltip>
            )}
            
            <Tooltip title={copied ? '已复制' : '复制内容'}>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                className={`text-gray-400 hover:text-gray-200 ${copied ? 'text-green-400' : ''}`}
              />
            </Tooltip>
            
            <Tooltip title={isExpanded ? '收起' : '展开'}>
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <CompressOutlined /> : <ExpandAltOutlined />}
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-gray-200"
              />
            </Tooltip>
          </Space>
        </div>

        {/* 模型信息 */}
        {metadata && (
          <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-600/30">
            {metadata.model_used && (
              <Tag color="geekblue" className="text-xs">
                {metadata.model_used}
              </Tag>
            )}
            
            {metadata.tools_used && metadata.tools_used.length > 0 && (
              <Tag color="cyan" className="text-xs">
                工具: {metadata.tools_used.join(', ')}
              </Tag>
            )}
            
            {metadata.provider && (
              <Tag color="purple" className="text-xs">
                {metadata.provider}
              </Tag>
            )}
          </div>
        )}

        {/* 消息内容 */}
        <div className={`ai-message-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
          <div className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? 'max-h-none' : 'max-h-96'
          }`}>
            <EnhancedMarkdownRenderer
              content={cleanedContent}
              className="enhanced-ai-content"
              isStreaming={isStreaming}
            />
          </div>
          
          {!isExpanded && cleanedContent.length > 1000 && (
            <div className="mt-2 text-center">
              <Button
                type="link"
                size="small"
                onClick={() => setIsExpanded(true)}
                className="text-blue-400 hover:text-blue-300"
              >
                显示完整内容...
              </Button>
            </div>
          )}
        </div>
      </Card>

      <style jsx>{`
        .ai-message-card {
          border: 1px solid rgba(75, 85, 99, 0.3) !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          backdrop-filter: blur(8px) !important;
        }
        
        .ai-message-card.error-card {
          border-color: rgba(239, 68, 68, 0.3) !important;
        }
        
        .ai-message-card.success-card {
          border-color: rgba(59, 130, 246, 0.3) !important;
        }
        
        .ai-message-content.collapsed {
          position: relative;
        }
        
        .ai-message-content.collapsed::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(transparent, rgba(31, 41, 55, 0.8));
          pointer-events: none;
        }
        
        .ai-message-content.expanded::after {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default AIMessageRenderer
