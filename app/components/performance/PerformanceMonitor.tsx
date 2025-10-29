'use client'

import React, { useEffect, useState } from 'react'
import { Card, Statistic, Progress, Descriptions } from 'antd'
import { ClockCircleOutlined, DatabaseOutlined, RocketOutlined } from '@ant-design/icons'

interface PerformanceMetrics {
  pageLoadTime: number
  dataLoadTime: number
  totalRequests: number
  cacheHitRate: number
  lastUpdated: string
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    dataLoadTime: 0,
    totalRequests: 0,
    cacheHitRate: 0,
    lastUpdated: new Date().toLocaleString()
  })
  
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // 只在开发环境显示性能监控
    const isDevelopment = process.env.NODE_ENV === 'development'
    setIsVisible(isDevelopment)

    if (isDevelopment) {
      const startTime = performance.now()
      
      // 监控页面加载性能
      window.addEventListener('load', () => {
        const loadTime = performance.now() - startTime
        setMetrics(prev => ({
          ...prev,
          pageLoadTime: Math.round(loadTime)
        }))
      })

      // 模拟数据加载监控
      const interval = setInterval(() => {
        setMetrics(prev => ({
          ...prev,
          totalRequests: prev.totalRequests + Math.random() > 0.7 ? 1 : 0,
          cacheHitRate: Math.round(75 + Math.random() * 20), // 75-95%的缓存命中率
          lastUpdated: new Date().toLocaleString()
        }))
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card 
        title="性能监控" 
        size="small" 
        className="shadow-lg border-l-4 border-l-blue-500"
        bodyStyle={{ padding: '12px' }}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Statistic
              title="页面加载"
              value={metrics.pageLoadTime}
              suffix="ms"
              valueStyle={{ fontSize: '14px', color: metrics.pageLoadTime < 1000 ? '#52c41a' : '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
            <Statistic
              title="请求总数"
              value={metrics.totalRequests}
              valueStyle={{ fontSize: '14px', color: '#1890ff' }}
              prefix={<DatabaseOutlined />}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600">缓存命中率</span>
              <span className="text-xs font-medium">{metrics.cacheHitRate}%</span>
            </div>
            <Progress 
              percent={metrics.cacheHitRate} 
              size="small"
              strokeColor={metrics.cacheHitRate > 80 ? '#52c41a' : '#fa8c16'}
              showInfo={false}
            />
          </div>
          
          <Descriptions size="small" column={1} className="text-xs">
            <Descriptions.Item label="优化状态">
              <div className="flex items-center space-x-1">
                <RocketOutlined className="text-green-500" />
                <span className="text-green-600">按需加载已启用</span>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="最后更新">
              {metrics.lastUpdated}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>
    </div>
  )
}

export default PerformanceMonitor