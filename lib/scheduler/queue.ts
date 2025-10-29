interface QueueItem {
  id: string
  taskId: string
  deploymentId: string
  priority: number
  createdAt: Date
  retryCount: number
  maxRetries: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

class TaskQueue {
  private queue: QueueItem[] = []
  private running: Set<string> = new Set()
  private maxConcurrent: number = 3
  private processing = false

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
  }

  // 添加任务到队列
  enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'status'>) {
    const queueItem: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      status: 'pending',
      ...item
    }

    // 按优先级插入队列
    const insertIndex = this.queue.findIndex(existing => existing.priority < queueItem.priority)
    if (insertIndex === -1) {
      this.queue.push(queueItem)
    } else {
      this.queue.splice(insertIndex, 0, queueItem)
    }

    console.log(`📥 任务加入队列: ${queueItem.taskId} (优先级: ${queueItem.priority})`)
    
    // 尝试处理队列
    this.processQueue()
    
    return queueItem.id
  }

  // 处理队列
  private async processQueue() {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
        const item = this.queue.find(item => 
          item.status === 'pending' && !this.running.has(item.taskId)
        )

        if (!item) break

        // 标记为运行中
        item.status = 'running'
        this.running.add(item.taskId)

        // 异步执行任务
        this.executeQueueItem(item).finally(() => {
          this.running.delete(item.taskId)
          // 继续处理队列
          setTimeout(() => this.processQueue(), 100)
        })
      }
    } finally {
      this.processing = false
    }
  }

  // 执行队列中的任务
  private async executeQueueItem(item: QueueItem) {
    try {
      console.log(`⚡ 开始执行队列任务: ${item.taskId}`)

      // 这里应该调用实际的任务执行逻辑
      // 模拟任务执行
      const executionTime = Math.random() * 5000 + 1000 // 1-6秒
      await new Promise(resolve => setTimeout(resolve, executionTime))

      // 模拟成功/失败
      const success = Math.random() > 0.1 // 90% 成功率

      if (success) {
        item.status = 'completed'
        console.log(`✅ 队列任务执行成功: ${item.taskId}`)
        
        // 从队列中移除
        this.removeFromQueue(item.id)
      } else {
        throw new Error('模拟执行失败')
      }

    } catch (error) {
      console.error(`❌ 队列任务执行失败: ${item.taskId}`, error)
      
      item.retryCount++
      item.error = error instanceof Error ? error.message : '未知错误'

      if (item.retryCount >= item.maxRetries) {
        item.status = 'failed'
        console.log(`💀 队列任务重试次数超限，标记为失败: ${item.taskId}`)
        this.removeFromQueue(item.id)
      } else {
        item.status = 'pending'
        console.log(`🔄 队列任务将重试: ${item.taskId} (${item.retryCount}/${item.maxRetries})`)
        
        // 延迟重试
        setTimeout(() => this.processQueue(), 30000) // 30秒后重试
      }
    }
  }

  // 从队列中移除任务
  private removeFromQueue(queueId: string) {
    const index = this.queue.findIndex(item => item.id === queueId)
    if (index !== -1) {
      this.queue.splice(index, 1)
    }
  }

  // 获取队列状态
  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      running: this.queue.filter(item => item.status === 'running').length,
      completed: this.queue.filter(item => item.status === 'completed').length,
      failed: this.queue.filter(item => item.status === 'failed').length,
      runningTasks: Array.from(this.running),
      queue: this.queue.map(item => ({
        id: item.id,
        taskId: item.taskId,
        priority: item.priority,
        status: item.status,
        retryCount: item.retryCount,
        maxRetries: item.maxRetries,
        createdAt: item.createdAt,
        error: item.error
      }))
    }
  }

  // 取消队列中的任务
  cancelTask(taskId: string) {
    const items = this.queue.filter(item => item.taskId === taskId)
    items.forEach(item => {
      if (item.status === 'pending') {
        this.removeFromQueue(item.id)
        console.log(`🚫 队列任务已取消: ${taskId}`)
      }
    })
  }

  // 清空队列
  clearQueue() {
    const pendingItems = this.queue.filter(item => item.status === 'pending')
    this.queue = this.queue.filter(item => item.status !== 'pending')
    console.log(`🧹 清空队列，移除 ${pendingItems.length} 个待处理任务`)
  }

  // 设置最大并发数
  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, max)
    console.log(`⚙️ 设置最大并发数: ${this.maxConcurrent}`)
    this.processQueue()
  }
}

// 创建全局任务队列实例
export const taskQueue = new TaskQueue(3)

export default TaskQueue
