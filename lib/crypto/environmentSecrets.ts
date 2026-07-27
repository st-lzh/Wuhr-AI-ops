import { protectSecret, revealSecret } from './encryption'

export const SECRET_MASK = '********'

export type EnvironmentMap = Record<string, string>

function normalizeEnvironment(value: unknown): EnvironmentMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => key.trim() !== '' && typeof item === 'string')
      .map(([key, item]) => [key, item as string])
  )
}

/** 保存环境变量时逐值加密；遮罩值表示沿用数据库中的原值。 */
export function protectEnvironment(value: unknown, previousValue?: unknown): EnvironmentMap {
  const incoming = normalizeEnvironment(value)
  const previous = normalizeEnvironment(previousValue)

  return Object.fromEntries(Object.entries(incoming).map(([key, item]) => {
    if (item === SECRET_MASK && previous[key] !== undefined) return [key, previous[key]]
    if (item === '') return [key, '']
    return [key, protectSecret(item) || '']
  }))
}

/** 返回给浏览器的环境变量只保留键名，不暴露值。 */
export function maskEnvironment(value: unknown): EnvironmentMap {
  return Object.fromEntries(
    Object.keys(normalizeEnvironment(value)).map(key => [key, SECRET_MASK])
  )
}

/** 仅在服务端向 Agent 或真实测试接口传递前解密。 */
export function revealEnvironment(value: unknown): EnvironmentMap {
  return Object.fromEntries(
    Object.entries(normalizeEnvironment(value)).map(([key, item]) => [key, revealSecret(item)])
  )
}
