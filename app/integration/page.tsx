'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd'
import { AlertOutlined, ApiOutlined, BranchesOutlined, CloudServerOutlined, DashboardOutlined, FileSearchOutlined, ReloadOutlined } from '@ant-design/icons'
import Link from 'next/link'
import MainLayout from '../components/layout/MainLayout'

const { Title, Paragraph, Text } = Typography

type ConnectorKey = 'elk' | 'grafana' | 'git' | 'jenkins' | 'alerts' | 'artifacts'
interface ConnectorData { count: number; items: Array<Record<string, any>> }

const connectorMeta: Record<ConnectorKey, { title: string; description: string; href: string; icon: React.ReactNode }> = {
  elk: { title: '日志接入', description: 'Elasticsearch 与 Kibana 日志源', href: '/servers/logs', icon: <FileSearchOutlined /> },
  grafana: { title: '监控接入', description: 'Grafana 监控与仪表板', href: '/monitor', icon: <DashboardOutlined /> },
  git: { title: '代码接入', description: 'Git 仓库访问凭据', href: '/integration/git', icon: <BranchesOutlined /> },
  jenkins: { title: '任务接入', description: 'Jenkins 服务与任务连接', href: '/integration/jenkins', icon: <ApiOutlined /> },
  alerts: { title: '告警接入', description: 'Alertmanager 与通用 Webhook', href: '/integration/alerts', icon: <AlertOutlined /> },
  artifacts: { title: '制品管理', description: 'Harbor 与 Docker Registry', href: '/integration/artifacts', icon: <CloudServerOutlined /> }
}

export default function IntegrationOverviewPage() {
  const [connectors, setConnectors] = useState<Record<ConnectorKey, ConnectorData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/integration/overview', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '加载失败')
      setConnectors(result.data.connectors)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title level={2} className="!mb-1">接入总览</Title>
            <Paragraph type="secondary" className="!mb-0">集中查看外部日志、监控、代码仓库和任务平台的真实配置状态</Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新状态</Button>
        </div>
        {error && <Alert type="error" showIcon message="接入状态加载失败" description={error} />}
        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
          <Row gutter={[16, 16]}>
            {(Object.keys(connectorMeta) as ConnectorKey[]).map(key => {
              const meta = connectorMeta[key]
              const data = connectors?.[key] || { count: 0, items: [] }
              return (
                <Col xs={24} md={12} key={key}>
                  <Card title={<Space>{meta.icon}{meta.title}</Space>} extra={<Link href={meta.href}>进入管理</Link>} className="h-full">
                    <Statistic title={meta.description} value={data.count} suffix="项有效配置" />
                    <div className="mt-4 space-y-2">
                      {data.items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未配置" /> : data.items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
                          <Text ellipsis className="max-w-[70%]">{item.name}</Text>
                          {key === 'jenkins'
                            ? <Tag color={item.testStatus === 'connected' ? 'green' : 'default'}>{item.testStatus === 'connected' ? '已验证' : '待验证'}</Tag>
                            : key === 'artifacts'
                              ? <Tag color={item.status === 'online' ? 'green' : item.status === 'error' ? 'red' : 'default'}>{item.status === 'online' ? '在线' : item.status === 'error' ? '异常' : '待验证'}</Tag>
                              : key === 'alerts'
                                ? <Tag color={item.lastReceivedAt ? 'green' : 'default'}>{item.lastReceivedAt ? '已有数据' : '等待数据'}</Tag>
                                : key === 'git' && item.isDefault ? <Tag color="gold">默认</Tag> : <Tag color="blue">已启用</Tag>}
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        </Skeleton>
      </div>
    </MainLayout>
  )
}
