'use client'

import React, { useEffect, useState } from 'react'
import { Button, Card, Descriptions, Drawer, Empty, Space, Table, Tag, Typography, message } from 'antd'
import { CheckOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Paragraph, Text } = Typography
type Run = { id: string; jobName: string; triggerType: string; status: string; riskLevel: string; commandSnapshot: string; targetSnapshot: string[]; requestedByName?: string; approvedByName?: string; summary?: string; error?: string; output?: unknown; createdAt: string; startedAt?: string; completedAt?: string }
const colors: Record<string, string> = { success: 'green', failed: 'red', running: 'blue', awaiting_approval: 'orange', pending: 'default' }

export default function AutomationRunsPage() {
  const { canAccessApprovals } = usePermissions()
  const [runs, setRuns] = useState<Run[]>([]); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<Run | null>(null)
  const load = async () => { setLoading(true); try { const response = await fetch('/api/operations/runs'); const body = await response.json(); if (!response.ok) throw new Error(body.error); setRuns(body.data || []) } catch (error) { message.error(error instanceof Error ? error.message : '加载失败') } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const approve = async (run: Run) => { try { const response = await fetch(`/api/operations/runs/${run.id}/approve`, { method: 'POST' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); message.success('审批通过，作业已进入执行队列'); await load() } catch (error) { message.error(error instanceof Error ? error.message : '审批失败') } }
  const columns = [
    { title: '作业名称', dataIndex: 'jobName', render: (value: string, run: Run) => <div><Text strong>{value}</Text><div><Text type="secondary">{run.triggerType === 'scheduled' ? '定时触发' : '人工触发'}</Text></div></div> },
    { title: '状态', dataIndex: 'status', width: 140, render: (value: string) => <Tag color={colors[value]}>{value}</Tag> },
    { title: '风险', dataIndex: 'riskLevel', width: 90, render: (value: string) => <Tag color={value === 'critical' ? 'red' : value === 'high' ? 'orange' : value === 'medium' ? 'gold' : 'green'}>{value}</Tag> },
    { title: '请求人', dataIndex: 'requestedByName', width: 120 },
    { title: '执行摘要', dataIndex: 'summary', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (value: string) => new Date(value).toLocaleString() },
    { title: '操作', width: 180, render: (_: unknown, run: Run) => <Space><Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(run)}>详情</Button>{run.status === 'awaiting_approval' && canAccessApprovals('write') && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approve(run)}>批准</Button>}</Space> }
  ]
  return <MainLayout><div className="space-y-4">
    <div className="flex justify-between gap-3"><div><Title level={2} style={{ margin: 0 }}>执行记录</Title><Paragraph type="secondary">每次执行都保存命令、目标、审批人、逐主机输出和最终状态。</Paragraph></div><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></div>
    <Card><Table<Run> rowKey="id" columns={columns} dataSource={runs} loading={loading} scroll={{ x: 950 }} pagination={{ pageSize: 20 }} /></Card>
  </div><Drawer title="作业执行详情" width={720} open={!!selected} onClose={() => setSelected(null)}>{selected ? <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Descriptions column={2} bordered size="small"><Descriptions.Item label="作业">{selected.jobName}</Descriptions.Item><Descriptions.Item label="状态"><Tag color={colors[selected.status]}>{selected.status}</Tag></Descriptions.Item><Descriptions.Item label="请求人">{selected.requestedByName || '-'}</Descriptions.Item><Descriptions.Item label="审批人">{selected.approvedByName || '-'}</Descriptions.Item><Descriptions.Item label="摘要" span={2}>{selected.summary || selected.error || '-'}</Descriptions.Item></Descriptions>
    <div><Text strong>命令快照</Text><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-slate-100">{selected.commandSnapshot}</pre></div>
    <div><Text strong>逐主机输出</Text>{selected.output ? <pre className="mt-2 max-h-[460px] overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.output, null, 2)}</pre> : <Empty description="尚无执行输出" />}</div>
  </Space> : null}</Drawer></MainLayout>
}
