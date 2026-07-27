'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, List, Modal, Row, Select, Space, Statistic, Tag, Typography, Upload, message } from 'antd'
import { BookOutlined, DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import MainLayout from '../components/layout/MainLayout'
import { useTheme } from '../hooks/useGlobalState'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

type RunbookDocument = {
  id: string
  title: string
  description?: string
  sourceType: string
  sourceName?: string
  mimeType?: string
  content?: string
  contentHash: string
  tags: string[]
  createdByName?: string
  createdAt: string
  updatedAt: string
  _count: { chunks: number }
}

type SearchResult = {
  id: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  content: string
  tags: string[]
  citation: string
}

export default function KnowledgePage() {
  const { isDark } = useTheme()
  const [documents, setDocuments] = useState<RunbookDocument[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<RunbookDocument | null>(null)
  const [viewing, setViewing] = useState<RunbookDocument | null>(null)
  const [query, setQuery] = useState('')
  const [form] = Form.useForm()

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/knowledge/documents', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '加载知识文档失败')
      setDocuments(payload.data || [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载知识文档失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDocuments() }, [loadDocuments])

  const stats = useMemo(() => ({
    documents: documents.length,
    chunks: documents.reduce((sum, item) => sum + (item._count?.chunks || 0), 0),
    tags: new Set(documents.flatMap(item => item.tags || [])).size
  }), [documents])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ sourceType: 'manual', tags: [] })
    setModalOpen(true)
  }

  const openEdit = async (document: RunbookDocument) => {
    const response = await fetch(`/api/knowledge/documents/${document.id}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) return message.error(payload.error || '读取文档失败')
    setEditing(payload.data)
    form.setFieldsValue(payload.data)
    setModalOpen(true)
  }

  const openView = async (document: RunbookDocument) => {
    const response = await fetch(`/api/knowledge/documents/${document.id}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) return message.error(payload.error || '读取文档失败')
    setViewing(payload.data)
    setDrawerOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      const response = await fetch(editing ? `/api/knowledge/documents/${editing.id}` : '/api/knowledge/documents', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '保存失败')
      message.success(editing ? '知识文档已更新' : '知识文档已入库')
      setModalOpen(false)
      // 文档内容变化后旧分块结果已失效，避免继续展示过期引用。
      setResults([])
      await loadDocuments()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const remove = (document: RunbookDocument) => {
    Modal.confirm({
      title: '删除知识文档', content: `确认删除“${document.title}”？删除后 AI 将无法继续引用。`, okButtonProps: { danger: true },
      async onOk() {
        const response = await fetch(`/api/knowledge/documents/${document.id}`, { method: 'DELETE' })
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || '删除失败')
        message.success('知识文档已删除')
        setResults(current => current.filter(item => item.documentId !== document.id))
        if (viewing?.id === document.id) {
          setViewing(null)
          setDrawerOpen(false)
        }
        await loadDocuments()
      }
    })
  }

  const search = async () => {
    if (query.trim().length < 2) return message.warning('请输入至少 2 个字符')
    setLoading(true)
    try {
      const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '检索失败')
      setResults(payload.data || [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '检索失败')
    } finally { setLoading(false) }
  }

  const handleFile = async (file: File) => {
    if (file.size > 512_000) {
      message.error('单个知识文档不能超过 500KB')
      return Upload.LIST_IGNORE
    }
    const content = await file.text()
    form.setFieldsValue({
      title: form.getFieldValue('title') || file.name.replace(/\.[^.]+$/, ''),
      sourceType: 'upload', sourceName: file.name, mimeType: file.type || 'text/plain', content
    })
    message.success(`已读取 ${file.name}，保存后才会写入知识库`)
    return false
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Title level={2} className="!mb-1">知识管理</Title>
            <Text type="secondary">共享运行手册、故障案例和规范，并在智能助手中引用真实内容。</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增文档</Button>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Card><Statistic title="有效文档" value={stats.documents} prefix={<BookOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="检索分块" value={stats.chunks} prefix={<FileSearchOutlined />} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="知识标签" value={stats.tags} /></Card></Col>
        </Row>

        <Card title="知识检索" extra={<Tag color="blue">关键词检索</Tag>}>
          <Space.Compact className="w-full">
            <Input value={query} onChange={event => setQuery(event.target.value)} onPressEnter={search} placeholder="输入命令、组件、故障现象或标签" />
            <Button type="primary" icon={<FileSearchOutlined />} onClick={search}>检索</Button>
          </Space.Compact>
          {results.length > 0 && (
            <List className="mt-4" dataSource={results} renderItem={item => (
              <List.Item onClick={() => openView(documents.find(doc => doc.id === item.documentId) || ({ id: item.documentId } as RunbookDocument))} className="cursor-pointer">
                <List.Item.Meta title={<Space><span>{item.documentTitle}</span><Tag>{item.citation}</Tag></Space>} description={<Paragraph ellipsis={{ rows: 3 }} className="!mb-0">{item.content}</Paragraph>} />
              </List.Item>
            )} />
          )}
        </Card>

        <Card title="团队知识">
          <List loading={loading} dataSource={documents} locale={{ emptyText: <Empty description="暂无知识文档" /> }} renderItem={item => (
            <List.Item actions={[
              <Button key="view" type="link" onClick={() => openView(item)}>查看</Button>,
              <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => openEdit(item)} />,
              <Button key="delete" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(item)} />
            ]}>
              <List.Item.Meta
                avatar={<div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isDark ? 'bg-blue-500/15' : 'bg-blue-50'}`}><BookOutlined className="text-blue-500" /></div>}
                title={<Space wrap><span>{item.title}</span>{item.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</Space>}
                description={<Space wrap split="·"><span>{item.description || '暂无描述'}</span><span>{item._count?.chunks || 0} 个分块</span><span>更新于 {new Date(item.updatedAt).toLocaleString('zh-CN')}</span></Space>}
              />
            </List.Item>
          )} />
        </Card>
      </div>

      <Modal title={editing ? '编辑知识文档' : '新增知识文档'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={save} width={760} okText="保存入库">
        <Form form={form} layout="vertical" className="pt-3">
          <Row gutter={16}>
            <Col span={16}><Form.Item name="title" label="文档名称" rules={[{ required: true }]}><Input maxLength={255} /></Form.Item></Col>
            <Col span={8}><Form.Item name="sourceType" label="来源类型"><Select options={[{ value: 'manual', label: '手工录入' }, { value: 'upload', label: '文件上传' }, { value: 'incident', label: '事件复盘' }, { value: 'deployment', label: '交付记录' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="用途说明"><Input maxLength={2000} /></Form.Item>
          <Form.Item name="tags" label="知识标签"><Select mode="tags" tokenSeparators={[',', '，']} maxCount={30} /></Form.Item>
          {!editing && <Upload beforeUpload={handleFile} showUploadList={false} accept=".txt,.md,.log,.json,.yaml,.yml,.conf,.ini"><Button icon={<UploadOutlined />} className="mb-3">读取文本文件</Button></Upload>}
          <Form.Item name="sourceName" hidden><Input /></Form.Item>
          <Form.Item name="mimeType" hidden><Input /></Form.Item>
          <Form.Item name="content" label="正文内容" rules={[{ required: true }]} extra="最多 500KB；保存后会持久化并自动分块。"><TextArea rows={15} showCount maxLength={512000} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={viewing?.title} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={720}>
        {viewing && <>
          <Descriptions size="small" column={1} bordered items={[
            { key: 'source', label: '来源', children: viewing.sourceName || viewing.sourceType },
            { key: 'tags', label: '标签', children: <Space wrap>{viewing.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</Space> },
            { key: 'owner', label: '创建人', children: viewing.createdByName || '-' },
            { key: 'updated', label: '更新时间', children: new Date(viewing.updatedAt).toLocaleString('zh-CN') }
          ]} />
          <pre className={`mt-4 whitespace-pre-wrap break-words rounded-lg p-4 text-sm ${isDark ? 'bg-black/25 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>{viewing.content}</pre>
        </>}
      </Drawer>
    </MainLayout>
  )
}
