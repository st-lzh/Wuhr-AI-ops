import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers-new'
import ApprovalRecordService from '../../services/approvalRecordService'

// 获取审批记录
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user
    const { searchParams } = new URL(request.url)

    // 检查权限
    if (user.role !== 'admin' && !user.permissions.includes('admin:users') && !user.permissions.includes('cicd:read')) {
      return NextResponse.json({
        success: false,
        error: '权限不足',
        details: '您没有查看审批记录的权限'
      }, { status: 403 })
    }

    // 解析查询参数
    const approvalTypeParam = searchParams.get('approvalType')
    const actionParam = searchParams.get('action')

    const query = {
      approvalType: approvalTypeParam as any || undefined,
      targetId: searchParams.get('targetId') || undefined,
      operatorId: searchParams.get('operatorId') || undefined,
      action: actionParam as any || undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20')
    }

    // 如果不是管理员，只能查看自己的审批记录
    if (user.role !== 'admin' && !user.permissions.includes('admin:users')) {
      query.operatorId = user.id
    }

    const result = await ApprovalRecordService.getRecords(query)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('❌ 获取审批记录失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取审批记录失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

// 获取审批统计信息
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user
    const body = await request.json()
    const { action } = body

    // 检查权限
    if (user.role !== 'admin' && !user.permissions.includes('admin:users') && !user.permissions.includes('cicd:read')) {
      return NextResponse.json({
        success: false,
        error: '权限不足',
        details: '您没有查看审批统计的权限'
      }, { status: 403 })
    }

    if (action === 'statistics') {
      // 如果不是管理员，只能查看自己的统计
      const operatorId = user.role === 'admin' || user.permissions.includes('admin:users') ? undefined : user.id
      const stats = await ApprovalRecordService.getStatistics(operatorId)

      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    if (action === 'recent-activities') {
      const activities = await ApprovalRecordService.getRecentActivities(10)

      return NextResponse.json({
        success: true,
        data: activities
      })
    }

    return NextResponse.json({
      success: false,
      error: '无效的操作',
      details: '不支持的操作类型'
    }, { status: 400 })

  } catch (error) {
    console.error('❌ 处理审批记录请求失败:', error)
    return NextResponse.json({
      success: false,
      error: '处理请求失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
