/**
 * 页面和 API 的统一权限策略。
 *
 * 中间件只做粗粒度入口保护；API 内仍需用 requirePermission 做资源级校验。
 * 这里保持纯函数，确保可以运行在 Next.js Edge Runtime 并能直接单元测试。
 */

export type HttpMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RouteRule = {
  prefix: string
  read: string
  write?: string
}

const PAGE_RULES: RouteRule[] = [
  { prefix: '/users/permissions', read: 'permissions:read', write: 'permissions:write' },
  { prefix: '/users', read: 'users:read', write: 'users:write' },
  { prefix: '/admin', read: 'users:read', write: 'users:write' },
  { prefix: '/servers', read: 'servers:read', write: 'servers:write' },
  { prefix: '/clusters', read: 'servers:read', write: 'servers:write' },
  { prefix: '/network', read: 'network:read', write: 'network:write' },
  { prefix: '/cicd/approvals', read: 'approvals:read', write: 'approvals:write' },
  { prefix: '/cicd', read: 'cicd:read', write: 'cicd:write' },
  { prefix: '/config', read: 'config:read', write: 'config:write' },
  { prefix: '/monitor', read: 'grafana:read', write: 'grafana:write' },
  { prefix: '/integration/alerts', read: 'monitoring:read', write: 'monitoring:write' },
  { prefix: '/integration/artifacts', read: 'cicd:read', write: 'cicd:write' },
  { prefix: '/integration', read: 'config:read', write: 'config:write' },
  { prefix: '/improve', read: 'improve:read', write: 'improve:write' },
  { prefix: '/knowledge', read: 'improve:read', write: 'improve:write' },
  { prefix: '/ai', read: 'ai:read', write: 'ai:write' },
  { prefix: '/notifications', read: 'notifications:read', write: 'notifications:write' },
  { prefix: '/operations', read: 'servers:read', write: 'servers:write' },
  { prefix: '/events', read: 'monitoring:read', write: 'monitoring:write' },
  { prefix: '/governance', read: 'permissions:read', write: 'permissions:write' },
]

const API_RULES: RouteRule[] = [
  { prefix: '/api/admin/users', read: 'users:read', write: 'users:write' },
  { prefix: '/api/admin/registrations', read: 'users:read', write: 'users:write' },
  { prefix: '/api/admin/roles', read: 'permissions:read', write: 'permissions:write' },
  { prefix: '/api/permission-groups', read: 'permissions:read', write: 'permissions:write' },
  { prefix: '/api/permissions', read: 'permissions:read', write: 'permissions:write' },
  { prefix: '/api/users/permissions', read: 'permissions:read', write: 'permissions:write' },
  { prefix: '/api/users', read: 'users:read', write: 'users:write' },
  { prefix: '/api/admin/servers', read: 'servers:read', write: 'servers:write' },
  { prefix: '/api/servers', read: 'servers:read', write: 'servers:write' },
  { prefix: '/api/network', read: 'network:read', write: 'network:write' },
  { prefix: '/api/cicd/approvals', read: 'approvals:read', write: 'approvals:write' },
  { prefix: '/api/cicd', read: 'cicd:read', write: 'cicd:write' },
  { prefix: '/api/config', read: 'config:read', write: 'config:write' },
  { prefix: '/api/mcp', read: 'config:read', write: 'config:write' },
  { prefix: '/api/grafana', read: 'grafana:read', write: 'grafana:write' },
  { prefix: '/api/elk', read: 'monitoring:read', write: 'monitoring:write' },
  { prefix: '/api/improve', read: 'improve:read', write: 'improve:write' },
  { prefix: '/api/knowledge', read: 'improve:read', write: 'improve:write' },
  { prefix: '/api/notifications', read: 'notifications:read', write: 'notifications:write' },
  { prefix: '/api/approval', read: 'approvals:read', write: 'approvals:write' },
  { prefix: '/api/approval-records', read: 'approvals:read', write: 'approvals:write' },
  { prefix: '/api/operations/incidents', read: 'monitoring:read', write: 'monitoring:write' },
  { prefix: '/api/integration/alert-sources', read: 'monitoring:read', write: 'monitoring:write' },
  { prefix: '/api/integration/artifacts', read: 'cicd:read', write: 'cicd:write' },
  { prefix: '/api/integration', read: 'config:read', write: 'config:write' },
  { prefix: '/api/operations', read: 'servers:read', write: 'servers:write' },
  { prefix: '/api/governance', read: 'permissions:read', write: 'permissions:write' },
  { prefix: '/api/ai', read: 'ai:read', write: 'ai:write' },
  { prefix: '/api/system/chat', read: 'ai:write', write: 'ai:write' },
  { prefix: '/api/system/analysis-stream', read: 'ai:write', write: 'ai:write' },
  { prefix: '/api/linux', read: 'ai:write', write: 'ai:write' },
  { prefix: '/api/k8s/clusters', read: 'servers:read', write: 'servers:write' },
  { prefix: '/api/k8s', read: 'ai:write', write: 'ai:write' },
  { prefix: '/api/kubelet-wuhrai', read: 'ai:write', write: 'ai:write' },
  { prefix: '/api/remote', read: 'ai:write', write: 'ai:write' },
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isReadMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
}

export function requiredPermissionForRequest(pathname: string, method: string): string | null {
  const rules = pathname.startsWith('/api/') ? API_RULES : PAGE_RULES
  const rule = rules.find(candidate => matchesPrefix(pathname, candidate.prefix))
  if (!rule) return null
  return isReadMethod(method) ? rule.read : (rule.write || rule.read)
}

export function grantsPermission(role: string, permissions: string[], required: string | null): boolean {
  if (!required || role === 'admin' || permissions.includes('*')) return true
  if (permissions.includes(required)) return true

  const [resource] = required.split(':')
  return permissions.includes(`${resource}:all`)
}
