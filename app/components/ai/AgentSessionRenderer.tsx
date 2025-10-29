'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, Typography, Empty } from 'antd'
import {
  DownOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import { AgentSession, AgentStep } from '../../utils/agentOutputParser'
import AgentStepRenderer from './AgentStepRenderer'
import AgentProgressIndicator from './AgentProgressIndicator'

const { Text } = Typography

interface AgentSessionRendererProps {
  session: AgentSession
  isStreaming?: boolean
  autoScroll?: boolean
  showProgress?: boolean
  compactMode?: boolean
  isEmbedded?: boolean // 新增：是否嵌入在消息中
  className?: string
  onStepClick?: (step: AgentStep) => void
}

const AgentSessionRenderer: React.FC<AgentSessionRendererProps> = ({
  session,
  isStreaming = false,
  autoScroll = true,
  showProgress = true,
  compactMode = false,
  isEmbedded = false,
  className = '',
  onStepClick
}) => {
  // 状态管理 - 简化为嵌入模式
  const [isProgressVisible, setIsProgressVisible] = useState(showProgress)
  const [collapsedSteps, setCollapsedSteps] = useState<Set<string>>(new Set())

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  // 当前步骤索引
  const currentStepIndex = useMemo(() => {
    if (!session.currentStepId) return -1
    return session.steps.findIndex(step => step.id === session.currentStepId)
  }, [session.steps, session.currentStepId])

  // 自动滚动到最新步骤
  useEffect(() => {
    if (autoScroll && stepsContainerRef.current && !isStreaming) {
      // 只在非流式状态下滚动，避免干扰流式更新
      const container = stepsContainerRef.current
      const scrollToBottom = () => {
        container.scrollTop = container.scrollHeight
      }
      
      // 使用requestAnimationFrame确保DOM更新完成后滚动
      requestAnimationFrame(scrollToBottom)
    }
  }, [session.steps.length, autoScroll, isStreaming])

  // 处理步骤折叠
  const handleStepToggleCollapse = useCallback((stepId: string) => {
    setCollapsedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }, [])

  // 渲染空状态
  if (session.steps.length === 0) {
    return (
      <div className={`agent-session-empty ${className}`}>
        <Card className="empty-card">
          <Empty
            image={<PlayCircleOutlined className="text-4xl text-gray-500" />}
            description={
              <div className="text-center">
                <Text type="secondary">等待AI代理开始执行任务</Text>
                <br />
                <Text type="secondary" className="text-xs">
                  代理将逐步分析问题、执行命令并提供结果
                </Text>
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div 
      className={`agent-session-renderer ${className}`}
      ref={containerRef}
    >
      {/* 进度指示器 - 仅在嵌入模式下简化显示 */}
      {isProgressVisible && !isEmbedded && (
        <div className="mb-4">
          <AgentProgressIndicator
            session={session}
            showDetailedStats={!compactMode}
            showTimeline={false}
          />
        </div>
      )}

      {/* 嵌入模式的简化进度 */}
      {isEmbedded && isProgressVisible && (
        <div className="mb-3">
          <AgentProgressIndicator
            session={session}
            showDetailedStats={false}
            showTimeline={false}
            className="embedded-progress"
          />
        </div>
      )}

      {/* 步骤列表 */}
      <div 
        className={`steps-container ${compactMode ? 'compact-mode' : ''}`}
        ref={stepsContainerRef}
      >
        <div className="steps-list space-y-3">
          {session.steps.map((step, index) => (
            <div key={step.id} className="step-wrapper">
              <AgentStepRenderer
                step={step}
                stepIndex={index + 1}
                isCurrentStep={step.id === session.currentStepId}
                isCollapsed={collapsedSteps.has(step.id)}
                onToggleCollapse={() => handleStepToggleCollapse(step.id)}
                className={compactMode ? 'compact-step' : ''}
              />
              
              {/* 步骤间连接线 */}
              {index < session.steps.length - 1 && (
                <div className="step-connector">
                  <div className="connector-line"></div>
                  <div className="connector-arrow">
                    <DownOutlined className="text-xs text-gray-500" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 流式加载指示器 */}
        {isStreaming && (
          <div className="streaming-indicator mt-4">
            <Card className="streaming-card" size="small">
              <div className="flex items-center justify-center space-x-3 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <Text className="text-blue-400 text-sm">AI代理正在处理中...</Text>
              </div>
            </Card>
          </div>
        )}
      </div>

      <style jsx>{`
        .agent-session-renderer {
          transition: all 0.3s ease;
        }

        .steps-container {
          max-height: 600px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
        }

        .steps-container.compact-mode {
          max-height: 400px;
        }

        .embedded-progress {
          transform: scale(0.95);
        }

        .steps-container::-webkit-scrollbar {
          width: 6px;
        }

        .steps-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .steps-container::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.5);
          border-radius: 3px;
        }

        .steps-container::-webkit-scrollbar-thumb:hover {
          background: rgba(75, 85, 99, 0.7);
        }

        .step-connector {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 8px 0;
          position: relative;
        }

        .connector-line {
          width: 2px;
          height: 20px;
          background: linear-gradient(to bottom, rgba(75, 85, 99, 0.3), rgba(75, 85, 99, 0.1));
          margin-bottom: 4px;
        }

        .connector-arrow {
          position: absolute;
          bottom: -2px;
        }

        .streaming-card {
          background: rgba(30, 64, 175, 0.1) !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
          border-radius: 8px;
        }

        .empty-card {
          background: rgba(31, 41, 55, 0.5) !important;
          border: 1px solid rgba(75, 85, 99, 0.3) !important;
          border-radius: 12px;
        }

        .compact-step {
          transform: scale(0.95);
          margin-bottom: -8px;
        }

        .session-float-buttons {
          position: fixed;
          right: 24px;
          bottom: 24px;
        }

        /* 动画效果 */
        .step-wrapper {
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* 暂停状态样式 */
        .steps-container.paused {
          filter: grayscale(0.3);
        }
      `}</style>
    </div>
  )
}

export default AgentSessionRenderer