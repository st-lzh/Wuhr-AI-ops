'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Spin,
  Divider,
  Avatar,
  Upload,
  Modal
} from 'antd'
import {
  UserOutlined,
  SaveOutlined,
  EyeOutlined,
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  KeyOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CameraOutlined
} from '@ant-design/icons'
import MainLayout from '../components/layout/MainLayout'
import { useGlobalState } from '../contexts/GlobalStateContext'

const { Title, Text } = Typography

interface UserProfile {
  id: string
  username: string
  email: string
  role: string
  permissions: string[]
  isActive: boolean
  approvalStatus: string
  phone?: string
  department?: string
  realName?: string
  avatar?: string
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const SettingsPage: React.FC = () => {
  const { dispatch } = useGlobalState()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)

  // 获取当前用户资料
  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/profile')
      const data = await response.json()
      
      if (data.success) {
        const userProfile = data.data.user
        setProfile(userProfile)

        // 设置表单初始值
        form.setFieldsValue({
          username: userProfile.username,
          email: userProfile.email,
          phone: userProfile.phone || '',
          department: userProfile.department || '',
          realName: userProfile.realName || ''
        })
      } else {
        message.error('获取用户资料失败')
      }
    } catch (error) {
      console.error('获取用户资料失败:', error)
      message.error('获取用户资料失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存用户资料
  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values)
      })

      const data = await response.json()

      if (data.success) {
        message.success('个人资料更新成功')
        const updatedProfile = { ...profile, ...values }
        setProfile(updatedProfile)
        
        // 更新全局状态中的用户信息
        dispatch({
          type: 'AUTH_UPDATE_USER',
          payload: values
        })

        // 触发全局用户信息更新事件
        window.dispatchEvent(new CustomEvent('userProfileUpdated', {
          detail: values
        }))
      } else {
        message.error(data.error || '更新失败')
      }
    } catch (error) {
      console.error('更新用户资料失败:', error)
      message.error('更新失败')
    } finally {
      setSaving(false)
    }
  }

  // 上传头像
  const handleAvatarUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)

    setAvatarLoading(true)
    try {
      const response = await fetch('/api/auth/profile/avatar', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        message.success('头像更新成功')
        const updatedProfile = profile ? { ...profile, avatar: data.data.avatarUrl } : null
        setProfile(updatedProfile)
        
        // 更新全局状态中的用户头像
        dispatch({
          type: 'AUTH_UPDATE_USER',
          payload: { avatar: data.data.avatarUrl }
        })

        // 触发全局头像更新事件
        window.dispatchEvent(new CustomEvent('avatarUpdated', {
          detail: { avatarUrl: data.data.avatarUrl }
        }))
      } else {
        message.error(data.error || '头像上传失败')
      }
    } catch (error) {
      console.error('头像上传失败:', error)
      message.error('头像上传失败')
    } finally {
      setAvatarLoading(false)
    }
    
    return false // 阻止默认上传行为
  }

  // 上传前的验证
  const beforeUpload = (file: File) => {
    const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    if (!isValidType) {
      message.error('仅支持 JPG、PNG、GIF、WebP 格式的图片')
      return false
    }

    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      message.error('图片大小不能超过 5MB')
      return false
    }

    // 调用上传处理函数
    handleAvatarUpload(file)
    return false
  }

  // 修改密码
  const handleChangePassword = async (values: PasswordForm) => {
    try {
      setPasswordLoading(true)
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success('密码修改成功')
        passwordForm.resetFields()
      } else {
        message.error(result.error || '密码修改失败')
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      message.error('修改密码失败')
    } finally {
      setPasswordLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </MainLayout>
    )
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <Text type="secondary">无法获取用户资料</Text>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex justify-between items-center">
          <div>
            <Title level={2} className="!mb-2">
              个人设置
            </Title>
            <Text type="secondary">
              编辑您的个人信息和偏好设置
            </Text>
          </div>
          <Button 
            icon={<EyeOutlined />}
            onClick={() => window.location.href = '/profile'}
          >
            查看资料
          </Button>
        </div>

        <Row gutter={24}>
          {/* 基本信息编辑 */}
          <Col span={16}>
            <Card title="基本信息" className="mb-6">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                autoComplete="off"
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="用户名"
                      name="username"
                      rules={[
                        { required: true, message: '请输入用户名' },
                        { min: 3, message: '用户名至少3个字符' },
                        { max: 20, message: '用户名最多20个字符' }
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder="请输入用户名"
                        disabled // 用户名通常不允许修改
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="realName"
                      label="真实姓名"
                      rules={[
                        { max: 50, message: '姓名不能超过50个字符' }
                      ]}
                    >
                      <Input placeholder="请输入真实姓名" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="邮箱地址"
                      name="email"
                      rules={[
                        { required: true, message: '请输入邮箱地址' },
                        { type: 'email', message: '请输入有效的邮箱地址' }
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined />}
                        placeholder="请输入邮箱地址"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="phone"
                      label="联系电话"
                      rules={[
                        { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
                      ]}
                    >
                      <Input 
                        prefix={<PhoneOutlined />}
                        placeholder="请输入联系电话"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="department"
                  label="所属部门"
                >
                  <Input placeholder="请输入所属部门" />
                </Form.Item>

                <Form.Item className="mb-0">
                  <Space>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={saving}
                    >
                      保存更改
                    </Button>
                    <Button
                      onClick={() => form.resetFields()}
                      disabled={saving}
                    >
                      重置
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>

            {/* 修改密码 */}
            <Card title="修改密码">
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
                autoComplete="off"
              >
                <Form.Item
                  name="currentPassword"
                  label="当前密码"
                  rules={[
                    { required: true, message: '请输入当前密码' }
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="请输入当前密码"
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>

                <Form.Item
                  name="newPassword"
                  label="新密码"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { min: 8, message: '密码至少8个字符' },
                    { 
                      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, 
                      message: '密码必须包含大小写字母和数字' 
                    }
                  ]}
                >
                  <Input.Password
                    prefix={<KeyOutlined />}
                    placeholder="请输入新密码（至少8位，包含大小写字母和数字）"
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  label="确认新密码"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: '请确认新密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('两次输入的密码不一致'))
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<KeyOutlined />}
                    placeholder="请再次输入新密码"
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>

                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={passwordLoading}
                    icon={<LockOutlined />}
                  >
                    修改密码
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* 头像和其他设置 */}
          <Col span={8}>
            <Card title="头像设置" className="mb-6">
              <div className="text-center">
                <Avatar
                  size={120}
                  src={profile.avatar}
                  icon={<UserOutlined />}
                  className="mb-4"
                />
                <div>
                  <Upload
                    showUploadList={false}
                    beforeUpload={beforeUpload}
                    accept="image/*"
                  >
                    <Button 
                      icon={<CameraOutlined />}
                      loading={avatarLoading}
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? '上传中...' : '更换头像'}
                    </Button>
                  </Upload>
                  <div className="text-xs text-gray-500 mt-2">
                    支持 JPG、PNG、GIF、WebP 格式，最大 5MB
                  </div>
                </div>
              </div>
            </Card>

            <Card title="安全设置">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Text>两步验证</Text>
                  <Text type="secondary">未启用</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text>登录设备管理</Text>
                  <Button type="link" size="small">
                    查看设备
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <Text>账户安全等级</Text>
                  <Text type="warning">中等</Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  )
}

export default SettingsPage
