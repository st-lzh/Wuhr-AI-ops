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
  Alert, 
  message, 
  Popconfirm,
  Badge,
  Tooltip,
  Tag,
  Row,
  Col,
  Statistic,
  Switch,
  Divider
} from 'antd'
import {
  ClockCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { 
  TaskWithRelations, 
  CreateTaskRequest, 
  TaskListResponse,
  TaskStats,
  TASK_TYPE_OPTIONS,
  CRON_TEMPLATES,
  validateCronExpression,
  getTaskTypeDisplay,
  calculateSuccessRate,
  getTaskStatus,
  formatExecutionStats
} from '../../types/task'
import { apiClient } from '../../utils/apiClient'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

interface DeploymentOption {
  id: string
  name: string
  environment: string
  projectName: string
}

export default function TasksPage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [deploymentOptions, setDeploymentOptions] = useState<DeploymentOption[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [actionLoading, setActionLoading] = useState(false)

  // 权限检查
  const canRead = hasPermission('cicd:read')
  const canWrite = hasPermission('cicd:write')

  // 加载数据
  const loadData = async () => {
    if (!canRead) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      })

      const response = await apiClient.get<TaskListResponse>(`/api/cicd/tasks?${params}`)
      setTasks(response.data?.tasks || [])
      setTotal(response.data?.total || 0)

      // 计算统计信息
      const totalTasks = response.data?.total || 0
      const activeTasks = (response.data?.tasks || []).filter((t: any) => t.isActive).length
      const recentExecutions = (response.data?.tasks || []).reduce((sum: number, t: any) => sum + (t.executionCount || 0), 0)
      const totalSuccessful = (response.data?.tasks || []).reduce((sum: number, t: any) => sum + ((t.executionCount || 0) - (t.failureCount || 0)), 0)
      const successRate = recentExecutions > 0 ? Math.round((totalSuccessful / recentExecutions) * 100) : 0

      setStats({
        totalTasks,
        activeTasks,
        recentExecutions,
        successRate,
        averageExecutionTime: 0 // 简化实现
      })

    } catch (error) {
      console.error('加载定时任务失败:', error)
      message.error('加载定时任务失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载部署选项
  const loadDeploymentOptions = async () => {
    try {
      // 暂时使用空数组，因为tasks API不存在
      setDeploymentOptions([])
    } catch (error) {
      console.error('加载部署选项失败:', error)
    }
  }

  // 创建任务
  const handleCreate = async (values: CreateTaskRequest) => {
    if (!canWrite) return

    setActionLoading(true)
    try {
      await apiClient.post('/api/cicd/tasks', values)
      message.success('定时任务创建成功')
      setCreateModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error: any) {
      console.error('创建定时任务失败:', error)
      message.error(error.response?.data?.message || '创建定时任务失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 切换任务状态
  const handleToggleTask = async (taskId: string, enabled: boolean) => {
    if (!canWrite) return

    setActionLoading(true)
    try {
      await apiClient.post(`/api/cicd/tasks/${taskId}/enable`, { enabled })
      message.success(`任务已${enabled ? '启用' : '禁用'}`)
      loadData()
    } catch (error: any) {
      console.error('切换任务状态失败:', error)
      message.error(error.response?.data?.message || '切换任务状态失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 手动执行任务
  const handleRunTask = async (taskId: string) => {
    if (!canWrite) return

    setActionLoading(true)
    try {
      await apiClient.post(`/api/cicd/tasks/${taskId}/run`)
      message.success('任务已开始执行')
      loadData()
    } catch (error: any) {
      console.error('执行任务失败:', error)
      message.error(error.response?.data?.message || '执行任务失败')
    } finally {
      setActionLoading(false)
    }
  }

  // Cron表达式验证
  const validateCron = (_: any, value: string) => {
    if (!value) return Promise.reject('请输入Cron表达式')
    
    const validation = validateCronExpression(value)
    if (!validation.isValid) {
      return Promise.reject(validation.error)
    }
    
    return Promise.resolve()
  }

  // 表格列定义
  const columns = [
    {
      title: '任务名称',
      key: 'name',
      render: (record: TaskWithRelations) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          {record.description && (
            <div style={{ color: '#666', fontSize: '12px' }}>{record.description}</div>
          )}
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeInfo = getTaskTypeDisplay(type as any)
        return <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
      }
    },
    {
      title: '关联部署',
      key: 'deployment',
      render: (record: TaskWithRelations) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.deployment.name}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.deployment.project.name} - {record.deployment.environment}
          </div>
        </div>
      )
    },
    {
      title: 'Cron表达式',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      render: (expression: string) => (
        <Tooltip title="点击查看表达式说明">
          <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px' }}>
            {expression}
          </code>
        </Tooltip>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (record: TaskWithRelations) => {
        const stats = formatExecutionStats(record)
        const statusColors = {
          active: 'success',
          inactive: 'default',
          running: 'processing',
          error: 'error'
        }
        
        return (
          <div>
            <Badge 
              status={statusColors[stats.status] as any} 
              text={record.isActive ? '运行中' : '已停止'} 
            />
            {stats.lastError && (
              <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
                <ExclamationCircleOutlined /> 最近执行失败
              </div>
            )}
          </div>
        )
      }
    },
    {
      title: '执行统计',
      key: 'execution',
      render: (record: TaskWithRelations) => {
        const stats = formatExecutionStats(record)
        return (
          <div>
            <div>总计: {stats.executionCount}次</div>
            <div style={{ color: stats.successRate >= 90 ? '#52c41a' : stats.successRate >= 70 ? '#faad14' : '#ff4d4f' }}>
              成功率: {stats.successRate}%
            </div>
          </div>
        )
      }
    },
    {
      title: '最近执行',
      key: 'lastRun',
      render: (record: TaskWithRelations) => (
        <div>
          {record.lastRun ? (
            <>
              <div>{new Date(record.lastRun).toLocaleString()}</div>
              {record.lastSuccessAt && (
                <div style={{ color: '#52c41a', fontSize: '12px' }}>
                  <CheckCircleOutlined /> 上次成功: {new Date(record.lastSuccessAt).toLocaleString()}
                </div>
              )}
            </>
          ) : (
            <Text type="secondary">尚未执行</Text>
          )}
        </div>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: TaskWithRelations) => (
        <Space>
          {canWrite && (
            <>
              <Tooltip title={record.isActive ? '禁用任务' : '启用任务'}>
                <Switch
                  size="small"
                  checked={record.isActive}
                  onChange={(checked) => handleToggleTask(record.id, checked)}
                  loading={actionLoading}
                />
              </Tooltip>
              <Tooltip title="立即执行">
                <Button
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleRunTask(record.id)}
                  disabled={!record.isActive}
                  loading={actionLoading}
                >
                  执行
                </Button>
              </Tooltip>
              <Tooltip title="编辑任务">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedTask(record)
                    editForm.setFieldsValue({
                      name: record.name,
                      description: record.description,
                      cronExpression: record.cronExpression
                    })
                    setEditModalVisible(true)
                  }}
                >
                  编辑
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ]

  useEffect(() => {
    if (canRead) {
      loadData()
      loadDeploymentOptions()
    }
  }, [canRead, currentPage])

  if (!canRead) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Alert
          message="权限不足"
          description="您没有权限访问定时任务管理"
          type="warning"
          showIcon
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Title level={2} style={{ margin: 0, color: '#fff' }}>定时任务管理</Title>
        <Paragraph style={{ color: '#ccc', margin: '8px 0 0 0' }}>
          管理自动化部署任务，支持Cron表达式定时调度
        </Paragraph>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: '20px' }}>
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="总任务数"
                value={stats.totalTasks}
                prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="活跃任务"
                value={stats.activeTasks}
                suffix={`/ ${stats.totalTasks}`}
                prefix={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="总执行次数"
                value={stats.recentExecutions}
                prefix={<SettingOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="glass-card">
              <Statistic
                title="成功率"
                value={stats.successRate}
                suffix="%"
                prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 主表格 */}
      <Card className="glass-card">
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={4} style={{ margin: 0, color: '#fff' }}>定时任务列表</Title>
          </Space>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
            {canWrite && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setCreateModalVisible(true)}
              >
                创建任务
              </Button>
            )}
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            total,
            pageSize: 10,
            onChange: setCurrentPage,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} 条`
          }}
        />
      </Card>

      {/* 创建任务模态框 */}
      <Modal
        title="创建定时任务"
        open={createModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setCreateModalVisible(false)
          form.resetFields()
        }}
        confirmLoading={actionLoading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述"
          >
            <TextArea rows={3} placeholder="请输入任务描述（可选）" />
          </Form.Item>

          <Form.Item
            name="type"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select placeholder="请选择任务类型">
              {TASK_TYPE_OPTIONS.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="deploymentId"
            label="关联部署"
            rules={[{ required: true, message: '请选择关联部署' }]}
          >
            <Select 
              placeholder="请选择关联部署"
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {deploymentOptions.map(deployment => (
                <Option key={deployment.id} value={deployment.id}>
                  {deployment.name} ({deployment.projectName} - {deployment.environment})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="cronExpression"
            label="Cron表达式"
            rules={[{ validator: validateCron }]}
          >
            <Select
              mode="tags"
              placeholder="请输入或选择Cron表达式"
              dropdownRender={(menu) => (
                <div>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #d9d9d9' }}>
                    <Text strong>常用模板：</Text>
                  </div>
                  {menu}
                </div>
              )}
            >
              {CRON_TEMPLATES.map(template => (
                <Option key={template.value} value={template.value}>
                  <div>
                    <div>{template.label} - {template.value}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{template.description}</div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="isActive"
            label="启用状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
