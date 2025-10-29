'use client'

import React from 'react'
import { Card, Typography, Tag, Space, Divider } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DesktopOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import EnhancedMarkdownRenderer from './EnhancedMarkdownRenderer'

const { Text, Title } = Typography

interface ExecutionSummaryProps {
  content: string
  metadata?: {
    execution_time?: string
    model_used?: string
    provider?: string
    executionMode?: string
    hostName?: string
    isK8sMode?: boolean
  }
  isError?: boolean
  className?: string
}

const ExecutionSummary: React.FC<ExecutionSummaryProps> = ({
  content,
  metadata,
  isError = false,
  className = ''
}) => {
  // 解析执行状态
  const getExecutionStatus = () => {
    if (isError) {
      return {
        status: 'error',
        color: 'red',
        icon: <ExclamationCircleOutlined />,
        text: '执行失败'
      }
    }

    if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed')) {
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

  // 智能提取总结内容
  const extractSummary = (text: string) => {
    // 查找总结相关的关键词
    const summaryKeywords = [
      '总结', '结论', '分析结果', '执行结果', '状态分析', 
      '优化建议', '建议', '推荐', 'summary', 'conclusion'
    ]
    
    const lines = text.split('\n')
    let summaryStart = -1
    let summaryContent = ''
    
    // 查找总结开始位置
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase()
      if (summaryKeywords.some(keyword => line.includes(keyword.toLowerCase()))) {
        summaryStart = i
        break
      }
    }
    
    if (summaryStart >= 0) {
      // 从总结开始位置提取内容
      summaryContent = lines.slice(summaryStart).join('\n')
    } else {
      // 如果没有找到明确的总结标记，取最后几段作为总结
      const paragraphs = text.split('\n\n').filter(p => p.trim())
      if (paragraphs.length > 2) {
        summaryContent = paragraphs.slice(-2).join('\n\n')
      } else {
        summaryContent = text
      }
    }
    
    return summaryContent.trim()
  }

  const summaryContent = extractSummary(content)

  return (
    <Card
      className={`execution-summary-card ${className}`}
      size="small"
      styles={{
        body: { 
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.2)',
          border: `1px solid ${executionStatus.color === 'green' ? '#10b981' : executionStatus.color === 'red' ? '#ef4444' : '#f59e0b'}40`
        }
      }}
      bordered={false}
    >
      {/* 总结头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            executionStatus.color === 'green' ? 'bg-green-500/20' : 
            executionStatus.color === 'red' ? 'bg-red-500/20' : 'bg-orange-500/20'
          }`}>
            {executionStatus.icon}
          </div>
          <Title level={5} className="text-gray-200 mb-0">
            📋 执行总结
          </Title>
          <Tag 
            color={executionStatus.color} 
            icon={executionStatus.icon}
            className="text-xs"
          >
            {executionStatus.text}
          </Tag>
        </div>
      </div>

      {/* 元数据信息 */}
      {metadata && (
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-600/30">
          {/* 执行模式 */}
          {metadata.isK8sMode !== undefined && (
            <Tag 
              icon={metadata.isK8sMode ? <GlobalOutlined /> : <DesktopOutlined />}
              color={metadata.isK8sMode ? 'blue' : 'green'}
              className="text-xs"
            >
              {metadata.isK8sMode ? 'K8s集群模式' : 'Linux系统模式'}
            </Tag>
          )}
          
          {/* 模型信息 */}
          {metadata.model_used && (
            <Tag color="geekblue" className="text-xs">
              {metadata.model_used}
            </Tag>
          )}
          
          {/* 提供商 */}
          {metadata.provider && (
            <Tag color="purple" className="text-xs">
              {metadata.provider}
            </Tag>
          )}
          
          {/* 执行时间 */}
          {metadata.execution_time && (
            <Tag icon={<ClockCircleOutlined />} color="blue" className="text-xs">
              {metadata.execution_time}
            </Tag>
          )}
          
          {/* 远程执行标识 */}
          {metadata.executionMode === 'remote' && metadata.hostName && (
            <Tag icon={<ThunderboltOutlined />} color="purple" className="text-xs">
              {metadata.hostName}
            </Tag>
          )}
        </div>
      )}

      {/* 总结内容 */}
      <div className="execution-summary-content">
        <div className={`p-4 rounded-lg border ${
          executionStatus.color === 'green' ? 'border-green-500/30 bg-green-500/5' :
          executionStatus.color === 'red' ? 'border-red-500/30 bg-red-500/5' :
          'border-orange-500/30 bg-orange-500/5'
        }`}>
          <EnhancedMarkdownRenderer
            content={summaryContent}
            className="text-gray-300"
          />
        </div>
      </div>
    </Card>
  )
}

export default ExecutionSummary
