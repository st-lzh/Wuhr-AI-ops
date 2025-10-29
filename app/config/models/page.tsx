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
  Tag,
  Tooltip,
  message,
  Avatar,
  Row,
  Col,
  Divider,
  Alert,
  Tabs,
  Switch
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  LoadingOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  ToolOutlined,
  CodeOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { PROVIDER_CONFIGS, getDefaultModels, getProviderDisplayInfo, isBaseUrlRequired } from '../kubelet-wuhrai-providers'
import { DEFAULT_MODELS } from '../../types/api'
import MCPToolsConfig from '../../components/config/MCPToolsConfig'
import CustomToolsConfig from '../../components/config/CustomToolsConfig'

const { Title, Text } = Typography
const { Option } = Select
const { TabPane } = Tabs

// 模型配置接口
interface ModelConfig {
  id: string
  modelName: string
  displayName: string
  provider: string
  apiKey: string
  baseUrl?: string
  description?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface ModelFormData {
  modelName: string
  displayName: string
  provider: string
  apiKey: string
  baseUrl?: string
  description?: string
  isDefault?: boolean // 新增默认模型字段
}

// 模型配置组件
const ModelConfigPanel: React.FC = () => {
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; responseTime?: number; error?: string }>>({})
  const [form] = Form.useForm<ModelFormData>()

  // 提供商选项
  const providers = [
    { id: 'openai-compatible', name: 'OpenAI Compatible', color: '#10A37F' },
    { id: 'deepseek', name: 'DeepSeek', color: '#1890FF' },
    { id: 'gemini', name: 'Google Gemini', color: '#4285F4' },
    { id: 'qwen', name: 'Qwen', color: '#FF6B35' },
    { id: 'doubao', name: 'Doubao', color: '#722ED1' },
    { id: 'local-deployment', name: 'Local Deployment', color: '#52C41A' }
  ]

  // 获取模型配置列表
  const fetchModelConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/config/model-configs', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setModelConfigs(data.models || [])
      } else {
        message.error('获取模型配置失败')
      }
    } catch (error) {
      console.error('获取模型配置失败:', error)
      message.error('获取模型配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModelConfigs()
    fetchPresetModels()
  }, [])

  // 保存模型配置
  const saveModelConfig = async (values: ModelFormData) => {
    try {
      const url = '/api/config/model-configs'
      const method = editingModel ? 'PUT' : 'POST'
      const body = editingModel 
        ? { ...values, id: editingModel.id }
        : values

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        message.success(editingModel ? '模型配置更新成功' : '模型配置创建成功')
        setIsModalVisible(false)
        setEditingModel(null)
        form.resetFields()
        fetchModelConfigs()
      } else {
        const error = await response.text()
        message.error(`${editingModel ? '更新' : '创建'}模型配置失败: ${error}`)
      }
    } catch (error) {
      console.error('保存模型配置失败:', error)
      message.error(`${editingModel ? '更新' : '创建'}模型配置失败`)
    }
  }

  // 删除模型配置
  const deleteModelConfig = async (id: string) => {
    try {
      const response = await fetch(`/api/config/model-configs?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        message.success('模型配置删除成功')
        fetchModelConfigs()
      } else {
        const error = await response.text()
        message.error(`删除模型配置失败: ${error}`)
      }
    } catch (error) {
      console.error('删除模型配置失败:', error)
      message.error('删除模型配置失败')
    }
  }

  // 测试API连接
  const testModelAPI = async (model: ModelConfig) => {
    setTestingId(model.id)
    const startTime = Date.now()
    
    try {
      const response = await fetch('/api/config/model-configs/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: model.id,
          provider: model.provider,
          modelName: model.modelName,
          apiKey: model.apiKey,
          baseUrl: model.baseUrl
        })
      })

      const responseTime = Date.now() - startTime
      const result = await response.json()

      if (response.ok && result.success) {
        setTestResults(prev => ({
          ...prev,
          [model.id]: { success: true, responseTime }
        }))
        message.success(`API测试成功 (${responseTime}ms)`)
      } else {
        setTestResults(prev => ({
          ...prev,
          [model.id]: { success: false, error: result.error || '测试失败' }
        }))
        message.error(`API测试失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      setTestResults(prev => ({
        ...prev,
        [model.id]: { success: false, error: (error as Error).message }
      }))
      message.error(`API测试失败: ${(error as Error).message}`)
    } finally {
      setTestingId(null)
    }
  }

  // 设置默认模型
  const setDefaultModel = async (modelId: string) => {
    try {
      const response = await fetch('/api/config/model-configs/set-default', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId })
      })

      const result = await response.json()
      if (result.success) {
        message.success(result.message || '默认模型设置成功')
        fetchModelConfigs() // 重新获取数据以显示最新状态
      } else {
        message.error(result.error || '设置默认模型失败')
      }
    } catch (error) {
      console.error('设置默认模型失败:', error)
      message.error('设置默认模型失败')
    }
  }

  // 处理提供商选择变化
  const handleProviderChange = (provider: string) => {
    let defaultBaseUrl = undefined
    if (provider === 'openai-compatible') {
      defaultBaseUrl = 'https://api.openai.com/v1'
    } else if (provider === 'local-deployment') {
      defaultBaseUrl = 'http://localhost:8000/v1'
    }

    form.setFieldsValue({
      provider,
      modelName: '',
      displayName: '',
      baseUrl: defaultBaseUrl,
      apiKey: provider === 'local-deployment' ? '' : undefined
    })
    // 获取该提供商的预设模型
    fetchPresetModels(provider)
  }

  // 获取预设模型列表
  const [presetModels, setPresetModels] = useState<any[]>([])

  const fetchPresetModels = async (provider?: string) => {
    try {
      const params = new URLSearchParams()
      if (provider && provider !== 'all') {
        params.append('provider', provider)
      }
      
      const response = await fetch(`/api/config/preset-models?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setPresetModels(data.presetModels.filter((model: any) => model.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch preset models:', error)
    }
  }

  // 处理预设模型选择
  const handlePresetModelSelect = (value: string) => {
    const presetModel = presetModels.find(model => model.id === value)

    if (presetModel) {
      // 选择了预设模型
      form.setFieldsValue({
        modelName: presetModel.name,
        displayName: presetModel.displayName,
        description: presetModel.description
      })
    } else {
      // 直接输入的模型名称
      form.setFieldsValue({
        modelName: value
      })
    }
  }

  // 过滤模型
  const filteredModels = modelConfigs.filter(model => {
    if (selectedProvider === 'all') return true
    return model.provider === selectedProvider
  })

  // 表格列定义
  const columns = [
    {
      title: '模型信息',
      key: 'model',
      render: (record: ModelConfig) => (
        <div className="flex items-center space-x-3">
          <Avatar 
            size={40} 
            style={{ 
              backgroundColor: providers.find(p => p.id === record.provider)?.color || '#722ed1',
              color: '#FFFFFF',
              fontWeight: 'bold'
            }}
          >
            {record.provider === 'deepseek' ? 'DS' :
             record.provider === 'openai-compatible' ? 'AI' :
             record.provider === 'gemini' ? 'GM' :
             record.provider === 'qwen' ? 'QW' : 'DB'}
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-white">{record.displayName}</span>
              <Tooltip title={record.isDefault ? "默认模型" : "设为默认模型"}>
                <Button
                  type="text"
                  size="small"
                  icon={record.isDefault ? <StarFilled /> : <StarOutlined />}
                  onClick={() => setDefaultModel(record.id)}
                  className={`${
                    record.isDefault
                      ? "text-yellow-500 hover:text-yellow-600"
                      : "text-gray-400 hover:text-yellow-500"
                  } p-0 h-auto min-w-0`}
                  style={{ border: 'none', boxShadow: 'none' }}
                />
              </Tooltip>
            </div>
            <div className="text-sm text-gray-400">{record.modelName}</div>
            <div className="text-xs text-gray-500">{record.provider}</div>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (record: ModelConfig) => (
        <Space direction="vertical" size="small">
          {testResults[record.id] && (
            <Tag color={testResults[record.id].success ? 'success' : 'error'}>
              {testResults[record.id].success ? 
                `✅ ${testResults[record.id].responseTime}ms` : 
                '❌ 测试失败'
              }
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: ModelConfig) => (
        <Space>
          <Tooltip title="测试API">
            <Button
              type="text"
              icon={testingId === record.id ? <LoadingOutlined /> : <ApiOutlined />}
              loading={testingId === record.id}
              onClick={() => testModelAPI(record)}
              disabled={testingId !== null}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingModel(record)
                form.setFieldsValue({
                  modelName: record.modelName,
                  displayName: record.displayName,
                  provider: record.provider,
                  apiKey: record.apiKey,
                  baseUrl: record.baseUrl || '',
                  description: record.description || '',
                  isDefault: record.isDefault || false // 添加默认状态
                })
                setIsModalVisible(true)
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除模型 "${record.displayName}" 吗？`,
                  onOk: () => deleteModelConfig(record.id)
                })
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Text type="secondary">管理您的AI模型配置，支持多种提供商和模型类型</Text>
        </div>
        <Button
          type="default"
          icon={<PlusOutlined />}
          size="large"
          className="border-blue-500 text-blue-500 hover:border-blue-400 hover:text-blue-400 bg-transparent"
          onClick={() => {
            setEditingModel(null)
            form.resetFields()
            setIsModalVisible(true)
          }}
        >
          添加模型
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <Select
            value={selectedProvider}
            onChange={setSelectedProvider}
            style={{ width: 200 }}
            placeholder="筛选提供商"
          >
            <Option value="all">所有提供商</Option>
            {providers.map(provider => (
              <Option key={provider.id} value={provider.id}>
                <span className="flex items-center">
                  <span
                    className="mr-2 w-4 h-4 rounded"
                    style={{ backgroundColor: provider.color }}
                  ></span>
                  {provider.name}
                </span>
              </Option>
            ))}
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={filteredModels}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个模型`
          }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center">
            <RocketOutlined className="mr-2 text-blue-500" />
            {editingModel ? '编辑模型配置' : '添加模型配置'}
          </div>
        }
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false)
          setEditingModel(null)
          form.resetFields()
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveModelConfig}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="provider"
                label="提供商"
                rules={[{ required: true, message: '请选择提供商' }]}
              >
                <Select 
                  placeholder="选择提供商"
                  onChange={handleProviderChange}
                  showSearch
                  filterOption={(input, option) => {
                    const label = option?.label || option?.children || '';
                    return String(label).toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {providers.map(provider => (
                    <Option key={provider.id} value={provider.id}>
                      <span className="flex items-center">
                        <span 
                          className="mr-2 w-4 h-4 rounded" 
                          style={{ backgroundColor: provider.color }}
                        ></span>
                        {provider.name}
                      </span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="modelName"
                label="预设模型"
                rules={[{
                  required: true,
                  message: '请选择或输入模型名称'
                }]}
              >
                {presetModels.length > 0 ? (
                  <Select
                    placeholder="选择预设模型"
                    showSearch
                    allowClear
                    onChange={handlePresetModelSelect}
                    filterOption={(input, option) => {
                      const label = option?.label || option?.children || '';
                      return String(label).toLowerCase().includes(input.toLowerCase());
                    }}
                    optionLabelProp="label"
                    style={{ width: '100%' }}
                  >
                    {presetModels.map(model => (
                      <Option
                        key={model.id}
                        value={model.name}
                        label={model.displayName}
                      >
                        <div className="py-1">
                          <div className="font-medium text-gray-900 dark:text-white truncate" title={model.displayName}>
                            {model.displayName}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate" title={model.name}>
                            {model.name}
                          </div>
                          {model.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 truncate" title={model.description}>
                              {model.description}
                            </div>
                          )}
                        </div>
                      </Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    placeholder="请输入模型名称，如：IRUCAAI/Opeai_ECV2_Qwen3-8B"
                    onChange={(e) => {
                      const value = e.target.value
                      form.setFieldsValue({ modelName: value })
                      if (value) {
                        handlePresetModelSelect(value)
                      }
                    }}
                  />
                )}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="displayName"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="例如：GPT-4" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="apiKey"
                label="API密钥"
                rules={[{
                  required: form.getFieldValue('provider') !== 'local-deployment',
                  message: '请输入API密钥'
                }]}
              >
                <Input.Password
                  placeholder={form.getFieldValue('provider') === 'local-deployment' ? '本地部署无需API密钥（可选）' : '输入API密钥'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="baseUrl"
            label="Base URL"
            extra={
              <div className="space-y-1">
                <div className="text-gray-500">
                  {form.getFieldValue('provider') === 'openai-compatible' ? 'OpenAI兼容服务需要自定义Base URL' : '可选，自定义API地址'}
                </div>
                <div className="text-xs text-gray-400">
                  填写规则：https://api.deepseek.com/v1 需要带v1后缀
                </div>
              </div>
            }
          >
            <Input placeholder={form.getFieldValue('provider') === 'openai-compatible' ? 'https://api.openai.com/v1' : '可选，自定义API地址'} />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="可选，模型描述" rows={3} />
          </Form.Item>

          <Form.Item
            name="isDefault"
            label="设为默认模型"
            valuePropName="checked"
            extra="启用后，AI助手将优先使用此模型"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Divider />

          <div className="flex justify-end space-x-2">
            <Button onClick={() => {
              setIsModalVisible(false)
              setEditingModel(null)
              form.resetFields()
            }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>
              {editingModel ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default function ModelsPage() {
  const [activeTab, setActiveTab] = useState('models')

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <SettingOutlined className="mr-2" />
            模型管理
          </Title>
          <Text type="secondary">
            管理AI模型配置、MCP工具和自定义工具，统一配置您的AI助手功能
          </Text>
        </div>

        <Card className="min-h-[600px]">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="line"
            size="large"
          >
            <TabPane
              tab={
                <span>
                  <RocketOutlined />
                  模型配置
                </span>
              }
              key="models"
            >
              <ModelConfigPanel />
            </TabPane>

            <TabPane
              tab={
                <span>
                  <ToolOutlined />
                  MCP工具
                </span>
              }
              key="mcp-tools"
            >
              <div className="py-4">
                <MCPToolsConfig />
              </div>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <CodeOutlined />
                  自定义工具
                </span>
              }
              key="custom-tools"
            >
              <div className="py-4">
                <CustomToolsConfig />
              </div>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </MainLayout>
  )
}
