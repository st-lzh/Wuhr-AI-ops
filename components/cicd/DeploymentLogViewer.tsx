import React, { useState, useEffect, useRef } from 'react'
import { Modal, Card, Typography, Button, Space, Tag, Spin } from 'antd'
import { 
  ReloadOutlined, 
  DownloadOutlined, 
  FullscreenOutlined,
  CloseOutlined 
} from '@ant-design/icons'

const { Text } = Typography

interface DeploymentLogViewerProps {
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
  level: 'info' | 'error' | 'warning' | 'success'
  message: string
  stage?: string
}

const DeploymentLogViewer: React.FC<DeploymentLogViewerProps> = ({
  visible,
  onClose,
  deploymentId,
  deploymentName,
  isJenkinsDeployment = false,
  jenkinsJobId,
  jenkinsBuildNumber
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [status, setStatus] = useState<string>('unknown')
  const logContainerRef = useRef<HTMLDivElement>(null)

  // 解析日志条目
  const parseLogEntry = (logLine: string): LogEntry => {
    const timestamp = new Date().toLocaleTimeString()
    
    // 检测日志级别和阶段
    let level: LogEntry['level'] = 'info'
    let stage = ''
    
    if (logLine.includes('❌') || logLine.includes('错误') || logLine.includes('失败')) {
      level = 'error'
    } else if (logLine.includes('⚠️') || logLine.includes('警告')) {
      level = 'warning'
    } else if (logLine.includes('✅') || logLine.includes('成功') || logLine.includes('完成')) {
      level = 'success'
    }
    
    // 提取阶段信息
    const stagePatterns = [
      { pattern: /🚀.*开始.*部署/, stage: '初始化部署' },
      { pattern: /📁.*准备.*目录/, stage: '准备环境' },
      { pattern: /📥.*拉取.*代码/, stage: '拉取代码' },
      { pattern: /🔨.*构建/, stage: '本地构建' },
      { pattern: /🚀.*远程.*部署/, stage: '远程部署' },
      { pattern: /📡.*主机/, stage: '连接主机' },
      { pattern: /📤.*传输/, stage: '文件传输' },
      { pattern: /🔧.*执行.*脚本/, stage: '执行脚本' },
      { pattern: /🔍.*验证/, stage: '验证结果' },
      { pattern: /🧹.*清理/, stage: '清理环境' },
      { pattern: /🎉.*完成/, stage: '部署完成' }
    ]
    
    for (const { pattern, stage: stageText } of stagePatterns) {
      if (pattern.test(logLine)) {
        stage = stageText
        break
      }
    }
    
    return {
      timestamp,
      level,
      message: logLine,
      stage
    }
  }

  // 解析Jenkins日志条目
  const parseJenkinsLogEntry = (line: string, index: number): LogEntry => {
    // Jenkins日志格式通常是纯文本，需要特殊处理
    let level: LogEntry['level'] = 'info'
    let stage: string | undefined = undefined

    // 检查Jenkins特有的日志模式
    if (line.includes('[Pipeline]') || line.includes('Started by')) {
      level = 'info'
      stage = 'Pipeline'
    } else if (line.includes('Finished:')) {
      if (line.includes('SUCCESS')) {
        level = 'success'
        stage = 'Complete'
      } else if (line.includes('FAILURE') || line.includes('ABORTED')) {
        level = 'error'
        stage = 'Complete'
      }
    } else if (line.includes('ERROR') || line.includes('FAILED') || line.includes('Exception')) {
      level = 'error'
    } else if (line.includes('WARNING') || line.includes('WARN')) {
      level = 'warning'
    } else if (line.includes('BUILD SUCCESSFUL') || line.includes('SUCCESS')) {
      level = 'success'
    }

    // 尝试提取时间戳（Jenkins日志可能没有标准时间戳）
    const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2})/)
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toLocaleTimeString()

    return {
      timestamp,
      level,
      message: line,
      stage
    }
  }

  // 获取部署日志
  const fetchLogs = async () => {
    if (!deploymentId) return

    try {
      setLoading(true)

      if (isJenkinsDeployment && jenkinsJobId) {
        // Jenkins部署任务：获取Jenkins构建日志
        console.log('🔍 获取Jenkins构建日志:', { jenkinsJobId, jenkinsBuildNumber })

        const response = await fetch(`/api/jenkins/jobs/${jenkinsJobId}/builds/${jenkinsBuildNumber || 'latest'}/logs`)
        const data = await response.json()

        if (data.success) {
          setStatus(data.data.status || 'unknown')

          if (data.data.logs) {
            // Jenkins日志通常是纯文本，需要解析
            const logLines = data.data.logs.split('\n').filter((line: string) => line.trim())
            const parsedLogs = logLines.map((line: string, index: number) => parseJenkinsLogEntry(line, index))
            setLogs(parsedLogs)
          }
        } else {
          // 如果Jenkins日志获取失败，回退到普通部署日志
          console.warn('Jenkins日志获取失败，回退到普通部署日志')
          await fetchDeploymentLogs()
        }
      } else {
        // 普通部署任务：获取部署日志
        await fetchDeploymentLogs()
      }

      // 自动滚动到底部
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
      }, 100)

    } catch (error) {
      console.error('获取日志失败:', error)
      // 如果是Jenkins日志获取失败，尝试获取普通部署日志
      if (isJenkinsDeployment) {
        console.warn('Jenkins日志获取异常，尝试获取部署日志')
        try {
          await fetchDeploymentLogs()
        } catch (fallbackError) {
          console.error('部署日志获取也失败:', fallbackError)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // 获取普通部署日志
  const fetchDeploymentLogs = async () => {
    const response = await fetch(`/api/cicd/deployments/${deploymentId}/status`)
    const data = await response.json()

    if (data.success) {
      setStatus(data.data.status)

      if (data.data.logs) {
        const logLines = data.data.logs.split('\n').filter((line: string) => line.trim())
        const parsedLogs = logLines.map(parseLogEntry)
        setLogs(parsedLogs)
      }
    }
  }

  // 自动刷新
  useEffect(() => {
    if (!visible || !autoRefresh) return

    const interval = setInterval(() => {
      // 只有在部署中时才自动刷新
      if (status === 'deploying') {
        fetchLogs()
      }
    }, 2000) // 每2秒刷新一次

    return () => clearInterval(interval)
  }, [visible, autoRefresh, status, deploymentId])

  // 初始加载
  useEffect(() => {
    if (visible && deploymentId) {
      fetchLogs()
    }
  }, [visible, deploymentId])

  // 获取日志条目样式（适配暗色主题）
  const getLogStyle = (entry: LogEntry) => {
    const baseStyle = {
      padding: '4px 8px',
      marginBottom: '2px',
      borderRadius: '4px',
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '12px',
      lineHeight: '1.4'
    }

    switch (entry.level) {
      case 'error':
        return { ...baseStyle, backgroundColor: 'rgba(255, 77, 79, 0.1)', color: '#ff7875', borderLeft: '3px solid #ff4d4f' }
      case 'warning':
        return { ...baseStyle, backgroundColor: 'rgba(250, 173, 20, 0.1)', color: '#ffc53d', borderLeft: '3px solid #faad14' }
      case 'success':
        return { ...baseStyle, backgroundColor: 'rgba(82, 196, 26, 0.1)', color: '#73d13d', borderLeft: '3px solid #52c41a' }
      default:
        return { ...baseStyle, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#d9d9d9', borderLeft: '3px solid #434343' }
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
        <Space>
          <span>部署日志 - {deploymentName}</span>
          {getStatusTag()}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width="80%"
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
      <Card 
        size="small"
        style={{ height: '70vh' }}
        bodyStyle={{ padding: 0, height: '100%' }}
      >
        <div
          ref={logContainerRef}
          style={{
            height: '100%',
            overflow: 'auto',
            padding: '12px',
            backgroundColor: '#001529',
            color: '#fff'
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
                  <Space size="small">
                    <Text style={{ color: '#8c8c8c', fontSize: '11px' }}>
                      [{entry.timestamp}]
                    </Text>
                    {entry.stage && (
                      <Tag color="blue" style={{ fontSize: '10px' }}>
                        {entry.stage}
                      </Tag>
                    )}
                  </Space>
                  <div style={{ marginTop: '2px' }}>
                    {entry.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </Modal>
  )
}

export default DeploymentLogViewer
