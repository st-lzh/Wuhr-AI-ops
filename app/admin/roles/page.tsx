'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Space, Table, Tag, Typography, message } from 'antd'
import { EditOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

interface RoleRecord {
  name: 'admin' | 'manager' | 'developer' | 'viewer'
  displayName: string
  description: string
  permissions: string[]
  userCount: number
  updatedAt: string
}

interface PermissionRecord {
  id: string
  name: string
  code: string
  description: string
  category: string
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  manager: 'orange',
  developer: 'blue',
  viewer: 'default'
}

export default function RolesPage() {
  const { canAccessPermissions } = usePermissions()
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<RoleRecord | null>(null)
  const [form] = Form.useForm()
  const canWrite = canAccessPermissions('write')

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, PermissionRecord[]>>((groups, permission) => {
      ;(groups[permission.category] ||= []).push(permission)
      return groups
    }, {})
  }, [permissions])

  const loadRoles = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/roles')
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '获取角色失败')
      setRoles(payload.data.roles)
      setPermissions(payload.data.permissions)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取角色失败')
    } finally {
      setLoading(false)
    }
  }

  const openEditor = (role: RoleRecord) => {
    setEditing(role)
    form.setFieldsValue({
      displayName: role.displayName,
      description: role.description,
      permissions: role.name === 'admin' ? permissions.map(item => item.code) : role.permissions
    })
  }

  const saveRole = async () => {
    if (!editing) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, ...values })
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '保存角色失败')
      message.success(payload.message || '角色保存成功')
      setEditing(null)
      form.resetFields()
      await loadRoles()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存角色失败')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { if (canAccessPermissions('read')) loadRoles() }, [canAccessPermissions])

  if (!canAccessPermissions('read')) {
    return <MainLayout><div className="p-6"><Alert type="warning" showIcon message="访问受限" description="您没有角色查看权限。" /></div></MainLayout>
  }

  const columns: ColumnsType<RoleRecord> = [
    {
      title: '角色名称',
      render: (_, role) => <Space><Tag color={ROLE_COLORS[role.name]}>{role.name}</Tag><Text strong>{role.displayName}</Text></Space>
    },
    { title: '角色说明', dataIndex: 'description' },
    { title: '成员数量', dataIndex: 'userCount', width: 100, render: value => `${value} 人` },
    {
      title: '权限数量',
      width: 100,
      render: (_, role) => role.name === 'admin' || role.permissions.includes('*') ? '全部' : `${role.permissions.length} 项`
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: value => new Date(value).toLocaleString() },
    {
      title: '操作',
      width: 100,
      render: (_, role) => <Button type="link" icon={<EditOutlined />} disabled={!canWrite} onClick={() => openEditor(role)}>编辑</Button>
    }
  ]

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <Title level={2}><SafetyCertificateOutlined className="mr-2" />角色模板</Title>
          <Link href="/users/permissions"><Button>返回角色权限</Button></Link>
        </div>
        <Paragraph>角色是团队权限模板。保存后会立即同步到该角色下的现有成员，并清理认证权限缓存。</Paragraph>
        <Alert className="mb-4" type="info" showIcon message="四种固定职责角色" description="为避免权限语义失控，角色代码固定为管理员、运维经理、运维工程师和只读成员；可调整名称、说明和权限集合。" />
        <Card extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={loadRoles}>刷新</Button>}>
          <Table columns={columns} dataSource={roles} rowKey="name" loading={loading} pagination={false} />
        </Card>
      </div>

      <Modal
        title={`编辑角色：${editing?.displayName || ''}`}
        open={Boolean(editing)}
        width={900}
        okText="保存并同步"
        cancelText="取消"
        confirmLoading={saving}
        onOk={saveRole}
        onCancel={() => { setEditing(null); form.resetFields() }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, min: 2, max: 100 }]}><Input /></Form.Item>
          <Form.Item name="description" label="角色说明" rules={[{ required: true, min: 2, max: 1000 }]}><TextArea rows={3} /></Form.Item>
          <Form.Item name="permissions" label="权限集合">
            <Checkbox.Group className="w-full" disabled={editing?.name === 'admin'}>
              <Row gutter={[16, 16]}>
                {Object.entries(groupedPermissions).map(([category, items]) => (
                  <Col span={12} key={category}>
                    <Card size="small" title={category} className="h-full">
                      <Space direction="vertical">
                        {items.map(permission => (
                          <Checkbox key={permission.code} value={permission.code}>
                            <Text strong>{permission.name}</Text>
                            <div className="text-xs text-gray-500">{permission.description}</div>
                          </Checkbox>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          {editing?.name === 'admin' && <Alert type="warning" showIcon message="系统管理员固定拥有全部权限，不能缩减。" />}
        </Form>
      </Modal>
    </MainLayout>
  )
}
