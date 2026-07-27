import http from 'http'
import https from 'https'
import { URL } from 'url'

export type RegistryCheck = {
  ok: boolean
  statusCode?: number
  apiVersion?: string
  error?: string
  latencyMs: number
}

export async function checkDockerRegistry(options: {
  baseUrl: string
  username?: string | null
  password?: string | null
  verifyTls?: boolean
}): Promise<RegistryCheck> {
  const startedAt = Date.now()
  try {
    const base = new URL(options.baseUrl)
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('仓库地址只支持 HTTP 或 HTTPS')
    if (base.username || base.password) throw new Error('仓库地址不能包含用户名或密码')
    const url = new URL(base.toString())
    url.pathname = `${url.pathname.replace(/\/$/, '')}/v2/`.replace(/\/+/g, '/')
    url.search = ''
    url.hash = ''

    return await new Promise<RegistryCheck>((resolve) => {
      const client = url.protocol === 'https:' ? https : http
      const authorization = options.username || options.password
        ? `Basic ${Buffer.from(`${options.username || ''}:${options.password || ''}`).toString('base64')}`
        : undefined
      const request = client.request(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        ...(url.protocol === 'https:' ? { rejectUnauthorized: options.verifyTls !== false } : {})
      }, response => {
        response.resume()
        const statusCode = response.statusCode || 0
        const ok = statusCode >= 200 && statusCode < 300
        resolve({
          ok,
          statusCode,
          apiVersion: String(response.headers['docker-distribution-api-version'] || ''),
          error: ok ? undefined : statusCode === 401 ? '认证失败或仓库要求登录' : `仓库返回 HTTP ${statusCode}`,
          latencyMs: Date.now() - startedAt
        })
      })
      request.setTimeout(8000, () => request.destroy(new Error('连接仓库超时（8秒）')))
      request.once('error', error => resolve({ ok: false, error: error.message, latencyMs: Date.now() - startedAt }))
      request.end()
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '仓库连接失败', latencyMs: Date.now() - startedAt }
  }
}
