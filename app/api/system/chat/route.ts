import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import {
  CICDContextError,
  formatCICDContextPrompt,
  recordCICDContextRead,
  resolveCICDContext
} from '../../../../lib/ai/cicdContext'
import { resolveRuntimeToolConfig } from '../../../../lib/ai/runtimeToolConfig'
import { resolvePersistedConversationHistory } from '../../../../lib/ai/conversationHistory'
import { resolveRuntimeModelConfig } from '../../../../lib/ai/runtimeModelConfig'
import { executeHTTPStream, executeHTTPQuery } from '../../../../utils/httpApiClient'

// 注释：系统仅支持远程执行模式，通过kubelet-wuhrai服务处理所有AI请求
// 修复：添加async/await处理流式传输启动错误

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult

    const body = await request.json()
    const {
      message,
      model,
      provider: requestedProvider,
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt,
      hostId, // 远程主机ID（必须）
      apiKey, // 前端传递的API密钥
      baseUrl, // 前端传递的Base URL
      isK8sMode = false, // K8s命令模式标识
      sessionId, // 会话ID
      sessionContext, // 会话上下文
      customTools = [],
      mcpServers = [],
      config: requestConfig = {},
      enableStreaming = false, // 🔥 新增：流式传输控制参数
      cicdContext
    } = body

    // 验证必需参数
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: '消息内容不能为空',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    const runtimeTools = await resolveRuntimeToolConfig(prisma, user.id)
    const history = await resolvePersistedConversationHistory({
      userId: user.id,
      sessionId,
      currentMessageId: body.currentMessageId
    })
    const resolvedCICDContext = await resolveCICDContext(prisma, cicdContext || {})
    if (resolvedCICDContext) await recordCICDContextRead(prisma, user.id, resolvedCICDContext)
    const contextualMessage = `${formatCICDContextPrompt(resolvedCICDContext)}${message}`
    const finalHostId = hostId || resolvedCICDContext?.coordinatorHostId
    let runtimeModel: Awaited<ReturnType<typeof resolveRuntimeModelConfig>>
    try {
      runtimeModel = await resolveRuntimeModelConfig({
        prisma,
        userId: user.id,
        model,
        provider: requestedProvider,
        apiKey,
        baseUrl
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : '模型配置不可用',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }
    const finalModel = runtimeModel.model
    const finalApiKey = runtimeModel.apiKey
    const finalBaseUrl = runtimeModel.baseUrl
    const provider = runtimeModel.provider

    console.log('📨 System Chat 请求:', {
      messageLength: message.length,
      model: finalModel,
      provider: provider,
      hostId: finalHostId || 'remote required',
      hasSystemPrompt: !!systemPrompt,
      hasApiKey: !!finalApiKey,
      hasBaseUrl: !!finalBaseUrl,
      isK8sMode: isK8sMode,
      enableStreaming: enableStreaming // 🔥 新增：记录流式传输参数
    })

    // 验证是否选择了远程主机（必须）
    if (!finalHostId || finalHostId === 'local') {
      return NextResponse.json(
        {
          success: false,
          error: '系统仅支持远程执行模式，请选择远程主机或主机组',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    console.log('🎯 使用远程执行模式:', {
      hostId: finalHostId,
      reason: '系统仅支持远程执行',
      nextStep: '调用远程kubelet-wuhrai API'
    })

    // 使用远程执行架构
    console.log('🌐 进入远程执行模式，主机ID:', finalHostId)

    try {
      // 🔥 修改：直接调用kubelet-wuhrai HTTP API，不再通过SSH
      // 获取主机信息用于HTTP API调用
      console.log('🔍 查询主机信息:', {
        hostId,
        userId: user.id
      })

      let server = await prisma.server.findFirst({
        where: {
          id: finalHostId,
          isActive: true
        }
      })

      // 🔥 如果找不到指定的server，尝试使用用户的默认激活server
      if (!server && hostId) {
        console.log('⚠️ 指定的hostId不存在，尝试使用默认激活server')
        server = await prisma.server.findFirst({
          where: {
            userId: user.id,
            isActive: true
          },
          orderBy: {
            createdAt: 'asc' // 使用最早创建的server
          }
        })

        if (server) {
          console.log('✅ 使用默认server:', {
            serverId: server.id,
            serverName: server.name,
            serverIp: server.ip
          })
        }
      }

      console.log('🔍 查询结果:', {
        found: !!server,
        serverIp: server?.ip,
        serverId: server?.id
      })

      if (!server) {
        console.error('❌ 未找到主机:', {
          hostId,
          userId: user.id,
          reason: '主机不存在或不属于当前用户或未激活'
        })
        return NextResponse.json(
          { success: false, error: `未找到可用主机，请先在系统中添加并激活主机` },
          { status: 404 }
        )
      }

      console.log('📡 使用kubelet-wuhrai HTTP API:', {
        hostIp: server.ip,
        hostPort: 2081,
        isK8sMode: isK8sMode
      })

      // 构建HTTP API请求
      const httpRequest = {
        query: contextualMessage,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        history,
        isK8sMode: isK8sMode,
        customTools: runtimeTools.customTools,
        mcpServers: requestConfig.mcpClientEnabled === true ? runtimeTools.mcpServers : [],
        config: {
          provider: provider,
          model: finalModel,
          apiKey: finalApiKey,
          baseUrl: finalBaseUrl,
          hostId: finalHostId,
          maxIterations: 20,
          streamingOutput: true,
          isK8sMode: isK8sMode,
          disableTools: requestConfig.disableTools === true,
          mcpClientEnabled: runtimeTools.mcpEnabled && requestConfig.mcpClientEnabled === true,
          requireApproval: requestConfig.requireApproval === true,
          networkDeviceIds: Array.isArray(body.networkDeviceIds) ? body.networkDeviceIds : [],
          networkBatchLabel: typeof body.networkBatchLabel === 'string' ? body.networkBatchLabel : '',
          networkActor: user.email || user.username || user.id,
          enableToolUseShim: true
        }
      }

      console.log('📤 发送到kubelet-wuhrai的配置:', {
        provider: httpRequest.config.provider,
        model: httpRequest.config.model,
        hasApiKey: !!httpRequest.config.apiKey,
        baseUrl: httpRequest.config.baseUrl,
        disableTools: httpRequest.config.disableTools,
        isK8sMode: httpRequest.config.isK8sMode
      })

      // HTTP API配置
      const httpConfig = {
        ip: server.ip,
        port: 2081
      }

      // 🔥 流式传输处理
      if (enableStreaming) {
        console.log('🌊 启用HTTP API流式传输')

        // 创建流式响应
        const stream = new ReadableStream({
          async start(controller) {
            try {
              await executeHTTPStream(httpConfig, httpRequest, {
                onData: (streamData) => {
                  controller.enqueue(`data: ${JSON.stringify(streamData)}\n\n`)
                },
                onError: (error) => {
                  console.error('❌ HTTP流式传输错误:', error)
                  try {
                    controller.enqueue(`data: ${JSON.stringify({
                      type: 'error',
                      content: error,
                      timestamp: new Date().toISOString()
                    })}\n\n`)
                    controller.close()
                  } catch (e) {
                    console.error('关闭控制器失败:', e)
                  }
                },
                onComplete: () => {
                  console.log('✅ HTTP流式传输完成')
                  try {
                    controller.close()
                  } catch (e) {
                    console.error('关闭控制器失败:', e)
                  }
                }
              })
            } catch (error) {
              console.error('💥 启动流式传输失败:', error)
              try {
                controller.enqueue(`data: ${JSON.stringify({
                  type: 'error',
                  content: error instanceof Error ? error.message : '流式传输启动失败',
                  timestamp: new Date().toISOString()
                })}\n\n`)
                controller.close()
              } catch (e) {
                console.error('发送错误消息失败:', e)
              }
            }
          }
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      // 非流式模式：使用HTTP API查询
      const result = await executeHTTPQuery(httpConfig, httpRequest)

      return NextResponse.json({
        success: true,
        data: result.data,  // 🔥 直接返回data字段，与前端useRedisChat.ts:750的期望匹配
        message: result.message,
        response: result,  // 保留完整响应供调试
        executionMode: 'remote',
        hasResponse: !!result,
        hasError: false
      })
    } catch (error) {
      console.error('❌ 远程执行失败:', error)
      return NextResponse.json(
        {
          success: false,
          error: `远程执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

  } catch (error) {
    if (error instanceof CICDContextError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('❌ System Chat API错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
