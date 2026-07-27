'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Text, Paragraph } = Typography

type Job = {
  id: string; name: string; description?: string; command: string; targetServerIds: string[]
  cronExpression?: string; enabled: boolean; riskLevel: string; approvalMode: string
  version: number; approvedVersion?: number; nextRunAt?: string; lastRunAt?: string; runs?: Array<{ status: string }>
}
type Server = { id: string; name: string; ip: string; status: string }

const riskColors: Record<string, string> = { low: 'green', medium: 'gold', high: 'orange', critical: 'red' }
const statusColors: Record<string, string> = { success: 'green', failed: 'red', running: 'blue', awaiting_approval: 'orange', pending: 'default' }

export default function AutomationJobsPage() {
  const { canAccessServers, canAccessApprovals } = usePermissions()
  const canWrite = canAccessServers('write')
  const canApprove = canAccessApprovals('write')
  const [jobs, setJobs] = useState<Job[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [jobsResponse, serversResponse] = await Promise.all([fetch('/api/operations/jobs'), fetch('/api/servers')])
      const [jobsBody, serversBody] = await Promise.all([jobsResponse.json(), serversResponse.json()])
      if (!jobsResponse.ok) throw new Error(jobsBody.error || '加载作业失败')
      setJobs(jobsBody.data || [])
      const rawServers = serversBody.data?.servers || serversBody.data || serversBody.servers || []
      setServers(Array.isArray(rawServers) ? rawServers : [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const edit = (job?: Job) => {
    setEditing(job || null)
    form.setFieldsValue(job ? {
      ...job,
      cronExpression: job.cronExpression || undefined,
      targetServerIds: Array.isArray(job.targetServerIds) ? job.targetServerIds : []
    } : { approvalMode: 'every_run', enabled: false, targetServerIds: [] })
    setOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/operations/jobs/${editing.id}` : '/api/operations/jobs', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values)
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '保存失败')
      message.success(editing ? '作业已更新；命令变化会使旧审批失效' : '作业已创建')
      setOpen(false); form.resetFields(); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    } finally { setSaving(false) }
  }

  const action = async (url: string, method = 'POST', body?: unknown) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || '操作失败')
    return data
  }

  const run = async (job: Job) => {
    try {
      const result = await action(`/api/operations/jobs/${job.id}/run`)
      message.success(result.data?.status === 'awaiting_approval' ? '已提交审批，审批后才会执行' : '已进入执行队列')
      await load()
    } catch (error) { message.error(error instanceof Error ? error.message : '触发失败') }
  }

  const toggle = async (job: Job, enabled: boolean) => {
    try { await action(`/api/operations/jobs/${job.id}`, 'PATCH', { enabled }); message.success(enabled ? '定时作业已启用' : '定时作业已停用'); await load() }
    catch (error) { message.error(error instanceof Error ? error.message : '更新失败') }
  }

  const approveVersion = async (job: Job) => {
    try { await action(`/api/operations/jobs/${job.id}/approve-version`); message.success(`已批准版本 v${job.version}`); await load() }
    catch (error) { message.error(error instanceof Error ? error.message : '审批失败') }
  }

  const remove = async (job: Job) => {
    try { await action(`/api/operations/jobs/${job.id}`, 'DELETE'); message.success('作业已删除'); await load() }
    catch (error) { message.error(error instanceof Error ? error.message : '删除失败') }
  }

  const columns = [
    { title: '作业名称', dataIndex: 'name', render: (_: unknown, job: Job) => <div><Text strong>{job.name}</Text><div><Text type="secondary">{job.description || '未填写说明'}</Text></div></div> },
    { title: '目标主机', dataIndex: 'targetServerIds', width: 100, render: (ids: string[]) => `${Array.isArray(ids) ? ids.length : 0} 台` },
    { title: '风险审批', width: 175, render: (_: unknown, job: Job) => <Space direction="vertical" size={2}><Tag color={riskColors[job.riskLevel]}>{job.riskLevel.toUpperCase()}</Tag><Text type="secondary">{job.approvalMode === 'every_run' ? '每次审批' : job.approvalMode === 'version' ? `版本审批 v${job.approvedVersion || '-'}/${job.version}` : '低风险免审'}</Text></Space> },
    { title: '调度计划', width: 190, render: (_: unknown, job: Job) => <div><code>{job.cronExpression || '仅手动'}</code><div><Text type="secondary">{job.nextRunAt ? `下次 ${new Date(job.nextRunAt).toLocaleString()}` : '未安排'}</Text></div></div> },
    { title: '启用', width: 75, render: (_: unknown, job: Job) => <Switch checked={job.enabled} disabled={!canWrite} onChange={checked => toggle(job, checked)} /> },
    { title: '最近结果', width: 110, render: (_: unknown, job: Job) => job.runs?.[0] ? <Tag color={statusColors[job.runs[0].status]}>{job.runs[0].status}</Tag> : <Text type="secondary">未执行</Text> },
    { title: '操作', width: 260, fixed: 'right' as const, render: (_: unknown, job: Job) => <Space wrap>
      <Button size="small" type="primary" icon={<ThunderboltOutlined />} disabled={!canWrite} onClick={() => run(job)}>执行</Button>
      <Button size="small" icon={<EditOutlined />} disabled={!canWrite} onClick={() => edit(job)}>编辑</Button>
      {canApprove && job.approvalMode === 'version' && job.approvedVersion !== job.version && !['high', 'critical'].includes(job.riskLevel) && <Button size="small" icon={<CheckCircleOutlined />} onClick={() => approveVersion(job)}>批准版本</Button>}
      <Popconfirm title="确认删除该作业？" onConfirm={() => remove(job)}><Button size="small" danger icon={<DeleteOutlined />} disabled={!canWrite} /></Popconfirm>
    </Space> }
  ]

  return <MainLayout>
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Title level={2} style={{ margin: 0 }}>作业管理</Title><Paragraph type="secondary">将审核后的命令固化为确定性作业，支持多主机、定时调度、版本审批和真实执行记录。</Paragraph></div>
        <Space><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button><Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => edit()}>新建作业</Button></Space>
      </div>
      <Alert showIcon type="info" message="安全执行规则" description="高风险和严重风险命令强制每次审批；低风险作业可按版本审批。命令修改后版本号自动递增，旧审批立即失效。" />
      <Card><Table<Job> rowKey="id" loading={loading} columns={columns} dataSource={jobs} scroll={{ x: 1150 }} pagination={{ pageSize: 20 }} /></Card>
    </div>
    <Modal title={editing ? '编辑作业' : '新建作业'} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} width={720} destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="name" label="作业名称" rules={[{ required: true, min: 2 }]}><Input placeholder="例如：生产主机磁盘巡检" /></Form.Item>
        <Form.Item name="description" label="作业说明"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="targetServerIds" label="目标主机" rules={[{ required: true, type: 'array', min: 1 }]}><Select mode="multiple" optionFilterProp="label" options={servers.map(server => ({ value: server.id, label: `${server.name} · ${server.ip} · ${server.status}` }))} /></Form.Item>
        <Form.Item name="command" label="确定性命令" rules={[{ required: true }]}><Input.TextArea rows={6} style={{ fontFamily: 'monospace' }} placeholder="df -h && free -h" /></Form.Item>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Form.Item name="cronExpression" label="Cron 表达式"><Input placeholder="例如：0 9 * * *" /></Form.Item>
          <Form.Item name="approvalMode" label="审批策略" rules={[{ required: true }]}><Select options={[{ value: 'every_run', label: '每次执行前审批' }, { value: 'version', label: '命令版本审批一次' }, { value: 'none', label: '低风险免审批' }]} /></Form.Item>
        </div>
        <Form.Item name="enabled" label="启用定时调度" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </MainLayout>
}
