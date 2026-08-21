import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import {
  createSSHConfigFromServer
} from '../../../../../lib/utils/sshConnectionUtils'
import { buildAgentInstallCommand } from '../../../../../lib/agentRelease'
import { randomUUID } from 'node:crypto'

function resolvePlatformAgentApiKey(): string {
  const apiKey = process.env.IMPROVE_API_KEY?.trim() || ''
  if (!apiKey) {
    throw new Error('平台未配置 Agent 通信密钥 IMPROVE_API_KEY，无法安装可用的 Agent')
  }
  if (!/^[A-Za-z0-9._:@+-]{20,}$/.test(apiKey)) {
    throw new Error('平台 Agent 通信密钥格式不合法，请检查 IMPROVE_API_KEY')
  }
  return apiKey
}

function buildAuthenticatedHealthCheck(port: number, apiKeyFile: string): string {
  return [
    `status=$(curl -sS -o /dev/null -w '%{http_code}'`,
    `-H "X-API-Key: $(cat '${apiKeyFile}')"`,
    `'http://127.0.0.1:${port}/api/health' 2>/dev/null || true)`,
    `[ "$status" = '200' ] && echo 'healthy' || echo "http_$status"`
  ].join(' ')
}

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
      if (body.port !== undefined) {
        kubeletPort = Number(body.port)
      }
    } catch {
      // 使用默认端口
    }

    if (!Number.isInteger(kubeletPort) || kubeletPort < 1 || kubeletPort > 65535) {
      return NextResponse.json({ success: false, error: 'Agent 端口必须是 1-65535 的整数' }, { status: 400 })
    }

    let platformAgentApiKey: string
    try {
      platformAgentApiKey = resolvePlatformAgentApiKey()
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : '平台 Agent 通信密钥不可用'
      }, { status: 503 })
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
    const remoteApiKeyFile = `/tmp/.wuhr-agent-api-key-${randomUUID()}`

    try {
      // 连接到服务器
      installLogs.push('🔗 正在连接到服务器...')
      await sshClient.connect()
      installLogs.push('✅ SSH连接成功')

      // 密钥只通过 SSH 标准输入传输，不出现在命令、接口响应或安装日志中。
      const keyWriteResult = await sshClient.executeCommand(
        `umask 077 && cat > '${remoteApiKeyFile}' && chmod 600 '${remoteApiKeyFile}'`,
        { stdin: `${platformAgentApiKey}\n` }
      )
      if (!keyWriteResult.success) {
        throw new Error(`同步 Agent 通信密钥失败: ${keyWriteResult.stderr || '远程主机拒绝写入临时密钥文件'}`)
      }
      installLogs.push('🔐 Agent 通信密钥已安全同步')

      // 检测是否已安装
      installLogs.push('🔍 检测是否已安装kubelet-wuhrai...')
      const checkResult = await sshClient.executeCommand('which kubelet-wuhrai || ls /opt/kubelet-wuhrai/kubelet-wuhrai 2>/dev/null')

      if (checkResult.stdout && checkResult.stdout.trim()) {
        // 已安装，检查是否运行
        installLogs.push('📦 检测到已安装kubelet-wuhrai')

        const healthCheck = await sshClient.executeCommand(
          buildAuthenticatedHealthCheck(kubeletPort, remoteApiKeyFile)
        )

        if (healthCheck.stdout.trim() === 'healthy') {
          installLogs.push('✅ kubelet-wuhrai 服务已在运行，鉴权验证通过')
          installSuccess = true
        } else if (/http_(401|403)/.test(healthCheck.stdout)) {
          installLogs.push('🔄 检测到 Agent 密钥与平台不一致，准备自动修复...')
        } else {
          // 已安装但未运行，尝试启动
          installLogs.push('🔄 尝试启动kubelet-wuhrai服务...')
          const startResult = await sshClient.executeCommand('/opt/kubelet-wuhrai/start.sh 2>&1 || kubelet-wuhrai-start 2>&1')
          installLogs.push(startResult.stdout || startResult.stderr || '启动命令已执行')

          // 等待3秒后再次检查
          await new Promise(resolve => setTimeout(resolve, 3000))

          const healthCheck2 = await sshClient.executeCommand(
            buildAuthenticatedHealthCheck(kubeletPort, remoteApiKeyFile)
          )
          if (healthCheck2.stdout.trim() === 'healthy') {
            installLogs.push('✅ kubelet-wuhrai 服务启动成功，鉴权验证通过')
            installSuccess = true
          } else {
            installLogs.push('⚠️ 服务未通过鉴权健康检查，尝试重新安装...')
          }
        }
      }

      // 如果未安装或启动失败，执行安装脚本
      if (!installSuccess) {
        installLogs.push('📥 开始下载并执行安装脚本...')

        // 构建安装命令
        const installCommand = `${buildAgentInstallCommand(kubeletPort, { apiKeyFile: remoteApiKeyFile })} 2>&1`

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

          const verifyResult = await sshClient.executeCommand(
            buildAuthenticatedHealthCheck(kubeletPort, remoteApiKeyFile)
          )

          if (verifyResult.stdout.trim() === 'healthy') {
            installLogs.push('✅ kubelet-wuhrai 服务及鉴权验证成功')
            installSuccess = true
          } else {
            installLogs.push(`⚠️ 安装完成但服务未通过鉴权健康检查（${verifyResult.stdout.trim() || '无响应'}）`)
            errorMessage = '安装完成但 Agent 通信鉴权未通过'
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
      // 无论安装成功与否都删除远程临时密钥文件。
      try {
        await sshClient.executeCommand(`rm -f '${remoteApiKeyFile}'`)
      } catch {
        // SSH 连接可能已经中断，临时目录会由系统后续清理。
      }
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
