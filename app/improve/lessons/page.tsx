'use client'

/**
 * /improve/lessons — 教训库管理
 *
 * 三个 Tab：
 *   待审批  → 反思器产出的提案，需要 approve / reject
 *   生效中  → 已批准的 lesson，会被注入到 LLM system prompt
 *   已拒绝  → 历史拒绝记录，防反思器重复提
 *
 * 顶部操作：
 *   - "立即反思" 触发后端反思器，把最近 N 天的失败聚合成新提案
 *   - 过滤栏：skill / severity / scope
 *
 * 行操作：
 *   - 查看详情（Drawer 展示完整字段 + evidence outcomes）
 *   - 待审批行：批准 / 拒绝
 *   - 生效中行：删除
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
  Modal,
  Drawer,
  Form,
  message,
  Tabs,
  Switch,
  Row,
  Col,
  Statistic,
  Tooltip,
  Empty,
  Spin,
  Descriptions,
  Popconfirm,
  Alert,
} from 'antd'
import {
  BulbOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { useTheme } from '../../hooks/useGlobalState'
import { improveClient } from '../../utils/improveClient'
import type {
  Lesson,
  ProposedLesson,
  LessonSeverity,
  ReflectStatus,
  EffectivenessReport,
  EffectivenessVerdict,
} from '../../types/improve'

const { Title, Text, Paragraph } = Typography

// severity → Antd Tag 颜色
const SEVERITY_COLOR: Record<LessonSeverity, string> = {
  info: 'blue',
  warn: 'orange',
  critical: 'red',
}

const SOURCE_LABEL: Record<string, string> = {
  user: '人工写入',
  'auto-reflection': '反思器',
  'skill-failure': '失败自动转',
  'skill-patch': '补丁附带',
}

const LessonsPage: React.FC = () => {
  const { user } = useAuth()
  const { canAccessImprove } = usePermissions()
  const { isDark } = useTheme()
  const canWrite = canAccessImprove('write')

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [proposed, setProposed] = useState<ProposedLesson[]>([])
  const [searchSkill, setSearchSkill] = useState('')
  const [severityFilter, setSeverityFilter] = useState<LessonSeverity | ''>('')

  // 详情 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerData, setDrawerData] = useState<Lesson | ProposedLesson | null>(null)
  // Effectiveness 数据：仅当详情打开且当前是已生效 lesson 时拉取
  const [effLoading, setEffLoading] = useState(false)
  const [effData, setEffData] = useState<EffectivenessReport | null>(null)
  const [effError, setEffError] = useState<string | null>(null)

  // 列表级 effectiveness：仅"生效中" Tab 加载一次，按 lessonID → report 索引
  // 避免 N+1：单次 batch endpoint 拿完所有 lesson 的成绩单
  const [effIndex, setEffIndex] = useState<Record<string, EffectivenessReport>>({})
  const [effIndexLoading, setEffIndexLoading] = useState(false)

  // 批准 / 拒绝 Modal
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [actionTargetId, setActionTargetId] = useState<string>('')
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectForm] = Form.useForm<{ reason: string }>()

  // 反思 Modal
  const [reflectModalOpen, setReflectModalOpen] = useState(false)
  const [reflectLoading, setReflectLoading] = useState(false)
  const [reflectForm] = Form.useForm<{
    since_days: number
    min_failures: number
    use_llm: boolean
    llm_provider: string
    llm_base_url: string
    llm_api_key: string
    llm_model: string
  }>()
  // useLLM 的本地镜像，用于条件渲染（Form.Item dependencies 也可，但用 state 更直观）
  const [useLLM, setUseLLM] = useState(false)

  // 自动反思状态（用于顶部 alert）
  const [autoReflectStatus, setAutoReflectStatus] = useState<ReflectStatus | null>(null)

  // 新增 Lesson Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm<{
    skill_pattern: string
    text: string
    severity: LessonSeverity
    scope_project: string
    scope_cluster: string
  }>()

  // 加载数据
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      if (activeTab === 'pending') {
        const resp = await improveClient.listProposed('pending')
        setProposed(resp.proposed || [])
      } else if (activeTab === 'rejected') {
        const resp = await improveClient.listProposed('rejected')
        setProposed(resp.proposed || [])
      } else {
        // approved
        const resp = await improveClient.listLessons({
          skill: searchSkill || undefined,
        })
        let result = resp.lessons || []
        if (severityFilter) {
          result = result.filter((l) => l.severity === severityFilter)
        }
        setLessons(result)
      }
    } catch (e: any) {
      message.error(`加载失败：${e?.message || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [user, activeTab, searchSkill, severityFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 拉自动反思状态（与主数据并行；失败不影响主流）
  useEffect(() => {
    if (!user) return
    improveClient
      .getReflectStatus()
      .then((s) => setAutoReflectStatus(s))
      .catch(() => setAutoReflectStatus(null))
  }, [user, activeTab])

  // 列表级 effectiveness 索引：仅"生效中" Tab 拉一次
  // lessons 列表变化时也重拉（新增/删除后更新）
  useEffect(() => {
    if (!user || activeTab !== 'approved') {
      setEffIndex({})
      return
    }
    setEffIndexLoading(true)
    improveClient
      .getAllLessonsEffectiveness(7)
      .then((resp) => {
        const idx: Record<string, EffectivenessReport> = {}
        for (const item of resp.items || []) {
          if (item.lesson?.id && item.effectiveness) {
            idx[item.lesson.id] = item.effectiveness
          }
        }
        setEffIndex(idx)
      })
      .catch(() => setEffIndex({})) // 失败不影响主表展示
      .finally(() => setEffIndexLoading(false))
  }, [user, activeTab, lessons.length])

  // 详情
  const openDrawer = (data: Lesson | ProposedLesson) => {
    setDrawerData(data)
    setDrawerOpen(true)
    setEffData(null)
    setEffError(null)
    // 仅已生效 lesson 才有 effectiveness（proposed 没有 created_at 概念）
    if (activeTab === 'approved' && (data as Lesson).id) {
      setEffLoading(true)
      improveClient
        .getLessonEffectiveness((data as Lesson).id, 7)
        .then((rep) => setEffData(rep))
        .catch((e: any) => setEffError(e?.message || '加载效果度量失败'))
        .finally(() => setEffLoading(false))
    }
  }

  // 批准
  const onApprove = async (id: string) => {
    setActionTargetId(id)
    setApproveModalOpen(true)
  }
  const submitApprove = async () => {
    setActionLoading(true)
    try {
      await improveClient.approveProposal(actionTargetId)
      message.success('已批准并入库')
      setApproveModalOpen(false)
      loadData()
    } catch (e: any) {
      message.error(`批准失败：${e?.message || '未知错误'}`)
    } finally {
      setActionLoading(false)
    }
  }

  // 拒绝
  const onReject = (id: string) => {
    setActionTargetId(id)
    rejectForm.resetFields()
    setRejectModalOpen(true)
  }
  const submitReject = async () => {
    try {
      const values = await rejectForm.validateFields()
      setActionLoading(true)
      await improveClient.rejectProposal(actionTargetId, values.reason)
      message.success('已拒绝')
      setRejectModalOpen(false)
      loadData()
    } catch (e: any) {
      if (e?.message) message.error(`拒绝失败：${e.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // 删除 lesson
  const onDeleteLesson = async (id: string) => {
    try {
      await improveClient.deleteLesson(id)
      message.success('已删除')
      loadData()
    } catch (e: any) {
      message.error(`删除失败：${e?.message || '未知错误'}`)
    }
  }

  // 触发反思
  const submitReflect = async () => {
    try {
      const values = await reflectForm.validateFields()
      setReflectLoading(true)
      const payload: Parameters<typeof improveClient.triggerReflect>[0] = {
        since_seconds: values.since_days * 86400,
        min_failures: values.min_failures,
        use_llm: values.use_llm,
      }
      if (values.use_llm) {
        payload.llm_provider = values.llm_provider || 'openai-compatible'
        payload.llm_base_url = values.llm_base_url
        payload.llm_api_key = values.llm_api_key
        payload.llm_model = values.llm_model
      }
      const resp = await improveClient.triggerReflect(payload)
      message.success(
        `反思完成${resp.used_llm ? '（LLM）' : ''}：新增 ${resp.added} 条提案，跳过 ${resp.skipped}（待审批 ${resp.pending_total}）`
      )
      setReflectModalOpen(false)
      setActiveTab('pending')
      loadData()
    } catch (e: any) {
      if (e?.message) message.error(`反思失败：${e.message}`)
    } finally {
      setReflectLoading(false)
    }
  }

  // 创建 lesson
  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)
      await improveClient.createLesson({
        skill_pattern: values.skill_pattern || undefined,
        text: values.text,
        severity: values.severity || 'info',
        scope_project: values.scope_project || undefined,
        scope_cluster: values.scope_cluster || undefined,
      })
      message.success('已创建')
      setCreateModalOpen(false)
      createForm.resetFields()
      if (activeTab === 'approved') loadData()
    } catch (e: any) {
      if (e?.message) message.error(`创建失败：${e.message}`)
    } finally {
      setCreateLoading(false)
    }
  }

  // ---- 列定义 ----
  const proposedColumns = useMemo(
    () => [
      {
        title: '严重度',
        dataIndex: 'severity',
        key: 'severity',
        width: 90,
        render: (s: LessonSeverity) => (
          <Tag color={SEVERITY_COLOR[s] || 'default'}>{s}</Tag>
        ),
      },
      {
        title: 'Skill',
        dataIndex: 'skill_pattern',
        key: 'skill_pattern',
        width: 200,
        ellipsis: true,
        render: (v: string) => v || <Text type="secondary">全局</Text>,
      },
      {
        title: '教训内容',
        dataIndex: 'text',
        key: 'text',
        ellipsis: { showTitle: false },
        render: (v: string) => (
          <Tooltip title={v} placement="topLeft">
            <span>{v}</span>
          </Tooltip>
        ),
      },
      {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        width: 110,
        render: (s: string) => SOURCE_LABEL[s] || s,
      },
      {
        title: '提案时间',
        dataIndex: 'proposed_at',
        key: 'proposed_at',
        width: 170,
        render: (v: string) => new Date(v).toLocaleString('zh-CN'),
      },
      {
        title: '操作',
        key: 'action',
        width: 220,
        fixed: 'right' as const,
        render: (_: any, row: ProposedLesson) => (
          <Space size="small">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(row)}>
              详情
            </Button>
            {activeTab === 'pending' && canWrite && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => onApprove(row.id)}
                >
                  批准
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => onReject(row.id)}
                >
                  拒绝
                </Button>
              </>
            )}
          </Space>
        ),
      },
    ],
    [activeTab, canWrite]
  )

  const lessonColumns = useMemo(
    () => [
      {
        title: '严重度',
        dataIndex: 'severity',
        key: 'severity',
        width: 90,
        render: (s: LessonSeverity) => (
          <Tag color={SEVERITY_COLOR[s] || 'default'}>{s}</Tag>
        ),
      },
      {
        title: 'Skill',
        dataIndex: 'skill_pattern',
        key: 'skill_pattern',
        width: 200,
        ellipsis: true,
        render: (v: string) => v || <Text type="secondary">全局</Text>,
      },
      {
        title: '教训内容',
        dataIndex: 'text',
        key: 'text',
        ellipsis: { showTitle: false },
        render: (v: string) => (
          <Tooltip title={v} placement="topLeft">
            <span>{v}</span>
          </Tooltip>
        ),
      },
      {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        width: 110,
        render: (s: string) => SOURCE_LABEL[s] || s,
      },
      {
        title: '使用次数',
        dataIndex: 'usage_count',
        key: 'usage_count',
        width: 90,
        render: (n: number) => n || 0,
      },
      {
        title: '效果（7d）',
        key: 'effectiveness',
        width: 140,
        render: (_: any, row: Lesson) => {
          if (effIndexLoading && !effIndex[row.id]) {
            return <Spin size="small" />
          }
          const eff = effIndex[row.id]
          if (!eff) {
            return <Text type="secondary">—</Text>
          }
          const cfg = VERDICT_CONFIG[eff.verdict]
          // 改善/恶化时显示百分比；其他状态仅显示标签
          const showPct = eff.verdict === 'improved' || eff.verdict === 'worsened'
          const tooltip = (
            <div style={{ maxWidth: 280 }}>
              <div><b>{cfg?.label}</b></div>
              <div>baseline: {eff.failure_count_before} 次失败</div>
              <div>after:    {eff.failure_count_after} 次失败</div>
              {showPct && (
                <div>失败率变化 {eff.reduction_pct >= 0 ? '↓' : '↑'} {Math.abs(eff.reduction_pct).toFixed(1)}%</div>
              )}
              {eff.notes && <div style={{ marginTop: 4, opacity: 0.8 }}>{eff.notes}</div>}
            </div>
          )
          return (
            <Tooltip title={tooltip}>
              <Tag color={cfg?.color} style={{ cursor: 'help' }}>
                {cfg?.icon}{' '}
                {showPct
                  ? `${eff.reduction_pct >= 0 ? '↓' : '↑'} ${Math.abs(eff.reduction_pct).toFixed(0)}%`
                  : cfg?.label}
              </Tag>
            </Tooltip>
          )
        },
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 170,
        render: (v: string) => new Date(v).toLocaleString('zh-CN'),
      },
      {
        title: '操作',
        key: 'action',
        width: 160,
        fixed: 'right' as const,
        render: (_: any, row: Lesson) => (
          <Space size="small">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(row)}>
              详情
            </Button>
            {canWrite && (
              <Popconfirm
                title="确认删除？"
                description="删除后不可恢复"
                onConfirm={() => onDeleteLesson(row.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [canWrite, effIndex, effIndexLoading]
  )

  // Antd Table 的 dataSource 不支持联合类型，统一断言为 any[] 避免泛型冲突
  // 各列的 render 用具体类型（Lesson / ProposedLesson）取字段，运行时不会出错
  const tableData = (activeTab === 'approved' ? lessons : proposed) as any[]
  const columns = activeTab === 'approved' ? lessonColumns : proposedColumns

  return (
    <MainLayout>
      <div className="p-6">
        {/* 自动反思状态：仅 enabled 时显示 */}
        {autoReflectStatus?.enabled && <AutoReflectAlert status={autoReflectStatus} />}

        {/* Stats 顶卡 */}
        <Row gutter={16} className="mb-4">
          <Col span={8}>
            <Card>
              <Statistic
                title="生效中 lesson"
                value={activeTab === 'approved' ? lessons.length : '—'}
                prefix={<BulbOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="待审批提案"
                value={activeTab === 'pending' ? proposed.length : '—'}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="历史拒绝"
                value={activeTab === 'rejected' ? proposed.length : '—'}
                prefix={<CloseOutlined />}
                valueStyle={{ color: '#bfbfbf' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 主操作栏 */}
        <Card className="mb-4">
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Space wrap>
                <Input
                  placeholder="skill 名筛选（精确匹配）"
                  value={searchSkill}
                  onChange={(e) => setSearchSkill(e.target.value)}
                  onPressEnter={loadData}
                  allowClear
                  style={{ width: 220 }}
                />
                <Select
                  placeholder="severity"
                  value={severityFilter || undefined}
                  onChange={(v) => setSeverityFilter(v || '')}
                  allowClear
                  style={{ width: 140 }}
                  options={[
                    { value: 'info', label: 'info' },
                    { value: 'warn', label: 'warn' },
                    { value: 'critical', label: 'critical' },
                  ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>
                  刷新
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                {canWrite && (
                  <>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        createForm.resetFields()
                        setCreateModalOpen(true)
                      }}
                    >
                      手动新增
                    </Button>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={() => {
                        reflectForm.setFieldsValue({
                          since_days: 7,
                          min_failures: 2,
                          use_llm: false,
                          llm_provider: 'openai-compatible',
                          llm_base_url: '',
                          llm_api_key: '',
                          llm_model: '',
                        })
                        setUseLLM(false)
                        setReflectModalOpen(true)
                      }}
                    >
                      立即反思
                    </Button>
                  </>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 三 Tab + 表格 */}
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as any)}
            items={[
              { key: 'pending', label: '待审批' },
              { key: 'approved', label: '生效中' },
              { key: 'rejected', label: '已拒绝' },
            ]}
          />
          <Spin spinning={loading}>
            <Table
              rowKey="id"
              columns={columns as any}
              dataSource={tableData}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 1100 }}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      activeTab === 'pending'
                        ? '没有待审批提案。点击右上「立即反思」从历史失败里生成提案。'
                        : activeTab === 'approved'
                          ? '尚无生效 lesson。先去待审批批准一些，或手动新增。'
                          : '没有已拒绝记录'
                    }
                  />
                ),
              }}
            />
          </Spin>
        </Card>
      </div>

      {/* 详情 Drawer */}
      <Drawer
        title="详情"
        placement="right"
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawerData && (
          <>
            <LessonDetail data={drawerData} />
            {activeTab === 'approved' && (
              <EffectivenessSection
                loading={effLoading}
                data={effData}
                error={effError}
              />
            )}
          </>
        )}
      </Drawer>

      {/* 批准 Modal */}
      <Modal
        title="确认批准"
        open={approveModalOpen}
        onOk={submitApprove}
        onCancel={() => setApproveModalOpen(false)}
        confirmLoading={actionLoading}
        okText="确认批准"
        cancelText="取消"
      >
        <Paragraph>批准后会立即写入 lesson 库，被下次 LLM 会话注入到 prompt。</Paragraph>
      </Modal>

      {/* 拒绝 Modal */}
      <Modal
        title="拒绝提案"
        open={rejectModalOpen}
        onOk={submitReject}
        onCancel={() => setRejectModalOpen(false)}
        confirmLoading={actionLoading}
        okText="拒绝"
        cancelText="取消"
      >
        <Alert
          type="info"
          showIcon
          message="拒绝原因会被记录，反思器之后不会再提同样的提案。"
          className="mb-3"
        />
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="拒绝原因（必填）"
            rules={[{ required: true, message: '必须给一个原因' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：太具体不通用 / 该问题已通过 skill patch 解决" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 反思 Modal */}
      <Modal
        title="立即反思"
        open={reflectModalOpen}
        onOk={submitReflect}
        onCancel={() => setReflectModalOpen(false)}
        confirmLoading={reflectLoading}
        okText="开始"
        cancelText="取消"
        width={620}
      >
        <Paragraph>把最近 N 天的失败 outcome 聚合成 lesson 提案。同 args 签名失败超过阈值才入队。</Paragraph>
        <Form form={reflectForm} layout="vertical">
          <Form.Item
            name="since_days"
            label="回看时间窗（天）"
            rules={[{ required: true }]}
            initialValue={7}
          >
            <Select
              options={[
                { value: 1, label: '24 小时' },
                { value: 3, label: '3 天' },
                { value: 7, label: '7 天' },
                { value: 14, label: '14 天' },
                { value: 30, label: '30 天' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="min_failures"
            label="最小失败次数"
            rules={[{ required: true }]}
            initialValue={2}
            tooltip="同一 args 签名失败至少这么多次才起草提案；越大越保守"
          >
            <Select
              options={[
                { value: 2, label: '2 次' },
                { value: 3, label: '3 次' },
                { value: 5, label: '5 次' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="use_llm"
            label="用 LLM 起草人话教训"
            valuePropName="checked"
            tooltip="开启后调外部 LLM 生成口语化教训；失败自动退化到模板模式，不影响其他 group"
          >
            <Switch onChange={(v) => setUseLLM(v)} checkedChildren="LLM" unCheckedChildren="模板" />
          </Form.Item>

          {useLLM && (
            <>
              <Alert
                type="info"
                showIcon
                message="LLM 配置"
                description="支持任何 OpenAI 兼容端点（OpenAI / 阿里通义 / 百川 / DeepSeek 等）。可在 provider 字段填具体厂商使用内置适配器。"
                className="mb-3"
              />
              <Form.Item
                name="llm_provider"
                label="Provider"
                initialValue="openai-compatible"
                tooltip="留默认 openai-compatible 即可；显式填 deepseek/qwen/gemini 等也行"
              >
                <Select
                  options={[
                    { value: 'openai-compatible', label: 'openai-compatible（推荐）' },
                    { value: 'openai', label: 'openai' },
                    { value: 'deepseek', label: 'deepseek' },
                    { value: 'qwen', label: 'qwen（阿里通义）' },
                    { value: 'doubao', label: 'doubao（字节豆包）' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="llm_base_url"
                label="Base URL"
                rules={[{ required: useLLM, message: 'use_llm=true 时必填' }]}
              >
                <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
              </Form.Item>
              <Form.Item
                name="llm_model"
                label="Model"
                rules={[{ required: useLLM, message: 'use_llm=true 时必填' }]}
              >
                <Input placeholder="qwen-plus / deepseek-chat / gpt-4o-mini" />
              </Form.Item>
              <Form.Item
                name="llm_api_key"
                label="API Key"
                tooltip="为空时后端尝试从环境变量读取（如 DEEPSEEK_API_KEY）"
              >
                <Input.Password placeholder="可留空走环境变量" autoComplete="new-password" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 手动新增 Modal */}
      <Modal
        title="手动新增 lesson"
        open={createModalOpen}
        onOk={submitCreate}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="text"
            label="教训内容"
            rules={[{ required: true, message: '必填' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：升级 prod helm 前必须先 helm get values 备份" />
          </Form.Item>
          <Form.Item
            name="severity"
            label="严重度"
            initialValue="info"
          >
            <Select
              options={[
                { value: 'info', label: 'info（参考）' },
                { value: 'warn', label: 'warn（应注意）' },
                { value: 'critical', label: 'critical（严禁违反）' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="skill_pattern"
            label="Skill pattern（精确名 / glob / 留空＝全局）"
          >
            <Input placeholder="kubectl_set_image / helm_* / 留空" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="scope_project" label="项目作用域">
                <Input placeholder="billing" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scope_cluster" label="集群作用域">
                <Input placeholder="prod" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </MainLayout>
  )
}

// 详情子组件：用 Descriptions 展示所有字段
const LessonDetail: React.FC<{ data: Lesson | ProposedLesson }> = ({ data }) => {
  const isProposed = 'status' in data && (data as any).status

  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
      <Descriptions.Item label="严重度">
        <Tag color={SEVERITY_COLOR[data.severity] || 'default'}>{data.severity}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="Skill pattern">
        {data.skill_pattern || <Text type="secondary">全局</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="args 签名">
        {data.args_signature || <Text type="secondary">—</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="触发条件">
        {data.trigger || <Text type="secondary">—</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="教训内容">
        <Paragraph copyable={{ text: data.text }} style={{ marginBottom: 0 }}>
          {data.text}
        </Paragraph>
      </Descriptions.Item>
      <Descriptions.Item label="来源">{SOURCE_LABEL[data.source] || data.source}</Descriptions.Item>
      <Descriptions.Item label="项目作用域">
        {data.scope_project || <Text type="secondary">所有</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="集群作用域">
        {data.scope_cluster || <Text type="secondary">所有</Text>}
      </Descriptions.Item>
      {!isProposed && (
        <>
          <Descriptions.Item label="使用次数">
            {(data as Lesson).usage_count || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Embedding 模型">
            {(data as Lesson).embedding_model || <Text type="secondary">无</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date((data as Lesson).created_at).toLocaleString('zh-CN')}
          </Descriptions.Item>
        </>
      )}
      {isProposed && (
        <>
          <Descriptions.Item label="提案时间">
            {new Date((data as ProposedLesson).proposed_at).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{(data as ProposedLesson).status}</Tag>
          </Descriptions.Item>
          {(data as ProposedLesson).evidence_outcome_ids && (
            <Descriptions.Item label="证据 outcome">
              <Text type="secondary">
                {(data as ProposedLesson).evidence_outcome_ids?.length || 0} 条历史失败
              </Text>
            </Descriptions.Item>
          )}
          {(data as ProposedLesson).reject_reason && (
            <Descriptions.Item label="拒绝原因">
              {(data as ProposedLesson).reject_reason}
            </Descriptions.Item>
          )}
        </>
      )}
    </Descriptions>
  )
}

// EffectivenessSection：lesson 详情 Drawer 内的"效果度量"区。
// 仅在已生效 lesson 详情时渲染。失败安全：所有错误状态都有合理提示。
const VERDICT_CONFIG: Record<
  EffectivenessVerdict,
  { color: string; label: string; icon: string }
> = {
  improved: { color: 'green', label: '已改善', icon: '✅' },
  unchanged: { color: 'default', label: '无明显变化', icon: '➖' },
  worsened: { color: 'red', label: '反而变差', icon: '⚠️' },
  inconclusive: { color: 'orange', label: '数据不足', icon: '❔' },
  too_recent: { color: 'blue', label: '上线太新', icon: '⏳' },
}

const EffectivenessSection: React.FC<{
  loading: boolean
  data: EffectivenessReport | null
  error: string | null
}> = ({ loading, data, error }) => {
  return (
    <div style={{ marginTop: 24 }}>
      <Title level={5}>📊 效果度量（baseline 7 天）</Title>
      <Spin spinning={loading}>
        {error && <Alert type="error" showIcon message={error} />}
        {!loading && !error && data && (
          <>
            {/* 总判定 */}
            <Alert
              showIcon
              type={
                data.verdict === 'improved'
                  ? 'success'
                  : data.verdict === 'worsened'
                    ? 'error'
                    : data.verdict === 'too_recent' || data.verdict === 'inconclusive'
                      ? 'warning'
                      : 'info'
              }
              message={
                <Space>
                  <Text>
                    {VERDICT_CONFIG[data.verdict]?.icon}{' '}
                    <Tag color={VERDICT_CONFIG[data.verdict]?.color}>
                      {VERDICT_CONFIG[data.verdict]?.label}
                    </Tag>
                  </Text>
                  {data.verdict !== 'inconclusive' && data.verdict !== 'too_recent' && (
                    <Text strong>
                      失败率变化 {data.reduction_pct >= 0 ? '↓' : '↑'}{' '}
                      {Math.abs(data.reduction_pct).toFixed(1)}%
                    </Text>
                  )}
                </Space>
              }
              description={data.notes || undefined}
              className="mb-3"
            />

            {/* 详细数字 */}
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="上线时间">
                {new Date(data.approved_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="观察窗口">
                {data.after_days} 天（baseline {data.baseline_days} 天）
              </Descriptions.Item>
              <Descriptions.Item label="上线前失败">
                <Text strong>{data.failure_count_before}</Text> 次
                <Text type="secondary"> · {data.failures_per_day_before.toFixed(2)} 次/天</Text>
              </Descriptions.Item>
              <Descriptions.Item label="上线后失败">
                <Text strong>{data.failure_count_after}</Text> 次
                <Text type="secondary"> · {data.failures_per_day_after.toFixed(2)} 次/天</Text>
              </Descriptions.Item>
              <Descriptions.Item label="上线前成功">
                {data.success_count_before} 次
              </Descriptions.Item>
              <Descriptions.Item label="上线后成功">
                {data.success_count_after} 次
              </Descriptions.Item>
              {data.skill_pattern && (
                <Descriptions.Item label="度量范围" span={2}>
                  <Tag color="blue">skill = {data.skill_pattern}</Tag>
                  {data.args_signature && (
                    <Tag color="purple">args_sig = {data.args_signature}</Tag>
                  )}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Spin>
    </div>
  )
}

// AutoReflectAlert：顶部小卡片，展示自动定时反思的状态。
// 显示：上次跑时间 / 上次添加数 / 下次预计 / 设置摘要。
const AutoReflectAlert: React.FC<{ status: ReflectStatus }> = ({ status }) => {
  const lastRun = status.last_run_at ? new Date(status.last_run_at) : null
  const nextRun = status.next_run_at ? new Date(status.next_run_at) : null
  const intervalHours = status.interval_seconds
    ? (status.interval_seconds / 3600).toFixed(1)
    : '?'

  return (
    <Alert
      type={status.last_error ? 'warning' : 'success'}
      showIcon
      icon={<ThunderboltOutlined />}
      message={
        <Space wrap>
          <Text strong>自动反思已启用</Text>
          <Text type="secondary">·</Text>
          <Text>间隔 {intervalHours}h</Text>
          <Text type="secondary">·</Text>
          <Text>已运行 {status.total_runs || 0} 次</Text>
          <Text type="secondary">·</Text>
          <Text>累计新增 {status.total_added || 0} 条提案</Text>
        </Space>
      }
      description={
        <Space wrap size="middle">
          {lastRun && (
            <Tooltip title={lastRun.toLocaleString('zh-CN')}>
              <span>
                上次：{relativeTime(lastRun)}
                {status.last_added !== undefined && status.last_added > 0 && (
                  <Tag color="blue" style={{ marginLeft: 6 }}>+{status.last_added}</Tag>
                )}
              </span>
            </Tooltip>
          )}
          {nextRun && (
            <Tooltip title={nextRun.toLocaleString('zh-CN')}>
              <span>下次：{relativeTime(nextRun)}</span>
            </Tooltip>
          )}
          {status.last_error && (
            <Text type="danger">最近错误：{status.last_error}</Text>
          )}
        </Space>
      }
      className="mb-4"
    />
  )
}

// relativeTime 简单的相对时间："5 分钟前" / "2 小时后"。
function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime()
  const future = diff < 0
  const abs = Math.abs(diff)
  const min = Math.floor(abs / 60_000)
  const hr = Math.floor(abs / 3_600_000)
  const day = Math.floor(abs / 86_400_000)
  if (abs < 60_000) return future ? '马上' : '刚刚'
  if (min < 60) return future ? `${min} 分钟后` : `${min} 分钟前`
  if (hr < 24) return future ? `${hr} 小时后` : `${hr} 小时前`
  return future ? `${day} 天后` : `${day} 天前`
}

export default LessonsPage
