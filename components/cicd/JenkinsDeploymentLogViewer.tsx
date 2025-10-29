import React, { useState, useEffect, useRef } from 'react'
import { Modal, Card, Typography, Button, Space, Tag, Spin, Progress, Timeline, Divider } from 'antd'
import { 
  ReloadOutlined, 
  DownloadOutlined, 
  CloseOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography

interface JenkinsDeploymentLogViewerProps {
  visible: boolean
  onClose: () => void
  deploymentId: string
  deploymentName: string
  jenkinsJobIds?: string[]
  jenkinsJobName?: string
}

interface JenkinsJobLog {
  jobName: string
  buildNumber?: number
  status: 'pending' | 'running' | 'success' | 'failed' | 'aborted'
  logs: string
  queueId?: number
  startTime?: string
  duration?: number
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'error' | 'warning' | 'success' | 'command'
  message: string
  jobName?: string
}

const JenkinsDeploymentLogViewer: React.FC<JenkinsDeploymentLogViewerProps> = ({
  visible,
  onClose,
  deploymentId,
  deploymentName,
  jenkinsJobIds = [],
  jenkinsJobName
}) => {
  const [loading, setLoading] = useState(false)
  const [jobLogs, setJobLogs] = useState<JenkinsJobLog[]>([])
  const [deploymentStatus, setDeploymentStatus] = useState<string>('pending')
  const [progress, setProgress] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 获取Jenkins任务日志
  const fetchJenkinsLogs = async () => {
    if (!visible || !deploymentId) return

    try {
      setLoading(true)
      
      // 获取部署状态
      const deploymentResponse = await fetch(`/api/cicd/deployments/${deploymentId}/execute`)
      if (deploymentResponse.ok) {
        const deploymentData = await deploymentResponse.json()
        setDeploymentStatus(deploymentData.data?.status || 'pending')
      }

      // 获取Jenkins任务日志
      const logsResponse = await fetch(`/api/cicd/deployments/${deploymentId}/jenkins-logs`)
      if (logsResponse.ok) {
        const logsData = await logsResponse.json()
        if (logsData.success) {
          setJobLogs(logsData.data.jobLogs || [])
          setProgress(logsData.data.progress || 0)
        }
      }

    } catch (error) {
      console.error('获取Jenkins日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 自动刷新逻辑
  useEffect(() => {
    if (visible && autoRefresh) {
      fetchJenkinsLogs()
      intervalRef.current = setInterval(fetchJenkinsLogs, 3000) // 每3秒刷新
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [visible, autoRefresh, deploymentId])

  // 自动滚动到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [jobLogs])

  // 解析日志条目
  const parseLogEntry = (logLine: string, jobName: string): LogEntry => {
    const timestamp = new Date().toISOString()
    
    if (logLine.includes('ERROR') || logLine.includes('FAILED')) {
      return { timestamp, level: 'error', message: logLine, jobName }
    } else if (logLine.includes('WARNING') || logLine.includes('WARN')) {
      return { timestamp, level: 'warning', message: logLine, jobName }
    } else if (logLine.includes('SUCCESS') || logLine.includes('FINISHED')) {
      return { timestamp, level: 'success', message: logLine, jobName }
    } else if (logLine.startsWith('+') || logLine.startsWith('$')) {
      return { timestamp, level: 'command', message: logLine, jobName }
    } else {
      return { timestamp, level: 'info', message: logLine, jobName }
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      case 'running':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange'
      case 'running': return 'blue'
      case 'success': return 'green'
      case 'failed': return 'red'
      case 'aborted': return 'default'
      default: return 'default'
    }
  }

  // 下载日志
  const downloadLogs = () => {
    const allLogs = jobLogs.map(job => 
      `=== Jenkins任务: ${job.jobName} ===\n${job.logs}\n\n`
    ).join('')
    
    const blob = new Blob([allLogs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jenkins-deployment-${deploymentId}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <span>Jenkins部署日志</span>
          <Tag color={getStatusColor(deploymentStatus)}>
            {deploymentStatus.toUpperCase()}
          </Tag>
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
            onClick={fetchJenkinsLogs}
            loading={loading}
          >
            刷新
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={downloadLogs}
            disabled={jobLogs.length === 0}
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
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {deploymentName}
        </Title>
        <Text type="secondary">
          Jenkins任务: {jenkinsJobName || jenkinsJobIds.join(', ')}
        </Text>
        
        {progress > 0 && (
          <div style={{ marginTop: 8 }}>
            <Progress 
              percent={progress} 
              status={deploymentStatus === 'failed' ? 'exception' : 'active'}
              showInfo={true}
            />
          </div>
        )}
      </div>

      <div style={{ maxHeight: '60vh', overflow: 'auto' }} ref={logContainerRef}>
        {jobLogs.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin spinning={loading}>
                <Text type="secondary">
                  {loading ? '正在获取Jenkins日志...' : '暂无日志数据'}
                </Text>
              </Spin>
            </div>
          </Card>
        ) : (
          <Timeline mode="left">
            {jobLogs.map((job, index) => (
              <Timeline.Item
                key={index}
                dot={getStatusIcon(job.status)}
                color={getStatusColor(job.status)}
              >
                <Card 
                  size="small" 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{job.jobName}</span>
                      <Space>
                        {job.buildNumber && (
                          <Tag color="blue">构建 #{job.buildNumber}</Tag>
                        )}
                        <Tag color={getStatusColor(job.status)}>
                          {job.status.toUpperCase()}
                        </Tag>
                      </Space>
                    </div>
                  }
                >
                  <div
                    style={{
                      backgroundColor: '#001529',
                      color: '#d9d9d9',
                      padding: '12px',
                      borderRadius: '4px',
                      border: '1px solid #303030',
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '12px',
                      lineHeight: '1.4',
                      maxHeight: '300px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {job.logs || '暂无日志输出'}
                  </div>
                  
                  {job.duration && (
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        执行时长: {Math.round(job.duration / 1000)}秒
                      </Text>
                    </div>
                  )}
                </Card>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </div>
    </Modal>
  )
}

export default JenkinsDeploymentLogViewer
