'use client'

import React from 'react'
import { Result, Button } from 'antd'
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full">
        <Result
          status="404"
          title={<span className="text-white">404</span>}
          subTitle={
            <span className="text-gray-300">
              抱歉，您访问的页面不存在
            </span>
          }
          extra={
            <div className="space-y-3">
              <Button 
                type="primary" 
                icon={<HomeOutlined />}
                onClick={() => router.push('/')}
                className="bg-blue-600 hover:bg-blue-700 border-blue-600"
              >
                返回首页
              </Button>
              <Button 
                icon={<ArrowLeftOutlined />}
                onClick={() => router.back()}
                className="text-gray-300 border-gray-600 hover:text-white hover:border-gray-500"
              >
                返回上一页
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
