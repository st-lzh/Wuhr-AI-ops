'use client'

import React from 'react'
import { Alert, Button, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

export default function NetworkPageHeader({ title, description, onRefresh, loading, action }: { title: string; description: string; onRefresh?: () => void; loading?: boolean; action?: React.ReactNode }) {
  return <div className="mb-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Typography.Title level={2} style={{ marginBottom: 4 }}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text></div>
      <Space>{onRefresh && <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>刷新数据</Button>}{action}</Space>
    </div>
    <Alert className="mt-4" type="info" showIcon message="真实执行说明" description="设备、快照、审批、命令输出与告警均由远端 v1 后端持久化；页面不会用本地模拟数据冒充成功。" />
  </div>
}
