import { NextRequest, NextResponse } from 'next/server'
import {
  KubeletWuhraiRequest,
  KubeletWuhraiResponse,
  ProviderType,
  TokenUsage,
  ToolCall
} from '../../../types/api'
import { 
  requireAuth, 
  successResponse, 
  errorResponse,
  serverErrorResponse
} from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

// kubelet-wuhrai REST API 客户端类
class KubeletWuhraiAPIClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl: string = 'http://localhost:8888', timeout: number = 120000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  // 检查API连接
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  // 非流式聊天请求
  async chat(request: {
    query: string
    options?: {
      llm_provider?: string
      model?: string
      max_iterations?: number
      namespace?: string
      kubeconfig?: string
    }
    context?: {
      session_id?: string
      user_id?: string
    }
  }) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: request.query,
        options: {
          llm_provider: 'openrouter',
          model: 'anthropic/claude-3.5-sonnet',
          ...request.options
        },
        context: request.context
      }),
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok) {
      throw new Error(`kubelet-wuhrai API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // 执行kubelet-wuhrai请求
  async execute(request: KubeletWuhraiRequest): Promise<KubeletWuhraiResponse> {
    const startTime = Date.now()

    try {
      // 检查API连接
      const isAvailable = await this.checkConnection()
      if (!isAvailable) {
        return {
          success: false,
          error: 'kubelet-wuhrai API 服务不可用，请检查服务是否启动',
          timestamp: new Date().toISOString(),
        }
      }

      // 构建请求
      const chatRequest = {
        query: request.message,
        options: {
          llm_provider: request.provider,
          model: request.model,
          max_iterations: 20,
          namespace: 'default'
        },
        context: {
          session_id: request.sessionId || `session_${Date.now()}`,
          user_id: 'wuhr_user',
          conversation_history: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      // 调用API
      const result = await this.chat(chatRequest)
      const executionTime = Date.now() - startTime

      if (result.status === 'success' && result.data) {
        console.log('✅ kubelet-wuhrai API 调用成功:', {
          executionTime: `${executionTime}ms`,
          responseLength: result.data.length,
          sessionId: chatRequest.context.session_id, // 添加会话ID日志
          conversationHistory: chatRequest.context.conversation_history // 添加对话历史日志
        })

        return {
          success: true,
          response: result.data,
          executionTime,
          timestamp: new Date().toISOString(),
          status: 'completed',
          metadata: {
            model: request.model,
            provider: request.provider,
            execution_time: `${executionTime}ms`,
            tools_used: result.metadata?.commands_executed || [],
            model_used: result.metadata?.model_used || request.model,
            session_id: result.session_id
          }
        }
      } else {
        return {
          success: false,
          error: result.error || '未知错误',
          executionTime,
          timestamp: new Date().toISOString(),
          status: 'error'
        }
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error('❌ kubelet-wuhrai API 调用失败:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime,
        timestamp: new Date().toISOString(),
        status: 'error'
      }
    }
  }
}

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 请求计数器
let requestCounter = 0

export async function POST(request: NextRequest) {
  const currentRequestId = ++requestCounter

  try {
    console.log(`🔄 [请求 #${currentRequestId}] 开始处理 kubelet-wuhrai API 请求`)

    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      console.log(`❌ [请求 #${currentRequestId}] 认证失败`)
      return authResult.response
    }

    const body = await request.json()

    // 验证基本请求参数
    if (!body.message || !body.model) {
      console.log(`❌ [请求 #${currentRequestId}] 参数验证失败`)
      return NextResponse.json(
        { error: '缺少必要参数: message, model' },
        { status: 400 }
      )
    }

    console.log(`📥 [请求 #${currentRequestId}] 收到 kubelet-wuhrai API 请求:`, {
      userId: authResult.user.id,
      model: body.model,
      messageLength: body.message.length,
      hostId: body.hostId
    })

    // 检查是否指定了远程主机
    const hostId = body.hostId
    if (!hostId) {
      return NextResponse.json({
        success: false,
        error: '必须指定远程主机才能执行命令',
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    // 远程执行模式
    console.log(`🌐 [请求 #${currentRequestId}] 远程执行模式，主机ID:`, hostId)

      const prisma = await getPrismaClient()

      try {
        // 获取主机配置信息
        const server = await prisma.server.findUnique({
          where: { id: hostId }
        })

        if (!server) {
          throw new Error(`主机不存在: ${hostId}`)
        }

        console.log(`🔍 [请求 #${currentRequestId}] 找到主机配置:`, {
          name: server.name,
          ip: server.ip,
          port: server.port,
          username: server.username
        })

        // 获取用户的API配置用于远程执行
        const apiKeys = await prisma.apiKey.findMany({
          where: {
            userId: authResult.user.id,
            isActive: true,
          },
        })

        if (apiKeys.length === 0) {
          throw new Error('未找到可用的API配置')
        }

        const defaultApiKey = apiKeys.find(key => key.isDefault) || apiKeys[0]

        // 构建SSH配置
        const sshConfig = {
          host: server.ip,
          port: server.port,
          username: server.username,
          password: server.password || undefined,
          timeout: 60000
        }

        // 构建环境变量
        const { buildEnvironmentVariables, generateKubeletArgs } = await import('../../../config/kubelet-wuhrai-providers')
        const envVars = buildEnvironmentVariables(
          body.model,
          defaultApiKey.apiKey,
          defaultApiKey.provider === 'openai-compatible' ? (defaultApiKey.baseUrl || undefined) : undefined
        )
        const envString = Object.entries(envVars)
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ')

        // 构建HTTP API请求
        const message = body.systemPrompt ? `${body.systemPrompt}\n\n${body.message}` : body.message
        const httpRequest = {
          query: message,
          config: {
            provider: body.provider,
            model: body.model,
            apiKey: defaultApiKey.apiKey,
            baseUrl: defaultApiKey.provider === 'openai-compatible' ? (defaultApiKey.baseUrl || undefined) : undefined,
            maxIterations: 20,
            streamingOutput: false
          }
        }

        console.log(`🔧 [请求 #${currentRequestId}] HTTP API请求配置:`, {
          ...httpRequest,
          config: {
            ...httpRequest.config,
            apiKey: httpRequest.config.apiKey ? '[REDACTED]' : undefined
          }
        })

        // 使用HTTP API执行命令
        const { executeHTTPQuery } = await import('../../../../utils/httpApiClient')
        const httpConfig = {
          ip: server.ip,
          port: 2081
        }
        const result = await executeHTTPQuery(httpConfig, httpRequest)

        if (!result.success) {
          throw new Error(result.error || 'HTTP API执行失败')
        }

        // HTTP API返回的数据通常已经是清理过的，但为了保险起见仍然进行基础清理
        const cleanOutput = (text: string) => {
          return text
            // 基础清理，HTTP API应该返回干净的文本
            .replace(/\r\n/g, '\n') // 统一换行符
            .replace(/\r/g, '\n') // 统一换行符
            .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余空行，保留双换行
            .replace(/^\s+|\s+$/g, '') // 移除首尾空白
        }

        const cleanResponse = cleanOutput(result.data || '命令执行完成，但没有返回内容')

        return NextResponse.json({
          success: true,
          response: cleanResponse,
          model: body.model,
          executionMode: 'http-api',
          hostId: hostId,
          hostName: server.name,
          timestamp: new Date().toISOString(),
        })

      } catch (error) {

        return NextResponse.json({
          success: false,
          error: `HTTP API执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: new Date().toISOString(),
        }, { status: 500 })
      }
    } catch (error) {

      return NextResponse.json({
      success: false,
      error: 'kubelet-wuhrai API处理失败',
      details: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
