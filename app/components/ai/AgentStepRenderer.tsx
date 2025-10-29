'use client'

import React, { useState, useEffect } from 'react'
import { Card, Tag, Typography, Space, Button, Divider, Tooltip, Avatar } from 'antd'
import {
  BulbOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ToolOutlined,  // 🔧 新增工具图标
  WarningOutlined
} from '@ant-design/icons'
import { AgentStep } from '../../utils/agentOutputParser'
import EnhancedMarkdownRenderer from './EnhancedMarkdownRenderer'

const { Text, Paragraph } = Typography

interface AgentStepRendererProps {
  step: AgentStep
  stepIndex: number
  isCurrentStep: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  className?: string
}

const AgentStepRenderer: React.FC<AgentStepRendererProps> = ({
  step,
  stepIndex,
  isCurrentStep,
  isCollapsed = false,
  onToggleCollapse,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false) // 默认折叠
  const [animationClass, setAnimationClass] = useState('')

  // 🔧 识别工具类型
  const getToolType = (toolName: string | undefined): 'system' | 'custom' | 'mcp' | null => {
    if (!toolName) return null

    // 系统内置工具
    const systemTools = ['bash', 'kubectl', 'read', 'write', 'docker', 'git']
    if (systemTools.includes(toolName.toLowerCase())) {
      return 'system'
    }

    // MCP工具 (通常以mcp_开头或包含特定命名模式)
    if (toolName.startsWith('mcp_') || (step.metadata as any)?.toolType === 'mcp') {
      return 'mcp'
    }

    // 其他都是自定义工具
    return 'custom'
  }

  // 当成为当前步骤时，添加动画效果
  useEffect(() => {
    if (isCurrentStep) {
      setAnimationClass('animate-pulse-border')
      const timer = setTimeout(() => setAnimationClass(''), 2000)
      return () => clearTimeout(timer)
    }
  }, [isCurrentStep])

  // 获取步骤类型配置 - 规范为5个标准步骤
  const getStepConfig = (type: AgentStep['type']) => {
    switch (type) {
      case 'thinking':
        return {
          icon: <BulbOutlined />,
          color: 'gold',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          title: '任务分析',
          description: 'AI正在分析任务需求和制定执行策略'
        }
      case 'command':
        // 🔧 根据工具类型判断
        const toolType = getToolType(step.metadata?.toolName)
        const isCustomTool = toolType === 'custom'
        const isMCPTool = toolType === 'mcp'

        return {
          icon: (isCustomTool || isMCPTool) ? <ToolOutlined /> : <CodeOutlined />,
          color: isCustomTool ? 'gold' : (isMCPTool ? 'purple' : 'blue'),
          bgColor: isCustomTool ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/10' :
                   (isMCPTool ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/10' : 'bg-blue-500/10'),
          borderColor: isCustomTool ? 'border-yellow-500/50' :
                       (isMCPTool ? 'border-purple-500/50' : 'border-blue-500/30'),
          title: isCustomTool ? '🛠️ 自定义工具执行' :
                 (isMCPTool ? '🔌 MCP工具执行' : '执行命令'),
          description: isCustomTool ? `正在调用自定义工具: ${step.metadata?.toolName}` :
                       (isMCPTool ? `正在调用MCP工具: ${step.metadata?.toolName}` : '正在执行系统命令和操作')
        }
      case 'output':
        return {
          icon: <BarChartOutlined />,
          color: 'cyan',
          bgColor: 'bg-cyan-500/10',
          borderColor: 'border-cyan-500/30',
          title: '实际结果',
          description: '显示命令执行的实际输出结果'
        }
      case 'analysis':
        return {
          icon: <PlayCircleOutlined />,
          color: 'purple',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
          title: '状态分析',
          description: '分析执行结果和系统状态'
        }
      case 'result':
        return {
          icon: <CheckCircleOutlined />,
          color: 'green',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          title: '优化建议',
          description: '基于分析结果提供优化建议和后续步骤'
        }
      case 'error':
        return {
          icon: <CloseCircleOutlined />,
          color: 'red',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          title: '执行错误',
          description: '执行过程中出现错误'
        }
      default:
        return {
          icon: <PlayCircleOutlined />,
          color: 'default',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          title: '处理中',
          description: '正在处理'
        }
    }
  }

  // 获取状态配置
  const getStatusConfig = (status: AgentStep['status']) => {
    switch (status) {
      case 'pending':
        return {
          icon: <ClockCircleOutlined />,
          color: 'default',
          text: '等待中'
        }
      case 'in_progress':
        return {
          icon: <LoadingOutlined spin />,
          color: 'processing',
          text: '进行中'
        }
      case 'completed':
        return {
          icon: <CheckCircleOutlined />,
          color: 'success',
          text: '已完成'
        }
      case 'failed':
        return {
          icon: <CloseCircleOutlined />,
          color: 'error',
          text: '失败'
        }
      default:
        return {
          icon: <ClockCircleOutlined />,
          color: 'default',
          text: '未知'
        }
    }
  }

  const stepConfig = getStepConfig(step.type)
  const statusConfig = getStatusConfig(step.status)

  return (
    <div className={`agent-step-container ${className} ${animationClass}`}>
      <Card
        className={`agent-step-card ${stepConfig.bgColor} ${stepConfig.borderColor} ${
          isCurrentStep ? 'current-step' : ''
        }`}
        size="small"
        bordered={false}
      >
        {/* 步骤头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* 步骤编号 */}
            <div className={`step-number ${stepConfig.bgColor}`}>
              <Text className="text-sm font-mono font-bold">
                {stepIndex.toString().padStart(2, '0')}
              </Text>
            </div>

            {/* 步骤图标和类型 */}
            <div className="flex items-center space-x-2">
              <Avatar
                size="small"
                className={`step-avatar ${stepConfig.bgColor}`}
                icon={stepConfig.icon}
              />
              <div>
                <Text strong className="text-gray-200">
                  {stepConfig.title}
                </Text>
                <br />
                <Text type="secondary" className="text-xs">
                  {stepConfig.description}
                </Text>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 状态标签 */}
            <Tag
              color={statusConfig.color}
              icon={statusConfig.icon}
              className="text-xs"
            >
              {statusConfig.text}
            </Tag>

            {/* 时间戳 */}
            <Text type="secondary" className="text-xs">
              {step.timestamp.toLocaleTimeString()}
            </Text>

            {/* 展开/收起按钮 */}
            {onToggleCollapse && (
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => {
                  setIsExpanded(!isExpanded)
                  onToggleCollapse()
                }}
                className="text-gray-400 hover:text-gray-200"
              />
            )}
          </div>
        </div>

        {/* 特殊元数据显示 */}
        {step.metadata && isExpanded && (
          <div className="mb-3">
            <Space wrap size="small">
              {/* 🔧 根据工具类型显示不同标签 */}
              {step.metadata.toolName && (() => {
                const toolType = getToolType(step.metadata.toolName)
                if (toolType === 'custom') {
                  // 自定义工具 - 金色标签
                  return (
                    <Tag
                      color="gold"
                      className="text-xs font-mono font-semibold shadow-sm border-2 border-yellow-400/50"
                      icon={<ToolOutlined />}
                    >
                      🛠️ {step.metadata.toolName}
                    </Tag>
                  )
                } else if (toolType === 'mcp') {
                  // MCP工具 - 紫色标签
                  return (
                    <Tag
                      color="purple"
                      className="text-xs font-mono font-semibold shadow-sm border-2 border-purple-400/50"
                      icon={<ToolOutlined />}
                    >
                      🔌 MCP: {step.metadata.toolName}
                    </Tag>
                  )
                }
                // 系统工具 - 不显示标签
                return null
              })()}

              {step.metadata.command && (
                <Tag color="geekblue" className="text-xs font-mono">
                  <CodeOutlined className="mr-1" />
                  {step.metadata.command.length > 50
                    ? `${step.metadata.command.substring(0, 50)}...`
                    : step.metadata.command
                  }
                </Tag>
              )}

              {step.metadata.duration && (
                <Tag color="cyan" className="text-xs">
                  <ClockCircleOutlined className="mr-1" />
                  {step.metadata.duration}
                </Tag>
              )}
              
              {step.metadata.exitCode !== undefined && (
                <Tag 
                  color={step.metadata.exitCode === 0 ? 'success' : 'error'} 
                  className="text-xs"
                >
                  Exit: {step.metadata.exitCode}
                </Tag>
              )}
            </Space>
          </div>
        )}

        {/* 步骤内容 */}
        {isExpanded && (
          <div className="step-content">
            {/* 如果是思考过程，特殊渲染 */}
            {step.type === 'thinking' && step.metadata?.reasoning && (
              <div className="thinking-content bg-gray-800/40 border-l-4 border-yellow-400 pl-4 py-3 rounded-r">
                <div className="flex items-center mb-2">
                  <BulbOutlined className="text-yellow-400 mr-2" />
                  <Text className="text-yellow-200 font-medium">思考过程</Text>
                </div>
                <EnhancedMarkdownRenderer
                  content={step.metadata.reasoning}
                  className="text-gray-300 text-sm"
                />
              </div>
            )}

            {/* 如果是命令，特殊渲染 */}
            {step.type === 'command' && step.metadata?.command && (
              <div className="command-content bg-gray-800/60 border-l-4 border-blue-400 pl-4 py-3 rounded-r">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {/* 🔧 工具标识 - 根据工具类型显示 */}
                    {step.metadata?.toolName && (() => {
                      const toolType = getToolType(step.metadata.toolName)
                      if (toolType === 'custom') {
                        return (
                          <Tooltip title={`使用自定义工具: ${step.metadata.toolName}`}>
                            <Tag
                              color="gold"
                              icon={<ToolOutlined />}
                              className="mr-2 font-semibold border-2 border-yellow-400/50"
                            >
                              🛠️ {step.metadata.toolName}
                            </Tag>
                          </Tooltip>
                        )
                      } else if (toolType === 'mcp') {
                        return (
                          <Tooltip title={`使用MCP工具: ${step.metadata.toolName}`}>
                            <Tag
                              color="purple"
                              icon={<ToolOutlined />}
                              className="mr-2 font-semibold border-2 border-purple-400/50"
                            >
                              🔌 MCP: {step.metadata.toolName}
                            </Tag>
                          </Tooltip>
                        )
                      }
                      return null
                    })()}
                    <CodeOutlined className="text-blue-400 mr-2" />
                    <Text className="text-blue-200 font-medium">执行命令</Text>
                  </div>
                </div>
                <code className="block bg-black/30 px-3 py-2 rounded text-green-400 font-mono text-sm">
                  {step.metadata.command}
                </code>
              </div>
            )}

            {/* 如果是分析，特殊渲染 */}
            {step.type === 'analysis' && (
              <div className="analysis-content">
                {step.metadata?.reasoning && (
                  <div className="mb-3 bg-purple-500/10 border-l-4 border-purple-400 pl-4 py-3 rounded-r">
                    <div className="flex items-center mb-2">
                      <BarChartOutlined className="text-purple-400 mr-2" />
                      <Text className="text-purple-200 font-medium">分析过程</Text>
                    </div>
                    <EnhancedMarkdownRenderer
                      content={step.metadata.reasoning}
                      className="text-gray-300 text-sm"
                    />
                  </div>
                )}
                
                {step.metadata?.conclusion && (
                  <div className="bg-green-500/10 border-l-4 border-green-400 pl-4 py-3 rounded-r">
                    <div className="flex items-center mb-2">
                      <CheckCircleOutlined className="text-green-400 mr-2" />
                      <Text className="text-green-200 font-medium">分析结论</Text>
                    </div>
                    <EnhancedMarkdownRenderer
                      content={step.metadata.conclusion}
                      className="text-gray-300 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 默认内容渲染 */}
            {!['thinking', 'command', 'analysis'].includes(step.type) && (
              <div className="default-content">
                {step.type === 'output' && (
                  <div className="output-content bg-gray-900/50 border border-gray-600 rounded p-3">
                    <div className="flex items-center mb-2">
                      <BarChartOutlined className="text-cyan-400 mr-2" />
                      <Text className="text-cyan-200 font-medium">输出结果</Text>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 overflow-x-auto">
                      {step.content}
                    </pre>
                  </div>
                )}
                
                {step.type === 'error' && (
                  <div className="error-content bg-red-500/10 border-l-4 border-red-400 pl-4 py-3 rounded-r">
                    <div className="flex items-center mb-2">
                      <WarningOutlined className="text-red-400 mr-2" />
                      <Text className="text-red-200 font-medium">错误信息</Text>
                    </div>
                    <EnhancedMarkdownRenderer
                      content={step.content}
                      className="text-red-300 text-sm"
                    />
                  </div>
                )}
                
                {['result'].includes(step.type) && (
                  <div className="result-content">
                    <EnhancedMarkdownRenderer
                      content={step.content}
                      className="text-gray-300"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <style jsx>{`
        .agent-step-card {
          border: 1px solid rgba(75, 85, 99, 0.3) !important;
          border-radius: 8px !important;
          backdrop-filter: blur(4px) !important;
          transition: all 0.3s ease !important;
        }

        .agent-step-card.current-step {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3) !important;
          transform: translateY(-2px) !important;
        }

        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out;
        }

        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(75, 85, 99, 0.3);
        }

        .step-avatar {
          border: 1px solid rgba(75, 85, 99, 0.3) !important;
        }

        .step-content {
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .command-content code {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .output-content pre {
          max-height: 300px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  )
}

export default AgentStepRenderer