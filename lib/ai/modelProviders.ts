import { decrypt, encrypt } from '../crypto/encryption'

export interface ProviderRuntimeInput {
  providerKey: string
  adapter: string
  apiKey?: string | null
  baseUrl?: string | null
  modelName: string
}

export function maskApiKey(value?: string | null): string | null {
  if (!value) return null
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

export function encryptProviderApiKey(value?: string | null): string | null {
  return value ? encrypt(value) : null
}

export function readProviderApiKey(connection: { apiKey?: string | null; config?: unknown }): string {
  if (!connection.apiKey) return ''
  const config = (connection.config || {}) as Record<string, unknown>
  return config.credentialsEncrypted === true ? decrypt(connection.apiKey) : connection.apiKey
}

export function providerTypeFor(providerKey: string, adapter: string): string {
  if (providerKey === 'anthropic') return 'ANTHROPIC'
  if (providerKey === 'ollama') return 'OLLAMA'
  if (providerKey === 'vllm') return 'VLLM'
  if (adapter === 'openai') return 'OPENAI'
  if (adapter === 'qwen') return 'QWEN'
  if (adapter === 'gemini') return 'OPENAI_COMPATIBLE'
  return 'OPENAI_COMPATIBLE'
}

export function normalizeBaseUrl(value?: string | null): string {
  return (value || '').trim().replace(/\/+$/, '')
}

function assertHttpUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL 只支持 http:// 或 https://')
  }
  return url
}

function chatCompletionsUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl)
  if (!base) throw new Error('缺少 Base URL')
  assertHttpUrl(base)
  if (base.endsWith('/chat/completions')) return base
  return `${base}/chat/completions`
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  return text.slice(0, 1200) || response.statusText
}

export async function testProviderConnection(input: ProviderRuntimeInput) {
  const startedAt = Date.now()
  const apiKey = input.apiKey || ''
  const baseUrl = normalizeBaseUrl(input.baseUrl)

  if (!input.modelName) throw new Error('请至少选择或填写一个模型 ID')

  let response: Response
  if (input.adapter === 'gemini') {
    if (!apiKey) throw new Error('Gemini 需要 API Key')
    const url = `${baseUrl}/models/${encodeURIComponent(input.modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with OK.' }] }],
        generationConfig: { maxOutputTokens: 8 }
      }),
      signal: AbortSignal.timeout(30000)
    })
  } else {
    response = await fetch(chatCompletionsUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model: input.modelName,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 8,
        stream: false
      }),
      signal: AbortSignal.timeout(30000)
    })
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await readError(response)}`)
  }

  return { success: true, responseTime: Date.now() - startedAt }
}

export async function discoverProviderModels(input: Omit<ProviderRuntimeInput, 'modelName'>) {
  const apiKey = input.apiKey || ''
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!baseUrl) throw new Error('缺少 Base URL')
  assertHttpUrl(baseUrl)

  const isGemini = input.adapter === 'gemini'
  const url = isGemini
    ? `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`
    : `${baseUrl}/models`

  const response = await fetch(url, {
    headers: isGemini
      ? { Accept: 'application/json' }
      : {
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
    signal: AbortSignal.timeout(20000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await readError(response)}`)
  }

  const payload = await response.json() as any
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : []

  const models: string[] = rows
    .map((item: any) => {
      const id = typeof item === 'string' ? item : item?.id || item?.name
      return typeof id === 'string' ? id.replace(/^models\//, '') : ''
    })
    .filter(Boolean)

  return Array.from(new Set<string>(models)).sort((a, b) => a.localeCompare(b))
}
