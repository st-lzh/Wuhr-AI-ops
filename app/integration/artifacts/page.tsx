'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, List, Modal, Row, Select, Space, Statistic, Switch, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, CloudServerOutlined, DeleteOutlined, EditOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'

const { Title, Text } = Typography

type ArtifactRepository = {
  id: string
  name: string
  repositoryType: 'docker_registry' | 'harbor'
  baseUrl: string
  projectName?: string
  username?: string
  verifyTls: boolean
  isDefault: boolean
  status: string
  hasPassword: boolean
  lastVerifiedAt?: string
  lastError?: string
}

export default function ArtifactRepositoriesPage() {
  const [repositories, setRepositories] = useState<ArtifactRepository[]>([])
  const [loading, setLoading] = useState(false)
  const [testingId, setTestingId] = useState<string>()
  const [editing, setEditing] = useState<ArtifactRepository | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/integration/artifacts', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '加载制品仓库失败')
      setRepositories(payload.data || [])
    } catch (error) { message.error(error instanceof Error ? error.message : '加载制品仓库失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => ({
    total: repositories.length,
    online: repositories.filter(item => item.status === 'online').length,
    error: repositories.filter(item => item.status === 'error').length
  }), [repositories])

  const showForm = (repository?: ArtifactRepository) => {
    setEditing(repository || null)
    if (repository) form.setFieldsValue({ ...repository, password: undefined })
    else { form.resetFields(); form.setFieldsValue({ repositoryType: 'docker_registry', verifyTls: true, isDefault: false }) }
    setOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      if (editing && !values.password) delete values.password
      const response = await fetch(editing ? `/api/integration/artifacts/${editing.id}` : '/api/integration/artifacts', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values)
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '保存失败')
      message.success(editing ? '制品仓库已更新' : '制品仓库已创建')
      setOpen(false)
      await load()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const test = async (repository: ArtifactRepository) => {
    setTestingId(repository.id)
    try {
      const response = await fetch(`/api/integration/artifacts/${repository.id}/test`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '连接测试失败')
      message.success(`连接成功，耗时 ${payload.data.latencyMs}ms`)
      await load()
    } catch (error) { message.error(error instanceof Error ? error.message : '连接测试失败'); await load() }
    finally { setTestingId(undefined) }
  }

  const remove = (repository: ArtifactRepository) => Modal.confirm({
    title: '删除制品仓库', content: `确认删除“${repository.name}”？不会删除仓库中的镜像。`, okButtonProps: { danger: true },
    async onOk() {
      const response = await fetch(`/api/integration/artifacts/${repository.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '删除失败')
      message.success('制品仓库已删除')
      await load()
    }
  })

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Title level={2} className="!mb-1">制品管理</Title><Text type="secondary">统一登记 Harbor 与 Docker Registry，验证真实连接并保护访问凭据。</Text></div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showForm()}>新增仓库</Button>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Card><Statistic title="仓库总数" value={stats.total} prefix={<CloudServerOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="连接正常" value={stats.online} valueStyle={{ color: '#22c55e' }} prefix={<CheckCircleOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="连接异常" value={stats.error} valueStyle={{ color: stats.error ? '#ef4444' : undefined }} /></Card></Col>
        </Row>
        <Alert showIcon type="info" message="连接测试调用 Registry V2 API" description="平台不会把仓库密码返回浏览器。禁用 TLS 校验仅应用于明确配置的内网自签名仓库，并会在列表中标记风险。" />
        <Card title="仓库列表">
          <List loading={loading} dataSource={repositories} locale={{ emptyText: '暂无制品仓库' }} renderItem={repository => (
            <List.Item actions={[
              <Button key="test" type="text" icon={<ExperimentOutlined />} loading={testingId === repository.id} onClick={() => test(repository)}>测试</Button>,
              <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => showForm(repository)} />,
              <Button key="delete" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(repository)} />
            ]}>
              <List.Item.Meta
                avatar={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10"><CloudServerOutlined className="text-blue-500" /></div>}
                title={<Space wrap><span>{repository.name}</span>{repository.isDefault && <Tag color="blue">默认仓库</Tag>}<Tag color={repository.status === 'online' ? 'green' : repository.status === 'error' ? 'red' : 'default'}>{repository.status === 'online' ? '在线' : repository.status === 'error' ? '异常' : '未测试'}</Tag>{!repository.verifyTls && <Tag color="orange">未校验 TLS</Tag>}</Space>}
                description={<Space direction="vertical" size={1}><Text copyable>{repository.baseUrl}</Text><Text type="secondary">{repository.repositoryType === 'harbor' ? 'Harbor' : 'Docker Registry'} · 项目 {repository.projectName || '-'} · 用户 {repository.username || '匿名'} · 最近测试 {repository.lastVerifiedAt ? new Date(repository.lastVerifiedAt).toLocaleString('zh-CN') : '暂无'}</Text>{repository.lastError && <Text type="danger">{repository.lastError}</Text>}</Space>}
              />
            </List.Item>
          )} />
        </Card>
      </div>

      <Modal title={editing ? '编辑制品仓库' : '新增制品仓库'} open={open} onCancel={() => setOpen(false)} onOk={save} width={660} okText="保存">
        <Form form={form} layout="vertical" className="pt-3">
          <Row gutter={16}>
            <Col span={14}><Form.Item name="name" label="仓库名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="repositoryType" label="仓库类型" rules={[{ required: true }]}><Select disabled={Boolean(editing)} options={[{ value: 'docker_registry', label: 'Docker Registry' }, { value: 'harbor', label: 'Harbor' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="baseUrl" label="仓库地址" rules={[{ required: true }, { type: 'url' }]}><Input placeholder="https://registry.example.com" /></Form.Item>
          <Form.Item name="projectName" label="默认项目/命名空间"><Input placeholder="可选，例如 platform" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="username" label="用户名"><Input autoComplete="off" /></Form.Item></Col>
            <Col span={12}><Form.Item name="password" label={editing ? '新密码（留空保持不变）' : '密码/访问令牌'}><Input.Password autoComplete="new-password" /></Form.Item></Col>
          </Row>
          <Space size="large">
            <Form.Item name="verifyTls" label="校验 TLS" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="isDefault" label="设为默认" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </MainLayout>
  )
}
