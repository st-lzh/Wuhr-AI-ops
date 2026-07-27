import type { PrismaClient } from '../generated/prisma'

export interface TeamUser {
  id: string
  role?: string | null
  permissions?: unknown
}

function permissionList(user: TeamUser): string[] {
  return Array.isArray(user.permissions)
    ? user.permissions.filter((item): item is string => typeof item === 'string')
    : []
}

/** 单团队部署中，所有已认证成员都可以读取团队资产。 */
export function canReadTeamAssets(user: TeamUser): boolean {
  return Boolean(user.id)
}

/** 管理员、经理或具备对应写权限的成员可以修改团队资产。 */
export function canWriteTeamAssets(user: TeamUser, permission: string): boolean {
  const permissions = permissionList(user)
  return user.role === 'admin'
    || user.role === 'manager'
    || permissions.includes('*')
    || permissions.includes(permission)
}

/**
 * 用户级唯一表需要一个稳定记录承载团队共享配置。优先使用最早启用的管理员，
 * 没有管理员时回退到当前操作人；userId 只保留创建审计含义，不再作为访问边界。
 */
export async function resolveTeamConfigOwnerId(prisma: PrismaClient, fallbackUserId: string): Promise<string> {
  const owner = await prisma.user.findFirst({
    where: { isActive: true, role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  })
  return owner?.id || fallbackUserId
}
