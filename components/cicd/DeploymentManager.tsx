'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  DatePicker,
  Tooltip,
  Checkbox,
  Switch,
  Divider,
  Alert
} from 'antd'
import {
  RocketOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  RollbackOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import OptimizedDeploymentLogViewer from './OptimizedDeploymentLogViewer'
import JenkinsDeploymentLogViewer from './JenkinsDeploymentLogViewer'
import JenkinsDeploymentEditModal from './JenkinsDeploymentEditModal'
import UserSelector from '../../app/components/common/UserSelector'
import ServerSelector from '../../app/components/common/ServerSelector'
import TemplateSelector from '../../app/components/common/TemplateSelector'
import Link from 'next/link'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

interface Deployment {
  id: string
  projectId: string
  name: string
  description?: string
  environment: 'dev' | 'test' | 'prod'
  version?: string
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'deploying' | 'success' | 'failed' | 'rolled_back'
  buildNumber?: number
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  duration?: number
  logs?: string
  userId: string
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    environment: string
  }
  approvals: Array<{
    id: string
    approverId: string
    status: 'pending' | 'approved' | 'rejected'
    comments?: string
    approvedAt?: string
    level: number
    approver: {
      id: string
      username: string
    }
  }>
}

interface Project {
  id: string
  name: string
  environment: string
  repositoryUrl?: string
  branch?: string
  buildScript?: string
  deployScript?: string
}



interface DeploymentManagerProps {
  projectId?: string
}

const DeploymentManager: React.FC<DeploymentManagerProps> = ({ projectId }) => {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [jenkinsJobs, setJenkinsJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [createJenkinsModalVisible, setCreateJenkinsModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [jenkinsEditModalVisible, setJenkinsEditModalVisible] = useState(false)
  const [editingDeployment, setEditingDeployment] = useState<Deployment | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [requireApproval, setRequireApproval] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })

  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [jenkinsForm] = Form.useForm()
  const [deployingIds, setDeployingIds] = useState<Set<string>>(new Set())
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)
  const [logViewerVisible, setLogViewerVisible] = useState(false)
  const [jenkinsLogViewerVisible, setJenkinsLogViewerVisible] = useState(false)
  const [selectedDeploymentForLogs, setSelectedDeploymentForLogs] = useState<Deployment | null>(null)

  // 优化的数据刷新函数
  const refreshData = useCallback(() => {
    loadDeployments(pagination.current)
  }, [pagination.current])

  // 状态轮询 - 在有部署任务运行或待审批时轮询
  useEffect(() => {
    const hasActiveOrPendingTasks = deployments.some(d =>
      d.status === 'deploying' || d.status === 'pending'
    )

    if (!hasActiveOrPendingTasks) {
      return // 没有活跃或待审批的任务，不需要轮询
    }

    console.log('🔄 开始轮询部署状态，检测到活跃或待审批的任务')
    const interval = setInterval(() => {
      refreshData()
    }, 5000) // 每5秒检查一次（降低频率避免过度请求）

    return () => {
      console.log('⏹️ 停止轮询部署状态')
      clearInterval(interval)
    }
  }, [deployments, refreshData])

  // 加载部署任务列表
  const loadDeployments = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.pageSize.toString()
      })

      if (projectId) {
        params.append('projectId', projectId)
      }

      const response = await fetch(`/api/cicd/deployments?${params}`)

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDeployments(result.data.deployments)
          setPagination(prev => ({
            ...prev,
            current: result.data.pagination.page,
            total: result.data.pagination.total
          }))
        } else {
          message.error(result.error || '加载部署任务失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '加载部署任务失败')
      }
    } catch (error) {
      console.error('加载部署任务失败:', error)
      message.error('加载部署任务失败')
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

  // 加载Jenkins任务列表
  const loadJenkinsJobs = async () => {
    try {
      const response = await fetch('/api/jenkins/jobs')
      const result = await response.json()

      if (result.success) {
        setJenkinsJobs(result.data || [])
      } else {
        console.warn('加载Jenkins任务失败:', result.error)
        // 不显示错误消息，因为Jenkins配置可能是可选的
      }
    } catch (error) {
      console.warn('加载Jenkins任务失败:', error)
      // 不显示错误消息，因为Jenkins配置可能是可选的
    }
  }





  // 加载用户列表
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=100')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setUsers(result.data.users || [])
        }
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }

  // 创建部署任务
  const handleCreateDeployment = async (values: any) => {
    try {
      const response = await fetch('/api/cicd/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
          requireApproval: true, // 所有部署任务都需要审批
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success(result.message || '部署任务创建成功')
          setCreateModalVisible(false)
          form.resetFields()
          loadDeployments(pagination.current)
        } else {
          message.error(result.error || '创建部署任务失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '创建部署任务失败')
      }
    } catch (error) {
      console.error('创建部署任务失败:', error)
      message.error('创建部署任务失败')
    }
  }

  // 创建Jenkins部署任务
  const handleCreateJenkinsDeployment = async (values: any) => {
    try {
      const response = await fetch('/api/cicd/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
          requireApproval: true, // 所有部署任务都需要审批
          isJenkinsDeployment: true, // 标记为Jenkins部署任务
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success(result.message || 'Jenkins部署任务创建成功')
          setCreateJenkinsModalVisible(false)
          jenkinsForm.resetFields()
          loadDeployments(pagination.current)
        } else {
          message.error(result.error || '创建Jenkins部署任务失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '创建Jenkins部署任务失败')
      }
    } catch (error) {
      console.error('创建Jenkins部署任务失败:', error)
      message.error('创建Jenkins部署任务失败')
    }
  }

  // 编辑部署任务
  const handleEditDeployment = async (values: any) => {
    if (!editingDeployment) return

    try {
      const response = await fetch(`/api/cicd/deployments/${editingDeployment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : null
        }),
      })

      if (response.ok) {
        const result = await response.json()
        message.success(result.message || '部署任务更新成功')
        setEditModalVisible(false)
        setEditingDeployment(null)
        editForm.resetFields()
        loadDeployments(pagination.current)
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '更新部署任务失败')
      }
    } catch (error) {
      console.error('更新部署任务失败:', error)
      message.error('更新部署任务失败')
    }
  }

  // 删除部署任务
  const handleDeleteDeployment = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/cicd/deployments/${deploymentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        message.success(result.message || '部署任务删除成功')
        loadDeployments(pagination.current)
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '删除部署任务失败')
      }
    } catch (error) {
      console.error('删除部署任务失败:', error)
      message.error('删除部署任务失败')
    }
  }

  // 开始部署
  const handleStartDeployment = async (deployment: Deployment) => {
    if (deployment.status !== 'approved' && deployment.status !== 'scheduled' && deployment.status !== 'failed') {
      message.warning('只有已审批、已计划或失败的部署任务才能开始部署')
      return
    }

    setDeployingIds(prev => new Set(prev).add(deployment.id))

    try {
      console.log(`🚀 开始执行部署: ${deployment.name}`)

      const response = await fetch(`/api/cicd/deployments/${deployment.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        message.success('部署任务已开始执行，请查看实时日志了解进度')
        loadDeployments(pagination.current)

        // 自动打开日志查看器
        setTimeout(() => {
          handleViewLogs(deployment)
        }, 1000)
      } else {
        message.error(result.error || '启动部署失败')
      }
    } catch (error) {
      console.error('启动部署失败:', error)
      message.error('启动部署失败')
    } finally {
      setDeployingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deployment.id)
        return newSet
      })
    }
  }

  // 手动执行部署
  const handleManualExecute = async (deployment: Deployment) => {
    if (deployment.status !== 'approved') {
      message.warning('只有审批通过的部署任务才能手动执行')
      return
    }

    // 确认对话框
    Modal.confirm({
      title: '确认手动执行部署',
      content: (
        <div>
          <p>您确定要手动执行以下部署任务吗？</p>
          <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
            <p><strong>部署名称：</strong>{deployment.name}</p>
            <p><strong>目标环境：</strong>{deployment.environment}</p>
            <p><strong>项目：</strong>{deployment.project?.name || (deployment as any).jenkinsJobName || '未知项目'}</p>
            <p><strong>版本：</strong>{deployment.version || '-'}</p>
          </div>
          <p style={{ marginTop: 12, color: '#fa8c16' }}>
            ⚠️ 手动执行将立即开始部署流程，请确保目标环境准备就绪。
          </p>
        </div>
      ),
      okText: '确认执行',
      cancelText: '取消',
      okType: 'primary',
      icon: <PlayCircleOutlined style={{ color: '#1890ff' }} />,
      onOk: async () => {
        setDeployingIds(prev => new Set(prev).add(deployment.id))

        try {
          console.log(`🔧 手动执行部署: ${deployment.name}`)

          const response = await fetch(`/api/cicd/deployments/${deployment.id}/execute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              manualExecution: true, // 标识为手动执行
              executionReason: '用户手动触发执行'
            })
          })

          const result = await response.json()

          if (result.success) {
            message.success('部署任务已手动启动，请查看实时日志了解进度')
            loadDeployments(pagination.current)

            // 自动打开日志查看器
            setTimeout(() => {
              handleViewLogs(deployment)
            }, 1000)
          } else {
            message.error(result.error || '手动执行部署失败')
          }
        } catch (error) {
          console.error('手动执行部署失败:', error)
          message.error('手动执行部署失败')
        } finally {
          setDeployingIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(deployment.id)
            return newSet
          })
        }
      }
    })
  }

  // 停止部署
  const handleStopDeployment = async (deployment: Deployment) => {
    if (deployment.status !== 'deploying') {
      message.warning('只有正在部署的任务才能停止')
      return
    }

    try {
      console.log(`⏹️ 停止部署: ${deployment.name}`)

      const response = await fetch(`/api/cicd/deployments/${deployment.id}/execute`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        message.success('部署已停止')
        loadDeployments(pagination.current)
      } else {
        message.error(result.error || '停止部署失败')
      }
    } catch (error) {
      console.error('停止部署失败:', error)
      message.error('停止部署失败')
    }
  }

  // 回滚部署
  const handleRollbackDeployment = async (deployment: Deployment) => {
    if (deployment.status !== 'success' && deployment.status !== 'failed') {
      message.warning('只有成功或失败的部署才能回滚')
      return
    }

    try {
      const response = await fetch(`/api/cicd/deployments/${deployment.id}/rollback`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        message.success('回滚操作已开始')
        loadDeployments(pagination.current)
      } else {
        message.error(result.error || '回滚操作失败')
      }
    } catch (error) {
      console.error('回滚操作失败:', error)
      message.error('回滚操作失败')
    }
  }

  // 查看部署详情
  const handleViewDetail = (deployment: Deployment) => {
    setSelectedDeployment(deployment)
    setDetailModalVisible(true)
  }

  // 查看实时日志
  const handleViewLogs = (deployment: Deployment) => {
    setSelectedDeploymentForLogs(deployment)

    // 根据部署任务类型选择不同的日志查看器
    if ((deployment as any).isJenkinsDeployment) {
      setJenkinsLogViewerVisible(true)
    } else {
      setLogViewerVisible(true)
    }
  }

  // 状态标签渲染
  const renderStatusBadge = (status: string, deployment?: Deployment) => {
    const statusConfig = {
      pending: { color: 'orange', text: '等待审批' },
      approved: { color: 'green', text: '已审批' },
      rejected: { color: 'red', text: '已拒绝' },
      scheduled: { color: 'blue', text: '已计划' },
      deploying: { color: 'processing', text: '部署中' },
      success: { color: 'success', text: '部署成功' },
      failed: { color: 'error', text: '部署失败' },
      rolled_back: { color: 'warning', text: '已回滚' }
    }

    let config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }

    // 如果是部署中状态，尝试从日志中提取当前阶段
    if (status === 'deploying' && deployment?.logs) {
      const currentStage = extractCurrentStage(deployment.logs)
      if (currentStage) {
        config = { color: 'processing', text: currentStage }
      }
    }

    return <Badge status={config.color as any} text={config.text} />
  }

  // 从部署日志中提取当前执行阶段
  const extractCurrentStage = (logs: string): string => {
    const lines = logs.split('\n').reverse() // 从最新的日志开始查找

    const stagePatterns = [
      { pattern: /🚀 开始完整部署流程/, stage: '初始化部署' },
      { pattern: /📁 准备工作目录/, stage: '准备工作目录' },
      { pattern: /📥 开始拉取代码/, stage: '拉取代码中' },
      { pattern: /🔨 开始本地构建/, stage: '本地构建中' },
      { pattern: /🚀 开始远程部署/, stage: '远程部署中' },
      { pattern: /📡 获取主机配置/, stage: '连接目标主机' },
      { pattern: /📤 开始传输构建产物/, stage: '传输文件中' },
      { pattern: /🔧 开始执行部署脚本/, stage: '执行部署脚本' },
      { pattern: /🔍 验证部署结果/, stage: '验证部署结果' },
      { pattern: /🧹 清理工作目录/, stage: '清理工作目录' },
      { pattern: /✅.*完成/, stage: '即将完成' }
    ]

    for (const line of lines) {
      for (const { pattern, stage } of stagePatterns) {
        if (pattern.test(line)) {
          return stage
        }
      }
    }

    return '部署中'
  }

  // 环境标签渲染
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
  const columns: ColumnsType<Deployment> = [
    {
      title: '部署名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div className="text-gray-500 text-sm">{record.description}</div>
          )}
        </div>
      )
    },
    {
      title: '项目',
      dataIndex: ['project', 'name'],
      key: 'project'
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: renderEnvironmentTag
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Deployment) => renderStatusBadge(status, record)
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (text) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Deployment) => {
        const canStart = record.status === 'approved' || record.status === 'scheduled'
        const canStop = record.status === 'deploying'
        const canRollback = record.status === 'success' || record.status === 'failed'
        const canManualExecute = record.status === 'approved' // 只有审批通过后才能手动执行
        const isDeploying = deployingIds.has(record.id)

        return (
          <Space wrap>
            <Tooltip title="查看详情">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record)}
              />
            </Tooltip>

            <Tooltip title="查看实时日志">
              <Button
                type="text"
                icon={<FileTextOutlined />}
                onClick={() => handleViewLogs(record)}
              />
            </Tooltip>

            {/* 手动执行按钮 - 只在审批通过时显示 */}
            {canManualExecute && (
              <Tooltip title="手动执行部署">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  disabled={isDeploying}
                  loading={isDeploying}
                  onClick={() => handleManualExecute(record)}
                  style={{
                    color: '#1890ff',
                    fontWeight: 'bold'
                  }}
                />
              </Tooltip>
            )}

            {/* 自动开始部署按钮 - 在计划任务或失败重试时显示 */}
            {canStart && !canManualExecute && (
              <Tooltip title="开始部署">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  loading={isDeploying}
                  onClick={() => handleStartDeployment(record)}
                  style={{ color: '#52c41a' }}
                />
              </Tooltip>
            )}

            {canStop && (
              <Tooltip title="停止部署">
                <Button
                  type="text"
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleStopDeployment(record)}
                  style={{ color: '#fa8c16' }}
                />
              </Tooltip>
            )}

            {canRollback && (
              <Popconfirm
                title="确定要回滚这个部署吗？"
                onConfirm={() => handleRollbackDeployment(record)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="回滚">
                  <Button
                    type="text"
                    icon={<RollbackOutlined />}
                    style={{ color: '#fa541c' }}
                  />
                </Tooltip>
              </Popconfirm>
            )}

            <Tooltip title="编辑">
              <Button
                type="text"
                icon={<EditOutlined />}
                disabled={record.status === 'deploying'}
                onClick={() => {
                  setEditingDeployment(record)

                  // 根据部署任务类型打开不同的编辑模态框
                  if ((record as any).isJenkinsDeployment) {
                    setJenkinsEditModalVisible(true)
                  } else {
                    editForm.setFieldsValue({
                      ...record,
                      scheduledAt: record.scheduledAt ? dayjs(record.scheduledAt) : undefined
                    })
                    setEditModalVisible(true)
                  }
                }}
              />
            </Tooltip>

            <Popconfirm
              title="确定要删除这个部署任务吗？"
              onConfirm={() => handleDeleteDeployment(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={record.status === 'deploying'}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    }
  ]

  // 初始化加载
  useEffect(() => {
    loadDeployments()
    loadProjects()
    loadJenkinsJobs()
    loadUsers()

    // 设置定时刷新，每30秒检查一次状态更新
    const interval = setInterval(() => {
      loadDeployments(pagination.current)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // 监听页面焦点变化，实时更新数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // 页面重新获得焦点时刷新数据
        loadDeployments(pagination.current)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pagination.current])

  // 监听实时通知，当收到部署状态更新时刷新数据
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'deployment_status_update') {
        console.log('🔄 收到部署状态更新通知，刷新部署列表')
        loadDeployments(pagination.current)
        // 清除通知标记
        localStorage.removeItem('deployment_status_update')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [pagination.current])

  // 轮询广播消息，实现实时数据同步
  useEffect(() => {
    let lastCheckTime = new Date().toISOString()

    const checkBroadcastMessages = async () => {
      try {
        const response = await fetch(`/api/notifications/broadcast?type=deployment_status_update&since=${lastCheckTime}`)
        const result = await response.json()

        if (result.success && result.data.length > 0) {
          console.log('📡 收到广播消息，刷新部署列表:', result.data.length)
          loadDeployments(pagination.current)
          lastCheckTime = new Date().toISOString()
        }
      } catch (error) {
        console.error('❌ 检查广播消息失败:', error)
      }
    }

    // 每5秒检查一次广播消息
    const broadcastInterval = setInterval(checkBroadcastMessages, 5000)

    return () => clearInterval(broadcastInterval)
  }, [pagination.current])

  return (
    <div>
      {/* Jenkins部署任务提示 */}
      <Alert
        message="Jenkins部署任务管理"
        description={
          <div>
            <p>Jenkins部署任务现在有专门的管理页面，提供更好的配置和执行体验。</p>
            <Link href="/cicd/jenkins-deployments">
              <Button type="primary" size="small" icon={<RocketOutlined />}>
                前往Jenkins部署任务管理
              </Button>
            </Link>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 操作栏 */}
      <Card className="glass-card mb-4">
        <div className="flex justify-between items-center">
          <div>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建部署任务
              </Button>
              {/* Jenkins部署任务创建功能已迁移到专门的Jenkins部署任务页面 */}
              {/*
              <Button
                type="default"
                icon={<RocketOutlined />}
                onClick={() => setCreateJenkinsModalVisible(true)}
              >
                创建Jenkins部署任务
              </Button>
              */}
            </Space>
          </div>
          <div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadDeployments(pagination.current)}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        </div>
      </Card>

      {/* 部署任务表格 */}
      <Card className="glass-card">
        <Table
          columns={columns}
          dataSource={deployments}
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
              loadDeployments(page)
            },
          }}
        />
      </Card>

      {/* 创建部署任务模态框 */}
      <Modal
        title="创建部署任务"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateDeployment}
        >
          <Form.Item
            name="projectId"
            label="项目"
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select
              placeholder="选择项目"
              onChange={(value) => {
                // 自动填充项目相关信息
                const selectedProject = projects.find(p => p.id === value)
                if (selectedProject) {
                  form.setFieldsValue({
                    environment: selectedProject.environment,
                    name: `${selectedProject.name} - 部署`,
                    description: `${selectedProject.name} 项目部署任务`
                  })
                }


              }}
            >
              {projects.map(project => (
                <Option key={project.id} value={project.id}>
                  {project.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 项目配置信息已删除 */}

          <Form.Item
            name="name"
            label="部署名称"
            rules={[{ required: true, message: '请输入部署名称' }]}
          >
            <Input placeholder="输入部署名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="输入部署描述" />
          </Form.Item>

          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select placeholder="选择环境">
              <Option value="dev">开发环境</Option>
              <Option value="test">测试环境</Option>
              <Option value="prod">生产环境</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
          >
            <Input placeholder="输入版本号" />
          </Form.Item>

          <Divider orientation="left">部署配置</Divider>

          <Form.Item
            name="templateId"
            label="部署模板"
            tooltip="选择预定义的部署模板，可以简化部署配置"
          >
            <TemplateSelector
              placeholder="选择部署模板（可选）"
              allowClear
              style={{ width: '100%' }}

            />
          </Form.Item>

          <Form.Item
            name="deploymentHosts"
            label="部署主机"
            rules={[{ required: true, message: '请选择部署主机' }]}
            tooltip="选择要部署到的目标主机"
          >
            <ServerSelector
              placeholder="选择部署主机"
              mode="multiple"
              style={{ width: '100%' }}
              environment={form.getFieldValue('environment')}
            />
          </Form.Item>

          <Form.Item
            name="notificationUsers"
            label="通知人员"
            tooltip="选择在部署状态变更时需要通知的人员"
          >
            <UserSelector
              placeholder="选择通知人员（可选）"
              mode="multiple"
              style={{ width: '100%' }}
            />
          </Form.Item>



          <Form.Item
            name="scheduledAt"
            label="计划部署时间"
          >
            <DatePicker
              showTime
              placeholder="选择计划部署时间（可选）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider orientation="left">审批配置</Divider>

          <Form.Item
            name="approvalUsers"
            label="审批人员"
            rules={[{ required: true, message: '请选择审批人员' }]}
            tooltip="选择有权限审批此部署任务的人员"
          >
            <UserSelector
              placeholder="选择审批人员"
              mode="multiple"
              style={{ width: '100%' }}
            />
          </Form.Item>

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

      {/* 编辑部署任务模态框 */}
      <Modal
        title="编辑部署任务"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingDeployment(null)
          editForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditDeployment}
        >
          <Form.Item
            name="name"
            label="部署名称"
            rules={[{ required: true, message: '请输入部署名称' }]}
          >
            <Input placeholder="输入部署名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              placeholder="输入部署描述（可选）"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true, message: '请选择部署环境' }]}
          >
            <Select placeholder="选择部署环境">
              <Option value="dev">开发环境</Option>
              <Option value="test">测试环境</Option>
              <Option value="prod">生产环境</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
          >
            <Input placeholder="输入版本号（可选）" />
          </Form.Item>

          <Divider orientation="left">部署配置</Divider>

          <Form.Item
            name="deploymentHosts"
            label="部署主机"
            rules={[{ required: true, message: '请选择部署主机' }]}
            tooltip="选择要部署到的目标主机"
          >
            <ServerSelector
              placeholder="选择部署主机"
              mode="multiple"
              style={{ width: '100%' }}
              environment={editForm.getFieldValue('environment')}
            />
          </Form.Item>

          <Form.Item
            name="notificationUsers"
            label="通知人员"
            tooltip="选择在部署状态变更时需要通知的人员"
          >
            <UserSelector
              placeholder="选择通知人员（可选）"
              mode="multiple"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="scheduledAt"
            label="计划部署时间"
          >
            <DatePicker
              showTime
              placeholder="选择计划部署时间（可选）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider orientation="left">审批配置</Divider>

          <Form.Item
            name="approvalUsers"
            label="审批人员"
            rules={[{ required: true, message: '请选择审批人员' }]}
            tooltip="选择有权限审批此部署任务的人员"
          >
            <UserSelector
              placeholder="选择审批人员"
              mode="multiple"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setEditModalVisible(false)
                setEditingDeployment(null)
                editForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存修改
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建Jenkins部署任务模态框 */}
      <Modal
        title="创建Jenkins部署任务"
        open={createJenkinsModalVisible}
        onCancel={() => {
          setCreateJenkinsModalVisible(false)
          jenkinsForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={jenkinsForm}
          layout="vertical"
          onFinish={handleCreateJenkinsDeployment}
        >
          <Form.Item
            name="name"
            label="部署名称"
            rules={[{ required: true, message: '请输入部署名称' }]}
          >
            <Input placeholder="输入部署名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="输入部署描述" />
          </Form.Item>

          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select placeholder="选择环境">
              <Option value="dev">开发环境</Option>
              <Option value="test">测试环境</Option>
              <Option value="prod">生产环境</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
          >
            <Input placeholder="输入版本号" />
          </Form.Item>

          <Divider orientation="left">Jenkins配置</Divider>

          <Form.Item
            name="jenkinsJobIds"
            label="Jenkins任务"
            rules={[{ required: true, message: '请选择至少一个Jenkins任务' }]}
            tooltip="选择要执行的Jenkins任务（支持多选）"
          >
            <Select
              mode="multiple"
              placeholder="选择Jenkins任务（支持多选）"
              style={{ width: '100%' }}
              showSearch
              maxTagCount="responsive"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              optionLabelProp="label"
            >
              {jenkinsJobs.map(job => (
                <Option key={job.id} value={job.id} label={job.name}>
                  <div style={{
                    padding: '4px 0',
                    maxWidth: '100%',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      fontWeight: 'bold',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%'
                    }}>
                      {job.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      marginTop: '2px'
                    }}>
                      {job.description || job.url}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledAt"
            label="计划部署时间"
          >
            <DatePicker
              showTime
              placeholder="选择计划部署时间（可选）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider orientation="left">人员配置</Divider>

          <Form.Item
            name="approvalUsers"
            label="审批人员"
            rules={[{ required: true, message: '请选择审批人员' }]}
            tooltip="选择有权限审批此部署任务的人员"
          >
            <UserSelector
              placeholder="选择审批人员"
              mode="multiple"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="notificationUsers"
            label="通知人员"
            tooltip="选择在部署状态变更时需要通知的人员"
          >
            <UserSelector
              placeholder="选择通知人员（可选）"
              mode="multiple"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setCreateJenkinsModalVisible(false)
                jenkinsForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 部署详情模态框 */}
      <Modal
        title={
          <Space>
            <InfoCircleOutlined />
            部署详情
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setSelectedDeployment(null)
        }}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedDeployment && (
          <div>
            <Card size="small" className="mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Text strong>部署名称：</Text>
                  <Text>{selectedDeployment.name}</Text>
                </div>
                <div>
                  <Text strong>状态：</Text>
                  {renderStatusBadge(selectedDeployment.status)}
                </div>
                <div>
                  <Text strong>环境：</Text>
                  {renderEnvironmentTag(selectedDeployment.environment)}
                </div>
                <div>
                  <Text strong>版本：</Text>
                  <Text>{selectedDeployment.version || '-'}</Text>
                </div>
                <div>
                  <Text strong>所属项目：</Text>
                  <Text>
                    {(selectedDeployment as any).isJenkinsDeployment
                      ? ((selectedDeployment as any).jenkinsJobName || selectedDeployment.project?.name || '未知Jenkins任务')
                      : (selectedDeployment.project?.name || '未知项目')
                    }
                  </Text>
                </div>
                <div>
                  <Text strong>构建号：</Text>
                  <Text>{selectedDeployment.buildNumber || '-'}</Text>
                </div>
              </div>
            </Card>

            {selectedDeployment.description && (
              <Card size="small" title="描述" className="mb-4">
                <Text>{selectedDeployment.description}</Text>
              </Card>
            )}

            {selectedDeployment.approvals && selectedDeployment.approvals.length > 0 && (
              <Card size="small" title="审批信息" className="mb-4">
                <div className="space-y-2">
                  {selectedDeployment.approvals.map((approval) => (
                    <div key={approval.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div>
                        <Text strong>审批人：</Text>
                        <Text>{approval.approver?.username || '未知用户'}</Text>
                        <Text className="ml-4 text-gray-500">级别 {approval.level}</Text>
                      </div>
                      <div>
                        {approval.status === 'approved' && (
                          <Tag color="green" icon={<CheckCircleOutlined />}>已通过</Tag>
                        )}
                        {approval.status === 'rejected' && (
                          <Tag color="red" icon={<CloseCircleOutlined />}>已拒绝</Tag>
                        )}
                        {approval.status === 'pending' && (
                          <Tag color="orange">待审批</Tag>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}


          </div>
        )}
      </Modal>

      {/* Jenkins部署任务编辑模态框 */}
      <JenkinsDeploymentEditModal
        visible={jenkinsEditModalVisible}
        deployment={editingDeployment}
        onCancel={() => {
          setJenkinsEditModalVisible(false)
          setEditingDeployment(null)
        }}
        onSuccess={() => {
          setJenkinsEditModalVisible(false)
          setEditingDeployment(null)
          loadDeployments(pagination.current)
        }}
      />

      {/* 持续部署实时日志查看器 */}
      <OptimizedDeploymentLogViewer
        visible={logViewerVisible}
        onClose={() => setLogViewerVisible(false)}
        deploymentId={selectedDeploymentForLogs?.id || ''}
        deploymentName={selectedDeploymentForLogs?.name || ''}
        isJenkinsDeployment={(selectedDeploymentForLogs as any)?.isJenkinsDeployment || false}
        jenkinsJobId={(selectedDeploymentForLogs as any)?.jenkinsJobId || undefined}
        jenkinsBuildNumber={(selectedDeploymentForLogs as any)?.buildNumber || undefined}
      />

      {/* Jenkins部署实时日志查看器 */}
      <JenkinsDeploymentLogViewer
        visible={jenkinsLogViewerVisible}
        onClose={() => setJenkinsLogViewerVisible(false)}
        deploymentId={selectedDeploymentForLogs?.id || ''}
        deploymentName={selectedDeploymentForLogs?.name || ''}
        jenkinsJobIds={(selectedDeploymentForLogs as any)?.jenkinsJobIds as string[] || []}
        jenkinsJobName={(selectedDeploymentForLogs as any)?.jenkinsJobName || undefined}
      />
    </div>
  )
}

export default DeploymentManager
