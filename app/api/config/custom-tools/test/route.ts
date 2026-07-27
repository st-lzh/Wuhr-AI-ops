import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { getBackendApiKey, getBackendBaseUrl } from '../../../../../lib/improve/backendProxy'
import { resolveTeamConfigOwnerId } from '../../../../../lib/auth/teamAccess'
import { revealEnvironment } from '../../../../../lib/crypto/environmentSecrets'

export const dynamic = 'force-dynamic'

const TestRequestSchema = z.object({
  toolId: z.string().min(1),
  confirmed: z.boolean().optional().default(false)
})

interface StoredCustomTool {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  workingDirectory?: string
  timeout?: number
  isActive?: boolean
}

function actorFor(user: { id: string; email?: string | null; username?: string | null }) {
  return (user.email || user.username || user.id).replace(/[^\x20-\x7e]/g, '?').slice(0, 128)
}

/**
 * 在真正运行 Agent 的服务器上测试已持久化的自定义工具。
 * 客户端只能提交工具 ID，命令、参数和环境变量全部从数据库重新读取；
 * confirmed 代表用户已经在界面核对过完整命令并明确确认本次执行。
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const { user } = authResult

    const permissions = Array.isArray(user.permissions) ? user.permissions : []
    if (user.role !== 'admin' && user.role !== 'manager' && !permissions.includes('*') && !permissions.includes('config:write')) {
      return NextResponse.json({ success: false, error: '没有自定义工具测试权限' }, { status: 403 })
    }

    const parsed = TestRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '测试参数无效', details: parsed.error.errors }, { status: 400 })
    }
    if (!parsed.data.confirmed) {
      return NextResponse.json({
        success: false,
        state: 'confirmation_required',
        error: '执行真实工具测试前必须核对并确认命令'
      }, { status: 409 })
    }

    const prisma = await getPrismaClient()
    const teamOwnerId = await resolveTeamConfigOwnerId(prisma, user.id)
    const dbConfig = await prisma.customToolsConfig.findUnique({ where: { userId: teamOwnerId } })
    const tools = Array.isArray(dbConfig?.tools) ? dbConfig.tools as unknown as StoredCustomTool[] : []
    const tool = tools.find(item => item.id === parsed.data.toolId)
    if (!tool) {
      return NextResponse.json({ success: false, error: '自定义工具不存在或不属于当前配置' }, { status: 404 })
    }
    if (tool.isActive === false) {
      return NextResponse.json({ success: false, error: '自定义工具已停用，不能执行测试' }, { status: 409 })
    }

    const apiKey = getBackendApiKey()
    if (!apiKey) {
      return NextResponse.json({ success: false, error: '后端 API key 未配置' }, { status: 500 })
    }

    const timeout = Math.min(Math.max(Number(tool.timeout) || dbConfig?.defaultTimeout || 30_000, 1_000), 120_000)
    const backendBase = getBackendBaseUrl().replace(/\/$/, '')
    const response = await fetch(`${backendBase}/api/tools/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Actor': actorFor(user)
      },
      body: JSON.stringify({
        id: tool.id,
        name: tool.name,
        command: tool.command,
        args: Array.isArray(tool.args) ? tool.args : [],
        env: revealEnvironment(tool.env),
        workingDirectory: tool.workingDirectory || '',
        timeout
      }),
      signal: AbortSignal.timeout(timeout + 5_000)
    })

    const result = await response.json().catch(() => null)
    const execution = result?.data || null
    await prisma.systemLog.create({
      data: {
        level: response.ok && result?.success ? 'info' : 'warn',
        category: 'custom_tools',
        source: 'custom-tools-test',
        userId: user.id,
        message: `真实测试自定义工具：${tool.name} - ${response.ok && result?.success ? '成功' : '失败'}`,
        details: {
          action: 'custom_tool_test',
          toolId: tool.id,
          toolName: tool.name,
          command: tool.command,
          args: Array.isArray(tool.args) ? tool.args : [],
          success: result?.success === true,
          exitCode: execution?.exitCode,
          executionTimeMs: execution?.executionTimeMs,
          timedOut: execution?.timedOut === true,
          outputTruncated: execution?.outputTruncated === true
        }
      }
    })

    return NextResponse.json({
      success: result?.success === true,
      data: execution,
      error: result?.error || (!response.ok ? `后端返回 HTTP ${response.status}` : undefined),
      message: result?.success ? `工具“${tool.name}”真实测试成功` : `工具“${tool.name}”真实测试失败`
    }, { status: response.ok && result?.success ? 200 : response.status || 502 })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    console.error('真实测试自定义工具失败:', error)
    return NextResponse.json({
      success: false,
      error: isTimeout ? '工具执行超时' : error instanceof Error ? error.message : '工具测试失败'
    }, { status: isTimeout ? 504 : 500 })
  }
}
