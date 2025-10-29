'use client'

import React, { useState, useEffect } from 'react'
import { Badge, Dropdown, List, Button, Empty, Spin, message, Typography, Tabs, Divider } from 'antd'
import { BellOutlined, CheckOutlined, DeleteOutlined, EyeOutlined, CloseOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import RealtimeNotificationManager from '../../utils/realtimeNotificationManager'

const { Text } = Typography
const { TabPane } = Tabs

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

interface ApprovalNotification {
  id: string
  type: 'user_registration' | 'cicd_approval' | 'jenkins_job'
  title: string
  message: string
  data: any
  createdAt: string
  canApprove: boolean
}

interface UnifiedNotificationBellProps {
  className?: string
}

const UnifiedNotificationBell: React.FC<UnifiedNotificationBellProps> = ({ 
  className = ''
}) => {
  const { user } = useAuth()
  const [infoNotifications, setInfoNotifications] = useState<InfoNotification[]>([])
  const [approvalNotifications, setApprovalNotifications] = useState<ApprovalNotification[]>([])
  const [infoUnreadCount, setInfoUnreadCount] = useState(0)
  const [approvalUnreadCount, setApprovalUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  // 获取信息通知 - 添加缓存机制
  const fetchInfoNotifications = async (force = false) => {
    if (!user) return
    
    // 防抖：如果距离上次请求不足5秒，则跳过（除非强制刷新）
    const now = Date.now()
    if (!force && now - lastFetchTime < 5000) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔔 [通知中心] 跳过重复请求（防抖）')
      }
      return
    }
    
    try {
      const response = await fetch('/api/notifications/info?limit=10&includeRead=false')
      const data = await response.json()
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔔 [通知中心] API响应:', {
          success: data.success,
          notificationCount: data.data?.notifications?.length || 0,
          unreadCount: data.data?.unreadCount || 0,
          requestUrl: '/api/notifications/info?limit=10&includeRead=false'
        })
      }

      if (data.success) {
        const notifications = data.data.notifications || []
        setInfoNotifications(notifications)
        setInfoUnreadCount(data.data.unreadCount || 0)
        setLastFetchTime(now)

        // 详细日志：显示前3个通知的详细信息
        if (notifications.length > 0) {
          console.log('🔔 [通知中心] 前3个通知详情:',
            notifications.slice(0, 3).map((n: any) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              isRead: n.isRead,
              category: n.category,
              createdAt: n.createdAt
            }))
          )
        } else {
          console.log('🔔 [通知中心] ⚠️ 没有获取到通知数据')
        }

        // 处理离线通知
        if (data.data.offlineNotifications?.length > 0) {
          console.log('📬 收到离线信息通知:', data.data.offlineNotifications.length)
        }
      }
    } catch (error) {
      console.error('获取信息通知失败:', error)
    }
  }

  // 获取审批通知
  const fetchApprovalNotifications = async () => {
    if (!user) return

    try {
      // 同时获取Jenkins审批任务和信息通知中的审批通知
      const [pendingApprovalsResponse, infoNotificationsResponse] = await Promise.all([
        fetch('/api/notifications/pending-approvals'),
        fetch('/api/notifications/info?limit=50&includeRead=false') // 获取所有信息通知，然后过滤
      ])

      const pendingApprovalsData = await pendingApprovalsResponse.json()
      const infoNotificationsData = await infoNotificationsResponse.json()

      console.log('🔍 [审批通知] API响应详情:', {
        pendingApprovals: {
          success: pendingApprovalsData.success,
          count: pendingApprovalsData.data?.notifications?.length || 0,
          total: pendingApprovalsData.data?.total || 0
        },
        infoNotifications: {
          success: infoNotificationsData.success,
          count: infoNotificationsData.data?.notifications?.length || 0,
          total: infoNotificationsData.data?.total || 0,
          unreadCount: infoNotificationsData.data?.unreadCount || 0
        }
      })

      let allApprovalNotifications: any[] = []
      let totalUnreadCount = 0

      // 添加Jenkins审批任务
      if (pendingApprovalsData.success) {
        allApprovalNotifications = [...(pendingApprovalsData.data.notifications || [])]
        totalUnreadCount += pendingApprovalsData.data.total || 0
        console.log('🔍 [审批通知] Jenkins审批任务:', allApprovalNotifications.length)
      }

      // 添加信息通知中的审批通知
      if (infoNotificationsData.success) {
        const allInfoNotifications = infoNotificationsData.data.notifications || []

        console.log('🔍 [审批通知] 信息通知详情:', {
          totalCount: allInfoNotifications.length,
          notificationTypes: allInfoNotifications.map((n: any) => ({ id: n.id, type: n.type, title: n.title, isRead: n.isRead }))
        })

        const approvalInfoNotifications = allInfoNotifications
          .filter((n: any) => {
            // 检查多种审批相关的类型
            const approvalTypes = ['deployment_approval', 'approval', 'cicd_approval']
            const isApprovalType = approvalTypes.includes(n.type)
            const hasApprovalAction = n.metadata && n.metadata.action === 'approval_required'

            console.log(`🔍 [审批通知] 检查通知 ${n.id}:`, {
              type: n.type,
              isApprovalType,
              hasApprovalAction,
              metadata: n.metadata,
              willInclude: isApprovalType || hasApprovalAction
            })

            return isApprovalType || hasApprovalAction
          })
          .map((n: any) => ({
            ...n,
            // 转换为审批通知格式
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.content,
            data: n.metadata || {},
            createdAt: n.createdAt,
            canApprove: true // 设置为可审批
          }))

        console.log('🔍 [审批通知] 过滤结果:', {
          totalNotifications: allInfoNotifications.length,
          approvalNotifications: approvalInfoNotifications.length,
          approvalTypes: approvalInfoNotifications.map((n: any) => n.type),
          approvalTitles: approvalInfoNotifications.map((n: any) => n.title)
        })

        allApprovalNotifications = [...allApprovalNotifications, ...approvalInfoNotifications]
        totalUnreadCount += approvalInfoNotifications.length
      }

      // 去重（基于ID）
      const uniqueNotifications = allApprovalNotifications.filter((notification, index, self) =>
        index === self.findIndex(n => n.id === notification.id)
      )

      // 按时间排序
      uniqueNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setApprovalNotifications(uniqueNotifications.slice(0, 10)) // 限制显示数量
      setApprovalUnreadCount(totalUnreadCount)

    } catch (error) {
      console.error('获取审批通知失败:', error)
    }
  }

  // 获取所有通知 - 优化防抖
  const fetchAllNotifications = async (force = false) => {
    // 防止同时多次调用
    if (loading && !force) {
      console.log('🔔 [通知中心] 已在加载中，跳过重复请求')
      return
    }
    
    setLoading(true)
    try {
      await Promise.all([
        fetchInfoNotifications(force),
        fetchApprovalNotifications()
      ])
    } finally {
      setLoading(false)
    }
  }

  // 标记信息通知为已读
  const markInfoNotificationAsRead = async (notificationId: string) => {
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

      if (response.ok) {
        setInfoNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ).filter(n => !n.isRead)
        )
        setInfoUnreadCount(prev => Math.max(0, prev - 1))

        // 触发跨组件数据同步
        localStorage.setItem('notification_update', JSON.stringify({
          type: 'mark_read',
          notificationId,
          timestamp: new Date().toISOString()
        }))
        window.dispatchEvent(new Event('notificationUpdate'))
      }
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 处理审批操作
  const handleApprovalAction = async (notification: ApprovalNotification, action: 'approve' | 'reject', comment?: string) => {
    try {
      // 确定正确的通知ID格式
      let notificationId = notification.id

      // 如果通知的metadata中有特殊的notificationId，使用它
      if (notification.data?.notificationId) {
        notificationId = notification.data.notificationId
      }
      // 如果有approvalId，构造cicd_approval格式的ID
      else if (notification.data?.approvalId) {
        notificationId = `cicd_approval_${notification.data.approvalId}`
      }
      // 如果通知类型是部署审批相关，尝试构造格式
      else if (notification.type?.includes('deployment') || notification.type?.includes('approval')) {
        // 如果ID不是cicd_approval格式，尝试构造
        if (!notificationId.startsWith('cicd_approval_')) {
          notificationId = `cicd_approval_${notificationId}`
        }
      }

      console.log('🔍 [审批操作] 通知信息:', {
        originalId: notification.id,
        finalNotificationId: notificationId,
        notificationType: notification.type,
        metadata: notification.data
      })

      const response = await fetch('/api/notifications/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationId: notificationId,
          action,
          comment
        })
      })

      const data = await response.json()
      if (data.success) {
        message.success(`审批${action === 'approve' ? '通过' : '拒绝'}成功`)
        fetchApprovalNotifications() // 刷新审批通知
        fetchInfoNotifications() // 同时刷新信息通知

        // 触发跨组件数据同步
        localStorage.setItem('notification_update', JSON.stringify({
          type: 'approval_action',
          action,
          timestamp: new Date().toISOString()
        }))
        window.dispatchEvent(new Event('notificationUpdate'))
      } else {
        console.error('❌ 审批操作失败:', data)
        message.error(data.error || '审批操作失败')
      }
    } catch (error) {
      console.error('审批操作失败:', error)
      message.error('审批操作失败')
    }
  }

  // 处理信息通知查看
  const handleInfoNotificationView = (notification: InfoNotification) => {
    if (!notification.isRead) {
      markInfoNotificationAsRead(notification.id)
    }

    // 如果有特定的操作链接，跳转到该链接，否则跳转到通知管理页面
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    } else {
      window.location.href = '/notifications'
    }
  }

  // 处理信息通知忽略
  const handleInfoNotificationIgnore = async (notification: InfoNotification) => {
    try {
      // 标记为已读
      if (!notification.isRead) {
        await markInfoNotificationAsRead(notification.id)
      }

      // 从列表中移除
      setInfoNotifications(prev => prev.filter(n => n.id !== notification.id))
      setInfoUnreadCount(prev => Math.max(0, prev - 1))

      message.success('通知已忽略')
    } catch (error) {
      console.error('忽略通知失败:', error)
      message.error('操作失败')
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
      'user_registration': '👤',
      'cicd_approval': '🔄',
      'system_info': 'ℹ️',
      'system_warning': '⚠️',
      'system_error': '🚨'
    }
    return iconMap[type] || '📬'
  }

  // 建立实时通知连接 - 使用单例管理器
  useEffect(() => {
    if (!user) return

    // 减少日志噪音，只在开发环境输出详细日志
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 [统一通知中心] 初始化实时连接管理器')
    }
    
    const realtimeManager = RealtimeNotificationManager.getInstance()
    
    const removeListener = realtimeManager.addListener((data) => {
      if (data.type === 'connection_status') {
        setIsConnected(data.connected)
        return
      }

      if (data.type === 'connected') {
        if (process.env.NODE_ENV === 'development') {
          console.log('📡 [统一通知中心] 连接确认:', data.message)
        }
      } else if (data.type === 'heartbeat') {
        // 心跳消息，保持连接活跃，不输出日志
      } else if (data.type === 'info_notification') {
        if (process.env.NODE_ENV === 'development') {
          console.log('📬 [统一通知中心] 收到信息通知:', data.data.title)
        }
        setInfoNotifications(prev => [data.data, ...prev.slice(0, 9)])
        setInfoUnreadCount(prev => prev + 1)
      } else if (data.type === 'approval_update') {
        if (process.env.NODE_ENV === 'development') {
          console.log('📬 [统一通知中心] 收到审批更新通知，刷新审批数据')
        }
        fetchApprovalNotifications()
      } else if (data.type === 'deployment_status_update') {
        if (process.env.NODE_ENV === 'development') {
          console.log('📬 [统一通知中心] 收到部署状态更新:', data.data)
        }

        const statusNotification: InfoNotification = {
          id: `status-${Date.now()}`,
          type: 'deployment_status',
          title: `部署状态更新`,
          content: `部署任务状态已更新为: ${data.data.status}`,
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: { deploymentId: data.data.deploymentId, status: data.data.status }
        }

        setInfoNotifications(prev => [statusNotification, ...prev.slice(0, 9)])
        setInfoUnreadCount(prev => prev + 1)
        fetchApprovalNotifications()

        localStorage.setItem('deployment_status_update', JSON.stringify({
          deploymentId: data.data.deploymentId,
          status: data.data.status,
          timestamp: Date.now()
        }))

        window.dispatchEvent(new StorageEvent('storage', {
          key: 'deployment_status_update',
          newValue: JSON.stringify({
            deploymentId: data.data.deploymentId,
            status: data.data.status,
            timestamp: Date.now()
          })
        }))
      }
    })

    return () => {
      console.log('🔌 [统一通知中心] 移除监听器')
      removeListener()
    }
  }, [user])

  // 初始加载通知 - 仅在用户登录和下拉框打开时加载
  useEffect(() => {
    if (user && dropdownVisible) {
      fetchAllNotifications()
    }
  }, [user, dropdownVisible])

  // 添加点击时刷新通知数据
  const handleDropdownVisibleChange = (visible: boolean) => {
    setDropdownVisible(visible)
    if (visible) {
      // 仅在打开时强制刷新一次
      fetchAllNotifications(true)
    }
  }

  const totalUnreadCount = infoUnreadCount + approvalUnreadCount

  // 下拉菜单内容
  const dropdownContent = (
    <div style={{ width: 400, maxHeight: 500, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong>通知中心</Text>
      </div>
      
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        size="small"
        style={{ padding: '0 16px' }}
      >
        <TabPane 
          tab={
            <span>
              信息通知
              {infoUnreadCount > 0 && (
                <Badge count={infoUnreadCount} size="small" style={{ marginLeft: 8 }} />
              )}
            </span>
          } 
          key="info"
        >
          <div style={{ maxHeight: 300, overflowY: 'auto', margin: '0 -16px' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : infoNotifications.length === 0 ? (
              <Empty 
                description="暂无信息通知" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: 20 }}
              />
            ) : (
              <List
                dataSource={infoNotifications}
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
                        onClick={(e) => {
                          e.stopPropagation()
                          handleInfoNotificationView(notification)
                        }}
                      >
                        查看
                      </Button>,
                      <Button
                        key="ignore"
                        type="link"
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleInfoNotificationIgnore(notification)
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
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              审批通知
              {approvalUnreadCount > 0 && (
                <Badge count={approvalUnreadCount} size="small" style={{ marginLeft: 8 }} />
              )}
            </span>
          } 
          key="approval"
        >
          <div style={{ maxHeight: 300, overflowY: 'auto', margin: '0 -16px' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : approvalNotifications.length === 0 ? (
              <Empty 
                description="暂无审批通知" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: 20 }}
              />
            ) : (
              <List
                dataSource={approvalNotifications}
                renderItem={(notification) => (
                  <List.Item
                    style={{ 
                      padding: '12px 16px',
                      borderBottom: '1px solid #f5f5f5'
                    }}
                    actions={notification.canApprove ? [
                      <Button
                        key="approve"
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleApprovalAction(notification, 'approve')}
                      >
                        通过
                      </Button>,
                      <Button
                        key="reject"
                        danger
                        size="small"
                        icon={<CloseCircleOutlined />}
                        onClick={() => handleApprovalAction(notification, 'reject')}
                      >
                        拒绝
                      </Button>
                    ] : []}
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
                          {notification.message}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </TabPane>
      </Tabs>
      
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ padding: '8px 16px', textAlign: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <Button type="link" size="small" href="/notifications">
          查看全部通知
        </Button>
        <Button type="link" size="small" href="/cicd/approvals">
          查看审批管理
        </Button>
      </div>
    </div>
  )

  return (
    <Dropdown
      overlay={dropdownContent}
      trigger={['click']}
      placement="bottomRight"
      open={dropdownVisible}
      onOpenChange={handleDropdownVisibleChange}
    >
      <Badge count={totalUnreadCount} size="small">
        <BellOutlined
          className={`text-xl cursor-pointer transition-colors ${className}`}
          onClick={() => setDropdownVisible(!dropdownVisible)}
        />
      </Badge>
    </Dropdown>
  )
}

export default UnifiedNotificationBell
