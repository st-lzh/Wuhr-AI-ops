'use client'

import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Modal, Input, Typography, Row, Col, Statistic, Badge, Descriptions, Alert, Spin } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined, ClockCircleOutlined, ProjectOutlined, UserOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { ApprovalWithRelations, ApprovalStats, getApprovalStatusDisplay } from '../../types/approval'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function ApprovalsPage() {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [approvals, setApprovals] = useState<ApprovalWithRelations[]>([])
  const [userApprovals, setUserApprovals] = useState<any[]>([])
  const [stats, setStats] = useState<ApprovalStats | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'my' | 'users'>('pending')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalWithRelations | null>(null)
  const [actionModalVisible, setActionModalVisible] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // 检查是否为管理员
  const isAdmin = user?.role === 'admin'






  // 权限检查
  const canRead = hasPermission('cicd:read')
  const canWrite = hasPermission('cicd:write')

  // 加载统计数据
  const loadStats = async () => {
    try {
      console.log('📊 [审批管理页面] 开始加载统计数据...')
      const response = await fetch('/api/cicd/approvals/stats')
      const data = await response.json()

      console.log('📊 [审批管理页面] API响应:', {
        success: data.success,
        dataKeys: data.data ? Object.keys(data.data) : [],
        pendingApprovals: data.data?.pendingApprovals,
        totalApprovals: data.data?.totalApprovals
      })

      if (data.success) {
        const statsData = {
          totalApprovals: data.data.totalApprovals || 0,
          pendingApprovals: data.data.pendingApprovals || 0,
          approvedToday: data.data.todayApproved || 0,
          rejectedToday: data.data.todayRejected || 0,
          myPendingApprovals: data.data.myPendingApprovals || 0,
          averageApprovalTime: data.data.averageApprovalTime || 0,
          // 新增统计数据
          todayTotal: data.data.todayTotal || 0,
          weeklyTotal: data.data.weeklyTotal || 0,
          monthlyTotal: data.data.monthlyTotal || 0,
          myTodayProcessed: data.data.myTodayProcessed || 0,
          myWeeklyProcessed: data.data.myWeeklyProcessed || 0,
          recentApprovals: data.data.recentApprovals || []
        }

        console.log('📊 [审批管理页面] 设置统计数据:', statsData)
        setStats(statsData)
      } else {
        console.error('📊 [审批管理页面] API返回失败:', data.error)
        message.error(data.error || '加载统计数据失败')
      }
    } catch (error) {
      console.error('📊 [审批管理页面] 加载统计数据失败:', error)
      message.error('加载统计数据失败')
    }
  }

  // 加载审批数据
  const loadData = async () => {
    if (!canRead) return

    setLoading(true)
    try {
      // 并行加载统计数据和审批数据
      await Promise.all([
        loadStats(),
        loadApprovals()
      ])
    } catch (error) {
      console.error('加载数据失败:', error)
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载审批列表
  const loadApprovals = async () => {
    try {
      if (activeTab === 'users') {
        // 用户审批记录：从审批记录API获取
        const params = new URLSearchParams({
          approvalType: 'user_registration',
          page: currentPage.toString(),
          pageSize: '20'
        })

        const response = await fetch(`/api/approval-records?${params}`)
        if (response.ok) {
          const data = await response.json()
          setUserApprovals(data.data.records || [])
          setTotal(data.data.total || 0)
        } else {
          console.error('获取用户审批记录失败')
          setUserApprovals([])
        }
        return
      }

      let params: URLSearchParams

      if (activeTab === 'pending') {
        // 待审批任务：只显示当前用户需要审批的待处理任务
        params = new URLSearchParams({
          status: 'pending',
          page: currentPage.toString(),
          pageSize: '20',
          type: 'all'
        })
      } else if (activeTab === 'my') {
        // 我的审批：显示当前用户已处理的审批记录
        params = new URLSearchParams({
          status: 'processed', // 新增状态：已处理（包括approved和rejected）
          page: currentPage.toString(),
          pageSize: '20',
          type: 'all'
        })
      } else {
        // 全部审批：显示所有审批记录（仅管理员可见）
        params = new URLSearchParams({
          status: 'all',
          page: currentPage.toString(),
          pageSize: '20',
          type: 'all'
        })
      }

      const response = await fetch(`/api/cicd/approvals?${params}`)
      const data = await response.json()

      if (data.success) {
        setApprovals(data.data.approvals || [])
        setTotal(data.data.pagination.total || 0)
        console.log(`✅ 审批数据加载成功 (${activeTab}):`, {
          count: data.data.approvals?.length || 0,
          total: data.data.pagination.total || 0
        })
      } else {
        console.error('❌ 审批数据加载失败:', data.error)
        message.error(data.error || '加载审批数据失败')
      }
    } catch (error) {
      console.error('❌ 加载审批数据异常:', error)
      message.error('加载审批数据失败')
    }
  }



  // 处理审批操作
  const handleApprovalAction = async () => {
    if (!selectedApproval || !canWrite) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/cicd/approvals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approvalId: selectedApproval.id,
          action: actionType,
          comments: comment.trim() || undefined,
          type: (selectedApproval as any).type || 'deployment'
        })
      })

      const data = await response.json()

      if (data.success) {
        message.success(`审批${actionType === 'approve' ? '通过' : '拒绝'}成功`)
        setActionModalVisible(false)
        setComment('')
        setSelectedApproval(null)

        // 触发跨组件数据同步
        localStorage.setItem('notification_update', JSON.stringify({
          type: 'approval_action',
          action: actionType,
          approvalId: selectedApproval.id,
          timestamp: new Date().toISOString()
        }))
        window.dispatchEvent(new Event('approvalUpdate'))
        window.dispatchEvent(new Event('notificationUpdate'))

        // 重新加载数据
        loadData()

        // 触发统计数据刷新
        setTimeout(() => {
          loadData()
        }, 500) // 延迟500ms确保数据库更新完成
      } else {
        message.error(data.error || '审批操作失败')
      }
    } catch (error: any) {
      console.error('❌ 审批操作失败:', error)
      message.error('审批操作失败')
    } finally {
      setActionLoading(false)
    }
  }







  // 获取用户审批记录表格列配置
  const getUserApprovalColumns = () => [
    {
      title: '用户信息',
      key: 'targetName',
      render: (record: any) => (
        <div>
          <div className="font-medium">{record.targetName}</div>
          <div className="text-sm text-gray-500">ID: {record.targetId}</div>
        </div>
      )
    },
    {
      title: '审批操作',
      key: 'action',
      render: (record: any) => (
        <Tag color={record.action === 'approved' ? 'green' : 'red'}>
          {record.action === 'approved' ? '通过' : '拒绝'}
        </Tag>
      )
    },
    {
      title: '审批人',
      key: 'operator',
      render: (record: any) => (
        <div>
          <div className="font-medium">{record.operatorName}</div>
          <div className="text-sm text-gray-500">{record.operator?.email}</div>
        </div>
      )
    },
    {
      title: '审批时间',
      key: 'operatedAt',
      render: (record: any) => (
        <div className="text-sm">
          {new Date(record.operatedAt).toLocaleString()}
        </div>
      )
    },
    {
      title: '备注',
      key: 'comment',
      render: (record: any) => (
        <div className="text-sm text-gray-600">
          {record.comment || '-'}
        </div>
      )
    }
  ]

  // 动态表格列定义
  const getColumns = () => {
    const baseColumns = [
    {
      title: '任务名称',
      key: 'deployment',
      render: (record: ApprovalWithRelations) => {
        if (record.type === 'user_registration') {
          return (
            <div>
              <div style={{ fontWeight: 500 }}>用户注册审批</div>
              <div style={{ color: '#666', fontSize: '12px' }}>
                <UserOutlined /> {record.registration?.username} ({record.registration?.email})
              </div>
            </div>
          )
        }
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{record.deployment?.name || '未知任务'}</div>
            <div style={{ color: '#666', fontSize: '12px' }}>
              <ProjectOutlined /> {record.deployment?.project?.name || '未知项目'}
            </div>
          </div>
        )
      }
    },
    {
      title: '环境/类型',
      key: 'environment',
      render: (record: ApprovalWithRelations) => {
        if (record.type === 'user_registration') {
          return <Tag color="purple">用户注册</Tag>
        }
        const environment = record.deployment?.environment
        const colors = {
          prod: 'red',
          staging: 'orange',
          test: 'blue',
          dev: 'green'
        }
        return <Tag color={colors[environment as keyof typeof colors] || 'default'}>{environment || '未知'}</Tag>
      }
    },
    {
      title: '申请人',
      key: 'creator',
      render: (record: ApprovalWithRelations) => {
        if (record.type === 'user_registration') {
          return (
            <div>
              <UserOutlined /> {record.registration?.realName || record.registration?.username}
              <div style={{ color: '#666', fontSize: '12px' }}>
                {record.registration?.email}
              </div>
            </div>
          )
        }
        return (
          <div>
            <UserOutlined /> {record.deployment?.creator?.username || '未知用户'}
          </div>
        )
      }
    },
    {
      title: '审批人',
      key: 'approver',
      render: (record: ApprovalWithRelations) => {
        if (record.type === 'user_registration') {
          return (
            <div>
              <UserOutlined /> {record.approver?.username || '待分配'}
              <div style={{ color: '#666', fontSize: '12px' }}>
                管理员
              </div>
            </div>
          )
        }
        return (
          <div>
            <UserOutlined /> {record.approver?.username || '未知'}
            <div style={{ color: '#666', fontSize: '12px' }}>
              {record.approver?.role || '未知'}
            </div>
          </div>
        )
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = getApprovalStatusDisplay(status as any)
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      }
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: ApprovalWithRelations) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedApproval(record)
              setDetailModalVisible(true)
            }}
          >
            详情
          </Button>
          {record.status === 'pending' && canWrite && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => {
                  setSelectedApproval(record)
                  setActionType('approve')
                  setActionModalVisible(true)
                }}
              >
                同意
              </Button>
              <Button
                type="primary"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setSelectedApproval(record)
                  setActionType('reject')
                  setActionModalVisible(true)
                }}
              >
                驳回
              </Button>
            </>
          )}
        </Space>
      )
    }
    ]

    // 根据标签页返回不同的列配置
    if (activeTab === 'my') {
      // 我的审批记录：显示审批结果和审批时间，不显示操作按钮
      return baseColumns.slice(0, -1).concat([
        {
          title: '审批结果',
          key: 'result',
          render: (record: ApprovalWithRelations) => (
            <div>
              <Tag color={record.status === 'approved' ? 'green' : record.status === 'rejected' ? 'red' : 'orange'}>
                {record.status === 'approved' ? '已通过' : record.status === 'rejected' ? '已拒绝' : '待审批'}
              </Tag>
              {record.comment && (
                <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                  备注：{record.comment}
                </div>
              )}
            </div>
          )
        },
        {
          title: '审批时间',
          key: 'approvedAt',
          render: (record: ApprovalWithRelations) => (
            <span>{record.approvedAt ? new Date(record.approvedAt).toLocaleString() : '-'}</span>
          )
        },
        {
          title: '操作',
          key: 'actions',
          render: (record: ApprovalWithRelations) => (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedApproval(record)
                setDetailModalVisible(true)
              }}
            >
              详情
            </Button>
          )
        }
      ])
    }

    // 待审批任务和全部审批：显示完整的操作按钮
    return baseColumns
  }

  useEffect(() => {
    loadData()
  }, [activeTab, currentPage, canRead])

  // 实时同步机制 - 监听审批状态更新
  useEffect(() => {
    if (!user || !canRead) return

    // 监听localStorage变化，实现跨组件数据同步
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'notification_update' || e.key === 'deployment_status_update') {
        console.log('🔄 [审批管理页面] 收到数据更新，刷新审批列表')
        loadData()
        // 清除通知标记
        localStorage.removeItem('notification_update')
        localStorage.removeItem('deployment_status_update')
      }
    }

    // 监听自定义事件，实现同页面组件间同步
    const handleApprovalUpdate = () => {
      console.log('🔄 [审批管理页面] 收到审批更新事件，刷新数据')
      loadData()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('approvalUpdate', handleApprovalUpdate)

    // 定期刷新数据（每30秒）
    const refreshInterval = setInterval(() => {
      loadData()
    }, 30000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('approvalUpdate', handleApprovalUpdate)
      clearInterval(refreshInterval)
    }
  }, [user, canRead, activeTab, currentPage])

  if (!canRead) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert
            message="访问受限"
            description="您没有权限访问审批管理功能。"
            type="warning"
            showIcon
          />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <ClockCircleOutlined className="mr-2" />
            审批管理
          </Title>
          <Paragraph className="text-gray-600 mb-0">
            管理部署审批流程，查看待审批任务和审批历史
          </Paragraph>
        </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title="待审批任务"
              value={stats?.pendingApprovals || 0}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
              loading={!stats}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title="我的待审批"
              value={stats?.myPendingApprovals || 0}
              prefix={<Badge count={stats?.myPendingApprovals || 0} />}
              valueStyle={{ color: '#1890ff' }}
              loading={!stats}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title="今日已处理"
              value={stats?.todayTotal || ((stats?.approvedToday || 0) + (stats?.rejectedToday || 0))}
              suffix={`(通过${stats?.approvedToday || 0}/拒绝${stats?.rejectedToday || 0})`}
              valueStyle={{ color: '#52c41a' }}
              loading={!stats}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title="平均审批时间"
              value={stats?.averageApprovalTime || 0}
              suffix="小时"
              precision={1}
              valueStyle={{ color: '#722ed1' }}
              loading={!stats}
            />
          </Card>
        </Col>
      </Row>

      {/* 详细统计 */}
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={8}>
          <Card className="glass-card" title="我的处理统计">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="今日处理"
                  value={stats?.myTodayProcessed || 0}
                  valueStyle={{ color: '#1890ff' }}
                  loading={!stats}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="本周处理"
                  value={stats?.myWeeklyProcessed || 0}
                  valueStyle={{ color: '#52c41a' }}
                  loading={!stats}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="glass-card" title="系统处理统计">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="本周处理"
                  value={stats?.weeklyTotal || 0}
                  valueStyle={{ color: '#722ed1' }}
                  loading={!stats}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="本月处理"
                  value={stats?.monthlyTotal || 0}
                  valueStyle={{ color: '#fa8c16' }}
                  loading={!stats}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="glass-card" title="今日活动">
            {!stats ? (
              <Spin size="small" />
            ) : stats.recentApprovals && stats.recentApprovals.length > 0 ? (
              <div className="space-y-2 max-h-20 overflow-y-auto">
                {stats.recentApprovals.slice(0, 3).map((approval, index) => (
                  <div key={index} className="text-sm">
                    <Tag
                      color={approval.status === 'approved' ? 'green' : 'red'}
                    >
                      {approval.status === 'approved' ? '通过' : '拒绝'}
                    </Tag>
                    <span className="text-gray-600">
                      {approval.projectName} - {approval.deploymentName}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">今日暂无审批活动</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 标签页 */}
      <Card className="glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              type={activeTab === 'pending' ? 'primary' : 'default'}
              onClick={() => {
                setActiveTab('pending')
                setCurrentPage(1)
              }}
            >
              待审批任务
            </Button>
            <Button
              type={activeTab === 'my' ? 'primary' : 'default'}
              onClick={() => {
                setActiveTab('my')
                setCurrentPage(1)
              }}
            >
              我的审批记录
            </Button>
            {/* 只有管理员才能看到全部审批 */}
            {isAdmin && (
              <Button
                type={activeTab === 'all' ? 'primary' : 'default'}
                onClick={() => {
                  setActiveTab('all')
                  setCurrentPage(1)
                }}
              >
                全部审批
              </Button>
            )}
            {/* 用户审批记录 */}
            <Button
              type={activeTab === 'users' ? 'primary' : 'default'}
              onClick={() => {
                setActiveTab('users')
                setCurrentPage(1)
              }}
            >
              用户审批
            </Button>

          </Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        {/* 标签页说明 */}
        <div style={{ marginBottom: '16px' }}>
          {activeTab === 'pending' && (
            <Alert
              message="待审批任务"
              description="显示需要您审批的待处理任务，包括部署审批和Jenkins任务审批。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
          {activeTab === 'my' && (
            <Alert
              message="我的审批记录"
              description="显示您已经处理过的审批记录，包括已通过和已拒绝的审批。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
          {activeTab === 'all' && isAdmin && (
            <Alert
              message="全部审批"
              description="显示系统中所有的审批记录，包括待处理和已处理的审批（仅管理员可见）。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
        </div>

        {/* 根据标签页显示不同内容 */}
        {activeTab === 'users' ? (
          <Table
            columns={getUserApprovalColumns()}
            dataSource={userApprovals}
            rowKey="id"
            loading={loading}
            pagination={{
              current: currentPage,
              total,
              pageSize: 20,
              onChange: setCurrentPage,
              showSizeChanger: false,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} 条`
            }}
          />
        ) : (
          <Table
            columns={getColumns()}
            dataSource={approvals}
            rowKey="id"
            loading={loading}
            pagination={activeTab !== 'pending' ? {
              current: currentPage,
              total,
              pageSize: 10,
              onChange: setCurrentPage,
              showSizeChanger: false,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} 条`
            } : false}
          />
        )}







      </Card>

      {/* 详情模态框 */}
      <Modal
        title="审批详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setSelectedApproval(null)
        }}
        footer={null}
        width={800}
      >
        {selectedApproval && (
          <Descriptions column={2} bordered>
            {selectedApproval.type === 'user_registration' ? (
              <>
                <Descriptions.Item label="审批类型" span={2}>
                  用户注册审批
                </Descriptions.Item>
                <Descriptions.Item label="用户名">
                  {selectedApproval.registration?.username}
                </Descriptions.Item>
                <Descriptions.Item label="邮箱">
                  {selectedApproval.registration?.email}
                </Descriptions.Item>
                <Descriptions.Item label="真实姓名">
                  {selectedApproval.registration?.realName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="申请原因" span={2}>
                  {selectedApproval.registration?.reason || '-'}
                </Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label="部署任务" span={2}>
                  {selectedApproval.deployment?.name || '未知任务'}
                </Descriptions.Item>
                <Descriptions.Item label="项目">
                  {selectedApproval.deployment?.project?.name || '未知项目'}
                </Descriptions.Item>
                <Descriptions.Item label="环境">
                  <Tag color={
                    selectedApproval.deployment?.environment === 'prod' ? 'red' :
                    selectedApproval.deployment?.environment === 'staging' ? 'orange' :
                    selectedApproval.deployment?.environment === 'test' ? 'blue' : 'green'
                  }>
                    {selectedApproval.deployment?.environment || '未知'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="申请人">
                  {selectedApproval.deployment?.creator?.username || '未知用户'}
                </Descriptions.Item>
                <Descriptions.Item label="部署描述" span={2}>
                  {selectedApproval.deployment?.description || '-'}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="审批人">
              {selectedApproval.approver?.username || '待分配'} ({selectedApproval.approver?.role || '未知'})
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const statusInfo = getApprovalStatusDisplay(selectedApproval.status)
                return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {new Date(selectedApproval.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="处理时间">
              {selectedApproval.approvedAt ? new Date(selectedApproval.approvedAt).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审批意见" span={2}>
              {selectedApproval.comment || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 审批操作模态框 */}
      <Modal
        title={actionType === 'approve' ? '批准审批' : '拒绝审批'}
        open={actionModalVisible}
        onOk={handleApprovalAction}
        onCancel={() => {
          setActionModalVisible(false)
          setComment('')
          setSelectedApproval(null)
        }}
        confirmLoading={actionLoading}
        okText={actionType === 'approve' ? '批准' : '拒绝'}
        okButtonProps={{ 
          danger: actionType === 'reject',
          style: actionType === 'approve' ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : undefined
        }}
      >
        {selectedApproval && (
          <div>
            <Paragraph>
              您确定要<Text strong>{actionType === 'approve' ? '批准' : '拒绝'}</Text>以下审批吗？
            </Paragraph>
            <Card size="small" style={{ marginBottom: '16px' }}>
              {selectedApproval.type === 'user_registration' ? (
                <>
                  <Text strong>审批类型：</Text>用户注册审批<br />
                  <Text strong>用户名：</Text>{selectedApproval.registration?.username}<br />
                  <Text strong>邮箱：</Text>{selectedApproval.registration?.email}<br />
                  <Text strong>真实姓名：</Text>{selectedApproval.registration?.realName || '-'}
                </>
              ) : (
                <>
                  <Text strong>部署任务：</Text>{selectedApproval.deployment?.name || '未知任务'}<br />
                  <Text strong>项目：</Text>{selectedApproval.deployment?.project?.name || '未知项目'}<br />
                  <Text strong>环境：</Text>{selectedApproval.deployment?.environment || '未知'}<br />
                  <Text strong>申请人：</Text>{selectedApproval.deployment?.creator?.username || '未知用户'}
                </>
              )}
            </Card>
            <div>
              <Text strong>审批意见：</Text>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`请输入${actionType === 'approve' ? '批准' : '拒绝'}原因（可选）`}
                rows={3}
                style={{ marginTop: '8px' }}
              />
            </div>
          </div>
        )}
      </Modal>
      </div>
    </MainLayout>
  )
}
