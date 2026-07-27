'use client'

import React from 'react'
import { Button, Tooltip } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { ButtonProps } from 'antd'
import type { CICDContextSelection } from '../../types/cicd-ai'

export type CICDAssistantIntent = 'diagnose' | 'risk' | 'status' | 'optimize'

const INTENT_LABELS: Record<CICDAssistantIntent, string> = {
  diagnose: 'AI诊断',
  risk: 'AI评估',
  status: 'AI状态',
  optimize: 'AI优化'
}

const INTENT_TOOLTIPS: Record<CICDAssistantIntent, string> = {
  diagnose: '带着真实日志和状态进入 AI 助手定位故障',
  risk: '带着当前配置和审批状态进入 AI 助手评估风险',
  status: '带着当前对象进入 AI 助手汇总状态',
  optimize: '带着流水线阶段和最近构建进入 AI 助手分析优化空间'
}

export function buildCICDAssistantUrl(
  context: CICDContextSelection,
  intent: CICDAssistantIntent
) {
  const params = new URLSearchParams({ intent })
  if (context.projectId) params.set('projectId', context.projectId)
  if (context.pipelineId) params.set('pipelineId', context.pipelineId)
  if (context.deploymentId) params.set('deploymentId', context.deploymentId)
  if (context.buildId) params.set('buildId', context.buildId)
  // 使用 URL 片段传递助手上下文，避免认证跳转或中间件重定向时丢失查询参数。
  // 片段只包含数据库 ID 和意图，真正的对象内容仍由登录后的服务端解析。
  return `/ai/system#${params.toString()}`
}

interface CICDAssistantButtonProps {
  context: CICDContextSelection
  intent: CICDAssistantIntent
  label?: string
  tooltip?: string
  type?: ButtonProps['type']
  size?: ButtonProps['size']
  block?: boolean
  iconOnly?: boolean
}

/**
 * CI/CD 页面进入 AI 助手的统一入口。只携带数据库对象 ID 和分析意图，
 * 不自动发送消息，也不会直接触发构建、发布或回滚。
 */
const CICDAssistantButton: React.FC<CICDAssistantButtonProps> = ({
  context,
  intent,
  label,
  tooltip,
  type = 'default',
  size = 'middle',
  block,
  iconOnly = false
}) => {
  const hasContext = !!(context.projectId || context.pipelineId || context.deploymentId || context.buildId)
  const url = buildCICDAssistantUrl(context, intent)

  return (
    <Tooltip title={tooltip || INTENT_TOOLTIPS[intent]}>
      <Button
        type={type}
        size={size}
        block={block}
        disabled={!hasContext}
        icon={<RobotOutlined />}
        aria-label={label || INTENT_LABELS[intent]}
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      >
        {iconOnly ? null : label || INTENT_LABELS[intent]}
      </Button>
    </Tooltip>
  )
}

export default CICDAssistantButton
