import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  errorResponse,
  serverErrorResponse
} from '../../../../../lib/auth/apiHelpers'
import { getBackendApiKey, getBackendBaseUrl } from '../../../../../lib/improve/backendProxy'
import { getPrismaClient } from '../../../../../lib/config/database'
import { canWriteTeamAssets, resolveTeamConfigOwnerId } from '../../../../../lib/auth/teamAccess'
import { revealEnvironment } from '../../../../../lib/crypto/environmentSecrets'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const TestRequestSchema = z.object({
  serverId: z.string().min(1),
  confirmed: z.boolean().optional().default(false)
})

interface StoredMCPServer {
  id: string
  name: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

function actorFor(user: { id: string; email?: string | null; username?: string | null }) {
  return (user.email || user.username || user.id).replace(/[^\x20-\x7e]/g, '?').slice(0, 128)
}

// POST - 在真正运行 Agent 的 kubelet-wuhrai 服务器上测试 MCP 连接。
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const { user } = authResult
    if (!canWriteTeamAssets(user, 'config:write')) {
      return errorResponse('权限不足', '需要 MCP 配置权限', 403)
    }

    const parsed = TestRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return errorResponse('测试参数无效', parsed.error.errors.map(item => item.message).join('; '), 400)
    }
    if (!parsed.data.confirmed) {
      return NextResponse.json({
        success: false,
        state: 'confirmation_required',
        error: '执行真实 MCP 连接测试前必须核对并确认命令'
      }, { status: 409 })
    }

    const prisma = await getPrismaClient()
    const ownerId = await resolveTeamConfigOwnerId(prisma, user.id)
    const dbConfig = await prisma.mCPToolsConfig.findUnique({ where: { userId: ownerId } })
    const servers = Array.isArray(dbConfig?.servers) ? dbConfig.servers as unknown as StoredMCPServer[] : []
    const server = servers.find(item => item.id === parsed.data.serverId)
    if (!server) {
      return errorResponse('MCP 服务器不存在', '请先保存配置，再执行连接测试', 404)
    }
    if (!server.name || (!server.command && !server.url)) {
      return errorResponse('MCP 服务器配置不完整', '服务器名称，以及命令或 URL 不能为空', 400)
    }

    const apiKey = getBackendApiKey()
    if (!apiKey) {
      return NextResponse.json({ success: false, error: '后端 API key 未配置' }, { status: 500 })
    }

    const backendBase = getBackendBaseUrl().replace(/\/$/, '')
    const response = await fetch(`${backendBase}/api/mcp/servers/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Actor': actorFor(user)
      },
      body: JSON.stringify({
        name: server.name,
        command: server.command || '',
        args: Array.isArray(server.args) ? server.args : [],
        env: revealEnvironment(server.env),
        url: server.url || ''
      }),
      signal: AbortSignal.timeout(20_000)
    })

    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      await prisma.systemLog.create({
        data: {
          level: 'warn',
          category: 'mcp_tools',
          source: 'mcp-tools-test',
          userId: user.id,
          message: `真实测试 MCP 服务器：${server.name} - 失败`,
          details: {
            action: 'mcp_server_test',
            serverId: server.id,
            serverName: server.name,
            transport: server.url ? 'http' : 'stdio',
            backendStatus: response.status,
            error: result?.error || result?.message || '连接失败'
          }
        }
      })
      return errorResponse(
        `服务器 "${server.name}" 连接失败`,
        result?.error || result?.message || `后端返回 HTTP ${response.status}`,
        400
      )
    }

    const tools = Array.isArray(result.toolMetadata)
      ? result.toolMetadata.map((tool: any) => ({
          name: String(tool.name || ''),
          description: String(tool.description || ''),
          inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : {},
          server: String(tool.server || server.name),
          transport: tool.transport === 'http' ? 'http' : 'stdio',
          annotations: tool.annotations && typeof tool.annotations === 'object' ? tool.annotations : {},
          riskLevel: ['low', 'medium', 'high'].includes(tool.riskLevel) ? tool.riskLevel : 'medium',
          requiresApproval: tool.requiresApproval !== false
        }))
      : (Array.isArray(result.tools) ? result.tools : []).map((name: string) => ({
          name,
          description: '',
          inputSchema: {},
          server: server.name,
          transport: server.url ? 'http' : 'stdio',
          annotations: {},
          riskLevel: 'medium',
          requiresApproval: true
        }))

    await prisma.systemLog.create({
      data: {
        level: 'info',
        category: 'mcp_tools',
        source: 'mcp-tools-test',
        userId: user.id,
        message: `真实测试 MCP 服务器：${server.name} - 成功`,
        details: {
          action: 'mcp_server_test',
          serverId: server.id,
          serverName: server.name,
          transport: server.url ? 'http' : 'stdio',
          toolCount: result.toolsFound ?? tools.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: result.message || `服务器 "${server.name}" 连接测试成功`,
        connected: result.isConnected === true,
        tools,
        toolCount: result.toolsFound ?? tools.length
      }
    })
  } catch (error) {
    console.error('MCP连接测试异常:', error)
    return serverErrorResponse(error)
  }
}
