'use client'

/**
 * /improve/outcomes — skill 执行历史时间线
 *
 * 顶部：聚合统计（成功 / 失败 / TopK skill / 平均时长）
 * 主表：按时间倒序，可按 skill / status / 时间窗过滤
 * 行点击：Drawer 显示完整 outcome（args / stderr_tail / stdout_tail）
 *
 * 数据来源：后端 /api/v1/improve/outcomes 走代理。
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
  Dropdown,
  Empty,
  Spin,
  Descriptions,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ForwardOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { useAuth } from '../../hooks/useAuth'
import { improveClient } from '../../utils/improveClient'
import type { Outcome, OutcomeStats, OutcomeStatus } from '../../types/improve'

const { Title, Text, Paragraph } = Typography

const STATUS_TAG: Record<OutcomeStatus, { color: string; icon: React.ReactNode; label: string }> = {
  success: { color: 'green', icon: <CheckCircleOutlined />, label: 'success' },
  failure: { color: 'red', icon: <CloseCircleOutlined />, label: 'failure' },
  error: { color: 'orange', icon: <ExclamationCircleOutlined />, label: 'error' },
  skipped: { color: 'default', icon: <ForwardOutlined />, label: 'skipped' },
}

const TIME_WINDOWS: { label: string; seconds: number }[] = [
  { label: '最近 1 小时', seconds: 3600 },
  { label: '最近 24 小时', seconds: 24 * 3600 },
  { label: '最近 7 天', seconds: 7 * 24 * 3600 },
  { label: '最近 30 天', seconds: 30 * 24 * 3600 },
]

const OutcomesPage: React.FC = () => {
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [stats, setStats] = useState<OutcomeStats | null>(null)
  const [sinceSeconds, setSinceSeconds] = useState<number>(24 * 3600)
  const [skillFilter, setSkillFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<OutcomeStatus | ''>('')
  const [limit] = useState(200)

  // 详情 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerData, setDrawerData] = useState<Outcome | null>(null)

  // 触发浏览器下载：拼当前过滤参数到 export URL，由 Next.js 代理 + 后端透传 Content-Disposition
  const triggerExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams()
    params.set('format', format)
    if (sinceSeconds) params.set('since_seconds', String(sinceSeconds))
    if (skillFilter) params.set('skill', skillFilter)
    if (statusFilter) params.set('status', statusFilter)
    const url = `/api/improve/outcomes/export?${params.toString()}`
    // 直接打开新标签触发下载（受 Cookie 同源认证）
    window.open(url, '_blank')
  }

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [listResp, statsResp] = await Promise.all([
        improveClient.listOutcomes({
          since_seconds: sinceSeconds,
          skill: skillFilter || undefined,
          status: statusFilter || undefined,
          limit,
        }),
        improveClient.getOutcomeStats(sinceSeconds),
      ])
      setOutcomes(listResp.outcomes || [])
      setStats(statsResp)
    } catch (e: any) {
      message.error(`加载失败：${e?.message || '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [user, sinceSeconds, skillFilter, statusFilter, limit])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openDrawer = (row: Outcome) => {
    setDrawerData(row)
    setDrawerOpen(true)
  }

  const columns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 170,
        render: (v: string) => new Date(v).toLocaleString('zh-CN'),
      },
      {
        title: 'Skill',
        dataIndex: 'skill_name',
        key: 'skill_name',
        width: 200,
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (s: OutcomeStatus) => {
          const cfg = STATUS_TAG[s] || STATUS_TAG.error
          return (
            <Tag color={cfg.color} icon={cfg.icon}>
              {cfg.label}
            </Tag>
          )
        },
      },
      {
        title: '退出码',
        dataIndex: 'exit_code',
        key: 'exit_code',
        width: 80,
      },
      {
        title: 'Actor',
        dataIndex: 'actor',
        key: 'actor',
        width: 130,
        render: (v: string) => v || <Text type="secondary">—</Text>,
      },
      {
        title: '耗时',
        dataIndex: 'duration_ms',
        key: 'duration_ms',
        width: 80,
        render: (n: number) => formatDuration(n),
      },
      {
        title: '错误片段',
        dataIndex: 'stderr_tail',
        key: 'stderr_tail',
        ellipsis: { showTitle: false },
        render: (v: string) =>
          v ? (
            <Tooltip title={<pre style={{ whiteSpace: 'pre-wrap' }}>{v}</pre>} placement="topLeft">
              <span>{v}</span>
            </Tooltip>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: '操作',
        key: 'action',
        width: 90,
        fixed: 'right' as const,
        render: (_: any, row: Outcome) => (
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(row)}>
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
                title="总执行次数"
                value={stats?.total ?? 0}
                prefix={<HistoryOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功"
                value={stats?.success ?? 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="失败"
                value={(stats?.failure ?? 0) + (stats?.error ?? 0)}
                valueStyle={{ color: '#f5222d' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均耗时"
                value={formatDuration(stats?.avg_ms ?? 0)}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Top skills */}
        {stats?.top_skills && stats.top_skills.length > 0 && (
          <Card className="mb-4" size="small" title="高频 skill (按调用次数)">
            <Space wrap>
              {stats.top_skills.map((sk) => (
                <Tag
                  key={sk.name}
                  color="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSkillFilter(sk.name)
                  }}
                >
                  {sk.name} · {sk.count}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {/* 过滤栏 */}
        <Card className="mb-4">
          <Space wrap>
            <Select
              value={sinceSeconds}
              onChange={setSinceSeconds}
              style={{ width: 160 }}
              options={TIME_WINDOWS.map((w) => ({ value: w.seconds, label: w.label }))}
            />
            <Input
              placeholder="skill 精确名"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              onPressEnter={loadData}
              allowClear
              style={{ width: 200 }}
            />
            <Select
              placeholder="状态"
              value={statusFilter || undefined}
              onChange={(v) => setStatusFilter(v || '')}
              allowClear
              style={{ width: 140 }}
              options={[
                { value: 'success', label: 'success' },
                { value: 'failure', label: 'failure' },
                { value: 'error', label: 'error' },
                { value: 'skipped', label: 'skipped' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            <Dropdown
              menu={{
                items: [
                  { key: 'csv', label: '下载 CSV（Excel 友好）', onClick: () => triggerExport('csv') },
                  { key: 'json', label: '下载 JSON（含完整字段）', onClick: () => triggerExport('json') },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>导出</Button>
            </Dropdown>
          </Space>
        </Card>

        {/* 主表 */}
        <Card>
          <Spin spinning={loading}>
            <Table
              rowKey={(row) => `${row.timestamp}-${row.skill_name}-${row.args_signature}`}
              columns={columns}
              dataSource={outcomes}
              pagination={{ pageSize: 30, showSizeChanger: true }}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      sinceSeconds <= 24 * 3600
                        ? '该时间窗内没有 outcome；试试更长的时间窗，或确认后端启动时带了 --improve-enabled'
                        : '没有匹配的 outcome'
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
        title="Outcome 详情"
        placement="right"
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawerData && <OutcomeDetail data={drawerData} />}
      </Drawer>
    </MainLayout>
  )
}

const OutcomeDetail: React.FC<{ data: Outcome }> = ({ data }) => {
  const cfg = STATUS_TAG[data.status] || STATUS_TAG.error
  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="时间">
        {new Date(data.timestamp).toLocaleString('zh-CN')}
      </Descriptions.Item>
      <Descriptions.Item label="Skill">{data.skill_name}</Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={cfg.color} icon={cfg.icon}>
          {cfg.label}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="退出码">{data.exit_code}</Descriptions.Item>
      <Descriptions.Item label="Actor">{data.actor || '—'}</Descriptions.Item>
      <Descriptions.Item label="耗时">{formatDuration(data.duration_ms ?? 0)}</Descriptions.Item>
      <Descriptions.Item label="Args 签名">
        <Text code>{data.args_signature}</Text>
      </Descriptions.Item>
      {data.dry_run && (
        <Descriptions.Item label="Dry-run">
          <Tag color="purple">dry-run（未真正执行）</Tag>
        </Descriptions.Item>
      )}
      {data.skipped && (
        <Descriptions.Item label="幂等跳过">
          <Tag>已是目标状态，主步骤被短路</Tag>
        </Descriptions.Item>
      )}
      {data.args && Object.keys(data.args).length > 0 && (
        <Descriptions.Item label="参数">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(data.args, null, 2)}
          </pre>
        </Descriptions.Item>
      )}
      {data.error && (
        <Descriptions.Item label="工具错误">
          <Text type="danger">{data.error}</Text>
        </Descriptions.Item>
      )}
      {data.stderr_tail && (
        <Descriptions.Item label="stderr 尾部">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 220, overflow: 'auto' }}>
            {data.stderr_tail}
          </pre>
        </Descriptions.Item>
      )}
      {data.stdout_tail && (
        <Descriptions.Item label="stdout 尾部">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 220, overflow: 'auto' }}>
            {data.stdout_tail}
          </pre>
        </Descriptions.Item>
      )}
    </Descriptions>
  )
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default OutcomesPage
