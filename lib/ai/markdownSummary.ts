import type { RuntimeModelConfig } from './runtimeModelConfig'
import { ensureFinalMarkdownDocument } from './responseFormatting'

function providerBaseUrl(model: RuntimeModelConfig): string {
  if (model.baseUrl?.trim()) return model.baseUrl.trim().replace(/\/+$/, '')
  const provider = model.provider.toLowerCase()
  if (provider.includes('deepseek')) return 'https://api.deepseek.com/v1'
  if (provider.includes('moonshot') || provider.includes('kimi')) return 'https://api.moonshot.cn/v1'
  if (provider.includes('qwen') || provider.includes('dashscope')) return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  if (provider.includes('glm') || provider.includes('zhipu')) return 'https://open.bigmodel.cn/api/paas/v4'
  if (provider.includes('anthropic') || provider.includes('claude')) return 'https://api.anthropic.com/v1'
  if (provider.includes('gemini')) return 'https://generativelanguage.googleapis.com/v1beta'
  return 'https://api.openai.com/v1'
}

function openAIChatUrl(baseUrl: string): string {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl
  if (/\/(v1|v4)$/i.test(baseUrl) || /\/compatible-mode\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`
  return `${baseUrl}/v1/chat/completions`
}

export function buildMarkdownSummaryPrompt(originalQuery: string, executionResults: string, isK8sMode = false): string {
  return `你是 Wuhr AI 运维结果分析师。你只能根据下方真实执行证据总结，不得执行新命令，不得编造数据。

## 用户请求

${originalQuery}

## 执行模式

${isK8sMode ? 'Kubernetes 集群' : 'Linux 系统'}

## 真实执行证据

${executionResults}

## 输出规则

- 只输出 Markdown 正文，不要输出 JSON，不要说“我将总结”。
- 必须使用二级标题，至少包含“执行结论”和“关键结果”。
- 如有风险或可行的后续动作，再增加“风险与建议”和“后续步骤”。
- 段落间保留空行，多项信息使用列表，命令或原始输出使用三反引号代码块。
- 执行流程已在界面单独展示，不要重复粘贴全部过程，只提取对用户有价值的结果。`
}

export async function requestMarkdownSummary(input: {
  model: RuntimeModelConfig
  originalQuery: string
  executionResults: string
  isK8sMode?: boolean
}): Promise<string> {
  const { model } = input
  const provider = model.provider.toLowerCase()
  const baseUrl = providerBaseUrl(model)
  const prompt = buildMarkdownSummaryPrompt(input.originalQuery, input.executionResults, input.isK8sMode)
  let response: Response

  if (provider.includes('anthropic') || provider.includes('claude')) {
    response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: model.model, max_tokens: 2000, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000)
    })
  } else if (provider.includes('gemini')) {
    response = await fetch(`${baseUrl}/models/${encodeURIComponent(model.model)}:generateContent?key=${encodeURIComponent(model.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2000 } }),
      signal: AbortSignal.timeout(120_000)
    })
  } else {
    response = await fetch(openAIChatUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: model.model,
        temperature: 0.2,
        max_tokens: 2000,
        stream: false,
        messages: [
          { role: 'system', content: '你是严谨的运维分析师。只返回结构清晰的 Markdown 文档，且只使用已提供的真实证据。' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(120_000)
    })
  }

  const responseText = await response.text()
  if (!response.ok) throw new Error(`总结模型请求失败 HTTP ${response.status}: ${responseText.slice(0, 800)}`)

  const payload = JSON.parse(responseText) as any
  const content = provider.includes('anthropic') || provider.includes('claude')
    ? payload?.content?.map((item: any) => item?.text || '').join('')
    : provider.includes('gemini')
      ? payload?.candidates?.[0]?.content?.parts?.map((item: any) => item?.text || '').join('')
      : payload?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) throw new Error('总结模型未返回有效内容')
  return ensureFinalMarkdownDocument(content)
}
