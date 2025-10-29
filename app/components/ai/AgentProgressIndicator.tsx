'use client'

import React, { useMemo } from 'react'
import { Card, Progress, Typography, Space, Tag, Statistic, Row, Col, Timeline, Avatar } from 'antd'
import {
  BulbOutlined,
  CodeOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  FireOutlined
} from '@ant-design/icons'
import { AgentSession, AgentStep } from '../../utils/agentOutputParser'

const { Text, Title } = Typography

interface AgentProgressIndicatorProps {
  session: AgentSession
  showDetailedStats?: boolean
  showTimeline?: boolean
  className?: string
}

const AgentProgressIndicator: React.FC<AgentProgressIndicatorProps> = ({
  session,
  showDetailedStats = true,
  showTimeline = false,
  className = ''
}) => {
  
  // 计算统计信息
  const stats = useMemo(() => {
    const steps = session.steps
    const total = steps.length
    const completed = steps.filter(s => s.status === 'completed').length
    const failed = steps.filter(s => s.status === 'failed').length
    const inProgress = steps.filter(s => s.status === 'in_progress').length
    const pending = steps.filter(s => s.status === 'pending').length

    // 按类型统计
    const byType = {
      thinking: steps.filter(s => s.type === 'thinking').length,
      command: steps.filter(s => s.type === 'command').length,
      output: steps.filter(s => s.type === 'output').length,
      analysis: steps.filter(s => s.type === 'analysis').length,
      result: steps.filter(s => s.type === 'result').length,
      error: steps.filter(s => s.type === 'error').length
    }

    // 计算执行时间
    const startTime = steps.length > 0 ? steps[0].timestamp : new Date()
    const endTime = session.status === 'completed' || session.status === 'failed' 
      ? (steps.length > 0 ? steps[steps.length - 1].timestamp : new Date())
      : new Date()
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)

    return {
      total,
      completed,
      failed,
      inProgress,
      pending,
      byType,
      duration,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }, [session.steps, session.status])

  // 获取会话状态配置
  const getSessionStatusConfig = (status: AgentSession['status']) => {
    switch (status) {
      case 'idle':
        return {
          color: 'default',
          icon: <ClockCircleOutlined />,
          text: '等待开始',
          progressColor: '#d9d9d9'
        }
      case 'thinking':
        return {
          color: 'processing',
          icon: <BulbOutlined />,
          text: '思考分析中',
          progressColor: '#faad14'
        }
      case 'executing':
        return {
          color: 'processing',
          icon: <LoadingOutlined spin />,
          text: '执行命令中',
          progressColor: '#1677ff'
        }
      case 'completed':
        return {
          color: 'success',
          icon: <CheckCircleOutlined />,
          text: '执行完成',
          progressColor: '#52c41a'
        }
      case 'failed':
        return {
          color: 'error',
          icon: <CloseCircleOutlined />,
          text: '执行失败',
          progressColor: '#ff4d4f'
        }
      default:
        return {
          color: 'default',
          icon: <PlayCircleOutlined />,
          text: '未知状态',
          progressColor: '#d9d9d9'
        }
    }
  }

  // 根据实际状态和进度确定显示状态
  const actualStatus = useMemo(() => {
    // 如果进度是100%且有步骤，应该显示为完成
    if (session.progress >= 100 && session.steps.length > 0) {
      const hasErrors = session.steps.some(step => step.status === 'failed')
      return hasErrors ? 'failed' : 'completed'
    }
    
    // 如果有步骤正在进行中，状态应该是执行中
    const hasInProgressSteps = session.steps.some(step => step.status === 'in_progress')
    if (hasInProgressSteps) {
      return 'executing'
    }
    
    // 如果所有步骤都完成（没有进行中的步骤），状态应该是完成
    if (session.steps.length > 0 && !hasInProgressSteps) {
      const hasErrors = session.steps.some(step => step.status === 'failed')
      const allCompleted = session.steps.every(step => step.status === 'completed' || step.status === 'failed')
      if (allCompleted) {
        return hasErrors ? 'failed' : 'completed'
      }
    }
    
    // 否则使用原始状态
    return session.status
  }, [session.status, session.progress, session.steps])

  const statusConfig = getSessionStatusConfig(actualStatus)

  // 生成时间线数据
  const timelineItems = useMemo(() => {
    return session.steps.map((step, index) => {
      const stepConfig = getStepTypeConfig(step.type)
      const statusIcon = step.status === 'completed' ? <CheckCircleOutlined /> : 
                        step.status === 'failed' ? <CloseCircleOutlined /> :
                        step.status === 'in_progress' ? <LoadingOutlined spin /> : 
                        <ClockCircleOutlined />

      return {
        color: stepConfig.color,
        dot: (
          <Avatar
            size="small"
            style={{ backgroundColor: stepConfig.bgColor }}
            icon={step.id === session.currentStepId ? statusIcon : stepConfig.icon}
          />
        ),
        children: (
          <div>
            <Text strong className="text-gray-200">
              {stepConfig.title}
            </Text>
            <br />
            <Text type="secondary" className="text-xs">
              {step.timestamp.toLocaleTimeString()}
            </Text>
            {step.metadata?.command && (
              <div className="mt-1">
                <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                  {step.metadata.command.substring(0, 40)}...
                </code>
              </div>
            )}
          </div>
        )
      }
    })
  }, [session.steps, session.currentStepId])

  function getStepTypeConfig(type: AgentStep['type']) {
    switch (type) {
      case 'thinking':
        return { icon: <BulbOutlined />, color: '#faad14', bgColor: '#fff1b8', title: '任务分析' }
      case 'command':
        return { icon: <CodeOutlined />, color: '#1677ff', bgColor: '#bae7ff', title: '执行命令' }
      case 'output':
        return { icon: <BarChartOutlined />, color: '#13c2c2', bgColor: '#b5f5ff', title: '实际结果' }
      case 'analysis':
        return { icon: <PlayCircleOutlined />, color: '#722ed1', bgColor: '#d3adf7', title: '状态分析' }
      case 'result':
        return { icon: <CheckCircleOutlined />, color: '#52c41a', bgColor: '#b7eb8f', title: '优化建议' }
      case 'error':
        return { icon: <CloseCircleOutlined />, color: '#ff4d4f', bgColor: '#ffb3b3', title: '执行错误' }
      default:
        return { icon: <PlayCircleOutlined />, color: '#d9d9d9', bgColor: '#f0f0f0', title: '处理中' }
    }
  }

  return (
    <div className={`agent-progress-container ${className}`}>
      <Card 
        className="progress-card"
        size="small"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}
      >
        {/* 主要进度显示 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {statusConfig.icon}
                <Title level={5} className="mb-0 text-gray-200">
                  智能代理执行状态
                </Title>
              </div>
              <Tag color={statusConfig.color} className="text-sm">
                {statusConfig.text}
              </Tag>
            </div>
            
            <div className="flex items-center space-x-4">
              <Text type="secondary" className="text-sm">
                会话ID: {session.id.slice(-8)}
              </Text>
              {stats.duration > 0 && (
                <Tag icon={<ClockCircleOutlined />} color="blue" className="text-xs">
                  {Math.floor(stats.duration / 60)}m {stats.duration % 60}s
                </Tag>
              )}
            </div>
          </div>

          {/* 主进度条 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <Text className="text-gray-300">总体进度</Text>
              <Text className="text-gray-300">
                {stats.completed}/{stats.total} 步骤
              </Text>
            </div>
            <Progress
              percent={session.progress}
              strokeColor={statusConfig.progressColor}
              trailColor="rgba(255, 255, 255, 0.1)"
              size="default"
              showInfo={false}
              className="custom-progress"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span className="font-medium">{Math.round(session.progress)}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* 快速统计 */}
          <Row gutter={16} className="mb-4">
            <Col span={6}>
              <Statistic
                title={<Text className="text-gray-400 text-xs">已完成</Text>}
                value={stats.completed}
                valueStyle={{ color: '#52c41a', fontSize: '18px' }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={<Text className="text-gray-400 text-xs">进行中</Text>}
                value={actualStatus === 'executing' || actualStatus === 'thinking' ? stats.inProgress : 0}
                valueStyle={{ 
                  color: (actualStatus === 'executing' || actualStatus === 'thinking') ? '#1677ff' : '#d9d9d9', 
                  fontSize: '18px' 
                }}
                prefix={(actualStatus === 'executing' || actualStatus === 'thinking') ? <LoadingOutlined spin /> : <ClockCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={<Text className="text-gray-400 text-xs">待处理</Text>}
                value={stats.pending}
                valueStyle={{ color: '#d9d9d9', fontSize: '18px' }}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={<Text className="text-gray-400 text-xs">成功率</Text>}
                value={stats.successRate}
                suffix="%"
                valueStyle={{ 
                  color: stats.successRate >= 80 ? '#52c41a' : stats.successRate >= 50 ? '#faad14' : '#ff4d4f',
                  fontSize: '18px'
                }}
                prefix={<FireOutlined />}
              />
            </Col>
          </Row>
        </div>

        {/* 详细统计 */}
        {showDetailedStats && (
          <div className="mb-4">
            <Text className="text-gray-300 block mb-3">步骤类型分布</Text>
            <Space wrap size="small">
              {stats.byType.thinking > 0 && (
                <Tag color="gold" className="text-xs">
                  <BulbOutlined className="mr-1" />
                  思考: {stats.byType.thinking}
                </Tag>
              )}
              {stats.byType.command > 0 && (
                <Tag color="blue" className="text-xs">
                  <CodeOutlined className="mr-1" />
                  命令: {stats.byType.command}
                </Tag>
              )}
              {stats.byType.output > 0 && (
                <Tag color="cyan" className="text-xs">
                  <BarChartOutlined className="mr-1" />
                  输出: {stats.byType.output}
                </Tag>
              )}
              {stats.byType.analysis > 0 && (
                <Tag color="purple" className="text-xs">
                  <PlayCircleOutlined className="mr-1" />
                  分析: {stats.byType.analysis}
                </Tag>
              )}
              {stats.byType.result > 0 && (
                <Tag color="green" className="text-xs">
                  <CheckCircleOutlined className="mr-1" />
                  结果: {stats.byType.result}
                </Tag>
              )}
              {stats.byType.error > 0 && (
                <Tag color="red" className="text-xs">
                  <CloseCircleOutlined className="mr-1" />
                  错误: {stats.byType.error}
                </Tag>
              )}
            </Space>
          </div>
        )}

        {/* 时间线视图 */}
        {showTimeline && timelineItems.length > 0 && (
          <div>
            <Text className="text-gray-300 block mb-3">执行时间线</Text>
            <div className="max-h-60 overflow-y-auto">
              <Timeline
                mode="left"
                items={timelineItems}
                className="custom-timeline"
              />
            </div>
          </div>
        )}
      </Card>

      <style jsx>{`
        .progress-card {
          border-radius: 12px !important;
          overflow: hidden;
        }

        .custom-progress .ant-progress-bg {
          transition: all 0.3s ease !important;
        }

        .custom-timeline .ant-timeline-item-content {
          color: rgba(255, 255, 255, 0.85) !important;
        }

        .custom-timeline .ant-timeline-item-tail {
          border-left-color: rgba(255, 255, 255, 0.2) !important;
        }
      `}</style>
    </div>
  )
}

export default AgentProgressIndicator