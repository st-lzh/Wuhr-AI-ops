import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EXECUTION_RESULT_MARKER,
  formatAgentExecutionResult,
  parseAgentExecutionFlow
} from '../../app/utils/agentExecutionFlow'

test('shell 命令的 stdout、stderr 和错误都会转换为可见执行结果', () => {
  const result = formatAgentExecutionResult({
    stdout: 'disk ok\n',
    stderr: 'permission warning\n',
    exit_code: 1
  })

  assert.match(result, /disk ok/)
  assert.match(result, /标准错误/)
  assert.match(result, /permission warning/)
})

test('MCP 与批量工具的结构化结果不会被丢弃', () => {
  assert.equal(
    formatAgentExecutionResult({ content: [{ type: 'text', text: 'mcp result' }] }),
    'mcp result'
  )

  const batchResult = formatAgentExecutionResult({
    summary: { total: 2, success: 1, failed: 1 },
    results: [{ host: 'prod-1', stdout: 'ok' }, { host: 'prod-2', stderr: 'failed' }]
  })
  assert.match(batchResult, /prod-1/)
  assert.match(batchResult, /prod-2/)
  assert.match(batchResult, /failed/)
})

test('执行流程同时恢复命令、多行结果和最终 AI 答复', () => {
  const content = [
    '💻 执行: [bash] df -h',
    EXECUTION_RESULT_MARKER,
    'Filesystem Size Used Avail Use%',
    '/dev/vda1 40G 20G 20G 50%',
    '💬 AI回复:',
    '磁盘空间正常。'
  ].join('\n')

  const steps = parseAgentExecutionFlow(content, () => '2026-08-24T00:00:00.000Z')
  assert.deepEqual(steps.map(step => step.type), ['command', 'output', 'text'])
  assert.equal(steps[0].content, 'df -h')
  assert.equal(steps[0].metadata?.toolName, 'bash')
  assert.match(steps[1].content, /\/dev\/vda1/)
  assert.equal(steps[2].content, '磁盘空间正常。')
})
