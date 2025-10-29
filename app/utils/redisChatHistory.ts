import RedisManager from './redisClient'
import { ChatSession, ChatMessage } from '../types/chat'

export class RedisChatHistoryManager {
  private static instance: RedisChatHistoryManager
  private redisManager: RedisManager

  private constructor() {
    this.redisManager = RedisManager.getInstance()
  }

  static getInstance(): RedisChatHistoryManager {
    if (!RedisChatHistoryManager.instance) {
      RedisChatHistoryManager.instance = new RedisChatHistoryManager()
    }
    return RedisChatHistoryManager.instance
  }

  private async ensureConnection(): Promise<void> {
    if (!this.redisManager.isReady()) {
      await this.redisManager.connect()
    }
  }

  // 会话相关操作
  async createSession(userId: string, title?: string): Promise<ChatSession> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session: ChatSession = {
      id: sessionId,
      title: title || `对话 ${new Date().toLocaleString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    }

    // 存储会话信息
    const sessionKey = `chat:session:${userId}:${sessionId}`
    await client.hSet(sessionKey, {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    })

    // 添加到用户会话列表
    const userSessionsKey = `chat:sessions:${userId}`
    await client.zAdd(userSessionsKey, {
      score: Date.now(),
      value: sessionId
    })

    // 设置过期时间（30天）
    await client.expire(sessionKey, 30 * 24 * 60 * 60)
    await client.expire(userSessionsKey, 30 * 24 * 60 * 60)

    return session
  }

  async getSessions(userId: string): Promise<ChatSession[]> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    const userSessionsKey = `chat:sessions:${userId}`
    // 使用简单的zRange方法，然后手动反转
    const sessionIds = await client.zRange(userSessionsKey, 0, -1)
    sessionIds.reverse() // 手动反转以获得最新的会话

    const sessions: ChatSession[] = []
    // sessionIds 现在是字符串数组
    for (const sessionId of sessionIds) {
      const sessionKey = `chat:session:${userId}:${sessionId}`
      const sessionData = await client.hGetAll(sessionKey)

      if (sessionData.id) {
        // 获取该会话的消息数量
        const messagesKey = `chat:messages:${userId}:${sessionId}`
        const messageCount = await client.lLen(messagesKey)

        sessions.push({
          id: sessionData.id,
          title: sessionData.title || '新对话',
          createdAt: new Date(sessionData.createdAt || Date.now()),
          updatedAt: new Date(sessionData.updatedAt || Date.now()),
          messages: [], // 空消息数组，实际消息通过getSessionMessages获取
          messageCount: messageCount // 添加消息数量
        })
      }
    }

    return sessions
  }

  async getSession(userId: string, sessionId: string): Promise<ChatSession | null> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    const sessionKey = `chat:session:${userId}:${sessionId}`
    const sessionData = await client.hGetAll(sessionKey)

    if (!sessionData.id) {
      return null
    }

    return {
      id: sessionData.id,
      title: sessionData.title,
      createdAt: new Date(sessionData.createdAt),
      updatedAt: new Date(sessionData.updatedAt),
      messages: [] // 空消息数组，实际消息通过getSessionMessages获取
    }
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    // 删除会话数据
    const sessionKey = `chat:session:${userId}:${sessionId}`
    await client.del(sessionKey)

    // 删除会话消息
    const messagesKey = `chat:messages:${userId}:${sessionId}`
    await client.del(messagesKey)

    // 从用户会话列表中移除
    const userSessionsKey = `chat:sessions:${userId}`
    await client.zRem(userSessionsKey, sessionId)
  }

  // 消息相关操作
  async addMessage(userId: string, sessionId: string, message: ChatMessage): Promise<void> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    const messagesKey = `chat:messages:${userId}:${sessionId}`
    const messageData = {
      id: message.id,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date(message.timestamp).toISOString(),
      ...(message.metadata && { metadata: JSON.stringify(message.metadata) })
    }

    await client.lPush(messagesKey, JSON.stringify(messageData))
    
    // 更新会话的最后更新时间
    const sessionKey = `chat:session:${userId}:${sessionId}`
    await client.hSet(sessionKey, 'updatedAt', new Date().toISOString())

    // 设置过期时间（30天）
    await client.expire(messagesKey, 30 * 24 * 60 * 60)
  }

  async getMessages(userId: string, sessionId: string): Promise<ChatMessage[]> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    const messagesKey = `chat:messages:${userId}:${sessionId}`
    const messageStrings = await client.lRange(messagesKey, 0, -1)

    const messages: ChatMessage[] = []
    for (const messageString of messageStrings.reverse()) { // 反转以获得正确的时间顺序
      try {
        const messageData = JSON.parse(messageString)
        messages.push({
          id: messageData.id,
          type: messageData.type || messageData.role, // 兼容旧数据
          content: messageData.content,
          timestamp: new Date(messageData.timestamp),
          ...(messageData.metadata && { metadata: JSON.parse(messageData.metadata) })
        })
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    }

    return messages
  }

  async clearHistory(userId: string): Promise<void> {
    await this.ensureConnection()
    const client = this.redisManager.getClient()

    const userSessionsKey = `chat:sessions:${userId}`
    const sessionIds = await client.zRange(userSessionsKey, 0, -1)

    // 删除所有会话和消息
    for (const sessionId of sessionIds) {
      await this.deleteSession(userId, sessionId)
    }

    // 删除用户会话列表
    await client.del(userSessionsKey)
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureConnection()
      const client = this.redisManager.getClient()
      await client.ping()
      return true
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }
}

export default RedisChatHistoryManager
