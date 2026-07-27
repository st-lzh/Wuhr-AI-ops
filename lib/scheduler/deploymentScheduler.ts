import { getPrismaClient } from '../config/database'
import { triggerApprovedDeployment } from '../services/deploymentTriggerService'

/**
 * 部署调度器 - 处理计划部署时间功能
 */
class DeploymentScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private checkInterval = 60 * 1000 // 每分钟检查一次

  /**
   * 启动调度器
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 部署调度器已在运行中')
      return
    }

    console.log('🕐 启动部署调度器...')
    this.isRunning = true
    
    // 立即执行一次检查
    this.checkScheduledDeployments()
    
    // 设置定时检查
    this.intervalId = setInterval(async () => {
      await this.checkScheduledDeployments()
    }, this.checkInterval)
    
    console.log(`✅ 部署调度器已启动，检查间隔: ${this.checkInterval / 1000}秒`)
  }

  /**
   * 停止调度器
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ 部署调度器未在运行')
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.isRunning = false
    console.log('⏹️ 部署调度器已停止')
  }

  /**
   * 检查并执行计划部署
   */
  private async checkScheduledDeployments() {
    try {
      const prisma = await getPrismaClient()
      const now = new Date()
      
      // 查找到期的计划部署
      const scheduledDeployments = await prisma.deployment.findMany({
        where: {
          status: 'approved', // 已审批状态
          scheduledAt: {
            lte: now // 计划时间小于等于当前时间
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })
      
      if (scheduledDeployments.length > 0) {
        console.log(`🔍 找到 ${scheduledDeployments.length} 个到期的计划部署`)
      }
      
      // 执行到期的部署
      for (const deployment of scheduledDeployments) {
        await this.executeScheduledDeployment(deployment)
      }
      
    } catch (error) {
      console.error('❌ 检查计划部署失败:', error)
    }
  }

  /**
   * 执行单个计划部署
   */
  private async executeScheduledDeployment(deployment: any) {
    try {
      const prisma = await getPrismaClient()
      
      console.log(`🚀 执行计划部署: ${deployment.name} (ID: ${deployment.id})`)
      console.log(`   项目: ${deployment.project?.name || '未知'}`)
      console.log(`   创建者: ${deployment.user?.username || '未知'}`)
      console.log(`   计划时间: ${deployment.scheduledAt}`)
      console.log(`   当前时间: ${new Date()}`)
      
      const result = await triggerApprovedDeployment(deployment.id, deployment.user.id, prisma)
      console.log(`${result.success ? '✅' : '❌'} 计划部署触发结果: ${result.message}`)
      
    } catch (error) {
      console.error(`❌ 执行计划部署失败: ${deployment.name}`, error)
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null
    }
  }

  /**
   * 设置检查间隔
   */
  setCheckInterval(intervalMs: number) {
    if (intervalMs < 10000) { // 最小10秒
      throw new Error('检查间隔不能小于10秒')
    }
    
    this.checkInterval = intervalMs
    
    if (this.isRunning) {
      // 重启调度器以应用新的间隔
      this.stop()
      this.start()
    }
    
    console.log(`🔧 调度器检查间隔已更新为: ${intervalMs / 1000}秒`)
  }

  /**
   * 手动触发检查（用于测试）
   */
  async manualCheck() {
    console.log('🔍 手动触发计划部署检查...')
    await this.checkScheduledDeployments()
  }
}

// 创建单例实例
export const deploymentScheduler = new DeploymentScheduler()
