import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// POST方法：处理Linux模式非流式聊天请求
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()
    const { message, query, config, ...requestConfig } = body

    // 支持两种参数格式：新格式用query，旧格式用message
    const actualQuery = query || message
    if (!actualQuery) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 获取主机信息 - 远程执行必须提供hostId
    const hostId = config?.hostId || requestConfig?.hostId
    if (!hostId || hostId === 'local') {
      return NextResponse.json(
        { success: false, error: '必须选择远程主机进行执行' },
        { status: 400 }
      )
    }

    const hostInfo = await prisma.server.findFirst({
      where: {
        id: hostId,
        userId: user.id,
        isActive: true
      }
    })

    if (!hostInfo) {
      return NextResponse.json(
        { success: false, error: `未找到主机: ${hostId}` },
        { status: 404 }
      )
    }

    console.log('📡 开始Linux模式远程kubelet-wuhrai CLI非流式传输:', {
      userId: user.id,
      queryLength: actualQuery.length,
      provider: config?.provider || requestConfig?.provider,
      model: config?.model || requestConfig?.model,
      hostId: hostId,
      hostName: hostInfo.name,
      hostIp: hostInfo.ip,
      mode: 'Linux系统模式'
    })

    // 远程执行模式 - 通过HTTP API调用kubelet-wuhrai
    console.log('🐧 Linux模式远程执行 - 强制使用bash工具')
    const { executeHTTPQuery } = await import('../../../../utils/httpApiClient')

    // 构建HTTP API请求 - 强制设置为Linux模式
    const httpRequest = {
      query: actualQuery,
      isK8sMode: false, // 🔥 强制设置为Linux模式
      config: {
        provider: config?.provider || requestConfig?.provider,
        model: config?.model || requestConfig?.model || 'deepseek-chat',
        apiKey: config?.apiKey || requestConfig?.apiKey,
        baseUrl: config?.baseUrl || requestConfig?.baseUrl,
        hostId: hostId,
        maxIterations: 20,
        streamingOutput: false,
        isK8sMode: false // 🔥 确保config中也设置为Linux模式
      }
    }

    console.log('🔧 Linux模式HTTP API请求配置:', {
      ...httpRequest,
      config: {
        ...httpRequest.config,
        apiKey: httpRequest.config.apiKey ? '[REDACTED]' : undefined
      }
    })

    // HTTP API配置
    const httpConfig = {
      ip: hostInfo.ip,
      port: 2081 // kubelet-wuhrai HTTP服务器默认端口
    }

    console.log('🐧 [Linux非流式API] 模式验证:', {
      endpoint: '/api/linux/query',
      mode: 'Linux系统模式',
      isK8sMode: false,
      expectedTools: 'bash工具',
      query: actualQuery.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    })

    try {
      // 执行HTTP API请求
      const result = await executeHTTPQuery(httpConfig, httpRequest)
      
      console.log('📥 收到Linux模式API响应:', {
        success: result.success,
        executionMode: 'linux-mode',
        hostId: hostId,
        hostName: hostInfo.name,
        responseLength: result.data?.length || 0,
        hasError: !!result.error,
        timestamp: new Date().toISOString()
      })

      if (!result.success) {
        throw new Error(result.error || 'Linux模式API调用失败')
      }

      return NextResponse.json({
        success: true,
        response: result.data || result.message || '命令执行完成',
        usage: result.metadata?.usage || result.metadata?.tokenUsage,
        model: httpRequest.config.model,
        executionTime: result.metadata?.executionTime,
        executionMode: 'linux-mode',
        hostId: hostId,
        hostName: hostInfo.name
      })

    } catch (error) {
      console.error('💥 Linux模式HTTP API执行失败:', error)
      
      return NextResponse.json({
        success: false,
        error: `Linux模式远程执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Linux模式HTTP API kubelet-wuhrai非流式传输失败:', error)
    
    return NextResponse.json({
      success: false,
      error: `Linux模式处理失败: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 })
  }
}

// OPTIONS方法：处理CORS预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}