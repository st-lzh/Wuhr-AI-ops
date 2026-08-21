import { useState, useCallback, useEffect, useRef } from 'react'
import { message } from 'antd'
import { copyWithFeedback } from '../utils/clipboard'
import { ChatMessage, ChatSession, RedisChatConfig } from '../types/chat'
import type { CICDContextSelection } from '../types/cicd-ai'

interface SendMessageModelConfig {
  model: string
  // 浏览器不持有托管模型密钥；聊天 API 在服务端按模型解析凭据。
  apiKey?: string
  baseUrl?: string
  provider?: string
  hostId?: string
  isK8sMode?: boolean
  mcpToolsEnabled?: boolean
  mcpServers?: any[]
  targetHostIds?: string[]
  targetHosts?: Array<{ id: string; name: string; ip: string }>
  batchLabel?: string
  networkDeviceIds?: string[]
  networkTargets?: Array<{ id: string; name: string; managementIp: string; type: string; vendor: string; platform: string; readOnly: boolean }>
  networkBatchLabel?: string
  cicdContext?: CICDContextSelection
}

// 从文本内容解析执行流程数据
const parseExecutionFlowFromText = (content: string): any[] => {
  const lines = content.split('\n')
  const streamData: any[] = []
  let isInAIReply = false
  let aiReplyContent = ''

  // 辅助函数:保存AI回复
  const saveAIReply = () => {
    if (isInAIReply && aiReplyContent.trim()) {
      streamData.push({
        type: 'text',
        content: aiReplyContent.trim(),
        timestamp: new Date().toISOString()
      })
      isInAIReply = false
      aiReplyContent = ''
    }
  }

  for (const line of lines) {
    if (line.includes('🤔')) {
      // 遇到新的思考标记,先保存之前的AI回复
      saveAIReply()
      streamData.push({
        type: 'thinking',
        content: line.replace('🤔 ', '').trim(),
        timestamp: new Date().toISOString()
      })
    } else if (line.includes('💻 执行:')) {
      // 遇到新的命令标记,先保存之前的AI回复
      saveAIReply()
      const commandMatch = line.match(/💻 执行: (?:\[([^\]]+)\] )?(.+)/)
      const toolName = commandMatch?.[1]
      const command = commandMatch?.[2] || line.replace('💻 执行: ', '').trim()

      streamData.push({
        type: 'command',
        content: command,
        timestamp: new Date().toISOString(),
        metadata: toolName ? { toolName } : undefined
      })
    } else if (line.includes('💬 AI回复:')) {
      // 开始收集AI回复内容
      saveAIReply() // 先保存之前的AI回复(如果有)
      isInAIReply = true
      aiReplyContent = ''
    } else if (line.includes('📤 输出:')) {
      // 遇到输出标记,先保存之前的AI回复
      saveAIReply()
      // 然后添加输出
      streamData.push({
        type: 'output',
        content: line.replace('📤 输出:', '').trim(),
        timestamp: new Date().toISOString()
      })
    } else if (line.includes('✅') || line.includes('❌')) {
      // 遇到状态标记,先保存之前的AI回复
      saveAIReply()
      streamData.push({
        type: 'output',
        content: line.replace(/^(✅|❌)\s*/, '').trim(),
        timestamp: new Date().toISOString()
      })
    } else if (isInAIReply) {
      // 收集AI回复的内容行
      aiReplyContent += (aiReplyContent ? '\n' : '') + line
    }
  }

  // 如果最后还有未保存的AI回复
  saveAIReply()

  return streamData
}

// 生成专业DevOps总结的函数（支持流式传输）
const generateDevOpsSummary = async (originalQuery: string, executionResults: string, isK8sMode?: boolean, hostId?: string, apiKey?: string, provider?: string, model?: string, baseUrl?: string, onStreamData?: (data: string) => void, signal?: AbortSignal): Promise<string> => {
  try {
    console.log('📊 [总结函数] 开始生成专业wuhrai系统总结')
    console.log('📊 [总结函数] 输入参数检查:', {
      originalQueryLength: originalQuery?.length || 0,
      executionResultsLength: executionResults?.length || 0,
      isK8sMode: isK8sMode,
      hasOriginalQuery: !!originalQuery,
      hasExecutionResults: !!executionResults
    })
    
    // 专业wuhrai系统提示词
    const systemPrompt = `你是Wuhr AI，一个专业的wuhrai和Kubernetes运维助手。重要规则：
1. 必须直接执行用户请求的操作，而不是仅仅告诉用户如何操作
2. 每次回复都应该是实际执行结果，包含具体的命令输出和数据
3. 使用中文回复，提供简洁明确的执行结果分析
4. 包括：执行的命令、实际结果、状态分析、优化建议
5. 主动执行相关的检查和监控命令来获取完整信息`

    // 构造总结提示
    const summaryPrompt = `${systemPrompt}

请基于以下执行结果，生成专业的wuhrai系统分析总结：

**用户查询**: ${originalQuery}

**执行过程和结果**:
${executionResults}

**要求**:
1. 提供简洁明确的执行结果分析
2. 如果执行成功，包括：执行概要、关键发现、状态分析、优化建议
3. 如果执行失败，分析失败原因并提供解决方案
4. 使用中文回复，格式清晰专业
5. 不要重复显示命令执行过程，只提供分析和建议
6. 重点关注系统状态、性能指标和运维建议

请直接生成专业的分析总结：`

    console.log('🚀 [总结函数] 使用专门的AI对话端点生成总结')
    console.log('📊 [总结函数] API请求体:', {
      messageLength: summaryPrompt.length,
      model: model,
      provider: provider,
      baseUrl: baseUrl,
      hostId: hostId,
      isK8sMode: isK8sMode,
      hasApiKey: !!apiKey,
      hasStreamCallback: !!onStreamData
    })

    // 🔥 直接调用LLM API生成总结，不通过 /api/system/chat 避免触发命令执行
    // 根据provider自动设置默认baseUrl
    let apiBaseUrl = baseUrl
    if (!apiBaseUrl) {
      switch(provider) {
        case 'doubao':
          apiBaseUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat'
          break
        case 'deepseek':
          apiBaseUrl = 'https://api.deepseek.com'
          break
        case 'qwen':
          apiBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
          break
        case 'openai':
          apiBaseUrl = 'https://api.openai.com'
          break
        default:
          apiBaseUrl = 'https://api.deepseek.com'
      }
    }

    const apiModel = model || 'deepseek-chat'
    const apiProvider = provider || 'deepseek'

    // 移除baseUrl末尾的斜杠,避免双斜杠
    apiBaseUrl = apiBaseUrl.replace(/\/$/, '')

    // 根据provider确定API路径
    let apiPath = '/v1/chat/completions'  // 默认OpenAI格式
    if (apiProvider === 'doubao') {
      apiPath = '/completions'  // 豆包API路径（baseUrl已包含/api/v3/chat）
    } else if (apiProvider === 'qwen') {
      apiPath = '/chat/completions'  // Qwen API路径（baseUrl已包含/compatible-mode/v1）
    } else if (apiProvider === 'openai-compatible' || apiBaseUrl.includes('/v1')) {
      // 🔥 对于openai-compatible或baseUrl已包含/v1的情况，只添加/chat/completions
      apiPath = '/chat/completions'
    }

    console.log('🚀 [总结函数] 直接调用LLM API生成总结:', {
      apiBaseUrl,
      apiModel,
      apiProvider,
      apiPath,
      fullUrl: `${apiBaseUrl}${apiPath}`,
      hasApiKey: !!apiKey,
      providedBaseUrl: baseUrl,
      autoSelectedBaseUrl: !baseUrl
    })

    const response = await fetch(`${apiBaseUrl}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `请基于以下执行结果，生成专业的wuhrai系统分析总结：

**用户查询**: ${originalQuery}

**执行过程和结果**:
${executionResults}

**要求**:
1. 提供简洁明确的执行结果分析
2. 如果执行成功，包括：执行概要、关键发现、状态分析、优化建议
3. 如果执行失败，分析失败原因并提供解决方案
4. 使用中文回复，格式清晰专业
5. 不要重复显示命令执行过程，只提供分析和建议
6. 重点关注系统状态、性能指标和运维建议

请直接生成专业的分析总结：`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: !!onStreamData
      }),
      signal
    })

    if (!response.ok) {
      throw new Error(`总结API请求失败: ${response.status}`)
    }

    // 🔥 处理流式响应（OpenAI格式）
    if (onStreamData) {
      console.log('🌊 [总结] 处理流式响应')

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                break
              }

              try {
                const parsed = JSON.parse(data)

                // 🔥 OpenAI流式格式：choices[0].delta.content
                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content
                  onStreamData(content)
                  fullResponse += content
                }
              } catch (e) {
                console.warn('⚠️ [总结流式] 解析数据失败:', e)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      console.log('✅ AI总结流式传输完成:', {
        responseLength: fullResponse.length,
        hasValidContent: fullResponse.length > 10
      })

      return fullResponse || '执行完成，已获取相关系统信息。'
    } else {
      // 非流式响应处理（OpenAI格式）
      console.log('📄 [总结] 处理非流式响应')

      const result = await response.json()

      console.log('📈 总结API响应:', {
        hasChoices: !!result.choices,
        choicesLength: result.choices?.length || 0,
        hasContent: !!result.choices?.[0]?.message?.content,
        error: result.error
      })

      if (result.error) {
        throw new Error(result.error.message || '总结生成失败')
      }

      // OpenAI格式：choices[0].message.content
      const content = result.choices?.[0]?.message?.content || '执行完成，已获取相关系统信息。'

      console.log('✅ AI总结非流式传输完成:', {
        responseLength: content.length,
        hasValidContent: content.length > 10
      })

      return content
    }

  } catch (error) {
    console.error('❌ [总结函数] 总结生成失败:', error)
    console.log('🔍 [调试] 错误详情:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: typeof error,
      executionResultsLength: executionResults?.length || 0,
      hasExecutionResults: !!executionResults,
      originalQueryLength: originalQuery?.length || 0
    })
    
    // 改进的降级处理：分析错误类型
    const hasHostError = error instanceof Error && (
      error.message.includes('未找到可用的主机配置') ||
      error.message.includes('未找到任何可用的主机配置') ||
      error.message.includes('hostId') ||
      error.message.includes('404') ||
      error.message.includes('主机配置') ||
      error.message.includes('系统仅支持远程执行模式') ||
      error.message.includes('请选择远程主机')
    )
    
    const hasApiKeyError = error instanceof Error && (
      error.message.includes('Authentication Fails') ||
      error.message.includes('api key') ||
      error.message.includes('invalid') ||
      error.message.includes('401 Unauthorized') ||
      error.message.includes('authentication_error')
    )
    
    const hasExecutionError = executionResults.includes('❌ 执行错误') || 
                             executionResults.includes('失败') ||
                             executionResults.includes('Error') ||
                             executionResults.includes('error')
    
    if (hasHostError) {
      // 主机配置错误的专门处理
      return `📋 **主机配置问题分析**

❌ **问题描述**：无法连接到指定的远程主机

🔍 **可能原因**：
- 指定的主机ID不存在或已被删除  
- 主机已被禁用或处于离线状态
- 网络连接问题或SSH配置错误
- 权限不足或认证失败
- 系统中未配置任何可用主机

🔧 **解决建议**：
1. 检查主机配置页面，确认至少有一个活跃主机
2. 验证SSH连接参数（IP、端口、用户名、密码）
3. 测试主机网络连通性和SSH服务状态
4. 设置一个默认主机以便自动选择
5. 联系管理员检查主机配置和权限

💡 **操作提示**：请前往主机管理页面添加或修复主机配置后再次尝试

📊 **系统状态**：主机配置异常，需要排查修复`
    } else if (hasApiKeyError) {
      // API Key错误的专门处理
      return `📋 **API认证问题分析**

❌ **问题描述**：kubelet-wuhrai服务的AI模型API Key认证失败

🔍 **具体错误**：
${error instanceof Error ? error.message : '未知API认证错误'}

🔧 **解决建议**：
1. **立即修复**：联系管理员更新后端服务器上的 API Key
2. **检查配置**：验证 kubelet-wuhrai 服务环境变量（DEEPSEEK_API_KEY 等）
3. **API Key 状态**：确认 LLM provider 的 API Key 是否过期或无效
4. **服务重启**：更新配置后重启 kubelet-wuhrai 服务

💡 **技术提示**：
- 后端地址：参见前端 .env.local 里 IMPROVE_API_BASE_URL
- 检查命令：\`curl $IMPROVE_API_BASE_URL/api/health\`
- 配置文件：systemd unit 或 environment 文件

📊 **系统状态**：API认证失败，需要管理员更新配置`
    } else if (hasExecutionError) {
      // 错误情况的降级总结
      return `📋 **执行失败分析**

❌ **问题描述**：执行用户请求时遇到错误

🔍 **可能原因**：
- 主机连接不可用或配置错误
- 命令执行权限不足
- 网络连接问题
- 服务器资源不可用

🔧 **解决建议**：
1. 检查主机配置是否正确
2. 验证SSH连接和身份认证
3. 确认目标服务器状态正常
4. 重新尝试或联系管理员

📊 **系统状态**：需要排查和修复`
    } else {
      // 正常情况的降级总结 - 智能分析执行结果
      console.log('🔍 [降级处理] 分析执行结果类型:', {
        hasExecutionResults: !!executionResults,
        executionResultsLength: executionResults?.length || 0,
        containsCommandMarkers: executionResults?.includes('💻 执行:') || false,
        containsOutputData: executionResults && !executionResults.match(/^[^💻]*💻 执行:[^💻]*$/g)?.length, // 检查是否只有命令没有输出
        executionResultsPreview: executionResults?.substring(0, 200)
      })
      
      // 检查是否只有命令执行过程而缺少实际输出
      const hasOnlyCommands = executionResults && 
        executionResults.includes('💻 执行:') && 
        !executionResults.includes('Filesystem') && // df -h 的典型输出
        !executionResults.includes('NAME') && // lsblk 的典型输出  
        !executionResults.includes('Disk') && // fdisk -l 的典型输出
        !executionResults.includes('Device') && // iostat 的典型输出
        !executionResults.includes('/') // 路径输出
      
      if (hasOnlyCommands) {
        // 特殊处理：有命令但缺少输出的情况
        return `📋 **命令执行状态**

${executionResults}

---

⚠️ **注意**：检测到命令已执行但缺少详细输出结果

🔍 **可能原因**：
- kubelet-wuhrai 服务配置问题
- 命令执行权限限制  
- 网络连接中断
- 服务端流式数据传输异常

🔧 **建议操作**：
1. 检查 kubelet-wuhrai 服务状态
2. 验证主机连接和执行权限
3. 查看服务端日志排查问题
4. 如需具体结果，请重新尝试查询

执行模式：${isK8sMode ? 'Kubernetes集群' : 'Linux系统'}模式`
      } else if (executionResults && executionResults.trim() && executionResults.length > 50) {
        // 如果有实际执行结果，显示结果而不是通用消息
        return `📋 **执行结果**

${executionResults}

---

💡 **系统提示**：已完成执行，以上为实际结果
🔄 如需进一步分析，请提出具体问题

执行模式：${isK8sMode ? 'Kubernetes集群' : 'Linux系统'}模式`
      } else {
        // 只有在真的没有执行结果时才显示通用消息
        return `📋 **执行完成**

✅ 已成功执行用户请求的操作
🔍 请查看上述执行流程了解详细结果
💡 如需更详细分析，请重新询问具体问题

执行模式：${isK8sMode ? 'Kubernetes集群' : 'Linux系统'}模式

📈 **操作统计**：本次查询已完成处理`
      }
    }
  }
}

export interface UseRedisChatOptions {
  sessionId?: string
  initialConfig?: Partial<RedisChatConfig>
}

export function useRedisChat(options: UseRedisChatOptions = {}) {
  const { sessionId: initialSessionId, initialConfig } = options

  // 聊天状态
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<string>('')
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [config, setConfig] = useState<RedisChatConfig>({
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2000,
    hostId: undefined, // 默认需要选择远程主机
    systemPrompt: '',
    enableStreaming: true, // 默认启用流式传输
    ...initialConfig
  })

  // 🔥 新增: 安全配置状态
  const [securityConfig, setSecurityConfig] = useState<{
    enabled: boolean
    requireApproval: boolean
  }>({
    enabled: true,
    requireApproval: true
  })

  // 添加AbortController用于中断请求
  const abortControllerRef = useRef<AbortController | null>(null)

  // 后端配置是唯一权威来源；localStorage 只在后端暂时不可用时作为缓存。
  useEffect(() => {
    const applySecurityConfig = (value: any) => {
      const normalized = {
        enabled: value?.enabled ?? true,
        requireApproval: value?.requireApproval ?? true
      }
      setSecurityConfig(normalized)
      localStorage.setItem('securityConfig', JSON.stringify(normalized))
    }

    const loadSecurityConfig = async () => {
      try {
        const response = await fetch('/api/config/security', {
          credentials: 'include'  // 包含认证cookie
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            applySecurityConfig(data.data)
            console.log('🔐 从后端API加载安全配置:', data.data)
            return
          }
        }
      } catch (error) {
        console.warn('从后端加载安全配置失败，将尝试本地缓存:', error)
      }

      try {
        const saved = localStorage.getItem('securityConfig')
        if (saved) {
          applySecurityConfig(JSON.parse(saved))
          return
        }
      } catch (error) {
        console.warn('本地安全配置缓存无效:', error)
      }

      applySecurityConfig({ enabled: true, requireApproval: true })
    }

    // 初始加载
    loadSecurityConfig()

    // 🔥 监听storage事件,当配置更新时重新加载（跨标签页）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'securityConfig') {
        console.log('🔐 检测到安全配置更新（跨标签页），重新加载')
        loadSecurityConfig()
      }
    }

    const handleConfigUpdated = (event: Event) => {
      applySecurityConfig((event as CustomEvent).detail)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('security-config-updated', handleConfigUpdated)
    window.addEventListener('securityConfigChanged', handleConfigUpdated)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('security-config-updated', handleConfigUpdated)
      window.removeEventListener('securityConfigChanged', handleConfigUpdated)
    }
  }, [])

  // Redis API 调用函数
  const apiCall = useCallback(async (url: string, options: RequestInit = {}) => {
    const timeoutController = new AbortController()
    const timeoutId = window.setTimeout(() => timeoutController.abort(), 10000)

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: options.signal || timeoutController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '请求失败' }))
        throw new Error(errorData.error || '请求失败')
      }

      return await response.json()
    } catch (error) {
      if (timeoutController.signal.aborted) {
        throw new Error('会话服务请求超时，请检查 Redis 服务')
      }
      throw error
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [])

  // 创建新会话
  const createNewSession = useCallback(async (title?: string) => {
    try {
      const { session } = await apiCall('/api/chat/redis-sessions', {
        method: 'POST',
        body: JSON.stringify({ title })
      })
      
      setCurrentSession(session)
      setMessages([])
      
      // 会话创建成功，无需缓存到localStorage
      
      return session
    } catch (error) {
      console.error('创建会话失败:', error)
      message.error('创建会话失败')
      return null
    }
  }, [apiCall])

  // 开始新会话（用于UI按钮）
  const startNewSession = useCallback(async () => {
    const newSession = await createNewSession('新会话')
    if (newSession) {
      message.success('已创建新会话')
    }
    return newSession
  }, [createNewSession])

  // 加载会话
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const { session, messages: sessionMessages } = await apiCall(`/api/chat/redis-sessions/${sessionId}`)
      
      setCurrentSession(session)
      setMessages(sessionMessages || [])
      return session
    } catch (error) {
      console.error('加载会话失败:', error)
      message.error('加载会话失败')
      return null
    }
  }, [apiCall])

  // 获取会话列表
  const getSessions = useCallback(async () => {
    try {
      const { sessions } = await apiCall('/api/chat/redis-sessions')
      return sessions || []
    } catch (error) {
      console.error('获取会话列表失败:', error)
      message.error('获取会话列表失败')
      return []
    }
  }, [apiCall])

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiCall(`/api/chat/redis-sessions/${sessionId}`, {
        method: 'DELETE'
      })
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
        setMessages([])
      }
      
      message.success('会话已删除')
      return true
    } catch (error) {
      console.error('删除会话失败:', error)
      message.error('删除会话失败')
      return false
    }
  }, [apiCall, currentSession])

  // 清除历史记录
  const clearHistory = useCallback(async () => {
    try {
      await apiCall('/api/chat/redis-sessions', {
        method: 'DELETE'
      })
      
      setCurrentSession(null)
      setMessages([])
      message.success('历史记录已清除')
      return true
    } catch (error) {
      console.error('清除历史记录失败:', error)
      message.error('清除历史记录失败')
      return false
    }
  }, [apiCall])

  // 添加消息到Redis
  const addMessageToRedis = useCallback(async (sessionId: string, message: ChatMessage) => {
    try {
      await apiCall(`/api/chat/redis-sessions/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ message })
      })
    } catch (error) {
      console.error('保存消息到Redis失败:', error)
      // 不显示错误消息，因为这是后台操作
    }
  }, [apiCall])

  // 非流式调用函数
  const executeNonStreamingCall = useCallback(async (requestBody: any, aiMessage: any, session: any, signal?: AbortSignal) => {
    try {
      // 🔥 在开始非流式调用时，立即清除思考状态
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessage.id
          ? { ...msg, metadata: { ...msg.metadata, isThinking: false } }
          : msg
      ))

      // 🔥 统一使用通用端点，但通过查询增强确保模式正确
      console.log('🎯 [非流式API调用]', {
        isK8sMode: requestBody.isK8sMode,
        endpoint: '/api/system/chat',
        expectedTools: requestBody.isK8sMode ? 'kubectl工具' : 'bash工具',
        queryEnhanced: requestBody.message?.includes('[Kubernetes集群模式]') || requestBody.message?.includes('[Linux系统模式]')
      })

      const response = await fetch('/api/system/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal // 添加signal用于中断请求
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const result = await response.json()

      console.log('📥 收到API响应:', {
        success: result.success,
        executionMode: result.executionMode,
        hostId: result.hostId,
        hostName: result.hostName,
        responseLength: result.data?.length || 0,
        hasError: !!result.error,
        timestamp: new Date().toISOString()
      })

      if (!result.success) {
        throw new Error(result.error || 'API调用失败')
      }

      // 更新AI消息内容
      const updatedAiMessage = {
        ...aiMessage,
        content: result.data || result.message || '抱歉，我无法处理您的请求。',
        metadata: {
          ...aiMessage.metadata,
          isThinking: false,
          tokenUsage: result.metadata?.usage || result.metadata?.tokenUsage,
          model: result.model || requestBody.model,
          executionTime: result.executionTime,
          executionMode: result.executionMode,
          hostId: result.hostId,
          hostName: result.hostName
        }
      }

      setMessages(prev => prev.map(msg =>
        msg.id === aiMessage.id ? updatedAiMessage : msg
      ))

      // 保存AI消息到Redis
      await addMessageToRedis(session.id, updatedAiMessage)

    } catch (error) {
      console.error('AI API调用失败:', error)

      // 检查是否是gemini命令未找到的错误
      let errorContent = `抱歉，处理您的请求时出现错误：${error instanceof Error ? error.message : '未知错误'}`

      if (error instanceof Error && error.message.includes('未安装 Gemini CLI')) {
        errorContent = `${error.message}\n\n💡 解决方案：\n1. 登录到远程主机\n2. 执行安装命令：npm install -g @gemini-ai/cli\n3. 重新尝试聊天`
      }

      // 更新为错误消息
      const errorMessage: ChatMessage = {
        ...aiMessage,
        content: errorContent,
        status: 'error' as const,
        metadata: {
          ...aiMessage.metadata,
          isThinking: false
        }
      }

      setMessages(prev => prev.map(msg =>
        msg.id === aiMessage.id ? errorMessage : msg
      ))

      // 保存错误消息到Redis
      await addMessageToRedis(session.id, errorMessage)
    }
  }, [addMessageToRedis])

  // 发送消息（支持流式传输）
  const sendMessage = useCallback(async (content: string, modelConfig?: SendMessageModelConfig) => {
    console.log('🚀 [sendMessage] 函数被调用，准备检查自定义工具配置...')

    if (!content.trim() || isLoading) return

    setIsLoading(true)

    // 创建新的AbortController
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      // 确保有当前会话
      let session = currentSession
      if (!session) {
        // 使用用户消息的前20个字符作为会话标题
        const sessionTitle = content.length > 20 ? content.substring(0, 20) + '...' : content
        session = await createNewSession(sessionTitle)
        if (!session) {
          throw new Error('无法创建会话')
        }
      }

      // 创建用户消息
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'user',
        content: content.trim(),
        timestamp: new Date(),
        metadata: {
          targetHosts: modelConfig?.targetHosts,
          batchMode: (modelConfig?.targetHostIds?.length || 0) > 1,
          targetCount: modelConfig?.targetHostIds?.length || undefined,
          batchLabel: modelConfig?.batchLabel,
          networkTargets: modelConfig?.networkTargets,
          cicdContext: modelConfig?.cicdContext
        }
      }

      // 添加用户消息到本地状态
      setMessages(prev => [...prev, userMessage])

      // 保存用户消息到Redis
      await addMessageToRedis(session.id, userMessage)

      // 创建AI消息（显示加载动画，等待流式数据）
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'ai',
        content: '', // 初始为空，将通过加载动画组件显示
        timestamp: new Date(),
        metadata: {
          isThinking: true, // 标记为思考状态
          targetHosts: modelConfig?.targetHosts,
          batchMode: (modelConfig?.targetHostIds?.length || 0) > 1,
          targetCount: modelConfig?.targetHostIds?.length || undefined,
          batchLabel: modelConfig?.batchLabel,
          networkTargets: modelConfig?.networkTargets,
          cicdContext: modelConfig?.cicdContext
        }
      }

      // 添加AI消息到本地状态
      setMessages(prev => [...prev, aiMessage])

      // 准备请求体 - 优化流式传输参数
      // 🔥 修复：明确isK8sMode值，确保即使是false也能正确传递
      const isK8sModeValue = modelConfig?.isK8sMode !== undefined ? modelConfig.isK8sMode : false
      
      // 🔥 强制模式切换：根据模式修改查询内容，确保AI使用正确工具
      const enhanceQueryWithModeInstruction = (originalQuery: string, isK8sMode: boolean, customToolsConfig: any, targetHostCount: number) => {
        let instruction = ''

        if (targetHostCount > 1) {
          instruction += `[批量执行模式] 用户已明确选择 ${targetHostCount} 台目标主机。只生成一份通用命令，只调用一次 host_fanout，selector 必须传空字符串以覆盖全部所选主机；不得逐台调用工具或逐台请求模型。命令只审核一次，由程序并发执行。收到所有主机的真实执行结果后，必须统一总结结果、异常、风险和后续建议。\n\n`
        }

        // 🔧 如果有启用的自定义工具，仅列出可用工具，不强制要求优先使用
        if (customToolsConfig?.enabled && customToolsConfig.tools?.length > 0) {
          const activeTools = customToolsConfig.tools.filter((t: any) => t.isActive)
          if (activeTools.length > 0) {
            const toolsList = activeTools.map((t: any) =>
              `- "${t.name}": ${t.description} (命令: ${t.command})`
            ).join('\n')

            instruction += `[系统提示] 以下自定义工具可用（仅在用户明确要求使用时才调用）:\n${toolsList}\n\n`
          }
        }

        if (isK8sMode) {
          instruction += `[Kubernetes集群模式] 请只使用kubectl命令来处理以下请求，不要使用bash/shell命令。**重要**：每次只执行一个命令，等待结果后再执行下一个命令：\n\n${originalQuery}`
        } else {
          instruction += `[Linux系统模式] 请只使用bash/shell/系统命令来处理以下请求，绝对不要使用kubectl命令，因为这是一个普通的Linux服务器，不是Kubernetes集群。**重要**：每次只执行一个命令，等待结果后再执行下一个命令：\n\n${originalQuery}`
        }

        return instruction
      }
      
      console.log('🔐 [发送请求前] securityConfig详细状态:', {
        enabled: securityConfig.enabled,
        requireApproval: securityConfig.requireApproval,
        finalRequireApproval: securityConfig.enabled && securityConfig.requireApproval,
        localStorage: localStorage.getItem('securityConfig')
      })

      // 🔧 从API获取自定义工具配置(用于增强查询提示)
      let customToolsConfigForPrompt: any = null
      try {
        const response = await fetch('/api/config/custom-tools')
        const data = await response.json()
        if (data.success) {
          customToolsConfigForPrompt = data.data
        }
      } catch (error) {
        console.warn('🔧 [自定义工具] 读取配置失败:', error)
      }

      // 自定义工具只能由用户明确点选或点名。配置页的工具按钮会写入
      // “使用{工具名}工具”，因此无需把全部工具暴露给每次普通运维对话。
      // 这既避免模型误选无关脚本，也缩小了可执行能力边界。
      const explicitlyRequestedTools = Array.isArray(customToolsConfigForPrompt?.tools)
        ? customToolsConfigForPrompt.tools.filter((tool: any) => {
            if (!tool?.isActive) return false
            const name = String(tool.name || '').trim()
            const id = String(tool.id || '').trim()
            return Boolean((name && content.includes(name)) || (id && content.includes(id)))
          })
        : []
      const requestedCustomToolsConfig = {
        ...(customToolsConfigForPrompt || {}),
        enabled: customToolsConfigForPrompt?.enabled === true && explicitlyRequestedTools.length > 0,
        tools: explicitlyRequestedTools
      }

      // 🔧 使用自定义工具配置增强查询
      let enhancedQuery = enhanceQueryWithModeInstruction(
        content,
        isK8sModeValue,
        requestedCustomToolsConfig,
        modelConfig?.targetHostIds?.length || 0
      )

      if ((modelConfig?.networkDeviceIds?.length || 0) > 0) {
        const targetLines = (modelConfig?.networkTargets || []).map(target =>
          `- ${target.name} (${target.managementIp}) ${target.vendor}/${target.platform} ${target.readOnly ? '[只读保护]' : '[允许创建变更计划]'}`
        ).join('\n')
        enhancedQuery = `[网络设备模式]\n用户已通过 @ 明确选择 ${modelConfig?.networkDeviceIds?.length} 台网络设备：\n${targetLines}\n只允许调用 network_device_operation 工具。先 action=list 核对目标；查询或诊断使用 action=inspect；涉及配置时使用 action=plan 创建持久化计划并等待人工审批，不得使用协调主机 bash 模拟设备命令。收到真实结果后统一总结异常、风险和建议。\n\n${enhancedQuery}`
      }

      const requestBody: any = {
        query: enhancedQuery, // 🔥 使用增强的查询内容
        message: enhancedQuery, // 🔥 使用增强的查询内容
        model: modelConfig?.model || config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        hostId: modelConfig?.hostId || config.hostId, // 必须指定远程主机
        targetHostIds: modelConfig?.targetHostIds || [],
        networkDeviceIds: modelConfig?.networkDeviceIds || [],
        networkBatchLabel: modelConfig?.networkBatchLabel,
        cicdContext: modelConfig?.cicdContext,
        isK8sMode: isK8sModeValue, // 🔥 修复：明确传递isK8sMode值
        mcpServers: modelConfig?.mcpToolsEnabled ? (modelConfig.mcpServers || []) : [],
        // 流式传输配置
        config: {
          hostId: modelConfig?.hostId || config.hostId,
          provider: modelConfig?.provider || 'openai-compatible',
          model: modelConfig?.model || config.model,
          apiKey: modelConfig?.apiKey,
          baseUrl: modelConfig?.baseUrl,
          isK8sMode: isK8sModeValue, // 🔥 修复：明确传递isK8sMode值
          maxIterations: 20,
          streamingOutput: true,
          mcpClientEnabled: modelConfig?.mcpToolsEnabled === true,
          requireApproval: securityConfig.enabled && securityConfig.requireApproval,
          // 🔥 vLLM需要ReAct模式(enableToolUseShim: true)，因为没有--enable-auto-tool-choice
          enableToolUseShim: true
        },
        // 优化：添加会话上下文信息，用于kubelet-wuhrai后端会话管理
        sessionId: session.id, // 传递会话ID给kubelet-wuhrai
        currentMessageId: userMessage.id,
        sessionContext: {
          session_id: session.id, // kubelet-wuhrai标准格式
          user_id: 'wuhr_user', // 用户标识
          conversation_history: messages.length, // 对话历史数量
          created_at: session.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        // 添加模型配置参数（保持向后兼容）
        ...(modelConfig && {
          apiKey: modelConfig.apiKey,
          baseUrl: modelConfig.baseUrl,
          provider: modelConfig.provider || 'openai-compatible', // 添加provider字段
        })
      }

      // 斜杠发布命令走结构化 CI/CD API，不交给模型自由生成 shell 命令。
      if (content.trim().startsWith('/发布执行')) {
        const actionResponse = await fetch('/api/ai/cicd/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'deploy',
            cicdContext: modelConfig?.cicdContext || {}
          }),
          signal
        })
        const actionResult = await actionResponse.json().catch(() => ({
          success: false,
          error: `交付操作请求失败：HTTP ${actionResponse.status}`
        }))

        const actionData = actionResult.data || {}
        const actionContent = actionResult.state === 'awaiting_approval'
          ? `## 发布申请已提交\n\n- 任务：${actionData.deploymentName || modelConfig?.cicdContext?.deploymentName || '-'}\n- 环境：${actionData.environment || '-'}\n- 状态：等待审批\n- 待审批：${actionData.pendingApprovals || 0} 人\n\n[前往审批中心](${actionData.approvalUrl || '/approval-management?type=deployment&status=pending'})\n\n审批通过后系统才会执行发布。`
          : actionResponse.ok
            ? `## 发布操作已受理\n\n- 状态：${actionData.status || actionResult.state || '已受理'}\n- 结果：${actionResult.message || '部署已经开始'}\n\n执行进度和真实日志已写入发布任务，可使用 \`/状态检查\` 继续查询。`
            : `## 发布操作被阻止\n\n${actionResult.error || actionResult.message || '当前发布任务不能执行'}\n\n系统没有执行任何发布命令。`

        const actionMessage: ChatMessage = {
          ...aiMessage,
          content: actionContent,
          status: actionResponse.ok ? 'success' : 'error',
          metadata: {
            ...aiMessage.metadata,
            isThinking: false,
            cicdContext: modelConfig?.cicdContext,
            model: requestBody.model
          }
        }
        setMessages(prev => prev.map(item => item.id === aiMessage.id ? actionMessage : item))
        await addMessageToRedis(session.id, actionMessage)

        // 普通 SSH 部署在后台完成后，将全部真实日志再交给模型做一次最终总结。
        // Jenkins 入队状态不等于完成，因此这里只展示“已入队”，不伪造最终结论。
        if (actionResponse.ok && actionResult.state === 'started' && actionData.deploymentId) {
          let finalDeployment: any = null
          for (let attempt = 0; attempt < 150 && !signal.aborted; attempt++) {
            await new Promise(resolve => window.setTimeout(resolve, 4000))
            if (signal.aborted) break
            const statusResponse = await fetch(`/api/cicd/deployments/${actionData.deploymentId}/status`, {
              credentials: 'include',
              signal
            })
            if (!statusResponse.ok) continue
            const statusResult = await statusResponse.json()
            const statusData = statusResult.data
            if (statusData && ['success', 'failed', 'cancelled', 'rolled_back'].includes(statusData.status)) {
              finalDeployment = statusData
              break
            }
          }

          if (finalDeployment && !signal.aborted) {
            const finalSummary = await generateDevOpsSummary(
              content,
              JSON.stringify({
                deploymentId: finalDeployment.id,
                name: finalDeployment.name,
                status: finalDeployment.status,
                duration: finalDeployment.duration,
                logs: finalDeployment.logs,
                logStats: finalDeployment.logStats
              }, null, 2),
              isK8sModeValue,
              requestBody.hostId,
              requestBody.apiKey,
              requestBody.provider,
              requestBody.model,
              requestBody.baseUrl,
              undefined,
              signal
            )
            const resultMessage: ChatMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              type: 'ai',
              content: finalSummary,
              timestamp: new Date(),
              status: finalDeployment.status === 'success' ? 'success' : 'error',
              metadata: {
                isThinking: false,
                cicdContext: modelConfig?.cicdContext,
                model: requestBody.model
              }
            }
            setMessages(prev => [...prev, resultMessage])
            await addMessageToRedis(session.id, resultMessage)
          }
        }
        setIsLoading(false)
        return
      }

      // 🔧 自定义工具集成 - 如果前面已经获取过配置，直接使用
      try {
        // 使用之前已经获取的配置
        const customToolsConfig = requestedCustomToolsConfig
        console.log('🔧 [自定义工具] 使用已获取的配置:', customToolsConfig)

        if (customToolsConfig?.enabled && Array.isArray(customToolsConfig.tools)) {
          // 🔧 规范化工具名称: 将中文和特殊字符转换为API兼容格式
          const normalizeToolName = (name: string): string => {
            // 使用id或者将name转换为snake_case
            return name
              .replace(/[\u4e00-\u9fa5]/g, '') // 移除中文
              .replace(/[^a-zA-Z0-9]+/g, '_') // 替换非字母数字为下划线
              .replace(/^_+|_+$/g, '') // 移除首尾下划线
              .toLowerCase() || 'custom_tool'
          }

          const activeTools = customToolsConfig.tools
            .filter((tool: any) => tool.isActive)
            .map((tool: any) => {
              // 🔧 优先使用id(已经是合法格式),否则规范化name
              const toolName = tool.id || normalizeToolName(tool.name)

              console.log('🔧 [工具映射] 原始工具:', {
                id: tool.id,
                name: tool.name,
                计算后的toolName: toolName
              })

              return {
                id: tool.id,
                name: tool.id, // 🔧 工具名称使用ID（英文格式，供后端LLM识别）
                displayName: tool.name, // 🔧 保留中文显示名称（仅供前端显示）
                description: tool.description,
                command: tool.command,
                args: tool.args || [],
                env: tool.env || {},
                workingDirectory: tool.workingDirectory || '',
                category: tool.category,
                timeout: tool.timeout
              }
            })

          console.log('🔧 [自定义工具] 筛选后的活跃工具:', activeTools)

          if (activeTools.length > 0) {
            requestBody.customTools = activeTools
            console.log('🔧 [自定义工具] 已添加到请求:', {
              toolCount: activeTools.length,
              tools: activeTools.map((t: any) => t.name)
            })
          }
        } else {
          console.log('🔧 [自定义工具] 未启用或tools不是数组:', {
            enabled: customToolsConfig?.enabled,
            isArray: Array.isArray(customToolsConfig?.tools)
          })
        }
      } catch (error) {
        console.warn('🔧 [自定义工具] 加载配置失败:', error)
      }

      console.log('🔐 [安全配置] 命令批准状态检查:', {
        'securityConfig.enabled': securityConfig.enabled,
        'securityConfig.requireApproval': securityConfig.requireApproval,
        '计算结果': securityConfig.enabled && securityConfig.requireApproval,
        '最终requireApproval': requestBody.config?.requireApproval
      })

      console.log('📤 发送请求体详细信息:', {
        message: `${requestBody.message.substring(0, 100)}...`,
        model: requestBody.model,
        provider: requestBody.provider,
        hostId: requestBody.hostId,
        sessionId: requestBody.sessionId,
        hasSessionContext: !!requestBody.sessionContext,
        conversationHistory: requestBody.sessionContext?.conversation_history,
        hasApiKey: !!requestBody.apiKey,
        enableStreaming: config.enableStreaming,
        isK8sMode: requestBody.isK8sMode, // 🔥 关键：记录K8s模式状态
        configIsK8sMode: requestBody.config?.isK8sMode, // 🔥 关键：记录config中的K8s模式
        requireApproval: requestBody.config?.requireApproval, // 🔥 新增：命令批准状态
        customTools: requestBody.customTools, // 🔧 自定义工具
        customToolsCount: requestBody.customTools?.length || 0, // 🔧 自定义工具数量
        modelConfigIsK8sMode: modelConfig?.isK8sMode, // 🔥 新增：记录原始modelConfig中的值
        calculatedIsK8sMode: isK8sModeValue, // 🔥 新增：记录计算后的值
        isK8sModeType: typeof isK8sModeValue, // 🔥 新增：记录数据类型
        timestamp: new Date().toISOString()
      })

      // 🔥 新增：输出完整的config对象用于调试
      console.log('🔧 完整Config对象:', requestBody.config)

      // 🔥 新增：专门的模式检查日志
      console.log('🎯 [模式检查] Linux/K8s模式参数传递验证:', {
        '前端传入的modelConfig.isK8sMode': modelConfig?.isK8sMode,
        '最终requestBody.isK8sMode': requestBody.isK8sMode,
        '最终requestBody.config.isK8sMode': requestBody.config?.isK8sMode,
        '期望模式': requestBody.isK8sMode ? 'K8s集群模式' : 'Linux系统模式',
        '参数来源': modelConfig?.isK8sMode !== undefined ? 'modelConfig' : '默认值false'
      })

      // 检查是否启用流式传输
      if (config.enableStreaming) {
        console.log('🌊 启用流式传输模式')
        
        // 设置流式状态
        setIsStreaming(true)
        setStreamingMessage('')
        setStreamingMessageId(aiMessage.id)
        
        // 🔥 根据模式选择对应的API端点
        const getStreamApiEndpoint = (isK8sMode: boolean) => {
          if (isK8sMode) {
            return '/api/k8s/stream'  // K8s模式使用专用端点
          } else {
            return '/api/linux/stream'  // Linux模式使用专用端点
          }
        }

        const streamEndpoint = getStreamApiEndpoint(requestBody.isK8sMode)
        console.log('🎯 [API端点选择]', {
          isK8sMode: requestBody.isK8sMode,
          selectedEndpoint: streamEndpoint,
          expectedTools: requestBody.isK8sMode ? 'kubectl工具' : 'bash工具'
        })

        // 调用对应模式的流式API
        try {
          const response = await fetch(streamEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal // 添加signal用于中断请求
          })

          if (!response.ok) {
            throw new Error(`流式API请求失败: ${response.status}`)
          }

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('无法获取响应流')
          }

          const decoder = new TextDecoder()
          let buffer = ''
          let fullResponse = ''
          // 后端 Agent 的 text 事件是同一文本块的累计快照。始终保留最后一个
          // 快照，流结束后直接作为真实答复使用，避免二次总结根据不完整事件臆测结果。
          let latestAgentText = ''
          let approvalRejected = false

          try {
            while (true) {
              const { done, value } = await reader.read()
              
              // 检查是否被中断
              if (signal.aborted) {
                console.log('🛑 [流式传输] 检测到用户中断请求')
                break
              }
              
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    break
                  }

                  try {
                    const parsed = JSON.parse(data)

                    // 🔥 第一次接收到流式数据时，清除思考状态
                    // 处理不同类型的流式数据
                    switch (parsed.type) {
                      case 'thinking':
                        // 🔥 thinking类型：保持思考状态，但开始流式传输
                        if (!isStreaming) {
                          setIsStreaming(true)
                          // ⚠️ 不清除isThinking，继续显示"AI正在思考..."
                        }

                        const thinkingText = `🤔 ${parsed.content}`
                        setStreamingMessage(prev => prev + thinkingText)
                        fullResponse += thinkingText
                        break
                      case 'command':
                        // 🔥 收到command时才清除思考状态，开始显示执行流程
                        if (!isStreaming) {
                          setIsStreaming(true)
                          // 🔥 只在第一次收到内容时清除思考状态
                          setMessages(prev => prev.map(msg =>
                            msg.id === aiMessage.id
                              ? { ...msg, content: '', metadata: { ...msg.metadata, isThinking: false } }
                              : msg
                          ))
                        }

                        console.log('💻 [命令] command:', parsed.content.substring(0, 50), 'hasResult:', !!parsed.metadata?.result)

                        // 🔥 第一次发送（result为null）：只显示命令
                        // 第二次发送（有result）：只显示输出
                        if (!parsed.metadata?.result) {
                          // 第一次：显示命令
                          // 🔧 如果有toolName，将其嵌入到文本中，格式: 💻 执行: [toolName] command
                          const toolNamePrefix = parsed.metadata?.toolName ? `[${parsed.metadata.toolName}] ` : ''
                          const commandText = `\n💻 执行: ${toolNamePrefix}${parsed.content}\n`
                          setStreamingMessage(prev => prev + commandText)
                          fullResponse += commandText
                          console.log('📝 [第一次] 显示命令，toolName:', parsed.metadata?.toolName)
                        } else {
                          // 第二次：显示输出
                          const result = parsed.metadata.result
                          let outputText = ''

                          const extractResultContent = (value: any): string => {
                            if (typeof value === 'string') return value
                            if (Array.isArray(value)) {
                              return value
                                .map(item => {
                                  if (typeof item === 'string') return item
                                  if (typeof item?.text === 'string') return item.text
                                  return JSON.stringify(item)
                                })
                                .filter(Boolean)
                                .join('\n')
                            }
                            if (value == null) return ''
                            return JSON.stringify(value, null, 2)
                          }

                          console.log('📄 [命令输出]', {
                            hasStdout: !!result.stdout,
                            hasStderr: !!result.stderr,
                            hasError: !!result.error,
                            stdoutLength: result.stdout?.length || 0,
                            stderrLength: result.stderr?.length || 0
                          })

                          // 🔥 添加AI回复标记，然后直接显示命令输出（不显示AI分析）
                          if (result.stdout || result.stderr || result.error) {
                            outputText += `\n💬 AI回复:\n`
                          }

                          // 🔥 去掉"📄 输出:"标记，直接显示内容
                          if (result.stdout) {
                            outputText += `${result.stdout}\n`
                          }
                          if (result.stderr) {
                            outputText += `⚠️ 错误:\n${result.stderr}\n`
                          }
                          if (result.error && !result.stderr) {
                            outputText += `❌ 错误: ${result.error}\n`
                          }

                          // MCP 等结构化工具通常返回 content 数组，而不是 stdout。
                          // 将它作为真实工具输出写入执行流和后续持久化记录。
                          if (!outputText && result.content !== undefined) {
                            const contentText = extractResultContent(result.content)
                            if (contentText) outputText = `\n💬 AI回复:\n${contentText}\n`
                          }

                          if (!outputText && result.structuredContent !== undefined) {
                            const structuredText = extractResultContent(result.structuredContent)
                            if (structuredText) outputText = `\n💬 AI回复:\n${structuredText}\n`
                          }

                          // host_fanout 返回 summary + results 的结构化对象。原样保存到执行流，
                          // 让批量每台主机的真实退出码、输出和错误可追溯，而不只显示模型总结。
                          if (!outputText && result && typeof result === 'object') {
                            const resultText = extractResultContent(result)
                            if (resultText && resultText !== '{}') {
                              outputText = `\n💬 AI回复:\n${resultText}\n`
                            }
                          }

                          if (outputText) {
                            console.log('✅ [第二次] 显示输出，长度:', outputText.length)
                            setStreamingMessage(prev => prev + outputText)
                            fullResponse += outputText
                          }
                        }
                        break
                      case 'output':
                      case 'text':
                        // 🔥 不清除思考状态，让"AI正在思考..."持续显示直到出现command
                        if (!isStreaming) {
                          setIsStreaming(true)
                        }

                        // 🔥 跳过所有text类型的AI分析，执行流程中只显示命令和命令输出
                        // text类型是AI生成的分析内容，不应该出现在执行流程中
                        const outputContent = parsed.content
                        if (outputContent && parsed.type === 'output') {
                          // output类型，直接追加
                          setStreamingMessage(prev => prev + outputContent)
                          fullResponse += outputContent
                        }
                        if (outputContent && parsed.type === 'text') {
                          latestAgentText = outputContent
                        }
                        // text 不混入实时执行步骤，但会在流结束后作为后端真实答复展示和持久化。
                        console.log('📝 [后端答复] 已更新最终文本快照')
                        break
                      case 'command_approval_request':
                        // 🔥 命令批准请求 - 将批准请求数据添加到消息的metadata中
                        console.log('🔐 [命令批准] 收到批准请求:', parsed)

                        const commandToApprove = parsed.command || parsed.content
                        const toolName = parsed.tool || 'bash'
                        const approvalId = parsed.approvalId

                        // 🔥 将批准请求添加到流式消息的metadata中 - 使用approvalId作为唯一标识
                        const approvalRequestText = `🔐 命令需要批准 ${approvalId}\n`
                        setStreamingMessage(prev => prev + approvalRequestText)
                        fullResponse += approvalRequestText

                        // 🔥 从后端获取hostInfo，确保使用正确的kubelet-wuhrai端口(2081)
                        const hostInfo = {
                          ip: parsed.metadata?.ip || parsed.metadata?.hostInfo?.ip || 'localhost',
                          port: 2081 // 固定使用kubelet-wuhrai端口
                        }

                        // 🔥 更新AI消息，添加pendingApproval到metadata（支持多个待批准命令）
                        setMessages(prev => prev.map(msg =>
                          msg.id === aiMessage.id
                            ? {
                                ...msg,
                                metadata: {
                                  ...msg.metadata,
                                  // 🔥 使用数组存储多个待批准命令
                                  pendingApprovals: [
                                    ...(msg.metadata?.pendingApprovals || []),
                                    {
                                      approvalId,
                                      command: commandToApprove,
                                      tool: toolName,
                                      hostInfo
                                    }
                                  ]
                                }
                              }
                            : msg
                        ))
                        break
                      case 'command_approved':
                        // 🔥 命令已批准 - 从metadata的pendingApprovals数组中移除对应的批准请求
                        console.log('✅ [命令批准] 命令已批准')

                        setMessages(prev => prev.map(msg => {
                          if (msg.metadata?.pendingApprovals && msg.metadata.pendingApprovals.length > 0) {
                            // 🔥 从数组中移除第一个待批准项（假设按顺序批准）
                            const updatedApprovals = msg.metadata.pendingApprovals.slice(1)
                            return {
                              ...msg,
                              metadata: {
                                ...msg.metadata,
                                pendingApprovals: updatedApprovals
                              }
                            }
                          }
                          return msg
                        }))
                        break
                      case 'command_rejected':
                        // 🔥 命令已拒绝 - 从metadata的pendingApprovals数组中移除对应的批准请求并显示拒绝消息
                        console.log('❌ [命令批准] 命令已拒绝')
                        approvalRejected = true

                        const rejectText = `\n命令已拒绝: ${parsed.content || '用户拒绝执行'}\n`
                        setStreamingMessage(prev => prev + rejectText)
                        fullResponse += rejectText

                        setMessages(prev => prev.map(msg => {
                          if (msg.metadata?.pendingApprovals && msg.metadata.pendingApprovals.length > 0) {
                            // 🔥 从数组中移除第一个待批准项（假设按顺序拒绝）
                            const updatedApprovals = msg.metadata.pendingApprovals.slice(1)
                            return {
                              ...msg,
                              metadata: {
                                ...msg.metadata,
                                pendingApprovals: updatedApprovals
                              }
                            }
                          }
                          return msg
                        }))
                        break
                      case 'done':
                        // 🔥 流式传输完成标记 - 不要立即退出，继续接收后续数据
                        console.log('🎯 [流式完成] 收到done标记，继续接收后续数据（如有）')
                        // 不要break，让循环继续处理剩余数据
                        break
                      case 'error':
                        // 🔥 错误情况也生成总结
                        console.log('❌ [流式错误] 收到错误，但仍将生成总结:', parsed.content)
                        
                        // 在fullResponse中记录错误信息
                        const errorInfo = `\n❌ 执行错误: ${parsed.content || '未知错误'}\n`
                        fullResponse += errorInfo
                        setStreamingMessage(prev => prev + errorInfo)
                        
                        // 继续生成总结（不直接抛出异常）
                        console.log('🎯 [错误后处理] 开始生成错误情况下的专业总结')
                        
                        // 生成错误情况下的专业总结
                        const errorSummaryContent = await generateDevOpsSummary(
                          content, // 用户原始查询
                          fullResponse, // 执行过程和错误信息
                          requestBody.isK8sMode,
                          requestBody.hostId, // 传递正确的hostId
                          requestBody.apiKey, // 传递用户配置的apiKey
                          requestBody.provider, // 传递用户配置的provider
                          requestBody.model, // 传递用户配置的model
                          requestBody.baseUrl, // 🔥 传递用户配置的baseUrl
                          undefined, // 错误情况下不需要实时回调
                          signal // 传递signal用于中断
                        )
                        
                        const errorFinalMessage: ChatMessage = {
                          ...aiMessage,
                          content: errorSummaryContent,
                          status: 'error' as const, // 标记为错误状态
                          metadata: {
                            ...aiMessage.metadata,
                            isThinking: false,
                            tokenUsage: parsed.metadata?.tokenUsage,
                            model: requestBody.model,
                            executionTime: parsed.metadata?.executionTime,
                            executionMode: (parsed.metadata?.executionMode as 'remote') || 'remote',
                            hostId: parsed.metadata?.hostId || requestBody.hostId,
                            hostName: parsed.metadata?.hostName
                          }
                        }

                        setMessages(prev => prev.map(msg =>
                          msg.id === aiMessage.id ? errorFinalMessage : msg
                        ))

                        // 保存错误消息到Redis
                        await addMessageToRedis(session.id, errorFinalMessage)
                        
                        setIsStreaming(false)
                        setStreamingMessage('')
                        setStreamingMessageId(null)
                        setIsLoading(false)
                        return // 退出而不抛出异常
                      default:
                        // 兼容旧格式
                        if (parsed.delta) {
                          setStreamingMessage(prev => prev + parsed.delta)
                          fullResponse += parsed.delta
                        } else if (parsed.response) {
                          // 完整响应
                          const completedMessage: ChatMessage = {
                            ...aiMessage,
                            content: parsed.response,
                            status: approvalRejected ? 'rejected' : 'success',
                            metadata: {
                              ...aiMessage.metadata,
                              isThinking: false,
                              approvalRejected,
                              tokenUsage: parsed.usage || parsed.tokenUsage,
                              model: requestBody.model,
                              executionTime: parsed.executionTime,
                              executionMode: (parsed.executionMode as 'remote') || 'remote',
                              hostId: parsed.hostId || requestBody.hostId,
                              hostName: parsed.hostName
                            }
                          }
                          
                          setMessages(prev => prev.map(msg =>
                            msg.id === aiMessage.id ? completedMessage : msg
                          ))
                          
                          await addMessageToRedis(session.id, completedMessage)
                          
                          setIsStreaming(false)
                          setStreamingMessage('')
                          setStreamingMessageId(null)
                          setIsLoading(false)
                          return
                        }
                    }
                  } catch (e) {
                    console.warn('解析流数据失败:', e)
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }

          if (latestAgentText.trim()) {
            fullResponse += `\n💬 AI回复:\n${latestAgentText.trim()}\n`
          }

          // 🔥 流式数据接收完毕，开始生成专业总结
          console.log('🎯 [流式完成] 所有数据接收完毕，开始生成专业DevOps总结（流式）')
          console.log('📊 [调试] 参数检查:', {
            userOriginalQuery: content,
            userOriginalQueryLength: content?.length || 0,
            executionResultsLength: fullResponse.length,
            isK8sMode: requestBody.isK8sMode,
            hasFullResponse: !!fullResponse,
            fullResponsePreview: fullResponse.substring(0, 200) + '...',
            provider: requestBody.provider,
            model: requestBody.model,
            hasApiKey: !!requestBody.apiKey
          })

          // 🔥 实时流式回调函数
          let summaryContent = ''
          const realTimeStreamCallback = (chunk: string) => {
            console.log('📝 [总结回调] 收到总结块:', chunk.substring(0, 50))
            summaryContent += chunk
            // 实时更新AI消息内容
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessage.id
                ? {
                    ...msg,
                    content: summaryContent,
                    metadata: {
                      ...msg.metadata,
                      isStreaming: true // 标记正在流式接收
                    }
                  }
                : msg
            ))
          }

          // 后端已经基于真实工具结果生成最终答复时，直接使用它。只有旧后端没有
          // 返回最终文本时才保留兼容性的总结回退。
          console.log('🚀 [调试] 正在确定最终真实答复...')
          try {
            const finalSummaryContent = latestAgentText.trim() || await generateDevOpsSummary(
                content, // 用户原始查询
                fullResponse, // 执行过程和结果
                requestBody.isK8sMode,
                requestBody.hostId,
                requestBody.apiKey,
                requestBody.provider,
                requestBody.model,
                requestBody.baseUrl,
                realTimeStreamCallback, // 🔥 传递实时流式回调
                signal // 传递signal用于中断
              )

            console.log('🎉 [调试] 流式总结生成完成:', {
              summaryLength: finalSummaryContent?.length || 0,
              summaryPreview: finalSummaryContent?.substring(0, 100) + '...',
              hasSummary: !!finalSummaryContent,
              isEmpty: !finalSummaryContent || finalSummaryContent.trim() === ''
            })

            // 🔥 如果总结为空，使用执行流程作为备用
            const contentToShow = finalSummaryContent && finalSummaryContent.trim() !== ''
              ? finalSummaryContent
              : '执行完成，详细信息请查看执行流程。'

            console.log('📋 [调试] 最终显示内容:', {
              length: contentToShow.length,
              preview: contentToShow.substring(0, 100)
            })

            // 🔥 从fullResponse解析执行流程数据用于保存
            const parsedStreamData = parseExecutionFlowFromText(fullResponse)

            // 设置最终消息
            const finalMessage: ChatMessage = {
              ...aiMessage,
              content: contentToShow,
              status: approvalRejected ? 'rejected' : 'success',
              metadata: {
                ...aiMessage.metadata,
                isThinking: false,
                approvalRejected,
                model: requestBody.model,
                executionMode: 'remote' as const,
                hostId: requestBody.hostId,
                agentStreamData: parsedStreamData.length > 0 ? parsedStreamData : undefined // 🔥 保存执行流程数据到Redis
              }
            }

            setMessages(prev => prev.map(msg =>
              msg.id === aiMessage.id ? finalMessage : msg
            ))

            // 保存最终消息到Redis
            await addMessageToRedis(session.id, finalMessage)
          } catch (summaryError) {
            console.error('❌ [错误] 生成总结失败:', summaryError)

            // 🔥 从fullResponse解析执行流程数据用于保存
            const parsedStreamData = parseExecutionFlowFromText(fullResponse)

            // 即使总结失败，也保存一个基本消息
            const fallbackMessage: ChatMessage = {
              ...aiMessage,
              content: '执行完成，详细信息请查看执行流程。',
              status: approvalRejected ? 'rejected' : 'success',
              metadata: {
                ...aiMessage.metadata,
                isThinking: false,
                approvalRejected,
                model: requestBody.model,
                hostId: requestBody.hostId,
                agentStreamData: parsedStreamData.length > 0 ? parsedStreamData : undefined // 🔥 保存执行流程数据到Redis
              }
            }
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessage.id ? fallbackMessage : msg
            ))
            await addMessageToRedis(session.id, fallbackMessage)
          }

          // 清理状态
          setIsStreaming(false)
          setStreamingMessage('')
          setStreamingMessageId(null)
          setIsLoading(false)

        } catch (streamError) {
          console.error('流式传输失败:', streamError)
          
          // 检查是否是用户主动中断
          if (signal.aborted) {
            console.log('🛑 [流式传输] 用户主动中断，正常结束')
            return // 用户中断不需要显示错误消息
          }
          
          // 检查是否是网络相关错误
          const isNetworkError = streamError instanceof Error && (
            streamError.message.includes('aborted') ||
            streamError.message.includes('network') ||
            streamError.message.includes('fetch') ||
            streamError.name === 'AbortError'
          )
          
          if (isNetworkError) {
            console.log('🌐 [流式传输] 网络连接问题，尝试回退到非流式模式')
          } else {
            console.log('💥 [流式传输] 非网络错误，尝试回退到非流式模式')
          }
          
          // 流式传输失败，回退到普通模式
          console.log('📡 回退到非流式模式')
          
          setIsStreaming(false)
          setStreamingMessage('')
          setStreamingMessageId(null)
          
          // 🔥 回退时也要清除思考状态
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessage.id
              ? { ...msg, metadata: { ...msg.metadata, isThinking: false } }
              : msg
          ))
          
          // 继续执行非流式调用逻辑
          await executeNonStreamingCall(requestBody, aiMessage, session, signal)
          return
        }
        
      } else {
        // 非流式模式
        console.log('📡 使用非流式传输模式')
        await executeNonStreamingCall(requestBody, aiMessage, session, signal)
      }

      setIsLoading(false)

    } catch (error) {
      console.error('发送消息失败:', error)
      
      // 检查是否是用户主动中断
      if (abortControllerRef.current?.signal.aborted) {
        console.log('🛑 [发送消息] 用户主动中断请求')
        // 用户主动中断时不显示错误消息
        return
      }
      
      message.error('发送消息失败')
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingMessage('')
      setStreamingMessageId(null)
    } finally {
      // 清理AbortController
      abortControllerRef.current = null
    }
  // securityConfig 必须参与依赖，否则用户在当前页面开启安全控制后，
  // 回调仍会捕获首次渲染时的旧值并把 requireApproval=false 发送给 Agent。
  }, [isLoading, currentSession, createNewSession, addMessageToRedis, config, messages.length, executeNonStreamingCall, securityConfig])

  // 停止生成（包括流式传输） - 真正中断请求
  const stopGeneration = useCallback(() => {
    console.log('🛑 [停止生成] 用户主动停止生成')
    
    // 中断当前请求
    if (abortControllerRef.current) {
      console.log('🛑 [停止生成] 中断正在进行的请求')
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    // 重置所有状态
    setIsLoading(false)
    setIsStreaming(false)
    setStreamingMessage('')
    setStreamingMessageId(null)
    
    console.log('✅ [停止生成] 状态重置完成')
  }, [])

  // 重发消息
  const resendMessage = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]
    if (message.type === 'user') {
      await sendMessage(message.content)
    }
  }, [messages, sendMessage])

  // 删除消息
  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
  }, [])

  // 复制消息
  const copyMessage = useCallback(async (content: string) => {
    await copyWithFeedback(
      content,
      (msg) => message.success(msg),
      (msg) => message.error(msg)
    )
  }, [])

  // 清除消息
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // 导出会话
  const exportSession = useCallback(() => {
    if (!currentSession || messages.length === 0) return

    const exportData = {
      session: currentSession,
      messages: messages,
      exportTime: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-session-${currentSession.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentSession, messages])

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<RedisChatConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // 搜索会话
  const searchSessions = useCallback(async (query: string) => {
    const sessions = await getSessions()
    return sessions.filter((session: any) =>
      session.title.toLowerCase().includes(query.toLowerCase())
    )
  }, [getSessions])

  // 初始化 - 移除自动恢复逻辑，确保每次都是全新状态
  useEffect(() => {
    // 不再自动加载上次的会话，让AI助手每次都是全新开始
    console.log('🎆 [useRedisChat] 初始化 - 不自动加载历史会话，保持全新状态')
    
    // 只处理显式传入的sessionId
    if (initialSessionId) {
      console.log('💼 [useRedisChat] 检测到初始会话ID，加载指定会话:', initialSessionId)
      loadSession(initialSessionId)
    } else {
      console.log('✨ [useRedisChat] 无初始会话ID，保持全新状态')
    }
  }, [initialSessionId, loadSession])

  // 移除localStorage保存逻辑，不再缓存会话ID

  return {
    // 状态
    currentSession,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    streamingMessageId,
    config,

    // 配置
    setConfig,
    updateConfig,

    // 会话管理
    createNewSession,
    startNewSession,
    loadSession,
    deleteSession,
    clearHistory,
    getSessions,
    searchSessions,

    // 消息操作
    sendMessage,
    stopGeneration,
    resendMessage,
    deleteMessage,
    copyMessage,
    clearMessages,
    exportSession,
    setMessages, // 🔥 导出setMessages用于命令批准按钮更新状态

    // 兼容性
    messagesEndRef: { current: null }
  }
}
