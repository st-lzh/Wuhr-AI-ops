'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Input,
  Space,
  Typography,
  Alert,
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Tag,
  Upload,
  Form,
  Select,
  Divider
} from 'antd'
import {
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { UploadProps } from 'antd'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'
import type { ColumnsType } from 'antd/es/table'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface DeploymentTemplate {
  id: string
  name: string
  description: string
  type: 'kubernetes' | 'docker' | 'shell' | 'ansible'
  content: string
  version: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  usageCount: number
}

const TemplatesPage: React.FC = () => {
  const { hasPermission } = usePermissions()
  
  // 状态管理
  const [templates, setTemplates] = useState<DeploymentTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DeploymentTemplate | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<DeploymentTemplate | null>(null)
  const [form] = Form.useForm()

  // 加载模板列表
  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cicd/templates')
      const data = await response.json()
      
      if (data.success) {
        setTemplates(data.data.templates || [])
      } else {
        message.error(data.error || '加载模板列表失败')
      }
    } catch (error) {
      console.error('加载模板列表失败:', error)
      message.error('加载模板列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 创建模板
  const handleCreate = async (values: any) => {
    try {
      const response = await fetch('/api/cicd/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success('模板创建成功')
        setCreateModalVisible(false)
        form.resetFields()
        loadTemplates()
      } else {
        message.error(data.error || '创建模板失败')
      }
    } catch (error) {
      console.error('创建模板失败:', error)
      message.error('创建模板失败')
    }
  }

  // 更新模板
  const handleUpdate = async (values: any) => {
    if (!editingTemplate) return
    
    try {
      const response = await fetch(`/api/cicd/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success('模板更新成功')
        setEditModalVisible(false)
        setEditingTemplate(null)
        form.resetFields()
        loadTemplates()
      } else {
        message.error(data.error || '更新模板失败')
      }
    } catch (error) {
      console.error('更新模板失败:', error)
      message.error('更新模板失败')
    }
  }

  // 删除模板
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/cicd/templates/${id}`, {
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

  // 文件上传处理
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.yaml,.yml,.json,.sh',
    beforeUpload: (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        form.setFieldsValue({ content })
      }
      reader.readAsText(file)
      return false // 阻止自动上传
    },
  }

  // 表格列定义
  const columns: ColumnsType<DeploymentTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
          {!record.isActive && <Badge status="default" text="禁用" />}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeMap = {
          kubernetes: { color: 'blue', text: 'Kubernetes' },
          docker: { color: 'cyan', text: 'Docker' },
          shell: { color: 'green', text: 'Shell' },
          ansible: { color: 'orange', text: 'Ansible' }
        }
        const config = typeMap[type as keyof typeof typeMap] || { color: 'default', text: type }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      render: (count) => <Badge count={count} showZero color="blue" />,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setViewingTemplate(record)
                setViewModalVisible(true)
              }}
            />
          </Tooltip>
          {hasPermission('cicd:write') && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingTemplate(record)
                    form.setFieldsValue(record)
                    setEditModalVisible(true)
                  }}
                />
              </Tooltip>
              <Tooltip title="复制">
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    const newTemplate = { ...record, name: `${record.name}_copy` }
                    form.setFieldsValue(newTemplate)
                    setCreateModalVisible(true)
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="确定要删除这个模板吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  // 初始化加载
  useEffect(() => {
    loadTemplates()
  }, [])

  return (
    <MainLayout>
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <FileTextOutlined className="mr-2" />
            模板管理
          </Title>
          <Paragraph className="text-gray-600 mb-0">
            管理部署模板，支持Kubernetes、Docker、Shell和Ansible等多种类型的部署模板
          </Paragraph>
        </div>

        {/* 操作栏 */}
        <Card className="mb-4">
          <Space>
            {hasPermission('cicd:write') && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields()
                  setCreateModalVisible(true)
                }}
              >
                创建模板
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={loadTemplates}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
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
              showTotal: (total) => `共 ${total} 个模板`,
            }}
          />
        </Card>

        {/* 创建模板模态框 */}
        <Modal
          title="创建部署模板"
          open={createModalVisible}
          onCancel={() => {
            setCreateModalVisible(false)
            form.resetFields()
          }}
          onOk={() => form.submit()}
          width={800}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreate}
          >
            <Form.Item
              name="name"
              label="模板名称"
              rules={[{ required: true, message: '请输入模板名称' }]}
            >
              <Input placeholder="请输入模板名称" />
            </Form.Item>

            <Form.Item
              name="type"
              label="模板类型"
              rules={[{ required: true, message: '请选择模板类型' }]}
            >
              <Select placeholder="请选择模板类型">
                <Option value="kubernetes">Kubernetes</Option>
                <Option value="docker">Docker</Option>
                <Option value="shell">Shell</Option>
                <Option value="ansible">Ansible</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="version"
              label="版本"
              rules={[{ required: true, message: '请输入版本号' }]}
            >
              <Input placeholder="例如: v1.0.0" />
            </Form.Item>

            <Form.Item
              name="description"
              label="描述"
            >
              <TextArea rows={3} placeholder="请输入模板描述" />
            </Form.Item>

            <Form.Item
              name="content"
              label="模板内容"
              rules={[{ required: true, message: '请输入模板内容' }]}
            >
              <TextArea
                rows={12}
                placeholder="请输入YAML/JSON/Shell脚本内容"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item label="上传文件">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
              <Text type="secondary" className="ml-2">
                支持 .yaml, .yml, .json, .sh 文件
              </Text>
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑模板模态框 */}
        <Modal
          title="编辑部署模板"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false)
            setEditingTemplate(null)
            form.resetFields()
          }}
          onOk={() => form.submit()}
          width={800}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleUpdate}
          >
            <Form.Item
              name="name"
              label="模板名称"
              rules={[{ required: true, message: '请输入模板名称' }]}
            >
              <Input placeholder="请输入模板名称" />
            </Form.Item>

            <Form.Item
              name="type"
              label="模板类型"
              rules={[{ required: true, message: '请选择模板类型' }]}
            >
              <Select placeholder="请选择模板类型">
                <Option value="kubernetes">Kubernetes</Option>
                <Option value="docker">Docker</Option>
                <Option value="shell">Shell</Option>
                <Option value="ansible">Ansible</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="version"
              label="版本"
              rules={[{ required: true, message: '请输入版本号' }]}
            >
              <Input placeholder="例如: v1.0.0" />
            </Form.Item>

            <Form.Item
              name="description"
              label="描述"
            >
              <TextArea rows={3} placeholder="请输入模板描述" />
            </Form.Item>

            <Form.Item
              name="content"
              label="模板内容"
              rules={[{ required: true, message: '请输入模板内容' }]}
            >
              <TextArea
                rows={12}
                placeholder="请输入YAML/JSON/Shell脚本内容"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item label="上传文件">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
              <Text type="secondary" className="ml-2">
                支持 .yaml, .yml, .json, .sh 文件
              </Text>
            </Form.Item>

            <Form.Item
              name="isActive"
              label="状态"
              valuePropName="checked"
            >
              <Select>
                <Option value={true}>启用</Option>
                <Option value={false}>禁用</Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* 查看模板模态框 */}
        <Modal
          title={`查看模板: ${viewingTemplate?.name}`}
          open={viewModalVisible}
          onCancel={() => {
            setViewModalVisible(false)
            setViewingTemplate(null)
          }}
          footer={[
            <Button key="close" onClick={() => setViewModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
        >
          {viewingTemplate && (
            <div>
              <Divider orientation="left">基本信息</Divider>
              <div className="mb-4">
                <p><strong>名称:</strong> {viewingTemplate.name}</p>
                <p><strong>类型:</strong> {viewingTemplate.type}</p>
                <p><strong>版本:</strong> {viewingTemplate.version}</p>
                <p><strong>描述:</strong> {viewingTemplate.description}</p>
                <p><strong>使用次数:</strong> {viewingTemplate.usageCount}</p>
                <p><strong>状态:</strong> {viewingTemplate.isActive ? '启用' : '禁用'}</p>
              </div>

              <Divider orientation="left">模板内容</Divider>
              <TextArea
                value={viewingTemplate.content}
                rows={15}
                readOnly
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  )
}

export default TemplatesPage
