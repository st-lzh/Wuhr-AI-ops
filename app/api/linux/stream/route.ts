import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { ChatTargetError, resolveChatExecutionContext } from '../../../../lib/ai/batchExecution'
import {
  CICDContextError,
  formatCICDContextPrompt,
  recordCICDContextRead,
  resolveCICDContext
} from '../../../../lib/ai/cicdContext'
import { resolveRuntimeModelConfig } from '../../../../lib/ai/runtimeModelConfig'
import { resolveRuntimeToolConfig } from '../../../../lib/ai/runtimeToolConfig'
import { resolvePersistedConversationHistory } from '../../../../lib/ai/conversationHistory'

// 流式数据类型定义
interface StreamData {
  type: 'thinking' | 'command' | 'output' | 'text' | 'done' | 'error' | 'connection' | 'command_approval_request' | 'command_approved' | 'command_rejected'
  content: string
  timestamp?: string
  metadata?: any
}

// POST方法：处理Linux模式流式聊天请求
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

    const cicdContext = await resolveCICDContext(prisma, body.cicdContext || {})
    if (cicdContext) await recordCICDContextRead(prisma, user.id, cicdContext)
    const contextualQuery = `${formatCICDContextPrompt(cicdContext)}${actualQuery}`

    const hostId = config?.hostId || requestConfig?.hostId || cicdContext?.coordinatorHostId
    const executionContext = await resolveChatExecutionContext({
      prisma,
      userId: user.id,
      coordinatorHostId: hostId,
      targetHostIds: body.targetHostIds || config?.targetHostIds
    })
    const hostInfo = executionContext.coordinator

    console.log('📡 开始Linux模式远程kubelet-wuhrai CLI流式传输:', {
      userId: user.id,
      queryLength: contextualQuery.length,
      provider: config?.provider || requestConfig?.provider,
      model: config?.model || requestConfig?.model,
      hostId: hostInfo.id,
      hostName: hostInfo.name,
      hostIp: hostInfo.ip,
      batchMode: executionContext.batchMode,
      batchTargets: executionContext.targetHostIds.length,
      mode: 'Linux系统模式'
    })

    // 远程执行模式 - 通过HTTP API调用kubelet-wuhrai
    console.log('🐧 Linux模式远程执行 - 强制使用bash工具')
    const { executeHTTPStream } = await import('../../../../utils/httpApiClient')

    // 构建HTTP API请求 - 强制设置为Linux模式
    const httpRequest = {
      query: contextualQuery,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      history,
      isK8sMode: false, // 🔥 强制设置为Linux模式
      customTools: runtimeTools.customTools,
      mcpServers: config?.mcpClientEnabled === true ? runtimeTools.mcpServers : [],
      config: {
        provider: runtimeModel.provider,
        model: runtimeModel.model,
        apiKey: runtimeModel.apiKey,
        baseUrl: runtimeModel.baseUrl,
        hostId: hostInfo.id,
        maxIterations: 20,
        streamingOutput: true,
        isK8sMode: false, // 🔥 确保config中也设置为Linux模式
        mcpClientEnabled: runtimeTools.mcpEnabled && config?.mcpClientEnabled === true,
        requireApproval: config?.requireApproval || false, // 🔥 传递命令批准配置
        batchMode: executionContext.batchMode,
        batchHosts: executionContext.batchHosts,
        networkDeviceIds: Array.isArray(body.networkDeviceIds) ? body.networkDeviceIds : [],
        networkBatchLabel: typeof body.networkBatchLabel === 'string' ? body.networkBatchLabel : '',
        networkActor: user.email || user.username || user.id
      }
    }

    console.log('🔧 Linux模式HTTP API请求配置:', {
      ...httpRequest,
      customToolsCount: httpRequest.customTools?.length || 0, // 🔧 记录自定义工具数量
      config: {
        ...httpRequest.config,
        apiKey: httpRequest.config.apiKey ? '[REDACTED]' : '(空)',
        batchHosts: httpRequest.config.batchHosts.map(({ password, keyPath, ...host }) => ({
          ...host,
          password: password ? '[REDACTED]' : undefined,
          keyPath: keyPath ? '[REDACTED]' : undefined
        })),
        hasApiKey: !!httpRequest.config.apiKey,
        provider: httpRequest.config.provider,
        model: httpRequest.config.model,
        baseUrl: httpRequest.config.baseUrl
      }
    })

    // HTTP API配置
    const httpConfig = {
      ip: hostInfo.ip,
      port: 2081 // kubelet-wuhrai HTTP服务器默认端口
    }

    console.log('🐧 [Linux流式API] 模式验证:', {
      endpoint: '/api/linux/stream',
      mode: 'Linux系统模式',
      isK8sMode: false,
      expectedTools: 'bash工具',
      query: actualQuery.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
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
            console.error('❌ Linux模式HTTP流式传输错误:', {
              error,
              timestamp: new Date().toISOString(),
              hostId: hostInfo.id,
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
                  content: `Linux模式远程执行错误: ${error}`,
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
              content: 'Linux模式远程执行完成',
              timestamp: new Date().toISOString(),
              metadata: {
                executionMode: 'linux-mode',
                hostId: hostInfo.id,
                hostName: hostInfo.name,
                hostIp: hostInfo.ip,
                batchMode: executionContext.batchMode,
                targetHostIds: executionContext.targetHostIds,
                targetCount: executionContext.targetHostIds.length,
                port: 2081
              }
            }
            controller.enqueue(`data: ${JSON.stringify(doneData)}\n\n`)
            controller.close()
          }
        }).catch((httpError) => {
          console.error('💥 Linux模式HTTP API执行失败:', httpError)
          const errorData: StreamData = {
            type: 'error',
            content: `Linux模式HTTP API连接失败: ${httpError.message}`,
            timestamp: new Date().toISOString()
          }
          controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
          controller.close()
        })
      },
      cancel() {
        console.log('🛑 客户端取消了Linux模式HTTP API流式传输')
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
    if (error instanceof CICDContextError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    if (error instanceof ChatTargetError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('❌ Linux模式HTTP API kubelet-wuhrai流式传输失败:', error)
    
    // 返回错误流
    const errorStream = new ReadableStream({
      start(controller) {
        const errorData: StreamData = {
          type: 'error',
          content: `Linux模式远程执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
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
