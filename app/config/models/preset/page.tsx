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
  message,
  Typography,
  Tag,
  Popconfirm,
  Row,
  Col,
  Divider,
  Switch
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import MainLayout from '../../../components/layout/MainLayout'

const { Title, Text } = Typography
const { Option } = Select

interface PresetModel {
  id: string
  name: string
  displayName: string
  provider: string
  description?: string
  contextLength?: number
  maxTokens?: number
  supportedFeatures?: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PresetModelFormData {
  name: string
  displayName: string
  provider: string
  description?: string
  contextLength?: number
  maxTokens?: number
  supportedFeatures?: string[]
  isActive: boolean
}

const PresetModelsPage: React.FC = () => {
  const [presetModels, setPresetModels] = useState<PresetModel[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingModel, setEditingModel] = useState<PresetModel | null>(null)
  const [form] = Form.useForm()
  const [providerFilter, setProviderFilter] = useState<string>('all')

  // 提供商选项
  const providers = [
    { id: 'openai-compatible', name: 'OpenAI Compatible', color: '#10A37F' },
    { id: 'deepseek', name: 'DeepSeek', color: '#1890FF' },
    { id: 'gemini', name: 'Google Gemini', color: '#4285F4' },
    { id: 'qwen', name: 'Qwen', color: '#FF6B35' },
    { id: 'doubao', name: 'Doubao', color: '#722ED1' }
  ]

  // 支持的功能选项
  const supportedFeatureOptions = [
    'chat',
    'completion',
    'embedding',
    'vision',
    'tools',
    'streaming',
    'json_mode'
  ]

  // 获取预设模型列表
  const fetchPresetModels = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (providerFilter !== 'all') {
        params.append('provider', providerFilter)
      }
      
      const response = await fetch(`/api/config/preset-models?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setPresetModels(data.presetModels)
      } else {
        message.error('获取预设模型列表失败')
      }
    } catch (error) {
      message.error('获取预设模型列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存预设模型
  const handleSave = async (values: PresetModelFormData) => {
    try {
      const url = editingModel ? '/api/config/preset-models' : '/api/config/preset-models'
      const method = editingModel ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingModel ? { ...values, id: editingModel.id } : values),
      })

      const data = await response.json()

      if (data.success) {
        message.success(editingModel ? '更新预设模型成功' : '创建预设模型成功')
        setIsModalVisible(false)
        setEditingModel(null)
        form.resetFields()
        fetchPresetModels()
      } else {
        message.error(data.error || '操作失败')
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  // 删除预设模型
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/config/preset-models?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        message.success('删除预设模型成功')
        fetchPresetModels()
      } else {
        message.error(data.error || '删除失败')
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 编辑预设模型
  const handleEdit = (record: PresetModel) => {
    setEditingModel(record)
    form.setFieldsValue({
      name: record.name,
      displayName: record.displayName,
      provider: record.provider,
      description: record.description || '',
      contextLength: record.contextLength,
      maxTokens: record.maxTokens,
      supportedFeatures: record.supportedFeatures || [],
      isActive: record.isActive
    })
    setIsModalVisible(true)
  }

  // 新增预设模型
  const handleAdd = () => {
    setEditingModel(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  // 表格列定义
  const columns = [
    {
      title: '模型信息',
      key: 'model',
      render: (record: PresetModel) => (
        <div className="flex items-center">
          <div className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold mr-3"
               style={{ backgroundColor: providers.find(p => p.id === record.provider)?.color || '#722ed1' }}>
            {record.provider === 'deepseek' ? 'DS' :
             record.provider === 'openai-compatible' ? 'AI' :
             record.provider === 'gemini' ? 'GM' :
             record.provider === 'qwen' ? 'QW' : 'DB'}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{record.displayName}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{record.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{providers.find(p => p.id === record.provider)?.name}</div>
          </div>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '规格',
      key: 'specs',
      render: (record: PresetModel) => (
        <Space direction="vertical" size="small">
          {record.contextLength && (
            <Tag>上下文: {record.contextLength.toLocaleString()}</Tag>
          )}
          {record.maxTokens && (
            <Tag>最大tokens: {record.maxTokens.toLocaleString()}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '支持功能',
      key: 'features',
      render: (record: PresetModel) => (
        <Space wrap>
          {record.supportedFeatures?.map(feature => (
            <Tag key={feature}>{feature}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (record: PresetModel) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: PresetModel) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个预设模型吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  useEffect(() => {
    fetchPresetModels()
  }, [providerFilter])

  return (
    <MainLayout>
      <div className="p-6">
        <Card>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Title level={4} className="flex items-center mb-2">
                  <DatabaseOutlined className="mr-2" />
                  预设模型管理
                </Title>
                <Text type="secondary">
                  管理可用于模型配置的预设模型模板，用户可以从这些预设模型中快速选择
                </Text>
              </div>
              <Button
                type="default"
                size="large"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加预设模型
              </Button>
            </div>
          </div>

        <div className="mb-4">
          <Select
            value={providerFilter}
            onChange={setProviderFilter}
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
          dataSource={presetModels}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个预设模型`,
          }}
        />

        <Modal
          title={
            <span className="flex items-center">
              <DatabaseOutlined className="mr-2" />
              {editingModel ? '编辑预设模型' : '添加预设模型'}
            </span>
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
            onFinish={handleSave}
            initialValues={{
              isActive: true,
              supportedFeatures: ['chat']
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="模型名称"
                  name="name"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                >
                  <Input placeholder="例如: gpt-4" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="显示名称"
                  name="displayName"
                  rules={[{ required: true, message: '请输入显示名称' }]}
                >
                  <Input placeholder="例如: GPT-4" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="提供商"
                  name="provider"
                  rules={[{ required: true, message: '请选择提供商' }]}
                >
                  <Select placeholder="选择提供商">
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
                  label="状态"
                  name="isActive"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="描述"
              name="description"
            >
              <Input.TextArea rows={3} placeholder="模型描述..." />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="上下文长度"
                  name="contextLength"
                >
                  <Input type="number" placeholder="例如: 8192" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="最大输出tokens"
                  name="maxTokens"
                >
                  <Input type="number" placeholder="例如: 4096" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="支持功能"
              name="supportedFeatures"
            >
              <Select
                mode="multiple"
                placeholder="选择支持的功能"
                options={supportedFeatureOptions.map(feature => ({
                  label: feature,
                  value: feature
                }))}
              />
            </Form.Item>

            <Divider />

            <div className="flex justify-end space-x-2">
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                icon={<CheckCircleOutlined />}
              >
                {editingModel ? '更新' : '创建'}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
      </div>
    </MainLayout>
  )
}

export default PresetModelsPage
