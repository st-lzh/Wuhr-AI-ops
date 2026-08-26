const FINAL_MARKDOWN_MARKER = '<!-- WUHR_FINAL_MARKDOWN -->'

export const FINAL_MARKDOWN_INSTRUCTION = `${FINAL_MARKDOWN_MARKER}

## 最终答复格式（必须遵守）

- 工具执行完成后的最终答复必须使用 Markdown，不得将全部内容压缩成一行。
- 根据真实执行情况使用“执行结论”“关键结果”“风险与建议”“后续步骤”等二级标题，不适用的标题可以省略。
- 段落之间保留空行；多项内容使用列表；命令和原始输出使用带语言标识的三反引号代码块。
- 只总结真实已执行的命令和返回结果，不得编造数据。
- 如果使用 ReAct JSON，answer 字段中的换行必须正确转义，解析后必须保留真实换行。`

/**
 * 统一约束 Agent 的最终答复格式。标记保证路由重复包装时不会叠加提示词。
 */
export function withFinalMarkdownInstruction(query: string): string {
  if (query.includes(FINAL_MARKDOWN_MARKER)) return query
  return `${query.trim()}\n\n${FINAL_MARKDOWN_INSTRUCTION}`
}

/**
 * 即使个别模型忽略 Markdown 约束，展示层也始终收到一份可读文档。
 */
export function ensureFinalMarkdownDocument(content: string): string {
  const normalized = content.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return '## 执行结论\n\n执行已完成，但模型未返回有效总结。'

  const hasHeading = /^#{1,6}\s+\S+/m.test(normalized)
  const hasReadableBreaks = normalized.includes('\n\n') || /^(?:[-*+] |\d+\. )/m.test(normalized)
  if (hasHeading && hasReadableBreaks) return normalized

  return `## 执行结论\n\n${normalized}`
}
