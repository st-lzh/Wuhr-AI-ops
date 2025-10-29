// 数据缓存管理Hook
import { useState, useCallback, useRef } from 'react'

interface CacheItem<T> {
  data: T
  timestamp: number
  loading: boolean
}

interface UseCachedDataOptions {
  cacheTime?: number // 缓存时间（毫秒），默认5分钟
  staleTime?: number // 数据过期时间（毫秒），默认1分钟
}

export function useCachedData<T>(
  fetchFn: () => Promise<T>,
  key: string,
  options: UseCachedDataOptions = {}
) {
  const { cacheTime = 5 * 60 * 1000, staleTime = 1 * 60 * 1000 } = options
  
  const [cache, setCache] = useState<CacheItem<T> | null>(null)
  const loadingRef = useRef(false)

  const loadData = useCallback(async (forceRefresh = false) => {
    // 如果正在加载，直接返回
    if (loadingRef.current) {
      return cache?.data
    }

    // 检查缓存是否有效
    const now = Date.now()
    if (!forceRefresh && cache && (now - cache.timestamp) < cacheTime) {
      return cache.data
    }

    try {
      loadingRef.current = true
      setCache(prev => prev ? { ...prev, loading: true } : null)

      const data = await fetchFn()
      const newCache: CacheItem<T> = {
        data,
        timestamp: now,
        loading: false
      }
      
      setCache(newCache)
      return data
    } catch (error) {
      console.error(`Failed to load data for key: ${key}`, error)
      setCache(prev => prev ? { ...prev, loading: false } : null)
      throw error
    } finally {
      loadingRef.current = false
    }
  }, [cache, cacheTime, fetchFn, key])

  const isStale = cache ? (Date.now() - cache.timestamp) > staleTime : true
  const isLoading = cache?.loading || loadingRef.current

  return {
    data: cache?.data,
    isLoading,
    isStale,
    loadData,
    clearCache: () => setCache(null)
  }
}

export default useCachedData