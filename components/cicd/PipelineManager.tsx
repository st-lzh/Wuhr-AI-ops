'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
  Popconfirm,
  Badge,
  Tag,
  Tooltip,
  Switch,
  Divider,
  Row,
  Col,
  Tabs
} from 'antd'
import {
  BranchesOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  SettingOutlined,
  CodeOutlined,
  BuildOutlined,
  DeploymentUnitOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

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
  userId: string
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    environment: string
  }
  _count: {
    builds: number
  }
}

interface Project {
  id: string
  name: string
  environment: string
}

const PipelineManager: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })

  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  // 加载流水线列表
  const loadPipelines = async (page = 1, search = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.pageSize.toString()
      })

      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`/api/cicd/pipelines?${params}`)

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPipelines(result.data.pipelines)
          setPagination(prev => ({
            ...prev,
            current: result.data.pagination.page,
            total: result.data.pagination.total
          }))
        } else {
          message.error(result.error || '加载流水线失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '加载流水线失败')
      }
    } catch (error) {
      console.error('加载流水线失败:', error)
      message.error('加载流水线失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const response = await fetch('/api/cicd/projects?limit=100')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProjects(result.data.projects)
        }
      }
    } catch (error) {
      console.error('加载项目列表失败:', error)
    }
  }

  // 创建流水线
  const handleCreatePipeline = async (values: any) => {
    try {
      const response = await fetch('/api/cicd/pipelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success(result.message || '流水线创建成功')
          setCreateModalVisible(false)
          form.resetFields()
          loadPipelines(pagination.current)
        } else {
          message.error(result.error || '创建流水线失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '创建流水线失败')
      }
    } catch (error) {
      console.error('创建流水线失败:', error)
      message.error('创建流水线失败')
    }
  }

  // 更新流水线
  const handleUpdatePipeline = async (values: any) => {
    if (!editingPipeline) return

    try {
      const response = await fetch(`/api/cicd/pipelines/${editingPipeline.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success(result.message || '流水线更新成功')
          setEditModalVisible(false)
          setEditingPipeline(null)
          editForm.resetFields()
          loadPipelines(pagination.current)
        } else {
          message.error(result.error || '更新流水线失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '更新流水线失败')
      }
    } catch (error) {
      console.error('更新流水线失败:', error)
      message.error('更新流水线失败')
    }
  }

  // 删除流水线
  const handleDeletePipeline = async (pipelineId: string) => {
    try {
      const response = await fetch(`/api/cicd/pipelines/${pipelineId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        message.success(result.message || '流水线删除成功')
        loadPipelines(pagination.current)
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '删除流水线失败')
      }
    } catch (error) {
      console.error('删除流水线失败:', error)
      message.error('删除流水线失败')
    }
  }

  // 切换流水线状态
  const handleTogglePipelineStatus = async (pipelineId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/cicd/pipelines/${pipelineId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success(`流水线已${isActive ? '启用' : '禁用'}`)
          loadPipelines(pagination.current)
        } else {
          message.error(result.error || '状态更新失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '状态更新失败')
      }
    } catch (error) {
      console.error('状态更新失败:', error)
      message.error('状态更新失败')
    }
  }

  // 执行流水线
  const handleExecutePipeline = async (pipelineId: string) => {
    try {
      const response = await fetch(`/api/cicd/pipelines/${pipelineId}/execute`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success(`流水线执行已启动 - 构建 #${result.data.buildNumber}`)

          // 显示实时状态通知
          const buildId = result.data.buildId
          message.info({
            content: `构建 #${result.data.buildNumber} 正在执行中，您可以在构建详情页面查看实时进度`,
            duration: 5,
            onClick: () => {
              window.open(`/cicd/builds/${buildId}`, '_blank')
            }
          })

          loadPipelines(pagination.current)
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
  const renderStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge status="success" text="启用" />
    ) : (
      <Badge status="default" text="禁用" />
    )
  }

  // 渲染环境标签
  const renderEnvironmentTag = (environment: string) => {
    const envConfig = {
      dev: { color: 'blue', text: '开发' },
      test: { color: 'orange', text: '测试' },
      prod: { color: 'red', text: '生产' }
    }

    const config = envConfig[environment as keyof typeof envConfig] || { color: 'default', text: environment }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 表格列定义
  const columns: ColumnsType<Pipeline> = [
    {
      title: '流水线名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div className="text-gray-500 text-sm">{record.description}</div>
          )}
          <div className="text-gray-400 text-xs">
            Jenkins作业: {record.jenkinsJobName}
          </div>
        </div>
      )
    },
    {
      title: '项目',
      dataIndex: ['project', 'name'],
      key: 'project',
      render: (text, record) => (
        <div>
          <div>{text}</div>
          {renderEnvironmentTag(record.project.environment)}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: renderStatusBadge
    },
    {
      title: '构建次数',
      dataIndex: ['_count', 'builds'],
      key: 'builds',
      render: (count) => (
        <Tag color="blue">{count} 次</Tag>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Pipeline) => (
        <Space>
          <Tooltip title="执行流水线">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecutePipeline(record.id)}
              disabled={!record.isActive}
            />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                window.open(`/cicd/pipelines/${record.id}`, '_blank')
              }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingPipeline(record)
                editForm.setFieldsValue({
                  ...record,
                  parameters: record.parameters ? JSON.stringify(record.parameters, null, 2) : '',
                  triggers: record.triggers ? JSON.stringify(record.triggers, null, 2) : '',
                  stages: record.stages ? JSON.stringify(record.stages, null, 2) : ''
                })
                setEditModalVisible(true)
              }}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.isActive}
              onChange={(checked) => handleTogglePipelineStatus(record.id, checked)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个流水线吗？"
            onConfirm={() => handleDeletePipeline(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 初始化加载
  useEffect(() => {
    loadPipelines()
    loadProjects()
  }, [])

  return (
    <div>
      {/* 操作栏 */}
      <Card className="glass-card mb-4">
        <div className="flex justify-between items-center">
          <div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建流水线
            </Button>
          </div>
          <div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadPipelines(pagination.current)}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        </div>
      </Card>

      {/* 流水线表格 */}
      <Card className="glass-card">
        <Table
          columns={columns}
          dataSource={pipelines}
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
              setPagination(prev => ({ ...prev, pageSize: pageSize || 10 }))
              loadPipelines(page)
            },
          }}
        />
      </Card>

      {/* 创建流水线模态框 */}
      <Modal
        title="创建流水线"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreatePipeline}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="projectId"
                label="项目"
                rules={[{ required: true, message: '请选择项目' }]}
              >
                <Select placeholder="选择项目">
                  {projects.map(project => (
                    <Option key={project.id} value={project.id}>
                      {project.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="流水线名称"
                rules={[{ required: true, message: '请输入流水线名称' }]}
              >
                <Input placeholder="输入流水线名称" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="输入流水线描述" />
          </Form.Item>

          <Form.Item
            name="jenkinsJobName"
            label="Jenkins作业名称"
            rules={[{ required: true, message: '请输入Jenkins作业名称' }]}
          >
            <Input placeholder="输入Jenkins作业名称" />
          </Form.Item>

          <Tabs defaultActiveKey="parameters">
            <TabPane tab={<span><SettingOutlined />参数配置</span>} key="parameters">
              <Form.Item
                name="parameters"
                label="流水线参数 (JSON格式)"
              >
                <TextArea
                  rows={6}
                  placeholder='{"branch": "main", "environment": "dev"}'
                />
              </Form.Item>
            </TabPane>

            <TabPane tab={<span><CodeOutlined />触发器</span>} key="triggers">
              <Form.Item
                name="triggers"
                label="触发器配置 (JSON格式)"
              >
                <TextArea
                  rows={6}
                  placeholder='{"push": true, "pullRequest": true, "schedule": "0 2 * * *"}'
                />
              </Form.Item>
            </TabPane>

            <TabPane tab={<span><BuildOutlined />阶段配置</span>} key="stages">
              <Form.Item
                name="stages"
                label="流水线阶段 (JSON格式)"
              >
                <TextArea
                  rows={8}
                  placeholder='{"build": {"name": "构建", "steps": ["checkout", "install", "build"]}, "test": {"name": "测试", "steps": ["unit-test"]}, "deploy": {"name": "部署", "steps": ["deploy"]}}'
                />
              </Form.Item>
            </TabPane>
          </Tabs>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑流水线模态框 */}
      <Modal
        title="编辑流水线"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingPipeline(null)
        }}
        footer={null}
        width={800}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdatePipeline}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="projectId"
                label="项目"
                rules={[{ required: true, message: '请选择项目' }]}
              >
                <Select placeholder="选择项目">
                  {projects.map(project => (
                    <Option key={project.id} value={project.id}>
                      {project.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="流水线名称"
                rules={[{ required: true, message: '请输入流水线名称' }]}
              >
                <Input placeholder="输入流水线名称" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="输入流水线描述" />
          </Form.Item>

          <Form.Item
            name="jenkinsJobName"
            label="Jenkins作业名称"
            rules={[{ required: true, message: '请输入Jenkins作业名称' }]}
          >
            <Input placeholder="输入Jenkins作业名称" />
          </Form.Item>

          <Tabs defaultActiveKey="parameters">
            <TabPane tab={<span><SettingOutlined />参数配置</span>} key="parameters">
              <Form.Item
                name="parameters"
                label="流水线参数 (JSON格式)"
              >
                <TextArea
                  rows={6}
                  placeholder='{"branch": "main", "environment": "dev"}'
                />
              </Form.Item>
            </TabPane>

            <TabPane tab={<span><CodeOutlined />触发器</span>} key="triggers">
              <Form.Item
                name="triggers"
                label="触发器配置 (JSON格式)"
              >
                <TextArea
                  rows={6}
                  placeholder='{"push": true, "pullRequest": true, "schedule": "0 2 * * *"}'
                />
              </Form.Item>
            </TabPane>

            <TabPane tab={<span><BuildOutlined />阶段配置</span>} key="stages">
              <Form.Item
                name="stages"
                label="流水线阶段 (JSON格式)"
              >
                <TextArea
                  rows={8}
                  placeholder='{"build": {"name": "构建", "steps": ["checkout", "install", "build"]}, "test": {"name": "测试", "steps": ["unit-test"]}, "deploy": {"name": "部署", "steps": ["deploy"]}}'
                />
              </Form.Item>
            </TabPane>
          </Tabs>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setEditModalVisible(false)
                setEditingPipeline(null)
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                更新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PipelineManager
