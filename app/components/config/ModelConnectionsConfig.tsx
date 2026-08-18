'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd'
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography

interface PresetModel {
  id: string
  name: string
  displayName: string
  description?: string
  supportedFeatures: string[]
  tags: string[]
}

interface ProviderCatalog {
  id: string
  displayName: string
  adapter: string
  defaultBaseUrl?: string
  apiKeyRequired: boolean
  baseUrlEditable: boolean
  supportsModelDiscovery: boolean
  docsUrl?: string
  description?: string
  color?: string
  presetModels: PresetModel[]
}

interface ConnectionModel {
  id: string
  modelName: string
  displayName: string
  isActive: boolean
  isDefault: boolean
  supportsFunctionCalling: boolean
}

interface ModelConnection {
  id: string
  name: string
  providerKey: string
  adapter: string
  baseUrl?: string
  hasApiKey: boolean
  maskedApiKey?: string
  isActive: boolean
  lastTestedAt?: string
  testResult?: string
  provider: ProviderCatalog
  models: ConnectionModel[]
}

interface ConnectionFormValues {
  name: string
  apiKey?: string
  baseUrl?: string
}

const requestError = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json()
    return payload.error || payload.message || fallback
  } catch {
    return fallback
  }
}

const ModelConnectionsConfig: React.FC = () => {
  const [providers, setProviders] = useState<ProviderCatalog[]>([])
  const [connections, setConnections] = useState<ModelConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState<ModelConnection | null>(null)
  const [providerKey, setProviderKey] = useState('')
  const [modelNames, setModelNames] = useState<string[]>([])
  const [defaultModelName, setDefaultModelName] = useState('')
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [form] = Form.useForm<ConnectionFormValues>()

  const selectedProvider = useMemo(
    () => providers.find(provider => provider.id === providerKey),
    [providerKey, providers]
  )

  const modelOptions = useMemo(() => {
    const presetNames = selectedProvider?.presetModels.map(model => model.name) || []
    return Array.from(new Set([...presetNames, ...discoveredModels, ...modelNames])).map(value => {
      const preset = selectedProvider?.presetModels.find(model => model.name === value)
      return { value, label: preset ? `${preset.displayName}（${value}）` : value }
    })
  }, [selectedProvider, discoveredModels, modelNames])

  const loadData = async () => {
    try {
      setLoading(true)
      const [providerResponse, connectionResponse] = await Promise.all([
        fetch('/api/config/model-providers', { credentials: 'include' }),
        fetch('/api/config/model-connections', { credentials: 'include' })
      ])
      if (!providerResponse.ok) throw new Error(await requestError(providerResponse, '获取厂商目录失败'))
      if (!connectionResponse.ok) throw new Error(await requestError(connectionResponse, '获取模型连接失败'))

      const providerPayload = await providerResponse.json()
      const connectionPayload = await connectionResponse.json()
      setProviders(providerPayload.data || [])
      setConnections(connectionPayload.data || [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载模型管理数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setProviderKey('')
    setModelNames([])
    setDefaultModelName('')
    setDiscoveredModels([])
    setStep(0)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (connection: ModelConnection) => {
    setEditing(connection)
    setProviderKey(connection.providerKey)
    setModelNames(connection.models.map(model => model.modelName))
    setDefaultModelName(connection.models.find(model => model.isDefault)?.modelName || '')
    setDiscoveredModels([])
    setStep(1)
    form.setFieldsValue({
      name: connection.name,
      apiKey: undefined,
      baseUrl: connection.baseUrl
    })
    setModalOpen(true)
  }

  const selectProvider = (value: string) => {
    const provider = providers.find(item => item.id === value)
    setProviderKey(value)
    setModelNames([])
    setDefaultModelName('')
    setDiscoveredModels([])
    form.setFieldsValue({
      name: provider?.displayName,
      apiKey: undefined,
      baseUrl: provider?.defaultBaseUrl
    })
  }

  const validateConnectionStep = async () => {
    const fields = ['name'] as Array<keyof ConnectionFormValues>
    if (selectedProvider?.apiKeyRequired && !editing?.hasApiKey) fields.push('apiKey')
    if (selectedProvider?.baseUrlEditable) fields.push('baseUrl')
    await form.validateFields(fields)
  }

  const discoverModels = async () => {
    if (!selectedProvider) return
    try {
      await validateConnectionStep()
      setDiscovering(true)
      const values = form.getFieldsValue()
      const response = await fetch('/api/config/model-connections/discover', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          providerKey,
          apiKey: values.apiKey,
          baseUrl: values.baseUrl
        })
      })
      if (!response.ok) throw new Error(await requestError(response, '模型发现失败'))
      const payload = await response.json()
      const models = payload.data || []
      setDiscoveredModels(models)
      message.success(`已从厂商获取 ${models.length} 个模型`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型发现失败')
    } finally {
      setDiscovering(false)
    }
  }

  const testConnection = async (connection?: ModelConnection) => {
    const id = connection?.id || 'draft'
    try {
      if (!connection) await validateConnectionStep()
      setTestingId(id)
      const values: Partial<ConnectionFormValues> = connection ? {} : form.getFieldsValue()
      const modelName = connection?.models[0]?.modelName || modelNames[0] || selectedProvider?.presetModels[0]?.name
      const response = await fetch('/api/config/model-connections/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: connection?.id || editing?.id,
          providerKey: connection?.providerKey || providerKey,
          apiKey: values.apiKey,
          baseUrl: values.baseUrl,
          modelName
        })
      })
      if (!response.ok) throw new Error(await requestError(response, '连接测试失败'))
      const payload = await response.json()
      message.success(`连接测试成功（${payload.responseTime}ms）`)
      if (connection) await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '连接测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const saveConnection = async () => {
    if (!selectedProvider || modelNames.length === 0) {
      message.warning('请至少选择或输入一个模型 ID')
      return
    }
    try {
      await validateConnectionStep()
      setSaving(true)
      // 连接配置位于上一步，进入模型选择后对应 Form.Item 已卸载。
      // 传入 true 才能读取 Ant Design 表单存储中保留的全部步骤数据。
      const values = form.getFieldsValue(true)
      const response = await fetch('/api/config/model-connections', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          name: values.name,
          providerKey,
          apiKey: values.apiKey,
          baseUrl: values.baseUrl,
          modelNames,
          defaultModelName: defaultModelName || undefined,
          isActive: true
        })
      })
      if (!response.ok) throw new Error(await requestError(response, '保存连接失败'))
      const payload = await response.json()
      message.success(payload.message || '模型服务连接已保存')
      setModalOpen(false)
      await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存连接失败')
    } finally {
      setSaving(false)
    }
  }

  const deleteConnection = async (id: string) => {
    const response = await fetch(`/api/config/model-connections?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (!response.ok) {
      message.error(await requestError(response, '删除连接失败'))
      return
    }
    message.success('模型服务连接已删除')
    await loadData()
  }

  const setDefaultModel = async (modelId: string) => {
    const response = await fetch('/api/config/model-configs/set-default', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId })
    })
    if (!response.ok) {
      message.error(await requestError(response, '设置默认模型失败'))
      return
    }
    message.success('团队默认模型已更新')
    await loadData()
  }

  const columns = [
    {
      title: '模型服务',
      key: 'connection',
      render: (_: unknown, record: ModelConnection) => (
        <Space>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ background: record.provider?.color || '#64748b' }}
          >
            {record.provider?.displayName?.slice(0, 2).toUpperCase() || 'AI'}
          </span>
          <div>
            <div className="font-medium">{record.name}</div>
            <Text type="secondary">{record.provider?.displayName || record.providerKey}</Text>
          </div>
        </Space>
      )
    },
    {
      title: '连接地址',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
      render: (value: string, record: ModelConnection) => (
        <div className="max-w-sm">
          <Text ellipsis={{ tooltip: value }}>{value}</Text>
          <div><Text type="secondary">Key：{record.maskedApiKey || '无需密钥'}</Text></div>
        </div>
      )
    },
    {
      title: '模型',
      dataIndex: 'models',
      key: 'models',
      render: (models: ConnectionModel[]) => <Tag color="blue">{models.length} 个</Tag>
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: ModelConnection) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.isActive ? 'success' : 'default'}>{record.isActive ? '已启用' : '已停用'}</Tag>
          {record.testResult?.startsWith('success') && <Text type="secondary">最近测试通过</Text>}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 210,
      render: (_: unknown, record: ModelConnection) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              icon={<ApiOutlined />}
              loading={testingId === record.id}
              onClick={() => testConnection(record)}
            />
          </Tooltip>
          <Button icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm
            title="删除这个模型服务连接？"
            description="连接下的模型会一并移除，历史聊天记录不会删除。"
            onConfirm={() => deleteConnection(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Space direction="vertical" size={16} className="w-full">
      <Alert
        showIcon
        type="info"
        message="团队共享模型服务"
        description="API Key 和连接地址只保存一次，一个连接可启用多个模型。星标模型是团队默认值；AI 助手里的临时切换只影响当前用户。"
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Title level={4} className="!mb-1">模型接入</Title>
            <Text type="secondary">管理厂商连接、可用模型和团队默认模型</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>接入模型服务</Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={connections}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="尚未接入模型服务" /> }}
          expandable={{
            expandedRowRender: record => (
              <List
                size="small"
                dataSource={record.models}
                renderItem={model => (
                  <List.Item
                    actions={[
                      model.isDefault ? (
                        <Tag key="default" color="gold" icon={<StarFilled />}>团队默认</Tag>
                      ) : (
                        <Button
                          key="set-default"
                          type="link"
                          size="small"
                          icon={<StarOutlined />}
                          onClick={() => setDefaultModel(model.id)}
                        >
                          设为默认
                        </Button>
                      )
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<CloudServerOutlined className="text-lg text-blue-500" />}
                      title={model.displayName}
                      description={model.modelName}
                    />
                  </List.Item>
                )}
              />
            )
          }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? '编辑模型服务连接' : '接入模型服务'}
        width={860}
        destroyOnClose={false}
        onCancel={() => setModalOpen(false)}
        footer={[
          step > 0 && <Button key="back" onClick={() => setStep(value => value - 1)}>上一步</Button>,
          step < 2 && (
            <Button
              key="next"
              type="primary"
              disabled={step === 0 && !providerKey}
              onClick={async () => {
                try {
                  if (step === 1) await validateConnectionStep()
                  setStep(value => value + 1)
                } catch {
                  // Ant Design form renders validation details.
                }
              }}
            >
              下一步
            </Button>
          ),
          step === 2 && <Button key="save" type="primary" loading={saving} onClick={saveConnection}>保存并启用</Button>
        ].filter(Boolean)}
      >
        <Steps
          current={step}
          className="mb-6"
          items={[{ title: '选择厂商' }, { title: '连接配置' }, { title: '选择模型' }]}
        />

        {step === 0 && (
          <Radio.Group value={providerKey} onChange={event => selectProvider(event.target.value)} className="w-full">
            <Row gutter={[12, 12]}>
              {providers.map(provider => (
                <Col xs={24} sm={12} lg={8} key={provider.id}>
                  <Radio.Button value={provider.id} className="!h-full !w-full !whitespace-normal !p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: provider.color || '#64748b' }} />
                      <strong>{provider.displayName}</strong>
                    </div>
                    <div className="text-xs text-gray-500">{provider.description}</div>
                  </Radio.Button>
                </Col>
              ))}
            </Row>
          </Radio.Group>
        )}

        {step === 1 && selectedProvider && (
          <Form form={form} layout="vertical">
            <Alert
              className="mb-4"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message={selectedProvider.displayName}
              description={
                <Space wrap>
                  <Text>{selectedProvider.description}</Text>
                  {selectedProvider.docsUrl && (
                    <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer">
                      官方文档 <LinkOutlined />
                    </a>
                  )}
                </Space>
              }
            />
            <Form.Item
              name="name"
              label="连接名称"
              rules={[{ required: true, message: '请输入连接名称' }]}
            >
              <Input placeholder="例如：生产环境 DeepSeek" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label="API Key"
              extra={editing?.hasApiKey ? `已保存 ${editing.maskedApiKey}，留空表示不修改` : '密钥只需在这个连接中保存一次'}
              rules={[{
                required: selectedProvider.apiKeyRequired && !editing?.hasApiKey,
                message: '请输入 API Key'
              }]}
            >
              <Input.Password
                autoComplete="new-password"
                placeholder={selectedProvider.apiKeyRequired ? '输入厂商 API Key' : '无需密钥时可留空'}
              />
            </Form.Item>
            {selectedProvider.baseUrlEditable ? (
              <Form.Item
                name="baseUrl"
                label="Base URL"
                rules={[
                  { required: true, message: '请输入 Base URL' },
                  { type: 'url', message: '请输入完整的 http(s) URL' }
                ]}
                extra="工作空间、代理、内网或本地部署可以修改此地址"
              >
                <Input placeholder="https://example.com/v1" />
              </Form.Item>
            ) : (
              <Alert
                className="mb-4"
                type="info"
                message="官方 API 地址"
                description={<Text code>{selectedProvider.defaultBaseUrl}</Text>}
              />
            )}
            <Space>
              <Button
                icon={<ApiOutlined />}
                loading={testingId === 'draft'}
                onClick={() => testConnection()}
              >
                测试连接
              </Button>
              {selectedProvider.supportsModelDiscovery && (
                <Button icon={<ReloadOutlined />} loading={discovering} onClick={discoverModels}>
                  获取模型列表
                </Button>
              )}
            </Space>
          </Form>
        )}

        {step === 2 && selectedProvider && (
          <div>
            <Form layout="vertical">
              <Form.Item
                label="启用模型"
                required
                extra="可从推荐清单选择，也可直接输入厂商控制台中的模型 ID 后回车"
              >
                <Select
                  mode="tags"
                  value={modelNames}
                  options={modelOptions}
                  tokenSeparators={[',', ' ']}
                  placeholder="选择或输入模型 ID"
                  onChange={values => {
                    setModelNames(values)
                    if (!editing && !defaultModelName) setDefaultModelName(values[0] || '')
                    if (defaultModelName && !values.includes(defaultModelName)) setDefaultModelName(values[0] || '')
                  }}
                />
              </Form.Item>
              <Form.Item
                label={editing ? '团队默认模型（可选）' : '团队默认模型'}
                required={!editing}
                extra={editing && !defaultModelName ? '留空会保留当前团队默认模型' : undefined}
              >
                <Select
                  value={defaultModelName || undefined}
                  options={modelOptions.filter(option => modelNames.includes(option.value))}
                  placeholder="选择一个团队默认模型"
                  onChange={setDefaultModelName}
                />
              </Form.Item>
            </Form>
            {selectedProvider.presetModels.length > 0 && (
              <div>
                <Text type="secondary">官方当前推荐模型</Text>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedProvider.presetModels.map(model => (
                    <Tooltip key={model.id} title={model.description}>
                      <Tag
                        color={modelNames.includes(model.name) ? 'blue' : 'default'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (modelNames.includes(model.name)) return
                          const values = [...modelNames, model.name]
                          setModelNames(values)
                          if (!editing && !defaultModelName) setDefaultModelName(model.name)
                        }}
                      >
                        {model.displayName}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Space>
  )
}

export default ModelConnectionsConfig
