'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Typography,
  Button,
  Space,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Table,
  Tag,
  Alert,
  Modal,
  message,
  Tabs,
  Switch,
  Tooltip,
  Badge,
  Empty,
  Spin,
  Row,
  Col,
  Divider
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  FilterOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useGlobalState'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input
const { TabPane } = Tabs

interface ELKConfig {
  id?: string
  name: string
  host: string
  port: number
  username?: string
  password?: string
  indices: string[] // 支持多个索引模式
  isActive: boolean
  ssl: boolean
  apiKey?: string
  webUrl?: string // ELK/Kibana访问链接
  createdAt?: string
  updatedAt?: string
}

interface IndexInfo {
  name: string
  status: string
  health: string
  docsCount: number
  storeSize: string
}

interface LogEntry {
  id: string
  timestamp: string
  level: string
  message: string
  source: string
  host: string
  service?: string
  tags?: string[]
  fields?: Record<string, any>
}

const ELKLogsPage: React.FC = () => {
  const { canAccessServers } = usePermissions()
  const { isDark } = useTheme()
  const [configs, setConfigs] = useState<ELKConfig[]>([])
  const [activeConfig, setActiveConfig] = useState<ELKConfig | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: any
    indexPatterns?: string[]
  } | null>(null)
  const [realTimeEnabled, setRealTimeEnabled] = useState(false)
  const [searchForm] = Form.useForm()
  const [configForm] = Form.useForm()
  const [editingConfig, setEditingConfig] = useState<ELKConfig | null>(null)

  const [selectedIndices, setSelectedIndices] = useState<string[]>([]) // 搜索时选择的索引
  const [availableIndices, setAvailableIndices] = useState<IndexInfo[]>([]) // 服务器实际索引列表
  const [indicesLoading, setIndicesLoading] = useState(false) // 索引加载状态
  const [configSelectedIndices, setConfigSelectedIndices] = useState<string[]>([]) // 配置表单中的索引模式
  const [saving, setSaving] = useState(false) // 保存状态，防止重复提交
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 权限检查
  const canRead = canAccessServers('read')
  const canWrite = canAccessServers('write')

  // 加载ELK配置
  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/servers/elk/configs', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        const active = data.configs?.find((c: ELKConfig) => c.isActive)
        if (active) {
          setActiveConfig(active)
          // 自动加载活动配置的索引列表
          loadAvailableIndices(active.id!)
        }
      }
    } catch (error) {
      console.error('加载ELK配置失败:', error)
    }
  }

  // 获取服务器实际索引列表
  const loadAvailableIndices = async (configId: string) => {
    if (!configId) return

    setIndicesLoading(true)
    try {
      const response = await fetch('/api/servers/elk/indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableIndices(data.indices || [])
        console.log(`✅ 获取到 ${data.indices?.length || 0} 个索引`)
      } else {
        const error = await response.json()
        console.error('获取索引列表失败:', error.error)
        setAvailableIndices([])
      }
    } catch (error) {
      console.error('获取索引列表失败:', error)
      setAvailableIndices([])
    } finally {
      setIndicesLoading(false)
    }
  }

  // 搜索日志
  const searchLogs = async (params?: any) => {
    if (!activeConfig) {
      message.warning('请先配置并激活ELK连接')
      return
    }

    if (availableIndices.length === 0) {
      message.warning('没有可用的索引模式，请检查ELK连接或刷新索引模式列表')
      return
    }

    setLoading(true)
    try {
      const searchParams = params || searchForm.getFieldsValue()
      // 确定要查询的索引模式
      let indicesToQuery: string[] = []

      if (selectedIndices.length > 0) {
        // 用户在页面上选择了特定索引模式
        indicesToQuery = selectedIndices
      } else if (activeConfig.indices && Array.isArray(activeConfig.indices) && activeConfig.indices.length > 0) {
        // 使用配置中保存的索引模式
        indicesToQuery = activeConfig.indices as string[]
      } else {
        // 如果配置中没有指定索引，使用所有可用索引模式
        indicesToQuery = availableIndices.map(index => index.name)
      }

      console.log(`🎯 查询索引模式: ${indicesToQuery.join(', ')}`)

      const response = await fetch('/api/servers/elk/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: activeConfig.id,
          selectedIndices: indicesToQuery,
          ...searchParams
        }),
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        message.success(`获取到 ${data.logs?.length || 0} 条日志`)
      } else {
        const error = await response.json()
        message.error(`搜索日志失败: ${error.error}`)
      }
    } catch (error) {
      console.error('搜索日志失败:', error)
      message.error('搜索日志时发生错误')
    } finally {
      setLoading(false)
    }
  }

  // 测试ELK连接
  const testConnection = async (config: ELKConfig) => {
    setTestLoading(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/servers/elk/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        credentials: 'include'
      })

      const result = await response.json()
      setTestResult(result)

      if (result.success) {
        message.success('ELK连接测试成功')

        // 连接成功，提示用户可以手动填写索引模式
        setTestResult({
          ...result,
          message: '连接成功！您可以在下方手动填写索引模式，或留空查询所有索引'
        })
      } else {
        message.error(`连接测试失败: ${result.message}`)
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      setTestResult({
        success: false,
        message: '连接测试时发生错误'
      })
    } finally {
      setTestLoading(false)
    }
  }

  // 保存ELK配置
  const saveConfig = async (values: any) => {
    // 防止重复提交
    if (saving) {
      console.log('⚠️ 正在保存中，忽略重复提交')
      return
    }

    setSaving(true)
    try {
      const config = {
        ...values,
        indices: configSelectedIndices.length > 0 ? configSelectedIndices : [], // 使用选择的索引模式，空数组表示查询所有索引
        id: editingConfig?.id
      }

      console.log(`🔄 ${editingConfig ? '更新' : '创建'}ELK配置:`, config.name)

      const response = await fetch('/api/servers/elk/configs', {
        method: editingConfig ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        credentials: 'include'
      })

      if (response.ok) {
        message.success(`${editingConfig ? '更新' : '创建'}ELK配置成功`)
        setConfigModalVisible(false)
        setEditingConfig(null)
        setConfigSelectedIndices([])
        configForm.resetFields()
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

  // 切换实时日志
  const toggleRealTime = () => {
    if (realTimeEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setRealTimeEnabled(false)
      message.info('已停止实时日志')
    } else {
      setRealTimeEnabled(true)
      message.info('已开启实时日志')
      
      // 每5秒刷新一次
      intervalRef.current = setInterval(() => {
        searchLogs()
      }, 5000)
    }
  }

  // 清空日志
  const clearLogs = () => {
    setLogs([])
    message.success('已清空日志显示')
  }

  // 导出日志
  const exportLogs = () => {
    if (logs.length === 0) {
      message.warning('没有日志可导出')
      return
    }

    const csvContent = [
      ['时间', '级别', '来源', '主机', '服务', '消息'].join(','),
      ...logs.map(log => [
        log.timestamp,
        log.level,
        log.source,
        log.host,
        log.service || '',
        `"${log.message.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `elk-logs-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.csv`
    link.click()
    
    message.success('日志导出成功')
  }

  // 切换ELK配置
  const switchConfig = async (configId: string) => {
    const config = configs.find(c => c.id === configId)
    if (!config) return

    // 更新活动配置
    try {
      const response = await fetch('/api/servers/elk/configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          isActive: true
        }),
        credentials: 'include'
      })

      if (response.ok) {
        // 重新加载配置列表
        await loadConfigs()

        // 清空当前选择的索引
        setSelectedIndices([])
        // 清空日志
        setLogs([])
      } else {
        message.error('切换配置失败')
      }
    } catch (error) {
      console.error('切换配置失败:', error)
      message.error('切换配置时发生错误')
    }
  }

  // 编辑配置
  const editConfig = (config: ELKConfig) => {
    setEditingConfig(config)
    setConfigModalVisible(true)

    // 设置配置表单中的索引
    const configIndices = Array.isArray(config.indices) ? config.indices : []
    setConfigSelectedIndices(configIndices)

    configForm.setFieldsValue({
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      password: '***', // 不显示实际密码
      ssl: config.ssl,
      isActive: config.isActive,
      apiKey: config.apiKey ? '***' : '',
      webUrl: config.webUrl || ''
    })
  }

  // 显示删除确认对话框
  const showDeleteConfirm = (config: ELKConfig) => {
    const isLastConfig = configs.length === 1

    Modal.confirm({
      title: '确认删除配置',
      content: (
        <div>
          <p>您确定要删除ELK配置 <strong>"{config.name}"</strong> 吗？</p>
          {isLastConfig && (
            <p style={{ color: '#ff7a00', fontSize: '14px', fontWeight: 'bold' }}>
              ⚠️ 这是您的最后一个ELK配置，删除后将无法查看日志！
            </p>
          )}
          <p style={{ color: '#ff4d4f', fontSize: '14px' }}>
            ⚠️ 此操作不可撤销，删除后将无法恢复该配置。
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteConfig(config.id!),
    })
  }

  // 删除配置
  const deleteConfig = async (configId: string) => {
    try {
      const response = await fetch(`/api/servers/elk/configs?id=${configId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        message.success('ELK配置删除成功')
        // 重新加载配置列表
        await loadConfigs()
        // 如果删除的是当前活动配置，清空相关状态
        if (activeConfig?.id === configId) {
          setActiveConfig(null)
          setAvailableIndices([])
          setSelectedIndices([])
          setLogs([])
        }
      } else {
        message.error(`删除配置失败: ${result.error}`)
      }
    } catch (error) {
      console.error('删除配置失败:', error)
      message.error('删除配置时发生错误')
    }
  }

  useEffect(() => {
    if (canRead) {
      loadConfigs()
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [canRead])

  if (!canRead) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert
            message="权限不足"
            description="您没有权限访问ELK日志管理功能"
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
        <div className="mb-6">
          <Title level={2} className="mb-2">ELK日志管理</Title>
          <Paragraph type="secondary">
            配置和管理ELK日志服务器连接，实时查看和搜索应用日志
          </Paragraph>
        </div>

        {/* ELK配置状态 */}
        <Card className="mb-6">
          <Row gutter={[16, 16]} align="middle">
            <Col span={16}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <Badge
                    status={activeConfig ? 'processing' : 'default'}
                    text={activeConfig ? `当前连接: ${activeConfig.name}` : '未配置ELK连接'}
                  />
                  {activeConfig && activeConfig.webUrl && (
                    <a
                      href={activeConfig.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: isDark ? '#1890ff' : '#1890ff',
                        textDecoration: 'underline'
                      }}
                    >
                      访问ELK
                    </a>
                  )}
                  {activeConfig && (
                    <Tag color="blue">
                      {activeConfig.host}:{activeConfig.port}
                    </Tag>
                  )}
                </Space>

                {/* ELK配置选择器 */}
                {configs.length > 1 && (
                  <div>
                    <Text type="secondary" style={{ marginRight: 8 }}>选择ELK配置：</Text>
                    <Select
                      value={activeConfig?.id}
                      onChange={switchConfig}
                      style={{ width: 200 }}
                      placeholder="选择ELK配置"
                    >
                      {configs.map(config => (
                        <Select.Option key={config.id} value={config.id}>
                          <Space>
                            {config.name}
                            {config.isActive && <Badge status="processing" />}
                          </Space>
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* 配置管理按钮 */}
                {activeConfig && (
                  <div style={{ marginTop: 8 }}>
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
                    </Space>
                  </div>
                )}
              </Space>
            </Col>
            <Col span={8} style={{ textAlign: 'right' }}>
              <Space>
                {canWrite && (
                  <Button
                    type="primary"
                    icon={<SettingOutlined />}
                    onClick={() => {
                      setEditingConfig(null)
                      setConfigModalVisible(true)
                      setConfigSelectedIndices([])
                      configForm.resetFields()
                    }}
                  >
                    配置ELK
                  </Button>
                )}
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadConfigs}
                >
                  刷新配置
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>



        {/* 日志搜索和控制 */}
        <Card className="mb-6">
          {/* 显示配置的索引信息 */}
          {activeConfig && activeConfig.indices && Array.isArray(activeConfig.indices) && activeConfig.indices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>使用配置的索引模式：</Text>
              </div>
              <div style={{
                padding: '8px 12px',
                backgroundColor: isDark ? '#1f1f1f' : '#f6f8fa',
                borderRadius: '6px',
                border: `1px solid ${isDark ? '#434343' : '#e1e4e8'}`
              }}>
                <Space wrap>
                  {activeConfig.indices.map((index: string, idx: number) => (
                    <Tag key={idx} color="blue" style={{ margin: '2px' }}>
                      {index}
                    </Tag>
                  ))}
                </Space>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 当前将只查询配置中指定的索引模式。如需查询其他索引，请修改ELK配置。
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* 索引模式选择器 - 只有在配置中没有指定索引时才显示 */}
          {activeConfig && availableIndices.length > 0 &&
           (!activeConfig.indices || !Array.isArray(activeConfig.indices) || activeConfig.indices.length === 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>选择索引模式：</Text>
                <Button
                  type="link"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={indicesLoading}
                  onClick={() => loadAvailableIndices(activeConfig.id!)}
                  style={{ marginLeft: 8 }}
                >
                  刷新索引模式
                </Button>
              </div>
              <Select
                mode="multiple"
                placeholder="选择索引模式进行正则匹配查询（如 logs-* 匹配所有相关索引）"
                style={{ width: '100%' }}
                value={selectedIndices}
                onChange={setSelectedIndices}
                allowClear
                loading={indicesLoading}
                showSearch
                optionFilterProp="label"
                maxTagCount={5}
                maxTagTextLength={20}
                optionLabelProp="label"
              >
                {availableIndices.map(index => (
                  <Select.Option
                    key={index.name}
                    value={index.name}
                    label={index.name}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{index.name}</span>
                        <div style={{ fontSize: '10px', color: '#666', marginTop: 2 }}>
                          匹配模式：可查询所有符合 {index.name} 的索引
                        </div>
                      </div>
                      <Space size="small">
                        <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>
                          {(index as any).matchingIndices} 个索引
                        </Tag>
                        <Text type="secondary" style={{ fontSize: '10px' }}>
                          {index.docsCount.toLocaleString()} docs
                        </Text>
                      </Space>
                    </div>
                  </Select.Option>
                ))}
              </Select>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {selectedIndices.length > 0 ? (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      已选择 {selectedIndices.length} 个索引模式，将匹配所有符合条件的索引
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      将查询所有 {availableIndices.length} 个索引模式下的匹配索引
                    </Text>
                  )}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    总计: {availableIndices.reduce((sum, index) => sum + index.docsCount, 0).toLocaleString()} 条文档
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* 索引模式加载状态 */}
          {activeConfig && indicesLoading && availableIndices.length === 0 && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ marginLeft: 8 }}>正在获取索引模式...</Text>
            </div>
          )}

          <Form
            form={searchForm}
            layout="inline"
            onFinish={searchLogs}
            initialValues={{
              level: 'all',
              size: 100
            }}
          >
            <Form.Item name="timeRange" label="时间范围">
              <RangePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={['开始时间', '结束时间']}
              />
            </Form.Item>
            
            <Form.Item name="level" label="日志级别">
              <Select style={{ width: 120 }}>
                <Select.Option value="all">全部</Select.Option>
                <Select.Option value="error">ERROR</Select.Option>
                <Select.Option value="warn">WARN</Select.Option>
                <Select.Option value="info">INFO</Select.Option>
                <Select.Option value="debug">DEBUG</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="keyword" label="关键词">
              <Input
                placeholder="搜索日志内容"
                style={{ width: 200 }}
                allowClear
              />
            </Form.Item>

            <Form.Item name="source" label="来源">
              <Input
                placeholder="日志来源"
                style={{ width: 150 }}
                allowClear
              />
            </Form.Item>

            <Form.Item name="size" label="数量">
              <InputNumber
                min={10}
                max={1000}
                style={{ width: 80 }}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  loading={loading}
                  disabled={!activeConfig}
                >
                  搜索
                </Button>
                
                <Button
                  icon={realTimeEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={toggleRealTime}
                  disabled={!activeConfig}
                  type={realTimeEnabled ? 'default' : 'dashed'}
                >
                  {realTimeEnabled ? '停止实时' : '实时日志'}
                </Button>

                <Button
                  icon={<ClearOutlined />}
                  onClick={clearLogs}
                  disabled={logs.length === 0}
                >
                  清空
                </Button>

                <Button
                  icon={<DownloadOutlined />}
                  onClick={exportLogs}
                  disabled={logs.length === 0}
                >
                  导出
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* 日志显示 */}
        <Card
          title={
            <Space>
              <Text>日志列表</Text>
              {realTimeEnabled && <Badge status="processing" text="实时更新中" />}
              <Text type="secondary">({logs.length} 条)</Text>
            </Space>
          }
        >
          {logs.length === 0 ? (
            <Empty
              description="暂无日志数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div
              style={{
                maxHeight: '600px',
                overflow: 'auto',
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#fafafa',
                padding: '16px',
                borderRadius: '6px',
                border: isDark ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid #d9d9d9'
              }}
            >
              {logs.map((log, index) => (
                <div
                  key={log.id || index}
                  style={{
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                    borderRadius: '4px',
                    border: isDark ? '1px solid rgba(71, 85, 105, 0.2)' : '1px solid #f0f0f0',
                    fontSize: '12px',
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                  }}
                >
                  <div style={{ marginBottom: '4px' }}>
                    <Space>
                      <Text
                        type="secondary"
                        style={{ color: isDark ? '#94a3b8' : '#666666' }}
                      >
                        {log.timestamp}
                      </Text>
                      <Tag
                        color={
                          log.level === 'error' ? 'red' :
                          log.level === 'warn' ? 'orange' :
                          log.level === 'info' ? 'blue' :
                          log.level === 'debug' ? 'green' : 'default'
                        }
                      >
                        {log.level.toUpperCase()}
                      </Tag>
                      <Text
                        style={{ color: isDark ? '#e2e8f0' : '#333333' }}
                      >
                        [{log.source}]
                      </Text>
                      <Text
                        type="secondary"
                        style={{ color: isDark ? '#94a3b8' : '#666666' }}
                      >
                        {log.host}
                      </Text>
                      {log.service && (
                        <Tag color="cyan">{log.service}</Tag>
                      )}
                    </Space>
                  </div>
                  <div
                    style={{
                      color: isDark ? '#f8fafc' : '#262626',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {log.message}
                  </div>
                  {log.tags && log.tags.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      {log.tags.map((tag, tagIndex) => (
                        <Tag key={tagIndex}>{tag}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ELK配置模态框 */}
        <Modal
          title={editingConfig ? '编辑ELK配置' : '新建ELK配置'}
          open={configModalVisible}
          onCancel={() => {
            setConfigModalVisible(false)
            setEditingConfig(null)
            setTestResult(null)
            setConfigSelectedIndices([])
            configForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={configForm}
            layout="vertical"
            onFinish={saveConfig}
            initialValues={{
              port: 9200,
              ssl: false,
              isActive: true
            }}
          >
            <Form.Item
              name="name"
              label="配置名称"
              rules={[{ required: true, message: '请输入配置名称' }]}
            >
              <Input placeholder="例如：生产环境ELK" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="host"
                  label="ELK服务器地址"
                  rules={[{ required: true, message: '请输入服务器地址' }]}
                >
                  <Input placeholder="例如：192.168.1.100" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="port"
                  label="端口"
                  rules={[{ required: true, message: '请输入端口' }]}
                >
                  <InputNumber
                    min={1}
                    max={65535}
                    style={{ width: '100%' }}
                    placeholder="9200"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="索引模式"
            >
              <div>
                <Alert
                  message="可填写特定索引模式，或留空查询所有索引"
                  type="info"
                  showIcon
                  style={{ marginBottom: 8 }}
                />

                <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                  输入要查询的索引模式（可选，支持通配符）：
                </Text>

                <Input.TextArea
                  placeholder="例如：&#10;logs-*&#10;app-*&#10;service-*&#10;&#10;每行一个索引模式，留空则查询所有索引"
                  value={configSelectedIndices.join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').filter(line => line.trim() !== '')
                    setConfigSelectedIndices(lines)
                  }}
                  rows={4}
                  style={{ width: '100%' }}
                />

                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 提示：支持通配符（*），每行输入一个索引模式。例如：logs-*, app-*, service-*
                  </Text>
                </div>
              </div>
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="username" label="用户名">
                  <Input placeholder="可选" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="password" label="密码">
                  <Input.Password placeholder="可选" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="apiKey" label="API密钥">
              <Input.Password placeholder="可选，用于API认证" />
            </Form.Item>

            <Form.Item name="webUrl" label="ELK访问链接">
              <Input
                placeholder="例如：https://your-elk-server:5601 (可选，用于快速访问ELK/Kibana界面)"
                addonBefore={<EyeOutlined />}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="ssl" valuePropName="checked">
                  <Switch checkedChildren="HTTPS" unCheckedChildren="HTTP" />
                  <span style={{ marginLeft: 8 }}>启用SSL</span>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="isActive" valuePropName="checked">
                  <Switch checkedChildren="激活" unCheckedChildren="禁用" />
                  <span style={{ marginLeft: 8 }}>设为活动配置</span>
                </Form.Item>
              </Col>
            </Row>

            {testResult && (
              <Alert
                message={testResult.success ? '连接测试成功' : '连接测试失败'}
                description={
                  <div>
                    <div>{testResult.message}</div>
                    {testResult.indexPatterns && testResult.indexPatterns.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text strong>检测到的索引模式：</Text>
                        <div style={{ marginTop: 4 }}>
                          {testResult.indexPatterns.map((pattern: string, i: number) => (
                            <Tag key={i} style={{ marginBottom: 4 }}>{pattern}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                }
                type={testResult.success ? 'success' : 'error'}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={!canWrite || saving}
                  loading={saving}
                >
                  {saving ? '保存中...' : '保存配置'}
                </Button>
                <Button
                  onClick={() => {
                    const values = configForm.getFieldsValue()
                    testConnection(values)
                  }}
                  loading={testLoading}
                >
                  测试连接
                </Button>
                <Button
                  onClick={() => {
                    setConfigModalVisible(false)
                    setEditingConfig(null)
                    setTestResult(null)
                    setConfigSelectedIndices([])
                    configForm.resetFields()
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  )
}

export default ELKLogsPage
