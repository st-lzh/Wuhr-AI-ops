import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'

export const dynamic = 'force-dynamic'

/**
 * 测试模型的function calling能力
 * POST /api/config/test-model-capabilities
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { modelName, provider, apiKey, baseUrl } = body

    if (!modelName || !provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: modelName, provider, apiKey' },
        { status: 400 }
      )
    }

    console.log('🧪 [模型能力测试] 开始测试模型function calling能力:', {
      modelName,
      provider,
      baseUrl: baseUrl || '(使用默认)',
    })

    // 根据provider确定API基础URL和路径
    let apiBaseUrl = baseUrl
    let apiPath = '/v1/chat/completions'

    if (!apiBaseUrl) {
      switch (provider) {
        case 'deepseek':
          apiBaseUrl = 'https://api.deepseek.com'
          break
        case 'openai':
        case 'openai-compatible':
          apiBaseUrl = 'https://api.openai.com'
          break
        case 'qwen':
          apiBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
          break
        case 'doubao':
          apiBaseUrl = 'https://ark.cn-beijing.volces.com/api/v3'
          apiPath = '/chat/completions'
          break
        case 'gemini':
          return NextResponse.json({
            success: true,
            supported: true,
            message: 'Gemini模型通过原生SDK支持function calling',
            skipTest: true
          })
        default:
          apiBaseUrl = baseUrl || 'https://api.openai.com'
      }
    }

    // 智能构建完整URL,避免双斜杠和重复路径
    let fullUrl = ''
    if (apiBaseUrl) {
      // 移除末尾的斜杠
      apiBaseUrl = apiBaseUrl.replace(/\/$/, '')

      // 检查baseUrl是否已经包含完整路径
      if (apiBaseUrl.endsWith('/v1/chat/completions') || apiBaseUrl.endsWith('/chat/completions')) {
        fullUrl = apiBaseUrl
      } else if (apiBaseUrl.endsWith('/v1')) {
        // 已经有/v1,只需添加/chat/completions
        fullUrl = `${apiBaseUrl}/chat/completions`
      } else {
        // 需要添加完整路径
        fullUrl = `${apiBaseUrl}${apiPath}`
      }
    } else {
      fullUrl = apiPath
    }

    console.log('🌐 [模型能力测试] API配置:', {
      fullUrl,
      model: modelName,
      hasApiKey: !!apiKey
    })

    // 构建测试请求
    const testRequest = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: '请帮我检查当前系统的磁盘使用情况'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'check_disk_usage',
            description: '检查系统磁盘使用情况',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要检查的路径，默认为根目录'
                }
              }
            }
          }
        }
      ],
      tool_choice: 'auto',
      max_tokens: 500
    }

    // 发送测试请求
    const startTime = Date.now()
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(testRequest),
      signal: AbortSignal.timeout(15000) // 15秒超时
    })

    const responseTime = Date.now() - startTime
    const data = await response.json()

    console.log('📊 [模型能力测试] API响应:', {
      status: response.status,
      responseTime: `${responseTime}ms`,
      hasChoices: !!data.choices,
      firstChoice: data.choices?.[0]?.message
    })

    if (!response.ok) {
      console.error('❌ [模型能力测试] API请求失败:', data)
      return NextResponse.json({
        success: false,
        supported: false,
        error: data.error?.message || `API请求失败: ${response.status}`,
        details: data
      })
    }

    // 检查是否返回了tool_calls
    const message = data.choices?.[0]?.message
    const hasToolCalls = !!message?.tool_calls && message.tool_calls.length > 0
    const hasContent = !!message?.content

    console.log('🔍 [模型能力测试] 结果分析:', {
      hasToolCalls,
      toolCallsCount: message?.tool_calls?.length || 0,
      hasContent,
      contentLength: message?.content?.length || 0
    })

    if (hasToolCalls) {
      console.log('✅ [模型能力测试] 模型支持function calling')
      return NextResponse.json({
        success: true,
        supported: true,
        message: '✅ 模型支持function calling功能',
        details: {
          responseTime: `${responseTime}ms`,
          toolCalls: message.tool_calls.map((call: any) => ({
            name: call.function?.name,
            hasArguments: !!call.function?.arguments
          })),
          model: data.model || modelName
        }
      })
    } else if (hasContent) {
      console.log('⚠️ [模型能力测试] 模型返回了文本但未调用工具')
      return NextResponse.json({
        success: true,
        supported: false,
        message: '⚠️ 模型未调用工具，可能不支持function calling或配置不正确',
        details: {
          responseTime: `${responseTime}ms`,
          responseType: 'text_only',
          responsePreview: message.content?.substring(0, 200),
          model: data.model || modelName
        }
      })
    } else {
      console.log('❌ [模型能力测试] 无法解析API响应')
      return NextResponse.json({
        success: false,
        supported: false,
        error: 'API响应格式异常',
        details: data
      })
    }

  } catch (error) {
    console.error('💥 [模型能力测试] 测试失败:', error)
    return NextResponse.json({
      success: false,
      supported: false,
      error: error instanceof Error ? error.message : '测试失败',
      details: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 })
  }
}
