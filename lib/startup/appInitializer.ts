import { deploymentScheduler } from '../scheduler/deploymentScheduler'

/**
 * 应用初始化器 - 负责启动各种后台服务
 */
class AppInitializer {
  private initialized = false

  /**
   * 初始化应用
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ 应用已初始化，跳过重复初始化')
      return
    }

    console.log('🚀 开始初始化应用...')

    try {
      // 启动部署调度器
      await this.startDeploymentScheduler()

      // 可以在这里添加其他初始化任务
      // await this.initializeOtherServices()

      this.initialized = true
      console.log('✅ 应用初始化完成')

    } catch (error) {
      console.error('❌ 应用初始化失败:', error)
      throw error
    }
  }

  /**
   * 启动部署调度器
   */
  private async startDeploymentScheduler() {
    try {
      console.log('🕐 启动部署调度器...')
      deploymentScheduler.start()
      console.log('✅ 部署调度器启动成功')
    } catch (error) {
      console.error('❌ 部署调度器启动失败:', error)
      throw error
    }
  }

  /**
   * 关闭应用
   */
  async shutdown() {
    if (!this.initialized) {
      return
    }

    console.log('🛑 开始关闭应用...')

    try {
      // 停止部署调度器
      deploymentScheduler.stop()

      this.initialized = false
      console.log('✅ 应用关闭完成')

    } catch (error) {
      console.error('❌ 应用关闭失败:', error)
    }
  }

  /**
   * 获取初始化状态
   */
  isInitialized() {
    return this.initialized
  }
}

// 创建单例实例
export const appInitializer = new AppInitializer()

// 在模块加载时自动初始化（仅在服务器端）
if (typeof window === 'undefined') {
  // 延迟初始化，避免在模块加载时立即执行
  setImmediate(() => {
    appInitializer.initialize().catch(error => {
      console.error('❌ 自动初始化失败:', error)
    })
  })
}
