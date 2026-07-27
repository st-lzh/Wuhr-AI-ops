import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { resolveRuntimeModelConfig } from '../../../../lib/ai/runtimeModelConfig'
import { resolveRuntimeToolConfig } from '../../../../lib/ai/runtimeToolConfig'
import { resolvePersistedConversationHistory } from '../../../../lib/ai/conversationHistory'

// 流式数据类型定义
interface StreamData {
  type: 'thinking' | 'command' | 'output' | 'text' | 'done' | 'error' | 'connection' | 'command_approval_request' | 'command_approved' | 'command_rejected'
  content: string
  timestamp?: string
  metadata?: any
  approvalId?: string
  command?: string
  description?: string
  tool?: string
  reason?: string
}

// POST方法：处理流式聊天请求
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
    const runtimeModel = await resolveRuntimeModelConfig({
      prisma,
      userId: user.id,
      model: config?.model || requestConfig?.model,
      provider: config?.provider || requestConfig?.provider,
      apiKey: config?.apiKey || requestConfig?.apiKey,
      baseUrl: config?.baseUrl || requestConfig?.baseUrl
    })
    const runtimeTools = await resolveRuntimeToolConfig(prisma, user.id)
    const history = await resolvePersistedConversationHistory({
      userId: user.id,
      sessionId: body.sessionId,
      currentMessageId: body.currentMessageId
    })

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
        isActive: true
      }
    })

    if (!hostInfo) {
      return NextResponse.json(
        { success: false, error: `未找到主机: ${hostId}` },
        { status: 404 }
      )
    }

    console.log('📡 开始远程kubelet-wuhrai CLI流式传输:', {
      userId: user.id,
      queryLength: actualQuery.length,
      provider: config?.provider || requestConfig?.provider,
      model: config?.model || requestConfig?.model,
      hostId: hostId,
      hostName: hostInfo.name,
      hostIp: hostInfo.ip
    })

    // 远程执行模式 - 通过HTTP API调用kubelet-wuhrai
    console.log('🌐 远程执行模式 - 通过HTTP API调用kubelet-wuhrai')
    const { executeHTTPStream } = await import('../../../../utils/httpApiClient')

    // 构建HTTP API请求
    const httpRequest = {
      query: actualQuery,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      history,
      isK8sMode: body.isK8sMode || body.config?.isK8sMode, // 🔥 关键：确保K8s模式参数传递
      customTools: runtimeTools.customTools,
      mcpServers: config?.mcpClientEnabled === true ? runtimeTools.mcpServers : [],
      config: {
        provider: runtimeModel.provider,
        model: runtimeModel.model,
        apiKey: runtimeModel.apiKey,
        baseUrl: runtimeModel.baseUrl,
        hostId: hostId,
        maxIterations: 20,
        streamingOutput: true,
        isK8sMode: body.isK8sMode || body.config?.isK8sMode, // 🔥 关键：config中也要包含
        mcpClientEnabled: runtimeTools.mcpEnabled && config?.mcpClientEnabled === true,
        requireApproval: config?.requireApproval === true
      }
    }

    console.log('🔧 HTTP API请求配置:', {
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

    console.log('🔥 [流式API] 关键参数检查:', {
      isK8sMode: body.isK8sMode,
      configIsK8sMode: body.config?.isK8sMode,
      query: body.query?.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    })

    // 🔥 新增：详细的模式验证日志
    console.log('🎯 [流式API] Linux/K8s模式详细验证:', {
      '请求体中的isK8sMode': body.isK8sMode,
      '请求体中的config.isK8sMode': body.config?.isK8sMode,
      '最终传递给kubelet-wuhrai的isK8sMode': body.isK8sMode,
      '期望工具选择': body.isK8sMode ? 'kubectl工具' : 'bash工具',
      '期望命令类型': body.isK8sMode ? 'Kubernetes命令' : 'Linux系统命令',
      '用户查询': body.query
    })

    // 创建HTTP API流式执行
    const stream = new ReadableStream({
      start(controller) {
        executeHTTPStream(httpConfig, httpRequest, {
          onData: (streamData: StreamData) => {
            // 直接转发流式数据，保持字符级流式输出
            controller.enqueue(`data: ${JSON.stringify(streamData)}\n\n`)
          },
          onError: (error: string) => {
            console.error('❌ HTTP流式传输错误:', {
              error,
              timestamp: new Date().toISOString(),
              hostId,
              hostIp: hostInfo.ip
            })

            try {
              // 更详细的错误分类处理
              if (error.includes('terminated') || error.includes('closed')) {
                console.log('🔌 检测到连接中断，优雅关闭流')
                const doneData: StreamData = {
                  type: 'done',
                  content: '连接中断，传输已完成',
                  timestamp: new Date().toISOString(),
                  metadata: { reason: 'connection_terminated' }
                }
                controller.enqueue(`data: ${JSON.stringify(doneData)}\n\n`)
                controller.close()
              } else if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
                console.log('⏰ 检测到连接超时')
                const errorData: StreamData = {
                  type: 'error',
                  content: '连接超时，请检查网络状况或稍后重试',
                  timestamp: new Date().toISOString(),
                  metadata: { reason: 'timeout', hostIp: hostInfo.ip }
                }
                controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
                controller.close()
              } else if (error.includes('network') || error.includes('fetch failed')) {
                console.log('🌐 检测到网络错误')
                const errorData: StreamData = {
                  type: 'error',
                  content: '网络连接失败，请检查网络设置',
                  timestamp: new Date().toISOString(),
                  metadata: { reason: 'network_error', hostIp: hostInfo.ip }
                }
                controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
                controller.close()
              } else {
                console.log('❌ 其他错误:', error)
                const errorData: StreamData = {
                  type: 'error',
                  content: `远程执行错误: ${error}`,
                  timestamp: new Date().toISOString(),
                  metadata: { reason: 'unknown_error', hostIp: hostInfo.ip }
                }
                controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
                controller.close()
              }
            } catch (controllerError) {
              console.warn('⚠️ 控制器已关闭，无法发送错误信息:', controllerError)
            }
          },
          onComplete: () => {
            const doneData: StreamData = {
              type: 'done',
              content: '远程执行完成',
              timestamp: new Date().toISOString(),
              metadata: {
                executionMode: 'http-api',
                hostId,
                hostName: hostInfo.name,
                hostIp: hostInfo.ip,
                port: 2081
              }
            }
            controller.enqueue(`data: ${JSON.stringify(doneData)}\n\n`)
            controller.close()
          }
        }).catch((httpError) => {
          console.error('💥 HTTP API执行失败:', httpError)
          const errorData: StreamData = {
            type: 'error',
            content: `HTTP API连接失败: ${httpError.message}`,
            timestamp: new Date().toISOString()
          }
          controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
          controller.close()
        })
      },
      cancel() {
        console.log('🛑 客户端取消了HTTP API流式传输')
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })

  } catch (error) {
    console.error('❌ HTTP API kubelet-wuhrai流式传输失败:', error)
    
    // 返回错误流
    const errorStream = new ReadableStream({
      start(controller) {
        const errorData: StreamData = {
          type: 'error',
          content: `远程执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: new Date().toISOString()
        }
        controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
        controller.close()
      }
    })

    return new Response(errorStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
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
