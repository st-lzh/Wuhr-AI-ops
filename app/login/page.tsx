'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Form, Input, Button, Card, Typography, Space, message, Divider } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { LoginLoading, FullScreenLoading } from '../components/LoadingAnimation'

const { Title, Text, Link } = Typography

interface LoginFormData {
  email: string
  password: string
}

// 登录表单组件（包装useSearchParams）
function LoginForm() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true) // 页面初始加载状态
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, user } = useAuth()

  // 获取返回地址
  const returnUrl = searchParams.get('returnUrl') || '/'

  // 页面加载完成后显示登录表单
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false)
    }, 1500) // 1.5秒后显示登录表单

    return () => clearTimeout(timer)
  }, [])

  // 如果已登录，重定向
  useEffect(() => {
    if (user) {
      router.push(returnUrl)
    }
  }, [user, router, returnUrl])

  const handleLogin = async (values: LoginFormData) => {
    setLoading(true)
    try {
      // 使用email作为username传递给login函数
      await login({ username: values.email, password: values.password })

      // 显示登录成功消息
      message.success('登录成功！正在跳转...')

      // 清除退出标记，确保认证状态持久化
      sessionStorage.removeItem('user_logged_out')

      // 🔥 新增: 设置刚登录标记和时间戳，防止AuthInitializer立即清除状态
      sessionStorage.setItem('just_logged_in', 'true')
      sessionStorage.setItem('login_timestamp', Date.now().toString())

      // 使用 window.location.href 强制刷新跳转，确保状态完全更新
      window.location.href = returnUrl
      
    } catch (error: any) {
      console.error('Login error:', error)

      // 为审批相关的错误提供更友好的提示
      let errorMessage = error.message || '登录失败，请检查用户名和密码'

      if (errorMessage.includes('等待管理员审批')) {
        message.error({
          content: errorMessage,
          duration: 6,
          style: { marginTop: '20vh' }
        })
      } else if (errorMessage.includes('审批被拒绝')) {
        message.error({
          content: errorMessage,
          duration: 8,
          style: { marginTop: '20vh' }
        })
      } else {
        message.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterClick = () => {
    const registerUrl = `/register${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`
    router.push(registerUrl)
  }

  // 如果页面正在加载，显示加载动画
  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <FullScreenLoading />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card
        className="w-full max-w-md shadow-xl animate-fade-in"
        styles={{
          body: { padding: '2rem' }
        }}
      >
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <img 
            src="https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/%E5%9B%BE%E6%A0%87/%E5%88%9B%E5%BB%BA%E8%B5%9B%E5%8D%9A%E6%9C%8B%E5%85%8B%E5%9B%BE%E6%A0%87%20%283%29.png"
            alt="Wuhr AI Logo"
            className="w-16 h-16 mx-auto mb-4"
          />
          <Title level={2} className="!mb-2">
            Wuhr AI Ops
          </Title>
          <Text type="secondary">
            运维工程师的AI助手平台
          </Text>
        </div>

        {/* 登录表单 */}
        <Form
          form={form}
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="邮箱地址"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
              iconRender={(visible) => 
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item className="!mb-6">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-12 text-lg font-medium"
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <Divider>或</Divider>

        {/* 注册链接 */}
        <div className="text-center">
          <Text type="secondary">
            还没有账户？{' '}
            <Link onClick={handleRegisterClick} className="font-medium">
              立即注册
            </Link>
          </Text>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center space-y-2">
            <Text type="secondary" className="text-xs">
              技术支持：
              <a 
                href="mailto:1139804291@qq.com" 
                className="text-blue-500 hover:text-blue-600 ml-1"
              >
                1139804291@qq.com
              </a>
            </Text>
            <div className="flex justify-center space-x-4 text-xs">
              <a 
                href="https://wuhrai.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                博客
              </a>
              <a
                href="https://github.com/st-lzh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                GitHub
              </a>
              <a 
                href="https://gpt.wuhrai.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                AI聊天
              </a>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// 主页面组件（使用Suspense包装）
export default function LoginPage() {
  return (
    <Suspense fallback={<FullScreenLoading text="系统初始化中..." />}>
      <LoginForm />
    </Suspense>
  )
}