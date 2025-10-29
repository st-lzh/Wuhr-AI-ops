import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { executeSSHCommand } from '../../../../lib/ssh/client'

// 提供商到环境变量的映射
const PROVIDER_ENV_MAP = {
  'openai': { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_API_BASE' },
  'openai-compatible': { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_API_BASE' },
  'deepseek': { apiKey: 'DEEPSEEK_API_KEY', baseUrl: 'DEEPSEEK_API_BASE' },
  'gemini': { apiKey: 'GEMINI_API_KEY', baseUrl: 'GEMINI_API_BASE' },
  'qwen': { apiKey: 'QWEN_API_KEY', baseUrl: 'QWEN_API_BASE' },
  'doubao': { apiKey: 'DOUBAO_API_KEY', baseUrl: 'DOUBAO_API_BASE' }
}

// 提供商到kubelet-wuhrai参数的映射
const PROVIDER_PARAM_MAP = {
  'openai': 'openai',
  'openai-compatible': 'openai',
  'deepseek': 'deepseek',
  'gemini': 'gemini',
  'qwen': 'qwen',
  'doubao': 'doubao'
}

// 构建kubelet-wuhrai命令
function buildKubeletWuhraiCommand(
  provider: string,
  model: string,
  message: string,
  apiKey?: string,
  baseUrl?: string,
  systemPrompt?: string,
  isK8sMode?: boolean
): { command: string; envVars: Record<string, string> } {
  const envMapping = PROVIDER_ENV_MAP[provider as keyof typeof PROVIDER_ENV_MAP]
  const providerParam = PROVIDER_PARAM_MAP[provider as keyof typeof PROVIDER_PARAM_MAP]
  
  if (!envMapping || !providerParam) {
    throw new Error(`不支持的提供商: ${provider}`)
  }

  // 构建环境变量
  const envVars: Record<string, string> = {}
  
  if (apiKey) {
    envVars[envMapping.apiKey] = apiKey
  }
  
  if (baseUrl) {
    envVars[envMapping.baseUrl] = baseUrl
  }

  // 构建kubelet-wuhrai参数
  const args = ['kubelet-wuhrai']
  
  // 添加提供商参数
  args.push('--llm-provider', providerParam)

  // 添加模型参数
  args.push('--model', model)

  // 添加静默和跳过验证参数
  args.push('--quiet', '--skip-verify-ssl', '--skip-permissions')

  // 添加日志级别参数（用于调试）
  args.push('-v=2')
  
  // 构建完整消息
  let fullMessage = message
  if (systemPrompt) {
    fullMessage = `${systemPrompt}\n\n${message}`
  }

  // 构建环境变量字符串
  const envString = Object.entries(envVars)
    .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
    .join(' ')

  // 构建完整命令
  const command = `${envString} ${args.join(' ')} "${fullMessage.replace(/"/g, '\\"')}"`

  return { command, envVars }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🤖 [远程Kubelet API] 开始处理远程kubelet-wuhrai请求')
    console.log('🔧 设置连接池管理...')
    
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 解析请求体
    const body = await request.json()
    const {
      hostId,
      message,
      model,
      provider = 'openai-compatible',
      apiKey,
      baseUrl,
      systemPrompt,
      isK8sMode = false
    } = body

    console.log('📥 [远程Kubelet API] 接收到请求:', {
      userId: user.id,
      hostId,
      model,
      provider,
      messageLength: message?.length || 0,
      hasApiKey: !!apiKey,
      hasBaseUrl: !!baseUrl,
      isK8sMode: isK8sMode
    })

    // 验证必需参数
    if (!hostId || !message) {
      return NextResponse.json({
        success: false,
        error: '缺少必需参数: hostId 和 message'
      }, { status: 400 })
    }

    if (hostId === 'local') {
      return NextResponse.json({
        success: false,
        error: '此API仅用于远程执行'
      }, { status: 400 })
    }

    // API密钥检查（警告但不阻止执行）
    if (!apiKey) {
      console.log('⚠️ [远程Kubelet API] 警告: 未提供API密钥，可能导致AI调用失败')
    }

    // 获取服务器配置
    const prisma = await getPrismaClient()
    console.log('🔍 [远程Kubelet API] 查找主机配置:', hostId)
    
    let server
    let actualHostId = hostId
    
    // 首先尝试作为单个服务器查找
    server = await prisma.server.findFirst({
      where: { 
        id: hostId,
        userId: user.id,
        isActive: true
      }
    })
    
    // 如果没找到，尝试作为主机组ID查找
    if (!server) {
      console.log('🔄 [远程Kubelet API] 作为主机组ID查找')
      
      // 查找主机组
      const serverGroup = await prisma.serverGroup.findFirst({
        where: {
          id: hostId,
          userId: user.id,
          isActive: true
        },
        include: {
          servers: {
            where: { 
              isActive: true
            }
          }
        }
      })
      
      if (serverGroup && serverGroup.servers.length > 0) {
        // 从组内随机选择一个服务器
        const randomIndex = Math.floor(Math.random() * serverGroup.servers.length)
        server = serverGroup.servers[randomIndex]
        actualHostId = server.id
        
        console.log('✅ [远程Kubelet API] 从主机组中选择服务器:', {
          groupName: serverGroup.name,
          selectedServer: server.name,
          totalServers: serverGroup.servers.length
        })
      }
    }

    if (!server) {
      console.log('🔄 [远程Kubelet API] 未找到指定主机，尝试自动选择默认主机')
      
      // 尝试选择用户的默认主机
      server = await prisma.server.findFirst({
        where: { 
          userId: user.id,
          isActive: true,
          isDefault: true // 优先选择默认主机
        }
      })
      
      // 如果没有默认主机，选择第一个可用主机
      if (!server) {
        server = await prisma.server.findFirst({
          where: { 
            userId: user.id,
            isActive: true
          }
        })
      }
      
      if (server) {
        actualHostId = server.id
        console.log('✅ [远程Kubelet API] 自动选择主机:', {
          selectedServer: server.name,
          selectedServerId: server.id,
          reason: '原始hostId不存在，自动选择可用主机',
          originalHostId: hostId
        })
      }
    }

    if (!server) {
      console.log('❌ [远程Kubelet API] 主机查找失败:', {
        hostId: hostId,
        userId: user.id,
        message: '未找到任何可用主机配置'
      })
      
      return NextResponse.json({
        success: false,
        error: `未找到任何可用的主机配置。请确保您已添加并激活至少一个主机。原始请求ID: ${hostId}`
      }, { status: 404 })
    }

    console.log('✅ [远程Kubelet API] 找到主机配置:', {
      name: server.name,
      ip: server.ip,
      port: server.port,
      username: server.username
    })

    // 构建kubelet-wuhrai命令
    const { command, envVars } = buildKubeletWuhraiCommand(
      provider,
      model,
      message,
      apiKey,
      baseUrl,
      systemPrompt,
      isK8sMode
    )

    console.log('🔧 [远程Kubelet API] 构建命令详情:', {
      provider: body.provider,
      model: body.model,
      envVarsCount: Object.keys(envVars).length,
      envVarKeys: Object.keys(envVars),
      messageLength: body.message.length,
      hasRealApiKey: !!(body.apiKey && body.apiKey !== 'sk-test' && body.apiKey.length > 20)
    })

    console.log('🔧 [远程Kubelet API] 完整命令:', command)

    // 验证命令格式是否正确
    const expectedFormat = `OPENAI_API_KEY="..." OPENAI_API_BASE="..." kubelet-wuhrai --llm-provider openai --model ${body.model} --quiet --skip-verify-ssl --skip-permissions -v=2 "${body.message}"`
    console.log('🎯 [远程Kubelet API] 期望格式:', expectedFormat)

    // 验证API密钥格式
    if (body.apiKey) {
      console.log('🔑 [远程Kubelet API] API密钥信息:', {
        keyPrefix: body.apiKey.substring(0, 8) + '...',
        keyLength: body.apiKey.length,
        isValidFormat: body.apiKey.startsWith('sk-') && body.apiKey.length > 20
      })
    }

    // SSH配置
    const sshConfig = {
      host: server.ip,
      port: server.port,
      username: server.username,
      password: server.password || undefined,
      timeout: 120000 // 2分钟超时
    }

    console.log('🔗 [远程Kubelet API] SSH连接配置:', {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      hasPassword: !!sshConfig.password,
      timeout: sshConfig.timeout
    })

    // 执行远程kubelet-wuhrai命令
    console.log('🚀 [远程Kubelet API] 开始执行远程kubelet-wuhrai命令...')

    try {
      const result = await executeSSHCommand(sshConfig, command)
      const executionTime = Date.now() - startTime

      console.log('📊 [远程Kubelet API] 执行结果:', {
        success: result.success,
        exitCode: result.code,
        stdoutLength: result.stdout?.length || 0,
        stderrLength: result.stderr?.length || 0,
        executionTime: `${executionTime}ms`
      })

      // 如果执行失败，记录详细错误信息
      if (!result.success) {
        console.error('❌ [远程Kubelet API] SSH命令执行失败详情:', {
          command: command.substring(0, 100) + '...',
          exitCode: result.code,
          signal: result.signal,
          stdout: result.stdout,
          stderr: result.stderr
        })
      }

      // 构建响应
      const response: any = {
        success: result.success,
        hostId: actualHostId, // 使用实际选中的主机ID
        hostName: server.name,
        hostInfo: `${server.name} (${server.ip}:${server.port})`,
        model,
        provider,
        executionTime,
        executionMode: 'remote',
        timestamp: new Date().toISOString(),
        debugInfo: {
          command: command.substring(0, 500), // 限制命令长度用于调试
          exitCode: result.code || undefined,
          stderr: result.stderr,
          originalHostId: hostId !== actualHostId ? hostId : undefined // 如果是从组选择的，记录原始组ID
        }
      }

      if (result.success && result.stdout) {
        // 成功执行，提取AI响应
        response.response = `🌐 [远程执行@${server.name}] ${result.stdout.trim()}`
        console.log('✅ [远程Kubelet API] 执行成功，响应长度:', result.stdout.length)
      } else {
        // 执行失败
        response.success = false
        response.error = result.stderr || result.stdout || '远程kubelet-wuhrai执行失败'
        console.log('❌ [远程Kubelet API] 执行失败:', response.error)
      }

      return NextResponse.json(response)

    } catch (sshError) {
      console.error('💥 [远程Kubelet API] SSH执行异常:', sshError)
      return NextResponse.json({
        success: false,
        error: `SSH执行失败: ${sshError instanceof Error ? sshError.message : '未知错误'}`,
        hostId,
        hostName: server.name,
        executionMode: 'remote',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

  } catch (error) {
    console.error('💥 [远程Kubelet API] 处理异常:', error)
    return NextResponse.json({
      success: false,
      error: `远程kubelet-wuhrai执行异常: ${error instanceof Error ? error.message : '未知错误'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

