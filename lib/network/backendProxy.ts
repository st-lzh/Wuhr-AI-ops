import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../auth/apiHelpers-new'
import { getBackendApiKey, getBackendBaseUrl } from '../improve/backendProxy'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function cleanActor(value: string): string {
  const result = value.replace(/[\x00-\x1f\x7f-\uffff]/g, '?').slice(0, 128)
  return result || 'unknown-user'
}

/** 网络管理 BFF：浏览器拿不到后端 admin key，也拿不到设备 secret:// 引用。 */
export async function proxyToNetworkBackend(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const auth = await requireAuth(request)
  if (!auth.success) return auth.response
  const user = auth.user as any
  const method = request.method.toUpperCase()
  const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : []
  const isAdmin = user.role === 'admin' || permissions.includes('*')
  const allowed = READ_METHODS.has(method)
    ? isAdmin || permissions.includes('network:read') || permissions.includes('network:write')
    : isAdmin || permissions.includes('network:write')
  if (!allowed) return NextResponse.json({ success: false, code: 'frontend_permission_denied', error: `无 network:${READ_METHODS.has(method) ? 'read' : 'write'} 权限` }, { status: 403 })
  const apiKey = getBackendApiKey()
  if (!apiKey) return NextResponse.json({ success: false, code: 'backend_misconfigured', error: '后端 API key 未配置' }, { status: 500 })
  const safeSegments = pathSegments.filter(Boolean).map((segment) => encodeURIComponent(decodeURIComponent(segment)))
  const incoming = new URL(request.url)
  const backendUrl = `${getBackendBaseUrl().replace(/\/$/, '')}/api/network/${safeSegments.join('/')}${incoming.search}`
  let body: string | undefined
  if (!READ_METHODS.has(method)) { const raw = await request.text(); body = raw || undefined }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const response = await fetch(backendUrl, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-API-Key': apiKey, 'X-Actor': cleanActor(String(user.email || user.username || user.id)) }, body, cache: 'no-store', signal: controller.signal })
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' } })
  } catch (error: any) {
    const timedOut = error?.name === 'AbortError'
    return NextResponse.json({ success: false, code: timedOut ? 'backend_timeout' : 'backend_error', error: timedOut ? '网络设备操作超时' : `后端调用失败: ${error?.message || error}` }, { status: timedOut ? 504 : 502 })
  } finally { clearTimeout(timeout) }
}
