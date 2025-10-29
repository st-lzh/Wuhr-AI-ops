'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Typography,
  message,
  Badge,
  Tag,
  Table,
  Modal,
  Form,
  Input,
  Progress,
  Statistic,
  Row,
  Col,
  Tabs
} from 'antd'
import {
  BranchesOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  HistoryOutlined,
  CodeOutlined,
  BuildOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import MainLayout from '../../../components/layout/MainLayout'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { TextArea } = Input

interface Pipeline {
  id: string
  projectId: string
  name: string
  description?: string
  jenkinsJobName: string
  parameters?: any
  triggers?: any
  stages?: any
  isActive: boolean
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    environment: string
    repositoryUrl: string
    branch: string
  }
  builds: Array<{
    id: string
    buildNumber: number
    status: string
    result?: string
    startedAt: string
    completedAt?: string
    duration?: number
  }>
  _count: {
    builds: number
  }
}

interface ExecutionStatus {
  pipelineId: string
  pipelineName: string
  isActive: boolean
  recentBuilds: Array<{
    id: string
    buildNumber: number
    status: string
    result?: string
    startedAt: string
    completedAt?: string
    duration?: number
    parameters?: any
  }>
  runningBuilds: Array<any>
  totalBuilds: number
  successRate: number
}

interface PipelineDetailPageProps {
  params: { id: string }
}

const PipelineDetailPage: React.FC<PipelineDetailPageProps> = ({ params }) => {
  const router = useRouter()
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [executeModalVisible, setExecuteModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 加载流水线详情
  const loadPipelineDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cicd/pipelines/${params.id}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPipeline(result.data)
        } else {
          message.error(result.error || '加载流水线详情失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '加载流水线详情失败')
      }
    } catch (error) {
      console.error('加载流水线详情失败:', error)
      message.error('加载流水线详情失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载执行状态
  const loadExecutionStatus = async () => {
    try {
      const response = await fetch(`/api/cicd/pipelines/${params.id}/execute`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setExecutionStatus(result.data)
        }
      }
    } catch (error) {
      console.error('加载执行状态失败:', error)
    }
  }

  // 执行流水线
  const handleExecutePipeline = async (values: any) => {
    try {
      const response = await fetch(`/api/cicd/pipelines/${params.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('流水线执行已启动')
          setExecuteModalVisible(false)
          form.resetFields()
          loadExecutionStatus()
          loadPipelineDetail()
        } else {
          message.error(result.error || '流水线执行失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '流水线执行失败')
      }
    } catch (error) {
      console.error('流水线执行失败:', error)
      message.error('流水线执行失败')
    }
  }

  // 渲染状态标签
  const renderStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'orange', text: '等待中' },
      queued: { color: 'blue', text: '队列中' },
      running: { color: 'processing', text: '运行中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
      aborted: { color: 'default', text: '已中止' },
      unstable: { color: 'warning', text: '不稳定' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
    return <Badge status={config.color as any} text={config.text} />
  }

  // 构建历史表格列定义
  const buildColumns: ColumnsType<any> = [
    {
      title: '构建号',
      dataIndex: 'buildNumber',
      key: 'buildNumber',
      render: (buildNumber) => <Text strong>#{buildNumber}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: renderStatusBadge
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : '-'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            size="small"
            onClick={() => {
              // TODO: 查看构建详情
              message.info('查看构建详情功能开发中')
            }}
          >
            详情
          </Button>
        </Space>
      )
    }
  ]

  // 初始化加载
  useEffect(() => {
    loadPipelineDetail()
    loadExecutionStatus()
    
    // 定时刷新执行状态
    const interval = setInterval(loadExecutionStatus, 10000) // 每10秒刷新
    return () => clearInterval(interval)
  }, [params.id])

  if (!pipeline) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center">
            {loading ? '加载中...' : '流水线不存在'}
          </div>
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
              <BranchesOutlined className="mr-2" />
              {pipeline.name}
            </Title>
            {pipeline.isActive ? (
              <Badge status="success" text="启用" />
            ) : (
              <Badge status="default" text="禁用" />
            )}
          </Space>
        </div>

        {/* 统计信息 */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="总构建次数"
                value={executionStatus?.totalBuilds || 0}
                prefix={<BuildOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="成功率"
                value={executionStatus?.successRate || 0}
                suffix="%"
                valueStyle={{ color: (executionStatus?.successRate || 0) > 80 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="运行中构建"
                value={executionStatus?.runningBuilds?.length || 0}
                prefix={<PlayCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="glass-card">
              <div className="text-center">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => setExecuteModalVisible(true)}
                  disabled={!pipeline.isActive}
                  size="large"
                >
                  执行流水线
                </Button>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 详细信息 */}
        <Card className="glass-card mb-6">
          <Tabs defaultActiveKey="info">
            <TabPane tab={<span><SettingOutlined />基本信息</span>} key="info">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="流水线名称">{pipeline.name}</Descriptions.Item>
                <Descriptions.Item label="Jenkins作业">{pipeline.jenkinsJobName}</Descriptions.Item>
                <Descriptions.Item label="所属项目">{pipeline.project.name}</Descriptions.Item>
                <Descriptions.Item label="项目环境">
                  <Tag color={pipeline.project.environment === 'prod' ? 'red' : 'blue'}>
                    {pipeline.project.environment}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="仓库地址" span={2}>
                  <a href={pipeline.project.repositoryUrl} target="_blank" rel="noopener noreferrer">
                    {pipeline.project.repositoryUrl}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="分支">{pipeline.project.branch}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {pipeline.isActive ? (
                    <Badge status="success" text="启用" />
                  ) : (
                    <Badge status="default" text="禁用" />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(pipeline.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(pipeline.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                {pipeline.description && (
                  <Descriptions.Item label="描述" span={2}>
                    {pipeline.description}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </TabPane>

            <TabPane tab={<span><CodeOutlined />配置详情</span>} key="config">
              <Row gutter={16}>
                <Col span={8}>
                  <Card title="参数配置" size="small">
                    <pre className="text-sm bg-gray-50 p-3 rounded">
                      {pipeline.parameters ? JSON.stringify(pipeline.parameters, null, 2) : '无配置'}
                    </pre>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="触发器配置" size="small">
                    <pre className="text-sm bg-gray-50 p-3 rounded">
                      {pipeline.triggers ? JSON.stringify(pipeline.triggers, null, 2) : '无配置'}
                    </pre>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="阶段配置" size="small">
                    <pre className="text-sm bg-gray-50 p-3 rounded">
                      {pipeline.stages ? JSON.stringify(pipeline.stages, null, 2) : '无配置'}
                    </pre>
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><HistoryOutlined />构建历史</span>} key="history">
              <Table
                columns={buildColumns}
                dataSource={executionStatus?.recentBuilds || []}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                }}
              />
            </TabPane>
          </Tabs>
        </Card>

        {/* 执行流水线模态框 */}
        <Modal
          title="执行流水线"
          open={executeModalVisible}
          onCancel={() => setExecuteModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleExecutePipeline}
            initialValues={{
              branch: pipeline.project.branch || 'main',
              environment: 'dev',
              buildType: 'release'
            }}
          >
            <Form.Item
              name="branch"
              label="分支"
            >
              <Input placeholder="输入分支名称" />
            </Form.Item>

            <Form.Item
              name="environment"
              label="环境"
            >
              <Input placeholder="输入环境名称" />
            </Form.Item>

            <Form.Item
              name="buildType"
              label="构建类型"
            >
              <Input placeholder="输入构建类型" />
            </Form.Item>

            <Form.Item
              name="parameters"
              label="额外参数 (JSON格式)"
            >
              <TextArea
                rows={4}
                placeholder='{"key": "value"}'
              />
            </Form.Item>

            <Form.Item className="mb-0">
              <Space className="w-full justify-end">
                <Button onClick={() => setExecuteModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  执行
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  )
}

export default PipelineDetailPage
