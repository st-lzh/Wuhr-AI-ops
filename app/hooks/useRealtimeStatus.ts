'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface BuildStatus {
  id: string
  buildNumber: number
  status: string
  result?: string
  startedAt: string
  completedAt?: string
  duration?: number
  queueId?: number
  jenkinsBuildNumber?: number
  pipeline: {
    id: string
    name: string
    project: {
      id: string
      name: string
    }
  }
}

interface JenkinsStatus {
  buildNumber?: number
  building?: boolean
  result?: string
  duration?: number
  estimatedDuration?: number
  timestamp?: number
  inQueue?: boolean
  queueWhy?: string
  error?: string
}

interface RealtimeStatusData {
  build: BuildStatus
  jenkinsStatus?: JenkinsStatus
  progress: number
  lastUpdated: string
}

interface UseRealtimeStatusOptions {
  buildId?: string
  enabled?: boolean
  interval?: number
  onStatusChange?: (data: RealtimeStatusData) => void
  onComplete?: (data: RealtimeStatusData) => void
  onError?: (error: string) => void
}

export function useRealtimeStatus({
  buildId,
  enabled = true,
  interval = 3000, // 3秒轮询间隔
  onStatusChange,
  onComplete,
  onError
}: UseRealtimeStatusOptions) {
  const [data, setData] = useState<RealtimeStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)

  // 获取状态数据
  const fetchStatus = useCallback(async () => {
    if (!buildId || !enabled || isPollingRef.current) {
      return
    }

    isPollingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/cicd/builds/${buildId}/status`)
      const result = await response.json()

      if (result.success) {
        const newData = result.data as RealtimeStatusData
        setData(newData)
        
        // 触发状态变更回调
        onStatusChange?.(newData)

        // 检查是否完成
        const isComplete = ['success', 'failed', 'aborted', 'unstable'].includes(newData.build.status)
        if (isComplete) {
          onComplete?.(newData)
          stopPolling() // 停止轮询
        }
      } else {
        const errorMsg = result.error || '获取状态失败'
        setError(errorMsg)
        onError?.(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '网络错误'
      setError(errorMsg)
      onError?.(errorMsg)
      console.error('获取构建状态失败:', err)
    } finally {
      setLoading(false)
      isPollingRef.current = false
    }
  }, [buildId, enabled, onStatusChange, onComplete, onError])

  // 开始轮询
  const startPolling = useCallback(() => {
    if (!buildId || !enabled) return

    // 立即获取一次状态
    fetchStatus()

    // 设置定时轮询
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      // 只有在构建未完成时才继续轮询
      if (data && ['success', 'failed', 'aborted', 'unstable'].includes(data.build.status)) {
        stopPolling()
        return
      }
      fetchStatus()
    }, interval)
  }, [buildId, enabled, interval, fetchStatus, data])

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // 手动刷新
  const refresh = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  // 重置状态
  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
    stopPolling()
  }, [stopPolling])

  // 当buildId或enabled变化时重新开始轮询
  useEffect(() => {
    if (buildId && enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [buildId, enabled, startPolling, stopPolling])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    data,
    loading,
    error,
    refresh,
    reset,
    startPolling,
    stopPolling,
    isPolling: intervalRef.current !== null
  }
}

// 多个构建状态管理Hook
export function useMultipleRealtimeStatus({
  buildIds = [],
  enabled = true,
  interval = 5000,
  onStatusChange,
  onComplete,
  onError
}: {
  buildIds?: string[]
  enabled?: boolean
  interval?: number
  onStatusChange?: (buildId: string, data: RealtimeStatusData) => void
  onComplete?: (buildId: string, data: RealtimeStatusData) => void
  onError?: (buildId: string, error: string) => void
}) {
  const [statusMap, setStatusMap] = useState<Record<string, RealtimeStatusData>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 获取所有构建状态
  const fetchAllStatus = useCallback(async () => {
    if (!enabled || buildIds.length === 0) return

    const promises = buildIds.map(async (buildId) => {
      setLoadingMap(prev => ({ ...prev, [buildId]: true }))
      setErrorMap(prev => ({ ...prev, [buildId]: '' }))

      try {
        const response = await fetch(`/api/cicd/builds/${buildId}/status`)
        const result = await response.json()

        if (result.success) {
          const data = result.data as RealtimeStatusData
          setStatusMap(prev => ({ ...prev, [buildId]: data }))
          onStatusChange?.(buildId, data)

          // 检查是否完成
          const isComplete = ['success', 'failed', 'aborted', 'unstable'].includes(data.build.status)
          if (isComplete) {
            onComplete?.(buildId, data)
          }
        } else {
          const errorMsg = result.error || '获取状态失败'
          setErrorMap(prev => ({ ...prev, [buildId]: errorMsg }))
          onError?.(buildId, errorMsg)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '网络错误'
        setErrorMap(prev => ({ ...prev, [buildId]: errorMsg }))
        onError?.(buildId, errorMsg)
      } finally {
        setLoadingMap(prev => ({ ...prev, [buildId]: false }))
      }
    })

    await Promise.all(promises)
  }, [buildIds, enabled, onStatusChange, onComplete, onError])

  // 开始轮询
  const startPolling = useCallback(() => {
    if (!enabled || buildIds.length === 0) return

    fetchAllStatus()

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(fetchAllStatus, interval)
  }, [enabled, buildIds, interval, fetchAllStatus])

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (enabled && buildIds.length > 0) {
      startPolling()
    } else {
      stopPolling()
    }

    return stopPolling
  }, [enabled, buildIds, startPolling, stopPolling])

  return {
    statusMap,
    loadingMap,
    errorMap,
    refresh: fetchAllStatus,
    startPolling,
    stopPolling,
    isPolling: intervalRef.current !== null
  }
}
