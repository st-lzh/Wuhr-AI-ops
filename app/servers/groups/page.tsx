'use client'

import React, { useState, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  ColorPicker, 
  Tag, 
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Typography
} from 'antd'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  DatabaseOutlined,
  TeamOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons'
import { ServerGroupInfo } from '@/app/types/server'
import { useAuth } from '@/app/hooks/useAuth'
import { PermissionGuard, PermissionButton } from '../../components/auth/PermissionGuard'

const { Title, Text } = Typography
const { TextArea } = Input

interface ServerGroupFormData {
  name: string
  description?: string
  color?: string
  icon?: string
  tags?: string[]
}

const iconOptions = [
  { label: '服务器', value: 'server' },
  { label: '团队', value: 'team' },
  { label: '数据库', value: 'database' },
  { label: '云', value: 'cloud' },
  { label: '网络', value: 'network' },
  { label: '安全', value: 'security' },
  { label: '监控', value: 'monitor' },
  { label: '开发', value: 'code' }
]

export default function ServerGroupsPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<ServerGroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ServerGroupInfo | null>(null)
  const [form] = Form.useForm()
  
  // 组内主机管理相关状态
  const [groupServersModalVisible, setGroupServersModalVisible] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<ServerGroupInfo | null>(null)
  const [groupServers, setGroupServers] = useState<any[]>([])
  const [groupServersLoading, setGroupServersLoading] = useState(false)
  const [availableServers, setAvailableServers] = useState<any[]>([])
  const [addServerModalVisible, setAddServerModalVisible] = useState(false)

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/servers/groups')
      const result = await response.json()
      
      if (result.success) {
        setGroups(result.data)
      } else {
        message.error(result.error || '获取主机组列表失败')
      }
    } catch (error) {
      console.error('获取主机组列表失败:', error)
      message.error('获取主机组列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values: ServerGroupFormData) => {
    try {
      const url = editingGroup ? `/api/servers/groups/${editingGroup.id}` : '/api/servers/groups'
      const method = editingGroup ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success(editingGroup ? '主机组更新成功' : '主机组创建成功')
        setModalVisible(false)
        setEditingGroup(null)
        form.resetFields()
        fetchGroups()
      } else {
        message.error(result.error || '操作失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      message.error('操作失败')
    }
  }

  const handleDelete = async (groupId: string) => {
    try {
      const response = await fetch(`/api/servers/groups/${groupId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success('主机组删除成功')
        fetchGroups()
      } else {
        message.error(result.error || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      message.error('删除失败')
    }
  }

  const handleEdit = (group: ServerGroupInfo) => {
    setEditingGroup(group)
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      color: group.color,
      icon: group.icon,
      tags: group.tags
    })
    setModalVisible(true)
  }

  // 设置默认主机组
  const handleSetDefault = async (groupId: string) => {
    try {
      const response = await fetch('/api/servers/groups/set-default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupId })
      })

      const result = await response.json()
      if (result.success) {
        message.success(result.message || '默认主机组设置成功')
        fetchGroups() // 重新获取数据以显示最新状态
      } else {
        message.error(result.error || '设置默认主机组失败')
      }
    } catch (error) {
      console.error('设置默认主机组失败:', error)
      message.error('设置默认主机组失败')
    }
  }

  const handleAdd = () => {
    setEditingGroup(null)
    form.resetFields()
    form.setFieldsValue({
      color: '#1890ff',
      icon: 'server'
    })
    setModalVisible(true)
  }

  // 查看组内主机
  const handleViewGroupServers = async (group: ServerGroupInfo) => {
    setSelectedGroup(group)
    setGroupServersModalVisible(true)
    await fetchGroupServers(group.id)
  }

  // 获取组内主机列表
  const fetchGroupServers = async (groupId: string) => {
    try {
      setGroupServersLoading(true)
      const response = await fetch(`/api/servers/groups/${groupId}`)
      const result = await response.json()
      
      if (result.success) {
        setGroupServers(result.data.servers || [])
      } else {
        message.error('获取组内主机失败')
      }
    } catch (error) {
      console.error('获取组内主机失败:', error)
      message.error('获取组内主机失败')
    } finally {
      setGroupServersLoading(false)
    }
  }

  // 获取可用的主机列表（未分组的主机）
  const fetchAvailableServers = async () => {
    try {
      const response = await fetch('/api/servers?ungrouped=true')
      const result = await response.json()
      
      if (result.success) {
        setAvailableServers(result.data.servers || [])
      }
    } catch (error) {
      console.error('获取可用主机失败:', error)
    }
  }

  // 将主机添加到组
  const handleAddServerToGroup = async (serverId: string) => {
    if (!selectedGroup) return
    
    try {
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroup.id })
      })
      
      const result = await response.json()
      if (result.success) {
        message.success('主机添加到组成功')
        await fetchGroupServers(selectedGroup.id)
        await fetchAvailableServers()
        fetchGroups() // 刷新组列表
      } else {
        message.error(result.error || '添加失败')
      }
    } catch (error) {
      console.error('添加主机到组失败:', error)
      message.error('添加失败')
    }
  }

  // 从组中移除主机
  const handleRemoveServerFromGroup = async (serverId: string) => {
    try {
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: null })
      })
      
      const result = await response.json()
      if (result.success) {
        message.success('主机已从组中移除')
        if (selectedGroup) {
          await fetchGroupServers(selectedGroup.id)
        }
        fetchGroups() // 刷新组列表
      } else {
        message.error(result.error || '移除失败')
      }
    } catch (error) {
      console.error('从组中移除主机失败:', error)
      message.error('移除失败')
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const columns = [
    {
      title: '主机组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ServerGroupInfo) => (
        <div className="flex items-center space-x-2">
          <Badge 
            color={record.color || '#1890ff'} 
            style={{ marginRight: 8 }}
          />
          <Text strong>{text}</Text>
          {record.isDefault && (
            <Tag color="gold" className="text-xs">默认</Tag>
          )}
          <Tooltip title={record.isDefault ? "默认主机组" : "设为默认主机组"}>
            <Button
              type="text"
              size="small"
              icon={record.isDefault ? <StarFilled /> : <StarOutlined />}
              onClick={() => handleSetDefault(record.id)}
              className={`${
                record.isDefault 
                  ? "text-yellow-500 hover:text-yellow-600" 
                  : "text-gray-400 hover:text-yellow-500"
              } p-0 h-auto min-w-0`}
              style={{ border: 'none', boxShadow: 'none' }}
            />
          </Tooltip>
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-'
    },
    {
      title: '主机数量',
      dataIndex: 'serverCount',
      key: 'serverCount',
      render: (count: number) => (
        <Badge count={count} showZero color="blue" />
      )
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags?.map(tag => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ServerGroupInfo) => (
        <Space>
          <Tooltip title="查看组内主机">
            <Button 
              type="link" 
              icon={<DatabaseOutlined />}
              onClick={() => handleViewGroupServers(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除主机组 "${record.name}" 吗？${(record.serverCount ?? 0) > 0 ? '注意：组内还有主机，删除后主机将变为未分组状态。' : ''}`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="link" 
                danger 
                icon={<DeleteOutlined />}
                disabled={(record.serverCount ?? 0) > 0}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <MainLayout>
      <PermissionGuard module="servers" action="read">
        <div className="p-6 space-y-6">
          {/* 页面标题和操作 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                <TeamOutlined className="mr-2" />
                主机组管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                管理服务器分组，便于批量操作和权限管理
              </p>
            </div>
            <PermissionButton
              type="default"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              module="servers"
              action="write"
              hideWhenNoPermission
              className="border-blue-500 text-blue-500 hover:border-blue-400 hover:text-blue-400 bg-transparent"
            >
              新建主机组
            </PermissionButton>
          </div>

          <Card>
            <Table
              columns={columns}
              dataSource={groups}
              rowKey="id"
              loading={loading}
              pagination={{
                total: groups.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 个主机组`
              }}
            />
          </Card>

      <Modal
        title={editingGroup ? '编辑主机组' : '新建主机组'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingGroup(null)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            color: '#1890ff',
            icon: 'server'
          }}
        >
          <Form.Item
            name="name"
            label="主机组名称"
            rules={[
              { required: true, message: '请输入主机组名称' },
              { max: 100, message: '名称不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入主机组名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea 
              placeholder="请输入主机组描述" 
              rows={3}
              maxLength={500}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="color"
              label="颜色标识"
            >
              <ColorPicker 
                format="hex"
                showText
                presets={[
                  { label: '蓝色', colors: ['#1890ff', '#096dd9', '#0050b3'] },
                  { label: '绿色', colors: ['#52c41a', '#389e0d', '#237804'] },
                  { label: '橙色', colors: ['#fa8c16', '#d46b08', '#ad4e00'] },
                  { label: '红色', colors: ['#f5222d', '#cf1322', '#a8071a'] },
                  { label: '紫色', colors: ['#722ed1', '#531dab', '#391085'] }
                ]}
              />
            </Form.Item>

            <Form.Item
              name="icon"
              label="图标"
            >
              <Select placeholder="选择图标">
                {iconOptions.map(option => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="输入标签，按回车添加"
              tokenSeparators={[',']}
            />
          </Form.Item>

          <Form.Item className="mb-0 mt-6">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setModalVisible(false)
                setEditingGroup(null)
                form.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingGroup ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 组内主机管理模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <TeamOutlined className="mr-2" />
            {selectedGroup?.name} - 组内主机管理
          </div>
        }
        open={groupServersModalVisible}
        onCancel={() => {
          setGroupServersModalVisible(false)
          setSelectedGroup(null)
          setGroupServers([])
        }}
        width={1000}
        footer={null}
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-gray-600">
              当前组内共有 {groupServers.length} 台主机
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setAddServerModalVisible(true)
                fetchAvailableServers()
              }}
            >
              添加主机到组
            </Button>
          </div>
          
          <Table
            loading={groupServersLoading}
            dataSource={groupServers}
            rowKey="id"
            pagination={false}
            scroll={{ y: 400 }}
            columns={[
              {
                title: '主机名称',
                dataIndex: 'name',
                key: 'name'
              },
              {
                title: 'IP地址',
                dataIndex: 'ip',
                key: 'ip'
              },
              {
                title: '系统',
                dataIndex: 'os',
                key: 'os'
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Badge 
                    status={status === 'online' ? 'success' : 'error'} 
                    text={status === 'online' ? '在线' : '离线'} 
                  />
                )
              },
              {
                title: '操作',
                key: 'action',
                render: (_: any, record: any) => (
                  <Popconfirm
                    title="确认移除"
                    description="确定要将此主机从组中移除吗？"
                    onConfirm={() => handleRemoveServerFromGroup(record.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button 
                      type="link" 
                      danger 
                      icon={<DeleteOutlined />}
                    >
                      移除
                    </Button>
                  </Popconfirm>
                )
              }
            ]}
          />
        </div>
      </Modal>

      {/* 添加主机到组的模态框 */}
      <Modal
        title="添加主机到组"
        open={addServerModalVisible}
        onCancel={() => setAddServerModalVisible(false)}
        footer={null}
        width={600}
      >
        <div className="space-y-4">
          <div className="text-gray-600">
            选择要添加到 "{selectedGroup?.name}" 组的主机：
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {availableServers.map(server => (
                <Card key={server.id} size="small" className="hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{server.name}</div>
                      <div className="text-sm text-gray-500">
                        {server.ip} - {server.os}
                      </div>
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleAddServerToGroup(server.id)}
                    >
                      添加
                    </Button>
                  </div>
                </Card>
              ))}
              {availableServers.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  暂无可添加的主机
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
        </div>
      </PermissionGuard>
    </MainLayout>
  )
}