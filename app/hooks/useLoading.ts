'use client'

import { useContext } from 'react'
import { GlobalStateContext } from '../contexts/GlobalStateContext'

// 加载状态管理 Hook
export function useLoading() {
  const context = useContext(GlobalStateContext)
  if (!context) {
    throw new Error('useLoading must be used within a GlobalStateProvider')
  }
  const { state, dispatch } = context

  const setLoading = (loading: boolean, key?: string) => {
    dispatch({
      type: 'SET_LOADING',
      payload: { loading, key }
    })
  }

  const setError = (error: string | null) => {
    dispatch({
      type: 'SET_ERROR',
      payload: error
    })
  }

  const clearError = () => {
    dispatch({
      type: 'SET_ERROR',
      payload: null
    })
  }

  // 获取特定 key 的加载状态
  const isLoading = (key?: string): boolean => {
    if (key) {
      return state.loadingStates?.[key] || false
    }
    return state.loading
  }

  // 检查是否有任何加载状态
  const hasAnyLoading = (): boolean => {
    if (state.loading) return true
    if (state.loadingStates) {
      return Object.values(state.loadingStates).some(loading => loading)
    }
    return false
  }

  // 获取所有加载状态的 keys
  const getLoadingKeys = (): string[] => {
    if (!state.loadingStates) return []
    return Object.keys(state.loadingStates).filter(key => state.loadingStates![key])
  }

  return {
    loading: state.loading,
    loadingStates: state.loadingStates || {},
    error: state.error,
    setLoading,
    setError,
    clearError,
    isLoading,
    hasAnyLoading,
    getLoadingKeys,
  }
}

// 异步操作包装器 Hook
export function useAsyncOperation() {
  const { setLoading, setError, clearError } = useLoading()

  const execute = async <T>(
    operation: () => Promise<T>,
    options?: {
      loadingKey?: string
      onSuccess?: (result: T) => void
      onError?: (error: any) => void
      showErrorToUser?: boolean
    }
  ): Promise<T | null> => {
    const { loadingKey, onSuccess, onError, showErrorToUser = true } = options || {}

    try {
      setLoading(true, loadingKey)
      clearError()

      const result = await operation()

      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (error) {
      console.error('Async operation failed:', error)
      
      if (showErrorToUser) {
        const errorMessage = error instanceof Error ? error.message : '操作失败'
        setError(errorMessage)
      }

      if (onError) {
        onError(error)
      }

      return null
    } finally {
      setLoading(false, loadingKey)
    }
  }

  return { execute }
}

// 请求队列管理
class RequestQueue {
  private static instance: RequestQueue
  private queue: Map<string, Promise<any>> = new Map()

  static getInstance(): RequestQueue {
    if (!RequestQueue.instance) {
      RequestQueue.instance = new RequestQueue()
    }
    return RequestQueue.instance
  }

  // 添加请求到队列
  add<T>(key: string, request: Promise<T>): Promise<T> {
    // 如果已经有相同的请求在进行中，返回现有的 Promise
    if (this.queue.has(key)) {
      return this.queue.get(key) as Promise<T>
    }

    // 添加新请求到队列
    this.queue.set(key, request)

    // 请求完成后从队列中移除
    request.finally(() => {
      this.queue.delete(key)
    })

    return request
  }

  // 取消请求
  cancel(key: string): boolean {
    if (this.queue.has(key)) {
      this.queue.delete(key)
      return true
    }
    return false
  }

  // 取消所有请求
  cancelAll(): void {
    this.queue.clear()
  }

  // 获取队列状态
  getQueueStatus(): { pending: string[], count: number } {
    const pending = Array.from(this.queue.keys())
    return {
      pending,
      count: pending.length
    }
  }
}

// 请求队列管理 Hook
export function useRequestQueue() {
  const queue = RequestQueue.getInstance()
  const { setLoading } = useLoading()

  const addRequest = async <T>(
    key: string,
    requestFn: () => Promise<T>,
    showLoading = true
  ): Promise<T> => {
    if (showLoading) {
      setLoading(true, key)
    }

    try {
      const request = requestFn()
      const result = await queue.add(key, request)
      return result
    } finally {
      if (showLoading) {
        setLoading(false, key)
      }
    }
  }

  const cancelRequest = (key: string): boolean => {
    const cancelled = queue.cancel(key)
    if (cancelled) {
      setLoading(false, key)
    }
    return cancelled
  }

  const cancelAllRequests = (): void => {
    queue.cancelAll()
    // 清除所有加载状态
    // 这里需要更复杂的逻辑来清除所有加载状态
  }

  const getQueueStatus = () => queue.getQueueStatus()

  return {
    addRequest,
    cancelRequest,
    cancelAllRequests,
    getQueueStatus,
  }
}

// 防抖 Hook
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const { useRef, useCallback } = require('react')
  const timeoutRef = (useRef as any)()

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}

// 节流 Hook
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const { useRef, useCallback } = require('react')
  const lastCallRef = (useRef as any)(0)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now
        callback(...args)
      }
    }) as T,
    [callback, delay]
  )
} 