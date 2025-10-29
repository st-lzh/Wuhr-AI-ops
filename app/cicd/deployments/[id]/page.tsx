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
  Timeline,
  Progress,
  Statistic,
  Row,
  Col,
  Tabs,
  Modal,
  Form,
  Input,
  Alert
} from 'antd'
import {
  RocketOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import MainLayout from '../../../components/layout/MainLayout'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
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
  artifacts?: any
  userId: string
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    environment: string
    repositoryUrl: string
    branch: string
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

interface DeploymentDetailPageProps {
  params: { id: string }
}

const DeploymentDetailPage: React.FC<DeploymentDetailPageProps> = ({ params }) => {
  const router = useRouter()
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(false)
  const [executeModalVisible, setExecuteModalVisible] = useState(false)
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 加载部署详情
  const loadDeploymentDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cicd/deployments/${params.id}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDeployment(result.data)
        } else {
          message.error(result.error || '加载部署详情失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '加载部署详情失败')
      }
    } catch (error) {
      console.error('加载部署详情失败:', error)
      message.error('加载部署详情失败')
    } finally {
      setLoading(false)
    }
  }

  // 执行部署
  const handleExecuteDeployment = async (values: any) => {
    try {
      const response = await fetch(`/api/cicd/deployments/${params.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('部署已启动')
          setExecuteModalVisible(false)
          form.resetFields()
          loadDeploymentDetail()
        } else {
          message.error(result.error || '部署执行失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '部署执行失败')
      }
    } catch (error) {
      console.error('部署执行失败:', error)
      message.error('部署执行失败')
    }
  }

  // 停止部署
  const handleStopDeployment = async () => {
    try {
      const response = await fetch(`/api/cicd/deployments/${params.id}/stop`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('部署已停止')
          loadDeploymentDetail()
        } else {
          message.error(result.error || '停止部署失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '停止部署失败')
      }
    } catch (error) {
      console.error('停止部署失败:', error)
      message.error('停止部署失败')
    }
  }

  // 回滚部署
  const handleRollbackDeployment = async (values: any) => {
    try {
      const response = await fetch(`/api/cicd/deployments/${params.id}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('回滚已启动')
          setRollbackModalVisible(false)
          form.resetFields()
          loadDeploymentDetail()
        } else {
          message.error(result.error || '回滚失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '回滚失败')
      }
    } catch (error) {
      console.error('回滚失败:', error)
      message.error('回滚失败')
    }
  }

  // 渲染状态标签
  const renderStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '等待审批' },
      approved: { color: 'blue', icon: <CheckCircleOutlined />, text: '已审批' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '已拒绝' },
      scheduled: { color: 'cyan', icon: <ClockCircleOutlined />, text: '已调度' },
      deploying: { color: 'processing', icon: <PlayCircleOutlined />, text: '部署中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '部署成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '部署失败' },
      rolled_back: { color: 'warning', icon: <ExclamationCircleOutlined />, text: '已回滚' }
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
          </span>
        } 
      />
    )
  }

  // 渲染环境标签
  const renderEnvironmentTag = (environment: string) => {
    const envConfig = {
      dev: { color: 'blue', text: '开发环境' },
      test: { color: 'orange', text: '测试环境' },
      prod: { color: 'red', text: '生产环境' }
    }

    const config = envConfig[environment as keyof typeof envConfig] || { color: 'default', text: environment }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 计算部署进度
  const getDeploymentProgress = () => {
    if (!deployment) return 0
    
    switch (deployment.status) {
      case 'pending': return 10
      case 'approved': return 25
      case 'scheduled': return 40
      case 'deploying': return 70
      case 'success': return 100
      case 'failed': return 100
      case 'rolled_back': return 100
      default: return 0
    }
  }

  // 自动滚动到日志底部
  const scrollToBottom = () => {
    const logsElement = document.getElementById('deployment-logs')
    if (logsElement) {
      logsElement.scrollTop = logsElement.scrollHeight
    }
  }

  // 初始化加载
  useEffect(() => {
    loadDeploymentDetail()

    // 如果部署正在进行中，定时刷新状态
    const interval = setInterval(() => {
      if (deployment && ['deploying', 'scheduled'].includes(deployment.status)) {
        loadDeploymentDetail()
      }
    }, 5000) // 每5秒刷新，提高实时性

    return () => clearInterval(interval)
  }, [params.id, deployment?.status])

  // 当日志更新时自动滚动到底部
  useEffect(() => {
    if (deployment?.logs && deployment.status === 'deploying') {
      setTimeout(scrollToBottom, 100)
    }
  }, [deployment?.logs, deployment?.status])

  if (!deployment) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center">
            {loading ? '加载中...' : '部署任务不存在'}
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
              <RocketOutlined className="mr-2" />
              {deployment.name}
            </Title>
            {renderStatusBadge(deployment.status)}
          </Space>
        </div>

        {/* 部署进度 */}
        <Card className="glass-card mb-6">
          <div className="mb-4">
            <Text strong>部署进度</Text>
          </div>
          <Progress 
            percent={getDeploymentProgress()} 
            status={deployment.status === 'failed' ? 'exception' : 
                   deployment.status === 'success' ? 'success' : 'active'}
            strokeColor={deployment.status === 'failed' ? '#ff4d4f' : 
                        deployment.status === 'success' ? '#52c41a' : '#1890ff'}
          />
          <div className="mt-2 text-gray-500">
            {deployment.status === 'deploying' && '部署正在进行中...'}
            {deployment.status === 'success' && '部署已成功完成'}
            {deployment.status === 'failed' && '部署失败，请检查日志'}
            {deployment.status === 'pending' && '等待审批中'}
          </div>
        </Card>

        {/* 操作按钮 */}
        <Card className="glass-card mb-6">
          <Space>
            {['approved', 'scheduled'].includes(deployment.status) && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => setExecuteModalVisible(true)}
              >
                执行部署
              </Button>
            )}
            {deployment.status === 'deploying' && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStopDeployment}
              >
                停止部署
              </Button>
            )}
            {['success', 'failed'].includes(deployment.status) && (
              <Button
                icon={<ExclamationCircleOutlined />}
                onClick={() => setRollbackModalVisible(true)}
              >
                回滚部署
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={loadDeploymentDetail}
              loading={loading}
            >
              刷新状态
            </Button>

          </Space>
        </Card>

        {/* 详细信息 */}
        <Card className="glass-card">
          <Tabs defaultActiveKey="info">
            <TabPane tab={<span><SettingOutlined />基本信息</span>} key="info">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="部署名称">{deployment.name}</Descriptions.Item>
                <Descriptions.Item label="版本">{deployment.version || '-'}</Descriptions.Item>
                <Descriptions.Item label="所属项目">{deployment.project.name}</Descriptions.Item>
                <Descriptions.Item label="目标环境">
                  {renderEnvironmentTag(deployment.environment)}
                </Descriptions.Item>
                <Descriptions.Item label="仓库地址" span={2}>
                  <a href={deployment.project.repositoryUrl} target="_blank" rel="noopener noreferrer">
                    {deployment.project.repositoryUrl}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="分支">{deployment.project.branch}</Descriptions.Item>
                <Descriptions.Item label="构建号">{deployment.buildNumber || '-'}</Descriptions.Item>
                <Descriptions.Item label="调度时间">
                  {deployment.scheduledAt ? dayjs(deployment.scheduledAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {deployment.startedAt ? dayjs(deployment.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {deployment.completedAt ? dayjs(deployment.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="持续时间">
                  {deployment.duration ? `${Math.floor(deployment.duration / 60)}m ${deployment.duration % 60}s` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(deployment.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(deployment.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                {deployment.description && (
                  <Descriptions.Item label="描述" span={2}>
                    {deployment.description}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </TabPane>

            <TabPane tab={<span><HistoryOutlined />审批流程</span>} key="approvals">
              {deployment.approvals.length > 0 ? (
                <Timeline>
                  {deployment.approvals.map((approval, index) => (
                    <Timeline.Item
                      key={approval.id}
                      color={approval.status === 'approved' ? 'green' : 
                             approval.status === 'rejected' ? 'red' : 'blue'}
                      dot={approval.status === 'approved' ? <CheckCircleOutlined /> :
                           approval.status === 'rejected' ? <CloseCircleOutlined /> :
                           <ClockCircleOutlined />}
                    >
                      <div>
                        <Text strong>级别 {approval.level} - {approval.approver.username}</Text>
                        <div className="text-gray-500">
                          状态: {approval.status === 'approved' ? '已审批' : 
                                approval.status === 'rejected' ? '已拒绝' : '等待审批'}
                        </div>
                        {approval.approvedAt && (
                          <div className="text-gray-500">
                            时间: {dayjs(approval.approvedAt).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        )}
                        {approval.comments && (
                          <div className="text-gray-600 mt-1">
                            备注: {approval.comments}
                          </div>
                        )}
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Alert message="无需审批" type="info" />
              )}
            </TabPane>

            <TabPane tab={<span><FileTextOutlined />部署日志</span>} key="logs">
              <div className="space-y-4">
                {/* 日志控制栏 */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Badge
                      status={deployment.status === 'deploying' ? 'processing' : 'default'}
                      text={deployment.status === 'deploying' ? '实时更新中' : '日志已完成'}
                    />
                    {deployment.logs && (
                      <Text type="secondary">
                        共 {deployment.logs.split('\n').length} 行
                      </Text>
                    )}
                  </div>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={loadDeploymentDetail}
                    loading={loading}
                  >
                    刷新日志
                  </Button>
                </div>

                {/* 日志内容 */}
                <div
                  id="deployment-logs"
                  className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto border"
                  style={{
                    whiteSpace: 'pre-wrap',
                    scrollBehavior: 'smooth'
                  }}
                >
                  {deployment.logs ? (
                    deployment.logs.split('\n').map((line, index) => (
                      <div key={index} className="leading-relaxed">
                        <span className="text-gray-500 mr-2 select-none">
                          {String(index + 1).padStart(3, '0')}
                        </span>
                        <span className={
                          line.includes('✅') ? 'text-green-400' :
                          line.includes('❌') ? 'text-red-400' :
                          line.includes('🔧') ? 'text-blue-400' :
                          line.includes('📝') ? 'text-yellow-400' :
                          line.includes('🚀') ? 'text-purple-400' :
                          'text-gray-300'
                        }>
                          {line}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center py-8">
                      暂无部署日志
                      {deployment.status === 'pending' && (
                        <div className="mt-2">部署任务尚未开始</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 日志统计 */}
                {deployment.logs && (
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>
                      开始时间: {deployment.startedAt ? dayjs(deployment.startedAt).format('YYYY-MM-DD HH:mm:ss') : '未开始'}
                    </span>
                    <span>
                      {deployment.completedAt && deployment.startedAt && (
                        `耗时: ${Math.floor((new Date(deployment.completedAt).getTime() - new Date(deployment.startedAt).getTime()) / 1000)}秒`
                      )}
                    </span>
                  </div>
                )}
              </div>
            </TabPane>

            <TabPane tab={<span><SettingOutlined />部署配置</span>} key="config">
              <pre className="bg-gray-50 p-3 rounded text-sm">
                {deployment.artifacts ? JSON.stringify(deployment.artifacts, null, 2) : '无部署配置'}
              </pre>
            </TabPane>
          </Tabs>
        </Card>

        {/* 执行部署模态框 */}
        <Modal
          title="执行部署"
          open={executeModalVisible}
          onCancel={() => setExecuteModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleExecuteDeployment}
          >
            <Form.Item
              name="buildParameters"
              label="构建参数 (JSON格式)"
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

        {/* 回滚部署模态框 */}
        <Modal
          title="回滚部署"
          open={rollbackModalVisible}
          onCancel={() => setRollbackModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleRollbackDeployment}
          >
            <Form.Item
              name="targetVersion"
              label="目标版本"
              rules={[{ required: true, message: '请输入回滚目标版本' }]}
            >
              <Input placeholder="输入要回滚到的版本号" />
            </Form.Item>

            <Form.Item
              name="reason"
              label="回滚原因"
              rules={[{ required: true, message: '请输入回滚原因' }]}
            >
              <TextArea rows={3} placeholder="请说明回滚原因" />
            </Form.Item>

            <Form.Item className="mb-0">
              <Space className="w-full justify-end">
                <Button onClick={() => setRollbackModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" danger htmlType="submit">
                  确认回滚
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  )
}

export default DeploymentDetailPage
