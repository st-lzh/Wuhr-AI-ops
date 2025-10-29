'use client'

import React, { useState, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  message,
  Spin,
  Empty,
  Popconfirm,
  Badge,
  Tooltip
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined
} from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Option } = Select

// 用户数据类型
interface UserData {
  id: string
  username: string
  email: string
  role: 'admin' | 'manager' | 'developer' | 'viewer'
  permissions: string[]
  isActive: boolean
  realName?: string
  phone?: string
  department?: string
  avatar?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

// 统计数据类型
interface UserStats {
  total: number
  active: number
  admins: number
  newThisMonth: number
}

const UsersManagementPage: React.FC = () => {
  const { user: currentUser, isAdmin } = useAuth()

  // 状态管理
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    admins: 0,
    newThisMonth: 0
  })

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })

  // 模态框状态
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)

  // 表单实例
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()

  // 权限检查
  useEffect(() => {
    if (currentUser && !isAdmin) {
      message.error('权限不足，只有管理员可以访问用户管理')
      window.location.href = '/'
    }
  }, [currentUser, isAdmin])

  // 角色选项
  const roleOptions = [
    { value: 'admin', label: '管理员', color: 'red' },
    { value: 'manager', label: '经理', color: 'orange' },
    { value: 'developer', label: '开发者', color: 'blue' },
    { value: 'viewer', label: '查看者', color: 'green' }
  ]

  // 获取角色颜色
  const getRoleColor = (role: string) => {
    return roleOptions.find(r => r.value === role)?.color || 'default'
  }

  // 获取角色标签
  const getRoleLabel = (role: string) => {
    return roleOptions.find(r => r.value === role)?.label || role
  }

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        pageSize: pagination.pageSize.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/users?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('获取用户列表失败')
      }

      const result = await response.json()

      if (result.success) {
        setUsers(result.data.users)
        setPagination(prev => ({
          ...prev,
          total: result.data.total
        }))

        // 计算统计数据
        calculateStats(result.data.users, result.data.total)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 计算统计数据
  const calculateStats = (userList: UserData[], total: number) => {
    const active = userList.filter(u => u.isActive).length
    const admins = userList.filter(u => u.role === 'admin').length
    const oneMonthAgo = dayjs().subtract(1, 'month')
    const newThisMonth = userList.filter(u =>
      dayjs(u.createdAt).isAfter(oneMonthAgo)
    ).length

    setStats({
      total,
      active,
      admins,
      newThisMonth
    })
  }

  // 页面加载时获取数据
  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
    }
  }, [pagination.current, pagination.pageSize, searchQuery, roleFilter, statusFilter, isAdmin])

  // 创建用户
  const handleCreateUser = async (values: any) => {
    console.log('🔥🔥🔥 handleCreateUser 被调用了! 版本:3.0', values)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      })

      console.log('📡 API响应状态:', response.status)
      const result = await response.json()
      console.log('📡 API响应数据:', result)

      if (result.success) {
        message.success('用户创建成功')
        setAddModalVisible(false)
        addForm.resetFields()
        fetchUsers()
      } else {
        message.error(result.message || result.error || '创建用户失败')
      }
    } catch (error) {
      console.error('创建用户失败:', error)
      message.error('创建用户失败')
    }
  }

  // 更新用户
  const handleUpdateUser = async (values: any) => {
    if (!editingUser) return

    try {
      // 如果密码为空，则不传递密码字段
      const updateData = { ...values, id: editingUser.id }
      if (!updateData.password) {
        delete updateData.password
      }
      if (!updateData.confirmPassword) {
        delete updateData.confirmPassword
      }

      const response = await fetch('/api/users', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()

      if (result.success) {
        message.success('用户更新成功')
        setEditModalVisible(false)
        setEditingUser(null)
        editForm.resetFields()
        fetchUsers()
      } else {
        message.error(result.error || '更新用户失败')
      }
    } catch (error) {
      console.error('更新用户失败:', error)
      message.error('更新用户失败')
    }
  }

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        message.success('用户已停用')
        fetchUsers()
      } else {
        message.error(result.error || '停用用户失败')
      }
    } catch (error) {
      console.error('停用用户失败:', error)
      message.error('停用用户失败')
    }
  }

  // 打开编辑模态框
  const handleEdit = (user: UserData) => {
    setEditingUser(user)
    editForm.setFieldsValue({
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      realName: user.realName,
      phone: user.phone,
      department: user.department,
      isActive: user.isActive
    })
    setEditModalVisible(true)
  }

  // 表格列定义
  const columns: ColumnsType<UserData> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      fixed: 'left',
      width: 150,
      render: (text: string, record: UserData) => (
        <Space>
          <UserOutlined />
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.id === currentUser?.id && (
            <Tag color="blue">当前用户</Tag>
          )}
        </Space>
      )
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (text: string) => (
        <Space>
          <MailOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>
          {getRoleLabel(role)}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'error'}
          text={isActive ? '活跃' : '停用'}
        />
      )
    },
    {
      title: '真实姓名',
      dataIndex: 'realName',
      key: 'realName',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => (
        <Tooltip title={dayjs(text).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(text).fromNow()}
        </Tooltip>
      )
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 180,
      render: (text: string) => text ? (
        <Tooltip title={dayjs(text).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(text).fromNow()}
        </Tooltip>
      ) : '-'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_: any, record: UserData) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.id === currentUser?.id && record.role !== currentUser?.role}
            >
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要停用此用户吗？"
            description="停用后该用户将无法登录系统"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
            disabled={record.id === currentUser?.id}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.id === currentUser?.id || !record.isActive}
            >
              停用
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 密码强度验证规则
  const passwordValidator = (_: any, value: string) => {
    if (!value) {
      return Promise.resolve()
    }

    const errors: string[] = []
    if (value.length < 8) errors.push('至少8位')
    if (!/[a-z]/.test(value)) errors.push('包含小写字母')
    if (!/[A-Z]/.test(value)) errors.push('包含大写字母')
    if (!/\d/.test(value)) errors.push('包含数字')

    if (errors.length > 0) {
      return Promise.reject(new Error(`密码必须${errors.join('、')}`))
    }
    return Promise.resolve()
  }

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总用户数"
                value={stats.total}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="活跃用户"
                value={stats.active}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="管理员"
                value={stats.admins}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="本月新增"
                value={stats.newThisMonth}
                prefix={<PlusOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 主内容卡片 */}
        <Card>
          {/* 搜索和筛选栏 */}
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              placeholder="搜索用户名、邮箱、真实姓名"
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 120 }}
              placeholder="角色"
            >
              <Option value="all">全部角色</Option>
              {roleOptions.map(role => (
                <Option key={role.value} value={role.value}>
                  {role.label}
                </Option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              placeholder="状态"
            >
              <Option value="all">全部状态</Option>
              <Option value="active">活跃</Option>
              <Option value="inactive">停用</Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              添加用户
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchUsers}
            >
              刷新
            </Button>
          </Space>

          {/* 用户列表表格 */}
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({
                  ...prev,
                  current: page,
                  pageSize: pageSize || 10
                }))
              }
            }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无用户数据"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </Card>

        {/* 添加用户模态框 */}
        <Modal
          title="添加用户"
          open={addModalVisible}
          onCancel={() => {
            setAddModalVisible(false)
            addForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={addForm}
            layout="vertical"
            onFinish={handleCreateUser}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, max: 50, message: '用户名长度必须在3-50个字符之间' },
                { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和横线' }
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { validator: passwordValidator }
              ]}
              extra="密码必须至少8位，包含大小写字母和数字"
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  }
                })
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
            </Form.Item>

            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
              initialValue="viewer"
            >
              <Select placeholder="请选择角色">
                {roleOptions.map(role => (
                  <Option key={role.value} value={role.value}>
                    <Tag color={role.color}>{role.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="realName" label="真实姓名">
              <Input prefix={<IdcardOutlined />} placeholder="请输入真实姓名" />
            </Form.Item>

            <Form.Item name="phone" label="手机号">
              <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
            </Form.Item>

            <Form.Item name="department" label="部门">
              <Input placeholder="请输入部门" />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => {
                  setAddModalVisible(false)
                  addForm.resetFields()
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  创建
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑用户模态框 */}
        <Modal
          title="编辑用户"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false)
            setEditingUser(null)
            editForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleUpdateUser}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, max: 50, message: '用户名长度必须在3-50个字符之间' }
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
            </Form.Item>

            <Form.Item
              name="password"
              label="新密码"
              rules={[{ validator: passwordValidator }]}
              extra="留空则不修改密码。如需修改，密码必须至少8位，包含大小写字母和数字"
            >
              <Input.Password prefix={<LockOutlined />} placeholder="留空则不修改" />
            </Form.Item>

            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select
                placeholder="请选择角色"
                disabled={editingUser?.id === currentUser?.id}
              >
                {roleOptions.map(role => (
                  <Option key={role.value} value={role.value}>
                    <Tag color={role.color}>{role.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="realName" label="真实姓名">
              <Input prefix={<IdcardOutlined />} placeholder="请输入真实姓名" />
            </Form.Item>

            <Form.Item name="phone" label="手机号">
              <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
            </Form.Item>

            <Form.Item name="department" label="部门">
              <Input placeholder="请输入部门" />
            </Form.Item>

            <Form.Item name="isActive" label="状态" valuePropName="checked">
              <Select>
                <Option value={true}>活跃</Option>
                <Option value={false}>停用</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => {
                  setEditModalVisible(false)
                  setEditingUser(null)
                  editForm.resetFields()
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  保存
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  )
}

export default UsersManagementPage
