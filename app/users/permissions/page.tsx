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
  Alert,
  Badge,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  SafetyOutlined,
  TeamOutlined,
  SettingOutlined,
  ReloadOutlined,
  EyeOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { PermissionGuard, PermissionButton } from '../../components/auth/PermissionGuard'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Text } = Typography
const { Option } = Select

// 权限数据类型
interface Permission {
  id: string
  name: string
  code: string
  description: string
  category: string
  createdAt: string
  updatedAt: string
}

// 用户角色数据类型
interface UserRole {
  id: string
  userId: string
  username: string
  email: string
  role: string
  permissions: string[]
  isActive: boolean
  createdAt: string
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [permissionGroups, setPermissionGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(false)
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('permissions')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<Permission | UserRole | null>(null)
  const [form] = Form.useForm()

  // 权限组管理相关状态
  const [isPermissionConfigVisible, setIsPermissionConfigVisible] = useState(false)
  const [isMemberManageVisible, setIsMemberManageVisible] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<any>(null)
  const [groupPermissions, setGroupPermissions] = useState<any[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([])
  const [groupUsers, setGroupUsers] = useState<any[]>([])
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [permissionConfigForm] = Form.useForm()
  const [memberManageForm] = Form.useForm()

  // 加载权限数据
  const loadPermissions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/permissions?includeCategories=true')

      if (!response.ok) {
        throw new Error('获取权限列表失败')
      }

      const result = await response.json()
      if (result.success) {
        setPermissions(result.data.permissions || [])
        console.log('✅ 权限数据加载成功:', result.data.permissions?.length)
      } else {
        message.error(result.error || '获取权限列表失败')
      }
    } catch (error) {
      console.error('❌ 获取权限列表失败:', error)
      message.error('获取权限列表失败，请刷新页面重试')
    } finally {
      setLoading(false)
    }
  }

  // 加载用户权限数据
  const loadUserRoles = async () => {
    try {
      const response = await fetch('/api/users/permissions')

      if (!response.ok) {
        throw new Error('获取用户权限失败')
      }

      const result = await response.json()
      if (result.success) {
        const formattedUsers = result.data.users.map((user: any) => ({
          id: user.id,
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          isActive: user.isActive,
          createdAt: user.createdAt
        }))
        setUserRoles(formattedUsers)
        console.log('✅ 用户权限数据加载成功:', formattedUsers.length)
      } else {
        message.error(result.error || '获取用户权限失败')
      }
    } catch (error) {
      console.error('❌ 获取用户权限失败:', error)
      message.error('获取用户权限失败，请刷新页面重试')
    }
  }

  // 加载系统状态
  const loadSystemStatus = async () => {
    try {
      const response = await fetch('/api/permissions/init')

      if (!response.ok) {
        throw new Error('获取系统状态失败')
      }

      const result = await response.json()
      if (result.success) {
        setSystemStatus(result.data)
        console.log('✅ 系统状态加载成功:', result.data)
      }
    } catch (error) {
      console.error('❌ 获取系统状态失败:', error)
    }
  }

  // 加载权限组数据
  const loadPermissionGroups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/permission-groups')

      if (!response.ok) {
        throw new Error('获取权限组列表失败')
      }

      const result = await response.json()
      if (result.success) {
        setPermissionGroups(result.data || [])
        console.log('✅ 权限组数据加载成功:', result.data?.length)
      } else {
        message.error(result.error || '获取权限组列表失败')
      }
    } catch (error) {
      console.error('❌ 获取权限组列表失败:', error)
      message.error('获取权限组列表失败，请刷新页面重试')
    } finally {
      setLoading(false)
    }
  }

  // 初始化权限系统
  const initializePermissions = async () => {
    try {
      setInitLoading(true)
      const response = await fetch('/api/permissions/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('初始化权限系统失败')
      }

      const result = await response.json()
      if (result.success) {
        message.success('权限系统初始化成功！')
        console.log('✅ 权限系统初始化成功:', result.data)

        // 重新加载数据
        await Promise.all([
          loadPermissions(),
          loadUserRoles(),
          loadPermissionGroups(),
          loadSystemStatus()
        ])
      } else {
        message.error(result.error || '权限系统初始化失败')
      }
    } catch (error) {
      console.error('❌ 权限系统初始化失败:', error)
      message.error('权限系统初始化失败，请重试')
    } finally {
      setInitLoading(false)
    }
  }

  // 页面加载时获取数据
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadPermissions(),
        loadUserRoles(),
        loadPermissionGroups(),
        loadSystemStatus()
      ])
    }
    loadData()
  }, [])

  // 权限表格列定义
  const permissionColumns = [
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '权限代码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text: string) => <Tag color="green">{text}</Tag>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Permission) => (
        <Space size="small">
          <Tooltip title="编辑权限">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除这个权限吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除权限">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 用户角色表格列定义
  const userRoleColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (text: string) => <Tag color="purple">{text}</Tag>
    },
    {
      title: '权限数量',
      dataIndex: 'permissions',
      key: 'permissionCount',
      width: 100,
      render: (permissions: string[]) => (
        <Badge count={permissions?.length || 0} color="blue" />
      )
    },
    {
      title: '权限详情',
      dataIndex: 'permissions',
      key: 'permissions',
      ellipsis: true,
      render: (permissions: string[]) => (
        <Tooltip title={
          <div>
            {permissions?.map(permission => (
              <div key={permission}>{permission}</div>
            ))}
          </div>
        }>
          <Space wrap>
            {permissions?.slice(0, 3).map(permission => (
              <Tag key={permission} color="blue" style={{ fontSize: '12px' }}>
                {permission}
              </Tag>
            ))}
            {permissions?.length > 3 && (
              <Tag color="default">+{permissions.length - 3}</Tag>
            )}
          </Space>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '激活' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: UserRole) => (
        <Space size="small">
          <Tooltip title="编辑用户权限">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditUserRole(record)}
            >
              编辑权限
            </Button>
          </Tooltip>
          <Tooltip title="查看权限详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewUserPermissions(record)}
            >
              查看详情
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ]

  // 权限组表格列定义
  const permissionGroupColumns = [
    {
      title: '权限组名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '权限数量',
      dataIndex: 'permissionCount',
      key: 'permissionCount',
      width: 100,
      render: (count: number) => (
        <Badge count={count} color="blue" />
      )
    },
    {
      title: '用户数量',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      render: (count: number) => (
        <Badge count={count} color="green" />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="编辑权限组">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditPermissionGroup(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="管理权限">
            <Button
              type="link"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => handleManageGroupPermissions(record)}
            >
              权限配置
            </Button>
          </Tooltip>
          <Tooltip title="管理成员">
            <Button
              type="link"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => handleManageGroupUsers(record)}
            >
              成员管理
            </Button>
          </Tooltip>
          <Tooltip title="删除权限组">
            <Popconfirm
              title="确定要删除这个权限组吗？"
              description="删除后无法恢复，请确认操作"
              onConfirm={() => handleDeletePermissionGroup(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ]

  // 处理编辑权限
  const handleEdit = (permission: Permission) => {
    setEditingItem(permission)
    form.setFieldsValue(permission)
    setIsModalVisible(true)
  }

  // 处理编辑用户角色
  const handleEditUserRole = (userRole: UserRole) => {
    setEditingItem(userRole)
    form.setFieldsValue({
      ...userRole,
      permissions: userRole.permissions || []
    })
    setIsModalVisible(true)
  }

  // 处理查看用户权限详情
  const handleViewUserPermissions = (userRole: UserRole) => {
    Modal.info({
      title: `${userRole.username} 的权限详情`,
      width: 700,
      content: (
        <div style={{ padding: '16px 0' }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div><strong>用户名：</strong></div>
              <div style={{ marginTop: '4px', wordBreak: 'break-word' }}>{userRole.username}</div>
            </Col>
            <Col span={12}>
              <div><strong>邮箱：</strong></div>
              <div style={{ marginTop: '4px', wordBreak: 'break-word' }}>{userRole.email}</div>
            </Col>
            <Col span={12}>
              <div><strong>角色：</strong></div>
              <div style={{ marginTop: '4px' }}>
                <Tag color="purple">{userRole.role}</Tag>
              </div>
            </Col>
            <Col span={12}>
              <div><strong>状态：</strong></div>
              <div style={{ marginTop: '4px' }}>
                <Tag color={userRole.isActive ? 'green' : 'red'}>
                  {userRole.isActive ? '激活' : '禁用'}
                </Tag>
              </div>
            </Col>
            <Col span={24}>
              <div><strong>权限列表：</strong></div>
              <div style={{
                marginTop: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: '6px',
                padding: '12px',
                backgroundColor: '#fafafa'
              }}>
                <Space wrap>
                  {userRole.permissions?.map(permission => (
                    <Tag
                      key={permission}
                      color="blue"
                      style={{
                        marginBottom: '4px',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal'
                      }}
                    >
                      {permission}
                    </Tag>
                  ))}
                  {(!userRole.permissions || userRole.permissions.length === 0) && (
                    <Text type="secondary">暂无权限</Text>
                  )}
                </Space>
              </div>
            </Col>
          </Row>
        </div>
      ),
      okText: '关闭'
    })
  }

  // 处理删除权限
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/permissions?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('删除权限失败')
      }

      const result = await response.json()
      if (result.success) {
        setPermissions(permissions.filter(p => p.id !== id))
        message.success('权限删除成功')
      } else {
        message.error(result.error || '删除权限失败')
      }
    } catch (error) {
      console.error('❌ 删除权限失败:', error)
      message.error('删除权限失败，请重试')
    }
  }

  // 处理更新用户权限
  const handleUpdateUserPermissions = async (userId: string, permissions: string[], action: string = 'replace') => {
    try {
      const response = await fetch('/api/users/permissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          permissions,
          action
        })
      })

      if (!response.ok) {
        throw new Error('更新用户权限失败')
      }

      const result = await response.json()
      if (result.success) {
        // 更新本地状态
        setUserRoles(userRoles.map(user =>
          user.userId === userId
            ? { ...user, permissions: result.data.user.permissions }
            : user
        ))
        message.success('用户权限更新成功')
        return true
      } else {
        message.error(result.error || '更新用户权限失败')
        return false
      }
    } catch (error) {
      console.error('❌ 更新用户权限失败:', error)
      message.error('更新用户权限失败，请重试')
      return false
    }
  }

  // 处理添加新项
  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)

      if (activeTab === 'permissions') {
        // 权限管理
        const url = editingItem ? '/api/permissions' : '/api/permissions'
        const method = editingItem ? 'PUT' : 'POST'
        const body = editingItem
          ? { id: (editingItem as Permission).id, ...values }
          : values

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          throw new Error('操作失败')
        }

        const result = await response.json()
        if (result.success) {
          if (editingItem) {
            // 更新权限
            setPermissions(permissions.map(p =>
              p.id === (editingItem as Permission).id ? result.data : p
            ))
            message.success('权限更新成功')
          } else {
            // 添加权限
            setPermissions([...permissions, result.data])
            message.success('权限添加成功')
          }
        } else {
          message.error(result.error || '操作失败')
        }
      } else if (activeTab === 'userRoles') {
        // 用户权限管理
        if (editingItem) {
          const userRole = editingItem as UserRole
          const success = await handleUpdateUserPermissions(
            userRole.userId,
            values.permissions || [],
            'replace'
          )
          if (!success) return
        } else {
          message.error('暂不支持添加新用户，请通过用户管理页面添加')
          return
        }
      } else if (activeTab === 'permissionGroups') {
        // 权限组管理
        const url = editingItem ? `/api/permission-groups/${(editingItem as any).id}` : '/api/permission-groups'
        const method = editingItem ? 'PUT' : 'POST'

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(values)
        })

        if (!response.ok) {
          throw new Error('操作失败')
        }

        const result = await response.json()
        if (result.success) {
          if (editingItem) {
            // 更新权限组
            setPermissionGroups(permissionGroups.map(g =>
              g.id === (editingItem as any).id ? result.data : g
            ))
            message.success('权限组更新成功')
          } else {
            // 添加权限组
            setPermissionGroups([...permissionGroups, result.data])
            message.success('权限组添加成功')
          }
        } else {
          message.error(result.error || '操作失败')
        }
      }

      setIsModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('❌ 表单提交失败:', error)
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 权限组相关处理函数
  const handleEditPermissionGroup = (group: any) => {
    setEditingItem(group)
    form.setFieldsValue({
      name: group.name,
      description: group.description
    })
    setIsModalVisible(true)
  }

  const handleManageGroupPermissions = async (group: any) => {
    try {
      setCurrentGroup(group)
      setLoading(true)

      // 获取权限组的权限配置
      const response = await fetch(`/api/permission-groups/${group.id}/permissions`)
      if (!response.ok) {
        throw new Error('获取权限组权限失败')
      }

      const result = await response.json()
      if (result.success) {
        setGroupPermissions(result.data.assignedPermissions || [])
        setAvailablePermissions(result.data.availablePermissions || [])

        // 设置表单初始值
        permissionConfigForm.setFieldsValue({
          permissions: result.data.assignedPermissions?.map((p: any) => p.id) || []
        })

        setIsPermissionConfigVisible(true)
      } else {
        message.error(result.error || '获取权限组权限失败')
      }
    } catch (error) {
      console.error('❌ 获取权限组权限失败:', error)
      message.error('获取权限组权限失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleManageGroupUsers = async (group: any) => {
    try {
      setCurrentGroup(group)
      setLoading(true)

      // 获取权限组的用户配置
      const response = await fetch(`/api/permission-groups/${group.id}/users`)
      if (!response.ok) {
        throw new Error('获取权限组用户失败')
      }

      const result = await response.json()
      if (result.success) {
        setGroupUsers(result.data.assignedUsers || [])
        setAvailableUsers(result.data.availableUsers || [])

        // 设置表单初始值
        memberManageForm.setFieldsValue({
          users: result.data.assignedUsers?.map((u: any) => u.id) || []
        })

        setIsMemberManageVisible(true)
      } else {
        message.error(result.error || '获取权限组用户失败')
      }
    } catch (error) {
      console.error('❌ 获取权限组用户失败:', error)
      message.error('获取权限组用户失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePermissionGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/permission-groups/${groupId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('删除权限组失败')
      }

      const result = await response.json()
      if (result.success) {
        setPermissionGroups(permissionGroups.filter(g => g.id !== groupId))
        message.success('权限组删除成功')
      } else {
        message.error(result.error || '删除权限组失败')
      }
    } catch (error) {
      console.error('❌ 删除权限组失败:', error)
      message.error('删除权限组失败，请重试')
    }
  }

  // 处理权限配置提交
  const handlePermissionConfigSubmit = async (values: any) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/permission-groups/${currentGroup.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permissionIds: values.permissions || []
        })
      })

      if (!response.ok) {
        throw new Error('更新权限组权限失败')
      }

      const result = await response.json()
      if (result.success) {
        message.success('权限组权限更新成功')
        setIsPermissionConfigVisible(false)
        permissionConfigForm.resetFields()

        // 刷新权限组列表
        loadPermissionGroups()
      } else {
        message.error(result.error || '更新权限组权限失败')
      }
    } catch (error) {
      console.error('❌ 更新权限组权限失败:', error)
      message.error('更新权限组权限失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理成员管理提交
  const handleMemberManageSubmit = async (values: any) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/permission-groups/${currentGroup.id}/users`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: values.users || []
        })
      })

      if (!response.ok) {
        throw new Error('更新权限组成员失败')
      }

      const result = await response.json()
      if (result.success) {
        message.success('权限组成员更新成功')
        setIsMemberManageVisible(false)
        memberManageForm.resetFields()

        // 刷新权限组列表
        loadPermissionGroups()
      } else {
        message.error(result.error || '更新权限组成员失败')
      }
    } catch (error) {
      console.error('❌ 更新权限组成员失败:', error)
      message.error('更新权限组成员失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      <PermissionGuard module="permissions" action="read">
      <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="!mb-2">
            权限管理
          </Title>
          <Text type="secondary">
            管理系统权限和用户角色分配
          </Text>
        </div>
        <Space>
          {systemStatus && !systemStatus.isInitialized && (
            <PermissionButton
              type="primary"
              icon={<SettingOutlined />}
              loading={initLoading}
              onClick={initializePermissions}
              module="permissions"
              action="write"
              hideWhenNoPermission
            >
              初始化权限系统
            </PermissionButton>
          )}
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={() => {
              loadPermissions()
              loadUserRoles()
              loadPermissionGroups()
              loadSystemStatus()
            }}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 系统状态提示 */}
      {systemStatus && (
        <Alert
          message={
            systemStatus.isInitialized
              ? "权限系统已初始化"
              : "权限系统未初始化"
          }
          description={
            systemStatus.isInitialized
              ? `当前共有 ${systemStatus.permissions.total} 个权限，${systemStatus.permissions.categories.length} 个类别，${systemStatus.users.total} 个用户`
              : "请点击上方按钮初始化权限系统，这将创建所有系统权限并为现有用户分配相应权限"
          }
          type={systemStatus.isInitialized ? "success" : "warning"}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总权限数"
              value={systemStatus?.permissions?.total || permissions.length}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="权限类别"
              value={systemStatus?.permissions?.categories?.length || 0}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="用户总数"
              value={systemStatus?.users?.total || userRoles.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="激活用户"
              value={userRoles.filter(ur => ur.isActive).length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 标签页切换 */}
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <Space>
            <Button
              type={activeTab === 'permissions' ? 'primary' : 'default'}
              onClick={() => setActiveTab('permissions')}
            >
              权限管理
            </Button>
            <Button
              type={activeTab === 'userRoles' ? 'primary' : 'default'}
              onClick={() => setActiveTab('userRoles')}
            >
              用户权限
            </Button>
            <Button
              type={activeTab === 'permissionGroups' ? 'primary' : 'default'}
              onClick={() => setActiveTab('permissionGroups')}
            >
              权限组管理
            </Button>
          </Space>
          <Button
            type="default"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="border-blue-500 text-blue-500 hover:border-blue-400 hover:text-blue-400 bg-transparent"
          >
            {activeTab === 'permissions' ? '添加权限' :
             activeTab === 'userRoles' ? '分配权限' : '添加权限组'}
          </Button>
        </div>

        {/* 权限管理表格 */}
        {activeTab === 'permissions' && (
          <Table
            columns={permissionColumns}
            dataSource={permissions}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{
              total: permissions.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        )}

        {/* 用户权限表格 */}
        {activeTab === 'userRoles' && (
          <Table
            columns={userRoleColumns}
            dataSource={userRoles}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={{
              total: userRoles.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        )}

        {/* 权限组表格 */}
        {activeTab === 'permissionGroups' && (
          <Table
            columns={permissionGroupColumns}
            dataSource={permissionGroups}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={{
              total: permissionGroups.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        )}
      </Card>

      {/* 添加/编辑模态框 */}
      <Modal
        title={
          activeTab === 'permissions'
            ? (editingItem ? '编辑权限' : '添加权限')
            : activeTab === 'userRoles'
            ? (editingItem ? '编辑用户权限' : '分配用户权限')
            : (editingItem ? '编辑权限组' : '添加权限组')
        }
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {activeTab === 'permissions' ? (
            <>
              <Form.Item
                name="name"
                label="权限名称"
                rules={[{ required: true, message: '请输入权限名称' }]}
              >
                <Input placeholder="请输入权限名称" />
              </Form.Item>
              <Form.Item
                name="code"
                label="权限代码"
                rules={[{ required: true, message: '请输入权限代码' }]}
              >
                <Input placeholder="例如：users:manage" />
              </Form.Item>
              <Form.Item
                name="category"
                label="权限分类"
                rules={[{ required: true, message: '请选择权限分类' }]}
              >
                <Select placeholder="请选择权限分类">
                  <Option value="用户管理">用户管理</Option>
                  <Option value="权限管理">权限管理</Option>
                  <Option value="主机管理">主机管理</Option>
                  <Option value="CI/CD管理">CI/CD管理</Option>
                  <Option value="审批管理">审批管理</Option>
                  <Option value="通知管理">通知管理</Option>
                  <Option value="配置管理">配置管理</Option>
                  <Option value="AI功能">AI功能</Option>
                  <Option value="系统监控">系统监控</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="description"
                label="权限描述"
                rules={[{ required: true, message: '请输入权限描述' }]}
              >
                <Input.TextArea rows={3} placeholder="请输入权限描述" />
              </Form.Item>
            </>
          ) : activeTab === 'userRoles' ? (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" disabled={!!editingItem} />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input placeholder="请输入邮箱" disabled={!!editingItem} />
              </Form.Item>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select placeholder="请选择角色" disabled={!!editingItem}>
                  <Option value="admin">管理员</Option>
                  <Option value="manager">经理</Option>
                  <Option value="developer">开发者</Option>
                  <Option value="viewer">查看者</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="permissions"
                label="权限"
                rules={[{ required: true, message: '请选择权限' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="请选择权限"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={permissions.map(p => ({
                    label: `${p.name} (${p.code})`,
                    value: p.code,
                    disabled: false
                  }))}
                  optionRender={(option) => (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{option.data.label.split(' (')[0]}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {option.data.value}
                      </div>
                    </div>
                  )}
                />
              </Form.Item>
              <Form.Item
                name="isActive"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Option value={true}>激活</Option>
                  <Option value={false}>禁用</Option>
                </Select>
              </Form.Item>
            </>
          ) : activeTab === 'permissionGroups' ? (
            <>
              <Form.Item
                name="name"
                label="权限组名称"
                rules={[{ required: true, message: '请输入权限组名称' }]}
              >
                <Input placeholder="请输入权限组名称" />
              </Form.Item>
              <Form.Item
                name="description"
                label="描述"
              >
                <Input.TextArea
                  placeholder="请输入权限组描述"
                  rows={3}
                />
              </Form.Item>
            </>
          ) : null}

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingItem ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限配置模态框 */}
      <Modal
        title={`权限配置 - ${currentGroup?.name}`}
        open={isPermissionConfigVisible}
        onCancel={() => {
          setIsPermissionConfigVisible(false)
          permissionConfigForm.resetFields()
        }}
        footer={null}
        width={800}
        destroyOnClose={true}
      >
        <Form
          form={permissionConfigForm}
          layout="vertical"
          onFinish={handlePermissionConfigSubmit}
        >
          <Form.Item
            name="permissions"
            label="选择权限"
            help="选择该权限组应该拥有的权限"
          >
            <Select
              mode="multiple"
              placeholder="请选择权限"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
              options={[...groupPermissions, ...availablePermissions].map(p => ({
                label: `${p.name} (${p.code}) - ${p.category}`,
                value: p.id,
                disabled: false
              }))}
            />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button
                onClick={() => {
                  setIsPermissionConfigVisible(false)
                  permissionConfigForm.resetFields()
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理模态框 */}
      <Modal
        title={`成员管理 - ${currentGroup?.name}`}
        open={isMemberManageVisible}
        onCancel={() => {
          setIsMemberManageVisible(false)
          memberManageForm.resetFields()
        }}
        footer={null}
        width={800}
        destroyOnClose={true}
      >
        <Form
          form={memberManageForm}
          layout="vertical"
          onFinish={handleMemberManageSubmit}
        >
          <Form.Item
            name="users"
            label="选择成员"
            help="选择该权限组的成员用户"
          >
            <Select
              mode="multiple"
              placeholder="请选择用户"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
              options={[...groupUsers, ...availableUsers].map(u => ({
                label: `${u.username} (${u.email}) - ${u.role}`,
                value: u.id,
                disabled: false
              }))}
            />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button
                onClick={() => {
                  setIsMemberManageVisible(false)
                  memberManageForm.resetFields()
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存配置
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
