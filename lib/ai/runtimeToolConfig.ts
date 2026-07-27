import type { PrismaClient } from '../generated/prisma'
import { revealEnvironment } from '../crypto/environmentSecrets'
import { resolveTeamConfigOwnerId } from '../auth/teamAccess'

export interface RuntimeToolConfig {
  customTools: any[]
  mcpServers: any[]
  customToolsEnabled: boolean
  mcpEnabled: boolean
}

/**
 * Agent 工具配置只从团队数据库读取。浏览器提交的命令和环境变量不进入执行链，
 * 防止成员绕过配置审批临时注入可执行程序或敏感变量。
 */
export async function resolveRuntimeToolConfig(
  prisma: PrismaClient,
  userId: string
): Promise<RuntimeToolConfig> {
  const ownerId = await resolveTeamConfigOwnerId(prisma, userId)
  const [customConfig, mcpConfig] = await Promise.all([
    prisma.customToolsConfig.findUnique({ where: { userId: ownerId } }),
    prisma.mCPToolsConfig.findUnique({ where: { userId: ownerId } })
  ])

  const customTools = customConfig?.enabled && Array.isArray(customConfig.tools)
    ? (customConfig.tools as any[])
        .filter(tool => tool && tool.isActive !== false)
        .map(tool => ({ ...tool, env: revealEnvironment(tool.env) }))
    : []

  const mcpServers = mcpConfig?.enabled && Array.isArray(mcpConfig.servers)
    ? (mcpConfig.servers as any[])
        .filter(server => server && server.disabled !== true)
        .map(server => ({ ...server, env: revealEnvironment(server.env) }))
    : []

  return {
    customTools,
    mcpServers,
    customToolsEnabled: customConfig?.enabled === true,
    mcpEnabled: mcpConfig?.enabled === true
  }
}
