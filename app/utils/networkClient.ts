import type { NetworkApiResponse } from '../types/network'

export async function networkRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/network/${path.replace(/^\//, '')}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` })) as NetworkApiResponse<T>
  if (!response.ok || !payload.success) throw new Error(payload.error || `请求失败 (${response.status})`)
  return payload.data
}

export function postNetwork<T>(path: string, body: unknown): Promise<T> {
  return networkRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function putNetwork<T>(path: string, body: unknown): Promise<T> {
  return networkRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteNetwork<T>(path: string): Promise<T> {
  return networkRequest<T>(path, { method: 'DELETE' })
}
