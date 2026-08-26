import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ensureFinalMarkdownDocument,
  FINAL_MARKDOWN_INSTRUCTION,
  withFinalMarkdownInstruction
} from '../../lib/ai/responseFormatting'
import { buildMarkdownSummaryPrompt } from '../../lib/ai/markdownSummary'

test('Agent 请求统一要求最终答复使用可读 Markdown', () => {
  const query = withFinalMarkdownInstruction('检查磁盘空间')

  assert.match(query, /检查磁盘空间/)
  assert.match(query, /Markdown/)
  assert.match(query, /执行结论/)
  assert.match(query, /不得将全部内容压缩成一行/)
  assert.match(FINAL_MARKDOWN_INSTRUCTION, /三反引号代码块/)
})

test('Markdown 格式约束不会被重复追加', () => {
  const once = withFinalMarkdownInstruction('查看系统状态')
  const twice = withFinalMarkdownInstruction(once)

  assert.equal(twice, once)
  assert.equal(twice.match(/WUHR_FINAL_MARKDOWN/g)?.length, 1)
})

test('模型忽略格式时也会被校正为 Markdown 文档', () => {
  assert.equal(
    ensureFinalMarkdownDocument('主机状态正常。'),
    '## 执行结论\n\n主机状态正常。'
  )

  const structured = '## 执行结论\n\n- 主机正常\n- 无异常'
  assert.equal(ensureFinalMarkdownDocument(structured), structured)
})

test('二次总结提示只使用真实证据并禁止过渡文本', () => {
  const prompt = buildMarkdownSummaryPrompt('查看主机名', '执行结果: prod-01', false)

  assert.match(prompt, /查看主机名/)
  assert.match(prompt, /prod-01/)
  assert.match(prompt, /不要说“我将总结”/)
  assert.match(prompt, /执行结论/)
  assert.match(prompt, /关键结果/)
})
