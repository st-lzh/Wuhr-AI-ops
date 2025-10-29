'use client'

import React, { useState, useEffect } from 'react'
import { 
  Modal, 
  Button, 
  Space, 
  message, 
  Spin, 
  Empty, 
  Tag, 
  Popconfirm,
  Input,
  Badge
} from 'antd'
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  UserOutlined,
  DeploymentUnitOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'

const { TextArea } = Input

interface NotificationData {
  id: string
  type: 'user_registration' | 'cicd_approval'
  title: string
  message: string
  data: any
  createdAt: string
  canApprove: boolean
}

interface NotificationPanelProps {
  visible: boolean
  onClose: () => void
  onNotificationCountChange?: (count: number) => void
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  visible,
  onClose,
  onNotificationCountChange
}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  // 获取待审批通知
  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications/pending-approvals')
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.data.notifications)
        onNotificationCountChange?.(data.data.total)
      } else {
        message.error('获取通知失败')
      }
    } catch (error) {
      console.error('获取通知失败:', error)
      message.error('获取通知失败')
    } finally {
      setLoading(false)
    }
  }

  // 处理审批操作
  const handleApproval = async (notificationId: string, action: 'approve' | 'reject', comment?: string) => {
    setApproving(notificationId)
    try {
      const response = await fetch('/api/notifications/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId,
          action,
          comment
        })
      })

      const data = await response.json()
      
      if (data.success) {
        message.success(data.data.message)
        // 移除已处理的通知
        const updatedNotifications = notifications.filter(n => n.id !== notificationId)
        setNotifications(updatedNotifications)
        onNotificationCountChange?.(updatedNotifications.length)
      } else {
        message.error(data.error || '操作失败')
      }
    } catch (error) {
      console.error('审批操作失败:', error)
      message.error('操作失败')
    } finally {
      setApproving(null)
      setShowRejectModal(null)
      setRejectComment('')
    }
  }

  // 处理拒绝操作
  const handleReject = (notificationId: string) => {
    setShowRejectModal(notificationId)
  }

  // 确认拒绝
  const confirmReject = () => {
    if (showRejectModal) {
      handleApproval(showRejectModal, 'reject', rejectComment)
    }
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 60) {
      return `${minutes}分钟前`
    } else if (hours < 24) {
      return `${hours}小时前`
    } else {
      return `${days}天前`
    }
  }

  // 获取通知图标
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'user_registration':
        return <UserOutlined className="text-blue-500" />
      case 'cicd_approval':
        return <DeploymentUnitOutlined className="text-green-500" />
      default:
        return <ClockCircleOutlined className="text-gray-500" />
    }
  }

  // 获取通知颜色
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'user_registration':
        return 'blue'
      case 'cicd_approval':
        return 'green'
      default:
        return 'gray'
    }
  }

  useEffect(() => {
    if (visible) {
      fetchNotifications()
    }
  }, [visible])

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between">
            <span>通知中心</span>
            <Badge count={notifications.length} size="small" />
          </div>
        }
        open={visible}
        onCancel={onClose}
        footer={null}
        width={600}
      >
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <Spin size="large" />
            </div>
          ) : notifications.length === 0 ? (
            <Empty 
              description="暂无待审批通知" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{notification.title}</h4>
                        <Tag color={getNotificationColor(notification.type)}>
                          {notification.type === 'user_registration' ? '用户审批' : 'CI/CD审批'}
                        </Tag>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      
                      {/* 显示详细信息 */}
                      {notification.type === 'user_registration' && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div>角色: {notification.data.role}</div>
                          <div>申请时间: {formatTime(notification.data.createdAt)}</div>
                        </div>
                      )}
                      
                      {notification.type === 'cicd_approval' && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div>环境: {notification.data.environment}</div>
                          <div>申请人: {notification.data.creatorName}</div>
                          <div>申请时间: {formatTime(notification.data.createdAt)}</div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                          {formatTime(notification.createdAt)}
                        </span>
                        
                        {notification.canApprove && (
                          <Space size="small">
                            <Popconfirm
                              title="确定要通过这个审批吗？"
                              onConfirm={() => handleApproval(notification.id, 'approve')}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                loading={approving === notification.id}
                                disabled={approving !== null}
                              >
                                通过
                              </Button>
                            </Popconfirm>
                            
                            <Button
                              danger
                              size="small"
                              icon={<CloseCircleOutlined />}
                              loading={approving === notification.id}
                              disabled={approving !== null}
                              onClick={() => handleReject(notification.id)}
                            >
                              拒绝
                            </Button>
                          </Space>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 拒绝原因输入模态框 */}
      <Modal
        title="拒绝审批"
        open={showRejectModal !== null}
        onCancel={() => {
          setShowRejectModal(null)
          setRejectComment('')
        }}
        onOk={confirmReject}
        okText="确定拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div className="space-y-4">
          <p>请输入拒绝原因：</p>
          <TextArea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="请输入拒绝原因..."
            rows={4}
            maxLength={200}
            showCount
          />
        </div>
      </Modal>
    </>
  )
}

export default NotificationPanel
