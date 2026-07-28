import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import {
  createSSHConfigFromServer
} from '../../../../../lib/utils/sshConnectionUtils'
import { buildAgentInstallCommand } from '../../../../../lib/agentRelease'

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

    // 获取请求体中的端口配置
    let kubeletPort = 2081
    try {
      const body = await request.json()
      if (body.port) {
        kubeletPort = parseInt(body.port, 10) || 2081
      }
    } catch {
      // 使用默认端口
    }

    // 获取服务器信息
    const prisma = await getPrismaClient()
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        username: true,
        password: true,
        keyPath: true,
        status: true
      }
    })

    if (!server) {
      return NextResponse.json({
        success: false,
        error: '服务器不存在'
      }, { status: 404 })
    }

    console.log('🔧 开始安装kubelet-wuhrai，服务器:', {
      name: server.name,
      ip: server.ip,
      kubeletPort
    })

    // 验证认证信息
    if (!server.password && !server.keyPath) {
      return NextResponse.json({
        success: false,
        error: '缺少认证信息，无法连接服务器进行安装'
      }, { status: 400 })
    }

    // 创建SSH连接配置
    const sshConfig = createSSHConfigFromServer(server)

    // 动态加载 SSH 客户端
    const { SSHClient } = await import('../../../../../lib/ssh/client')

    // 创建SSH客户端
    const sshClient = new SSHClient({
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      password: sshConfig.password,
      privateKey: sshConfig.privateKey
    })

    const installLogs: string[] = []
    let installSuccess = false
    let errorMessage = ''

    try {
      // 连接到服务器
      installLogs.push('🔗 正在连接到服务器...')
      await sshClient.connect()
      installLogs.push('✅ SSH连接成功')

      // 检测是否已安装
      installLogs.push('🔍 检测是否已安装kubelet-wuhrai...')
      const checkResult = await sshClient.executeCommand('which kubelet-wuhrai || ls /opt/kubelet-wuhrai/kubelet-wuhrai 2>/dev/null')

      if (checkResult.stdout && checkResult.stdout.trim()) {
        // 已安装，检查是否运行
        installLogs.push('📦 检测到已安装kubelet-wuhrai')

        const healthCheck = await sshClient.executeCommand(`curl -s http://127.0.0.1:${kubeletPort}/api/health 2>/dev/null || echo "not_running"`)

        if (healthCheck.stdout && !healthCheck.stdout.includes('not_running')) {
          installLogs.push('✅ kubelet-wuhrai 服务已在运行')
          installSuccess = true
        } else {
          // 已安装但未运行，尝试启动
          installLogs.push('🔄 尝试启动kubelet-wuhrai服务...')
          const startResult = await sshClient.executeCommand('/opt/kubelet-wuhrai/start.sh 2>&1 || kubelet-wuhrai-start 2>&1')
          installLogs.push(startResult.stdout || startResult.stderr || '启动命令已执行')

          // 等待3秒后再次检查
          await new Promise(resolve => setTimeout(resolve, 3000))

          const healthCheck2 = await sshClient.executeCommand(`curl -s http://127.0.0.1:${kubeletPort}/api/health 2>/dev/null || echo "not_running"`)
          if (healthCheck2.stdout && !healthCheck2.stdout.includes('not_running')) {
            installLogs.push('✅ kubelet-wuhrai 服务启动成功')
            installSuccess = true
          } else {
            installLogs.push('⚠️ 服务启动可能失败，尝试重新安装...')
          }
        }
      }

      // 如果未安装或启动失败，执行安装脚本
      if (!installSuccess) {
        installLogs.push('📥 开始下载并执行安装脚本...')

        // 构建安装命令
        const installCommand = `${buildAgentInstallCommand(kubeletPort)} 2>&1`

        installLogs.push(`执行: ${installCommand}`)

        // 执行安装脚本（安装脚本内部有超时处理）
        const installResult = await sshClient.executeCommand(installCommand)

        if (installResult.stdout) {
          installLogs.push(installResult.stdout)
        }
        if (installResult.stderr) {
          installLogs.push(`stderr: ${installResult.stderr}`)
        }

        // 检查安装结果 (SSHResult 使用 code 属性)
        if (installResult.code === 0 || (installResult.stdout && installResult.stdout.includes('安装完成'))) {
          installLogs.push('✅ 安装脚本执行成功')

          // 等待3秒后验证服务
          await new Promise(resolve => setTimeout(resolve, 3000))

          const verifyResult = await sshClient.executeCommand(`curl -s http://127.0.0.1:${kubeletPort}/api/health 2>/dev/null || echo "not_running"`)

          if (verifyResult.stdout && !verifyResult.stdout.includes('not_running')) {
            installLogs.push('✅ kubelet-wuhrai 服务验证成功')
            installSuccess = true
          } else {
            installLogs.push('⚠️ 安装完成但服务未正常响应，请检查日志')
            errorMessage = '安装完成但服务未正常响应'
          }
        } else {
          installLogs.push('❌ 安装脚本执行失败')
          errorMessage = installResult.stderr || '安装脚本执行失败'
        }
      }

    } catch (execError) {
      const errMsg = execError instanceof Error ? execError.message : '执行命令失败'
      installLogs.push(`❌ 错误: ${errMsg}`)
      errorMessage = errMsg
    } finally {
      // 关闭SSH连接
      try {
        await sshClient.disconnect()
        installLogs.push('🔌 SSH连接已关闭')
      } catch (disconnectError) {
        console.warn('SSH连接关闭时出现警告:', disconnectError)
      }
    }

    // 返回安装结果
    return NextResponse.json({
      success: installSuccess,
      data: {
        installed: installSuccess,
        kubeletPort,
        logs: installLogs,
        serverInfo: {
          name: server.name,
          ip: server.ip
        }
      },
      error: installSuccess ? undefined : (errorMessage || '安装失败')
    }, { status: installSuccess ? 200 : 500 })

  } catch (error) {
    console.error('安装kubelet-wuhrai失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '安装失败'
    }, { status: 500 })
  }
}
