import { createClient, RedisClientType } from 'redis'

class RedisManager {
  private static instance: RedisManager
  private client: RedisClientType | null = null
  private isConnected = false

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager()
    }
    return RedisManager.instance
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return
    }

    try {
      // 优先使用REDIS_URL，否则从环境变量构建连接URL
      const redisUrl = process.env.REDIS_URL ||
        `redis://:${process.env.REDIS_PASSWORD || 'redis_password_2024'}@${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || '6379'}`

      console.log('🔌 正在连接Redis:', {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || '6379'
      })

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      })

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
        this.isConnected = false
      })

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully')
        this.isConnected = true
      })

      this.client.on('disconnect', () => {
        console.log('❌ Redis disconnected')
        this.isConnected = false
      })

      await this.client.connect()
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
      this.isConnected = false
    }
  }

  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected')
    }
    return this.client
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null
  }
}

export default RedisManager
