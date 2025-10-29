'use client'

import React from 'react'
import { RobotOutlined, CloudServerOutlined, ApiOutlined } from '@ant-design/icons'

interface AILoadingAnimationProps {
  className?: string
}

const AILoadingAnimation: React.FC<AILoadingAnimationProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Animated DevOps icons */}
      <div className="flex space-x-2">
        <div className="w-6 h-6 flex items-center justify-center animate-float">
          <RobotOutlined
            className="text-blue-400 animate-pulse"
            style={{
              animationDuration: '1.5s',
              animationDelay: '0s'
            }}
          />
        </div>
        <div className="w-6 h-6 flex items-center justify-center animate-float">
          <CloudServerOutlined
            className="text-green-400 animate-pulse"
            style={{
              animationDuration: '1.5s',
              animationDelay: '0.3s'
            }}
          />
        </div>
        <div className="w-6 h-6 flex items-center justify-center animate-float">
          <ApiOutlined
            className="text-purple-400 animate-pulse"
            style={{
              animationDuration: '1.5s',
              animationDelay: '0.6s'
            }}
          />
        </div>
      </div>

      {/* Animated text with gradient */}
      <div className="flex items-center space-x-2">
        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent font-medium">
          Wuhr AI 正在分析
        </span>
        
        {/* Animated dots */}
        <div className="flex space-x-1">
          <div 
            className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
            style={{ animationDelay: '0s', animationDuration: '1.4s' }}
          ></div>
          <div 
            className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}
          ></div>
          <div 
            className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}
          ></div>
        </div>
      </div>

      {/* Animated progress bar */}
      <div className="flex-1 max-w-32">
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full animate-pulse">
            <div className="h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default AILoadingAnimation
