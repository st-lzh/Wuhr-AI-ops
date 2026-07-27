import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { executeSSHCommand } from '../../../../../lib/ssh/client'
import { revealSecret } from '../../../../../lib/crypto/encryption'

// 检查远程主机的Gemini CLI安装状态
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const serverId = params.id
    console.log('🔍 检查远程主机Gemini CLI状态:', serverId)

    const prisma = await getPrismaClient()

    // 获取服务器信息
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      return NextResponse.json({
        success: false,
        error: '服务器不存在'
      }, { status: 404 })
    }

    // 构建SSH配置
    const sshConfig = {
      host: server.ip,
      port: server.port,
      username: server.username,
      password: revealSecret(server.password) || undefined,
      timeout: 30000
    }

    // 检查gemini命令是否存在
    const checkResult = await executeSSHCommand(
      sshConfig,
      'which gemini && gemini --version'
    )

    let status = 'not_installed'
    let version = null
    let installCommand = 'npm install -g @gemini-ai/cli'

    if (checkResult.success && checkResult.stdout) {
      const output = checkResult.stdout.trim()
      if (output.includes('/') && !output.includes('not found')) {
        status = 'installed'
        // 尝试提取版本信息
        const versionMatch = output.match(/v?(\d+\.\d+\.\d+)/)
        if (versionMatch) {
          version = versionMatch[1]
        }
      }
    }

    // 检查Node.js环境
    const nodeCheckResult = await executeSSHCommand(
      sshConfig,
      'node --version && npm --version'
    )

    let nodeInfo = null
    if (nodeCheckResult.success && nodeCheckResult.stdout) {
      const lines = nodeCheckResult.stdout.trim().split('\n')
      nodeInfo = {
        nodeVersion: lines[0]?.replace('v', '') || 'unknown',
        npmVersion: lines[1] || 'unknown'
      }
    }

    console.log('✅ Gemini CLI状态检查完成:', {
      serverId,
      status,
      version,
      hasNode: !!nodeInfo
    })

    return NextResponse.json({
      success: true,
      data: {
        serverId,
        serverName: server.name,
        geminiStatus: status,
        geminiVersion: version,
        nodeInfo,
        installCommand,
        recommendations: getRecommendations(status, nodeInfo)
      }
    })

  } catch (error) {
    console.error('❌ 检查Gemini CLI状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '检查失败'
    }, { status: 500 })
  }
}

// 获取安装建议
function getRecommendations(status: string, nodeInfo: any) {
  const recommendations = []

  if (!nodeInfo) {
    recommendations.push({
      type: 'error',
      message: '未检测到Node.js环境，请先安装Node.js'
    })
  } else {
    const nodeVersion = parseFloat(nodeInfo.nodeVersion)
    if (nodeVersion < 16) {
      recommendations.push({
        type: 'warning',
        message: `Node.js版本过低 (${nodeInfo.nodeVersion})，建议升级到16+`
      })
    }
  }

  if (status === 'not_installed') {
    recommendations.push({
      type: 'info',
      message: '请安装Gemini CLI以使用AI聊天功能'
    })
  } else if (status === 'installed') {
    recommendations.push({
      type: 'success',
      message: 'Gemini CLI已正确安装，可以使用AI聊天功能'
    })
  }

  return recommendations
}

// 安装Gemini CLI
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const serverId = params.id
    console.log('🔧 在远程主机安装Gemini CLI:', serverId)

    const prisma = await getPrismaClient()

    // 获取服务器信息
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      return NextResponse.json({
        success: false,
        error: '服务器不存在'
      }, { status: 404 })
    }

    // 构建SSH配置
    const sshConfig = {
      host: server.ip,
      port: server.port,
      username: server.username,
      password: revealSecret(server.password) || undefined,
      timeout: 30000
    }

    // 执行安装命令
    const installResult = await executeSSHCommand(
      sshConfig,
      'npm install -g @gemini-ai/cli'
    )

    if (installResult.success) {
      // 验证安装是否成功
      const verifyResult = await executeSSHCommand(
        sshConfig,
        'gemini --version'
      )

      if (verifyResult.success) {
        console.log('✅ Gemini CLI安装成功')
        return NextResponse.json({
          success: true,
          message: 'Gemini CLI安装成功',
          output: installResult.stdout,
          version: verifyResult.stdout?.trim()
        })
      }
    }

    console.error('❌ Gemini CLI安装失败:', installResult.stderr)
    return NextResponse.json({
      success: false,
      error: `安装失败: ${installResult.stderr}`,
      output: installResult.stdout
    }, { status: 500 })

  } catch (error) {
    console.error('❌ 安装Gemini CLI失败:', error)
    return NextResponse.json({
      success: false,
      error: '安装失败'
    }, { status: 500 })
  }
}
