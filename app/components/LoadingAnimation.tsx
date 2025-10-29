'use client'

import React from 'react'
import { Spin } from 'antd'

interface LoadingAnimationProps {
  size?: 'small' | 'default' | 'large'
  text?: string
  className?: string
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ 
  size = 'default', 
  text = '加载中...', 
  className = '' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* 运维风格的动画 */}
      <div className="relative mb-4">
        {/* 外圈旋转动画 */}
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
        
        {/* 内圈反向旋转动画 */}
        <div className="absolute top-2 left-2 w-12 h-12 border-4 border-transparent border-t-green-500 border-r-green-500 rounded-full animate-spin-reverse"></div>
        
        {/* 中心点脉冲动画 */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      
      {/* 加载文本 */}
      <div className="text-gray-600 dark:text-gray-300 font-medium">
        {text}
      </div>
      
      {/* 进度点动画 */}
      <div className="flex space-x-1 mt-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  )
}

// 全屏加载组件
export const FullScreenLoading: React.FC<{ text?: string }> = ({ text = '系统加载中...' }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* 系统Logo动画 */}
      <div className="relative mb-8">
        {/* 主Logo圆环 */}
        <div className="w-24 h-24 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>

        {/* 内部Logo图标 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg overflow-hidden">
            <img
              src="https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/%E5%9B%BE%E6%A0%87/%E5%88%9B%E5%BB%BA%E8%B5%9B%E5%8D%9A%E6%9C%8B%E5%85%8B%E5%9B%BE%E6%A0%87%20%283%29.png"
              alt="Wuhr AI Ops Logo"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                // 如果图片加载失败，显示默认图标
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  `;
                }
              }}
            />
          </div>
        </div>

        {/* 外圈装饰 */}
        <div className="absolute -inset-2 border border-blue-100 rounded-full animate-pulse"></div>
      </div>

      {/* 系统标题 */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Wuhr AI Ops
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          智能运维管理平台
        </p>
      </div>

      {/* 加载文本 */}
      <div className="text-blue-600 dark:text-blue-400 font-medium mb-4">
        正在加载...
      </div>

      {/* 进度点动画 */}
      <div className="flex space-x-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>

      {/* 版本信息 */}
      <div className="mt-8 text-xs text-gray-400 dark:text-gray-500">
        Version 1.0.0 | Powered by AI
      </div>
    </div>
  )
}

// 运维仪表盘风格的加载动画
export const DashboardLoading: React.FC<{ text?: string }> = ({ text = '数据加载中...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* 仪表盘风格的圆形进度 */}
      <div className="relative w-20 h-20 mb-4">
        {/* 背景圆环 */}
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="30"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* 进度圆环 */}
          <circle
            cx="40"
            cy="40"
            r="30"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray="188.4"
            strokeDashoffset="47.1"
            className="text-blue-500 animate-spin"
            strokeLinecap="round"
          />
        </svg>
        
        {/* 中心图标 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 text-blue-500">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div className="text-gray-600 dark:text-gray-300 font-medium text-center">
        {text}
      </div>
    </div>
  )
}

// 登录专用加载动画
export const LoginLoading: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* 服务器连接动画 */}
      <div className="relative mb-4">
        {/* 服务器图标 */}
        <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
          </svg>
        </div>
        
        {/* 连接线动画 */}
        <div className="flex justify-center space-x-1">
          <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
          <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
          <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '600ms' }}></div>
          <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '800ms' }}></div>
        </div>
        
        {/* 用户图标 */}
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mt-2 mx-auto">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      </div>
      
      <div className="text-blue-600 font-medium">
        正在验证身份...
      </div>
    </div>
  )
}
