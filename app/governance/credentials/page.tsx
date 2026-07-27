'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Alert, Button, Card, Col, Progress, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { KeyOutlined, LockOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'

const { Title, Text } = Typography

type Category = {
  key: string
  label: string
  route: string
  total: number
  protectedCount: number
  legacyCount: number
  missingCount: number
  staleCount: number
  lastUpdatedAt?: string
}

export default function CredentialsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [summary, setSummary] = useState({ total: 0, protected: 0, legacy: 0, stale: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/governance/credentials', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '加载凭据清单失败')
      setCategories(payload.data.categories || [])
      setSummary(payload.data.summary)
    } catch (error) { message.error(error instanceof Error ? error.message : '加载凭据清单失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  const coverage = summary.total ? Math.round(summary.protected / summary.total * 100) : 100

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div><Title level={2} className="!mb-1">凭据治理</Title><Text type="secondary">跨主机、网络、模型、监控与交付接入的脱敏安全清单。</Text></div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}><Card><Statistic title="凭据记录" value={summary.total} prefix={<KeyOutlined />} /></Card></Col>
          <Col xs={24} md={6}><Card><Statistic title="当前加密" value={summary.protected} prefix={<LockOutlined />} valueStyle={{ color: '#22c55e' }} /></Card></Col>
          <Col xs={24} md={6}><Card><Statistic title="历史格式" value={summary.legacy} prefix={<WarningOutlined />} valueStyle={{ color: summary.legacy ? '#f59e0b' : undefined }} /></Card></Col>
          <Col xs={24} md={6}><Card><Statistic title="待确认轮换" value={summary.stale} valueStyle={{ color: summary.stale ? '#f59e0b' : undefined }} /></Card></Col>
        </Row>
        <Alert type="info" showIcon message="清单不读取或展示明文" description="“当前加密”表示使用 AES-256-GCM 格式保存；“历史格式”可能是兼容密文或历史明文，需要在对应接入页面重新保存完成迁移。超过 180 天未更新只作为轮换提醒，不代表凭据已经失效。" />
        <Card title="加密覆盖率" extra={<Tag color={coverage === 100 ? 'green' : 'orange'}>{coverage}%</Tag>}><Progress percent={coverage} status={coverage === 100 ? 'success' : 'normal'} /></Card>
        <Card title="凭据分类">
          <Table rowKey="key" loading={loading} dataSource={categories} pagination={false} scroll={{ x: 900 }} columns={[
            { title: '凭据类型', dataIndex: 'label', key: 'label', render: (value: string) => <Space><SafetyCertificateOutlined className="text-blue-500" /><b>{value}</b></Space> },
            { title: '记录数', dataIndex: 'total', key: 'total', width: 90 },
            { title: '当前加密', dataIndex: 'protectedCount', key: 'protectedCount', width: 110, render: (value: number) => <Tag color="green">{value}</Tag> },
            { title: '历史格式', dataIndex: 'legacyCount', key: 'legacyCount', width: 110, render: (value: number) => <Tag color={value ? 'orange' : 'default'}>{value}</Tag> },
            { title: '未配置', dataIndex: 'missingCount', key: 'missingCount', width: 90 },
            { title: '超 180 天', dataIndex: 'staleCount', key: 'staleCount', width: 110, render: (value: number) => value ? <Tag color="orange">{value}</Tag> : '-' },
            { title: '最近更新', dataIndex: 'lastUpdatedAt', key: 'lastUpdatedAt', render: (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
            { title: '治理入口', key: 'action', fixed: 'right', width: 110, render: (_: unknown, item: Category) => <Link href={item.route}><Button type="link">前往管理</Button></Link> }
          ]} />
        </Card>
      </div>
    </MainLayout>
  )
}
