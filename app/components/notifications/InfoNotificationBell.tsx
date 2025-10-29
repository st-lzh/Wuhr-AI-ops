'use client'

import React, { useState, useEffect } from 'react'
import { Badge, Dropdown, List, Button, Empty, Spin, message, Typography } from 'antd'
import { BellOutlined, CheckOutlined, DeleteOutlined, EyeOutlined, CloseOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import RealtimeNotificationManager from '../../utils/realtimeNotificationManager'

const { Text } = Typography

interface InfoNotification {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  actionUrl?: string
  actionText?: string
  metadata?: any
  createdAt: string
}

interface InfoNotificationBellProps {
  className?: string
}

const InfoNotificationBell: React.FC<InfoNotificationBellProps> = ({ 
  className = ''
}) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<InfoNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dropdownVisible, setDropdownVisible] = useState(false)

  // 获取信息通知
  const fetchNotifications = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/notifications/info?limit=10&includeRead=false')
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.data.notifications || [])
        setUnreadCount(data.data.unreadCount || 0)
        
        // 处理离线通知
        if (data.data.offlineNotifications?.length > 0) {
          console.log('📬 收到离线通知:', data.data.offlineNotifications.length)
        }
      } else {
        console.error('获取信息通知失败:', data.error)
      }
    } catch (error) {
      console.error('获取信息通知失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 标记通知为已读
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'markAsRead',
          notificationIds: [notificationId]
        })
      })

      const data = await response.json()
      if (data.success) {
        // 更新本地状态
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, isRead: true } : n
          ).filter(n => !n.isRead) // 移除已读通知
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 全部标记为已读
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'markAllAsRead'
        })
      })

      const data = await response.json()
      if (data.success) {
        setNotifications([])
        setUnreadCount(0)
        message.success('所有通知已标记为已读')
      }
    } catch (error) {
      console.error('全部标记已读失败:', error)
      message.error('操作失败')
    }
  }

  // 删除通知
  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          notificationIds: [notificationId]
        })
      })

      const data = await response.json()
      if (data.success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('删除通知失败:', error)
    }
  }

  // 处理通知点击
  const handleNotificationClick = (notification: InfoNotification) => {
    // 标记为已读
    if (!notification.isRead) {
      markAsRead(notification.id)
    }

    // 如果有操作链接，跳转
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
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

  // 获取通知类型图标
  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'jenkins_submit': '📋',
      'jenkins_approve': '✅',
      'jenkins_reject': '❌',
      'jenkins_execute': '🚀',
      'jenkins_complete': '🎉',
      'system_info': 'ℹ️',
      'system_warning': '⚠️',
      'system_error': '🚨'
    }
    return iconMap[type] || '📬'
  }

  // 建立实时通知连接 - 使用单例管理器
  useEffect(() => {
    if (!user) return

    if (process.env.NODE_ENV === 'development') {
      console.log('📡 [信息通知] 初始化实时连接管理器')
    }
    
    const realtimeManager = RealtimeNotificationManager.getInstance()
    
    const removeListener = realtimeManager.addListener((data) => {
      if (data.type === 'info_notification') {
        if (process.env.NODE_ENV === 'development') {
          console.log('📬 [信息通知] 收到通知:', data.data.title)
        }
        setNotifications(prev => [data.data, ...prev.slice(0, 9)])
        setUnreadCount(prev => prev + 1)
      }
    })

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 [信息通知] 移除监听器')
      }
      removeListener()
    }
  }, [user])

  // 初始加载通知
  useEffect(() => {
    fetchNotifications()
  }, [user])

  // 下拉菜单内容
  const dropdownContent = (
    <div style={{ width: 350, maxHeight: 400, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>信息通知</Text>
        {notifications.length > 0 && (
          <Button 
            type="link" 
            size="small" 
            onClick={markAllAsRead}
            icon={<CheckOutlined />}
          >
            全部已读
          </Button>
        )}
      </div>
      
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty 
            description="暂无新通知" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 20 }}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f5f5f5'
                }}
                actions={[
                  <Button
                    key="view"
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    查看
                  </Button>,
                  <Button
                    key="ignore"
                    type="link"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => {
                      // 标记为已读并从列表移除
                      if (!notification.isRead) {
                        markAsRead(notification.id)
                      }
                      setNotifications(prev => prev.filter(n => n.id !== notification.id))
                      setUnreadCount(prev => Math.max(0, prev - 1))
                    }}
                    style={{ color: '#999' }}
                  >
                    忽略
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<span style={{ fontSize: 16 }}>{getNotificationIcon(notification.type)}</span>}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{notification.title}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {formatTime(notification.createdAt)}
                      </Text>
                    </div>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {notification.content}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
      
      {notifications.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <Button type="link" size="small" href="/notifications">
            查看全部通知
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <Dropdown
      overlay={dropdownContent}
      trigger={['click']}
      placement="bottomRight"
      open={dropdownVisible}
      onOpenChange={setDropdownVisible}
    >
      <Badge count={unreadCount} size="small">
        <BellOutlined
          className={`text-xl cursor-pointer transition-colors ${className}`}
          onClick={() => setDropdownVisible(!dropdownVisible)}
        />
      </Badge>
    </Dropdown>
  )
}

export default InfoNotificationBell
