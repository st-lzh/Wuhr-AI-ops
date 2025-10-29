'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Row,
  Col,
  Divider
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  StarOutlined,
  StarFilled,
  AppstoreOutlined,
  SettingOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const { Text, Title } = Typography

interface Dashboard {
  id: string
  name: string
  description?: string
  config: any
  isTemplate: boolean
  isDefault: boolean
  category?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface DashboardTemplate {
  name: string
  description: string
  category: string
  tags: string[]
  config: any
}

interface KibanaDashboardManagerProps {
  onDashboardSelect?: (dashboard: Dashboard) => void
  selectedDashboardId?: string
}

const KibanaDashboardManager: React.FC<KibanaDashboardManagerProps> = ({
  onDashboardSelect,
  selectedDashboardId
}) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [templates, setTemplates] = useState<DashboardTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const [createForm] = Form.useForm()
  const [templateForm] = Form.useForm()

  // 加载仪表板列表
  const loadDashboards = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/elk/dashboards')
      if (response.ok) {
        const data = await response.json()
        setDashboards(data.data || [])
      } else {
        message.error('加载仪表板失败')
      }
    } catch (error) {
      message.error('加载仪表板失败')
      console.error('加载仪表板失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/elk/dashboard-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.data || [])
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    }
  }

  // 创建仪表板
  const handleCreateDashboard = async (values: any) => {
    try {
      const response = await fetch('/api/elk/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          config: {
            layout: { panels: [], grid: { columns: 12, rows: 10 } },
            filters: [],
            timeRange: { from: 'now-1h', to: 'now' },
            refreshInterval: 30000
          }
        })
      })

      if (response.ok) {
        message.success('仪表板创建成功')
        setCreateModalVisible(false)
        createForm.resetFields()
        loadDashboards()
      } else {
        message.error('创建仪表板失败')
      }
    } catch (error) {
      message.error('创建仪表板失败')
      console.error('创建仪表板失败:', error)
    }
  }

  // 基于模板创建仪表板
  const handleCreateFromTemplate = async (values: any) => {
    try {
      const response = await fetch('/api/elk/dashboard-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })

      if (response.ok) {
        message.success('仪表板创建成功')
        setTemplateModalVisible(false)
        templateForm.resetFields()
        loadDashboards()
      } else {
        message.error('创建仪表板失败')
      }
    } catch (error) {
      message.error('创建仪表板失败')
      console.error('创建仪表板失败:', error)
    }
  }

  // 设置默认仪表板
  const handleSetDefault = async (dashboard: Dashboard) => {
    try {
      const response = await fetch('/api/elk/dashboards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dashboard.id,
          isDefault: true
        })
      })

      if (response.ok) {
        message.success('默认仪表板设置成功')
        loadDashboards()
      } else {
        message.error('设置默认仪表板失败')
      }
    } catch (error) {
      message.error('设置默认仪表板失败')
      console.error('设置默认仪表板失败:', error)
    }
  }

  // 删除仪表板
  const handleDeleteDashboard = async (dashboardId: string) => {
    try {
      const response = await fetch(`/api/elk/dashboards?id=${dashboardId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        message.success(result.message || '仪表板删除成功')
        loadDashboards()
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `删除失败 (${response.status})`
        message.error(errorMessage)
        console.error('删除仪表板失败:', errorData)
      }
    } catch (error) {
      message.error('删除仪表板失败：网络错误')
      console.error('删除仪表板失败:', error)
    }
  }

  // 复制仪表板
  const handleCopyDashboard = async (dashboard: Dashboard) => {
    try {
      const response = await fetch('/api/elk/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${dashboard.name} (副本)`,
          description: dashboard.description,
          config: dashboard.config,
          category: dashboard.category,
          tags: dashboard.tags
        })
      })

      if (response.ok) {
        message.success('仪表板复制成功')
        loadDashboards()
      } else {
        message.error('复制仪表板失败')
      }
    } catch (error) {
      message.error('复制仪表板失败')
      console.error('复制仪表板失败:', error)
    }
  }

  // 表格列配置
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Dashboard) => (
        <Space>
          <Text strong={record.isDefault}>{name}</Text>
          {record.isDefault && (
            <StarFilled style={{ color: '#faad14' }} />
          )}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => category ? (
        <Tag color="blue">{category}</Tag>
      ) : '-'
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (updatedAt: string) => dayjs(updatedAt).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Dashboard) => (
        <Space>
          <Tooltip title="选择仪表板">
            <Button
              size="small"
              type={selectedDashboardId === record.id ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              onClick={() => onDashboardSelect?.(record)}
            />
          </Tooltip>
          
          <Tooltip title="设为默认">
            <Button
              size="small"
              icon={record.isDefault ? <StarFilled /> : <StarOutlined />}
              onClick={() => handleSetDefault(record)}
              disabled={record.isDefault}
            />
          </Tooltip>
          
          <Tooltip title="复制">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyDashboard(record)}
            />
          </Tooltip>
          
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditingDashboard(record)}
            />
          </Tooltip>
          
          <Popconfirm
            title="确定删除这个仪表板吗？"
            onConfirm={() => handleDeleteDashboard(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={record.isDefault}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  useEffect(() => {
    loadDashboards()
    loadTemplates()
  }, [])

  // 过滤仪表板
  const filteredDashboards = selectedCategory === 'all' 
    ? dashboards 
    : dashboards.filter(d => d.category === selectedCategory)

  // 获取分类列表
  const categories = Array.from(new Set(dashboards.map(d => d.category).filter(Boolean)))

  return (
    <Card
      title={
        <Space>
          <AppstoreOutlined />
          <span>Kibana仪表板管理</span>
        </Space>
      }
      extra={
        <Space>
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="all">全部分类</Option>
            {categories.map(category => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
          
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setTemplateModalVisible(true)}
            size="small"
          >
            从模板创建
          </Button>
          
          <Button
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
            size="small"
          >
            新建仪表板
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredDashboards}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
      />

      {/* 创建仪表板模态框 */}
      <Modal
        title="创建新仪表板"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateDashboard}
        >
          <Form.Item
            name="name"
            label="仪表板名称"
            rules={[{ required: true, message: '请输入仪表板名称' }]}
          >
            <Input placeholder="输入仪表板名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="输入仪表板描述" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="分类"
              >
                <Select placeholder="选择分类">
                  <Option value="system">系统监控</Option>
                  <Option value="application">应用程序</Option>
                  <Option value="security">安全审计</Option>
                  <Option value="custom">自定义</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false)
                createForm.resetFields()
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 从模板创建模态框 */}
      <Modal
        title="从模板创建仪表板"
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false)
          templateForm.resetFields()
        }}
        footer={null}
        width={800}
      >
        <Form
          form={templateForm}
          layout="vertical"
          onFinish={handleCreateFromTemplate}
        >
          <Form.Item
            name="templateName"
            label="选择模板"
            rules={[{ required: true, message: '请选择模板' }]}
          >
            <Select placeholder="选择模板">
              {templates.map(template => (
                <Option key={template.name} value={template.name}>
                  <div>
                    <Text strong>{template.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {template.description}
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="customName"
            label="自定义名称"
          >
            <Input placeholder="留空使用模板默认名称" />
          </Form.Item>
          
          <Form.Item
            name="customDescription"
            label="自定义描述"
          >
            <TextArea rows={3} placeholder="留空使用模板默认描述" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => {
                setTemplateModalVisible(false)
                templateForm.resetFields()
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default KibanaDashboardManager
