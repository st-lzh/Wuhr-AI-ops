import { NextRequest, NextResponse } from 'next/server'
import { KubeletWuhraiRequest, ProviderType } from '../../../types/api'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import {
  getProviderFromModel,
  validateModelConfig
} from '../../../config/kubelet-wuhrai-providers'
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
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt,
      hostId, // 远程主机ID（必须）
      apiKey, // 前端传递的API密钥
      baseUrl, // 前端传递的Base URL
      isK8sMode = false, // K8s命令模式标识
      sessionId, // 会话ID
      sessionContext, // 会话上下文
      enableStreaming = false, // 🔥 新增：流式传输控制参数
      config // 🔥 新增：前端完整配置对象（包含disableTools等）
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
    let finalModel: string
    let finalApiKey: string
    let finalBaseUrl: string | undefined
    let provider: ProviderType

    // 如果前端传递了完整配置，直接使用
    if (model && apiKey) {
      finalModel = model
      finalApiKey = apiKey
      finalBaseUrl = baseUrl
      provider = getProviderFromModel(model)


    } else {
      // 否则从数据库获取用户的模型配置

      const userSelection = await prisma.userModelSelection.findUnique({
        where: {
          userId: user.id
        },
        include: {
          selectedModel: true
        }
      })

      if (!userSelection || !userSelection.selectedModel) {
        return NextResponse.json(
          {
            success: false,
            error: '未找到模型配置，请先在AI助手页面选择模型或在模型管理页面添加模型配置',
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        )
      }

      const modelConfig = userSelection.selectedModel

      if (!modelConfig.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: '选择的模型已被禁用，请选择其他模型',
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        )
      }

      finalModel = modelConfig.modelName
      finalApiKey = modelConfig.apiKey
      finalBaseUrl = modelConfig.baseUrl || undefined
      provider = getProviderFromModel(finalModel)

      console.log('📨 使用数据库配置:', {
        modelId: modelConfig.id,
        model: finalModel,
        displayName: modelConfig.displayName,
        provider: provider,
        hasApiKey: !!finalApiKey,
        hasBaseUrl: !!finalBaseUrl
      })
    }

    // 验证配置完整性
    console.log('🔍 验证模型配置:', {
      model: finalModel,
      hasApiKey: !!finalApiKey,
      apiKeyLength: finalApiKey?.length || 0,
      baseUrl: finalBaseUrl,
      provider: provider
    })

    const validation = validateModelConfig(finalModel, finalApiKey, finalBaseUrl)
    if (!validation.valid) {
      console.error('❌ 模型配置验证失败:', validation.errors)
      return NextResponse.json(
        {
          success: false,
          error: `配置错误: ${validation.errors.join(', ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    console.log('✅ 模型配置验证通过')

    console.log('📨 System Chat 请求:', {
      messageLength: message.length,
      model: finalModel,
      provider: provider,
      hostId: hostId || 'remote required',
      hasSystemPrompt: !!systemPrompt,
      hasApiKey: !!finalApiKey,
      hasBaseUrl: !!finalBaseUrl,
      isK8sMode: isK8sMode,
      enableStreaming: enableStreaming // 🔥 新增：记录流式传输参数
    })

    // 验证是否选择了远程主机（必须）
    if (!hostId || hostId === 'local') {
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
      hostId: hostId,
      reason: '系统仅支持远程执行',
      nextStep: '调用远程kubelet-wuhrai API'
    })

    // 使用远程执行架构
    console.log('🌐 进入远程执行模式，主机ID:', hostId)

    try {
      // 🔥 修改：直接调用kubelet-wuhrai HTTP API，不再通过SSH
      // 获取主机信息用于HTTP API调用
      console.log('🔍 查询主机信息:', {
        hostId,
        userId: user.id
      })

      let server = await prisma.server.findFirst({
        where: {
          id: hostId,
          userId: user.id,
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
        query: message, // 直接使用原始消息，不添加环境约束（由后端kubelet-wuhrai处理）
        isK8sMode: isK8sMode,
        // 🔥 优先使用前端传递的完整config,如果没有则构建默认config
        config: config || {
          provider: provider,
          model: finalModel,
          apiKey: finalApiKey,
          baseUrl: finalBaseUrl,
          hostId: hostId,
          maxIterations: 20,
          streamingOutput: true,
          isK8sMode: isK8sMode
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
