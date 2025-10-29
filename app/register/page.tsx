'use client'

import React, { useState, Suspense } from 'react'
import { Form, Input, Button, Card, Typography, Space, message, Divider, Alert } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FullScreenLoading } from '../components/LoadingAnimation'

const { Title, Text } = Typography

interface RegisterFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  realName: string
  reason: string
}

// 注册表单组件
function RegisterForm() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // 获取返回地址
  const returnUrl = searchParams.get('returnUrl') || '/login'

  const handleRegister = async (values: RegisterFormData) => {
    console.log('📝 前端注册表单数据:', values)

    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }

    // 验证所有必需字段
    if (!values.username || !values.email || !values.password || !values.realName || !values.reason) {
      message.error('请填写所有必需字段')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          confirmPassword: values.confirmPassword,
          realName: values.realName,
          reason: values.reason
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSubmitted(true)
        message.success('注册申请已提交，请等待管理员审批')
      } else {
        console.error('❌ 注册失败:', data)

        // 如果有详细的验证错误信息，显示具体错误
        if (data.details) {
          try {
            const errors = JSON.parse(data.details)
            if (Array.isArray(errors) && errors.length > 0) {
              // 为每个字段显示具体的错误信息
              errors.forEach(err => {
                let fieldName = ''
                switch(err.field) {
                  case 'username': fieldName = '用户名'; break
                  case 'email': fieldName = '邮箱'; break
                  case 'password': fieldName = '密码'; break
                  case 'confirmPassword': fieldName = '确认密码'; break
                  case 'realName': fieldName = '真实姓名'; break
                  case 'reason': fieldName = '申请理由'; break
                  default: fieldName = err.field
                }
                message.error(`${fieldName}：${err.message}`)
              })
            } else {
              message.error(data.error || data.message || '注册失败')
            }
          } catch {
            message.error(data.error || data.message || '注册失败')
          }
        } else {
          message.error(data.error || data.message || '注册失败')
        }
      }
    } catch (error: any) {
      console.error('❌ 注册请求错误:', error)
      message.error(error.message || '注册失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card
          className="w-full max-w-md shadow-xl animate-fade-in"
          styles={{
            body: { padding: '2rem' }
          }}
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <Title level={3} className="!mb-2">申请已提交</Title>
            <Text type="secondary">
              您的注册申请已成功提交，请等待管理员审批。
              <br />
              审批结果将通过邮件通知您。
            </Text>
          </div>

          <div className="space-y-4">
            <Button
              type="primary"
              block
              onClick={() => router.push('/login')}
            >
              返回登录
            </Button>
            <Button
              block
              onClick={() => setSubmitted(false)}
            >
              重新申请
            </Button>
          </div>
        </Card>
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
        <div className="text-center mb-6">
          <Title level={2} className="!mb-2">账户注册</Title>
          <Text type="secondary">申请加入 Wuhr AI Ops 平台</Text>
        </div>

        <Alert
          message="注册须知"
          description="所有注册申请需要管理员审批，请如实填写信息并说明申请理由。"
          type="info"
          showIcon
          className="mb-6"
        />

        <Form
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="realName"
            label="真实姓名"
            rules={[
              { required: true, message: '请输入真实姓名' },
              { min: 2, message: '姓名至少2个字符' },
              { max: 10, message: '姓名最多10个字符' }
            ]}
          >
            <Input
              placeholder="请输入真实姓名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱地址"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱地址"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8个字符' },
              { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '密码必须包含大小写字母和数字' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              size="large"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入密码"
              size="large"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请理由（至少10个字符）"
            rules={[
              { required: true, message: '请说明申请理由' },
              { min: 10, message: '申请理由至少10个字符' },
              { max: 200, message: '申请理由最多200个字符' }
            ]}
          >
            <Input.TextArea
              placeholder="请详细说明您申请使用本平台的理由，例如：工作需要、学习目的、项目开发等（至少10个字符）"
              rows={4}
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item className="!mb-6">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-12 text-lg font-medium"
            >
              {loading ? '提交中...' : '提交申请'}
            </Button>
          </Form.Item>
        </Form>

        <Divider>或</Divider>

        {/* 登录链接 */}
        <div className="text-center">
          <Text type="secondary">
            已有账户？{' '}
            <Link href="/login" className="font-medium text-blue-500 hover:text-blue-600">
              立即登录
            </Link>
          </Text>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <Text type="secondary" className="text-xs">
              注册即表示您同意我们的服务条款和隐私政策
            </Text>
          </div>
        </div>
      </Card>
    </div>
  )
}

// 主页面组件（使用Suspense包装）
export default function RegisterPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <RegisterForm />
    </Suspense>
  )
}