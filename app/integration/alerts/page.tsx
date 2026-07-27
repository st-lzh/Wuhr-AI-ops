'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Empty, Form, Input, List, Modal, Row, Select, Space, Statistic, Switch, Tag, Typography, message } from 'antd'
import { ApiOutlined, CopyOutlined, DeleteOutlined, KeyOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'

const { Title, Text, Paragraph } = Typography

type AlertSource = {
  id: string
  name: string
  sourceType: 'alertmanager' | 'generic_webhook'
  enabled: boolean
  lastReceivedAt?: string
  lastError?: string
  createdAt: string
}

export default function AlertSourcesPage() {
  const [sources, setSources] = useState<AlertSource[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [issued, setIssued] = useState<{ id: string; name: string; token: string; sourceType: string } | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/integration/alert-sources', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '加载告警源失败')
      setSources(payload.data || [])
    } catch (error) { message.error(error instanceof Error ? error.message : '加载告警源失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => ({
    total: sources.length,
    enabled: sources.filter(item => item.enabled).length,
    received: sources.filter(item => item.lastReceivedAt).length
  }), [sources])

  const create = async () => {
    try {
      const values = await form.validateFields()
      const response = await fetch('/api/integration/alert-sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '创建失败')
      setOpen(false)
      setIssued(payload.data)
      form.resetFields()
      await load()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error instanceof Error ? error.message : '创建失败')
    }
  }

  const update = async (source: AlertSource, data: Record<string, unknown>) => {
    const response = await fetch(`/api/integration/alert-sources/${source.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const payload = await response.json()
    if (!response.ok || !payload.success) return message.error(payload.error || '更新失败')
    if (payload.data?.token) setIssued({ id: source.id, name: source.name, sourceType: source.sourceType, token: payload.data.token })
    await load()
  }

  const remove = (source: AlertSource) => Modal.confirm({
    title: '删除告警源', content: `删除“${source.name}”后，现有 Webhook 会立即失效。`, okButtonProps: { danger: true },
    async onOk() {
      const response = await fetch(`/api/integration/alert-sources/${source.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '删除失败')
      message.success('告警源已删除')
      await load()
    }
  })

  const webhookUrl = (sourceId: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/api/hooks/alerts/${sourceId}`
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); message.success('已复制') }

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Title level={2} className="!mb-1">告警接入</Title><Text type="secondary">接收 Alertmanager 或通用 Webhook，并持久化到事件中心。</Text></div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ sourceType: 'alertmanager' }); setOpen(true) }}>新增告警源</Button>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Card><Statistic title="告警来源" value={stats.total} prefix={<ApiOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="启用接入" value={stats.enabled} prefix={<SafetyCertificateOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="已有数据" value={stats.received} /></Card></Col>
        </Row>
        <Alert type="info" showIcon message="安全说明" description="接入密钥只在创建或轮换时显示一次，数据库仅保存 SHA-256 哈希；外部系统必须使用 Authorization: Bearer <token>。" />
        <Card title="接入来源">
          <List loading={loading} dataSource={sources} locale={{ emptyText: <Empty description="暂无告警源" /> }} renderItem={source => (
            <List.Item actions={[
              <Switch key="enabled" checked={source.enabled} checkedChildren="启用" unCheckedChildren="停用" onChange={enabled => update(source, { enabled })} />,
              <Button key="rotate" type="text" icon={<KeyOutlined />} onClick={() => Modal.confirm({ title: '轮换接入密钥', content: '旧密钥会立即失效，确定继续？', onOk: () => update(source, { regenerateToken: true }) })}>轮换</Button>,
              <Button key="delete" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(source)} />
            ]}>
              <List.Item.Meta
                title={<Space wrap><span>{source.name}</span><Tag color={source.sourceType === 'alertmanager' ? 'orange' : 'blue'}>{source.sourceType === 'alertmanager' ? 'Alertmanager' : '通用 Webhook'}</Tag>{source.lastError && <Tag color="red">载荷异常</Tag>}</Space>}
                description={<Space direction="vertical" size={2} className="w-full"><Text copyable={{ text: webhookUrl(source.id) }} className="break-all">{webhookUrl(source.id)}</Text><Text type="secondary">最近接收：{source.lastReceivedAt ? new Date(source.lastReceivedAt).toLocaleString('zh-CN') : '尚未接收'}</Text>{source.lastError && <Text type="danger">{source.lastError}</Text>}</Space>}
              />
            </List.Item>
          )} />
        </Card>
      </div>

      <Modal title="新增告警源" open={open} onCancel={() => setOpen(false)} onOk={create} okText="创建接入">
        <Form form={form} layout="vertical" className="pt-3">
          <Form.Item name="name" label="来源名称" rules={[{ required: true }]}><Input placeholder="例如：生产 Prometheus" /></Form.Item>
          <Form.Item name="sourceType" label="载荷格式" rules={[{ required: true }]}><Select options={[{ value: 'alertmanager', label: 'Prometheus Alertmanager' }, { value: 'generic_webhook', label: '通用 JSON Webhook' }]} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="接入密钥已生成" open={Boolean(issued)} onCancel={() => setIssued(null)} footer={<Button type="primary" onClick={() => setIssued(null)}>我已保存</Button>} width={680} maskClosable={false}>
        {issued && <Space direction="vertical" className="w-full" size="middle">
          <Alert type="warning" showIcon message="关闭后无法再次查看此密钥；如遗失请执行轮换。" />
          <Descriptions bordered size="small" column={1} items={[
            { key: 'url', label: 'Webhook URL', children: <Paragraph className="!mb-0 break-all" copyable={{ text: webhookUrl(issued.id) }}>{webhookUrl(issued.id)}</Paragraph> },
            { key: 'token', label: 'Bearer Token', children: <Space className="max-w-full"><Text code className="max-w-[430px] overflow-hidden text-ellipsis">{issued.token}</Text><Button icon={<CopyOutlined />} onClick={() => copy(issued.token)}>复制</Button></Space> }
          ]} />
          {issued.sourceType === 'alertmanager' && <Paragraph code className="whitespace-pre-wrap">{`receivers:\n  - name: wuhr-ai-ops\n    webhook_configs:\n      - url: ${webhookUrl(issued.id)}\n        http_config:\n          authorization:\n            type: Bearer\n            credentials: ${issued.token}`}</Paragraph>}
        </Space>}
      </Modal>
    </MainLayout>
  )
}
