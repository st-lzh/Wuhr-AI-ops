// 单例SSE连接管理器，避免重复连接
class RealtimeNotificationManager {
  private static instance: RealtimeNotificationManager
  private eventSource: EventSource | null = null
  private listeners: Set<(data: any) => void> = new Set()
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isCleaningUp = false

  private constructor() {}

  static getInstance(): RealtimeNotificationManager {
    if (!RealtimeNotificationManager.instance) {
      RealtimeNotificationManager.instance = new RealtimeNotificationManager()
    }
    return RealtimeNotificationManager.instance
  }

  // 添加监听器
  addListener(callback: (data: any) => void): () => void {
    this.listeners.add(callback)
    
    // 如果还没有连接，建立连接
    if (!this.eventSource && !this.isCleaningUp) {
      this.connect()
    }

    // 返回取消监听的函数
    return () => {
      this.listeners.delete(callback)
      
      // 如果没有监听器了，关闭连接
      if (this.listeners.size === 0) {
        this.disconnect()
      }
    }
  }

  // 建立连接
  private connect() {
    if (this.isCleaningUp || this.eventSource) return

    try {
      console.log('📡 [Realtime Manager] 建立SSE连接...')
      this.eventSource = new EventSource('/api/notifications/realtime')

      this.eventSource.onopen = () => {
        console.log('📡 [Realtime Manager] SSE连接已建立')
        this.isConnected = true
        this.reconnectAttempts = 0
        
        // 通知所有监听器连接已建立
        this.listeners.forEach(callback => {
          try {
            callback({ type: 'connection_status', connected: true })
          } catch (error) {
            console.error('❌ [Realtime Manager] 监听器回调错误:', error)
          }
        })
      }

      this.eventSource.onmessage = (event) => {
        if (this.isCleaningUp) return
        
        try {
          const data = JSON.parse(event.data)

          // 过滤心跳消息的日志输出，减少噪音
          if (data.type !== 'heartbeat') {
            console.log('📬 [Realtime Manager] 收到消息:', data.type)
          }

          // 广播给所有监听器
          this.listeners.forEach(callback => {
            try {
              callback(data)
            } catch (error) {
              console.error('❌ [Realtime Manager] 监听器回调错误:', error)
            }
          })
        } catch (error) {
          console.error('❌ [Realtime Manager] 解析消息失败:', error)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('❌ [Realtime Manager] SSE连接错误:', error)
        this.isConnected = false
        
        // 通知所有监听器连接已断开
        this.listeners.forEach(callback => {
          try {
            callback({ type: 'connection_status', connected: false })
          } catch (error) {
            console.error('❌ [Realtime Manager] 监听器回调错误:', error)
          }
        })
        
        // 重连逻辑
        if (!this.isCleaningUp && this.reconnectAttempts < this.maxReconnectAttempts && this.listeners.size > 0) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000)
          this.reconnectAttempts++
          console.log(`🔄 [Realtime Manager] ${delay}ms后尝试第${this.reconnectAttempts}次重连...`)
          
          this.reconnectTimeout = setTimeout(() => {
            if (!this.isCleaningUp && this.listeners.size > 0) {
              this.eventSource = null
              this.connect()
            }
          }, delay)
        } else {
          console.log('❌ [Realtime Manager] 停止重连')
        }
      }
    } catch (error) {
      console.error('❌ [Realtime Manager] 建立连接失败:', error)
      this.isConnected = false
    }
  }

  // 断开连接
  private disconnect() {
    console.log('🔌 [Realtime Manager] 断开SSE连接')
    this.isCleaningUp = true
    this.isConnected = false
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    
    this.isCleaningUp = false
  }

  // 获取连接状态
  getConnectionStatus(): boolean {
    return this.isConnected
  }

  // 获取监听器数量（用于调试）
  getListenerCount(): number {
    return this.listeners.size
  }

  // 清理所有连接（用于测试或应用关闭）
  cleanup() {
    this.listeners.clear()
    this.disconnect()
  }
}

export default RealtimeNotificationManager