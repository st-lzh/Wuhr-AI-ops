// 系统消息通知服务
import { SystemMessage, NotificationType } from './types'
// import { getPrismaClient } from '../config/database' // 暂时不使用

class SystemNotificationService {
  // 创建系统消息
  async createMessage(
    userId: string,
    type: NotificationType,
    title: string,
    content: string,
    options: {
      actionUrl?: string
      actionText?: string
      expiredAt?: Date
    } = {}
  ): Promise<SystemMessage> {
    try {
      const message: SystemMessage = {
        id: this.generateId(),
        type,
        title,
        content,
        userId,
        isRead: false,
        createdAt: new Date(),
        expiredAt: options.expiredAt,
        actionUrl: options.actionUrl,
        actionText: options.actionText
      }

      // 存储到数据库或内存缓存
      await this.saveMessage(message)

      console.log(`📬 系统消息已创建: ${title} (用户: ${userId})`)
      return message

    } catch (error) {
      console.error('创建系统消息失败:', error)
      throw error
    }
  }

  // 获取用户的未读消息
  async getUnreadMessages(userId: string): Promise<SystemMessage[]> {
    try {
      // 简化实现：从内存或缓存获取
      const messages = await this.getMessagesByUser(userId)
      return messages.filter(msg => !msg.isRead && !this.isExpired(msg))
    } catch (error) {
      console.error('获取未读消息失败:', error)
      return []
    }
  }

  // 获取用户的所有消息
  async getMessages(
    userId: string,
    options: {
      includeRead?: boolean
      limit?: number
      offset?: number
    } = {}
  ): Promise<SystemMessage[]> {
    try {
      const { includeRead = true, limit = 50, offset = 0 } = options
      
      let messages = await this.getMessagesByUser(userId)
      
      // 过滤已读消息
      if (!includeRead) {
        messages = messages.filter(msg => !msg.isRead)
      }
      
      // 过滤过期消息
      messages = messages.filter(msg => !this.isExpired(msg))
      
      // 排序和分页
      messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return messages.slice(offset, offset + limit)
      
    } catch (error) {
      console.error('获取消息列表失败:', error)
      return []
    }
  }

  // 标记消息为已读
  async markAsRead(userId: string, messageId: string): Promise<boolean> {
    try {
      const messages = await this.getMessagesByUser(userId)
      const message = messages.find(msg => msg.id === messageId && msg.userId === userId)
      
      if (message) {
        message.isRead = true
        await this.updateMessage(message)
        console.log(`✅ 消息已标记为已读: ${messageId}`)
        return true
      }
      
      return false
    } catch (error) {
      console.error('标记消息已读失败:', error)
      return false
    }
  }

  // 批量标记为已读
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const messages = await this.getUnreadMessages(userId)
      let count = 0
      
      for (const message of messages) {
        if (await this.markAsRead(userId, message.id)) {
          count++
        }
      }
      
      console.log(`✅ 已标记 ${count} 条消息为已读`)
      return count
    } catch (error) {
      console.error('批量标记已读失败:', error)
      return 0
    }
  }

  // 删除消息
  async deleteMessage(userId: string, messageId: string): Promise<boolean> {
    try {
      const messages = await this.getMessagesByUser(userId)
      const index = messages.findIndex(msg => msg.id === messageId && msg.userId === userId)
      
      if (index !== -1) {
        messages.splice(index, 1)
        await this.saveMessages(userId, messages)
        console.log(`🗑️ 消息已删除: ${messageId}`)
        return true
      }
      
      return false
    } catch (error) {
      console.error('删除消息失败:', error)
      return false
    }
  }

  // 清理过期消息
  async cleanupExpiredMessages(): Promise<number> {
    try {
      let totalCleaned = 0
      
      // 获取所有用户的消息（简化实现）
      const userIds = await this.getAllUserIds()
      
      for (const userId of userIds) {
        const messages = await this.getMessagesByUser(userId)
        const activeMessages = messages.filter(msg => !this.isExpired(msg))
        const expiredCount = messages.length - activeMessages.length
        
        if (expiredCount > 0) {
          await this.saveMessages(userId, activeMessages)
          totalCleaned += expiredCount
        }
      }
      
      if (totalCleaned > 0) {
        console.log(`🧹 已清理 ${totalCleaned} 条过期消息`)
      }
      
      return totalCleaned
    } catch (error) {
      console.error('清理过期消息失败:', error)
      return 0
    }
  }

  // 生成消息ID
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 检查消息是否过期
  private isExpired(message: SystemMessage): boolean {
    if (!message.expiredAt) return false
    return new Date() > message.expiredAt
  }

  // 存储消息（简化实现，使用内存存储）
  private messageStore: Map<string, SystemMessage[]> = new Map()

  private async saveMessage(message: SystemMessage): Promise<void> {
    const messages = this.messageStore.get(message.userId) || []
    messages.push(message)
    this.messageStore.set(message.userId, messages)
  }

  private async updateMessage(message: SystemMessage): Promise<void> {
    const messages = this.messageStore.get(message.userId) || []
    const index = messages.findIndex(msg => msg.id === message.id)
    if (index !== -1) {
      messages[index] = message
      this.messageStore.set(message.userId, messages)
    }
  }

  private async getMessagesByUser(userId: string): Promise<SystemMessage[]> {
    return this.messageStore.get(userId) || []
  }

  private async saveMessages(userId: string, messages: SystemMessage[]): Promise<void> {
    this.messageStore.set(userId, messages)
  }

  private async getAllUserIds(): Promise<string[]> {
    return Array.from(this.messageStore.keys())
  }
}

// 全局系统通知服务实例
export const systemNotificationService = new SystemNotificationService()

// 定期清理过期消息
if (typeof window === 'undefined') {
  setInterval(() => {
    systemNotificationService.cleanupExpiredMessages().catch(console.error)
  }, 60 * 60 * 1000) // 每小时清理一次
}

export default SystemNotificationService
