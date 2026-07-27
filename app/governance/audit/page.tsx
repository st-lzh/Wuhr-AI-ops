'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Drawer, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'

const { Title, Paragraph, Text } = Typography
type Entry = { id: string; kind: string; level: string; category: string; action: string; actorId?: string; actorName?: string; source?: string; details?: unknown; timestamp: string }

export default function AuditLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(''); const [category, setCategory] = useState<string>(); const [selected, setSelected] = useState<Entry | null>(null)
  const load = async () => { setLoading(true); try { const response = await fetch('/api/governance/audit?limit=500'); const body = await response.json(); if (!response.ok) throw new Error(body.error); setEntries(body.data || []) } catch (error) { message.error(error instanceof Error ? error.message : '加载审计日志失败') } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const categories = useMemo(() => Array.from(new Set(entries.map(item => item.category))).sort(), [entries])
  const filtered = useMemo(() => entries.filter(item => (!category || item.category === category) && (!query || `${item.action} ${item.actorName || ''} ${item.actorId || ''} ${item.source || ''}`.toLowerCase().includes(query.toLowerCase()))), [entries, query, category])
  const columns = [
    { title: '时间', dataIndex: 'timestamp', width: 185, render: (value: string) => new Date(value).toLocaleString() },
    { title: '级别', dataIndex: 'level', width: 85, render: (value: string) => <Tag color={value === 'error' || value === 'fatal' ? 'red' : value === 'warn' ? 'gold' : 'blue'}>{value}</Tag> },
    { title: '分类', dataIndex: 'category', width: 150 },
    { title: '操作记录', dataIndex: 'action', ellipsis: true, render: (value: string) => <Text>{value}</Text> },
    { title: '操作者', width: 150, render: (_: unknown, item: Entry) => item.actorName || item.actorId || '-' },
    { title: '来源', dataIndex: 'source', width: 170, ellipsis: true },
    { title: '证据', width: 75, render: (_: unknown, item: Entry) => <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(item)} /> }
  ]
  return <MainLayout><div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><Title level={2} style={{ margin: 0 }}>审计日志</Title><Paragraph type="secondary">统一查看认证、配置、审批、部署、网络变更和自动化执行证据。</Paragraph></div><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
    <Card><Space wrap className="mb-4"><Input allowClear prefix={<SearchOutlined />} placeholder="搜索操作、用户或来源" value={query} onChange={event => setQuery(event.target.value)} style={{ width: 280 }} /><Select allowClear placeholder="审计分类" value={category} onChange={setCategory} style={{ width: 190 }} options={categories.map(value => ({ value, label: value }))} /></Space><Table<Entry> rowKey={item => `${item.kind}-${item.id}`} columns={columns} dataSource={filtered} loading={loading} scroll={{ x: 950 }} pagination={{ pageSize: 25 }} /></Card>
  </div><Drawer title="审计证据" width={620} open={!!selected} onClose={() => setSelected(null)}>{selected && <Space direction="vertical" style={{ width: '100%' }}><Text strong>{selected.action}</Text><Text type="secondary">{new Date(selected.timestamp).toLocaleString()} · {selected.category} · {selected.source || '未知来源'}</Text><pre className="max-h-[620px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selected.details, null, 2) || '无附加证据'}</pre></Space>}</Drawer></MainLayout>
}
