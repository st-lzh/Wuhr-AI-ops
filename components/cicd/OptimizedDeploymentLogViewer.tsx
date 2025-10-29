import React, { useState, useEffect, useRef } from 'react'
import { Modal, Card, Typography, Button, Space, Tag, Spin, Progress, Timeline } from 'antd'
import { 
  ReloadOutlined, 
  DownloadOutlined, 
  CloseOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography

interface OptimizedDeploymentLogViewerProps {
  visible: boolean
  onClose: () => void
  deploymentId: string
  deploymentName: string
  isJenkinsDeployment?: boolean // 是否为Jenkins部署任务
  jenkinsJobId?: string // Jenkins任务ID
  jenkinsBuildNumber?: number // Jenkins构建号
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'error' | 'warning' | 'success' | 'command'
  message: string
  stage?: string
  isCommand?: boolean
}

interface DeploymentStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: string
  endTime?: string
  duration?: number
}

const OptimizedDeploymentLogViewer: React.FC<OptimizedDeploymentLogViewerProps> = ({
  visible,
  onClose,
  deploymentId,
  deploymentName
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [status, setStatus] = useState<string>('unknown')
  const [stages, setStages] = useState<DeploymentStage[]>([])
  const [progress, setProgress] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // 定义部署阶段
  const deploymentStages = [
    { key: 'init', name: '初始化部署', icon: <PlayCircleOutlined /> },
    { key: 'validate', name: '验证配置', icon: <CheckCircleOutlined /> },
    { key: 'execute', name: '执行脚本', icon: <PlayCircleOutlined /> },
    { key: 'complete', name: '部署完成', icon: <CheckCircleOutlined /> }
  ]

  // 解析日志条目
  const parseLogEntry = (logLine: string): LogEntry => {
    const timestampMatch = logLine.match(/^\[(.*?)\](.*)$/)
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString()
    const content = timestampMatch ? timestampMatch[2].trim() : logLine

    let level: LogEntry['level'] = 'info'
    let stage = ''
    let isCommand = false

    // 检测日志级别
    if (content.includes('❌') || content.includes('错误') || content.includes('失败')) {
      level = 'error'
    } else if (content.includes('⚠️') || content.includes('警告')) {
      level = 'warning'
    } else if (content.includes('✅') || content.includes('成功') || content.includes('完成')) {
      level = 'success'
    } else if (content.includes('🔧') || content.includes('执行命令')) {
      level = 'command'
      isCommand = true
    }

    // 提取阶段信息 - 匹配简化部署执行器的日志格式
    const stagePatterns = [
      { pattern: /🚀.*开始.*简化.*部署|🚀.*开始.*部署/, stage: '初始化部署' },
      { pattern: /📋.*部署任务|📝.*部署脚本.*验证|📋.*验证/, stage: '验证配置' },
      { pattern: /⚡.*开始.*执行.*部署.*脚本|🔧.*执行.*命令|🌐.*远程.*执行|🏠.*本地.*执行/, stage: '执行脚本' },
      { pattern: /🎉.*部署.*执行.*完成|🎉.*完成|✅.*命令.*执行.*成功/, stage: '部署完成' }
    ]

    for (const { pattern, stage: stageText } of stagePatterns) {
      if (pattern.test(content)) {
        stage = stageText
        break
      }
    }

    return {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      level,
      message: content,
      stage,
      isCommand
    }
  }

  // 更新部署阶段状态
  const updateStages = (logs: LogEntry[]) => {
    const newStages: DeploymentStage[] = deploymentStages.map(stage => ({
      name: stage.name,
      status: 'pending' as const
    }))

    let hasError = false
    const stageProgress: { [key: string]: { started: boolean; completed: boolean; timestamp: string } } = {}

    // 分析日志，确定每个阶段的状态
    logs.forEach(log => {
      // 只有明确的错误消息才标记为错误，排除警告和信息性消息
      if (log.level === 'error' &&
          (log.message.includes('失败') ||
           log.message.includes('错误') ||
           log.message.includes('异常') ||
           log.message.includes('Failed') ||
           log.message.includes('Error'))) {
        hasError = true
      }

      if (log.stage) {
        const stageName = log.stage
        if (!stageProgress[stageName]) {
          stageProgress[stageName] = { started: false, completed: false, timestamp: log.timestamp }
        }

        // 标记阶段开始
        if (!stageProgress[stageName].started) {
          stageProgress[stageName].started = true
          stageProgress[stageName].timestamp = log.timestamp
        }

        // 检查是否是完成标志
        if (log.level === 'success' ||
            log.message.includes('完成') ||
            log.message.includes('成功') ||
            log.message.includes('✅') ||
            log.message.includes('执行成功')) {
          stageProgress[stageName].completed = true
        }
      }
    })

    // 检查是否整体部署完成
    const isDeploymentComplete = logs.some(log =>
      log.message.includes('🎉 部署执行完成') ||
      log.message.includes('🎉 简化部署') ||
      (log.level === 'success' && log.message.includes('部署') && log.message.includes('完成'))
    )

    // 更新阶段状态
    deploymentStages.forEach((stage, index) => {
      const progress = stageProgress[stage.name]

      if (progress?.completed || (isDeploymentComplete && progress?.started)) {
        // 如果阶段已完成或整体部署完成且该阶段已开始，标记为完成
        newStages[index].status = 'completed'
        newStages[index].startTime = progress.timestamp
        newStages[index].endTime = progress.timestamp
      } else if (hasError && progress?.started) {
        // 只有在有错误且该阶段已开始时才标记为失败
        newStages[index].status = 'failed'
        newStages[index].startTime = progress.timestamp
      } else if (progress?.started) {
        // 阶段已开始但未完成
        newStages[index].status = 'running'
        newStages[index].startTime = progress.timestamp
      }
    })

    // 如果部署完成，确保所有已开始的阶段都标记为完成
    if (isDeploymentComplete && !hasError) {
      newStages.forEach((stage, index) => {
        if (stage.status === 'running' || (stageProgress[stage.name]?.started && stage.status === 'pending')) {
          newStages[index].status = 'completed'
          if (!newStages[index].endTime) {
            newStages[index].endTime = logs[logs.length - 1]?.timestamp
          }
        }
      })
    }

    setStages(newStages)

    // 计算进度 - 修复进度计算逻辑
    const completedStages = newStages.filter(s => s.status === 'completed').length
    const runningStages = newStages.filter(s => s.status === 'running').length
    const totalStages = newStages.length

    let progressPercent = 0
    if (isDeploymentComplete && !hasError) {
      progressPercent = 100
    } else {
      // 完成的阶段 + 运行中阶段的一半
      progressPercent = Math.round(((completedStages + runningStages * 0.5) / totalStages) * 100)
    }

    setProgress(progressPercent)
  }

  // 获取部署日志
  const fetchLogs = async () => {
    if (!deploymentId) return

    try {
      setLoading(true)

      // 使用新的日志API
      const response = await fetch(`/api/cicd/deployments/${deploymentId}/logs?follow=true&maxLines=1000`)
      const data = await response.json()

      if (data.success) {
        setStatus(data.data.deployment.status)

        if (data.data.logs) {
          const logLines = data.data.logs.split('\n').filter((line: string) => line.trim())
          const parsedLogs = logLines.map(parseLogEntry)
          setLogs(parsedLogs)
          updateStages(parsedLogs)

          // 更新进度（基于日志分析）
          if (data.data.analysis) {
            const analysis = data.data.analysis
            let progressPercent = 0

            if (data.data.deployment.status === 'success') {
              progressPercent = 100
            } else if (data.data.deployment.status === 'failed') {
              progressPercent = 100
            } else if (data.data.deployment.status === 'deploying') {
              // 基于主机部署进度计算
              if (analysis.hostResults && analysis.hostResults.length > 0) {
                const completedHosts = analysis.hostResults.filter((h: any) => h.status !== 'running').length
                progressPercent = Math.round((completedHosts / analysis.hostResults.length) * 100)
              } else {
                progressPercent = 30 // 默认进度
              }
            }

            setProgress(progressPercent)
          }

          // 自动滚动到底部（仅在启用自动滚动时）
          if (autoScroll) {
            setTimeout(() => {
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
              }
            }, 100)
          }
        }
      }
    } catch (error) {
      console.error('获取日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 自动刷新
  useEffect(() => {
    if (!visible || !autoRefresh) return

    const interval = setInterval(() => {
      if (status === 'deploying') {
        fetchLogs()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [visible, autoRefresh, status, deploymentId])

  // 初始加载
  useEffect(() => {
    if (visible && deploymentId) {
      fetchLogs()
    }
  }, [visible, deploymentId])

  // 处理滚动事件
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10

    // 如果用户手动滚动到非底部位置，停止自动滚动
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false)
    }
    // 如果用户滚动到底部，重新启用自动滚动
    else if (isAtBottom && !autoScroll) {
      setAutoScroll(true)
    }
  }

  // 获取日志条目样式（适配暗色主题）
  const getLogStyle = (entry: LogEntry) => {
    const baseStyle = {
      padding: '8px 12px',
      marginBottom: '4px',
      borderRadius: '6px',
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '13px',
      lineHeight: '1.5',
      borderLeft: '4px solid',
      transition: 'all 0.2s ease'
    }

    switch (entry.level) {
      case 'error':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(255, 77, 79, 0.1)',
          color: '#ff7875',
          borderLeftColor: '#ff4d4f',
          boxShadow: '0 2px 4px rgba(255, 77, 79, 0.1)'
        }
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(250, 173, 20, 0.1)',
          color: '#ffc53d',
          borderLeftColor: '#faad14',
          boxShadow: '0 2px 4px rgba(250, 173, 20, 0.1)'
        }
      case 'success':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(82, 196, 26, 0.1)',
          color: '#73d13d',
          borderLeftColor: '#52c41a',
          boxShadow: '0 2px 4px rgba(82, 196, 26, 0.1)'
        }
      case 'command':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(24, 144, 255, 0.1)',
          color: '#69c0ff',
          borderLeftColor: '#1890ff',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(24, 144, 255, 0.1)'
        }
      default:
        return {
          ...baseStyle,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          color: '#d9d9d9',
          borderLeftColor: '#434343'
        }
    }
  }

  // 获取状态标签
  const getStatusTag = () => {
    const statusConfig = {
      pending: { color: 'orange', text: '等待审批' },
      approved: { color: 'green', text: '已审批' },
      deploying: { color: 'processing', text: '部署中' },
      success: { color: 'success', text: '部署成功' },
      failed: { color: 'error', text: '部署失败' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 下载日志
  const downloadLogs = () => {
    const logContent = logs.map(entry => `[${entry.timestamp}] ${entry.message}`).join('\n')
    const blob = new Blob([logContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deployment-${deploymentId}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>部署日志 - {deploymentName}</Title>
            {getStatusTag()}
          </Space>
          <Progress 
            percent={progress} 
            size="small" 
            style={{ width: 200 }}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </div>
      }
      open={visible}
      onCancel={onClose}
      width="90%"
      style={{ top: 20 }}
      footer={
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchLogs}
            loading={loading}
          >
            刷新日志
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={downloadLogs}
            disabled={logs.length === 0}
          >
            下载日志
          </Button>
          <Button 
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
          </Button>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            关闭
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: '16px', height: '75vh' }}>
        {/* 左侧：阶段进度 */}
        <Card
          title="部署进度"
          size="small"
          style={{ width: '300px', height: '100%' }}
          styles={{ body: { padding: '16px' } }}
        >
          <Timeline>
            {stages.map((stage, index) => {
              const getIcon = () => {
                switch (stage.status) {
                  case 'completed':
                    return <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  case 'running':
                    return <PlayCircleOutlined style={{ color: '#1890ff' }} />
                  case 'failed':
                    return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  default:
                    return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
                }
              }

              return (
                <Timeline.Item key={index} dot={getIcon()}>
                  <div>
                    <Text strong={stage.status === 'running'}>{stage.name}</Text>
                    {stage.status === 'running' && (
                      <div style={{ marginTop: '4px' }}>
                        <Spin size="small" />
                        <Text type="secondary" style={{ marginLeft: '8px' }}>执行中...</Text>
                      </div>
                    )}
                    {stage.status === 'completed' && (
                      <div style={{ marginTop: '4px' }}>
                        <Text type="success">已完成</Text>
                      </div>
                    )}
                    {stage.status === 'failed' && (
                      <div style={{ marginTop: '4px' }}>
                        <Text type="danger">执行失败</Text>
                      </div>
                    )}
                  </div>
                </Timeline.Item>
              )
            })}
          </Timeline>
        </Card>

        {/* 右侧：日志详情 */}
        <Card
          title="执行日志"
          size="small"
          style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}
          styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column' } }}
        >
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              height: 'calc(100% - 40px)', // 减去Card标题的高度
              maxHeight: 'calc(75vh - 120px)', // 确保不超过视口高度
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '16px',
              backgroundColor: '#001529',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              scrollBehavior: 'smooth',
              border: '1px solid #303030',
              borderRadius: '4px'
            }}
          >
            {loading && logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px', color: '#fff' }}>加载日志中...</div>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: '#8c8c8c' }}>
                暂无日志数据
              </div>
            ) : (
              <div>
                {logs.map((entry, index) => (
                  <div key={index} style={getLogStyle(entry)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Text style={{ color: '#8c8c8c', fontSize: '11px', fontFamily: 'monospace' }}>
                        {entry.timestamp}
                      </Text>
                      {entry.stage && (
                        <Tag color="blue" style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>
                          {entry.stage}
                        </Tag>
                      )}
                      {entry.isCommand && (
                        <Tag color="cyan" style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>
                          命令
                        </Tag>
                      )}
                    </div>
                    <div style={{
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {entry.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Modal>
  )
}

export default OptimizedDeploymentLogViewer
