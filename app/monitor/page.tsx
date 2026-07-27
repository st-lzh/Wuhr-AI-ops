'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Space,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
  Alert,
  Divider,
  Typography
} from 'antd'
import {
  SettingOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  MonitorOutlined,
  DashboardOutlined,
  ApiOutlined
} from '@ant-design/icons'
import { useAuth } from '../hooks/useAuth'
import { useGlobalState } from '../contexts/GlobalStateContext'
import MainLayout from '../components/layout/MainLayout'

const { Title, Text } = Typography
const { Option } = Select

interface GrafanaConfig {
  id: string
  name: string
  host: string
  port: number
  protocol: string
  username?: string
  orgId: number
  isActive: boolean
  description?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

interface Dashboard {
  id: number
  uid: string
  title: string
  uri: string
  url: string
  tags: string[]
  isStarred: boolean
  folderId: number
  folderTitle: string
}

export default function GrafanaMonitorPage() {
  const { user } = useAuth()
  const { state } = useGlobalState()
  const isDark = state.theme === 'dark'
  
  // 状态管理
  const [configs, setConfigs] = useState<GrafanaConfig[]>([])
  const [activeConfig, setActiveConfig] = useState<GrafanaConfig | null>(null)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [dashboardsByFolder, setDashboardsByFolder] = useState<Record<string, Dashboard[]>>({})
  
  // 加载状态
  const [configsLoading, setConfigsLoading] = useState(false)
  const [dashboardsLoading, setDashboardsLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // 模态框状态
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<GrafanaConfig | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  
  // 表单
  const [configForm] = Form.useForm()

  // 权限检查
  const canWrite = user?.role === 'admin'
    || user?.role === 'manager'
    || user?.permissions?.includes('*')
    || user?.permissions?.includes('grafana:write')
  const canRead = Boolean(user)

  // 调试信息
  console.log('🔍 用户权限调试:', {
    user: user?.email,
    role: user?.role,
    permissions: user?.permissions,
    canWrite,
    canRead
  })

  // 加载配置列表
  const loadConfigs = async () => {
    if (!canRead) return
    
    setConfigsLoading(true)
    try {
      const response = await fetch('/api/grafana/configs', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setConfigs(result.configs)
          
          // 设置活跃配置
          const active = result.configs.find((c: GrafanaConfig) => c.isActive)
          if (active) {
            setActiveConfig(active)
            loadDashboards(active.id)
          }
        }
      }
    } catch (error) {
      console.error('加载Grafana配置失败:', error)
      message.error('加载配置失败')
    } finally {
      setConfigsLoading(false)
    }
  }

  // 加载仪表板列表
  const loadDashboards = async (configId: string) => {
    setDashboardsLoading(true)
    try {
      const response = await fetch(`/api/grafana/dashboards?configId=${configId}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDashboards(result.data.dashboards)
          setDashboardsByFolder(result.data.dashboardsByFolder)
        } else {
          message.error(`加载仪表板失败: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('加载仪表板失败:', error)
      message.error('加载仪表板失败')
    } finally {
      setDashboardsLoading(false)
    }
  }

  // 测试连接
  const testConnection = async () => {
    setTestLoading(true)
    setTestResult(null)
    
    try {
      const values = configForm.getFieldsValue()
      const response = await fetch('/api/grafana/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include'
      })
      
      const result = await response.json()
      setTestResult(result)
      
      if (result.success) {
        message.success('连接测试成功！')
      } else {
        message.error(`连接测试失败: ${result.error}`)
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      message.error('测试连接时发生错误')
    } finally {
      setTestLoading(false)
    }
  }

  // 保存配置
  const saveConfig = async (values: any) => {
    if (saving) return
    
    setSaving(true)
    try {
      const config = {
        ...values,
        tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        id: editingConfig?.id
      }

      const response = await fetch('/api/grafana/configs', {
        method: editingConfig ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        credentials: 'include'
      })

      if (response.ok) {
        message.success(`${editingConfig ? '更新' : '创建'}Grafana配置成功`)
        setConfigModalVisible(false)
        setEditingConfig(null)
        configForm.resetFields()
        setTestResult(null)
        await loadConfigs()
      } else {
        const error = await response.json()
        message.error(`保存配置失败: ${error.error}`)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      message.error('保存配置时发生错误')
    } finally {
      setSaving(false)
    }
  }

  // 切换配置
  const switchConfig = async (configId: string) => {
    const config = configs.find(c => c.id === configId)
    if (config) {
      setActiveConfig(config)
      await loadDashboards(configId)
    }
  }

  // 编辑配置
  const editConfig = (config: GrafanaConfig) => {
    setEditingConfig(config)
    setConfigModalVisible(true)
    configForm.setFieldsValue({
      name: config.name,
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      username: config.username,
      password: '***',
      apiKey: '***',
      orgId: config.orgId,
      isActive: config.isActive,
      description: config.description,
      tags: config.tags?.join(', ') || ''
    })
  }

  // 删除配置
  const deleteConfig = async (configId: string) => {
    try {
      const response = await fetch(`/api/grafana/configs?id=${configId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()
      
      if (result.success) {
        message.success('Grafana配置删除成功')
        await loadConfigs()
        if (activeConfig?.id === configId) {
          setActiveConfig(null)
          setDashboards([])
          setDashboardsByFolder({})
        }
      } else {
        message.error(`删除配置失败: ${result.error}`)
      }
    } catch (error) {
      console.error('删除配置失败:', error)
      message.error('删除配置时发生错误')
    }
  }

  // 显示删除确认
  const showDeleteConfirm = (config: GrafanaConfig) => {
    Modal.confirm({
      title: '确认删除配置',
      content: (
        <div>
          <p>您确定要删除Grafana配置 <strong>"{config.name}"</strong> 吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: '14px' }}>
            ⚠️ 此操作不可撤销，删除后将无法恢复该配置。
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteConfig(config.id),
    })
  }

  // 页面加载时获取配置
  useEffect(() => {
    loadConfigs()
  }, [canRead])

  if (!canRead) {
    return (
      <MainLayout>
        <div style={{ padding: '24px' }}>
          <Alert
            message="权限不足"
            description="您没有访问Grafana监控的权限，请联系管理员。"
            type="warning"
            showIcon
          />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
          <MonitorOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          Grafana监控
        </Title>
        <Text type="secondary">
          管理和监控Grafana仪表板，实时查看系统监控数据
        </Text>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="配置总数"
              value={configs.length}
              prefix={<SettingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃配置"
              value={activeConfig ? 1 : 0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: activeConfig ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="仪表板数量"
              value={dashboards.length}
              prefix={<DashboardOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="文件夹数量"
              value={Object.keys(dashboardsByFolder).length}
              prefix={<MonitorOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Grafana配置管理 */}
      <Card 
        title="Grafana配置管理" 
        className="mb-6"
        extra={
          canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingConfig(null)
                setConfigModalVisible(true)
                setTestResult(null)
                configForm.resetFields()
              }}
            >
              添加配置
            </Button>
          )
        }
      >
        {configs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <MonitorOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
            <div>
              <Text type="secondary">还没有Grafana配置</Text>
            </div>
            {canWrite && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ marginTop: '16px' }}
                onClick={() => {
                  setEditingConfig(null)
                  setConfigModalVisible(true)
                  setTestResult(null)
                  configForm.resetFields()
                }}
              >
                创建第一个配置
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* 配置选择器 */}
            {configs.length > 1 && (
              <div style={{ marginBottom: '16px' }}>
                <Text type="secondary" style={{ marginRight: 8 }}>选择Grafana配置：</Text>
                <Select
                  value={activeConfig?.id}
                  onChange={switchConfig}
                  style={{ width: 200 }}
                  placeholder="选择Grafana配置"
                >
                  {configs.map(config => (
                    <Select.Option key={config.id} value={config.id}>
                      <Space>
                        {config.name}
                        {config.isActive && <Tag color="green">活跃</Tag>}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </div>
            )}
            
            {/* 配置管理按钮 */}
            {activeConfig && canWrite && (
              <div style={{ marginBottom: '16px' }}>
                <Space>
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => editConfig(activeConfig)}
                  >
                    编辑配置
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => showDeleteConfirm(activeConfig)}
                  >
                    删除配置
                  </Button>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => activeConfig && loadDashboards(activeConfig.id)}
                    loading={dashboardsLoading}
                  >
                    刷新仪表板
                  </Button>
                </Space>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 仪表板列表 */}
      {activeConfig && (
        <Card 
          title={`仪表板列表 - ${activeConfig.name}`}
          loading={dashboardsLoading}
        >
          {dashboards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <DashboardOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
              <div>
                <Text type="secondary">没有找到仪表板</Text>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  请检查Grafana配置和权限设置
                </Text>
              </div>
            </div>
          ) : (
            <div>
              {Object.entries(dashboardsByFolder).map(([folderName, folderDashboards], folderIndex) => {
                // 简单的颜色方案
                const colorTheme = {
                  bg: 'transparent',
                  border: isDark ? 'rgba(255, 255, 255, 0.1)' : '#d9d9d9',
                  icon: '#1890ff',
                  text: 'inherit'
                }

                return (
                  <div key={folderName} style={{ marginBottom: '32px' }}>
                    {/* 文件夹标题 */}
                    <Card
                      size="small"
                      style={{
                        marginBottom: '16px',
                        borderLeft: `4px solid ${colorTheme.icon}`,
                        borderRadius: '6px'
                      }}
                      bodyStyle={{
                        padding: '12px 16px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: colorTheme.icon,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '12px'
                          }}>
                            <span style={{ color: 'white', fontSize: '14px' }}>📁</span>
                          </div>
                          <div>
                            <Title level={5} style={{
                              margin: 0,
                              fontSize: '16px',
                              fontWeight: 600
                            }}>
                              {folderName}
                            </Title>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {folderDashboards.length} 个仪表板
                            </Text>
                          </div>
                        </div>
                        <Tag color={colorTheme.icon} style={{
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          margin: 0
                        }}>
                          {folderDashboards.length}
                        </Tag>
                      </div>
                    </Card>

                    {/* 仪表板卡片 */}
                    <Row gutter={[20, 28]}> {/* 从24增加到28，增加15% */}
                      {folderDashboards.map((dashboard, dashIndex) => (
                        <Col span={6} key={dashboard.uid}> {/* 从span={8}改为span={6}，缩小40% */}
                          <Card
                            hoverable
                            style={{
                              height: '108px', // 从180px缩小40%到108px
                              borderRadius: '8px',
                              transition: 'all 0.3s ease',
                              position: 'relative'
                              // 移除自定义背景，使用Antd默认背景
                            }}
                            bodyStyle={{
                              padding: '12px', // 从16px缩小到12px
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            {/* 查看按钮 - 右上角 */}
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              zIndex: 10
                            }}>
                              <Button
                                type="primary"
                                size="small"
                                icon={<EyeOutlined />}
                                style={{
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  height: '22px',
                                  padding: '0 6px',
                                  fontWeight: 500,
                                  background: isDark ? 'rgba(24, 144, 255, 0.5)' : 'rgba(24, 144, 255, 0.5)',
                                  borderColor: isDark ? 'rgba(24, 144, 255, 0.5)' : 'rgba(24, 144, 255, 0.5)'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const embedUrl = `${activeConfig.protocol}://${activeConfig.host}:${activeConfig.port}/d/${dashboard.uid}?orgId=${activeConfig.orgId}&kiosk=tv&theme=${isDark ? 'dark' : 'light'}`
                                  window.open(embedUrl, '_blank')
                                }}
                              >
                                查看
                              </Button>
                            </div>

                            {/* 仪表板标题 - 紧凑版 */}
                            <div style={{ marginBottom: '6px', paddingRight: '60px' }}> {/* 给右上角按钮留空间 */}
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: '#1890ff',
                                  marginRight: '6px',
                                  flexShrink: 0
                                }} />
                                <Tooltip title={dashboard.title}>
                                  <Title level={5} style={{
                                    margin: 0,
                                    fontSize: '14px', // 从16px缩小到14px
                                    fontWeight: 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {dashboard.title}
                                  </Title>
                                </Tooltip>
                                {dashboard.isStarred && (
                                  <span style={{
                                    color: '#faad14',
                                    fontSize: '10px',
                                    marginLeft: '4px'
                                  }}>⭐</span>
                                )}
                              </div>
                            </div>

                            {/* 标签区域 - 紧凑版 */}
                            <div style={{ marginBottom: '7px', minHeight: '16px' }}> {/* 从8px缩小到7px，减少10% */}
                              {dashboard.tags.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '2px'
                                }}>
                                  {dashboard.tags.slice(0, 2).map((tag, tagIndex) => {
                                    const tagColors = ['blue', 'green', 'orange', 'purple', 'red', 'cyan']
                                    return (
                                      <Tag
                                        key={tag}
                                        color={tagColors[tagIndex % tagColors.length]}
                                        style={{
                                          borderRadius: '8px',
                                          fontSize: '10px',
                                          margin: 0,
                                          border: 'none',
                                          padding: '0 4px',
                                          lineHeight: '16px'
                                        }}
                                      >
                                        {tag}
                                      </Tag>
                                    )
                                  })}
                                  {dashboard.tags.length > 2 && (
                                    <Tag style={{
                                      fontSize: '10px',
                                      margin: 0,
                                      borderRadius: '8px',
                                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0',
                                      color: isDark ? '#ffffff' : '#666666',
                                      border: 'none',
                                      padding: '0 4px',
                                      lineHeight: '16px'
                                    }}>
                                      +{dashboard.tags.length - 2}
                                    </Tag>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* UID显示区域 - 底部 */}
                            <div style={{ marginTop: 'auto' }}>
                              <div style={{
                                padding: '4px 6px',
                                background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                                borderRadius: '4px',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'
                              }}>
                                <Text style={{
                                  fontSize: '10px',
                                  fontFamily: 'Monaco, Consolas, monospace',
                                  color: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
                                  wordBreak: 'break-all',
                                  lineHeight: '12px'
                                }}>
                                  UID: {dashboard.uid}
                                </Text>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* 配置模态框 */}
      <Modal
        title={editingConfig ? '编辑Grafana配置' : '添加Grafana配置'}
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false)
          setEditingConfig(null)
          setTestResult(null)
          configForm.resetFields()
        }}
        footer={null}
        width={800}
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={saveConfig}
          initialValues={{
            port: 3000,
            protocol: 'http',
            orgId: 1,
            isActive: false
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="配置名称"
                name="name"
                rules={[{ required: true, message: '请输入配置名称' }]}
              >
                <Input placeholder="例如：生产环境Grafana" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="协议"
                name="protocol"
                rules={[{ required: true, message: '请选择协议' }]}
              >
                <Select>
                  <Option value="http">HTTP</Option>
                  <Option value="https">HTTPS</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                label="服务器地址"
                name="host"
                rules={[{ required: true, message: '请输入服务器地址' }]}
              >
                <Input placeholder="例如：grafana.example.com 或 192.168.1.100" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="端口"
                name="port"
                rules={[{ required: true, message: '请输入端口' }]}
              >
                <Input type="number" placeholder="3000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>认证信息</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="用户名"
                name="username"
              >
                <Input placeholder="Grafana用户名（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="密码"
                name="password"
              >
                <Input.Password placeholder="Grafana密码（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="API密钥"
            name="apiKey"
            extra="推荐使用API密钥而不是用户名密码"
          >
            <Input.Password placeholder="Grafana API Key（可选）" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="组织ID"
                name="orgId"
              >
                <Input type="number" placeholder="1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="设为活跃配置"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={2} placeholder="配置描述（可选）" />
          </Form.Item>

          <Form.Item
            label="标签"
            name="tags"
            extra="多个标签用逗号分隔"
          >
            <Input placeholder="例如：生产,监控,告警" />
          </Form.Item>

          {/* 测试结果 */}
          {testResult && (
            <Alert
              message={testResult.success ? '连接测试成功' : '连接测试失败'}
              description={
                testResult.success ? (
                  <div>
                    <p>✅ 成功连接到Grafana服务器</p>
                    {testResult.data && (
                      <div>
                        <p>版本: {testResult.data.version}</p>
                        <p>数据库: {testResult.data.database}</p>
                        {testResult.data.organization && (
                          <p>组织: {testResult.data.organization.name}</p>
                        )}
                        <p>数据源数量: {testResult.data.datasourceCount}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p>❌ {testResult.error}</p>
                    {testResult.details && <p>{testResult.details}</p>}
                  </div>
                )
              }
              type={testResult.success ? 'success' : 'error'}
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setConfigModalVisible(false)
                  setEditingConfig(null)
                  setTestResult(null)
                  configForm.resetFields()
                }}
              >
                取消
              </Button>
              <Button
                onClick={testConnection}
                loading={testLoading}
              >
                测试连接
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                disabled={!canWrite || saving}
                loading={saving}
              >
                {saving ? '保存中...' : '保存配置'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
      </div>
    </MainLayout>
  )
}
