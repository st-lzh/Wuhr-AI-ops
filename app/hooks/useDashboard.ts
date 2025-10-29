'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'

export interface DashboardStats {
  title: string
  value: number
  suffix: string
  change: string
  color: string
  trend: 'up' | 'down' | 'stable'
}

export interface RecentActivity {
  id: string
  type: string
  title: string
  description: string
  time: string
  status: 'success' | 'warning' | 'error' | 'info'
  avatar: string
}

export interface DashboardSystemHealth {
  cpu: number
  memory: number
  disk: number
  network: number
}

export interface DashboardData {
  stats: DashboardStats[]
  recentActivities: RecentActivity[]
  systemHealth: DashboardSystemHealth
  summary: {
    totalChatSessions: number
    totalServers: number
    activeServers: number
    totalProjects: number
    totalDeployments: number
    todayDeployments: number
    totalUsers: number
    activeUsers: number
  }
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { accessToken } = useAuth()

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/dashboard/stats', {
        method: 'GET',
        credentials: 'include', // 使用cookie认证
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || '获取数据失败')
      }
    } catch (err) {
      console.error('获取仪表盘数据失败:', err)
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    fetchDashboardData()
  }, [])

  // 定时刷新（每10分钟）- 减少刷新频率
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData()
    }, 10 * 60 * 1000) // 改为10分钟

    return () => clearInterval(interval)
  }, [])

  return {
    data,
    loading,
    error,
    refresh: fetchDashboardData
  }
}

// 默认数据（用于加载状态或错误时的回退）
export const defaultDashboardData: DashboardData = {
  stats: [
    {
      title: 'AI 对话总数',
      value: 0,
      suffix: '次',
      change: '+0%',
      color: 'blue',
      trend: 'stable'
    },
    {
      title: '服务器在线',
      value: 0,
      suffix: '/0台',
      change: '暂无数据',
      color: 'gray',
      trend: 'stable'
    },
    {
      title: 'CI/CD项目',
      value: 0,
      suffix: '个',
      change: '今日部署0次',
      color: 'purple',
      trend: 'stable'
    },
    {
      title: '活跃用户',
      value: 0,
      suffix: '/0人',
      change: '0%活跃',
      color: 'cyan',
      trend: 'stable'
    }
  ],
  recentActivities: [],
  systemHealth: {
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0
  },
  summary: {
    totalChatSessions: 0,
    totalServers: 0,
    activeServers: 0,
    totalProjects: 0,
    totalDeployments: 0,
    todayDeployments: 0,
    totalUsers: 0,
    activeUsers: 0
  }
}
