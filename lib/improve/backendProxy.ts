// AI 资产管理 API 代理层
//
// 所有 /api/improve/* 前端 API 路由都通过这个 helper 转发到后端 kubelet-wuhrai
// `/api/v1/improve/*`。集中处理：
//   1. 前端鉴权（requireAuth）→ 拒绝匿名请求
//   2. 注入后端 admin API key（server-side env，不进浏览器）
//   3. 注入 X-Actor header 传当前真实用户身份（后端审计用）
//   4. 转发请求 + 透传后端响应
//
// 环境变量：
//   IMPROVE_API_BASE_URL   (默认 http://localhost:8888) — kubelet-wuhrai 中央 server
//   IMPROVE_API_KEY        (必填，生产) — admin role 的 backend API key
//
// 注意：这两个变量都不带 NEXT_PUBLIC 前缀，仅 server-side 可读。前端 fetch
// 调 /api/improve/*，由 Next.js API 路由代理过去，浏览器拿不到真 key。

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../auth/apiHelpers-new'

const DEFAULT_BACKEND = 'http://localhost:8888'
const DEFAULT_TIMEOUT_MS = 30_000

/** 后端 base URL，环境变量缺失时回退本机 8888（开发场景）。 */
export function getBackendBaseUrl(): string {
  return process.env.IMPROVE_API_BASE_URL || DEFAULT_BACKEND
}

/** 后端 admin API key；为空时返回 null（调用方决定如何处理）。 */
export function getBackendApiKey(): string | null {
  const k = process.env.IMPROVE_API_KEY
  return k && k.trim() !== '' ? k : null
}

export interface ProxyOptions {
  /** 后端绝对路径，必须以 /api/v1/improve/ 开头。 */
  path: string
  /** HTTP method；默认沿用前端 request 的 method。 */
  method?: string
  /** 是否要求写权限（improve:write）。默认按方法推断：GET=否，其他=是。 */
  requireWrite?: boolean
  /** 自定义超时（毫秒）。默认 30s；reflect / re-embed 可加长。 */
  timeoutMs?: number
}

export interface BackendFetchOptions {
  /** 后端审计身份；仪表盘等只读聚合默认使用明确的系统身份。 */
  actor?: string
  /** 默认 30 秒。 */
  timeoutMs?: number
}

/**
 * 服务端内部读取 v1 后端 JSON 数据。
 *
 * 该函数集中持有 admin key，供仪表盘、通知等服务端聚合逻辑复用；禁止从客户端组件导入。
 * 后端不可达、超时或业务响应失败都会抛错，由调用方明确标记数据源异常，不能返回伪成功。
 */
export async function fetchBackendData<T>(path: string, options: BackendFetchOptions = {}): Promise<T> {
  if (!path.startsWith('/api/')) {
    throw new Error('后端路径必须以 /api/ 开头')
  }
  const apiKey = getBackendApiKey()
  if (!apiKey) throw new Error('后端 API key 未配置')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(`${getBackendBaseUrl().replace(/\/$/, '')}${path}`, {
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
        'X-Actor': sanitizeActor(options.actor || 'dashboard-readonly'),
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || `后端返回 HTTP ${response.status}`)
    if (payload?.success === false) throw new Error(payload.error || '后端返回失败')
    return (payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload) as T
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('后端响应超时')
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 把前端请求代理到后端 /api/v1/improve/* endpoint。
 *
 * 返回值是一个 NextResponse，调用方在 route.ts 里 `return` 即可。
 *
 * 错误码映射：
 *   - 前端未登录 → 401
 *   - 后端 IMPROVE_API_KEY 没配 → 500 (服务端配置错误，不暴露给用户细节)
 *   - 写权限不够 → 403
 *   - 后端 5xx / 超时 → 透传或 502
 */
export async function proxyToImproveBackend(
  request: NextRequest,
  options: ProxyOptions
): Promise<NextResponse> {
  // 1) 前端鉴权
  const authResult = await requireAuth(request)
  if (!authResult.success) {
    return authResult.response
  }
  const user = authResult.user

  // 2) 写权限校验
  const method = (options.method || request.method).toUpperCase()
  const requireWrite = options.requireWrite ?? (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS')
  if (requireWrite) {
    const perms = (user as any).permissions as string[] | undefined
    const isWildcard = Array.isArray(perms) && perms.includes('*')
    const hasWrite = Array.isArray(perms) && perms.includes('improve:write')
    if (!isWildcard && !hasWrite) {
      return NextResponse.json({
        success: false,
        error: '无 improve:write 权限',
        code: 'frontend_permission_denied',
      }, { status: 403 })
    }
  } else {
    const perms = (user as any).permissions as string[] | undefined
    const isWildcard = Array.isArray(perms) && perms.includes('*')
    const hasRead = Array.isArray(perms) && (perms.includes('improve:read') || perms.includes('improve:write'))
    if (!isWildcard && !hasRead) {
      return NextResponse.json({
        success: false,
        error: '无 improve:read 权限',
        code: 'frontend_permission_denied',
      }, { status: 403 })
    }
  }

  // 3) 后端配置校验
  const apiKey = getBackendApiKey()
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: '后端 API key 未配置（IMPROVE_API_KEY），请联系管理员',
      code: 'backend_misconfigured',
    }, { status: 500 })
  }

  // 4) 构造后端 URL（带 query string 透传）
  const base = getBackendBaseUrl().replace(/\/$/, '')
  const incomingUrl = new URL(request.url)
  const search = incomingUrl.search // 含 ? 或 ''
  const backendUrl = `${base}${options.path}${search}`

  // 5) 准备 body（仅非 GET）
  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const raw = await request.text()
      body = raw === '' ? undefined : raw
    } catch {
      body = undefined
    }
  }

  // 6) 转发
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const actor = (user.email || user.username || user.id || 'unknown-user').toString()
    const resp = await fetch(backendUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': apiKey,
        'X-Actor': sanitizeActor(actor),
      },
      body,
      signal: controller.signal,
    })
    const text = await resp.text()
    // 后端已经返回 JSON 格式 {success, data, error, code}，直接透传
    // 同时透传一小段下载/缓存相关 header（用于 outcomes 导出等场景触发浏览器下载）
    const passThroughHeaders: Record<string, string> = {
      'Content-Type': resp.headers.get('Content-Type') || 'application/json',
    }
    const cd = resp.headers.get('Content-Disposition')
    if (cd) {
      passThroughHeaders['Content-Disposition'] = cd
    }
    return new NextResponse(text, {
      status: resp.status,
      headers: passThroughHeaders,
    })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        error: '后端响应超时',
        code: 'backend_timeout',
      }, { status: 504 })
    }
    return NextResponse.json({
      success: false,
      error: `后端调用失败: ${err?.message ?? err}`,
      code: 'backend_error',
    }, { status: 502 })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * sanitizeActor 把 X-Actor 值限制为后端可接受的字符集（可打印 ASCII，1-128 字符）。
 * 后端 isValidActorString 会拒绝控制字符 / Unicode / 超长字符串。
 *
 * 中文用户名 → 走 email / id 字段；都没有时回退 'unknown-user'。
 */
function sanitizeActor(s: string): string {
  // 去除控制字符
  let cleaned = s.replace(/[\x00-\x1f\x7f-￿]/g, '?')
  if (cleaned.length === 0) cleaned = 'unknown-user'
  if (cleaned.length > 128) cleaned = cleaned.slice(0, 128)
  return cleaned
}
