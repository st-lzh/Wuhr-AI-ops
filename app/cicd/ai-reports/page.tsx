'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, List, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import MainLayout from '../../components/layout/MainLayout'

const { Title, Paragraph, Text } = Typography

const TYPE_LABELS: Record<string, string> = {
  project_health: '项目健康',
  pipeline_optimization: '流水优化',
  build_diagnosis: '构建诊断',
  pre_deploy_risk: '发布门禁',
  post_deploy_verification: '效果验证'
}
const VERDICTS: Record<string, { color: string; text: string }> = {
  pass: { color: 'success', text: '通过' },
  warn: { color: 'warning', text: '警告' },
  block: { color: 'error', text: '阻止' },
  unknown: { color: 'default', text: '未知' }
}

const AIReportsPage: React.FC = () => {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState<string>()
  const [verdict, setVerdict] = useState<string>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const loadReports = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.pageSize) })
      if (reportType) params.set('reportType', reportType)
      if (verdict) params.set('verdict', verdict)
      const response = await fetch(`/api/ai/cicd/reports?${params}`)
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || '读取报告失败')
      setReports(payload.data.reports)
      setPagination(current => ({ ...current, current: page, total: payload.data.pagination.total }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '读取报告失败')
    } finally {
      setLoading(false)
    }
  }

  const showDetail = (report: any) => {
    const gate = report.qualityGate || {}
    Modal.info({
      title: `${TYPE_LABELS[report.reportType] || report.reportType} · ${report.id}`,
      width: 960,
      okText: '关闭',
      content: (
        <Space direction="vertical" size="middle" className="w-full">
          {report.status === 'failed' ? (
            <Alert type="error" showIcon message="报告生成失败" description={report.error} />
          ) : (
            <Alert type={report.verdict === 'block' ? 'error' : report.verdict === 'warn' ? 'warning' : 'success'} showIcon message={report.summary} />
          )}
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="质量结论">{VERDICTS[report.verdict]?.text || report.verdict}</Descriptions.Item>
            <Descriptions.Item label="报告状态">{report.status}</Descriptions.Item>
            <Descriptions.Item label="模型">{report.modelName || '-'}</Descriptions.Item>
            <Descriptions.Item label="生成时间">{new Date(report.createdAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="项目">{report.project?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="发布/构建">{report.deployment?.name || (report.build ? `${report.build.jenkinsJobName} #${report.build.buildNumber}` : '-')}</Descriptions.Item>
          </Descriptions>
          <div><Text strong>质量检查</Text><List size="small" dataSource={Array.isArray(gate.checks) ? gate.checks : []} renderItem={(item: any) => <List.Item><Space><Tag color={VERDICTS[item.status]?.color || 'default'}>{VERDICTS[item.status]?.text || item.status}</Tag><Text strong>{item.label}</Text><Text>{item.message}</Text></Space></List.Item>} /></div>
          <div><Text strong>分析内容</Text><Paragraph className="whitespace-pre-wrap mt-2">{report.analysis || '-'}</Paragraph></div>
          <div><Text strong>建议事项</Text><List size="small" dataSource={Array.isArray(report.recommendations) ? report.recommendations : []} renderItem={(item: string, index) => <List.Item>{index + 1}. {item}</List.Item>} /></div>
        </Space>
      )
    })
  }

  const columns: ColumnsType<any> = [
    { title: '报告类型', dataIndex: 'reportType', render: value => TYPE_LABELS[value] || value },
    { title: '关联对象', render: (_, row) => row.deployment?.name || row.build?.jenkinsJobName || row.pipeline?.name || row.project?.name || '-' },
    { title: '结论', dataIndex: 'verdict', render: value => <Tag color={VERDICTS[value]?.color || 'default'}>{VERDICTS[value]?.text || value}</Tag> },
    { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'completed' ? 'green' : value === 'failed' ? 'red' : 'blue'}>{value}</Tag> },
    { title: '摘要', dataIndex: 'summary', ellipsis: true, render: value => value || '-' },
    { title: '模型', dataIndex: 'modelName', render: value => value || '-' },
    { title: '生成时间', dataIndex: 'createdAt', render: value => new Date(value).toLocaleString() },
    { title: '操作', render: (_, row) => <Button type="link" onClick={() => showDetail(row)}>查看详情</Button> }
  ]

  useEffect(() => { loadReports(1) }, [reportType, verdict])

  return (
    <MainLayout>
      <div className="p-6">
        <Title level={2}><SafetyCertificateOutlined className="mr-2" />智能报告</Title>
        <Paragraph>持久化保存项目评估、构建诊断、发布门禁与发布后真实验证结果。</Paragraph>
        <Card className="mb-4">
          <Space wrap>
            <Select allowClear placeholder="报告类型" style={{ width: 180 }} value={reportType} onChange={setReportType} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
            <Select allowClear placeholder="质量结论" style={{ width: 140 }} value={verdict} onChange={setVerdict} options={Object.entries(VERDICTS).filter(([key]) => key !== 'unknown').map(([value, item]) => ({ value, label: item.text }))} />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadReports(pagination.current)}>刷新</Button>
          </Space>
        </Card>
        <Card>
          <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, onChange: loadReports }} />
        </Card>
      </div>
    </MainLayout>
  )
}

export default AIReportsPage
