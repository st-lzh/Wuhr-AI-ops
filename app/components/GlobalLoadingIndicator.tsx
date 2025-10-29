'use client'

import React from 'react'
import { Spin, Progress } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { useLoading } from '../hooks/useLoading'

interface GlobalLoadingIndicatorProps {
  className?: string
}

const GlobalLoadingIndicator: React.FC<GlobalLoadingIndicatorProps> = ({ className }) => {
  const { loading, hasAnyLoading, getLoadingKeys } = useLoading()

  // 如果没有任何加载状态，不显示指示器
  if (!loading && !hasAnyLoading()) {
    return null
  }

  const loadingKeys = getLoadingKeys()
  const hasMultipleLoading = loadingKeys.length > 1

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      {/* 顶部进度条 */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-green-500">
        <Progress
          percent={100}
          showInfo={false}
          status="active"
          strokeColor={{
            from: '#3b82f6',
            to: '#10b981',
          }}
          className="h-1"
        />
      </div>

      {/* 加载详情（开发模式下显示） */}
      {process.env.NODE_ENV === 'development' && hasMultipleLoading && (
        <div className="absolute top-2 right-4 bg-black/80 text-white text-xs px-2 py-1 rounded">
          <div className="flex items-center space-x-2">
            <Spin
              indicator={<LoadingOutlined className="text-blue-400" spin />}
              size="small"
            />
            <span>
              {loadingKeys.length} 个操作进行中
            </span>
          </div>
          <div className="mt-1 space-y-1">
            {loadingKeys.slice(0, 3).map(key => (
              <div key={key} className="text-gray-300">
                • {key}
              </div>
            ))}
            {loadingKeys.length > 3 && (
              <div className="text-gray-400">
                ... 还有 {loadingKeys.length - 3} 个
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalLoadingIndicator 