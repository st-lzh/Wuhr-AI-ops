import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { executeSSHCommand } from '../../../../lib/ssh/client'

// 健康检查响应接口
interface HealthCheckResponse {
  success: boolean
  hostId: string
  hostName?: string
  hostInfo?: string
  checks: {
    sshConnection: boolean
    kubeletWuhraiAvailable: boolean
    systemInfo?: {
      hostname?: string
      username?: string
      workingDirectory?: string
      kubeletWuhraiVersion?: string
    }
  }
  timestamp: string
  error?: string
}

// 远程主机健康检查API
export async function POST(request: NextRequest) {
  console.log('\n🏥 [健康检查API] 开始远程主机健康检查')
  
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: '身份验证失败' },
        { status: 401 }
      )
    }

    const { hostId } = await request.json()

    console.log('📥 [健康检查API] 检查主机:', hostId)

    if (!hostId) {
      return NextResponse.json({
        success: false,
        error: '缺少必需参数: hostId'
      }, { status: 400 })
    }

    if (hostId === 'local') {
      return NextResponse.json({
        success: false,
        error: '此API仅用于远程主机检查'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 获取主机配置
    const server = await prisma.server.findUnique({
      where: { id: hostId }
    })

    if (!server) {
      return NextResponse.json({
        success: false,
        error: `主机不存在: ${hostId}`
      }, { status: 404 })
    }

    console.log('🔍 [健康检查API] 主机信息:', {
      name: server.name,
      ip: server.ip,
      port: server.port,
      username: server.username
    })

    const response: HealthCheckResponse = {
      success: false,
      hostId,
      hostName: server.name,
      hostInfo: `${server.name} (${server.ip}:${server.port})`,
      checks: {
        sshConnection: false,
        kubeletWuhraiAvailable: false
      },
      timestamp: new Date().toISOString()
    }

    // SSH配置
    const sshConfig = {
      host: server.ip,
      port: server.port,
      username: server.username,
      password: server.password || undefined,
      timeout: 30000 // 30秒超时
    }

    try {
      // 1. 测试SSH连接和基本系统信息
      console.log('🔗 [健康检查API] 测试SSH连接...')
      const systemInfoResult = await executeSSHCommand(
        sshConfig, 
        'echo "SSH_OK" && hostname && whoami && pwd'
      )

      if (systemInfoResult.success && systemInfoResult.stdout?.includes('SSH_OK')) {
        response.checks.sshConnection = true
        console.log('✅ [健康检查API] SSH连接成功')

        // 解析系统信息
        const lines = systemInfoResult.stdout.split('\n').filter(line => line.trim())
        if (lines.length >= 4) {
          response.checks.systemInfo = {
            hostname: lines[1]?.trim(),
            username: lines[2]?.trim(),
            workingDirectory: lines[3]?.trim()
          }
        }
      } else {
        console.log('❌ [健康检查API] SSH连接失败:', systemInfoResult.stderr)
        response.error = `SSH连接失败: ${systemInfoResult.stderr}`
        return NextResponse.json(response)
      }

      // 2. 检查kubelet-wuhrai可用性 - 使用更严格的检测逻辑
      console.log('🔍 [健康检查API] 检查kubelet-wuhrai可用性...')
      const kubeletCheckResult = await executeSSHCommand(
        sshConfig,
        'which kubelet-wuhrai && kubelet-wuhrai --version'
      )

      console.log('📊 [健康检查API] kubelet-wuhrai检测结果:', {
        success: kubeletCheckResult.success,
        code: kubeletCheckResult.code,
        stdout: kubeletCheckResult.stdout,
        stderr: kubeletCheckResult.stderr
      })

      // 检查命令是否存在且能正常执行版本命令
      if (kubeletCheckResult.code === 0 && kubeletCheckResult.stdout.includes('kubelet-wuhrai')) {
        response.checks.kubeletWuhraiAvailable = true
        console.log('✅ [健康检查API] kubelet-wuhrai可用')
        
        // 提取版本信息
        if (kubeletCheckResult.stdout) {
          const versionMatch = kubeletCheckResult.stdout.match(/version\s+([^\s\n]+)/i)
          if (versionMatch) {
            response.checks.systemInfo = response.checks.systemInfo || {}
            response.checks.systemInfo.kubeletWuhraiVersion = versionMatch[1]
          }
        }
      } else {
        console.log('❌ [健康检查API] kubelet-wuhrai不可用:', kubeletCheckResult.stderr)
        response.error = `kubelet-wuhrai不可用: ${kubeletCheckResult.stderr}`
      }

      // 3. 综合判断健康状态
      response.success = response.checks.sshConnection && response.checks.kubeletWuhraiAvailable

      console.log('📊 [健康检查API] 健康检查完成:', {
        success: response.success,
        sshConnection: response.checks.sshConnection,
        kubeletWuhraiAvailable: response.checks.kubeletWuhraiAvailable
      })

      return NextResponse.json(response)

    } catch (sshError) {
      console.error('💥 [健康检查API] SSH执行异常:', sshError)
      response.error = `SSH执行异常: ${sshError instanceof Error ? sshError.message : '未知错误'}`
      return NextResponse.json(response)
    }

  } catch (error) {
    console.error('💥 [健康检查API] 处理异常:', error)
    return NextResponse.json({
      success: false,
      error: `健康检查异常: ${error instanceof Error ? error.message : '未知错误'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 批量健康检查
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
      where: {
        status: 'online'
      },
      select: {
        id: true,
        name: true,
        ip: true,
        port: true
      }
    })



    const results = await Promise.allSettled(
      servers.map(async (server) => {
        const sshConfig = {
          host: server.ip,
          port: server.port,
          username: 'root', // 假设使用root用户，实际应该从数据库获取
          timeout: 10000 // 10秒超时
        }

        try {
          const result = await executeSSHCommand(sshConfig, 'echo "OK" && which kubelet-wuhrai')
          console.log(`📊 [批量健康检查] ${server.name} 检测结果:`, {
            success: result.success,
            code: result.code,
            stdout: result.stdout,
            stderr: result.stderr
          })

          return {
            hostId: server.id,
            hostName: server.name,
            available: result.code === 0 && result.stdout?.includes('kubelet-wuhrai') && result.stdout?.includes('OK')
          }
        } catch {
          return {
            hostId: server.id,
            hostName: server.name,
            available: false
          }
        }
      })
    )

    const healthStatus = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          hostId: servers[index].id,
          hostName: servers[index].name,
          available: false,
          error: 'Health check failed'
        }
      }
    })

    return NextResponse.json({
      success: true,
      results: healthStatus,
      summary: {
        total: servers.length,
        available: healthStatus.filter(h => h.available).length,
        unavailable: healthStatus.filter(h => !h.available).length
      }
    })

  } catch (error) {
    console.error('批量健康检查失败:', error)
    return NextResponse.json({
      success: false,
      error: '批量健康检查失败'
    }, { status: 500 })
  }
}
