'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardData } from '../types/dashboard'
import type { DashboardRange } from '../../lib/dashboard/metrics'

/** 读取真实聚合数据；切换时间范围会重新请求，后台每分钟自动刷新一次。 */
export function useDashboard(range: DashboardRange) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const fetchDashboardData = useCallback(async (background = false) => {
    const sequence = ++requestSequence.current
    try {
      if (background || data) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const response = await fetch(`/api/dashboard/stats?range=${range}`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) throw new Error(result?.error || `HTTP ${response.status}`)
      if (sequence === requestSequence.current) setData(result.data)
    } catch (error) {
      if (sequence === requestSequence.current) {
        setError(error instanceof Error ? error.message : '获取仪表盘数据失败')
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [range, data])

  useEffect(() => {
    void fetchDashboardData(false)
    const interval = window.setInterval(() => void fetchDashboardData(true), 60_000)
    return () => window.clearInterval(interval)
  }, [range]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => fetchDashboardData(true),
  }
}
