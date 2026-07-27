import { createClient, RedisClientType } from 'redis'

class RedisManager {
  private static instance: RedisManager
  private client: RedisClientType | null = null
  private isConnected = false
  private connectPromise: Promise<void> | null = null

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager()
    }
    return RedisManager.instance
  }

  async connect(): Promise<void> {
    if (this.client?.isReady) {
      return
    }

    // 多个 API 请求可能同时初始化 Redis，复用同一个连接 Promise，避免重复创建客户端。
    if (this.connectPromise) {
      return this.connectPromise
    }

    this.connectPromise = this.establishConnection()

    try {
      await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  private async establishConnection(): Promise<void> {
    try {
      // 优先使用 REDIS_URL，否则从拆分环境变量构建连接 URL。
      const redisUrl = process.env.REDIS_URL ||
        `redis://:${process.env.REDIS_PASSWORD || 'redis_password_2024'}@${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || '6379'}`
      const endpoint = new URL(redisUrl)

      console.log('🔌 正在连接Redis:', {
        host: endpoint.hostname,
        port: endpoint.port || '6379'
      })

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries >= 5) {
              return new Error('Redis连接重试次数已达上限')
            }
            return Math.min((retries + 1) * 100, 1000)
          }
        }
      })

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
        this.isConnected = false
      })

      this.client.on('ready', () => {
        console.log('✅ Redis connected successfully')
        this.isConnected = true
      })

      this.client.on('end', () => {
        console.log('❌ Redis disconnected')
        this.isConnected = false
      })

      await this.client.connect()
      this.isConnected = this.client.isReady
    } catch (error) {
      this.isConnected = false

      if (this.client?.isOpen) {
        await this.client.disconnect().catch(() => undefined)
      }
      this.client = null

      console.error('Failed to connect to Redis:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      if (this.client.isOpen) {
        await this.client.disconnect()
      }
      this.client = null
      this.isConnected = false
    }
  }

  getClient(): RedisClientType {
    if (!this.client?.isReady || !this.isConnected) {
      throw new Error('Redis client is not connected')
    }
    return this.client
  }

  isReady(): boolean {
    return this.isConnected && this.client?.isReady === true
  }
}

export default RedisManager
