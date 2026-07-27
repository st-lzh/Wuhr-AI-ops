'use client'

import React, { CSSProperties, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme as antdTheme,
} from 'antd'
import {
  AlertOutlined,
  ApiOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  ExclamationCircleFilled,
  GlobalOutlined,
  ReloadOutlined,
  RobotOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useDashboard } from '../../hooks/useDashboard'
import { usePermissions } from '../../hooks/usePermissions'
import type { DashboardRange, DashboardTrendBucket } from '../../../lib/dashboard/metrics'
import type { DashboardActivity, DashboardPendingItem, DashboardSeverity } from '../../types/dashboard'

const { Title, Text } = Typography

const SEVERITY_COLORS: Record<DashboardSeverity, string> = {
  success: '#22c55e',
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#ef4444',
}

const RANGE_OPTIONS = [
  { label: '24小时', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
]

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return '时间未知'
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  const hours = Math.round(diffMinutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}天前`
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(value: number): string {
  if (!value) return '暂无样本'
  if (value < 1000) return `${value} ms`
  if (value < 60_000) return `${(value / 1000).toFixed(1)} 秒`
  return `${(value / 60_000).toFixed(1)} 分钟`
}

function severityTag(severity: DashboardSeverity) {
  const labels: Record<DashboardSeverity, string> = { success: '正常', info: '关注', warning: '警告', critical: '严重' }
  return <Tag color={SEVERITY_COLORS[severity]}>{labels[severity]}</Tag>
}

interface RiskCardProps {
  title: string
  value: number
  detail: string
  severity: DashboardSeverity
  icon: React.ReactNode
  href: string
}

const RiskCard: React.FC<RiskCardProps> = ({ title, value, detail, severity, icon, href }) => {
  const accent = value === 0 ? SEVERITY_COLORS.success : SEVERITY_COLORS[severity]
  return (
    <Link href={href} className="dashboard-kpi-link">
      <Card
        className="dashboard-surface dashboard-kpi h-full"
        styles={{ body: { padding: 18 } }}
        style={{ '--dashboard-accent': accent } as CSSProperties}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Text type="secondary" className="text-sm">{title}</Text>
            <Statistic value={value} valueStyle={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }} />
            <Text type="secondary" className="block truncate text-xs" title={detail}>{detail}</Text>
          </div>
          <div className="dashboard-kpi-icon" style={{ color: accent, background: `${accent}18` }}>{icon}</div>
        </div>
      </Card>
    </Link>
  )
}

function activityIcon(type: DashboardActivity['type']) {
  switch (type) {
    case 'ai': return <RobotOutlined />
    case 'deployment': return <DeploymentUnitOutlined />
    case 'server_alert': return <CloudServerOutlined />
    case 'network_alert':
    case 'network_change': return <GlobalOutlined />
    case 'automation': return <ThunderboltOutlined />
    case 'incident': return <AlertOutlined />
    default: return <ApiOutlined />
  }
}

function pendingIcon(item: DashboardPendingItem) {
  if (item.type === 'network') return <GlobalOutlined />
  if (item.type === 'automation') return <ThunderboltOutlined />
  if (item.type === 'deployment' || item.type === 'jenkins') return <RocketOutlined />
  return <SafetyCertificateOutlined />
}

interface TrendChartProps {
  data: DashboardTrendBucket[]
  textColor: string
  gridColor: string
}

/** 小数据量运维趋势图，使用原生 SVG，避免首屏引入复杂图形运行时。 */
const OperationsTrendChart: React.FC<TrendChartProps> = ({ data, textColor, gridColor }) => {
  const width = 760
  const height = 270
  const padding = { top: 18, right: 18, bottom: 42, left: 42 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const series = [
    { key: 'deployments' as const, name: '部署任务', color: '#3b82f6' },
    { key: 'aiExecutions' as const, name: 'AI 执行', color: '#8b5cf6' },
    { key: 'alerts' as const, name: '新增告警', color: '#f59e0b' },
  ]
  const maxValue = Math.max(1, ...data.flatMap(bucket => series.map(item => bucket[item.key])))
  const yMax = Math.max(4, Math.ceil(maxValue / 4) * 4)
  const x = (index: number) => padding.left + (index / Math.max(data.length - 1, 1)) * plotWidth
  const y = (value: number) => padding.top + plotHeight - (value / yMax) * plotHeight
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div className="dashboard-svg-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="部署任务、AI 执行和新增告警趋势">
        {Array.from({ length: 5 }, (_, index) => {
          const value = Math.round((yMax / 4) * index)
          const yPosition = y(value)
          return (
            <g key={value}>
              <line x1={padding.left} x2={width - padding.right} y1={yPosition} y2={yPosition} stroke={gridColor} strokeWidth="1" />
              <text x={padding.left - 10} y={yPosition + 4} fill={textColor} fontSize="11" textAnchor="end">{value}</text>
            </g>
          )
        })}
        {series.map(item => {
          const points = data.map((bucket, index) => `${x(index)},${y(bucket[item.key])}`).join(' ')
          return (
            <g key={item.key}>
              <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((bucket, index) => (
                <circle key={bucket.key} cx={x(index)} cy={y(bucket[item.key])} r="3" fill={item.color}>
                  <title>{`${bucket.label} · ${item.name} ${bucket[item.key]}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {data.map((bucket, index) => (index % labelStep === 0 || index === data.length - 1) && (
          <text key={bucket.key} x={x(index)} y={height - 14} fill={textColor} fontSize="11" textAnchor="middle">{bucket.label}</text>
        ))}
      </svg>
      <div className="dashboard-svg-legend">
        {series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.name}</span>)}
      </div>
    </div>
  )
}

const AssetHealthRing: React.FC<{ healthy: number; total: number; rate: number; textColor: string; trackColor: string }> = ({ healthy, total, rate, textColor, trackColor }) => {
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? circumference * rate / 100 : 0
  return (
    <div className="dashboard-health-ring">
      <svg viewBox="0 0 180 180" role="img" aria-label={`资产健康率 ${rate}%`}>
        <circle cx="90" cy="90" r={radius} fill="none" stroke={trackColor} strokeWidth="17" />
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#22c55e" strokeWidth="17" strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`} transform="rotate(-90 90 90)" />
        <text x="90" y="86" fill={textColor} textAnchor="middle" fontSize="27" fontWeight="700">{rate}%</text>
        <text x="90" y="108" fill={textColor} opacity="0.68" textAnchor="middle" fontSize="12">{healthy}/{total} 台健康</text>
      </svg>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const [range, setRange] = useState<DashboardRange>('7d')
  const { data, loading, refreshing, error, refresh } = useDashboard(range)
  const { token } = antdTheme.useToken()
  const { canAccessAI, canAccessServers, canAccessNetwork, canAccessCICD } = usePermissions()

  const quickActions = [
    canAccessAI('write') && { label: '智能助手', href: '/ai/system', icon: <RobotOutlined /> },
    canAccessServers('write') && { label: '添加主机', href: '/servers/list', icon: <CloudServerOutlined /> },
    canAccessNetwork('write') && { label: '添加设备', href: '/network/devices', icon: <GlobalOutlined /> },
    canAccessCICD('write') && { label: '发起部署', href: '/cicd/deployments', icon: <RocketOutlined /> },
  ].filter(Boolean) as Array<{ label: string; href: string; icon: React.ReactNode }>

  if (loading && !data) {
    return <div className="dashboard-shell"><Skeleton active paragraph={{ rows: 16 }} /></div>
  }

  if (error && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message="仪表盘数据加载失败"
        description={error}
        action={<Button icon={<ReloadOutlined />} onClick={refresh}>重新加载</Button>}
      />
    )
  }

  if (!data) return null

  const generatedAt = new Date(data.generatedAt).toLocaleString('zh-CN', { hour12: false })
  const trendTotal = data.trend.reduce((sum, item) => sum + item.deployments + item.aiExecutions + item.alerts, 0)

  return (
    <div className="dashboard-shell space-y-5">
      <section className="dashboard-heading">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Title level={2} className="!mb-0">全局态势</Title>
            <Badge status={data.risk.criticalAlerts > 0 ? 'error' : data.risk.pendingApprovals > 0 ? 'warning' : 'success'} />
          </div>
          <Text type="secondary">统一查看资产健康、风险待办、交付质量和 Agent 执行效果</Text>
        </div>
        <div className="dashboard-heading-actions">
          <Space wrap size={8}>
            {quickActions.map(action => (
              <Link href={action.href} key={action.href}>
                <Button icon={action.icon}>{action.label}</Button>
              </Link>
            ))}
          </Space>
          <Space wrap size={8}>
            <Segmented options={RANGE_OPTIONS} value={range} onChange={value => setRange(value as DashboardRange)} />
            <Tooltip title={`数据生成时间：${generatedAt}`}>
              <Button icon={<ReloadOutlined />} loading={refreshing} onClick={refresh}>刷新</Button>
            </Tooltip>
          </Space>
        </div>
      </section>

      {error && <Alert type="warning" showIcon message="自动刷新失败，当前展示上一次成功数据" description={error} />}
      {data.warnings.map(warning => <Alert key={warning} type="warning" showIcon message={warning} />)}

      <section aria-label="风险概览" className="dashboard-risk-grid">
        <RiskCard title="待审事项" value={data.risk.pendingApprovals} detail="注册、交付、Jenkins 与网络变更" severity="warning" icon={<ClockCircleOutlined />} href="/notifications" />
        <RiskCard title="严重告警" value={data.risk.criticalAlerts} detail={`主机 ${data.risk.serverCriticalAlerts} · 网络 ${data.risk.networkCriticalAlerts} · 事件 ${data.risk.operationalCriticalIncidents}`} severity="critical" icon={<AlertOutlined />} href="/events" />
        <RiskCard title="异常资产" value={data.risk.unhealthyAssets} detail={`共纳管 ${data.assets.total} 台资产`} severity="warning" icon={<CloudServerOutlined />} href="/servers/list" />
        <RiskCard title="失败任务" value={data.risk.failedTasks} detail={`构建 ${data.delivery.buildFailures} · 自动化 ${data.risk.failedAutomationRuns}`} severity="critical" icon={<ExclamationCircleFilled />} href="/operations/runs" />
        <RiskCard title="高危变更" value={data.risk.highRiskChanges} detail="待审批的高风险网络操作" severity="critical" icon={<WarningOutlined />} href="/network/changes" />
      </section>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={16}>
          <Card
            className="dashboard-surface h-full"
            title={<Space><ThunderboltOutlined style={{ color: '#3b82f6' }} /><span>运营趋势</span></Space>}
            extra={<Text type="secondary">部署 / AI / 告警</Text>}
          >
            {trendTotal > 0
              ? <OperationsTrendChart data={data.trend} textColor={token.colorTextSecondary} gridColor={token.colorBorderSecondary} />
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所选时间范围暂无操作数据" />}
            <div className="dashboard-chart-summary">
              <span><i style={{ background: '#ef4444' }} />部署失败 {data.trend.reduce((sum, item) => sum + item.deploymentFailures, 0)}</span>
              <span><i style={{ background: '#f59e0b' }} />AI 失败 {data.trend.reduce((sum, item) => sum + item.aiFailures, 0)}</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="dashboard-surface h-full" title={<Space><CloudServerOutlined style={{ color: '#22c55e' }} /><span>资产健康</span></Space>}>
            {data.assets.total > 0
              ? <AssetHealthRing healthy={data.assets.healthy} total={data.assets.total} rate={data.assets.healthRate} textColor={token.colorText} trackColor={token.colorFillSecondary} />
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未纳管资产" />}
            <div className="dashboard-asset-breakdown">
              <div><Text type="secondary">主机资产</Text><strong>{data.assets.hosts.online}/{data.assets.hosts.total}</strong><small>在线 / 总数</small></div>
              <div><Text type="secondary">网络设备</Text><strong>{data.assets.networkDevices.online}/{data.assets.networkDevices.total}</strong><small>在线 / 总数</small></div>
              <div><Text type="secondary">集群资源</Text><strong>{data.assets.clusters.online}/{data.assets.clusters.total}</strong><small>在线 / 总数</small></div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} lg={12}>
          <Card className="dashboard-surface h-full" title={<Space><DeploymentUnitOutlined style={{ color: '#8b5cf6' }} /><span>交付质量</span></Space>} extra={<Link href="/cicd/projects">进入交付</Link>}>
            <div className="dashboard-quality-layout">
              <Progress
                type="dashboard"
                percent={data.delivery.successRate}
                size={150}
                strokeColor={data.delivery.successRate >= 90 ? '#22c55e' : data.delivery.successRate >= 70 ? '#f59e0b' : '#ef4444'}
                format={percent => <div><strong>{percent}%</strong><small>成功率</small></div>}
              />
              <div className="dashboard-metric-grid">
                <div><Text type="secondary">部署总数</Text><strong>{data.delivery.total}</strong></div>
                <div><Text type="secondary">执行成功</Text><strong className="dashboard-success-text">{data.delivery.success}</strong></div>
                <div><Text type="secondary">执行失败</Text><strong className="dashboard-danger-text">{data.delivery.failed}</strong></div>
                <div><Text type="secondary">执行中</Text><strong>{data.delivery.running}</strong></div>
                <div><Text type="secondary">已回滚</Text><strong>{data.delivery.rolledBack}</strong></div>
                <div><Text type="secondary">平均耗时</Text><strong>{formatDuration(data.delivery.averageDurationMs)}</strong></div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="dashboard-surface h-full" title={<Space><RobotOutlined style={{ color: '#3b82f6' }} /><span>智能运营</span></Space>} extra={<Link href="/improve/outcomes">执行记录</Link>}>
            {data.ai.available ? (
              <>
                <div className="dashboard-ai-summary">
                  <div><Text type="secondary">技能执行</Text><Statistic value={data.ai.executions} suffix="次" /></div>
                  <div><Text type="secondary">执行成功率</Text><Statistic value={data.ai.successRate} suffix="%" valueStyle={{ color: data.ai.successRate >= 90 ? '#22c55e' : '#f59e0b' }} /></div>
                  <div><Text type="secondary">团队对话</Text><Statistic value={data.ai.chatSessions} suffix="次" /></div>
                  <div><Text type="secondary">平均耗时</Text><strong>{formatDuration(data.ai.averageDurationMs)}</strong></div>
                </div>
                <div className="dashboard-skill-list">
                  <Text type="secondary">高频技能</Text>
                  <Space wrap size={[6, 6]}>
                    {data.ai.topSkills.length > 0
                      ? data.ai.topSkills.slice(0, 5).map(skill => <Tag key={skill.name}>{skill.name} · {skill.count}</Tag>)
                      : <Text type="secondary">所选范围暂无技能执行</Text>}
                  </Space>
                </div>
              </>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="AI 执行数据源暂不可用" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={9}>
          <Card className="dashboard-surface h-full" title={<Space><SafetyCertificateOutlined style={{ color: '#f59e0b' }} /><span>风险待办</span></Space>} extra={<Link href="/notifications">查看全部</Link>}>
            <List
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待处理审批" /> }}
              dataSource={data.pendingItems}
              renderItem={item => (
                <List.Item className="dashboard-list-item" extra={severityTag(item.severity)}>
                  <List.Item.Meta
                    avatar={<div className="dashboard-list-icon" style={{ color: SEVERITY_COLORS[item.severity], background: `${SEVERITY_COLORS[item.severity]}18` }}>{pendingIcon(item)}</div>}
                    title={<Link href={item.href}>{item.title}</Link>}
                    description={<><Text type="secondary" ellipsis={{ tooltip: item.description }}>{item.description}</Text><small>{formatRelativeTime(item.createdAt)}</small></>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={15}>
          <Card className="dashboard-surface h-full" title={<Space><ClockCircleOutlined style={{ color: '#3b82f6' }} /><span>事件动态</span></Space>} extra={<Text type="secondary">跨系统按真实时间排序</Text>}>
            {data.recentActivities.length > 0 ? (
              <Timeline
                className="dashboard-timeline"
                items={data.recentActivities.map(item => ({
                  color: SEVERITY_COLORS[item.status],
                  dot: activityIcon(item.type),
                  children: (
                    <div className="dashboard-timeline-row">
                      <div><Link href={item.href}><Text strong>{item.title}</Text></Link><Text type="secondary" className="block">{item.description}</Text></div>
                      <Text type="secondary" className="whitespace-nowrap text-xs">{formatRelativeTime(item.occurredAt)}</Text>
                    </div>
                  ),
                }))}
              />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所选范围暂无事件" />}
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-surface" title={<Space><ApiOutlined style={{ color: '#22c55e' }} /><span>服务状态</span></Space>} extra={<Text type="secondary">最近更新 {generatedAt}</Text>}>
        <Row gutter={[12, 12]}>
          {data.services.map(service => (
            <Col xs={24} sm={12} xl={6} key={service.key}>
              <div className="dashboard-service-item">
                {service.status === 'healthy'
                  ? <CheckCircleFilled className="dashboard-success-text" />
                  : <ExclamationCircleFilled className="dashboard-danger-text" />}
                <div className="min-w-0 flex-1"><Text strong>{service.name}</Text><Text type="secondary" className="block truncate" title={service.description}>{service.description}</Text></div>
                {typeof service.latencyMs === 'number' && <Tag>{service.latencyMs} ms</Tag>}
              </div>
            </Col>
          ))}
        </Row>
        <div className="dashboard-source-row">
          {Object.entries(data.dataSources).map(([key, source]) => (
            <Tooltip key={key} title={source.message || source.name}>
              <Tag color={source.status === 'healthy' ? 'success' : source.status === 'hidden' ? 'default' : source.status === 'degraded' ? 'warning' : 'error'}>
                {source.name} · {source.status === 'healthy' ? '正常' : source.status === 'hidden' ? '无权限' : source.status === 'degraded' ? '部分异常' : '不可用'}
              </Tag>
            </Tooltip>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default Dashboard
