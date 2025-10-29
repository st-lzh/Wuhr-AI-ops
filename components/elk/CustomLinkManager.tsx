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
  Switch,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Row,
  Col
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  ShareAltOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const { Text } = Typography

interface CustomLink {
  id: string
  name: string
  description?: string
  url: string
  icon?: string
  category?: string
  tags: string[]
  isPublic: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface CustomLinkManagerProps {
  onLinkSelect?: (link: CustomLink) => void
}

const CustomLinkManager: React.FC<CustomLinkManagerProps> = ({ onLinkSelect }) => {
  const [links, setLinks] = useState<CustomLink[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [includePublic, setIncludePublic] = useState(true)

  const [form] = Form.useForm()

  // 加载自定义链接列表
  const loadCustomLinks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (includePublic) params.append('includePublic', 'true')
      if (selectedCategory !== 'all') params.append('category', selectedCategory)

      const response = await fetch(`/api/elk/custom-links?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLinks(data.data || [])
      } else {
        message.error('加载自定义链接失败')
      }
    } catch (error) {
      message.error('加载自定义链接失败')
      console.error('加载自定义链接失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 创建或更新自定义链接
  const handleSaveLink = async (values: any) => {
    try {
      const url = editingLink ? '/api/elk/custom-links' : '/api/elk/custom-links'
      const method = editingLink ? 'PUT' : 'POST'
      const body = editingLink ? { id: editingLink.id, ...values } : values

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        message.success(editingLink ? '链接更新成功' : '链接创建成功')
        setModalVisible(false)
        setEditingLink(null)
        form.resetFields()
        loadCustomLinks()
      } else {
        const error = await response.json()
        message.error(error.error || '操作失败')
      }
    } catch (error) {
      message.error('操作失败')
      console.error('保存链接失败:', error)
    }
  }

  // 删除自定义链接
  const handleDeleteLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/elk/custom-links?id=${linkId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        message.success(result.message || '链接删除成功')
        loadCustomLinks()
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `删除失败 (${response.status})`
        message.error(errorMessage)
        console.error('删除链接失败:', errorData)
      }
    } catch (error) {
      message.error('删除链接失败：网络错误')
      console.error('删除链接失败:', error)
    }
  }

  // 打开编辑模态框
  const handleEditLink = (link: CustomLink) => {
    setEditingLink(link)
    form.setFieldsValue({
      name: link.name,
      description: link.description,
      url: link.url,
      icon: link.icon,
      category: link.category,
      tags: link.tags,
      isPublic: link.isPublic
    })
    setModalVisible(true)
  }

  // 打开链接
  const handleOpenLink = (link: CustomLink) => {
    window.open(link.url, '_blank')
    onLinkSelect?.(link)
  }

  // 表格列配置
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CustomLink) => (
        <Space>
          <Text strong>{name}</Text>
          {record.isPublic && (
            <Tooltip title="公开链接">
              <GlobalOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
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
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text code style={{ fontSize: '12px' }}>
            {url.length > 50 ? `${url.substring(0, 50)}...` : url}
          </Text>
        </Tooltip>
      )
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
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (updatedAt: string) => dayjs(updatedAt).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: CustomLink) => (
        <Space>
          <Tooltip title="打开链接">
            <Button
              size="small"
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => handleOpenLink(record)}
            />
          </Tooltip>
          
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditLink(record)}
            />
          </Tooltip>
          
          <Popconfirm
            title="确定删除这个链接吗？"
            onConfirm={() => handleDeleteLink(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  useEffect(() => {
    loadCustomLinks()
  }, [selectedCategory, includePublic])

  // 过滤链接
  const filteredLinks = selectedCategory === 'all' 
    ? links 
    : links.filter(link => link.category === selectedCategory)

  // 获取分类列表
  const categories = Array.from(new Set(links.map(link => link.category).filter(Boolean)))

  return (
    <Card
      title={
        <Space>
          <ShareAltOutlined />
          <span>自定义Kibana链接</span>
        </Space>
      }
      extra={
        <Space>
          <Switch
            checked={includePublic}
            onChange={setIncludePublic}
            checkedChildren="包含公开"
            unCheckedChildren="仅个人"
            size="small"
          />
          
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
            onClick={() => {
              setEditingLink(null)
              form.resetFields()
              setModalVisible(true)
            }}
            size="small"
          >
            新建链接
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredLinks}
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

      {/* 创建/编辑链接模态框 */}
      <Modal
        title={editingLink ? '编辑自定义链接' : '创建自定义链接'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingLink(null)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveLink}
        >
          <Form.Item
            name="name"
            label="链接名称"
            rules={[{ required: true, message: '请输入链接名称' }]}
          >
            <Input placeholder="输入链接名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="输入链接描述" />
          </Form.Item>
          
          <Form.Item
            name="url"
            label="Kibana URL"
            rules={[
              { required: true, message: '请输入Kibana URL' },
              { type: 'url', message: '请输入有效的URL' }
            ]}
          >
            <Input placeholder="https://your-kibana.com/app/discover" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="icon"
                label="图标"
              >
                <Select placeholder="选择图标">
                  <Option value="LinkOutlined">链接</Option>
                  <Option value="BarChartOutlined">图表</Option>
                  <Option value="DashboardOutlined">仪表板</Option>
                  <Option value="FileTextOutlined">文档</Option>
                  <Option value="SearchOutlined">搜索</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="category"
                label="分类"
              >
                <Select placeholder="选择分类">
                  <Option value="dashboard">仪表板</Option>
                  <Option value="discover">数据发现</Option>
                  <Option value="visualize">可视化</Option>
                  <Option value="custom">自定义</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="isPublic"
                label="公开链接"
                valuePropName="checked"
              >
                <Switch checkedChildren="公开" unCheckedChildren="私有" />
              </Form.Item>
            </Col>
          </Row>
          
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
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingLink ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false)
                setEditingLink(null)
                form.resetFields()
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

export default CustomLinkManager
