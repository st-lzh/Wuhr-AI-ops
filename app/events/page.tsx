'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { AlertOutlined, CheckOutlined, PlusOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons'
import MainLayout from '../components/layout/MainLayout'
import { usePermissions } from '../hooks/usePermissions'

const { Title, Paragraph, Text } = Typography
type Incident = { id: string; source: string; title: string; description?: string; severity: string; status: string; resourceType?: string; resourceId?: string; assigneeName?: string; occurrences: number; firstSeenAt: string; lastSeenAt: string }
const severityColor: Record<string, string> = { info: 'blue', warning: 'gold', error: 'orange', critical: 'red' }
const statusColor: Record<string, string> = { open: 'red', acknowledged: 'gold', investigating: 'blue', resolved: 'green', closed: 'default' }

export default function EventCenterPage() {
  const { canAccessMonitoring } = usePermissions(); const canWrite = canAccessMonitoring('write')
  const [items, setItems] = useState<Incident[]>([]); const [loading, setLoading] = useState(true); const [status, setStatus] = useState<string>(); const [open, setOpen] = useState(false); const [form] = Form.useForm()
  const load = async () => { setLoading(true); try { const response = await fetch(`/api/operations/incidents${status ? `?status=${status}` : ''}`); const body = await response.json(); if (!response.ok) throw new Error(body.error); setItems(body.data || []) } catch (error) { message.error(error instanceof Error ? error.message : '加载事件失败') } finally { setLoading(false) } }
  useEffect(() => { load() }, [status])
  const counts = useMemo(() => ({ open: items.filter(item => !['resolved', 'closed'].includes(item.status)).length, critical: items.filter(item => item.severity === 'critical' && !['resolved', 'closed'].includes(item.status)).length, assigned: items.filter(item => item.assigneeName && !['resolved', 'closed'].includes(item.status)).length, total: items.length }), [items])
  const change = async (incident: Incident, action: string) => { try { const response = await fetch(`/api/operations/incidents/${incident.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); message.success('事件状态已更新'); await load() } catch (error) { message.error(error instanceof Error ? error.message : '处理失败') } }
  const create = async () => { try { const values = await form.validateFields(); const response = await fetch('/api/operations/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); message.success('事件已创建'); setOpen(false); form.resetFields(); await load() } catch (error) { if (error instanceof Error) message.error(error.message) } }
  const columns = [
    { title: '事件', dataIndex: 'title', render: (value: string, item: Incident) => <div><Text strong>{value}</Text><div><Text type="secondary">{item.description || `${item.source} · ${item.resourceType || '平台'}`}</Text></div></div> },
    { title: '严重度', dataIndex: 'severity', width: 100, render: (value: string) => <Tag color={severityColor[value]}>{value}</Tag> },
    { title: '状态', dataIndex: 'status', width: 120, render: (value: string) => <Tag color={statusColor[value]}>{value}</Tag> },
    { title: '来源', dataIndex: 'source', width: 110 },
    { title: '负责人', dataIndex: 'assigneeName', width: 120, render: (value?: string) => value || <Text type="secondary">未指派</Text> },
    { title: '次数', dataIndex: 'occurrences', width: 70 },
    { title: '最近发生', dataIndex: 'lastSeenAt', width: 180, render: (value: string) => new Date(value).toLocaleString() },
    { title: '操作', width: 240, render: (_: unknown, item: Incident) => <Space wrap>{item.status === 'open' && <Button size="small" disabled={!canWrite} onClick={() => change(item, 'acknowledge')}>确认</Button>}{['open', 'acknowledged'].includes(item.status) && <Button size="small" type="primary" disabled={!canWrite} onClick={() => change(item, 'investigate')}>处理中</Button>}{!['resolved', 'closed'].includes(item.status) && <Button size="small" icon={<UserOutlined />} disabled={!canWrite} onClick={() => change(item, 'assign')}>指派给我</Button>}{!['resolved', 'closed'].includes(item.status) && <Button size="small" icon={<CheckOutlined />} disabled={!canWrite} onClick={() => change(item, 'resolve')}>解决</Button>}{['resolved', 'closed'].includes(item.status) && <Button size="small" disabled={!canWrite} onClick={() => change(item, 'reopen')}>重开</Button>}</Space> }
  ]
  return <MainLayout><div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><Title level={2} style={{ margin: 0 }}>事件中心</Title><Paragraph type="secondary">统一承接自动化、主机、网络和交付故障，形成确认、指派、处理、解决的真实闭环。</Paragraph></div><Space><Select allowClear placeholder="按状态筛选" value={status} onChange={setStatus} style={{ width: 150 }} options={['open', 'acknowledged', 'investigating', 'resolved', 'closed'].map(value => ({ value, label: value }))} /><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button><Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => setOpen(true)}>新建事件</Button></Space></div>
    <Alert showIcon icon={<AlertOutlined />} type="info" message="真实事件闭环" description="自动化作业失败会自动聚合为事件；相同作业重复失败只增加发生次数，恢复成功后自动解决。" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><Statistic title="活跃事件" value={counts.open} /></Card><Card><Statistic title="严重事件" value={counts.critical} valueStyle={{ color: '#ef4444' }} /></Card><Card><Statistic title="已指派" value={counts.assigned} /></Card><Card><Statistic title="当前列表" value={counts.total} /></Card></div>
    <Card><Table<Incident> rowKey="id" columns={columns} dataSource={items} loading={loading} scroll={{ x: 1100 }} pagination={{ pageSize: 20 }} /></Card>
  </div><Modal title="新建人工事件" open={open} onCancel={() => setOpen(false)} onOk={create}><Form form={form} layout="vertical"><Form.Item name="title" label="事件标题" rules={[{ required: true, min: 2 }]}><Input /></Form.Item><Form.Item name="description" label="详细说明"><Input.TextArea rows={4} /></Form.Item><Form.Item name="severity" label="严重度" initialValue="warning"><Select options={['info', 'warning', 'error', 'critical'].map(value => ({ value, label: value }))} /></Form.Item><Form.Item name="resourceType" label="资源类型"><Input placeholder="server / network / cicd" /></Form.Item><Form.Item name="resourceId" label="资源标识"><Input /></Form.Item></Form></Modal></MainLayout>
}
