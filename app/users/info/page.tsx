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
  message, 
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Switch,
  Avatar,
  Tooltip,
  Badge
} from 'antd'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { PermissionGuard, PermissionButton } from '../../components/auth/PermissionGuard'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Text } = Typography
const { Option } = Select

// 用户数据类型
interface User {
  id: string
  username: string
  email: string
  fullName?: string
  phone?: string
  role: string
  permissions: string[]
  isActive: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  rejectedReason?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  avatar?: string
  department?: string
  permissionGroups?: any[]
}



export default function UserInfoPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()
  const [permissionGroups, setPermissionGroups] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true)
      console.log('🔍 开始获取用户列表...')
      const response = await fetch('/api/users', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('📡 用户列表API响应状态:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ 获取用户列表失败:', response.status, errorText)
        throw new Error(`获取用户列表失败: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ 用户列表数据:', result)
      setUsers(result.data.users || [])
    } catch (error) {
      console.error('❌ 获取用户列表异常:', error)
      message.error('获取用户列表失败，请刷新页面重试')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  // 获取权限组列表
  const fetchPermissionGroups = async () => {
    try {
      const response = await fetch('/api/permission-groups', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) {
        throw new Error('获取权限组列表失败')
      }
      const result = await response.json()
      setPermissionGroups(result.data || [])
    } catch (error) {
      console.error('获取权限组列表失败:', error)
      message.error('获取权限组列表失败')
    }
  }

  // 获取权限列表
  const fetchPermissions = async () => {
    try {
      console.log('🔍 开始获取权限列表...')
      const response = await fetch('/api/permissions', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('📡 权限列表API响应状态:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error('获取权限列表失败')
      }
      const result = await response.json()
      console.log('✅ 权限列表数据:', result)

      let permissionsList = result.data?.permissions || []

      // 如果数据库为空，使用系统定义的权限列表
      if (permissionsList.length === 0) {
        console.log('📋 数据库权限为空，使用系统定义的权限列表')
        // 导入系统权限
        const { SYSTEM_PERMISSIONS } = await import('../../../lib/auth/permissions')
        permissionsList = SYSTEM_PERMISSIONS
      }

      setPermissions(permissionsList)
    } catch (error) {
      console.error('❌ 获取权限列表失败:', error)
      // 失败时也尝试使用系统定义的权限
      try {
        const { SYSTEM_PERMISSIONS } = await import('../../../lib/auth/permissions')
        setPermissions(SYSTEM_PERMISSIONS)
        console.log('📋 使用备用系统权限列表')
      } catch (e) {
        console.error('❌ 加载备用权限失败:', e)
      }
    }
  }

  // 页面加载时获取用户数据
  useEffect(() => {
    fetchUsers()
    fetchPermissionGroups()
    fetchPermissions()
  }, [])

  // 获取状态统计
  const getStatusStats = () => {
    const stats = {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      pending: users.filter(u => u.approvalStatus === 'pending').length,
      suspended: users.filter(u => !u.isActive && u.approvalStatus === 'approved').length,
      approved: users.filter(u => u.approvalStatus === 'approved').length
    }
    return stats
  }

  const stats = getStatusStats()

  // 状态渲染
  const renderStatus = (user: User) => {
    if (user.isActive) {
      return (
        <Tag color="green" icon={<CheckCircleOutlined />}>
          正常
        </Tag>
      )
    } else if (user.approvalStatus === 'pending') {
      return (
        <Tag color="orange" icon={<ExclamationCircleOutlined />}>
          待审批
        </Tag>
      )
    } else if (user.approvalStatus === 'rejected') {
      return (
        <Tag color="red" icon={<CloseCircleOutlined />}>
          已拒绝
        </Tag>
      )
    } else {
      return (
        <Tag color="gray" icon={<ExclamationCircleOutlined />}>
          已暂停
        </Tag>
      )
    }
  }

  // 审批状态渲染
  const renderApprovalStatus = (approvalStatus: string) => {
    const statusConfig = {
      approved: { color: 'green', text: '已审批', icon: <CheckCircleOutlined /> },
      pending: { color: 'orange', text: '待审批', icon: <ExclamationCircleOutlined /> },
      rejected: { color: 'red', text: '已拒绝', icon: <CloseCircleOutlined /> }
    }
    const config = statusConfig[approvalStatus as keyof typeof statusConfig] || statusConfig.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // 格式化时间
  const formatTime = (timeString?: string) => {
    if (!timeString) return '-'
    return new Date(timeString).toLocaleString('zh-CN')
  }

  // 用户表格列定义
  const columns = [
    {
      title: '用户信息',
      key: 'userInfo',
      width: 200,
      render: (_: any, record: User) => (
        <div className="flex items-center space-x-3">
          <Avatar 
            size={40} 
            icon={<UserOutlined />} 
            src={record.avatar}
            style={{ backgroundColor: '#1890ff' }}
          >
            {record.fullName?.charAt(0) || record.username.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div className="font-medium">{record.fullName || record.username}</div>
            <div className="text-sm text-gray-500">@{record.username}</div>
          </div>
        </div>
      )
    },
    {
      title: '联系信息',
      key: 'contact',
      width: 200,
      render: (_: any, record: User) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <MailOutlined className="text-gray-400" />
            <span className="text-sm">{record.email}</span>
          </div>
          {record.phone && (
            <div className="flex items-center space-x-1">
              <PhoneOutlined className="text-gray-400" />
              <span className="text-sm">{record.phone}</span>
            </div>
          )}
        </div>
      )
    },
    {
      title: '角色/权限组',
      key: 'roleInfo',
      width: 180,
      render: (_: any, record: User) => (
        <div className="space-y-1">
          <Tag color="purple">{record.role}</Tag>
          {record.permissionGroups && record.permissionGroups.length > 0 ? (
            <div className="space-y-1">
              {record.permissionGroups.map((group: any) => (
                <Tag key={group.id} color="blue" className="text-xs">
                  {group.name}
                </Tag>
              ))}
            </div>
          ) : record.department ? (
            <div className="text-sm text-gray-500">{record.department}</div>
          ) : (
            <div className="text-sm text-gray-400">未分配权限组</div>
          )}
        </div>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: User) => (
        <div className="space-y-1">
          {renderStatus(record)}
          {renderApprovalStatus(record.approvalStatus)}
        </div>
      )
    },
    {
      title: '权限数量',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 100,
      render: (permissions: string[]) => (
        <Badge count={permissions.length} showZero color="#1890ff" />
      )
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 150,
      render: (time: string) => (
        <div className="text-sm">
          {time ? (
            <Tooltip title={formatTime(time)}>
              <span>{formatTime(time)}</span>
            </Tooltip>
          ) : (
            <span className="text-gray-400">从未登录</span>
          )}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: User) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button 
              type="link" 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="编辑用户">
            <Button 
              type="link" 
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? '暂停用户' : '激活用户'}>
            <Button
              type="link"
              size="small"
              icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          {record.approvalStatus === 'pending' && (
            <Tooltip title="审批用户">
              <Button
                type="link"
                size="small"
                style={{ color: '#52c41a' }}
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              />
            </Tooltip>
          )}
          {/* 超级管理员不显示删除按钮 */}
          {record.email !== 'admin@wuhr.ai' && record.username !== 'admin' && (
            <Popconfirm
              title="确定要删除这个用户吗？"
              description="删除后将无法恢复，请谨慎操作"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除用户">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  // 处理查看用户详情
  const handleView = (user: User) => {
    Modal.info({
      title: '用户详细信息',
      width: 600,
      content: (
        <div className="space-y-4 mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">用户名：</strong>{user.username}</div>
            </Col>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">姓名：</strong>{user.fullName || '-'}</div>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">邮箱：</strong>{user.email}</div>
            </Col>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">电话：</strong>{user.phone || '-'}</div>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">角色：</strong>{user.role}</div>
            </Col>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">部门：</strong>{user.department || '-'}</div>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">状态：</strong>{renderStatus(user)}</div>
            </Col>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">审批状态：</strong>{renderApprovalStatus(user.approvalStatus)}</div>
            </Col>
          </Row>
          <div className="text-gray-800 dark:text-gray-200">
            <strong className="text-gray-900 dark:text-gray-100">权限列表：</strong>
            <div className="mt-2">
              <Space wrap>
                {user.permissions.map(permission => (
                  <Tag key={permission} color="blue">{permission}</Tag>
                ))}
              </Space>
            </div>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">创建时间：</strong>{formatTime(user.createdAt)}</div>
            </Col>
            <Col span={12}>
              <div className="text-gray-800 dark:text-gray-200"><strong className="text-gray-900 dark:text-gray-100">最后登录：</strong>{formatTime(user.lastLoginAt)}</div>
            </Col>
          </Row>
        </div>
      )
    })
  }

  // 处理编辑用户
  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      ...user,
      isActive: user.isActive,
      approvalStatus: user.approvalStatus,
      permissionGroups: user.permissionGroups?.map(g => g.id) || []
    })
    setIsModalVisible(true)
  }

  // 处理切换用户状态
  const handleToggleStatus = async (user: User) => {
    try {
      setLoading(true)

      // 调用API更新用户状态（使用PUT方法）
      const response = await fetch('/api/users', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          isActive: !user.isActive
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '操作失败' }))
        throw new Error(errorData.error || '操作失败')
      }

      const result = await response.json()

      message.success(result.message || '操作成功')
      fetchUsers() // 重新加载用户列表
    } catch (error) {
      console.error('切换用户状态失败:', error)
      message.error(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理审批用户
  const handleApprove = async (user: User) => {
    try {
      setLoading(true)

      // 调用API审批用户（使用PUT方法更新approvalStatus）
      const response = await fetch('/api/users', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          approvalStatus: 'approved',
          isActive: true
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '审批失败' }))
        throw new Error(errorData.error || '审批失败')
      }

      const result = await response.json()

      message.success(result.message || '审批成功')
      fetchUsers() // 重新加载用户列表
    } catch (error) {
      console.error('审批用户失败:', error)
      message.error(error instanceof Error ? error.message : '审批失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理删除用户
  const handleDelete = async (id: string) => {
    try {
      setLoading(true)

      // 调用API删除用户
      const response = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '删除失败' }))
        throw new Error(errorData.error || '删除失败')
      }

      const result = await response.json()

      message.success(result.message || '用户已删除')
      fetchUsers() // 重新加载用户列表
    } catch (error) {
      console.error('删除用户失败:', error)
      message.error(error instanceof Error ? error.message : '删除失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理添加新用户
  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    // 设置默认值：激活状态为true
    form.setFieldsValue({
      isActive: true,
      approvalStatus: 'approved'
    })
    setIsModalVisible(true)
  }

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)

      if (editingUser) {
        // 编辑用户 - 调用API更新用户信息
        const updateData: any = { ...values }

        // 如果没有填写新密码,删除password和confirmPassword字段
        if (!updateData.password) {
          delete updateData.password
          delete updateData.confirmPassword
        } else {
          // 有新密码时,删除confirmPassword(不需要发送到后端)
          delete updateData.confirmPassword
        }

        const response = await fetch('/api/users', {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingUser.id,
            ...updateData
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '更新失败' }))
          throw new Error(errorData.error || '更新失败')
        }

        const result = await response.json()

        message.success(result.message || '用户更新成功')
        fetchUsers() // 重新加载用户列表
      } else {
        // 添加新用户 - 调用API创建用户
        const createData = { ...values }
        // 删除confirmPassword(不需要发送到后端)
        delete createData.confirmPassword

        const response = await fetch('/api/users', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...createData,
            permissions: createData.permissions || []
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '创建用户失败' }))
          throw new Error(errorData.error || '创建用户失败')
        }

        const result = await response.json()

        message.success(result.message || '用户创建成功')
        fetchUsers() // 重新加载用户列表
      }

      setIsModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('提交表单失败:', error)
      message.error(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      <PermissionGuard module="users" action="read">
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex justify-between items-center">
          <div>
            <Title level={2} className="!mb-2">
              用户列表
            </Title>
            <Text type="secondary">
              管理系统中的所有用户信息和状态
            </Text>
          </div>
          <PermissionButton
            type="default"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            module="users"
            action="write"
            hideWhenNoPermission
            className="border-blue-500 text-blue-500 hover:border-blue-400 hover:text-blue-400"
          >
            添加用户
          </PermissionButton>
        </div>

        {/* 统计卡片 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总用户数"
                value={stats.total}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="正常用户"
                value={stats.active}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待审批用户"
                value={stats.pending}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已暂停用户"
                value={stats.suspended}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 用户列表 */}
        <Card>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{
              total: users.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* 添加/编辑用户模态框 */}
        <Modal
          title={editingUser ? '编辑用户信息' : '添加新用户'}
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false)
            form.resetFields()
          }}
          footer={null}
          width={700}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input placeholder="请输入用户名" disabled={!!editingUser} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="fullName"
                  label="姓名"
                  rules={[{ required: true, message: '请输入姓名' }]}
                >
                  <Input placeholder="请输入姓名" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="email"
                  label="邮箱"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                >
                  <Input placeholder="请输入邮箱" disabled={!!editingUser} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="phone"
                  label="电话"
                  rules={[
                    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
                  ]}
                >
                  <Input placeholder="请输入电话号码" />
                </Form.Item>
              </Col>
            </Row>

            {/* 密码字段 */}
            {!editingUser ? (
              // 添加新用户时：必填密码
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 8, message: '密码至少8位' },
                      {
                        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                        message: '密码必须包含大小写字母和数字'
                      }
                    ]}
                    extra="密码必须至少8位，包含大小写字母和数字"
                  >
                    <Input.Password placeholder="请输入密码" />
                  </Form.Item>
                </Col>
                <Col span={12}>
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
                    <Input.Password placeholder="请再次输入密码" />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              // 编辑用户时：可选修改密码
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label="新密码"
                    rules={[
                      { min: 8, message: '密码至少8位' },
                      {
                        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                        message: '密码必须包含大小写字母和数字'
                      }
                    ]}
                    extra="留空表示不修改密码；填写则必须至少8位，包含大小写字母和数字"
                  >
                    <Input.Password placeholder="留空表示不修改密码" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['password']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          const password = getFieldValue('password')
                          if (!password && !value) {
                            return Promise.resolve()
                          }
                          if (!value || password === value) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'))
                        }
                      })
                    ]}
                  >
                    <Input.Password placeholder="请再次输入新密码" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="role"
                  label="角色"
                  rules={[{ required: true, message: '请选择角色' }]}
                >
                  <Select placeholder="请选择角色">
                    <Option value="admin">管理员 (Admin)</Option>
                    <Option value="manager">管理者 (Manager)</Option>
                    <Option value="developer">开发者 (Developer)</Option>
                    <Option value="viewer">查看者 (Viewer)</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="permissionGroups"
                  label="权限组"
                  help="选择用户所属的权限组，将自动继承权限组的权限"
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择权限组"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={(permissionGroups || []).map(group => ({
                      label: `${group.name} (${group.description || '无描述'})`,
                      value: group.id
                    }))}
                    onChange={(selectedGroupIds) => {
                      // 当权限组改变时，自动更新权限
                      if (selectedGroupIds && selectedGroupIds.length > 0) {
                        const selectedGroups = (permissionGroups || []).filter(g =>
                          selectedGroupIds.includes(g.id)
                        )
                        const allPermissions = new Set<string>()
                        selectedGroups.forEach(group => {
                          group.permissions?.forEach((permission: any) => {
                            allPermissions.add(permission.code)
                          })
                        })
                        form.setFieldsValue({
                          permissions: Array.from(allPermissions)
                        })
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="isActive"
                  label="激活状态"
                  valuePropName="checked"
                >
                  <Switch
                    checkedChildren="已激活"
                    unCheckedChildren="已暂停"
                  />
                </Form.Item>
              </Col>

            </Row>

            <Form.Item
              name="permissions"
              label="权限"
              help="权限将从所选权限组自动继承，也可以手动添加额外权限"
            >
              <Select
                mode="multiple"
                placeholder="权限将从权限组自动继承"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={(permissions || []).map(permission => ({
                  label: `${permission.name} (${permission.code}) - ${permission.category}`,
                  value: permission.code
                }))}
              />
            </Form.Item>

            <Form.Item className="mb-0 text-right">
              <Space>
                <Button onClick={() => setIsModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editingUser ? '更新' : '添加'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
      </PermissionGuard>
    </MainLayout>
  )
}
