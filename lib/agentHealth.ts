export type AgentHealthStatus =
  | 'installed'
  | 'authentication_mismatch'
  | 'legacy_unverified'
  | 'platform_misconfigured'
  | 'not_installed'

interface AgentProbeResult {
  healthStatus?: number
  authStatus?: number
  platformKeyConfigured: boolean
}

function isSuccessful(status?: number): boolean {
  return typeof status === 'number' && status >= 200 && status < 300
}

/**
 * 同时判断 Agent 存活状态和平台通信鉴权状态。
 * `/api/health` 在多数 Agent 版本中无需鉴权，因此不能单独用于证明密钥一致。
 */
export function classifyAgentProbe(result: AgentProbeResult): AgentHealthStatus {
  if (result.healthStatus === 401 || result.healthStatus === 403) {
    return result.platformKeyConfigured ? 'authentication_mismatch' : 'platform_misconfigured'
  }

  if (!isSuccessful(result.healthStatus)) return 'not_installed'
  if (!result.platformKeyConfigured) return 'platform_misconfigured'
  if (isSuccessful(result.authStatus)) return 'installed'
  if (result.authStatus === 401 || result.authStatus === 403) return 'authentication_mismatch'

  // 旧版 Agent 可能没有只读鉴权探针端点；服务存活，但必须升级后才能确认密钥。
  return 'legacy_unverified'
}

/** 将 Agent 返回的 401 与模型厂商 API Key 错误明确区分。 */
export function formatAgentHttpError(status: number, statusText: string, responseBody: string): string {
  if (status === 401 || status === 403) {
    return 'Agent 通信密钥与平台不一致，目标 Agent 拒绝了请求。请在智能助手的“目标资源”中点击“检查 Agent”，然后执行“同步密钥并更新 Agent”。'
  }

  const detail = responseBody.trim()
  return `${status} ${statusText}${detail ? ` - ${detail}` : ''}`
}
