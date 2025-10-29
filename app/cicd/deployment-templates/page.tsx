'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Tooltip,
  Typography
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import CodeEditor from '@uiw/react-textarea-code-editor'

const { Option } = Select
const { TextArea } = Input
const { Text } = Typography

interface DeploymentTemplate {
  id: string
  name: string
  displayName: string
  description?: string
  category: string
  content: string
  variables?: any
  isActive: boolean
  isBuiltIn: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
    realName?: string
  }
}

interface TemplateFormData {
  name: string
  displayName: string
  description?: string
  category: string
  content: string
  variables?: any
  isActive: boolean
  tags: string[]
}

const DeploymentTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<DeploymentTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DeploymentTemplate | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<DeploymentTemplate | null>(null)
  const [form] = Form.useForm()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [stats, setStats] = useState<any>(null)

  // 模板分类选项
  const categoryOptions = [
    { label: '通用模板', value: 'general' },
    { label: 'Deployment', value: 'deployment' },
    { label: 'Service', value: 'service' },
    { label: 'ConfigMap', value: 'configmap' },
    { label: 'Secret', value: 'secret' },
    { label: 'Ingress', value: 'ingress' },
    { label: 'StatefulSet', value: 'statefulset' },
    { label: 'DaemonSet', value: 'daemonset' }
  ]

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (searchKeyword) params.append('search', searchKeyword)
      if (categoryFilter) params.append('category', categoryFilter)
      
      const response = await fetch(`/api/cicd/deployment-templates?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTemplates(data.data.templates || [])
          setStats(data.data.categoryStats || [])
          console.log('📋 [部署模板页面] 模板列表加载成功:', data.data.templates?.length)
        } else {
          console.error('📋 [部署模板页面] API返回失败:', data.error)
          message.error(data.error || '获取模板列表失败')
        }
      } else {
        console.error('📋 [部署模板页面] API请求失败')
        message.error('获取模板列表失败')
      }
    } catch (error) {
      console.error('📋 [部署模板页面] 加载模板列表失败:', error)
      message.error('加载模板列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    loadTemplates()
  }, [searchKeyword, categoryFilter])

  // 保存模板
  const handleSave = async (values: TemplateFormData) => {
    try {
      const url = editingTemplate 
        ? '/api/cicd/deployment-templates'
        : '/api/cicd/deployment-templates'
      
      const method = editingTemplate ? 'PUT' : 'POST'
      const body = editingTemplate 
        ? { id: editingTemplate.id, ...values }
        : values

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        message.success(data.data.message || `模板${editingTemplate ? '更新' : '创建'}成功`)
        setModalVisible(false)
        setEditingTemplate(null)
        form.resetFields()
        loadTemplates()
      } else {
        message.error(data.error || `${editingTemplate ? '更新' : '创建'}模板失败`)
      }
    } catch (error) {
      console.error('保存模板失败:', error)
      message.error('保存模板失败')
    }
  }

  // 删除模板
  const handleDelete = async (template: DeploymentTemplate) => {
    try {
      const response = await fetch(`/api/cicd/deployment-templates?id=${template.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        message.success('模板删除成功')
        loadTemplates()
      } else {
        message.error(data.error || '删除模板失败')
      }
    } catch (error) {
      console.error('删除模板失败:', error)
      message.error('删除模板失败')
    }
  }

  // 复制模板
  const handleCopy = (template: DeploymentTemplate) => {
    setEditingTemplate(null)
    form.setFieldsValue({
      name: `${template.name}_copy`,
      displayName: `${template.displayName} (副本)`,
      description: template.description,
      category: template.category,
      content: template.content,
      variables: template.variables,
      isActive: true,
      tags: template.tags
    })
    setModalVisible(true)
  }

  // 查看模板
  const handleView = (template: DeploymentTemplate) => {
    setViewingTemplate(template)
    setViewModalVisible(true)
  }

  // 编辑模板
  const handleEdit = (template: DeploymentTemplate) => {
    setEditingTemplate(template)
    form.setFieldsValue({
      name: template.name,
      displayName: template.displayName,
      description: template.description,
      category: template.category,
      content: template.content,
      variables: template.variables,
      isActive: template.isActive,
      tags: template.tags
    })
    setModalVisible(true)
  }

  // 表格列定义
  const columns = [
    {
      title: '模板名称',
      key: 'name',
      render: (record: DeploymentTemplate) => (
        <div>
          <div className="font-medium">{record.displayName}</div>
          <div className="text-sm text-gray-500">{record.name}</div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const categoryOption = categoryOptions.find(opt => opt.value === category)
        return (
          <Tag color="blue">
            {categoryOption?.label || category}
          </Tag>
        )
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <div>
          {tags.map((tag, index) => (
            <Tag key={index}>{tag}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (record: DeploymentTemplate) => (
        <Space>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? '启用' : '禁用'}
          </Tag>
          {record.isBuiltIn && (
            <Tag color="orange">内置</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '创建者',
      key: 'creator',
      render: (record: DeploymentTemplate) => (
        <div>
          <div className="text-sm">{record.user.realName || record.user.username}</div>
          <div className="text-xs text-gray-500">{new Date(record.createdAt).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: DeploymentTemplate) => (
        <Space>
          <Tooltip title="查看">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.isBuiltIn}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个模板吗？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                disabled={record.isBuiltIn}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">部署模板管理</h1>
          <p className="text-gray-600">管理K8s YAML部署文件模板，支持自定义模板和内置模板</p>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
            <Col xs={24} sm={8} md={6}>
              <Card>
                <Statistic
                  title="总模板数"
                  value={templates.length}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Card>
                <Statistic
                  title="启用模板"
                  value={templates.filter(t => t.isActive).length}
                  prefix={<AppstoreOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Card>
                <Statistic
                  title="内置模板"
                  value={templates.filter(t => t.isBuiltIn).length}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Card>
                <Statistic
                  title="分类数量"
                  value={stats.length}
                  prefix={<AppstoreOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 操作栏 */}
        <Card className="mb-4">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8} md={6}>
              <Input
                placeholder="搜索模板名称或描述"
                prefix={<SearchOutlined />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Select
                placeholder="选择分类"
                value={categoryFilter}
                onChange={setCategoryFilter}
                allowClear
                style={{ width: '100%' }}
              >
                {categoryOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={8} md={12}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingTemplate(null)
                    form.resetFields()
                    setModalVisible(true)
                  }}
                >
                  新建模板
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadTemplates}
                  loading={loading}
                >
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 模板列表 */}
        <Card>
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{
              total: templates.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            }}
          />
        </Card>

        {/* 编辑/新建模板模态框 */}
        <Modal
          title={editingTemplate ? '编辑模板' : '新建模板'}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false)
            setEditingTemplate(null)
            form.resetFields()
          }}
          footer={null}
          width={800}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{
              isActive: true,
              category: 'general',
              tags: []
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="模板名称"
                  rules={[
                    { required: true, message: '请输入模板名称' },
                    { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' }
                  ]}
                >
                  <Input placeholder="template_name" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="displayName"
                  label="显示名称"
                  rules={[{ required: true, message: '请输入显示名称' }]}
                >
                  <Input placeholder="模板显示名称" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="category"
                  label="分类"
                  rules={[{ required: true, message: '请选择分类' }]}
                >
                  <Select placeholder="选择模板分类">
                    {categoryOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="isActive"
                  label="启用状态"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="描述"
            >
              <TextArea placeholder="模板描述" rows={3} />
            </Form.Item>

            <Form.Item
              name="tags"
              label="标签"
            >
              <Select
                mode="tags"
                placeholder="添加标签"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="content"
              label="YAML内容"
              rules={[{ required: true, message: '请输入YAML内容' }]}
            >
              <CodeEditor
                language="yaml"
                placeholder="请输入K8s YAML配置..."
                style={{
                  fontSize: 12,
                  backgroundColor: '#f5f5f5',
                  fontFamily: 'ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",Menlo,monospace',
                  minHeight: '300px'
                }}
              />
            </Form.Item>

            <div className="flex justify-end space-x-2">
              <Button onClick={() => {
                setModalVisible(false)
                setEditingTemplate(null)
                form.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingTemplate ? '更新' : '创建'}
              </Button>
            </div>
          </Form>
        </Modal>

        {/* 查看模板模态框 */}
        <Modal
          title={`查看模板: ${viewingTemplate?.displayName}`}
          open={viewModalVisible}
          onCancel={() => {
            setViewModalVisible(false)
            setViewingTemplate(null)
          }}
          footer={[
            <Button key="close" onClick={() => {
              setViewModalVisible(false)
              setViewingTemplate(null)
            }}>
              关闭
            </Button>
          ]}
          width={800}
        >
          {viewingTemplate && (
            <div className="space-y-4">
              <div>
                <Text strong>模板名称：</Text>
                <Text>{viewingTemplate.name}</Text>
              </div>
              <div>
                <Text strong>分类：</Text>
                <Tag color="blue">
                  {categoryOptions.find(opt => opt.value === viewingTemplate.category)?.label || viewingTemplate.category}
                </Tag>
              </div>
              <div>
                <Text strong>描述：</Text>
                <Text>{viewingTemplate.description || '无'}</Text>
              </div>
              <div>
                <Text strong>标签：</Text>
                {viewingTemplate.tags.map((tag, index) => (
                  <Tag key={index}>{tag}</Tag>
                ))}
              </div>
              <div>
                <Text strong>YAML内容：</Text>
                <CodeEditor
                  value={viewingTemplate.content}
                  language="yaml"
                  readOnly
                  style={{
                    fontSize: 12,
                    backgroundColor: '#f5f5f5',
                    fontFamily: 'ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",Menlo,monospace',
                    minHeight: '300px'
                  }}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  )
}

export default DeploymentTemplatesPage
