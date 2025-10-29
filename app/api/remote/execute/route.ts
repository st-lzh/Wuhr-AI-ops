import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { executeSSHCommand } from '../../../../lib/ssh/client'

// 远程执行请求接口
interface RemoteExecuteRequest {
  hostId: string
  command: string
  timeout?: number
  workingDir?: string
}

// 远程执行响应接口
interface RemoteExecuteResponse {
  success: boolean
  hostId: string
  hostName?: string
  hostInfo?: string
  command: string
  stdout?: string
  stderr?: string
  exitCode?: number
  executionTime: number
  timestamp: string
  error?: string
}

// 专用的远程执行API端点
export async function POST(request: NextRequest) {
  console.log('\n🚀 [远程执行API] 开始处理远程执行请求')
  
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      console.log('❌ [远程执行API] 身份验证失败')
      return NextResponse.json(
        { success: false, error: '身份验证失败' },
        { status: 401 }
      )
    }

    const body: RemoteExecuteRequest = await request.json()
    const { hostId, command, timeout = 60000, workingDir } = body

    console.log('📥 [远程执行API] 接收到请求:', {
      userId: authResult.user.id,
      hostId,
      command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
      timeout,
      workingDir
    })

    // 验证必需参数
    if (!hostId || !command) {
      return NextResponse.json({
        success: false,
        error: '缺少必需参数: hostId 和 command'
      }, { status: 400 })
    }

    if (hostId === 'local') {
      return NextResponse.json({
        success: false,
        error: '此API仅用于远程执行，本地执行请使用其他端点'
      }, { status: 400 })
    }

    const startTime = Date.now()
    const prisma = await getPrismaClient()

    // 获取远程主机配置
    console.log('🔍 [远程执行API] 查找主机配置:', hostId)
    const server = await prisma.server.findUnique({
      where: { id: hostId }
    })

    if (!server) {
      console.log('❌ [远程执行API] 主机不存在:', hostId)
      return NextResponse.json({
        success: false,
        error: `主机不存在: ${hostId}`
      }, { status: 404 })
    }

    console.log('✅ [远程执行API] 找到主机配置:', {
      name: server.name,
      ip: server.ip,
      port: server.port,
      username: server.username,
      status: server.status
    })

    // 检查主机状态
    if (server.status !== 'online') {
      console.log('⚠️ [远程执行API] 主机状态异常:', server.status)
      return NextResponse.json({
        success: false,
        error: `主机状态异常: ${server.status}`,
        hostId,
        hostName: server.name
      }, { status: 503 })
    }

    // 构建SSH配置
    const sshConfig = {
      host: server.ip,
      port: server.port,
      username: server.username,
      password: server.password || undefined,
      timeout: timeout
    }

    console.log('🔗 [远程执行API] SSH连接配置:', {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      hasPassword: !!sshConfig.password,
      timeout: sshConfig.timeout
    })

    // 执行远程命令
    console.log('🚀 [远程执行API] 开始执行远程命令...')
    console.log('📝 [远程执行API] 执行命令:', command)

    const result = await executeSSHCommand(sshConfig, command, { cwd: workingDir })
    const executionTime = Date.now() - startTime

    console.log('📊 [远程执行API] 执行结果:', {
      success: result.success,
      exitCode: result.code,
      stdoutLength: result.stdout?.length || 0,
      stderrLength: result.stderr?.length || 0,
      executionTime: `${executionTime}ms`
    })

    // 构建响应
    const response: RemoteExecuteResponse = {
      success: result.success,
      hostId,
      hostName: server.name,
      hostInfo: `${server.name} (${server.ip}:${server.port})`,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code || undefined,
      executionTime,
      timestamp: new Date().toISOString()
    }

    if (!result.success) {
      response.error = result.stderr || '远程命令执行失败'
      console.log('❌ [远程执行API] 执行失败:', response.error)
    } else {
      console.log('✅ [远程执行API] 执行成功')
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('💥 [远程执行API] 处理异常:', error)
    return NextResponse.json({
      success: false,
      error: `远程执行异常: ${error instanceof Error ? error.message : '未知错误'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 获取远程主机列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: '身份验证失败' },
        { status: 401 }
      )
    }

    const prisma = await getPrismaClient()
    const servers = await prisma.server.findMany({
      select: {
        id: true,
        name: true,
        ip: true,
        port: true,
        username: true,
        status: true,
        description: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      servers: servers.map(server => ({
        ...server,
        available: server.status === 'online'
      }))
    })

  } catch (error) {
    console.error('获取远程主机列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取远程主机列表失败'
    }, { status: 500 })
  }
}
