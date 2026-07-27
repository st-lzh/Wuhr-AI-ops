'use client'

import React, { useState } from 'react'
import { Alert, Button, Descriptions, List, Modal, Space, Tag, Tooltip, Typography } from 'antd'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import type { ButtonProps } from 'antd'
import type { CICDContextSelection } from '../../types/cicd-ai'

const { Paragraph, Text } = Typography

export type CICDReportType =
  | 'project_health'
  | 'pipeline_optimization'
  | 'build_diagnosis'
  | 'pre_deploy_risk'
  | 'post_deploy_verification'

const REPORT_LABELS: Record<CICDReportType, string> = {
  project_health: '项目健康',
  pipeline_optimization: '流水优化',
  build_diagnosis: '构建诊断',
  pre_deploy_risk: '发布门禁',
  post_deploy_verification: '效果验证'
}

const VERDICT_META: Record<string, { color: string; text: string }> = {
  pass: { color: 'success', text: '通过' },
  warn: { color: 'warning', text: '警告' },
  block: { color: 'error', text: '阻止' },
  unknown: { color: 'default', text: '未知' }
}

interface Props {
  context: CICDContextSelection
  reportType: CICDReportType
  label?: string
  iconOnly?: boolean
  size?: ButtonProps['size']
  type?: ButtonProps['type']
}

const CICDAIReportButton: React.FC<Props> = ({
  context,
  reportType,
  label,
  iconOnly = false,
  size = 'small',
  type = 'text'
}) => {
  const [loading, setLoading] = useState(false)

  const generate = () => {
    const isVerification = reportType === 'post_deploy_verification'
    Modal.confirm({
      title: `生成${REPORT_LABELS[reportType]}报告`,
      okText: '开始生成',
      cancelText: '取消',
      content: isVerification
        ? '系统会执行部署配置中已经保存的 HTTP 健康检查，并调用当前模型生成总结；检查结果和报告都会持久化。'
        : '系统会读取数据库中的真实状态、日志和配置，运行确定性质量检查，再调用当前模型生成并持久化报告。',
      onOk: async () => {
        setLoading(true)
        try {
          const response = await fetch('/api/ai/cicd/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportType, ...context })
          })
          const payload = await response.json()
          if (!response.ok || !payload.success) throw new Error(payload.error || '报告生成失败')
          const report = payload.data
          const gate = report.qualityGate || {}
          const verdict = VERDICT_META[report.verdict] || VERDICT_META.unknown
          Modal.info({
            title: `${REPORT_LABELS[reportType]} · ${verdict.text}`,
            width: 920,
            okText: '关闭',
            content: (
              <Space direction="vertical" size="middle" className="w-full">
                <Alert
                  type={report.verdict === 'block' ? 'error' : report.verdict === 'warn' ? 'warning' : 'success'}
                  showIcon
                  message={<Space><Tag color={verdict.color}>{verdict.text}</Tag><Text>{report.summary}</Text></Space>}
                  description={`报告已持久化，编号：${report.id}`}
                />
                <Descriptions size="small" bordered column={3}>
                  <Descriptions.Item label="模型">{report.modelName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="风险">{report.riskLevel || '-'}</Descriptions.Item>
                  <Descriptions.Item label="完成时间">{report.completedAt ? new Date(report.completedAt).toLocaleString() : '-'}</Descriptions.Item>
                </Descriptions>
                <div>
                  <Text strong>确定性检查</Text>
                  <List
                    size="small"
                    dataSource={Array.isArray(gate.checks) ? gate.checks : []}
                    renderItem={(check: any) => (
                      <List.Item>
                        <Space><Tag color={VERDICT_META[check.status]?.color || 'default'}>{VERDICT_META[check.status]?.text || check.status}</Tag><Text strong>{check.label}</Text><Text>{check.message}</Text></Space>
                      </List.Item>
                    )}
                  />
                </div>
                <div><Text strong>AI 分析</Text><Paragraph className="whitespace-pre-wrap mt-2">{report.analysis}</Paragraph></div>
                <div>
                  <Text strong>后续建议</Text>
                  <List size="small" dataSource={Array.isArray(report.recommendations) ? report.recommendations : []} renderItem={(item: string, index) => <List.Item>{index + 1}. {item}</List.Item>} />
                </div>
                <Button href="/cicd/ai-reports" target="_blank">查看历史报告</Button>
              </Space>
            )
          })
        } catch (error) {
          Modal.error({
            title: `${REPORT_LABELS[reportType]}报告生成失败`,
            content: `${error instanceof Error ? error.message : '未知错误'}。失败状态也已写入报告记录。`
          })
        } finally {
          setLoading(false)
        }
      }
    })
  }

  return (
    <Tooltip title={`生成并持久化${REPORT_LABELS[reportType]}报告`}>
      <Button
        type={type}
        size={size}
        icon={<SafetyCertificateOutlined />}
        loading={loading}
        onClick={generate}
        aria-label={label || REPORT_LABELS[reportType]}
      >
        {iconOnly ? null : label || REPORT_LABELS[reportType]}
      </Button>
    </Tooltip>
  )
}

export default CICDAIReportButton
