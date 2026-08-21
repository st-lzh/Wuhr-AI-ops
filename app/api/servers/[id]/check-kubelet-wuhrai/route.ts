import { NextRequest, NextResponse } from 'next/server'
import { classifyAgentProbe } from '../../../../../lib/agentHealth'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'

async function fetchAgent(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    return await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers
    })
  } finally {
    clearTimeout(timeout)
  }
}

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

    // 获取服务器信息
    const prisma = await getPrismaClient()
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      return NextResponse.json({
        success: false,
        error: '服务器不存在'
      }, { status: 404 })
    }

    console.log('🔍 检查kubelet-wuhrai状态，服务器:', {
      name: server.name,
      ip: server.ip,
      kubeletPort: (server as any).kubeletPort || 2081
    })

    const recommendations: Array<{
      type: 'success' | 'warning' | 'error' | 'info'
      message: string
    }> = []

    let kubeletStatus = 'not_installed'
    let kubeletVersion = ''
    const kubeletPort = (server as any).kubeletPort || 2081
    const platformApiKey = process.env.IMPROVE_API_KEY?.trim() || ''

    try {
      // 健康端点通常免鉴权，只能证明服务存活；再访问只读配置端点验证平台通信密钥。
      console.log(`🔍 通过 HTTP API 检测 Agent 服务与通信鉴权 (${server.ip}:${kubeletPort})...`)
      const healthCheckUrl = `http://${server.ip}:${kubeletPort}/api/health`
      const requestHeaders: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
      if (platformApiKey) requestHeaders['X-API-Key'] = platformApiKey

      let healthStatus: number | undefined
      let authStatus: number | undefined

      try {
        const healthResponse = await fetchAgent(healthCheckUrl, requestHeaders)
        healthStatus = healthResponse.status
        if (healthResponse.ok) {
          const data = await healthResponse.json().catch(() => ({}))
          kubeletVersion = typeof data.version === 'string' ? data.version : 'unknown'
        }
      } catch (fetchError) {
        console.log('❌ Agent 健康端点无响应:', fetchError instanceof Error ? fetchError.message : '未知错误')
      }

      if (healthStatus && healthStatus >= 200 && healthStatus < 300 && platformApiKey) {
        try {
          const authResponse = await fetchAgent(
            `http://${server.ip}:${kubeletPort}/api/config/security`,
            requestHeaders
          )
          authStatus = authResponse.status
        } catch (authError) {
          console.log('⚠️ Agent 鉴权探针不可用:', authError instanceof Error ? authError.message : '未知错误')
        }
      }

      kubeletStatus = classifyAgentProbe({
        healthStatus,
        authStatus,
        platformKeyConfigured: Boolean(platformApiKey)
      })

      if (kubeletStatus !== 'not_installed') {
        recommendations.push({ type: 'success', message: `Agent 服务运行正常（端口 ${kubeletPort}）` })
        if (kubeletVersion && kubeletVersion !== 'unknown') {
          recommendations.push({ type: 'info', message: `版本：${kubeletVersion}` })
        }
      }

      if (kubeletStatus === 'installed') {
        recommendations.push({ type: 'success', message: '平台与 Agent 通信鉴权已验证，可以使用 AI 运维功能' })
      } else if (kubeletStatus === 'authentication_mismatch') {
        recommendations.push({ type: 'error', message: 'Agent 通信密钥与当前平台不一致，AI 请求会被 401 拒绝' })
        recommendations.push({ type: 'info', message: '点击下方“同步密钥并更新 Agent”，平台会通过 SSH 安全同步当前密钥' })
      } else if (kubeletStatus === 'platform_misconfigured') {
        recommendations.push({ type: 'error', message: '平台未配置 IMPROVE_API_KEY，无法与 Agent 建立受保护的通信' })
        recommendations.push({ type: 'info', message: '请先补全平台环境变量并重新启动平台容器' })
      } else if (kubeletStatus === 'legacy_unverified') {
        recommendations.push({ type: 'warning', message: 'Agent 服务在线，但当前版本不支持通信鉴权验证' })
        recommendations.push({ type: 'info', message: '建议更新 Agent，以同步平台密钥并启用完整检查' })
      } else {
        recommendations.push({ type: 'error', message: `无法连接 Agent 服务（端口 ${kubeletPort}）` })
        recommendations.push({ type: 'warning', message: '请确认主机 SSH 凭据可用，然后通过下方操作安装并同步 Agent 通信密钥' })
      }

    } catch (error) {
      console.error('检测 Agent 失败:', error)
      recommendations.push({
        type: 'error',
        message: `检测失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        kubeletStatus,
        kubeletVersion,
        kubeletPort,
        recommendations,
        serverInfo: {
          name: server.name,
          ip: server.ip,
          port: kubeletPort
        }
      }
    })

  } catch (error) {
    console.error('检查kubelet-wuhrai状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '检查kubelet-wuhrai状态失败'
    }, { status: 500 })
  }
}
