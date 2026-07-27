'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Typography, Tag, Space, Divider, Button, Tooltip } from 'antd'
import {
  RobotOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { approveCommand, rejectCommand } from '@/utils/httpApiClient'

const { Text, Paragraph } = Typography

interface StreamData {
  type: 'text' | 'command' | 'output' | 'error' | 'done' | 'thinking' | 'command_approval_request' | 'command_approved' | 'command_rejected'
  content: string
  timestamp: string
  metadata?: any
}

interface AgentStreamRendererProps {
  streamData: StreamData[]
  isStreaming: boolean
  className?: string
  autoCollapse?: boolean // 执行完成后是否自动折叠
  hostInfo?: { ip: string; port?: number } // 🔥 用于命令批准API调用
  customToolName?: string // 🔧 自定义工具名称，显示在标题右侧
}

const AgentStreamRenderer: React.FC<AgentStreamRendererProps> = ({
  streamData,
  isStreaming,
  className = '',
  autoCollapse = false,
  hostInfo,
  customToolName
}) => {
  const [showDetails, setShowDetails] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [processingApprovals, setProcessingApprovals] = useState<Set<string>>(new Set()) // 🔥 跟踪正在处理的批准请求
  const endRef = useRef<HTMLDivElement>(null)

  // 🔧 识别工具类型
  const getToolType = (toolName: string | undefined): 'system' | 'custom' | 'mcp' | null => {
    if (!toolName) return null

    // 系统内置工具
    const systemTools = ['bash', 'kubectl', 'read', 'write', 'docker', 'git']
    if (systemTools.includes(toolName.toLowerCase())) {
      return 'system'
    }

    // MCP工具 (通常以mcp_开头)
    if (toolName.startsWith('mcp_')) {
      return 'mcp'
    }

    // 其他都是自定义工具
    return 'custom'
  }

  const toolType = getToolType(customToolName)

  // 自动折叠：执行完成后自动折叠
  useEffect(() => {
    if (!isStreaming && autoCollapse && streamData.length > 0) {
      const timer = setTimeout(() => {
        setShowDetails(false)
      }, 2000) // 2秒后自动折叠
      return () => clearTimeout(timer)
    }
  }, [isStreaming, autoCollapse, streamData.length])

  // 自动滚动到底部 - 使用防抖避免频繁滚动
  useEffect(() => {
    if (endRef.current && streamData.length > 0) {
      const timer = setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [streamData.length])

  // 复制内容到剪贴板
  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  // 获取类型图标和颜色
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'thinking':
        return { icon: <RobotOutlined />, color: '#1890ff', bgColor: '#e6f7ff', label: '思考中' }
      case 'command':
        return { icon: <CodeOutlined />, color: '#722ed1', bgColor: '#f9f0ff', label: '执行命令' }
      case 'output':
        return { icon: <RobotOutlined />, color: '#1890ff', bgColor: '#e6f7ff', label: 'AI回复' }
      case 'text':
        return { icon: <RobotOutlined />, color: '#1890ff', bgColor: '#e6f7ff', label: 'AI回复' }
      case 'error':
        return { icon: <ExclamationCircleOutlined />, color: '#ff4d4f', bgColor: '#fff2f0', label: '错误' }
      case 'done':
        return { icon: <CheckCircleOutlined />, color: '#52c41a', bgColor: '#f6ffed', label: '完成' }
      case 'command_approval_request':
        return { icon: <WarningOutlined />, color: '#faad14', bgColor: '#fffbe6', label: '需要批准' }
      case 'command_approved':
        return { icon: <CheckCircleOutlined />, color: '#52c41a', bgColor: '#f6ffed', label: '命令已批准' }
      case 'command_rejected':
        return { icon: <WarningOutlined />, color: '#faad14', bgColor: '#fffbe6', label: '命令已拒绝' }
      default:
        return { icon: <RobotOutlined />, color: '#8c8c8c', bgColor: '#fafafa', label: '其他' }
    }
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return ''
    }
  }

  // 🔥 合并连续的output类型数据
  const mergeOutputs = (data: StreamData[]): StreamData[] => {
    const merged: StreamData[] = []
    let currentOutputContent: string[] = []

    for (let i = 0; i < data.length; i++) {
      const item = data[i]

      if (item.type === 'output') {
        // 累积output内容
        if (item.content && !item.metadata?.isOutputStart) {
          currentOutputContent.push(item.content)
        }

        // 检查下一项是否还是output
        const nextItem = data[i + 1]
        if (!nextItem || nextItem.type !== 'output') {
          // 下一项不是output，合并当前累积的内容
          if (currentOutputContent.length > 0) {
            merged.push({
              type: 'output',
              content: currentOutputContent.join('\n'),
              timestamp: item.timestamp,
              metadata: item.metadata
            })
            currentOutputContent = []
          }
        }
      } else {
        // 非output类型，直接添加
        merged.push(item)
      }
    }

    return merged
  }

  const mergedData = mergeOutputs(streamData)

  // 🔥 直接渲染，不需要复杂的合并逻辑
  const renderStreamGroup = (item: StreamData, itemIndex: number) => {
    const config = getTypeConfig(item.type)
    const isCommand = item.type === 'command'
    const isOutput = item.type === 'output'
    const isError = item.type === 'error'

    // 🔥 从item的metadata中提取批准信息
    const approvalMetadata = item.metadata

    return (
      <div key={itemIndex} className="mb-2">
        <div className="rounded border-l-4" style={{ borderLeftColor: config.color }}>
          {/* 简化的头部信息 */}
          <div className="flex items-center justify-between p-2">
            <Space size="small">
              <span style={{ color: config.color }}>{config.icon}</span>
              <Text strong className="text-sm">{config.label}</Text>

              {/* 🔧 在每个命令行显示工具类型标签 */}
              {isCommand && item.metadata?.toolType === 'custom' && item.metadata?.toolName && (
                <span className="inline-flex items-center px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
                  🛠️ {item.metadata.toolName}
                </span>
              )}
              {isCommand && item.metadata?.toolType === 'mcp' && item.metadata?.toolName && (
                <span className="inline-flex items-center px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400">
                  🔌 {item.metadata.toolName}
                </span>
              )}
            </Space>
            <Space size="small">
              {/* 🔥 批准/拒绝按钮放在右上角 */}
              {isCommand && approvalMetadata?.approvalId && !processingApprovals.has(approvalMetadata.approvalId) && (
                <>
                  <Button
                    type="text"
                    size="small"
                    loading={processingApprovals.has(approvalMetadata.approvalId)}
                    onClick={async () => {
                      if (!hostInfo) {
                        console.error('hostInfo未提供，无法批准命令')
                        return
                      }
                      const approvalId = approvalMetadata.approvalId
                      // 🔥 防止重复点击
                      if (processingApprovals.has(approvalId)) {
                        console.log('⏭️ 批准请求正在处理中，跳过:', approvalId)
                        return
                      }

                      setProcessingApprovals(prev => new Set(prev).add(approvalId))
                      try {
                        await approveCommand(hostInfo, approvalId)
                        console.log('✅ 批准成功:', approvalId)
                      } catch (error) {
                        console.error('批准命令失败:', error)
                        // 失败时移除处理标记，允许重试
                        setProcessingApprovals(prev => {
                          const next = new Set(prev)
                          next.delete(approvalId)
                          return next
                        })
                      }
                    }}
                    className="approval-btn-approve"
                  >
                    批准
                  </Button>
                  <Button
                    type="text"
                    danger
                    size="small"
                    loading={processingApprovals.has(approvalMetadata.approvalId)}
                    onClick={async () => {
                      if (!hostInfo) {
                        console.error('hostInfo未提供，无法拒绝命令')
                        return
                      }
                      const approvalId = approvalMetadata.approvalId
                      // 🔥 防止重复点击
                      if (processingApprovals.has(approvalId)) {
                        console.log('⏭️ 拒绝请求正在处理中，跳过:', approvalId)
                        return
                      }

                      setProcessingApprovals(prev => new Set(prev).add(approvalId))
                      try {
                        await rejectCommand(hostInfo, approvalId, '用户拒绝执行')
                        console.log('✅ 拒绝成功:', approvalId)
                      } catch (error) {
                        console.error('拒绝命令失败:', error)
                        // 失败时移除处理标记，允许重试
                        setProcessingApprovals(prev => {
                          const next = new Set(prev)
                          next.delete(approvalId)
                          return next
                        })
                      }
                    }}
                    className="approval-btn-reject"
                  >
                    拒绝
                  </Button>
                </>
              )}
              {item.content && (
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(item.content, itemIndex)}
                  className="opacity-60 hover:opacity-100"
                />
              )}
            </Space>
          </div>

          {/* 简化的内容区域 */}
          {item.content && (
            <div className="px-2 pb-2">
              {isCommand ? (
                <div className="bg-gray-800 text-green-300 p-2 rounded text-sm font-mono">
                  $ {item.content}
                </div>
              ) : isOutput ? (
                // 🔥 命令输出使用灰色背景框，适应明暗主题，添加最大高度和滚动
                <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-200 max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap m-0 font-mono break-words">{item.content}</pre>
                </div>
              ) : isError ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                  <pre className="whitespace-pre-wrap m-0 break-words text-sm text-red-600 dark:text-red-400">{item.content}</pre>

                  {/* 检测是否是kubelet-wuhrai连接失败错误 */}
                  {(item.content.includes('kubelet-wuhrai') ||
                    item.content.includes('连接失败') ||
                    item.content.includes('Connection refused') ||
                    item.content.includes('ECONNREFUSED')) && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                      <div className="text-xs text-red-600 dark:text-red-400 mb-2">
                        💡 提示：请确保目标服务器已安装 kubelet-wuhrai
                      </div>

                      {/* 安装命令 */}
                      <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">安装命令：</div>
                        <code className="text-xs text-gray-800 dark:text-gray-200 block overflow-x-auto">
                          curl -fsSL https://www.wuhrai.com/download/v2.0.0/install-kubelet-wuhrai.sh | bash -s -- --port=2081
                        </code>
                      </div>

                      {/* 检查按钮 */}
                      {hostInfo && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => {
                            // 触发kubelet检查 - 需要传递checkKubeletWuhrai函数
                            const event = new CustomEvent('check-kubelet-status', {
                              detail: { serverId: (hostInfo as any).selectedServerId }
                            })
                            window.dispatchEvent(event)
                          }}
                          className="text-xs h-7"
                        >
                          检查服务状态
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // 🔥 其他AI回复内容也使用灰色背景框，添加最大高度和滚动
                <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg text-sm text-gray-800 dark:text-gray-200 max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap m-0 font-mono break-words">{item.content}</pre>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    )
  }

  return (
    <div className={`agent-stream-renderer ${className}`}>
      {/* 简化的控制栏 */}
      <div className="flex items-center justify-between mb-3 p-2 border-b">
        <Space>
          <RobotOutlined className="text-blue-500" />
          <Text strong className="text-sm">执行流程</Text>
          {isStreaming && <Text type="secondary" className="text-xs">执行中...</Text>}
          {/* 🔧 工具标签 - 根据工具类型显示不同标识 */}
          {customToolName && toolType === 'custom' && (
            <span className="inline-flex items-center px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400 font-medium">
              🛠️ 自定义工具: {customToolName}
            </span>
          )}
          {customToolName && toolType === 'mcp' && (
            <span className="inline-flex items-center px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400 font-medium">
              🔌 MCP工具: {customToolName}
            </span>
          )}
          {/* 系统工具不显示标签 */}
        </Space>
        <Space>
          {/* 🔥 步骤只计算command类型的数量 */}
          <Text type="secondary" className="text-xs">
            {mergedData.filter(item => item.type === 'command').length} 步骤
          </Text>
          <Button
            type="text"
            size="small"
            icon={showDetails ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowDetails(!showDetails)}
            className="opacity-60 hover:opacity-100"
          >
            {showDetails ? '折叠' : '展开'}
          </Button>
        </Space>
      </div>

      {/* 流式数据列表 - 根据showDetails控制显示 */}
      {showDetails && (
        <div className="space-y-1 max-h-80 overflow-y-auto">
        {mergedData.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Text type="secondary" className="text-sm">等待响应...</Text>
          </div>
        ) : (
          mergedData.map((item, index) => renderStreamGroup(item, index))
        )}

        {/* 简化的流式指示器 */}
        {isStreaming && (
          <div className="flex items-center justify-center py-2">
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse mr-2"></div>
            <Text type="secondary" className="text-xs">处理中...</Text>
          </div>
        )}

        <div ref={endRef} />
        </div>
      )}

      {/* 🔥 审批按钮样式 - 支持明暗主题 */}
      <style jsx global>{`
        /* 批准按钮样式 */
        .approval-btn-approve {
          color: #52c41a !important;
          background: rgba(82, 196, 26, 0.08) !important;
          border: 1px solid rgba(82, 196, 26, 0.25) !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }
        .approval-btn-approve:hover {
          background: rgba(82, 196, 26, 0.15) !important;
          border-color: rgba(82, 196, 26, 0.4) !important;
        }

        /* 拒绝按钮样式 */
        .approval-btn-reject {
          color: #ff4d4f !important;
          background: rgba(255, 77, 79, 0.08) !important;
          border: 1px solid rgba(255, 77, 79, 0.25) !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }
        .approval-btn-reject:hover {
          background: rgba(255, 77, 79, 0.15) !important;
          border-color: rgba(255, 77, 79, 0.4) !important;
        }

        /* 暗色主题下稍微调整透明度 */
        .dark .approval-btn-approve {
          background: rgba(82, 196, 26, 0.1) !important;
          border-color: rgba(82, 196, 26, 0.3) !important;
        }
        .dark .approval-btn-approve:hover {
          background: rgba(82, 196, 26, 0.2) !important;
          border-color: rgba(82, 196, 26, 0.5) !important;
        }

        .dark .approval-btn-reject {
          background: rgba(255, 77, 79, 0.1) !important;
          border-color: rgba(255, 77, 79, 0.3) !important;
        }
        .dark .approval-btn-reject:hover {
          background: rgba(255, 77, 79, 0.2) !important;
          border-color: rgba(255, 77, 79, 0.5) !important;
        }
      `}</style>
    </div>
  )
}

export default AgentStreamRenderer
