'use client'

import React from 'react'
import { Result, Button, Typography, Space } from 'antd'
import { LockOutlined, HomeOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'

const { Title, Paragraph, Text } = Typography

export default function ForbiddenPage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoProfile = () => {
    router.push('/profile')
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/login')
    }
  }

  const handleContactAdmin = () => {
    // 可以打开邮件客户端或跳转到联系页面
    window.location.href = 'mailto:1139804291@qq.com?subject=权限申请&body=我需要申请访问权限'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <Result
          status="403"
          title={
            <Title level={2} className="!text-gray-800 dark:!text-gray-200">
              <LockOutlined className="mr-2" />
              访问被拒绝
            </Title>
          }
          subTitle={
            <div className="space-y-4">
              <Paragraph className="!text-gray-600 dark:!text-gray-400">
                抱歉，您没有权限访问此页面。
              </Paragraph>
              
              {user && (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                  <Text strong className="!text-gray-800 dark:!text-gray-200">
                    当前用户信息：
                  </Text>
                  <div className="mt-2 space-y-1">
                    <div className="!text-gray-600 dark:!text-gray-400">
                      <UserOutlined className="mr-2" />
                      用户：{user.email}
                    </div>
                    <div className="!text-gray-600 dark:!text-gray-400">
                      <SettingOutlined className="mr-2" />
                      角色：{user.role}
                    </div>
                  </div>
                </div>
              )}

              <Paragraph className="!text-gray-500 dark:!text-gray-500 text-sm">
                如果您认为这是错误，请联系系统管理员申请相应权限。
              </Paragraph>
            </div>
          }
          extra={
            <Space direction="vertical" size="middle" className="w-full">
              <Button 
                type="primary" 
                icon={<HomeOutlined />}
                onClick={handleGoHome}
                size="large"
                className="w-full"
              >
                返回首页
              </Button>
              
              {user && (
                <Button 
                  icon={<UserOutlined />}
                  onClick={handleGoProfile}
                  size="large"
                  className="w-full"
                >
                  查看个人资料
                </Button>
              )}
              
              <Button 
                type="dashed"
                onClick={handleContactAdmin}
                size="large"
                className="w-full"
              >
                联系管理员申请权限
              </Button>
              
              <Button 
                type="text"
                onClick={handleLogout}
                size="large"
                className="w-full !text-gray-500 dark:!text-gray-400"
              >
                切换账户
              </Button>
            </Space>
          }
        />
        
        {/* 权限说明 */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Title level={5} className="!text-blue-800 dark:!text-blue-200 !mb-2">
            权限级别说明
          </Title>
          <div className="space-y-2 text-sm">
            <div className="!text-blue-700 dark:!text-blue-300">
              <Text strong>管理员 (admin)：</Text> 完全访问权限
            </div>
            <div className="!text-blue-700 dark:!text-blue-300">
              <Text strong>经理 (manager)：</Text> 监控、服务器、工具、AI、CI/CD
            </div>
            <div className="!text-blue-700 dark:!text-blue-300">
              <Text strong>开发者 (developer)：</Text> 工具、AI、CI/CD
            </div>
            <div className="!text-blue-700 dark:!text-blue-300">
              <Text strong>查看者 (viewer)：</Text> 监控、AI
            </div>
          </div>
        </div>
        
        {/* 联系信息 */}
        <div className="mt-4 text-center">
          <Text type="secondary" className="text-xs">
            技术支持：1139804291@qq.com | 
            <a 
              href="https://wuhrai.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 text-blue-500 hover:text-blue-600"
            >
              wuhrai.com
            </a>
          </Text>
        </div>
      </div>
    </div>
  )
} 