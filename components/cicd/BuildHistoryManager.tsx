'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Space,
  Typography,
  message,
  Badge,
  Tag,
  Tooltip,
  Select,
  Input,
  DatePicker,
  Row,
  Col,
  Statistic,
  Progress,
  Tabs,
  Drawer
} from 'antd'
import {
  BuildOutlined,
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { RangePicker } = DatePicker
const { TabPane } = Tabs

interface Build {
  id: string
  buildNumber: number
  jenkinsJobName: string
  status: string
  result?: string
  startedAt: string
  completedAt?: string
  duration?: number
  queueId?: string
  buildUrl?: string
  parameters?: any
  artifacts?: any
  logs?: string
  jenkinsConfig: {
    id: string
    name: string
    serverUrl: string
    project: {
      id: string
      name: string
    }
  }
  pipeline?: {
    id: string
    name: string
  }
  user: {
    id: string
    username: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

interface BuildStats {
  total: number
  success: number
  failed: number
  running: number
  pending: number
  successRate: number
  avgDuration: number
}

const BuildHistoryManager: React.FC = () => {
  const [builds, setBuilds] = useState<Build[]>([])
  const [stats, setStats] = useState<BuildStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null)
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    pipelineId: '',
    jenkinsConfigId: '',
    dateRange: null as any
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  })

  // 加载构建历史
  const loadBuilds = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString()
      })

      if (filters.status) {
        params.append('status', filters.status)
      }
      if (filters.pipelineId) {
        params.append('pipelineId', filters.pipelineId)
      }
      if (filters.jenkinsConfigId) {
        params.append('jenkinsConfigId', filters.jenkinsConfigId)
      }

      const response = await fetch(`/api/cicd/builds?${params}`)

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setBuilds(result.data.builds)
          setPagination(prev => ({
            ...prev,
            current: result.data.pagination.page,
            total: result.data.pagination.total
          }))
        } else {
          message.error(result.error || '加载构建历史失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '加载构建历史失败')
      }
    } catch (error) {
      console.error('加载构建历史失败:', error)
      message.error('加载构建历史失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载统计信息
  const loadStats = async () => {
    try {
      const response = await fetch('/api/cicd/builds/stats')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setStats(result.data)
        }
      }
    } catch (error) {
      console.error('加载统计信息失败:', error)
    }
  }

  // 查看构建日志
  const handleViewLogs = (build: Build) => {
    setSelectedBuild(build)
    setLogModalVisible(true)
  }

  // 查看构建详情
  const handleViewDetails = (build: Build) => {
    setSelectedBuild(build)
    setDetailDrawerVisible(true)
  }

  // 重新执行构建
  const handleRebuild = async (build: Build) => {
    try {
      if (!build.pipeline) {
        message.error('该构建没有关联的流水线，无法重新执行')
        return
      }

      const response = await fetch(`/api/cicd/pipelines/${build.pipeline.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parameters: build.parameters
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('构建已重新启动')
          loadBuilds(pagination.current, pagination.pageSize)
        } else {
          message.error(result.error || '重新执行失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '重新执行失败')
      }
    } catch (error) {
      console.error('重新执行失败:', error)
      message.error('重新执行失败')
    }
  }

  // 渲染状态标签
  const renderStatusBadge = (status: string, result?: string) => {
    const statusConfig = {
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '等待中' },
      queued: { color: 'blue', icon: <ClockCircleOutlined />, text: '队列中' },
      running: { color: 'processing', icon: <PlayCircleOutlined />, text: '运行中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      aborted: { color: 'default', icon: <StopOutlined />, text: '已中止' },
      unstable: { color: 'warning', icon: <ExclamationCircleOutlined />, text: '不稳定' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      color: 'default', 
      icon: <ClockCircleOutlined />, 
      text: status 
    }

    return (
      <Badge 
        status={config.color as any} 
        text={
          <span>
            {config.icon} {config.text}
            {result && result !== status && ` (${result})`}
          </span>
        } 
      />
    )
  }

  // 渲染持续时间
  const renderDuration = (duration?: number) => {
    if (!duration) return '-'
    
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  // 表格列定义
  const columns: ColumnsType<Build> = [
    {
      title: '构建信息',
      key: 'buildInfo',
      render: (_, record) => (
        <div>
          <div className="flex items-center space-x-2">
            <Text strong>#{record.buildNumber}</Text>
            <Text className="text-gray-500">{record.jenkinsJobName}</Text>
          </div>
          <div className="text-sm text-gray-400">
            项目: {record.jenkinsConfig.project.name}
          </div>
          {record.pipeline && (
            <div className="text-sm text-gray-400">
              流水线: {record.pipeline.name}
            </div>
          )}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => renderStatusBadge(status, record.result)
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '持续时间',
      dataIndex: 'duration',
      key: 'duration',
      render: renderDuration
    },
    {
      title: '触发者',
      dataIndex: ['user', 'username'],
      key: 'user'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="查看日志">
            <Button
              type="text"
              icon={<FileTextOutlined />}
              onClick={() => handleViewLogs(record)}
            />
          </Tooltip>
          {record.buildUrl && (
            <Tooltip title="Jenkins页面">
              <Button
                type="text"
                icon={<BuildOutlined />}
                onClick={() => window.open(record.buildUrl, '_blank')}
              />
            </Tooltip>
          )}
          {record.pipeline && ['success', 'failed', 'aborted'].includes(record.status) && (
            <Tooltip title="重新执行">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => handleRebuild(record)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ]

  // 初始化加载
  useEffect(() => {
    loadBuilds()
    loadStats()
  }, [])

  // 过滤器变化时重新加载
  useEffect(() => {
    loadBuilds(1, pagination.pageSize)
  }, [filters])

  return (
    <div>
      {/* 统计信息 */}
      {stats && (
        <Row gutter={16} className="mb-6">
          <Col span={4}>
            <Card className="glass-card">
              <Statistic
                title="总构建数"
                value={stats.total}
                prefix={<BuildOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="glass-card">
              <Statistic
                title="成功率"
                value={stats.successRate}
                suffix="%"
                valueStyle={{ color: stats.successRate > 80 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="glass-card">
              <Statistic
                title="成功构建"
                value={stats.success}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="glass-card">
              <Statistic
                title="失败构建"
                value={stats.failed}
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="glass-card">
              <Statistic
                title="运行中"
                value={stats.running}
                valueStyle={{ color: '#1890ff' }}
                prefix={<PlayCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="glass-card">
              <Statistic
                title="平均耗时"
                value={Math.round(stats.avgDuration)}
                suffix="s"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 过滤器 */}
      <Card className="glass-card mb-4">
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Select
              placeholder="选择状态"
              allowClear
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value || '' }))}
            >
              <Option value="pending">等待中</Option>
              <Option value="queued">队列中</Option>
              <Option value="running">运行中</Option>
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="aborted">已中止</Option>
              <Option value="unstable">不稳定</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
            />
          </Col>
          <Col span={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadBuilds(pagination.current, pagination.pageSize)}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 构建历史表格 */}
      <Card className="glass-card">
        <Table
          columns={columns}
          dataSource={builds}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, pageSize: pageSize || 20 }))
              loadBuilds(page, pageSize)
            },
          }}
        />
      </Card>

      {/* 构建日志模态框 */}
      <Modal
        title={`构建日志 - #${selectedBuild?.buildNumber}`}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            关闭
          </Button>,
          selectedBuild?.buildUrl && (
            <Button 
              key="jenkins" 
              type="primary"
              icon={<BuildOutlined />}
              onClick={() => window.open(selectedBuild.buildUrl, '_blank')}
            >
              Jenkins页面
            </Button>
          )
        ]}
        width={800}
      >
        <div 
          className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {selectedBuild?.logs || '暂无日志信息'}
        </div>
      </Modal>

      {/* 构建详情抽屉 */}
      <Drawer
        title={`构建详情 - #${selectedBuild?.buildNumber}`}
        placement="right"
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        width={600}
      >
        {selectedBuild && (
          <Tabs defaultActiveKey="info">
            <TabPane tab="基本信息" key="info">
              <div className="space-y-4">
                <div>
                  <Text strong>构建号:</Text> #{selectedBuild.buildNumber}
                </div>
                <div>
                  <Text strong>作业名称:</Text> {selectedBuild.jenkinsJobName}
                </div>
                <div>
                  <Text strong>状态:</Text> {renderStatusBadge(selectedBuild.status, selectedBuild.result)}
                </div>
                <div>
                  <Text strong>开始时间:</Text> {selectedBuild.startedAt ? dayjs(selectedBuild.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </div>
                <div>
                  <Text strong>完成时间:</Text> {selectedBuild.completedAt ? dayjs(selectedBuild.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </div>
                <div>
                  <Text strong>持续时间:</Text> {renderDuration(selectedBuild.duration)}
                </div>
                <div>
                  <Text strong>触发者:</Text> {selectedBuild.user.username}
                </div>
                {selectedBuild.buildUrl && (
                  <div>
                    <Text strong>Jenkins链接:</Text>{' '}
                    <a href={selectedBuild.buildUrl} target="_blank" rel="noopener noreferrer">
                      查看Jenkins页面
                    </a>
                  </div>
                )}
              </div>
            </TabPane>
            
            <TabPane tab="参数配置" key="parameters">
              <pre className="bg-gray-50 p-3 rounded text-sm">
                {selectedBuild.parameters ? JSON.stringify(selectedBuild.parameters, null, 2) : '无参数配置'}
              </pre>
            </TabPane>
            
            <TabPane tab="构建产物" key="artifacts">
              <pre className="bg-gray-50 p-3 rounded text-sm">
                {selectedBuild.artifacts ? JSON.stringify(selectedBuild.artifacts, null, 2) : '无构建产物'}
              </pre>
            </TabPane>
          </Tabs>
        )}
      </Drawer>
    </div>
  )
}

export default BuildHistoryManager
