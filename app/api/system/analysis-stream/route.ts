import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { getProviderFromModel, validateModelConfig } from '../../../config/kubelet-wuhrai-providers'

// 流式数据类型定义
interface StreamData {
  type: 'text' | 'output' | 'error' | 'done'
  content: string
  timestamp?: string
  metadata?: any
}

// 专用的流式分析端点 - 用于生成DevOps总结
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
      maxTokens = 2000,
      systemPrompt = '你是专业的DevOps分析师，只分析已有结果，不执行任何新命令。',
      hostId,
      apiKey,
      baseUrl,
      isK8sMode = false,
      provider,
      enableStreaming = true
    } = body

    console.log('📊 [分析流式端点] 收到请求:', {
      messageLength: message?.length || 0,
      model: model,
      hasApiKey: !!apiKey,
      hostId: hostId,
      enableStreaming: enableStreaming,
      isK8sMode: isK8sMode,
      provider: provider
    })

    // 验证必需参数
    if (!message) {
      return NextResponse.json(
        { success: false, error: '分析内容不能为空' },
        { status: 400 }
      )
    }

    if (!hostId || hostId === 'local') {
      return NextResponse.json(
        { success: false, error: '分析服务需要远程主机支持' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    let finalModel: string
    let finalApiKey: string
    let finalBaseUrl: string | undefined
    let finalProvider: string

    // 使用传入的配置或从数据库获取
    if (model && apiKey) {
      finalModel = model
      finalApiKey = apiKey
      finalBaseUrl = baseUrl
      finalProvider = provider || getProviderFromModel(model)
    } else {
      // 从数据库获取用户的模型配置
      const userSelection = await prisma.userModelSelection.findUnique({
        where: { userId: user.id },
        include: { selectedModel: true }
      })

      if (!userSelection?.selectedModel) {
        return NextResponse.json(
          { success: false, error: '未找到模型配置' },
          { status: 400 }
        )
      }

      finalModel = userSelection.selectedModel.modelName
      finalApiKey = userSelection.selectedModel.apiKey
      finalBaseUrl = userSelection.selectedModel.baseUrl || undefined
      finalProvider = provider || getProviderFromModel(finalModel)
    }

    // 验证配置
    const validation = validateModelConfig(finalModel, finalApiKey, finalBaseUrl)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: `配置错误: ${validation.errors.join(', ')}` },
        { status: 400 }
      )
    }

    // 调用远程kubelet-wuhrai进行流式分析
    const remoteApiUrl = new URL('/api/remote/kubelet-wuhrai-analysis', request.url)
    
    console.log('🎯 [流式分析] 调用远程分析服务')
    
    const remoteRequest = {
      hostId,
      message: message,
      model: finalModel,
      apiKey: finalApiKey,
      baseUrl: finalBaseUrl,
      provider: finalProvider,
      temperature,
      maxTokens,
      systemPrompt,
      isK8sMode,
      enableStreaming: true,
      analysisMode: true // 标记这是分析请求
    }

    const remoteResponse = await fetch(remoteApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'Cookie': request.headers.get('Cookie') || '',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(remoteRequest)
    })

    if (!remoteResponse.ok) {
      const errorData = await remoteResponse.json().catch(() => ({}))
      throw new Error(errorData.error || `远程分析服务调用失败: ${remoteResponse.status}`)
    }

    // 检查响应类型
    const contentType = remoteResponse.headers.get('content-type')
    if (contentType?.includes('text/event-stream')) {
      console.log('✅ [流式分析] 收到流式响应，直接转发')
      
      // 直接转发流式响应
      return new Response(remoteResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      })
    } else {
      // 如果远程服务不支持流式，创建模拟流式响应
      console.log('⚠️ [流式分析] 远程服务不支持流式，创建模拟流式响应')
      
      const result = await remoteResponse.json()
      const content = result.response || result.data || result.message || '分析完成，未获取到详细内容'
      
      // 创建模拟流式响应
      const stream = new ReadableStream({
        start(controller) {
          // 模拟字符级流式输出
          const words = content.split('')
          let index = 0
          
          const sendChar = () => {
            if (index < words.length) {
              const streamData: StreamData = {
                type: 'text',
                content: words[index],
                timestamp: new Date().toISOString()
              }
              controller.enqueue(`data: ${JSON.stringify(streamData)}\n\n`)
              index++
              setTimeout(sendChar, 10) // 每10ms发送一个字符
            } else {
              // 发送完成信号
              const doneData: StreamData = {
                type: 'done',
                content: '分析完成',
                timestamp: new Date().toISOString()
              }
              controller.enqueue(`data: ${JSON.stringify(doneData)}\n\n`)
              controller.close()
            }
          }
          
          sendChar()
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

  } catch (error) {
    console.error('❌ [流式分析端点] 处理失败:', error)
    
    // 返回错误流式响应
    const errorStream = new ReadableStream({
      start(controller) {
        const errorData: StreamData = {
          type: 'error',
          content: `分析失败: ${error instanceof Error ? error.message : '未知错误'}`,
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
        'Connection': 'keep-alive'
      }
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