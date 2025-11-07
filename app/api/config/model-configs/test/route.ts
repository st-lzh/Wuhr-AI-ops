import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/apiHelpers-new'

// 测试模型API连接
export async function POST(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { provider, modelName, apiKey, baseUrl } = body

    if (!provider || !modelName || !apiKey) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 根据不同提供商测试API连接
    let testResult: { success: boolean; error?: string; responseTime?: number }

    const startTime = Date.now()

    try {
      switch (provider) {
        case 'openai-compatible':
          testResult = await testOpenAICompatible(apiKey, baseUrl, modelName)
          break
        case 'deepseek':
          testResult = await testDeepSeek(apiKey, modelName)
          break
        case 'gemini':
          testResult = await testGemini(apiKey, modelName)
          break
        case 'qwen':
          testResult = await testQwen(apiKey, modelName)
          break
        case 'doubao':
          testResult = await testDoubao(apiKey, modelName)
          break
        default:
          testResult = { success: false, error: '不支持的提供商' }
      }

      testResult.responseTime = Date.now() - startTime

      return NextResponse.json(testResult)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: (error as Error).message,
        responseTime: Date.now() - startTime
      })
    }
  } catch (error) {
    console.error('测试模型API失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 测试OpenAI兼容API
async function testOpenAICompatible(apiKey: string, baseUrl: string | undefined, modelName: string) {
  // 智能处理baseURL
  let url = 'https://api.openai.com/v1/chat/completions'
  if (baseUrl) {
    // 移除末尾的斜杠
    baseUrl = baseUrl.replace(/\/$/, '')
    // 如果已经包含/v1/chat/completions,直接使用
    if (baseUrl.endsWith('/v1/chat/completions')) {
      url = baseUrl
    }
    // 如果已经包含/chat/completions,直接使用
    else if (baseUrl.endsWith('/chat/completions')) {
      url = baseUrl
    }
    // 如果包含/v1但不包含/chat/completions,添加/chat/completions
    else if (baseUrl.endsWith('/v1')) {
      url = `${baseUrl}/chat/completions`
    }
    // 否则添加完整路径/v1/chat/completions
    else {
      url = `${baseUrl}/v1/chat/completions`
    }
  }

  console.log(`🧪 [API测试] 测试URL: ${url}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
      temperature: 0.1
    })
  })

  if (response.ok) {
    return { success: true }
  } else {
    const error = await response.text()
    return { success: false, error: `HTTP ${response.status}: ${error}` }
  }
}

// 测试DeepSeek API
async function testDeepSeek(apiKey: string, modelName: string) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
      temperature: 0.1
    })
  })

  if (response.ok) {
    return { success: true }
  } else {
    const error = await response.text()
    let errorMessage = `HTTP ${response.status}: ${error}`
    
    // 针对DeepSeek常见错误提供更友好的提示
    if (response.status === 400 && error.includes('Model Not Exist')) {
      const supportedModels = ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner']
      errorMessage = `模型名称 "${modelName}" 不存在。DeepSeek支持的模型：${supportedModels.join(', ')}。请检查模型名称是否正确。`
    } else if (response.status === 401) {
      errorMessage = 'API密钥无效或已过期，请检查DeepSeek API密钥是否正确。'
    } else if (response.status === 403) {
      errorMessage = 'API密钥权限不足，请检查DeepSeek API密钥的权限设置。'
    }
    
    return { success: false, error: errorMessage }
  }
}

// 测试Gemini API
async function testGemini(apiKey: string, modelName: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: 'Hello' }]
      }],
      generationConfig: {
        maxOutputTokens: 5,
        temperature: 0.1
      }
    })
  })

  if (response.ok) {
    return { success: true }
  } else {
    const error = await response.text()
    return { success: false, error: `HTTP ${response.status}: ${error}` }
  }
}

// 测试Qwen API
async function testQwen(apiKey: string, modelName: string) {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      input: {
        messages: [{ role: 'user', content: 'Hello' }]
      },
      parameters: {
        max_tokens: 5,
        temperature: 0.1
      }
    })
  })

  if (response.ok) {
    return { success: true }
  } else {
    const error = await response.text()
    return { success: false, error: `HTTP ${response.status}: ${error}` }
  }
}

// 测试Doubao API
async function testDoubao(apiKey: string, modelName: string) {
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
      temperature: 0.1
    })
  })

  if (response.ok) {
    return { success: true }
  } else {
    const error = await response.text()
    return { success: false, error: `HTTP ${response.status}: ${error}` }
  }
}
