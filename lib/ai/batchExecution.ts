import type { PrismaClient } from '../generated/prisma'
import { revealSecret } from '../crypto/encryption'

export interface BatchHostConfig {
  id: string
  name: string
  hostname?: string
  ip: string
  port: number
  username: string
  password?: string
  keyPath?: string
  authType: string
  tags: string[]
}

export class ChatTargetError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

const MAX_BATCH_HOSTS = 64

export function normalizeTargetHostIds(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new ChatTargetError('批量目标主机格式无效', 400)
  }

  const ids = Array.from(new Set(value
    .filter((id): id is string => typeof id === 'string')
    .map(id => id.trim())
    .filter(Boolean)))

  if (ids.length > MAX_BATCH_HOSTS) {
    throw new ChatTargetError(`一次最多批量执行 ${MAX_BATCH_HOSTS} 台主机`, 400)
  }
  return ids
}

function toBatchHostConfig(host: any): BatchHostConfig {
  return {
    id: host.id,
    name: host.name,
    hostname: host.hostname || undefined,
    ip: host.ip,
    port: host.port || 22,
    username: host.username,
    password: revealSecret(host.password) || undefined,
    keyPath: host.keyPath || undefined,
    authType: host.authType || (host.keyPath ? 'key' : 'password'),
    tags: Array.isArray(host.tags) ? host.tags : []
  }
}

export async function resolveChatExecutionContext(options: {
  prisma: PrismaClient
  userId: string
  coordinatorHostId?: string
  targetHostIds?: unknown
}) {
  const { prisma } = options
  const targetHostIds = normalizeTargetHostIds(options.targetHostIds)

  if (targetHostIds.length === 0) {
    if (!options.coordinatorHostId || options.coordinatorHostId === 'local') {
      throw new ChatTargetError('必须选择远程主机进行执行', 400)
    }
    const coordinator = await prisma.server.findFirst({
      where: { id: options.coordinatorHostId, isActive: true }
    })
    if (!coordinator) {
      throw new ChatTargetError(`未找到主机: ${options.coordinatorHostId}`, 404)
    }
    return { coordinator, batchMode: false, targetHostIds: [], batchHosts: [] as BatchHostConfig[] }
  }

  const targets = await prisma.server.findMany({
    // 当前产品部署为单个可信运维团队，登录成员共享主机资产。
    where: { id: { in: targetHostIds }, isActive: true }
  })
  const targetById = new Map(targets.map(host => [host.id, host]))
  const unauthorizedOrMissing = targetHostIds.filter(id => !targetById.has(id))
  if (unauthorizedOrMissing.length > 0) {
    throw new ChatTargetError('部分批量目标不存在或无权访问', 404)
  }
  const orderedTargets = targetHostIds.map(id => targetById.get(id)!)

  // 最终目标只有一台时必须走单机链路。无论它来自 @主机、标签还是
  // 只包含一台主机的主机组，都直接把该主机作为 Agent 节点调用。
  if (orderedTargets.length === 1) {
    return {
      coordinator: orderedTargets[0],
      batchMode: false,
      targetHostIds,
      batchHosts: [] as BatchHostConfig[]
    }
  }

  let coordinator = options.coordinatorHostId && options.coordinatorHostId !== 'local'
      ? await prisma.server.findFirst({
        where: { id: options.coordinatorHostId, isActive: true }
      })
    : null

  // 两台及以上才是批量执行：由一台 Agent 节点统一请求模型并 fan-out。没有显式协调节点时，
  // 优先使用默认主机，避免要求每台目标都安装后端服务。
  if (!coordinator) {
    coordinator = await prisma.server.findFirst({
      where: { isActive: true, isDefault: true }
    })
  }
  if (!coordinator) coordinator = orderedTargets[0]

  return {
    coordinator,
    batchMode: true,
    targetHostIds,
    batchHosts: orderedTargets.map(toBatchHostConfig)
  }
}
