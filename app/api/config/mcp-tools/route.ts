import { NextRequest, NextResponse } from 'next/server'
import { 
  requireAuth, 
  successResponse, 
  errorResponse,
  serverErrorResponse
} from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { canWriteTeamAssets, resolveTeamConfigOwnerId } from '../../../../lib/auth/teamAccess'
import { maskEnvironment, protectEnvironment } from '../../../../lib/crypto/environmentSecrets'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// MCP配置接口定义
interface MCPServer {
  id: string
  name: string
  command: string
  url?: string
  args: string[]
  env: Record<string, string>
  isConnected: boolean
  tools: MCPTool[]
  status: 'connected' | 'disconnected' | 'error'
}

interface MCPTool {
  name: string
  description: string
  inputSchema: any
  server: string
  transport?: 'stdio' | 'http'
  annotations?: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
  requiresApproval?: boolean
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  discoveryEnabled: boolean
  autoConnect: boolean
}

function maskServers(servers: MCPServer[]): MCPServer[] {
  return servers.map(server => ({ ...server, env: maskEnvironment(server.env) }))
}

// GET - 获取MCP配置
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    console.log('📦 获取MCP工具配置')

    const { user } = authResult
    const prisma = await getPrismaClient()
    const teamOwnerId = await resolveTeamConfigOwnerId(prisma, user.id)
    
    // 从数据库获取用户的MCP配置
    let dbConfig = await prisma.mCPToolsConfig.findUnique({
      where: { userId: teamOwnerId }
    })
    
    // 如果用户没有配置，创建默认配置
    if (!dbConfig) {
      dbConfig = await prisma.mCPToolsConfig.create({
        data: {
          userId: teamOwnerId,
          enabled: false,
          servers: [],
          discoveryEnabled: true,
          autoConnect: true
        }
      })
    }

    // 数据库是 MCP 配置的唯一数据源；实际调用时会把这里的服务器配置
    // 传给 kubelet-wuhrai，由后端按请求发现和注册工具。
    const config: MCPConfig = {
      enabled: dbConfig.enabled,
      servers: Array.isArray(dbConfig.servers)
        ? maskServers(dbConfig.servers as unknown as MCPServer[])
        : [],
      discoveryEnabled: dbConfig.discoveryEnabled,
      autoConnect: dbConfig.autoConnect
    }

    return successResponse(config)

  } catch (error) {
    console.error('获取MCP配置失败:', error)
    return serverErrorResponse(error)
  }
}

// POST - 保存MCP配置
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    console.log('💾 保存MCP工具配置')

    // 验证配置格式
    if (!body || typeof body.enabled !== 'boolean') {
      return errorResponse('无效的MCP配置', '配置格式不正确', 400)
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'config:write')) {
      return errorResponse('权限不足', '需要 MCP 配置权限', 403)
    }
    const prisma = await getPrismaClient()
    const teamOwnerId = await resolveTeamConfigOwnerId(prisma, user.id)
    const existingConfig = await prisma.mCPToolsConfig.findUnique({ where: { userId: teamOwnerId } })
    const previousServers = Array.isArray(existingConfig?.servers)
      ? existingConfig.servers as unknown as MCPServer[]
      : []

    const incomingServers = Array.isArray(body.servers) ? body.servers as MCPServer[] : []
    const protectedServers = incomingServers.map(server => {
      const previous = previousServers.find(item => item.id === server.id)
      return {
        ...server,
        env: protectEnvironment(server.env, previous?.env)
      }
    })

    const config: MCPConfig = {
      enabled: body.enabled,
      servers: protectedServers,
      discoveryEnabled: body.discoveryEnabled !== false,
      autoConnect: body.autoConnect !== false
    }

    // 验证服务器配置
    for (const server of config.servers) {
      if (!server.id || !server.name || (!server.command && !server.url)) {
        return errorResponse('服务器配置无效', '服务器 ID、名称，以及命令或 URL 不能为空', 400)
      }
    }

    // 保存到数据库（使用upsert确保更新或创建）
    const savedConfig = await prisma.mCPToolsConfig.upsert({
      where: { userId: teamOwnerId },
      update: {
        enabled: config.enabled,
        servers: config.servers as any,
        discoveryEnabled: config.discoveryEnabled,
        autoConnect: config.autoConnect
      },
      create: {
        userId: teamOwnerId,
        enabled: config.enabled,
        servers: config.servers as any,
        discoveryEnabled: config.discoveryEnabled,
        autoConnect: config.autoConnect
      }
    })

    console.log('✅ MCP配置保存成功')

    return successResponse({
      message: 'MCP配置保存成功',
      config: { ...config, servers: maskServers(config.servers) }
    })

  } catch (error) {
    console.error('保存MCP配置失败:', error)
    return serverErrorResponse(error)
  }
}
