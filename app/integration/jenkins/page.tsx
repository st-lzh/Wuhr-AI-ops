'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { ApiOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

interface JenkinsConfig {
  id: string
  name: string
  description?: string
  serverUrl: string
  username?: string
  isActive: boolean
  lastTestAt?: string
  testStatus?: string
  updatedAt: string
}

export default function JenkinsIntegrationPage() {
  const { canAccessCICD } = usePermissions()
  const canWrite = canAccessCICD('write')
  const [configs, setConfigs] = useState<JenkinsConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState('')
  const [editing, setEditing] = useState<JenkinsConfig | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cicd/jenkins', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '加载失败')
      setConfigs(result.data.configs || [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载 Jenkins 配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openEditor = (config?: JenkinsConfig) => {
    setEditing(config || null)
    setModalOpen(true)
    form.setFieldsValue(config ? {
      name: config.name,
      description: config.description,
      serverUrl: config.serverUrl,
      username: config.username,
      apiToken: '',
      isActive: config.isActive
    } : { name: '', description: '', serverUrl: '', username: '', apiToken: '', isActive: true })
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const response = await fetch(editing ? `/api/cicd/jenkins/${editing.id}` : '/api/cicd/jenkins', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '保存失败')
      message.success('Jenkins 配置已保存')
      setModalOpen(false)
      form.resetFields()
      await load()
    } catch (error) {
      if (error instanceof Error) message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const test = async (config: JenkinsConfig) => {
    setTestingId(config.id)
    try {
      const response = await fetch(`/api/cicd/jenkins/${config.id}/test`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || result.message || '连接失败')
      message.success(`${config.name} 连接测试成功`)
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '连接测试失败')
    } finally {
      setTestingId('')
    }
  }

  const remove = async (config: JenkinsConfig) => {
    const response = await fetch(`/api/cicd/jenkins/${config.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok || !result.success) return message.error(result.error || '删除失败')
    message.success('Jenkins 配置已删除')
    load()
  }

  const columns: ColumnsType<JenkinsConfig> = [
    { title: '配置名称', dataIndex: 'name', render: (value, record) => <Space><ApiOutlined /><Text strong>{value}</Text>{!record.isActive && <Tag>已停用</Tag>}</Space> },
    { title: '服务地址', dataIndex: 'serverUrl', ellipsis: true },
    { title: '连接状态', render: (_, record) => <Tag color={record.testStatus === 'connected' ? 'green' : 'default'}>{record.testStatus === 'connected' ? '已验证' : '待验证'}</Tag> },
    { title: '最后测试', dataIndex: 'lastTestAt', render: value => value ? new Date(value).toLocaleString('zh-CN') : '-' },
    {
      title: '操作', width: 250,
      render: (_, record) => <Space>
        <Button size="small" loading={testingId === record.id} onClick={() => test(record)}>测试连接</Button>
        <Button size="small" icon={<EditOutlined />} disabled={!canWrite} onClick={() => openEditor(record)}>编辑</Button>
        <Popconfirm title="确认删除这个 Jenkins 配置？" onConfirm={() => remove(record)} okText="删除" cancelText="取消">
          <Button size="small" danger icon={<DeleteOutlined />} disabled={!canWrite}>删除</Button>
        </Popconfirm>
      </Space>
    }
  ]

  if (!canAccessCICD('read')) {
    return <MainLayout><div className="p-6"><Alert type="warning" showIcon message="访问受限" description="您没有交付配置查看权限。" /></div></MainLayout>
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title level={2} className="!mb-1">任务接入</Title>
            <Paragraph type="secondary" className="!mb-0">统一维护 Jenkins 服务连接；流水线和任务部署直接复用已验证配置</Paragraph>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={() => openEditor()}>新增接入</Button>
          </Space>
        </div>
        <Alert type="info" showIcon message="连接凭据安全保存" description="API Token 加密存储且不会回显；编辑时留空表示保留原 Token。" />
        <Card><Table columns={columns} dataSource={configs} rowKey="id" loading={loading} /></Card>
      </div>

      <Modal title={editing ? '编辑 Jenkins 接入' : '新增 Jenkins 接入'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={save} confirmLoading={saving} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入配置名称' }]}><Input /></Form.Item>
          <Form.Item name="description" label="用途说明"><TextArea rows={2} /></Form.Item>
          <Form.Item name="serverUrl" label="Jenkins 地址" rules={[{ required: true, type: 'url', message: '请输入有效 URL' }]}><Input placeholder="http://jenkins.example.com:8080" /></Form.Item>
          <Form.Item name="username" label="用户名"><Input /></Form.Item>
          <Form.Item name="apiToken" label={editing ? '新 API Token（留空保留）' : 'API Token'} rules={editing ? [] : [{ required: true, message: '请输入 API Token' }]}><Input.Password /></Form.Item>
          <Form.Item name="isActive" label="启用配置" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  )
}
