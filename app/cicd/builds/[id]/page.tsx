'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card,
  Typography,
  Space,
  Button,
  Descriptions,
  Tag,
  Alert,
  Row,
  Col,
  Divider,
  message
} from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import MainLayout from '../../../components/layout/MainLayout'
import RealtimeStatusCard from '../../../components/cicd/RealtimeStatusCard'

const { Title, Text } = Typography

interface BuildDetails {
  id: string
  buildNumber: number
  status: string
  result?: string
  startedAt: string
  completedAt?: string
  duration?: number
  queueId?: number
  jenkinsBuildNumber?: number
  parameters?: any
  logs?: string
  pipeline: {
    id: string
    name: string
    jenkinsJobName?: string
    project: {
      id: string
      name: string
    }
  }
  jenkinsConfig?: {
    id: string
    name: string
    serverUrl: string
  }
}

export default function BuildDetailPage() {
  const params = useParams()
  const router = useRouter()
  const buildId = params.id as string

  const [buildDetails, setBuildDetails] = useState<BuildDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载构建详情
  const loadBuildDetails = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/cicd/builds/${buildId}`)
      const result = await response.json()

      if (result.success) {
        setBuildDetails(result.data)
      } else {
        setError(result.error || '加载构建详情失败')
      }
    } catch (err) {
      setError('网络错误')
      console.error('加载构建详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 查看日志
  const handleViewLogs = () => {
    if (buildDetails?.jenkinsConfig && buildDetails?.jenkinsBuildNumber) {
      const jenkinsUrl = `${buildDetails.jenkinsConfig.serverUrl}/job/${buildDetails.pipeline.jenkinsJobName}/${buildDetails.jenkinsBuildNumber}/console`
      window.open(jenkinsUrl, '_blank')
    } else {
      message.info('Jenkins日志暂不可用')
    }
  }

  // 下载日志
  const handleDownloadLogs = async () => {
    try {
      const response = await fetch(`/api/cicd/builds/${buildId}/logs`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `build-${buildDetails?.buildNumber}-logs.txt`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        message.error('下载日志失败')
      }
    } catch (error) {
      console.error('下载日志失败:', error)
      message.error('下载日志失败')
    }
  }

  useEffect(() => {
    if (buildId) {
      loadBuildDetails()
    }
  }, [buildId])

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card loading />
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert
            message="加载失败"
            description={error}
            type="error"
            showIcon
            action={
              <Button onClick={loadBuildDetails}>重试</Button>
            }
          />
        </div>
      </MainLayout>
    )
  }

  if (!buildDetails) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert
            message="构建不存在"
            description="请检查构建ID是否正确"
            type="warning"
            showIcon
          />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
            >
              返回
            </Button>
            <Title level={2} className="mb-0">
              构建详情 #{buildDetails.buildNumber}
            </Title>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {/* 实时状态卡片 */}
          <Col xs={24} lg={8}>
            <RealtimeStatusCard
              buildId={buildId}
              title="实时状态"
              showProgress={true}
              showJenkinsInfo={true}
              autoRefresh={true}
              onComplete={() => {
                message.success('构建已完成')
                loadBuildDetails() // 重新加载详情
              }}
              onError={(error) => {
                message.error(`状态更新失败: ${error}`)
              }}
            />
          </Col>

          {/* 构建信息 */}
          <Col xs={24} lg={16}>
            <Card title="构建信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="构建号">
                  #{buildDetails.buildNumber}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={
                    buildDetails.status === 'success' ? 'green' :
                    buildDetails.status === 'failed' ? 'red' :
                    buildDetails.status === 'running' ? 'blue' : 'orange'
                  }>
                    {buildDetails.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="流水线">
                  {buildDetails.pipeline.name}
                </Descriptions.Item>
                <Descriptions.Item label="项目">
                  {buildDetails.pipeline.project.name}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {new Date(buildDetails.startedAt).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {buildDetails.completedAt 
                    ? new Date(buildDetails.completedAt).toLocaleString() 
                    : '-'
                  }
                </Descriptions.Item>
                <Descriptions.Item label="持续时间">
                  {buildDetails.duration 
                    ? `${Math.floor(buildDetails.duration / 60)}分${buildDetails.duration % 60}秒`
                    : '-'
                  }
                </Descriptions.Item>
                <Descriptions.Item label="Jenkins构建号">
                  {buildDetails.jenkinsBuildNumber || '-'}
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              {/* 操作按钮 */}
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadBuildDetails}
                >
                  刷新
                </Button>
                <Button
                  icon={<EyeOutlined />}
                  onClick={handleViewLogs}
                  disabled={!buildDetails.jenkinsConfig || !buildDetails.jenkinsBuildNumber}
                >
                  查看Jenkins日志
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadLogs}
                >
                  下载日志
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 构建参数 */}
        {buildDetails.parameters && (
          <Card title="构建参数" className="mt-4" size="small">
            <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(buildDetails.parameters, null, 2)}
            </pre>
          </Card>
        )}

        {/* 构建日志 */}
        {buildDetails.logs && (
          <Card title="构建日志" className="mt-4" size="small">
            <pre className="bg-black text-green-400 p-4 rounded text-sm overflow-auto max-h-96">
              {buildDetails.logs}
            </pre>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
