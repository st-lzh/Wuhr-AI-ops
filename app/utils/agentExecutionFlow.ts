export type AgentExecutionStepType =
  | 'text'
  | 'command'
  | 'output'
  | 'error'
  | 'done'
  | 'thinking'
  | 'command_rejected'

export interface AgentExecutionStep {
  type: AgentExecutionStepType
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export const EXECUTION_RESULT_MARKER = '📤 执行结果:'

const stringifyResultValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text
        }
        return JSON.stringify(item, null, 2)
      })
      .filter(Boolean)
      .join('\n')
  }
  if (value == null) return ''
  return JSON.stringify(value, null, 2)
}

/**
 * 将 Agent 工具结果转换为用户可见文本。
 * 同时兼容 shell、MCP 和批量 host_fanout 的结果结构。
 */
export const formatAgentExecutionResult = (result: unknown): string => {
  if (result == null) return ''
  if (typeof result === 'string') return result.trimEnd()

  if (typeof result !== 'object') return String(result)

  const value = result as Record<string, unknown>
  const sections: string[] = []

  if (typeof value.stdout === 'string' && value.stdout) {
    sections.push(value.stdout.trimEnd())
  }
  if (typeof value.stderr === 'string' && value.stderr) {
    sections.push(`⚠️ 标准错误:\n${value.stderr.trimEnd()}`)
  }
  if (value.error && !value.stderr) {
    sections.push(`❌ 错误: ${stringifyResultValue(value.error)}`)
  }

  if (sections.length === 0 && value.content !== undefined) {
    const content = stringifyResultValue(value.content)
    if (content) sections.push(content)
  }
  if (sections.length === 0 && value.structuredContent !== undefined) {
    const structuredContent = stringifyResultValue(value.structuredContent)
    if (structuredContent) sections.push(structuredContent)
  }

  if (sections.length === 0) {
    const fallback = stringifyResultValue(result)
    if (fallback !== '{}') sections.push(fallback)
  }

  return sections.join('\n')
}

/**
 * 解析聊天流中的执行标记，用于实时展示与历史会话持久化。
 */
export const parseAgentExecutionFlow = (
  content: string,
  timestampFactory: () => string = () => new Date().toISOString()
): AgentExecutionStep[] => {
  const steps: AgentExecutionStep[] = []
  let collecting: 'output' | 'text' | null = null
  let collectedLines: string[] = []

  const flushCollected = () => {
    const collected = collectedLines.join('\n').trim()
    if (collecting && collected) {
      steps.push({
        type: collecting,
        content: collected,
        timestamp: timestampFactory()
      })
    }
    collecting = null
    collectedLines = []
  }

  for (const line of content.split('\n')) {
    if (line.includes('🤔')) {
      flushCollected()
      steps.push({
        type: 'thinking',
        content: line.replace('🤔 ', '').trim(),
        timestamp: timestampFactory()
      })
      continue
    }

    if (line.includes('💻 执行:')) {
      flushCollected()
      const commandMatch = line.match(/💻 执行: (?:\[([^\]]+)\] )?(.+)/)
      const toolName = commandMatch?.[1]
      steps.push({
        type: 'command',
        content: commandMatch?.[2] || line.replace('💻 执行: ', '').trim(),
        timestamp: timestampFactory(),
        metadata: toolName ? { toolName } : undefined
      })
      continue
    }

    if (line.includes(EXECUTION_RESULT_MARKER)) {
      flushCollected()
      collecting = 'output'
      const inlineResult = line.slice(line.indexOf(EXECUTION_RESULT_MARKER) + EXECUTION_RESULT_MARKER.length).trim()
      if (inlineResult) collectedLines.push(inlineResult)
      continue
    }

    // 兼容历史会话中的旧输出标记。
    if (line.includes('📤 输出:')) {
      flushCollected()
      collecting = 'output'
      const inlineResult = line.slice(line.indexOf('📤 输出:') + '📤 输出:'.length).trim()
      if (inlineResult) collectedLines.push(inlineResult)
      continue
    }

    if (line.includes('💬 AI回复:')) {
      flushCollected()
      collecting = 'text'
      continue
    }

    if (line.includes('命令已拒绝')) {
      flushCollected()
      steps.push({
        type: 'command_rejected',
        content: line.replace(/^命令已拒绝:\s*/, '').trim(),
        timestamp: timestampFactory()
      })
      continue
    }

    if (line.includes('❌ 执行错误:')) {
      flushCollected()
      steps.push({
        type: 'error',
        content: line.replace(/^\s*❌ 执行错误:\s*/, '').trim(),
        timestamp: timestampFactory()
      })
      continue
    }

    if (collecting) collectedLines.push(line)
  }

  flushCollected()
  return steps
}
