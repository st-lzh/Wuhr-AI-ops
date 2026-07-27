'use client'

/**
 * /improve/skills — 技能库浏览器
 *
 * 设计：
 *   - 顶部：搜索 + category 过滤 + 内置/文件 toggle
 *   - 主表：name / category / approval / idempotent / executor type / 操作
 *   - 点详情 → Drawer 展示完整 SkillDetail（含 executor.Command 源码、parameters schema、hooks）
 *
 * 数据走前端代理 /api/improve/skills（list）+ /api/improve/skills/[name]（detail）
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Drawer,
  message,
  Row,
  Col,
  Statistic,
  Tooltip,
  Empty,
  Spin,
  Descriptions,
  Tabs,
  Alert,
  Form,
  Modal,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  ToolOutlined,
  CodeOutlined,
  SafetyOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SaveOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useGlobalState'
import { improveClient } from '../../utils/improveClient'
import type { SkillSummary, SkillDetail, SkillDryRunResponse, SkillSourceResponse } from '../../types/improve'

const { Title, Text, Paragraph } = Typography

// approval policy → Tag 颜色
const APPROVAL_COLOR: Record<string, string> = {
  none: 'default',
  always: 'red',
  risk_based: 'orange',
}

const APPROVAL_LABEL: Record<string, string> = {
  none: '免审批',
  always: '总是审批',
  risk_based: '按风险',
  '': '默认',
}

const SkillsPage: React.FC = () => {
  const { user } = useAuth()
  const { canAccessImprove } = usePermissions()
  const canWrite = canAccessImprove('write')
  const { isDark } = useTheme()

  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [builtinFilter, setBuiltinFilter] = useState<'all' | 'builtin' | 'file'>('all')

  // 详情 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerData, setDrawerData] = useState<SkillDetail | null>(null)

  // 新建 Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createContent, setCreateContent] = useState('')

  // 新建模板：markdown 风格，YAML frontmatter 用 --- 包起来，下面写人类可读说明
  // 用户点开新建时自动填入这段，告诉客户"照葫芦画瓢"
  const SKILL_TEMPLATE = `---
name: my_new_skill
description: 一句话描述这个技能干嘛（LLM 看这句决定要不要调用）
category: custom
tags: [custom]
parameters:
  - name: target
    type: string
    required: true
    description: 要操作的目标
executor:
  type: shell
  command: echo "hello, {{ .target }}"
  timeout: 30
approval_policy: none
idempotent: true
---

# 我的新技能

## 功能说明
描述一下这个 skill 在干什么。

## 使用场景
- 场景 1
- 场景 2

## 示例
- "示例提问 1"
- "示例提问 2"
`

  const openCreate = () => {
    setCreateName('')
    setCreateContent(SKILL_TEMPLATE)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    const name = createName.trim()
    if (!name) {
      message.error('请填写 skill 名称')
      return
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      message.error('名称仅支持字母 / 数字 / 下划线 / 连字符，最长 64 字符')
      return
    }
    if (!createContent.trim()) {
      message.error('内容不能为空')
      return
    }
    // 关键提示：文件里的 name 必须 == 表单 name
    if (!new RegExp(`(^|\\n)name:\\s*${name}(\\s|$)`).test(createContent)) {
      message.error(`内容里的 name: 字段必须等于 "${name}"`)
      return
    }
    setCreateSubmitting(true)
    try {
      const r = await improveClient.createSkill(name, createContent)
      message.success(`新建成功：${r.source_file}`)
      setCreateOpen(false)
      await loadData()
    } catch (e: any) {
      message.error(`新建失败：${e?.message || '未知错误'}`)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const resp = await improveClient.listSkills({
        search: searchText || undefined,
        category: categoryFilter || undefined,
      })
      let result = resp.skills || []
      if (builtinFilter === 'builtin') {
        result = result.filter((s) => s.is_builtin)
      } else if (builtinFilter === 'file') {
        result = result.filter((s) => !s.is_builtin)
      }
      setSkills(result)
    } catch (e: any) {
      message.error(`加载失败：${e?.message || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [user, searchText, categoryFilter, builtinFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 拉详情（含 executor.Command 源码）
  const openDetail = async (name: string) => {
    setDrawerOpen(true)
    setDrawerLoading(true)
    setDrawerData(null)
    try {
      const detail = await improveClient.getSkill(name)
      setDrawerData(detail)
    } catch (e: any) {
      message.error(`获取详情失败：${e?.message || '未知错误'}`)
    } finally {
      setDrawerLoading(false)
    }
  }

  // 从当前 skills 列表提取所有 category（去重）
  const allCategories = useMemo(() => {
    const set = new Set<string>()
    skills.forEach((s) => s.category && set.add(s.category))
    return Array.from(set).sort()
  }, [skills])

  // Stats
  const stats = useMemo(() => {
    return {
      total: skills.length,
      builtin: skills.filter((s) => s.is_builtin).length,
      file: skills.filter((s) => !s.is_builtin).length,
      alwaysApproval: skills.filter((s) => s.approval_policy === 'always').length,
    }
  }, [skills])

  const columns = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        ellipsis: true,
        render: (v: string, row: SkillSummary) => (
          <Space size={4}>
            <Text strong>{v}</Text>
            {row.is_builtin && <Tag color="blue">builtin</Tag>}
          </Space>
        ),
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        width: 110,
        render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: { showTitle: false },
        render: (v: string) => (
          <Tooltip title={v} placement="topLeft">
            <span>{v}</span>
          </Tooltip>
        ),
      },
      {
        title: '执行器',
        dataIndex: 'executor_type',
        key: 'executor_type',
        width: 100,
        render: (v: string) => v ? <Tag color="purple">{v}</Tag> : '—',
      },
      {
        title: '审批策略',
        dataIndex: 'approval_policy',
        key: 'approval_policy',
        width: 110,
        render: (v: string) => (
          <Tag color={APPROVAL_COLOR[v] || 'default'}>
            {APPROVAL_LABEL[v] || v || '默认'}
          </Tag>
        ),
      },
      {
        title: '幂等',
        dataIndex: 'idempotent',
        key: 'idempotent',
        width: 70,
        render: (v: boolean) => v ? <Tag color="green">✓</Tag> : <Text type="secondary">—</Text>,
      },
      {
        title: '参数',
        dataIndex: 'param_count',
        key: 'param_count',
        width: 70,
        render: (v: number) => v || 0,
      },
      {
        title: 'Hooks',
        key: 'hooks',
        width: 110,
        render: (_: any, row: SkillSummary) => {
          const total = (row.pre_hooks || 0) + (row.post_hooks || 0) + (row.on_failure || 0)
          if (total === 0) return <Text type="secondary">—</Text>
          return (
            <Tooltip
              title={
                <div>
                  pre: {row.pre_hooks || 0} · post: {row.post_hooks || 0} · on_failure: {row.on_failure || 0}
                </div>
              }
            >
              <Tag>{total}</Tag>
            </Tooltip>
          )
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 90,
        fixed: 'right' as const,
        render: (_: any, row: SkillSummary) => (
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(row.name)}>
            详情
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <MainLayout>
      <div className="p-6">
        {/* Stats */}
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card>
              <Statistic
                title="技能总数"
                value={stats.total}
                prefix={<ToolOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="内置"
                value={stats.builtin}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="文件加载"
                value={stats.file}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="始终需要审批"
                value={stats.alwaysApproval}
                valueStyle={{ color: '#f5222d' }}
                prefix={<SafetyOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 过滤栏 */}
        <Card className="mb-4">
          <Space wrap>
            <Input
              placeholder="搜索 name / description / tags"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={loadData}
              allowClear
              style={{ width: 280 }}
            />
            <Select
              placeholder="分类"
              value={categoryFilter || undefined}
              onChange={(v) => setCategoryFilter(v || '')}
              allowClear
              style={{ width: 160 }}
              options={allCategories.map((c) => ({ value: c, label: c }))}
            />
            <Select
              value={builtinFilter}
              onChange={setBuiltinFilter}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '全部来源' },
                { value: 'builtin', label: '仅内置' },
                { value: 'file', label: '仅文件' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新建技能
              </Button>
            )}
          </Space>
        </Card>

        {/* 主表 */}
        <Card>
          <Spin spinning={loading}>
            <Table
              rowKey="name"
              columns={columns}
              dataSource={skills}
              pagination={{ pageSize: 30, showSizeChanger: true }}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: <Empty description="无 skill；后端可能没注册 builtin / file skill" />,
              }}
            />
          </Spin>
        </Card>
      </div>

      {/* 新建技能 Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>新建技能</span>
          </Space>
        }
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        confirmLoading={createSubmitting}
        okText="创建并启用"
        cancelText="取消"
        width={760}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          className="mb-3"
          message="文件会写入服务器 --skills-dir 目录，创建后立即对 LLM 可见（无需重启）"
          description={`内容里的 name: 字段必须与下方"名称"完全一致；不能撞内置 skill 或已有 file skill。`}
        />
        <Form layout="vertical">
          <Form.Item label="名称" required tooltip="文件名 + skill name，仅字母/数字/_/-，最长 64">
            <Input
              placeholder="例如：check_redis_ping"
              value={createName}
              onChange={(e) => {
                const v = e.target.value
                setCreateName(v)
                // 自动同步内容里的 name: 字段，省得用户改两处
                setCreateContent((prev) =>
                  prev.replace(/(^|\n)name:\s*[^\n]*/, `$1name: ${v}`)
                )
              }}
              maxLength={64}
            />
          </Form.Item>
          <Form.Item
            label="Skill 定义（YAML 风格）"
            required
            tooltip="必填字段：name / description / executor.type / executor.command"
          >
            <Input.TextArea
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              autoSize={{ minRows: 14, maxRows: 28 }}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                background: isDark ? '#1f1f1f' : '#fafafa',
              }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={
          <Space>
            <CodeOutlined />
            <span>Skill 详情：{drawerData?.name || '加载中'}</span>
          </Space>
        }
        placement="right"
        width={800}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Spin spinning={drawerLoading}>
          {drawerData && <SkillDetailView data={drawerData} isDark={isDark} canWrite={canWrite} />}
        </Spin>
      </Drawer>
    </MainLayout>
  )
}

// SourcePanel 子组件：编辑 file skill 的原始 YAML/MD 源文件
// 仅当 data.is_builtin=false 时这个 Tab 可点；点开才拉数据（懒加载）
//
// 编辑流：拉 → 显示在 TextArea → 改 → 保存（PUT）→ 后端校验 + 原子写 + reload → 刷新本地
// 保存失败显示 backend 返回的 validation_failed / name_mismatch 等具体原因
const SourcePanel: React.FC<{
  skillName: string
  canWrite: boolean
  isDark: boolean
}> = ({ skillName, canWrite, isDark }) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SkillSourceResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // 编辑态：当前 TextArea 里的内容；与 data.content 不同时视为 dirty
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    setErr(null)
    setSaveErr(null)
    improveClient
      .getSkillSource(skillName)
      .then((d) => {
        setData(d)
        setDraft(d.content)
      })
      .catch((e: any) => setErr(e?.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillName])

  const handleDownload = () => {
    if (!data) return
    const blob = new Blob([draft], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const fname = data.source_file.split('/').pop() || `${data.name}.yaml`
    a.download = fname
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    setSaveErr(null)
    try {
      await improveClient.updateSkillSource(skillName, draft)
      message.success('已保存并重载')
      reload() // 拉回服务端权威版（含可能的格式化差异）
    } catch (e: any) {
      // backend 错误码：validation_failed / name_mismatch / single_skill_required / ...
      setSaveErr(`${e?.code ? `[${e.code}] ` : ''}${e?.message || '保存失败'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (data) setDraft(data.content)
    setSaveErr(null)
  }

  if (loading && !data) return <Spin />
  if (err) return <Alert type="error" showIcon message={err} />
  if (!data) return null

  const isDirty = draft !== data.content

  return (
    <>
      <Alert
        type={canWrite ? 'info' : 'warning'}
        showIcon
        message={canWrite ? '可编辑' : '无 improve:write 权限，只读'}
        description={`源文件：${data.source_file}（${data.size_bytes} bytes，加载时）`}
        className="mb-3"
      />

      {saveErr && (
        <Alert
          type="error"
          showIcon
          message="保存失败"
          description={saveErr}
          closable
          onClose={() => setSaveErr(null)}
          className="mb-3"
        />
      )}

      <div style={{ marginBottom: 8 }}>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!canWrite || !isDirty}
          >
            保存
          </Button>
          <Button
            onClick={handleReset}
            disabled={!isDirty || saving}
          >
            撤销
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            下载 YAML
          </Button>
          {isDirty && <Tag color="orange">未保存改动</Tag>}
        </Space>
      </div>

      <Input.TextArea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoSize={{ minRows: 16, maxRows: 30 }}
        spellCheck={false}
        readOnly={!canWrite}
        style={{
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 12,
          background: isDark ? '#1e1e1e' : '#fafafa',
          color: isDark ? '#d4d4d4' : '#333',
          tabSize: 2,
        }}
      />
    </>
  )
}

// Dry-run 子组件：根据 parameters schema 动态生成表单，提交后 POST /skills/{name}/dry-run
const DryRunPanel: React.FC<{ data: SkillDetail; codeBlockStyle: React.CSSProperties }> = ({ data, codeBlockStyle }) => {
  const [form] = Form.useForm()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SkillDryRunResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const onRun = async () => {
    setErr(null)
    setResult(null)
    setRunning(true)
    try {
      const values = await form.validateFields()
      // 清掉 undefined / 空字符串
      const args: Record<string, any> = {}
      for (const [k, v] of Object.entries(values)) {
        if (v !== undefined && v !== '') args[k] = v
      }
      const resp = await improveClient.dryRunSkill(data.name, args)
      setResult(resp)
    } catch (e: any) {
      if (e?.errorFields) {
        // 表单校验失败
        return
      }
      setErr(e?.message || '未知错误')
    } finally {
      setRunning(false)
    }
  }

  const params = data.parameters || []

  return (
    <>
      <Alert
        type="info"
        showIcon
        message="Dry-run：渲染命令但不真正执行"
        description="跑这个不会改任何资源；用来确认参数填得对、模板渲染没问题。需要 admin 用户。"
        className="mb-3"
      />
      {params.length === 0 ? (
        <Paragraph type="secondary">此 skill 无参数；可直接点 "运行 Dry-run"。</Paragraph>
      ) : (
        <Form form={form} layout="vertical">
          {params.map((p: any) => {
            const required = !!p.required
            const rules = required ? [{ required: true, message: '必填' }] : []
            // 用枚举 → Select；否则 Input
            if (Array.isArray(p.enum) && p.enum.length > 0) {
              return (
                <Form.Item
                  key={p.name}
                  name={p.name}
                  label={
                    <Space size={4}>
                      <Text code>{p.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ({p.type})
                      </Text>
                      {required && <Tag color="red">必填</Tag>}
                    </Space>
                  }
                  tooltip={p.description}
                  rules={rules}
                  initialValue={p.default}
                >
                  <Select
                    placeholder={p.description}
                    options={p.enum.map((v: any) => ({ value: v, label: String(v) }))}
                    allowClear={!required}
                  />
                </Form.Item>
              )
            }
            return (
              <Form.Item
                key={p.name}
                name={p.name}
                label={
                  <Space size={4}>
                    <Text code>{p.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({p.type})
                    </Text>
                    {required && <Tag color="red">必填</Tag>}
                  </Space>
                }
                tooltip={p.description}
                rules={rules}
                initialValue={p.default}
              >
                <Input placeholder={p.description || ''} />
              </Form.Item>
            )
          })}
        </Form>
      )}
      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        onClick={onRun}
        loading={running}
        style={{ marginTop: 8 }}
      >
        运行 Dry-run
      </Button>

      {err && <Alert type="error" showIcon className="mt-3" message={err} />}

      {result && (
        <div style={{ marginTop: 16 }}>
          <Title level={5}>渲染结果</Title>
          {result.result.command && (
            <>
              <Text type="secondary">主命令：</Text>
              <pre style={codeBlockStyle}>{result.result.command}</pre>
            </>
          )}
          {result.result.stdout && (
            <>
              <Text type="secondary">stdout：</Text>
              <pre style={codeBlockStyle}>{result.result.stdout}</pre>
            </>
          )}
          {result.result.stderr && (
            <>
              <Text type="secondary">stderr：</Text>
              <pre style={codeBlockStyle}>{result.result.stderr}</pre>
            </>
          )}
          {result.result.error && (
            <Alert type="error" showIcon message={`执行错误：${result.result.error}`} className="mt-3" />
          )}
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            ✓ dry_run = {String(result.result.dry_run)} · exit_code = {result.result.exit_code ?? '—'}
          </Paragraph>
        </div>
      )}
    </>
  )
}

const SkillDetailView: React.FC<{ data: SkillDetail; isDark: boolean; canWrite: boolean }> = ({ data, isDark, canWrite }) => {
  const codeBlockStyle: React.CSSProperties = {
    background: isDark ? '#1e1e1e' : '#f5f5f5',
    color: isDark ? '#d4d4d4' : '#333',
    padding: 12,
    borderRadius: 4,
    overflowX: 'auto',
    maxHeight: 400,
    margin: 0,
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  }

  return (
    <Tabs
      items={[
        {
          key: 'overview',
          label: '概览',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="名称">{data.name}</Descriptions.Item>
              <Descriptions.Item label="描述">
                <Paragraph copyable={{ text: data.description }} style={{ marginBottom: 0 }}>
                  {data.description}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="分类">{data.category || '—'}</Descriptions.Item>
              <Descriptions.Item label="标签">
                {data.tags && data.tags.length > 0
                  ? data.tags.map((t) => <Tag key={t}>{t}</Tag>)
                  : <Text type="secondary">无</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {data.is_builtin ? <Tag color="blue">内置</Tag> : <Tag color="green">文件加载</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="版本">{data.version || '—'}</Descriptions.Item>
              <Descriptions.Item label="执行器类型">
                {data.executor_type ? <Tag color="purple">{data.executor_type}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="审批策略">
                <Tag color={APPROVAL_COLOR[data.approval_policy || ''] || 'default'}>
                  {APPROVAL_LABEL[data.approval_policy || ''] || data.approval_policy || '默认'}
                </Tag>
                {data.risk_override && (
                  <Tag color="orange">风险覆写: {data.risk_override}</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="幂等">
                {data.idempotent ? <Tag color="green">是</Tag> : <Text type="secondary">否</Text>}
                {data.has_check && <Tag color="cyan" style={{ marginLeft: 6 }}>带 Check</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Hooks">
                pre: {data.pre_hooks} · post: {data.post_hooks} · on_failure: {data.on_failure}
              </Descriptions.Item>
              <Descriptions.Item label="参数数量">{data.param_count}</Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: 'executor',
          label: (
            <Space size={4}>
              <CodeOutlined />
              <span>Executor 源码</span>
            </Space>
          ),
          children: (
            <>
              <Alert
                type="info"
                showIcon
                message="这是 skill 的实际执行模板（Go template 语法），参数会在执行时被填充。"
                className="mb-3"
              />
              <Title level={5}>主步骤命令</Title>
              {data.executor?.command ? (
                <pre style={codeBlockStyle}>{data.executor.command}</pre>
              ) : (
                <Empty description="无 command（可能是 http 类型）" />
              )}
              {data.executor?.url && (
                <>
                  <Title level={5} style={{ marginTop: 16 }}>HTTP 配置</Title>
                  <pre style={codeBlockStyle}>{JSON.stringify({ url: data.executor.url, method: data.executor.method, headers: data.executor.headers }, null, 2)}</pre>
                </>
              )}
              {data.executor?.env && data.executor.env.length > 0 && (
                <>
                  <Title level={5} style={{ marginTop: 16 }}>环境变量</Title>
                  <pre style={codeBlockStyle}>{JSON.stringify(data.executor.env, null, 2)}</pre>
                </>
              )}
              {data.check && (
                <>
                  <Title level={5} style={{ marginTop: 16 }}>Check 命令（幂等性预探测）</Title>
                  <pre style={codeBlockStyle}>{data.check.command || '—'}</pre>
                  <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                    退出码 0 → 已是目标状态，主步骤被短路；否则执行主步骤。
                  </Paragraph>
                </>
              )}
            </>
          ),
        },
        {
          key: 'params',
          label: (
            <Space size={4}>
              <ApiOutlined />
              <span>参数 schema</span>
            </Space>
          ),
          children: (
            <>
              {!data.parameters || data.parameters.length === 0 ? (
                <Empty description="此 skill 无参数" />
              ) : (
                <Table
                  size="small"
                  rowKey="name"
                  pagination={false}
                  dataSource={data.parameters}
                  columns={[
                    { title: '名称', dataIndex: 'name', key: 'name', width: 140, render: (v: string) => <Text code>{v}</Text> },
                    { title: '类型', dataIndex: 'type', key: 'type', width: 90, render: (v: string) => <Tag>{v}</Tag> },
                    { title: '必填', dataIndex: 'required', key: 'required', width: 70, render: (v: boolean) => v ? <Tag color="red">必填</Tag> : '可选' },
                    { title: '默认值', dataIndex: 'default', key: 'default', width: 140, render: (v: any) => v === undefined || v === null ? '—' : <Text code>{String(v)}</Text> },
                    {
                      title: '说明',
                      dataIndex: 'description',
                      key: 'description',
                      ellipsis: true,
                    },
                    {
                      title: '枚举',
                      dataIndex: 'enum',
                      key: 'enum',
                      width: 180,
                      render: (v: any[]) => v && v.length > 0 ? v.map((x) => <Tag key={String(x)}>{String(x)}</Tag>) : '—',
                    },
                  ]}
                />
              )}
            </>
          ),
        },
        {
          key: 'hooks',
          label: 'Hooks',
          disabled: data.pre_hooks + data.post_hooks + data.on_failure === 0,
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              {data.pre_hooks > 0 && (
                <>
                  <Title level={5}>Pre Hooks（{data.pre_hooks}）</Title>
                  <pre style={codeBlockStyle}>{JSON.stringify(data.pre_hooks_detail, null, 2)}</pre>
                </>
              )}
              {data.post_hooks > 0 && (
                <>
                  <Title level={5}>Post Hooks（{data.post_hooks}）</Title>
                  <pre style={codeBlockStyle}>{JSON.stringify(data.post_hooks_detail, null, 2)}</pre>
                </>
              )}
              {data.on_failure > 0 && (
                <>
                  <Title level={5}>On Failure Hooks（{data.on_failure}）</Title>
                  <pre style={codeBlockStyle}>{JSON.stringify(data.on_failure_detail, null, 2)}</pre>
                </>
              )}
            </Space>
          ),
        },
        {
          key: 'outputs',
          label: 'Outputs',
          disabled: !data.outputs || data.outputs.length === 0,
          children: (
            <>
              <Alert
                type="info"
                showIcon
                message="Outputs 是 skill 执行后从 stdout/stderr 抽取的命名变量，供 pre/post hooks 和后续 chain 消费。"
                className="mb-3"
              />
              <pre style={codeBlockStyle}>{JSON.stringify(data.outputs, null, 2)}</pre>
            </>
          ),
        },
        {
          key: 'dryrun',
          label: (
            <Space size={4}>
              <ThunderboltOutlined />
              <span>Dry-run</span>
            </Space>
          ),
          children: <DryRunPanel data={data} codeBlockStyle={codeBlockStyle} />,
        },
        {
          key: 'source',
          label: (
            <Space size={4}>
              <FileTextOutlined />
              <span>源文件</span>
              {data.is_builtin && <Tag color="default">仅 file skill 可读</Tag>}
            </Space>
          ),
          disabled: data.is_builtin,
          children: <SourcePanel skillName={data.name} canWrite={canWrite} isDark={isDark} />,
        },
      ]}
    />
  )
}

export default SkillsPage
