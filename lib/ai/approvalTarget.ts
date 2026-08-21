import type { PrismaClient } from '../generated/prisma'

export class ApprovalTargetError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

function formatUrlHost(address: string): string {
  const value = address.trim()
  if (!value || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new ApprovalTargetError('目标 Agent 地址无效', 400)
  }
  return value.includes(':') && !value.startsWith('[') ? `[${value}]` : value
}

/**
 * 根据已登记的主机解析审批请求应返回的 Agent。审批不能使用平台默认后端，
 * 因为待审批状态只存在于创建该会话的 Agent 进程中。
 */
export async function resolveApprovalAgentBaseUrl(
  prisma: PrismaClient,
  hostId: unknown
): Promise<string> {
  if (typeof hostId !== 'string' || !hostId.trim()) {
    throw new ApprovalTargetError('缺少命令所属的目标主机', 400)
  }

  const server = await prisma.server.findFirst({
    where: { id: hostId.trim(), isActive: true },
    select: { ip: true }
  })
  if (!server) throw new ApprovalTargetError('目标主机不存在或已停用', 404)

  return `http://${formatUrlHost(server.ip)}:2081`
}
