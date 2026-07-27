'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, Tag, Typography, Button, Space, Tooltip, Switch, Collapse } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  ExpandAltOutlined,
  CompressOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  BranchesOutlined,
  BulbOutlined
} from '@ant-design/icons'
import { AgentSession, createAgentParser } from '../../utils/agentOutputParser'
import AgentSessionRenderer from './AgentSessionRenderer'
import EnhancedMarkdownRenderer from './EnhancedMarkdownRenderer'

const { Text } = Typography
const { Panel } = Collapse

// 🔥 解析<think>标签内容
interface ParsedContent {
  hasThinkTag: boolean
  thinkContent: string
  mainContent: string
  isThinkingComplete: boolean
}

interface EnhancedAIMessageRendererProps {
  content: string
  messageId: string
  isError?: boolean
  isRejected?: boolean
  isStreaming?: boolean
  isAgentMode?: boolean
  agentSession?: AgentSession | null
  metadata?: {
    model?: string
    provider?: string
    execution_time?: string
    tools_used?: string[]
    model_used?: string
    hostId?: string
    hostName?: string
    executionMode?: string
    isThinking?: boolean
  }
  className?: string
  onAgentModeToggle?: (enabled: boolean) => void
}

// 🔥 解析<think>标签的函数
const parseThinkTags = (content: string, isStreaming: boolean): ParsedContent => {
  const thinkTagRegex = /<think>([\s\S]*?)(<\/think>|$)/gi
  const matches = Array.from(content.matchAll(thinkTagRegex))

  if (matches.length === 0) {
    return {
      hasThinkTag: false,
      thinkContent: '',
      mainContent: content,
      isThinkingComplete: false
    }
  }

  // 提取所有think内容
  let thinkContent = ''
  matches.forEach(match => {
    thinkContent += match[1]
  })

  // 移除<think>标签及其内容，得到主要内容
  const mainContent = content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()

  // 🔥 检查思考是否完成 - 必须有闭合标签</think>才算完成
  // 只有当明确检测到</think>闭合标签时才认为思考完成
  const hasClosingTag = matches.some(match => match[2] === '</think>')

  // 🔥 思考完成的条件：
  // 1. 有闭合标签</think>
  // 2. 或者流式传输已结束(!isStreaming)且有主要内容输出(说明思考已经结束开始输出正文了)
  const isThinkingComplete = hasClosingTag || (!isStreaming && mainContent.length > 0)

  return {
    hasThinkTag: true,
    thinkContent: thinkContent.trim(),
    mainContent,
    isThinkingComplete
  }
}

const EnhancedAIMessageRenderer: React.FC<EnhancedAIMessageRendererProps> = ({
  content,
  messageId,
  isError = false,
  isRejected = false,
  isStreaming = false,
  isAgentMode = false,
  agentSession,
  metadata,
  className = '',
  onAgentModeToggle
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const [localAgentMode, setLocalAgentMode] = useState(isAgentMode)
  const [localAgentSession, setLocalAgentSession] = useState<AgentSession | null>(agentSession || null)

  // 🔥 解析<think>标签内容
  const parsedContent = useMemo(() => parseThinkTags(content, isStreaming), [content, isStreaming])

  // 🔥 思考区域折叠状态 - 默认展开，思考完成后自动折叠
  const [isThinkCollapsed, setIsThinkCollapsed] = useState(false)
  // 记录是否已经触发过自动折叠
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false)

  // 🔥 当思考完成时自动折叠
  useEffect(() => {
    // 只有在: 1.有think标签 2.思考已完成 3.还没触发过自动折叠 时才触发
    if (parsedContent.hasThinkTag && parsedContent.isThinkingComplete && !hasAutoCollapsed) {
      // 延迟500ms自动折叠,让用户看到完整的思考过程
      const timer = setTimeout(() => {
        setIsThinkCollapsed(true)
        setHasAutoCollapsed(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [parsedContent.hasThinkTag, parsedContent.isThinkingComplete, hasAutoCollapsed])

  // 如果没有提供代理会话但开启了代理模式，创建一个本地解析器
  const localParser = useMemo(() => {
    if (localAgentMode && !agentSession && content && content !== '__LOADING_ANIMATION__') {
      const parser = createAgentParser(messageId)
      parser.parseContent(content)
      return parser
    }
    return null
  }, [localAgentMode, agentSession, content, messageId])

  // 更新本地代理会话
  useEffect(() => {
    if (localAgentMode) {
      if (agentSession) {
        // 使用外部提供的代理会话
        const updatedSession = { ...agentSession }
        
        // 同步流式状态 - 但只有在真正需要时才更新
        if (isStreaming) {
          if (updatedSession.status !== 'executing') {
            updatedSession.status = 'executing'
          }
        } else {
          // 消息完成，确保状态正确
          if (updatedSession.status === 'executing' || updatedSession.status === 'idle' || updatedSession.status === 'thinking') {
            updatedSession.status = isError ? 'failed' : 'completed'
            // 确保所有步骤状态正确
            updatedSession.steps.forEach(step => {
              if (step.status === 'in_progress' || step.status === 'pending') {
                step.status = isError ? 'failed' : 'completed'
              }
            })
            // 重新计算进度
            const completedSteps = updatedSession.steps.filter(s => s.status === 'completed' || s.status === 'failed').length
            updatedSession.progress = updatedSession.steps.length > 0 ? (completedSteps / updatedSession.steps.length) * 100 : 0
          }
        }
        
        setLocalAgentSession(updatedSession)
      } else if (localParser) {
        // 使用本地解析器
        const session = localParser.getSession()
        
        // 根据isStreaming状态同步会话状态
        if (isStreaming) {
          session.status = 'executing'
          // 设置最后一个步骤为进行中
          if (session.steps.length > 0) {
            const lastStep = session.steps[session.steps.length - 1]
            lastStep.status = 'in_progress'
            session.currentStepId = lastStep.id
          }
        } else {
          // 消息已完成，设置正确的最终状态
          session.status = isError ? 'failed' : 'completed'
          session.steps.forEach(step => {
            if (step.status === 'in_progress' || step.status === 'pending') {
              step.status = isError ? 'failed' : 'completed'
            }
          })
          // 确保进度是100%
          const completedSteps = session.steps.filter(s => s.status === 'completed' || s.status === 'failed').length
          session.progress = session.steps.length > 0 ? (completedSteps / session.steps.length) * 100 : 100
        }
        
        setLocalAgentSession({ ...session })
      }
    } else {
      // 非代理模式，清空会话
      setLocalAgentSession(null)
    }
  }, [localAgentMode, agentSession, localParser, isStreaming, isError])

  // 清理传统模式内容，移除重复的远程执行信息
  const cleanTraditionalContent = (content: string) => {
    if (!content || localAgentMode) return content
    
    // 移除ANSI转义字符
    let cleanedContent = content.replace(/\x1b\[[0-9;]*m/g, '')
    
    // 移除重复的远程执行标记，支持IP地址和服务器名称
    cleanedContent = cleanedContent.replace(/🌐\s*\[远程执行@[^\]]+\]\s*/g, '')
    
    // 移除重复的Running信息
    cleanedContent = cleanedContent.replace(/Running:\s*[^\n]+\s*/g, '')
    
    // 移除多余的换行符
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    return cleanedContent.trim()
  }

  // 代理模式切换功能已删除

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

  // 解析执行结果类型
  const getExecutionStatus = () => {
    if (isRejected) {
      return {
        status: 'rejected',
        color: 'orange',
        icon: <ExclamationCircleOutlined />,
        text: '已拒绝'
      }
    }

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

  // 代理模式检测功能已删除

  // 如果是思考状态或内容为空，不显示背景框
  if (metadata?.isThinking || content === '🤔 AI正在思考中...' || !content || content.trim() === '' || content === '__LOADING_ANIMATION__') {
    return null // 不显示任何内容
  }

  return (
    <div className={`enhanced-ai-message-container ${className}`}>
      <Card
        className={`ai-message-card ${isError ? 'error-card' : isRejected ? 'warning-card' : 'success-card'}`}
        size="small"
        styles={{
          body: {
            padding: '16px',
            background: 'transparent'
          }
        }}
        bordered={false}
      >
        {/* 消息头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* AI助手标识 */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isError ? 'bg-red-500/20' : 'bg-blue-500/20'
            }`}>
              <RobotOutlined className={`text-sm ${
                isError ? 'text-red-400' : 'text-blue-400'
              }`} />
            </div>
            <div>
              <Text className="text-gray-200 font-medium">AI助手回复</Text>
              {localAgentMode && (
                <Tag color="purple" className="ml-2 text-xs">
                  <BranchesOutlined className="mr-1" />
                  代理模式
                </Tag>
              )}
            </div>
            <Tag 
              color={executionStatus.color} 
              icon={executionStatus.icon}
              className="text-xs"
            >
              {executionStatus.text}
            </Tag>
          </div>
          
          <Space size="small">
            {/* 代理模式切换功能已删除 */}

            {/* 执行时间 */}
            {metadata?.execution_time && (
              <Tooltip title="执行时间">
                <Tag icon={<ClockCircleOutlined />} color="blue" className="text-xs">
                  {metadata.execution_time}
                </Tag>
              </Tooltip>
            )}
            
            {/* 远程执行标识 */}
            {metadata?.executionMode === 'remote' && metadata?.hostName && (
              <Tooltip title="远程执行">
                <Tag icon={<ThunderboltOutlined />} color="purple" className="text-xs">
                  {metadata.hostName}
                </Tag>
              </Tooltip>
            )}
            
            {/* 复制按钮 */}
            <Tooltip title={copied ? '已复制' : '复制内容'}>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                className={`text-gray-400 hover:text-gray-200 ${copied ? 'text-green-400' : ''}`}
              />
            </Tooltip>
            
            {/* 展开/收起按钮 */}
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
        {isExpanded && (
          <div className="ai-message-content">
            <div className="message-content-container">
              {/* 代理模式渲染 */}
                  {localAgentMode && localAgentSession ? (
                    <div className="agent-mode-content">
                      <AgentSessionRenderer
                        session={localAgentSession}
                        isStreaming={isStreaming}
                        showProgress={true}
                        compactMode={false}
                        isEmbedded={true}
                        autoScroll={true}
                        className="agent-session-in-message"
                      />
                    </div>
                  ) : (
                    /* 传统模式渲染 */
                    <div className="traditional-mode-content">
                      {/* 🔥 思考区域渲染 */}
                      {parsedContent.hasThinkTag && parsedContent.thinkContent && (
                        <div className="think-section mb-4">
                          <Collapse
                            activeKey={isThinkCollapsed ? [] : ['think']}
                            onChange={(keys) => setIsThinkCollapsed(keys.length === 0)}
                            className="think-collapse"
                            expandIconPosition="end"
                          >
                            <Panel
                              header={
                                <div className="flex items-center space-x-2">
                                  <BulbOutlined className="text-gray-400" />
                                  <Text className="font-medium" style={{ color: 'inherit' }}>
                                    AI思考过程
                                  </Text>
                                  {parsedContent.isThinkingComplete ? (
                                    <Tag color="default" className="text-xs">已完成</Tag>
                                  ) : (
                                    <Tag color="processing" className="text-xs">思考中...</Tag>
                                  )}
                                </div>
                              }
                              key="think"
                            >
                              <div className="think-content">
                                <EnhancedMarkdownRenderer
                                  content={parsedContent.thinkContent}
                                  className="think-markdown"
                                  isStreaming={!parsedContent.isThinkingComplete && isStreaming}
                                />
                              </div>
                            </Panel>
                          </Collapse>
                        </div>
                      )}

                      {/* 主要内容渲染 */}
                      {parsedContent.mainContent && (
                        <EnhancedMarkdownRenderer
                          content={cleanTraditionalContent(parsedContent.mainContent)}
                          className="enhanced-ai-content"
                          isStreaming={parsedContent.isThinkingComplete ? isStreaming : false}
                        />
                      )}
                    </div>
                  )}
            </div>
          </div>
        )}
      </Card>

      <style jsx>{`


        .ai-message-card {
          border: 1px solid rgba(24, 144, 255, 0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          backdrop-filter: blur(8px) !important;
          background: rgba(24, 144, 255, 0.08) !important;
        }

        .ai-message-card.error-card {
          border-color: rgba(239, 68, 68, 0.3) !important;
          background: rgba(239, 68, 68, 0.08) !important;
        }

        .ai-message-card.success-card {
          border-color: rgba(24, 144, 255, 0.2) !important;
          background: rgba(24, 144, 255, 0.08) !important;
        }

        /* 🔥 思考区域样式 - 更淡的颜色,符合界面风格 */
        .think-section :global(.think-collapse) {
          background: rgba(148, 163, 184, 0.05) !important;
          border: 1px solid rgba(148, 163, 184, 0.15) !important;
          border-radius: 8px !important;
          overflow: hidden;
        }

        .think-section :global(.think-collapse .ant-collapse-item) {
          border-bottom: none !important;
        }

        .think-section :global(.think-collapse .ant-collapse-header) {
          background: rgba(148, 163, 184, 0.08) !important;
          border-radius: 0 !important;
          padding: 10px 14px !important;
          color: inherit !important;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .think-section :global(.think-collapse .ant-collapse-header:hover) {
          background: rgba(148, 163, 184, 0.12) !important;
        }

        .think-section :global(.think-collapse .ant-collapse-content) {
          background: rgba(148, 163, 184, 0.03) !important;
          border-top: 1px solid rgba(148, 163, 184, 0.1) !important;
        }

        .think-section :global(.think-collapse .ant-collapse-content-box) {
          padding: 12px 14px !important;
        }

        .think-content {
          max-height: 400px;
          overflow-y: auto;
          font-size: 13px;
          line-height: 1.6;
        }

        .think-content::-webkit-scrollbar {
          width: 6px;
        }

        .think-content::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.3);
          border-radius: 3px;
        }

        .think-content::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 3px;
        }

        .think-content::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.7);
        }

        .agent-session-in-message .session-controls {
          display: none;
        }

        .agent-session-in-message .steps-container {
          max-height: 600px;
          border: 1px solid rgba(75, 85, 99, 0.2);
          border-radius: 8px;
          background: rgba(17, 24, 39, 0.3);
        }

        .message-content-container {
          transition: all 0.3s ease;
        }

        .agent-mode-content,
        .traditional-mode-content {
          background: transparent;
          border-radius: 8px;
          padding: 12px;
          border: none;
          min-height: 100px;
          transition: all 0.3s ease;
          position: relative;
        }

        .agent-mode-content::before,
        .traditional-mode-content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: transparent;
          border-radius: 8px;
          transition: all 0.3s ease;
          z-index: -1;
        }
      `}</style>
    </div>
  )
}

export default EnhancedAIMessageRenderer
