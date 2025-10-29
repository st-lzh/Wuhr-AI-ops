'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Descriptions,
  Avatar,
  Tag,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Divider,
  Spin,
  message
} from 'antd'
import {
  UserOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoginOutlined
} from '@ant-design/icons'
import MainLayout from '../components/layout/MainLayout'
import { useGlobalState } from '../contexts/GlobalStateContext'

const { Title, Text } = Typography

interface UserProfile {
  id: string
  username: string
  email: string
  role: string
  permissions: string[]
  isActive: boolean
  approvalStatus: string
  createdAt: string
  lastLoginAt?: string
  approvedAt?: string
  phone?: string
  department?: string
  realName?: string
  avatar?: string
  approver?: {
    username: string
  }
}

const ProfilePage: React.FC = () => {
  const { state } = useGlobalState()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // 获取当前用户资料
  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/profile')
      const data = await response.json()

      if (data.success) {
        setProfile(data.data.user)
      } else {
        message.error('获取用户资料失败')
      }
    } catch (error) {
      console.error('获取用户资料失败:', error)
      message.error('获取用户资料失败')
    } finally {
      setLoading(false)
    }
  }

  // 监听全局状态变化，更新本地profile状态
  useEffect(() => {
    if (state.auth.user) {
      setProfile(prev => {
        if (!prev) return state.auth.user as UserProfile
        // 合并全局状态中的用户数据
        return { ...prev, ...state.auth.user }
      })
    }
  }, [state.auth.user])

  // 监听头像更新事件和用户信息更新事件
  useEffect(() => {
    const handleAvatarUpdate = () => {
      // 重新获取用户资料
      fetchProfile()
    }

    const handleUserProfileUpdate = () => {
      // 重新获取用户资料
      fetchProfile()
    }

    window.addEventListener('avatarUpdated', handleAvatarUpdate)
    window.addEventListener('userProfileUpdated', handleUserProfileUpdate)
    
    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate)
      window.removeEventListener('userProfileUpdated', handleUserProfileUpdate)
    }
  }, [])

  // 格式化时间
  const formatTime = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('zh-CN')
  }

  // 获取状态标签
  const getStatusTag = (isActive: boolean) => {
    return isActive ? (
      <Tag color="green">正常</Tag>
    ) : (
      <Tag color="red">已暂停</Tag>
    )
  }

  // 获取审批状态标签
  const getApprovalTag = (approvalStatus: string) => {
    const statusConfig = {
      approved: { color: 'green', icon: <SafetyCertificateOutlined />, text: '已审批' },
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '待审批' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '已拒绝' }
    }
    const config = statusConfig[approvalStatus as keyof typeof statusConfig] || statusConfig.pending
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>
  }

  // 获取角色标签颜色
  const getRoleColor = (role: string) => {
    const roleColors = {
      admin: 'red',
      manager: 'blue',
      developer: 'green',
      operator: 'orange',
      user: 'default'
    }
    return roleColors[role as keyof typeof roleColors] || 'default'
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </MainLayout>
    )
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <Text type="secondary">无法获取用户资料</Text>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex justify-between items-center">
          <div>
            <Title level={2} className="!mb-2">
              个人资料
            </Title>
            <Text type="secondary">
              查看您的个人信息和账户状态
            </Text>
          </div>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => window.location.href = '/settings'}
          >
            编辑资料
          </Button>
        </div>

        <Row gutter={24}>
          {/* 基本信息卡片 */}
          <Col span={16}>
            <Card title="基本信息" className="h-full">
              <div className="flex items-start space-x-6 mb-6">
                <Avatar
                  size={80}
                  src={profile.avatar}
                  icon={<UserOutlined />}
                  className="flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Title level={3} className="!mb-0">
                      {profile.realName || profile.username}
                    </Title>
                    {getStatusTag(profile.isActive)}
                    {getApprovalTag(profile.approvalStatus)}
                  </div>
                  <Text type="secondary" className="block mb-2">
                    @{profile.username}
                  </Text>
                  <Tag color={getRoleColor(profile.role)} className="mb-0">
                    {profile.role === 'admin' ? '超级管理员' :
                     profile.role === 'manager' ? '管理员' :
                     profile.role === 'developer' ? '开发者' :
                     profile.role === 'viewer' ? '查看者' : '普通用户'}
                  </Tag>
                </div>
              </div>

              <Descriptions column={2} bordered>
                {profile.realName && (
                  <Descriptions.Item
                    label={<><UserOutlined className="mr-1" />真实姓名</>}
                    span={2}
                  >
                    {profile.realName}
                  </Descriptions.Item>
                )}
                <Descriptions.Item
                  label={<><MailOutlined className="mr-1" />邮箱地址</>}
                  span={2}
                >
                  {profile.email}
                </Descriptions.Item>
                <Descriptions.Item
                  label={<><PhoneOutlined className="mr-1" />联系电话</>}
                >
                  {profile.phone || '-'}
                </Descriptions.Item>
                <Descriptions.Item
                  label={<><TeamOutlined className="mr-1" />所属部门</>}
                >
                  {profile.department || '-'}
                </Descriptions.Item>
                <Descriptions.Item
                  label="注册时间"
                  span={2}
                >
                  {formatTime(profile.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item
                  label={<><LoginOutlined className="mr-1" />最后登录</>}
                  span={2}
                >
                  {formatTime(profile.lastLoginAt)}
                </Descriptions.Item>
                {profile.approvedAt && (
                  <>
                    <Descriptions.Item
                      label="审批时间"
                    >
                      {formatTime(profile.approvedAt)}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label="审批人"
                    >
                      {profile.approver?.username || '-'}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>
          </Col>

          {/* 权限信息卡片 */}
          <Col span={8}>
            <Card title="权限信息" className="h-full">
              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">用户角色</Text>
                  <Tag color={getRoleColor(profile.role)}>
                    {profile.role === 'admin' ? '超级管理员' :
                     profile.role === 'manager' ? '管理员' :
                     profile.role === 'developer' ? '开发者' :
                     profile.role === 'operator' ? '操作员' : '普通用户'}
                  </Tag>
                </div>

                <Divider />

                <div>
                  <Text strong className="block mb-3">
                    权限列表 ({profile.permissions.length})
                  </Text>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {profile.permissions.map((permission, index) => (
                      <Tag key={index} color="blue" className="mb-1">
                        {permission}
                      </Tag>
                    ))}
                  </div>
                </div>

                <Divider />

                <div>
                  <Text strong className="block mb-2">账户状态</Text>
                  <Space direction="vertical" size="small">
                    <div>
                      <Text type="secondary">状态: </Text>
                      {getStatusTag(profile.isActive)}
                    </div>
                    <div>
                      <Text type="secondary">审批: </Text>
                      {getApprovalTag(profile.approvalStatus)}
                    </div>
                  </Space>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  )
}

export default ProfilePage