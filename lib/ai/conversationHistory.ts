import RedisChatHistoryManager from '../../app/utils/redisChatHistory'

export interface RuntimeConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ResolveHistoryOptions {
  userId: string
  sessionId?: unknown
  currentMessageId?: unknown
}

const MAX_ITEMS = 24
const MAX_TOTAL_CHARS = 24_000
const MAX_ITEM_CHARS = 4_000

/**
 * 从当前用户自己的持久化 Redis 会话恢复最近上下文。
 * 浏览器只提交会话 ID，BFF 重新读取权威记录，避免信任客户端伪造的历史消息。
 */
export async function resolvePersistedConversationHistory(
  options: ResolveHistoryOptions
): Promise<RuntimeConversationMessage[]> {
  const sessionId = typeof options.sessionId === 'string' ? options.sessionId.trim() : ''
  if (!sessionId || sessionId.length > 180) return []

  const currentMessageId = typeof options.currentMessageId === 'string'
    ? options.currentMessageId.trim()
    : ''
  const manager = RedisChatHistoryManager.getInstance()

  try {
    const session = await manager.getSession(options.userId, sessionId)
    if (!session) return []

    const messages = await manager.getMessages(options.userId, sessionId)
    const candidates = messages
      .filter(message => !currentMessageId || message.id !== currentMessageId)
      .filter(message => message.type === 'user' || message.type === 'ai')
      .slice(-MAX_ITEMS)

    const result: RuntimeConversationMessage[] = []
    let total = 0
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const message = candidates[index]
      const raw = typeof message.content === 'string' ? message.content.trim() : ''
      if (!raw || raw === '__LOADING_ANIMATION__') continue
      const content = raw.length > MAX_ITEM_CHARS
        ? `${raw.slice(0, MAX_ITEM_CHARS)}\n...[历史消息已裁剪]`
        : raw
      if (total + content.length > MAX_TOTAL_CHARS) break
      result.push({ role: message.type === 'user' ? 'user' : 'assistant', content })
      total += content.length
    }

    return result.reverse()
  } catch (error) {
    // 历史恢复失败不应阻断一轮新的运维请求；记录后退化为无历史会话。
    console.warn('恢复持久化会话历史失败，将以新一轮上下文继续:', error)
    return []
  }
}
