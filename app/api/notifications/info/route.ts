import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { infoNotificationService } from '../../../../lib/notifications/infoNotificationService'

// GET /api/notifications/info - 获取用户的信息通知
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user
    
    const url = new URL(request.url)
    const includeRead = url.searchParams.get('includeRead') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const type = url.searchParams.get('type') || undefined

    console.log('📋 [Info Notifications API] 获取信息通知:', {
      userId: user.id,
      username: user.username,
      includeRead,
      limit,
      offset,
      type
    })

    const result = await infoNotificationService.getUserNotifications(user.id, {
      includeRead,
      limit: limit * 2, // 获取更多数据以便分类
      offset,
      type: undefined // 获取所有类型进行分类
    })

    console.log('📋 [Info Notifications API] 数据库查询结果:', {
      notificationCount: result.notifications.length,
      total: result.total,
      unreadCount: result.unreadCount,
      firstNotification: result.notifications[0] ? {
        id: result.notifications[0].id,
        type: result.notifications[0].type,
        title: result.notifications[0].title,
        isRead: result.notifications[0].isRead
      } : null,
      allNotificationTypes: result.notifications.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        isRead: n.isRead,
        userId: n.userId
      }))
    })

    // 分类通知
    const approvalNotifications: any[] = []
    const infoNotifications: any[] = []

    for (const notification of result.notifications) {
      // 检查是否是审批通知
      const metadata = notification.metadata as Record<string, any> || {}
      const isApprovalNotification =
        metadata.isApprovalNotification === true ||
        (notification.type && typeof notification.type === 'string' && notification.type.includes('approval')) ||
        notification.type === 'jenkins_approval' ||
        notification.type === 'cicd_approval' ||
        notification.type === 'user_approval'

      console.log(`🔍 [Info Notifications API] 分类通知 ${notification.id}:`, {
        type: notification.type,
        title: notification.title,
        isApprovalNotification,
        metadata: metadata,
        hasApprovalInType: notification.type && notification.type.includes('approval'),
        category: isApprovalNotification ? 'approval' : 'info'
      })

      if (isApprovalNotification) {
        approvalNotifications.push({
          ...notification,
          category: 'approval'
        })
      } else {
        infoNotifications.push({
          ...notification,
          category: 'info'
        })
      }
    }

    console.log('📋 [Info Notifications API] 分类结果:', {
      totalNotifications: result.notifications.length,
      approvalCount: approvalNotifications.length,
      infoCount: infoNotifications.length,
      approvalTypes: approvalNotifications.map(n => n.type),
      infoTypes: infoNotifications.map(n => n.type)
    })

    // 根据请求类型返回对应的通知
    let filteredNotifications: any[] = []
    if (type === 'approval') {
      filteredNotifications = approvalNotifications.slice(0, limit)
    } else if (type === 'info') {
      filteredNotifications = infoNotifications.slice(0, limit)
    } else {
      // 返回所有通知，但标记分类
      filteredNotifications = [...approvalNotifications, ...infoNotifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
    }

    console.log('📋 [Info Notifications API] 通知分类结果:', {
      approvalCount: approvalNotifications.length,
      infoCount: infoNotifications.length,
      filteredCount: filteredNotifications.length,
      requestType: type || 'all'
    })

    // 计算未读数量
    const unreadApprovalCount = approvalNotifications.filter((n: any) => !n.isRead).length
    const unreadInfoCount = infoNotifications.filter((n: any) => !n.isRead).length
    const totalUnreadCount = unreadApprovalCount + unreadInfoCount

    // 获取离线通知
    const offlineNotifications = await infoNotificationService.getOfflineNotifications(user.id)

    return NextResponse.json({
      success: true,
      data: {
        notifications: filteredNotifications,
        total: filteredNotifications.length,
        unreadCount: type === 'approval' ? unreadApprovalCount :
                    type === 'info' ? unreadInfoCount :
                    totalUnreadCount,
        unreadApprovalCount, // 添加审批通知未读数量
        unreadInfoCount,     // 添加信息通知未读数量
        offlineNotifications,
        counts: {
          approval: {
            total: approvalNotifications.length,
            unread: unreadApprovalCount
          },
          info: {
            total: infoNotifications.length,
            unread: unreadInfoCount
          },
          all: {
            total: approvalNotifications.length + infoNotifications.length,
            unread: totalUnreadCount
          }
        },
        pagination: {
          limit,
          offset,
          total: filteredNotifications.length,
          hasMore: filteredNotifications.length === limit
        }
      }
    })

  } catch (error: any) {
    console.error('❌ [Info Notifications API] 获取信息通知失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '获取信息通知失败'
    }, { status: 500 })
  }
}

// POST /api/notifications/info - 创建信息通知（管理员功能）
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限：只有管理员可以创建信息通知
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '您没有权限创建信息通知'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      type,
      title,
      content,
      userIds = [],
      actionUrl,
      actionText,
      metadata = {},
      expiresAt
    } = body

    if (!type || !title || !content || !userIds.length) {
      return NextResponse.json({
        success: false,
        error: '通知类型、标题、内容和接收人不能为空'
      }, { status: 400 })
    }

    console.log('📬 [Info Notifications API] 创建信息通知:', {
      type,
      title,
      userCount: userIds.length,
      createdBy: user.id
    })

    const notifications = userIds.map((userId: string) => ({
      type,
      title,
      content,
      userId,
      actionUrl,
      actionText,
      metadata: {
        ...metadata,
        createdBy: user.id,
        createdByName: user.realName || user.username
      },
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    }))

    const notificationIds = await infoNotificationService.createBatchNotifications(notifications)

    return NextResponse.json({
      success: true,
      data: {
        notificationIds,
        count: notificationIds.length,
        message: `成功创建 ${notificationIds.length} 条信息通知`
      }
    })

  } catch (error: any) {
    console.error('❌ [Info Notifications API] 创建信息通知失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '创建信息通知失败'
    }, { status: 500 })
  }
}

// PATCH /api/notifications/info - 批量操作信息通知
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const body = await request.json()
    const { action, notificationIds = [] } = body

    if (!action || !['markAsRead', 'markAllAsRead', 'delete'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: '无效的操作类型'
      }, { status: 400 })
    }

    console.log('🔄 [Info Notifications API] 批量操作信息通知:', {
      action,
      notificationCount: notificationIds.length,
      userId: user.id
    })

    let result: any = { count: 0 }

    switch (action) {
      case 'markAsRead':
        if (!notificationIds.length) {
          return NextResponse.json({
            success: false,
            error: '请选择要标记的通知'
          }, { status: 400 })
        }
        
        for (const notificationId of notificationIds) {
          const success = await infoNotificationService.markAsRead(user.id, notificationId)
          if (success) result.count++
        }
        break

      case 'markAllAsRead':
        result.count = await infoNotificationService.markAllAsRead(user.id)
        break

      case 'delete':
        if (!notificationIds.length) {
          return NextResponse.json({
            success: false,
            error: '请选择要删除的通知'
          }, { status: 400 })
        }
        
        for (const notificationId of notificationIds) {
          const success = await infoNotificationService.deleteNotification(user.id, notificationId)
          if (success) result.count++
        }
        break
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        count: result.count,
        message: `成功${action === 'markAsRead' ? '标记已读' : action === 'markAllAsRead' ? '全部标记已读' : '删除'} ${result.count} 条通知`
      }
    })

  } catch (error: any) {
    console.error('❌ [Info Notifications API] 批量操作信息通知失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '批量操作失败'
    }, { status: 500 })
  }
}
