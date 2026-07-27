'use client'

/**
 * /improve/memory — long-term 记忆管理
 *
 * 2 个视图（Tabs）：
 *   - 条目视图：用 entries API 拉结构化条目（含 stable ID），表格 + 删除按钮
 *   - 原文视图：用 listMemory 拉合并 markdown，react-markdown 渲染
 *
 * 过滤：type / project / cluster（两个视图都生效）
 * 新增：弹 Modal 走 createMemory（type / scope 选择）
 * 删除：仅条目视图可用，走 deleteMemoryEntry(id)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Typography,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  message,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
  Form,
  Alert,
  Tooltip,
  Table,
  Tabs,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  DatabaseOutlined,
  PlusOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  UnorderedListOutlined,
  FileMarkdownOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import MainLayout from '../../components/layout/MainLayout'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useGlobalState'
import { improveClient } from '../../utils/improveClient'
import type { MemoryType, MemoryEntry } from '../../types/improve'

const { Title, Text, Paragraph } = Typography

const MEMORY_TYPES: { value: MemoryType; label: string; color: string; tip: string }[] = [
  { value: 'reference', label: 'reference 参考', color: 'blue', tip: '不易变事实（runbook / 合规条款）；直接引用即可' },
  { value: 'feedback', label: 'feedback 反馈', color: 'orange', tip: '用户偏好 / 纠错；LLM 必须遵守' },
  { value: 'project', label: 'project 项目', color: 'green', tip: '项目当前事实（最易过期）；用前必须核实' },
  { value: 'user', label: 'user 用户', color: 'purple', tip: '用户身份事实（注意：长期画像应走 user_profile）' },
]

const TYPE_COLOR: Record<string, string> = {
  reference: 'blue',
  feedback: 'orange',
  project: 'green',
  user: 'purple',
  '': 'default',
}

const MemoryPage: React.FC = () => {
  const { user } = useAuth()
  const { canAccessImprove } = usePermissions()
  const { isDark } = useTheme()
  const canWrite = canAccessImprove('write')

  const [viewMode, setViewMode] = useState<'entries' | 'markdown'>('entries')
  const [loading, setLoading] = useState(false)

  // 条目视图数据
  const [entries, setEntries] = useState<MemoryEntry[]>([])

  // markdown 视图数据
  const [content, setContent] = useState<string>('')
  const [contentSize, setContentSize] = useState(0)

  // 过滤
  const [typeFilter, setTypeFilter] = useState<MemoryType>('')
  const [projectFilter, setProjectFilter] = useState('')
  const [clusterFilter, setClusterFilter] = useState('')

  // 新增 Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm<{
    content: string
    type: MemoryType
    project: string
    cluster: string
  }>()

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const filter = {
        type: typeFilter || undefined,
        project: projectFilter || undefined,
        cluster: clusterFilter || undefined,
      }
      if (viewMode === 'entries') {
        const resp = await improveClient.listMemoryEntries(filter)
        setEntries(resp.entries || [])
      } else {
        const resp = await improveClient.listMemory(filter)
        setContent(resp.content || '')
        setContentSize(resp.content_size || 0)
      }
    } catch (e: any) {
      message.error(`加载失败：${e?.message || '未知错误'}`)
      if (viewMode === 'entries') setEntries([])
      else { setContent(''); setContentSize(0) }
    } finally {
      setLoading(false)
    }
  }, [user, viewMode, typeFilter, projectFilter, clusterFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)
      await improveClient.createMemory({
        content: values.content,
        type: values.type || 'reference',
        project: values.project || undefined,
        cluster: values.cluster || undefined,
      })
      message.success('已写入记忆')
      setCreateOpen(false)
      createForm.resetFields()
      loadData()
    } catch (e: any) {
      if (e?.message) message.error(`写入失败：${e.message}`)
    } finally {
      setCreateLoading(false)
    }
  }

  const onDeleteEntry = async (id: string) => {
    try {
      await improveClient.deleteMemoryEntry(id)
      message.success('已删除')
      loadData()
    } catch (e: any) {
      message.error(`删除失败：${e?.message || '未知错误'}`)
    }
  }

  const entryColumns = useMemo(
    () => [
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 110,
        render: (v: MemoryType) =>
          v ? <Tag color={TYPE_COLOR[v]}>{v}</Tag> : <Tag>untyped</Tag>,
      },
      {
        title: '作用域',
        key: 'scope',
        width: 200,
        render: (_: any, row: MemoryEntry) => {
          const p = row.scope?.Project
          const c = row.scope?.Cluster
          if (!p && !c) return <Text type="secondary">全局</Text>
          return (
            <Space size={4}>
              {p && <Tag color="geekblue">project: {p}</Tag>}
              {c && <Tag color="cyan">cluster: {c}</Tag>}
            </Space>
          )
        },
      },
      {
        title: '内容',
        dataIndex: 'body',
        key: 'body',
        ellipsis: { showTitle: false },
        render: (v: string) => (
          <Tooltip
            title={<pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{v}</pre>}
            placement="topLeft"
          >
            <span>{v}</span>
          </Tooltip>
        ),
      },
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 170,
        render: (v?: string) =>
          v ? new Date(v).toLocaleString('zh-CN') : <Text type="secondary">—</Text>,
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        fixed: 'right' as const,
        render: (_: any, row: MemoryEntry) =>
          canWrite ? (
            <Popconfirm
              title="确认删除？"
              description="删除后不可恢复"
              onConfirm={() => onDeleteEntry(row.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : null,
      },
    ],
    [canWrite]
  )

  return (
    <MainLayout>
      <div className="p-6">
        {/* Stats */}
        <Row gutter={16} className="mb-4">
          <Col span={8}>
            <Card>
              <Statistic
                title="当前过滤下条目数"
                value={viewMode === 'entries' ? entries.length : '—'}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="原文大小"
                value={viewMode === 'markdown' ? formatBytes(contentSize) : '—'}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="作用域"
                value={
                  projectFilter || clusterFilter
                    ? `${projectFilter || '*'} / ${clusterFilter || '*'}`
                    : '全局'
                }
              />
            </Card>
          </Col>
        </Row>

        {/* 类型说明 */}
        <Alert
          className="mb-4"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="记忆类型决定 LLM 的信任程度"
          description={
            <Space wrap>
              {MEMORY_TYPES.map((t) => (
                <Tooltip key={t.value} title={t.tip}>
                  <Tag color={t.color}>{t.label}</Tag>
                </Tooltip>
              ))}
            </Space>
          }
        />

        {/* 过滤栏 + 新增 */}
        <Card className="mb-4">
          <Space wrap>
            <Select
              placeholder="类型"
              value={typeFilter || undefined}
              onChange={(v) => setTypeFilter(v || '')}
              allowClear
              style={{ width: 180 }}
              options={MEMORY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <Input
              placeholder="project（如 billing）"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              onPressEnter={loadData}
              allowClear
              style={{ width: 200 }}
            />
            <Input
              placeholder="cluster（如 prod）"
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              onPressEnter={loadData}
              allowClear
              style={{ width: 200 }}
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            {canWrite && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields()
                  createForm.setFieldsValue({
                    type: typeFilter || 'reference',
                    project: projectFilter,
                    cluster: clusterFilter,
                  })
                  setCreateOpen(true)
                }}
              >
                新增条目
              </Button>
            )}
          </Space>
        </Card>

        {/* 视图切换 + 内容 */}
        <Card>
          <Tabs
            activeKey={viewMode}
            onChange={(k) => setViewMode(k as any)}
            items={[
              {
                key: 'entries',
                label: (
                  <Space size={4}>
                    <UnorderedListOutlined />
                    条目视图（可删除）
                  </Space>
                ),
              },
              {
                key: 'markdown',
                label: (
                  <Space size={4}>
                    <FileMarkdownOutlined />
                    原文视图
                  </Space>
                ),
              },
            ]}
          />
          <Spin spinning={loading}>
            {viewMode === 'entries' ? (
              <Table
                rowKey="id"
                columns={entryColumns}
                dataSource={entries}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                scroll={{ x: 1000 }}
                locale={{
                  emptyText: (
                    <Empty
                      description={
                        typeFilter || projectFilter || clusterFilter
                          ? '当前过滤下没有记忆条目'
                          : '记忆库为空。聊天里说"记住 X"，或点上方"新增条目"。'
                      }
                    />
                  ),
                }}
              />
            ) : !content.trim() ? (
              <Empty description="无记忆内容" />
            ) : (
              <div
                className="markdown-body"
                style={{
                  background: isDark ? '#1a1a1a' : '#fafafa',
                  padding: 16,
                  borderRadius: 6,
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  fontSize: 14,
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => <Title level={3} {...(props as any)} />,
                    h2: ({ node, ...props }) => (
                      <Title level={4} style={{ marginTop: 16, color: isDark ? '#fff' : undefined }} {...(props as any)} />
                    ),
                    h3: ({ node, ...props }) => <Title level={5} {...(props as any)} />,
                    code: ({ node, ...props }: any) => (
                      <code
                        style={{
                          background: isDark ? '#0f0f0f' : '#eee',
                          padding: '2px 4px',
                          borderRadius: 3,
                        }}
                        {...props}
                      />
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </Spin>
        </Card>
      </div>

      {/* 新增条目 Modal */}
      <Modal
        title="新增记忆条目"
        open={createOpen}
        onOk={submitCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={createLoading}
        okText="写入"
        cancelText="取消"
        width={620}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '内容必填' }]}
          >
            <Input.TextArea
              rows={5}
              placeholder="例如：prod 集群升级 helm 前必须先 helm get values <release> > backup.yaml"
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            initialValue="reference"
            tooltip="决定 LLM 的信任程度：feedback 必须遵守 / project 用前核实 / reference 直接引用"
          >
            <Select
              options={MEMORY_TYPES.map((t) => ({
                value: t.value,
                label: (
                  <span>
                    <Tag color={t.color}>{t.value}</Tag> {t.label}
                  </span>
                ) as any,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="project"
                label="项目作用域（可选）"
                tooltip="仅当用户查询此 project 时才会被注入；留空＝全局"
              >
                <Input placeholder="billing" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cluster"
                label="集群作用域（可选）"
                tooltip="同上，按集群隔离"
              >
                <Input placeholder="prod" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </MainLayout>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export default MemoryPage
