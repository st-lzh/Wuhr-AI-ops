'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Modal,
  Form,
  Select,
  Switch,
  message,
  Alert,
  Tooltip,
  Divider,
  DatePicker
} from 'antd'
import {
  PlusOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  ApiOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useGlobalState'
import UserSelector from '../../components/common/UserSelector'

const { Title, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input
const { confirm } = Modal

interface JenkinsDeployment {
  id: string
  name: string
  description?: string
  environment: string
  version?: string
  jenkinsJobIds: string[]
  jenkinsJobName?: string
  status: string
  requireApproval: boolean
  scheduledAt?: string
  approvalUsers?: string[]
  notificationUsers?: string[]
  createdAt: string
  updatedAt: string
  user: {
    username: string
  }
}

interface JenkinsConfig {
  id: string
  name: string
  serverUrl: string
  username?: string
  isActive: boolean
}

interface JenkinsJob {
  name: string
  description?: string
  buildable: boolean
}

const JenkinsDeploymentsPage: React.FC = () => {
  const { canAccessCICD, hasPermission, role, isAuthenticated } = usePermissions()
  const { isDark } = useTheme()

  // 超级管理员拥有所有权限
  const canRead = role === 'admin' || canAccessCICD('read') || hasPermission('cicd:read')
  const canWrite = role === 'admin' || canAccessCICD('write') || hasPermission('cicd:write')


  const [deployments, setDeployments] = useState<JenkinsDeployment[]>([])
  const [jenkinsConfigs, setJenkinsConfigs] = useState<JenkinsConfig[]>([])
  const [jenkinsJobs, setJenkinsJobs] = useState<JenkinsJob[]>([])
  const [loading, setLoading] = useState(false)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [editingDeployment, setEditingDeployment] = useState<JenkinsDeployment | null>(null)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [configForm] = Form.useForm()
  const [testLoading, setTestLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentLogs, setCurrentLogs] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<JenkinsDeployment | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  // 加载Jenkins配置
  const loadJenkinsConfigs = async () => {
    try {
      const response = await fetch('/api/cicd/jenkins', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        const configs = data.data.configs || []
        setJenkinsConfigs(configs)
        console.log('✅ Jenkins配置加载完成:', {
          配置数量: configs.length,
          配置详情: configs.map((c: any) => ({
            id: c.id,
            name: c.name,
            serverUrl: c.serverUrl,
            username: c.username,
            isActive: c.isActive,
            hasApiToken: !!c.apiToken
          }))
        })
      }
    } catch (error) {
      console.error('❌ 加载Jenkins配置失败:', error)
    }
  }

  // 加载Jenkins任务列表
  const loadJenkinsJobs = async () => {
    const activeConfig = jenkinsConfigs.find(config =>
      config.isActive && config.serverUrl && config.username
    )

    console.log('🔍 加载Jenkins任务:', {
      配置数量: jenkinsConfigs.length,
      激活配置: activeConfig ? {
        id: activeConfig.id,
        name: activeConfig.name,
        serverUrl: activeConfig.serverUrl,
        username: activeConfig.username,
        hasApiToken: !!(activeConfig as any).apiToken
      } : null
    })

    if (!activeConfig) {
      console.log('❌ 没有找到激活的Jenkins配置')
      console.log('📋 当前所有配置:', jenkinsConfigs.map(c => ({
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        hasServerUrl: !!c.serverUrl,
        hasUsername: !!c.username,
        hasApiToken: !!(c as any).apiToken
      })))
      setJenkinsJobs([])
      return
    }

    try {
      setJobsLoading(true)
      console.log(`🔄 正在从Jenkins获取任务列表: ${activeConfig.serverUrl}`)

      const response = await fetch(`/api/cicd/jenkins/${activeConfig.id}/jobs`, {
        credentials: 'include'
      })

      console.log('📡 Jenkins任务API响应:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      const data = await response.json()
      console.log('📋 Jenkins任务数据:', data)

      if (data.success) {
        const jobs = data.data.jobs || []
        console.log(`✅ 成功加载 ${jobs.length} 个Jenkins任务:`, jobs.map((j: any) => j.name))
        setJenkinsJobs(jobs)
      } else {
        console.error('❌ Jenkins任务加载失败:', data.error)
        setJenkinsJobs([])
      }
    } catch (error) {
      console.error('❌ 加载Jenkins任务异常:', error)
      setJenkinsJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  // 加载Jenkins部署任务
  const loadDeployments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/cicd/deployments?jenkinsOnly=true', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setDeployments(data.data.deployments || [])
      } else {
        message.error(data.error || '加载失败')
      }
    } catch (error) {
      console.error('加载Jenkins部署任务失败:', error)
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('🔄 页面初始化，加载Jenkins配置和部署任务')
    loadJenkinsConfigs()
    loadDeployments()
  }, [])

  // 当Jenkins配置加载完成后，加载任务列表
  useEffect(() => {
    if (jenkinsConfigs.length > 0) {
      loadJenkinsJobs()
    }
  }, [jenkinsConfigs])

  // 检查Jenkins配置是否完整
  const hasValidJenkinsConfig = () => {
    return jenkinsConfigs.some(config =>
      config.isActive && config.serverUrl && config.username
    )
  }

  // 获取当前Jenkins配置
  const getCurrentJenkinsConfig = () => {
    return jenkinsConfigs.find(config => config.isActive) || null
  }

  // 加载Jenkins配置到表单
  const loadJenkinsConfigToForm = () => {
    const currentConfig = getCurrentJenkinsConfig()
    if (currentConfig) {
      configForm.setFieldsValue({
        name: currentConfig.name,
        serverUrl: currentConfig.serverUrl,
        username: currentConfig.username,
        apiToken: (currentConfig as any).apiToken,
        isActive: currentConfig.isActive
      })
    } else {
      configForm.setFieldsValue({
        isActive: true
      })
    }
  }

  // 测试Jenkins连接
  const testJenkinsConnection = async () => {
    try {
      const values = await configForm.validateFields()
      setTestLoading(true)
      setTestResult(null)

      const response = await fetch('/api/cicd/jenkins/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      })

      const data = await response.json()
      setTestResult(data)

      if (data.success) {
        message.success('Jenkins连接测试成功')
      } else {
        message.error(data.message || 'Jenkins连接测试失败')
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      setTestResult({
        success: false,
        message: '测试连接时发生错误'
      })
      message.error('测试连接失败')
    } finally {
      setTestLoading(false)
    }
  }

  // 保存Jenkins配置
  const saveJenkinsConfig = async () => {
    try {
      const values = await configForm.validateFields()
      setConfigLoading(true)

      const currentConfig = getCurrentJenkinsConfig()
      const url = currentConfig
        ? `/api/cicd/jenkins/${currentConfig.id}`
        : '/api/cicd/jenkins'

      const method = currentConfig ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      })

      const data = await response.json()

      if (data.success) {
        message.success('Jenkins配置保存成功')
        setConfigModalVisible(false)
        configForm.resetFields()
        setTestResult(null)
        // 重新加载配置
        loadJenkinsConfigs()
      } else {
        message.error(data.error || '保存配置失败')
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      message.error('保存配置失败')
    } finally {
      setConfigLoading(false)
    }
  }

  // 处理创建/编辑提交
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)
      
      const url = editingDeployment 
        ? `/api/cicd/deployments/${editingDeployment.id}`
        : '/api/cicd/deployments'
      
      const method = editingDeployment ? 'PUT' : 'POST'
      
      const payload = {
        ...values,
        isJenkinsDeployment: true,
        jenkinsJobIds: values.jenkinsJobIds || [],
        // 确保日期格式正确
        scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : null
      }

      console.log('📤 提交Jenkins部署任务数据:', payload)

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        message.success(editingDeployment ? '更新成功' : '创建成功')
        setCreateModalVisible(false)
        setEditingDeployment(null)
        form.resetFields()
        loadDeployments()
      } else {
        message.error(data.error || '操作失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      message.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  // 处理删除
  const handleDelete = (deployment: JenkinsDeployment) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除Jenkins部署任务"${deployment.name}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      className: 'custom-modal',
      onOk: async () => {
        try {
          const response = await fetch(`/api/cicd/deployments/${deployment.id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
          const data = await response.json()
          if (data.success) {
            message.success('删除成功')
            loadDeployments()
          } else {
            message.error(data.error || '删除失败')
          }
        } catch (error) {
          console.error('删除失败:', error)
          message.error('删除失败')
        }
      }
    })
  }

  // 处理编辑
  const handleEdit = (deployment: JenkinsDeployment) => {
    setEditingDeployment(deployment)
    form.setFieldsValue({
      name: deployment.name,
      description: deployment.description,
      environment: deployment.environment,
      version: deployment.version,
      jenkinsJobIds: deployment.jenkinsJobIds,
      scheduledAt: deployment.scheduledAt ? new Date(deployment.scheduledAt) : null,
      approvalUsers: deployment.approvalUsers || [],
      notificationUsers: deployment.notificationUsers || []
    })
    setCreateModalVisible(true)
    // 编辑时也需要加载Jenkins任务
    loadJenkinsJobs()
  }

  // 执行Jenkins任务
  const executeJenkinsTask = async (deployment: JenkinsDeployment) => {
    try {
      console.log('🚀 开始执行Jenkins任务:', deployment.name)

      const response = await fetch(`/api/cicd/deployments/${deployment.id}/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        message.success(`Jenkins任务 "${deployment.name}" 开始执行`)
        loadDeployments() // 刷新列表
      } else {
        message.error(data.error || 'Jenkins任务执行失败')
      }
    } catch (error) {
      console.error('执行Jenkins任务失败:', error)
      message.error('执行Jenkins任务失败')
    }
  }

  // 查看Jenkins执行日志
  const viewJenkinsLogs = async (deployment: JenkinsDeployment) => {
    try {
      setSelectedDeployment(deployment)
      setLogModalVisible(true)
      setLogLoading(true)
      setCurrentLogs('')

      console.log('📋 获取Jenkins执行日志:', deployment.name)

      const response = await fetch(`/api/cicd/deployments/${deployment.id}/logs`, {
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setCurrentLogs(data.logs || '暂无日志信息')
      } else {
        setCurrentLogs(`获取日志失败: ${data.error}`)
      }
    } catch (error) {
      console.error('获取Jenkins日志失败:', error)
      setCurrentLogs('获取日志失败，请稍后重试')
    } finally {
      setLogLoading(false)
    }
  }

  // 查看任务详情
  const viewDeploymentDetail = (deployment: JenkinsDeployment) => {
    setSelectedDeployment(deployment)
    setDetailModalVisible(true)
  }

  // 状态标签渲染
  const renderStatusTag = (status: string) => {
    const statusConfig = {
      pending: { color: 'orange', text: '等待审批' },
      approved: { color: 'green', text: '审批通过' },
      rejected: { color: 'red', text: '审批拒绝' },
      scheduled: { color: 'blue', text: '已计划' },
      deploying: { color: 'blue', text: '部署中' },
      success: { color: 'green', text: '部署成功' },
      failed: { color: 'red', text: '部署失败' },
      rolled_back: { color: 'orange', text: '已回滚' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: JenkinsDeployment) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.description && (
            <div className="text-sm text-gray-500">{record.description}</div>
          )}
        </div>
      )
    },
    {
      title: 'Jenkins任务',
      dataIndex: 'jenkinsJobIds',
      key: 'jenkinsJobIds',
      render: (jobIds: string[]) => (
        <div>
          {jobIds && jobIds.length > 0 ? (
            jobIds.map(jobId => (
              <Tag key={jobId} color="blue">{jobId}</Tag>
            ))
          ) : (
            <span className="text-gray-400">未配置</span>
          )}
        </div>
      )
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: string) => {
        const envConfig = {
          dev: { color: 'green', text: '开发' },
          test: { color: 'orange', text: '测试' },
          prod: { color: 'red', text: '生产' }
        }
        const config = envConfig[env as keyof typeof envConfig] || { color: 'default', text: env }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: renderStatusTag
    },
    {
      title: '需要审批',
      dataIndex: 'requireApproval',
      key: 'requireApproval',
      render: (requireApproval: boolean) => (
        requireApproval ? 
          <CheckCircleOutlined className="text-green-500" /> : 
          <span className="text-gray-400">否</span>
      )
    },
    {
      title: '创建者',
      dataIndex: ['user', 'username'],
      key: 'creator'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: JenkinsDeployment) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => viewDeploymentDetail(record)}
            />
          </Tooltip>
          <Tooltip title="查看日志">
            <Button
              type="text"
              icon={<FileTextOutlined />}
              size="small"
              onClick={() => viewJenkinsLogs(record)}
            />
          </Tooltip>
          {canWrite && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              {record.status === 'approved' && (
                <Tooltip title="执行任务">
                  <Button
                    type="text"
                    icon={<PlayCircleOutlined />}
                    size="small"
                    onClick={() => executeJenkinsTask(record)}
                  />
                </Tooltip>
              )}
              {(!record.approvalUsers || record.approvalUsers.length === 0) && record.status === 'pending' && (
                <Tooltip title="手动执行">
                  <Button
                    type="text"
                    icon={<PlayCircleOutlined />}
                    size="small"
                    onClick={() => executeJenkinsTask(record)}
                  />
                </Tooltip>
              )}
              <Tooltip title="删除">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <MainLayout>
      <style jsx global>{`
        .custom-modal .ant-modal-content {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .custom-modal .ant-modal-body {
          color: #262626;
          line-height: 1.5;
        }
        .ant-modal-content {
          background-color: #ffffff;
        }
        .ant-modal-body {
          color: #262626;
        }
      `}</style>
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <RocketOutlined className="mr-2" />
            Jenkins部署
          </Title>
          <Paragraph type="secondary" className="mb-0">
            专门管理Jenkins部署任务，确保配置正确和执行可靠
          </Paragraph>
        </div>

        {/* Jenkins配置检查 */}
        {!hasValidJenkinsConfig() && (
          <Alert
            message="Jenkins配置不完整"
            description={
              <div>
                <p>在创建Jenkins部署任务之前，请先完成Jenkins配置。</p>
                <Button
                  type="primary"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    loadJenkinsConfigToForm()
                    setTestResult(null)
                    setConfigModalVisible(true)
                  }}
                >
                  配置Jenkins
                </Button>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}



        {/* 操作栏 */}
        <Card className="glass-card mb-4">
          <div className="flex justify-between items-center">
            <Space>
              <Input.Search
                placeholder="搜索任务名称"
                allowClear
                style={{ width: 300 }}
                onSearch={(value) => setSearchText(value)}
              />
              <Button
                icon={<SettingOutlined />}
                onClick={() => {
                  loadJenkinsConfigToForm()
                  setTestResult(null)
                  setConfigModalVisible(true)
                }}
              >
                Jenkins配置
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  console.log('🚀 点击创建Jenkins部署任务')
                  setEditingDeployment(null)
                  form.resetFields()
                  setCreateModalVisible(true)
                  // 打开模态框时加载Jenkins任务
                  loadJenkinsJobs()
                }}
                disabled={!canWrite || !hasValidJenkinsConfig()}
                title={
                  !canWrite ? '没有写权限' :
                  !hasValidJenkinsConfig() ? '请先完成Jenkins配置' :
                  '创建Jenkins部署任务'
                }
              >
                创建Jenkins部署任务
                {(!canWrite || !hasValidJenkinsConfig()) && (
                  <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.7 }}>
                    {!canWrite ? '(无权限)' : '(需配置)'}
                  </span>
                )}
              </Button>
            </Space>
          </div>
        </Card>

        {/* 任务列表 */}
        <Card className="glass-card">
          <Table
            columns={columns}
            dataSource={deployments.filter(d =>
              !searchText || d.name.toLowerCase().includes(searchText.toLowerCase())
            )}
            rowKey="id"
            loading={loading}
            pagination={{
              total: deployments.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        </Card>

        {/* 创建/编辑模态框 */}
        <Modal
          title={editingDeployment ? '编辑Jenkins部署任务' : '创建Jenkins部署任务'}
          open={createModalVisible}
          onCancel={() => {
            setCreateModalVisible(false)
            setEditingDeployment(null)
            form.resetFields()
          }}
          footer={null}
          width={680}
          className="custom-modal"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              environment: 'dev',
              requireApproval: false
            }}
          >
            <Alert
              message="Jenkins部署任务说明"
              description="Jenkins部署任务专门用于执行Jenkins作业，确保配置信息正确传递给Jenkins服务器。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

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
                loading={jobsLoading}
                filterOption={(input, option) =>
                  option?.value?.toString().toLowerCase().includes(input.toLowerCase()) || false
                }
              >
                {jenkinsJobs.map(job => (
                  <Option key={job.name} value={job.name} disabled={!job.buildable}>
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
                      {job.description && (
                        <div style={{
                          fontSize: '12px',
                          color: '#666',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                          marginTop: '2px'
                        }}>
                          {job.description}
                        </div>
                      )}
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="version"
              label="版本号"
            >
              <Input placeholder="输入版本号" />
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
              tooltip="选择有权限审批此部署任务的人员（可选，不选择则可直接执行）"
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
                <Button
                  onClick={() => {
                    setCreateModalVisible(false)
                    setEditingDeployment(null)
                    form.resetFields()
                  }}
                >
                  取消
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                >
                  {editingDeployment ? '保存修改' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Jenkins配置模态框 */}
        <Modal
          title={getCurrentJenkinsConfig() ? '编辑Jenkins配置' : '创建Jenkins配置'}
          open={configModalVisible}
          onCancel={() => {
            setConfigModalVisible(false)
            configForm.resetFields()
            setTestResult(null)
          }}
          footer={null}
          width={600}
          destroyOnClose
        >
          <Form
            form={configForm}
            layout="vertical"
            initialValues={{
              isActive: true
            }}
          >
            <Form.Item
              label="配置名称"
              name="name"
              rules={[{ required: true, message: '请输入配置名称' }]}
            >
              <Input placeholder="如：生产环境Jenkins" />
            </Form.Item>

            <Form.Item
              label="Jenkins服务器地址"
              name="serverUrl"
              rules={[
                { required: true, message: '请输入Jenkins服务器地址' },
                { type: 'url', message: '请输入有效的URL地址' }
              ]}
            >
              <Input placeholder="http://jenkins-server:8080" />
            </Form.Item>

            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入Jenkins用户名' }]}
            >
              <Input placeholder="Jenkins用户名" />
            </Form.Item>

            <Form.Item
              label="API Token"
              name="apiToken"
              rules={[{ required: true, message: '请输入Jenkins API Token' }]}
            >
              <Input.Password placeholder="Jenkins API Token" />
            </Form.Item>

            <Form.Item
              label="启用配置"
              name="isActive"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            {/* 测试结果显示 */}
            {testResult && (
              <Alert
                message={testResult.success ? "连接测试成功" : "连接测试失败"}
                description={testResult.message}
                type={testResult.success ? "success" : "error"}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider />

            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => {
                  setConfigModalVisible(false)
                  configForm.resetFields()
                  setTestResult(null)
                }}
              >
                取消
              </Button>
              <Button
                type="default"
                icon={<ApiOutlined />}
                loading={testLoading}
                onClick={testJenkinsConnection}
              >
                测试连接
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={configLoading}
                onClick={saveJenkinsConfig}
                disabled={!testResult?.success}
              >
                保存配置
              </Button>
            </div>
          </Form>
        </Modal>

        {/* Jenkins执行日志模态框 */}
        <Modal
          title={`Jenkins执行日志 - ${selectedDeployment?.name || ''}`}
          open={logModalVisible}
          onCancel={() => {
            setLogModalVisible(false)
            setSelectedDeployment(null)
            setCurrentLogs('')
          }}
          footer={[
            <Button key="refresh" onClick={() => selectedDeployment && viewJenkinsLogs(selectedDeployment)}>
              刷新日志
            </Button>,
            <Button key="close" onClick={() => setLogModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={960}
          className="custom-modal"
        >
          <div style={{
            maxHeight: '400px',
            overflow: 'auto',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
            padding: '16px',
            borderRadius: '6px',
            border: isDark ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid #d9d9d9',
            boxShadow: isDark
              ? '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.2)'
              : '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
          }}>
            {logLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <span style={{ color: isDark ? '#cbd5e1' : '#666666' }}>正在获取日志...</span>
              </div>
            ) : (
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontSize: '12px',
                lineHeight: '1.5',
                color: isDark ? '#f8fafc' : '#262626',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
              }}>
                {currentLogs}
              </pre>
            )}
          </div>
        </Modal>

        {/* 任务详情模态框 */}
        <Modal
          title={`任务详情 - ${selectedDeployment?.name || ''}`}
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false)
            setSelectedDeployment(null)
          }}
          footer={[
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
          className="custom-modal"
        >
          {selectedDeployment && (
            <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>
              <div className="mb-4">
                <h4 style={{ color: isDark ? '#f8fafc' : '#1e293b', marginBottom: '12px' }}>基本信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>任务名称：</strong>{selectedDeployment.name}</div>
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>环境：</strong>{selectedDeployment.environment}</div>
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>版本：</strong>{selectedDeployment.version || '未设置'}</div>
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>状态：</strong>{renderStatusTag(selectedDeployment.status)}</div>
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>创建时间：</strong>{new Date(selectedDeployment.createdAt).toLocaleString()}</div>
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>创建者：</strong>{selectedDeployment.user?.username}</div>
                </div>
              </div>

              {selectedDeployment.description && (
                <div className="mb-4">
                  <h4 style={{ color: isDark ? '#f8fafc' : '#1e293b', marginBottom: '12px' }}>任务描述</h4>
                  <p style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{selectedDeployment.description}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 style={{ color: isDark ? '#f8fafc' : '#1e293b', marginBottom: '12px' }}>Jenkins配置</h4>
                <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>Jenkins任务：</strong>{selectedDeployment.jenkinsJobIds?.join(', ') || '未设置'}</div>
                {selectedDeployment.scheduledAt && (
                  <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>计划执行时间：</strong>{new Date(selectedDeployment.scheduledAt).toLocaleString()}</div>
                )}
              </div>

              <div className="mb-4">
                <h4 style={{ color: isDark ? '#f8fafc' : '#1e293b', marginBottom: '12px' }}>人员配置</h4>
                <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>审批人员：</strong>{selectedDeployment.approvalUsers?.length ? selectedDeployment.approvalUsers.join(', ') : '无需审批'}</div>
                <div style={{ color: isDark ? '#f8fafc' : '#1e293b' }}><strong>通知人员：</strong>{selectedDeployment.notificationUsers?.join(', ') || '未设置'}</div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  )
}

export default JenkinsDeploymentsPage
