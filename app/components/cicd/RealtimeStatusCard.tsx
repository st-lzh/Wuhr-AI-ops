'use client'

import React from 'react'
import { Card, Progress, Tag, Typography, Space, Button, Tooltip, Alert } from 'antd'
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useRealtimeStatus } from '../../hooks/useRealtimeStatus'

const { Text, Title } = Typography

interface RealtimeStatusCardProps {
  buildId: string
  title?: string
  showProgress?: boolean
  showJenkinsInfo?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  onComplete?: () => void
  onError?: (error: string) => void
}

const RealtimeStatusCard: React.FC<RealtimeStatusCardProps> = ({
  buildId,
  title = '构建状态',
  showProgress = true,
  showJenkinsInfo = true,
  autoRefresh = true,
  refreshInterval = 3000,
  onComplete,
  onError
}) => {
  const { data, loading, error, refresh, isPolling } = useRealtimeStatus({
    buildId,
    enabled: autoRefresh,
    interval: refreshInterval,
    onComplete: (data) => {
      console.log('构建完成:', data)
      onComplete?.()
    },
    onError: (error) => {
      console.error('状态更新错误:', error)
      onError?.(error)
    }
  })

  // 获取状态颜色和图标
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          color: 'orange',
          icon: <ClockCircleOutlined />,
          text: '等待中'
        }
      case 'running':
        return {
          color: 'blue',
          icon: <PlayCircleOutlined />,
          text: '执行中'
        }
      case 'success':
        return {
          color: 'green',
          icon: <CheckCircleOutlined />,
          text: '成功'
        }
      case 'failed':
        return {
          color: 'red',
          icon: <CloseCircleOutlined />,
          text: '失败'
        }
      case 'aborted':
        return {
          color: 'default',
          icon: <ExclamationCircleOutlined />,
          text: '已中止'
        }
      default:
        return {
          color: 'default',
          icon: <ClockCircleOutlined />,
          text: status
        }
    }
  }

  // 格式化持续时间
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  // 格式化时间
  const formatTime = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  if (error) {
    return (
      <Card title={title} size="small">
        <Alert
          message="获取状态失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={refresh}>
              重试
            </Button>
          }
        />
      </Card>
    )
  }

  if (!data) {
    return (
      <Card title={title} size="small" loading={loading}>
        <div className="text-center py-4">
          <Text type="secondary">加载中...</Text>
        </div>
      </Card>
    )
  }

  const { build, jenkinsStatus, progress } = data
  const statusDisplay = getStatusDisplay(build.status)

  return (
    <Card
      title={
        <div className="flex justify-between items-center">
          <span>{title}</span>
          <Space>
            {isPolling && (
              <Tooltip title="自动刷新中">
                <Tag color="blue" icon={<ReloadOutlined spin />}>
                  实时
                </Tag>
              </Tooltip>
            )}
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={loading}
            />
          </Space>
        </div>
      }
      size="small"
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 基本信息 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Text strong>构建 #{build.buildNumber}</Text>
            <Tag color={statusDisplay.color} icon={statusDisplay.icon}>
              {statusDisplay.text}
            </Tag>
          </div>
          
          <div className="text-sm text-gray-600">
            <div>流水线: {build.pipeline.name}</div>
            <div>项目: {build.pipeline.project.name}</div>
          </div>
        </div>

        {/* 进度条 */}
        {showProgress && build.status === 'running' && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <Text type="secondary">执行进度</Text>
              <Text type="secondary">{Math.round(progress)}%</Text>
            </div>
            <Progress
              percent={progress}
              status={(build.status as any) === 'failed' ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              size="small"
            />
          </div>
        )}

        {/* 时间信息 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <Text type="secondary">开始时间:</Text>
            <div>{formatTime(build.startedAt)}</div>
          </div>
          <div>
            <Text type="secondary">持续时间:</Text>
            <div>{formatDuration(build.duration || jenkinsStatus?.duration)}</div>
          </div>
        </div>

        {/* Jenkins信息 */}
        {showJenkinsInfo && jenkinsStatus && (
          <div className="border-t pt-2">
            <Text type="secondary" className="text-xs">Jenkins状态:</Text>
            <div className="text-sm mt-1">
              {jenkinsStatus.inQueue ? (
                <div>
                  <Tag color="orange">队列中</Tag>
                  {jenkinsStatus.queueWhy && (
                    <div className="text-xs text-gray-500 mt-1">
                      {jenkinsStatus.queueWhy}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {jenkinsStatus.buildNumber && (
                    <div>Jenkins构建: #{jenkinsStatus.buildNumber}</div>
                  )}
                  {jenkinsStatus.building !== undefined && (
                    <Tag color={jenkinsStatus.building ? 'blue' : 'default'}>
                      {jenkinsStatus.building ? '执行中' : '已完成'}
                    </Tag>
                  )}
                  {jenkinsStatus.result && (
                    <Tag color={jenkinsStatus.result === 'SUCCESS' ? 'green' : 'red'}>
                      {jenkinsStatus.result}
                    </Tag>
                  )}
                </div>
              )}
              
              {jenkinsStatus.error && (
                <Alert
                  message={jenkinsStatus.error}
                  type="warning"
                  className="mt-2"
                />
              )}
            </div>
          </div>
        )}

        {/* 最后更新时间 */}
        <div className="text-xs text-gray-400 text-right">
          最后更新: {formatTime(data.lastUpdated)}
        </div>
      </Space>
    </Card>
  )
}

export default RealtimeStatusCard
