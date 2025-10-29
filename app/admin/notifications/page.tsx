'use client'

import React, { useState, useEffect } from 'react'
import { Card, List, Button, Badge, message, Modal, Input, Space, Typography, Tag, Divider } from 'antd'
import { BellOutlined, CheckOutlined, CloseOutlined, UserAddOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  data?: {
    newUserId?: string
    newUserEmail?: string
    newUserUsername?: string
  }
}

interface UserRegistration {
  id: string
  username: string
  email: string
  realName: string
  reason: string
  status: string
  createdAt: string
}

export default function AdminNotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [registrations, setRegistrations] = useState<UserRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [approvalModalVisible, setApprovalModalVisible] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState<UserRegistration | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')

  // 获取通知列表
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.data || [])
      }
    } catch (error) {
      console.error('获取通知失败:', error)
    }
  }

  // 获取待审批的注册申请
  const fetchRegistrations = async () => {
    try {
      const response = await fetch('/api/admin/registrations')
      const data = await response.json()
      
      if (data.success) {
        setRegistrations(data.data || [])
      }
    } catch (error) {
      console.error('获取注册申请失败:', error)
    }
  }

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchNotifications(),
        fetchRegistrations()
      ])
      setLoading(false)
    }

    if (user?.role === 'admin') {
      loadData()
    }
  }, [user])

  // 标记通知为已读
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      })
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        )
      }
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 处理审批
  const handleApproval = async () => {
    if (!selectedRegistration) return

    try {
      const response = await fetch(`/api/admin/registrations/${selectedRegistration.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: approvalAction === 'approve' ? 'APPROVED' : 'REJECTED',
          rejectedReason: approvalAction === 'reject' ? rejectionReason : undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        message.success(
          approvalAction === 'approve' 
            ? `用户 ${selectedRegistration.username} 审批通过` 
            : `用户 ${selectedRegistration.username} 审批拒绝`
        )
        
        // 刷新数据
        await fetchRegistrations()
        await fetchNotifications()
        
        // 关闭模态框
        setApprovalModalVisible(false)
        setSelectedRegistration(null)
        setRejectionReason('')
      } else {
        message.error(data.message || '审批失败')
      }
    } catch (error) {
      console.error('审批失败:', error)
      message.error('审批失败')
    }
  }

  // 打开审批模态框
  const openApprovalModal = (registration: UserRegistration, action: 'approve' | 'reject') => {
    setSelectedRegistration(registration)
    setApprovalAction(action)
    setApprovalModalVisible(true)
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center">
            <ExclamationCircleOutlined className="text-4xl text-yellow-500 mb-4" />
            <Title level={3}>权限不足</Title>
            <Text>只有管理员可以访问此页面</Text>
          </div>
        </Card>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length
  const pendingCount = registrations.filter(r => r.status === 'PENDING').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Title level={2}>
          <BellOutlined className="mr-2" />
          管理员通知中心
        </Title>
        <Space>
          <Badge count={unreadCount} offset={[10, 0]}>
            <Button icon={<BellOutlined />}>
              未读通知
            </Button>
          </Badge>
          <Badge count={pendingCount} offset={[10, 0]}>
            <Button icon={<UserAddOutlined />} type="primary">
              待审批用户
            </Button>
          </Badge>
        </Space>
      </div>

      {/* 待审批的用户注册 */}
      <Card 
        title={
          <Space>
            <UserAddOutlined />
            <span>待审批用户注册</span>
            <Badge count={pendingCount} />
          </Space>
        }
        loading={loading}
      >
        {registrations.filter(r => r.status === 'PENDING').length === 0 ? (
          <div className="text-center py-8">
            <Text type="secondary">暂无待审批的用户注册</Text>
          </div>
        ) : (
          <List
            dataSource={registrations.filter(r => r.status === 'PENDING')}
            renderItem={(registration) => (
              <List.Item
                actions={[
                  <Button
                    key="approve"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => openApprovalModal(registration, 'approve')}
                  >
                    批准
                  </Button>,
                  <Button
                    key="reject"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => openApprovalModal(registration, 'reject')}
                  >
                    拒绝
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{registration.username}</Text>
                      <Text type="secondary">({registration.realName})</Text>
                      <Tag color="orange">待审批</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Text>邮箱: {registration.email}</Text>
                      <br />
                      <Text>申请理由: {registration.reason}</Text>
                      <br />
                      <Text type="secondary">
                        申请时间: {new Date(registration.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 系统通知 */}
      <Card 
        title={
          <Space>
            <BellOutlined />
            <span>系统通知</span>
            <Badge count={unreadCount} />
          </Space>
        }
        loading={loading}
      >
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Text type="secondary">暂无系统通知</Text>
          </div>
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                className={!notification.isRead ? 'bg-blue-50' : ''}
                actions={[
                  !notification.isRead && (
                    <Button
                      key="read"
                      size="small"
                      onClick={() => markAsRead(notification.id)}
                    >
                      标记已读
                    </Button>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong={!notification.isRead}>{notification.title}</Text>
                      {!notification.isRead && <Badge status="processing" />}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph>{notification.message}</Paragraph>
                      <Text type="secondary">
                        {new Date(notification.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 审批模态框 */}
      <Modal
        title={`${approvalAction === 'approve' ? '批准' : '拒绝'}用户注册`}
        open={approvalModalVisible}
        onOk={handleApproval}
        onCancel={() => {
          setApprovalModalVisible(false)
          setSelectedRegistration(null)
          setRejectionReason('')
        }}
        okText={approvalAction === 'approve' ? '批准' : '拒绝'}
        okButtonProps={{ 
          danger: approvalAction === 'reject',
          disabled: approvalAction === 'reject' && !rejectionReason.trim()
        }}
      >
        {selectedRegistration && (
          <div className="space-y-4">
            <div>
              <Text strong>用户信息:</Text>
              <div className="mt-2 p-3 bg-gray-50 rounded">
                <div>用户名: {selectedRegistration.username}</div>
                <div>真实姓名: {selectedRegistration.realName}</div>
                <div>邮箱: {selectedRegistration.email}</div>
                <div>申请理由: {selectedRegistration.reason}</div>
              </div>
            </div>

            {approvalAction === 'reject' && (
              <div>
                <Text strong>拒绝理由:</Text>
                <TextArea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="请输入拒绝理由..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
