import { useState, useCallback, useRef, useEffect } from 'react'
import { useRedisChat, UseRedisChatOptions } from './useRedisChat'
import { AgentOutputParser, AgentSession, AgentStep, createAgentParser } from '../utils/agentOutputParser'

export interface UseAgentChatOptions extends UseRedisChatOptions {
  enableAgentMode?: boolean
  autoParseOutput?: boolean
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { enableAgentMode = false, autoParseOutput = true, ...redisChatOptions } = options
  
  // 使用原有的Redis聊天hook
  const redisChatResult = useRedisChat(redisChatOptions)
  
  // 代理相关状态
  const [currentAgentSession, setCurrentAgentSession] = useState<AgentSession | null>(null)
  const [isAgentMode, setIsAgentMode] = useState(enableAgentMode)
  const [agentParsers, setAgentParsers] = useState<Map<string, AgentOutputParser>>(new Map())
  
  // 代理解析器引用
  const currentParserRef = useRef<AgentOutputParser | null>(null)

  // 创建或获取消息的代理解析器
  const getOrCreateParser = useCallback((messageId: string): AgentOutputParser => {
    let parser = agentParsers.get(messageId)
    if (!parser) {
      parser = createAgentParser(`agent_${messageId}`)
      setAgentParsers(prev => new Map(prev).set(messageId, parser!))
    }
    return parser
  }, [agentParsers])

  // 重置代理会话
  const resetAgentSession = useCallback(() => {
    if (currentParserRef.current) {
      currentParserRef.current.reset()
    }
    setCurrentAgentSession(null)
  }, [])

  // 解析流式数据块
  const parseStreamChunk = useCallback((chunk: string, isComplete: boolean = false) => {
    if (!isAgentMode || !autoParseOutput || !currentParserRef.current) return null

    const result = currentParserRef.current.parseStreamChunk(chunk, isComplete)
    
    if (result.shouldUpdate) {
      const updatedSession = currentParserRef.current.getSession()
      
      // 应用会话更新
      if (result.sessionUpdate) {
        Object.assign(updatedSession, result.sessionUpdate)
      }
      
      setCurrentAgentSession({ ...updatedSession })
    }
    
    return result
  }, [isAgentMode, autoParseOutput])

  // 流式数据处理hook
  useEffect(() => {
    // 当有流式消息时，实时更新代理会话
    if (isAgentMode && redisChatResult.isStreaming && redisChatResult.streamingMessage && currentParserRef.current) {
      const result = currentParserRef.current.parseStreamChunk(redisChatResult.streamingMessage, false)
      
      if (result.shouldUpdate) {
        const updatedSession = currentParserRef.current.getSession()
        
        // 应用会话更新
        if (result.sessionUpdate) {
          Object.assign(updatedSession, result.sessionUpdate)
        }
        
        // 确保流式状态正确
        updatedSession.status = 'executing'
        
        setCurrentAgentSession({ ...updatedSession })
      }
    } else if (isAgentMode && !redisChatResult.isStreaming && currentParserRef.current) {
      // 流式响应结束，确保状态正确更新
      const session = currentParserRef.current.getSession()
      
      if (session.status === 'executing') {
        const updatedSession = { ...session }
        updatedSession.status = 'completed'
        
        // 确保所有步骤都标记为完成
        updatedSession.steps.forEach(step => {
          if (step.status === 'in_progress' || step.status === 'pending') {
            step.status = 'completed'
          }
        })
        
        // 重新计算进度
        const completedSteps = updatedSession.steps.filter(step => 
          step.status === 'completed' || step.status === 'failed'
        ).length
        
        updatedSession.progress = updatedSession.steps.length > 0 
          ? Math.round((completedSteps / updatedSession.steps.length) * 100) 
          : 100
          
        updatedSession.totalSteps = updatedSession.steps.length
        
        setCurrentAgentSession(updatedSession)
      }
    }
  }, [isAgentMode, redisChatResult.isStreaming, redisChatResult.streamingMessage])

  // 增强的发送消息函数
  const sendAgentMessage = useCallback(async (
    message: string,
    options?: any // 保持与原来兼容的选项参数
  ) => {
    // 🔥 修复：在发送新消息前，完全重置代理相关状态
    resetAgentSession()
    clearAgentData() // 清理所有代理数据
    
    // 为这次对话创建新的解析器
    const messageId = `msg_${Date.now()}`
    const parser = getOrCreateParser(messageId)
    currentParserRef.current = parser
    
    // 初始化代理会话
    const initialSession = parser.getSession()
    initialSession.status = 'thinking'
    setCurrentAgentSession(initialSession)
    
    // 使用原有的发送消息功能
    const result = await redisChatResult.sendMessage(message, options)
    
    return result
  }, [resetAgentSession, getOrCreateParser, redisChatResult.sendMessage])

  // 获取消息的代理会话
  const getMessageAgentSession = useCallback((messageId: string): AgentSession | null => {
    const parser = agentParsers.get(messageId)
    return parser ? parser.getSession() : null
  }, [agentParsers])

  // 解析已有消息内容为代理格式
  const parseMessageContent = useCallback((messageId: string, content: string): AgentStep[] => {
    const parser = getOrCreateParser(messageId)
    return parser.parseContent(content)
  }, [getOrCreateParser])

  // 清理代理数据
  const clearAgentData = useCallback(() => {
    resetAgentSession()
    setAgentParsers(new Map())
    currentParserRef.current = null
  }, [resetAgentSession])

  // 监听消息变化，为新消息创建代理会话
  useEffect(() => {
    if (isAgentMode && redisChatResult.messages.length > 0) {
      const lastMessage = redisChatResult.messages[redisChatResult.messages.length - 1]
      
      // 只处理助手消息，并且不是加载动画
      if (lastMessage.type === 'ai' && lastMessage.content && lastMessage.content !== '__LOADING_ANIMATION__') {
        const messageId = lastMessage.id
        const parser = getOrCreateParser(messageId)
        
        // 清除之前的解析结果，重新解析
        parser.reset()
        parser.parseContent(lastMessage.content)
        const session = parser.getSession()
        
        // 根据消息状态和流式状态同步代理会话状态
        const updatedSession = { ...session }
        
        // 如果消息正在流式传输
        if (redisChatResult.isStreaming) {
          updatedSession.status = 'executing'
          // 找到最后一个步骤并设为进行中
          if (updatedSession.steps.length > 0) {
            const lastStepIndex = updatedSession.steps.length - 1
            updatedSession.steps[lastStepIndex].status = 'in_progress'
            updatedSession.currentStepId = updatedSession.steps[lastStepIndex].id
          }
        } else {
          // 消息已完成
          const finalStatus = lastMessage.status === 'error' ? 'failed' : 'completed'
          updatedSession.status = finalStatus
          
          // 设置所有步骤为完成状态
          updatedSession.steps.forEach(step => {
            if (step.status === 'in_progress' || step.status === 'pending') {
              step.status = finalStatus
            }
          })
          
          // 重新计算进度 - 确保准确性
          const completedSteps = updatedSession.steps.filter(step => 
            step.status === 'completed' || step.status === 'failed'
          ).length
          
          updatedSession.progress = updatedSession.totalSteps > 0 
            ? Math.round((completedSteps / updatedSession.totalSteps) * 100) 
            : 100
          
          // 确保totalSteps正确
          updatedSession.totalSteps = updatedSession.steps.length
        }
        
        setCurrentAgentSession(updatedSession)
      }
    }
  }, [redisChatResult.messages, redisChatResult.isStreaming, isAgentMode, getOrCreateParser])

  return {
    // 继承所有原有功能
    ...redisChatResult,
    
    // 代理功能增强
    isAgentMode,
    setIsAgentMode,
    currentAgentSession,
    sendAgentMessage,
    resetAgentSession,
    parseStreamChunk,
    getMessageAgentSession,
    parseMessageContent,
    clearAgentData,
    
    // 🔥 重写startNewSession以支持代理状态清理
    startNewSession: useCallback(async () => {
      console.log('🤖 [useAgentChat] 开始新会话，清理代理状态')
      
      // 清理代理相关状态
      clearAgentData()
      
      // 调用原有的startNewSession
      const result = await redisChatResult.startNewSession()
      
      console.log('✅ [useAgentChat] 代理状态清理完成')
      return result
    }, [clearAgentData, redisChatResult.startNewSession]),
    
    // 重写发送消息函数以支持代理模式
    sendMessage: isAgentMode ? sendAgentMessage : redisChatResult.sendMessage
  }
}