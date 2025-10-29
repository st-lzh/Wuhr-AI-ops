import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'

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

    try {
      // 使用 HTTP API 方式检测 kubelet-wuhrai 状态
      console.log(`🔍 通过 HTTP API 检测 kubelet-wuhrai (${server.ip}:${kubeletPort})...`)

      const healthCheckUrl = `http://${server.ip}:${kubeletPort}/api/health`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000) // 5秒超时

      try {
        const response = await fetch(healthCheckUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          }
        })

        clearTimeout(timeout)

        if (response.ok) {
          const data = await response.json()
          kubeletStatus = 'installed'
          kubeletVersion = data.version || 'unknown'

          console.log('✅ kubelet-wuhrai HTTP API 响应正常:', data)

          recommendations.push({
            type: 'success',
            message: `服务运行正常 (端口 ${kubeletPort})`
          })

          if (kubeletVersion && kubeletVersion !== 'unknown') {
            recommendations.push({
              type: 'info',
              message: `版本: ${kubeletVersion}`
            })
          }

        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

      } catch (fetchError) {
        clearTimeout(timeout)

        // HTTP API 检测失败，说明服务未启动或未安装
        console.log('❌ kubelet-wuhrai HTTP API 无响应:', fetchError)
        kubeletStatus = 'not_installed'

        recommendations.push({
          type: 'error',
          message: `无法连接 kubelet-wuhrai 服务 (端口 ${kubeletPort})`
        })

        recommendations.push({
          type: 'info',
          message: '安装命令：'
        })

        recommendations.push({
          type: 'info',
          message: `curl -fsSL https://www.wuhrai.com/download/v1.0.0/install-kubelet-wuhrai.sh | bash -s -- --port=${kubeletPort}`
        })
      }

    } catch (error) {
      console.error('检测 kubelet-wuhrai 失败:', error)
      recommendations.push({
        type: 'error',
        message: `检测失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }

    // 添加通用建议
    if (kubeletStatus === 'installed') {
      recommendations.push({
        type: 'success',
        message: '可以使用 AI 功能'
      })
    } else {
      recommendations.push({
        type: 'warning',
        message: '需要安装 kubelet-wuhrai 才能使用 AI 功能'
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
