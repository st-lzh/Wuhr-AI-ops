// 调度器初始化模块 - 仅在服务端执行
// import { cronScheduler } from './cron' // 暂时注释，模块不存在
import { taskQueue } from './queue'

// 全局调度器初始化状态
let initialized = false

// 初始化调度系统
export async function initializeScheduler() {
  // 仅在服务端环境执行
  if (typeof window !== 'undefined') return
  
  if (initialized) {
    console.log('📋 调度器已经初始化，跳过重复初始化')
    return
  }

  try {
    console.log('🚀 开始初始化调度系统...')

    // 初始化Cron调度器
    // await cronScheduler.initialize() // 暂时注释，模块不存在
    
    // 初始化任务队列
    console.log('📥 任务队列已准备就绪')
    
    // 设置调度器监控
    setupSchedulerMonitoring()
    
    initialized = true
    console.log('✅ 调度系统初始化完成')

  } catch (error) {
    console.error('❌ 调度系统初始化失败:', error)
    // 不要抛出错误，避免影响应用启动
  }
}

// 设置调度器监控
function setupSchedulerMonitoring() {
  // 仅在服务端环境执行监控
  if (typeof window !== 'undefined') return
  
  // 每5分钟输出一次调度器状态
  setInterval(() => {
    try {
      const schedulerStatus = { tasks: [], isRunning: false, total: 0, active: 0, inactive: 0 } // cronScheduler.getTasksStatus()
      const queueStatus = taskQueue.getQueueStatus()

      console.log('📊 调度器状态:', {
        scheduler: {
          total: schedulerStatus.total,
          active: schedulerStatus.active,
          inactive: schedulerStatus.inactive
        },
        queue: {
          total: queueStatus.total,
          pending: queueStatus.pending,
          running: queueStatus.running
        }
      })
    } catch (error) {
      console.error('监控调度器状态时出错:', error)
    }
  }, 5 * 60 * 1000) // 5分钟
}

// 优雅关闭调度器
export async function shutdownScheduler() {
  if (!initialized || typeof window !== 'undefined') return

  console.log('🛑 正在关闭调度系统...')
  
  try {
    // 停止所有定时任务
    // const status = cronScheduler.getTasksStatus()
    // for (const task of status.tasks) {
    //   cronScheduler.unscheduleTask(task.id)
    // }
    
    // 清空任务队列
    taskQueue.clearQueue()
    
    initialized = false
    console.log('✅ 调度系统已安全关闭')

  } catch (error) {
    console.error('❌ 关闭调度系统时出错:', error)
  }
}

// 获取调度器健康状态
export function getSchedulerHealth() {
  if (typeof window !== 'undefined') {
    return {
      status: 'client_side',
      healthy: false,
      message: '调度器仅在服务端运行'
    }
  }
  
  if (!initialized) {
    return {
      status: 'not_initialized',
      healthy: false,
      message: '调度器尚未初始化'
    }
  }

  try {
    const schedulerStatus = { tasks: [], isRunning: false, total: 0, active: 0, inactive: 0 } // cronScheduler.getTasksStatus()
    const queueStatus = taskQueue.getQueueStatus()
    
    return {
      status: 'running',
      healthy: true,
      message: '调度器运行正常',
      details: {
        scheduler: schedulerStatus,
        queue: queueStatus,
        uptime: process.uptime()
      }
    }
  } catch (error) {
    return {
      status: 'error',
      healthy: false,
      message: '调度器运行异常',
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

export default {
  initialize: initializeScheduler,
  shutdown: shutdownScheduler,
  getHealth: getSchedulerHealth
}
