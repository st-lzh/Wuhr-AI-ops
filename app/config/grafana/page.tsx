'use client'

import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Switch, 
  Space, 
  message, 
  Typography, 
  Divider,
  Alert,
  Spin
} from 'antd'
import { 
  SettingOutlined, 
  ExperimentOutlined, 
  SaveOutlined, 
  LinkOutlined,
  UserOutlined,
  LockOutlined,
  KeyOutlined
} from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import { apiClient } from '../../utils/apiClient'

const { Title, Text } = Typography

interface GrafanaConfig {
  serverUrl: string
  username: string
  password?: string
  apiKey?: string
  orgId: number
  enabled: boolean
}

export default function GrafanaConfigPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [config, setConfig] = useState<GrafanaConfig | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  // 获取Grafana配置
  const fetchConfig = async () => {
    if (hasInitialized) {
      return
    }
    
    try {
      setLoading(true)
      console.log('🔧 开始获取Grafana配置')
      const response = await apiClient.get('/api/grafana/config')
      const data = response.data as any
      
      if (data.success) {
        console.log('🔧 Grafana配置获取成功:', data.data)
        setConfig(data.data.config)
        setIsConfigured(data.data.isConfigured)
        
        if (data.data.config) {
          form.setFieldsValue(data.data.config)
        }
      } else {
        console.log('🔧 Grafana配置不存在，显示空白表单')
        setConfig(null)
        setIsConfigured(false)
      }
    } catch (error: any) {
      console.error('🔧 获取Grafana配置时发生错误:', error)
      
      if (error.response?.status >= 500) {
        console.error('获取Grafana配置失败:', error)
        if (!hasInitialized) {
          message.error('服务器错误，无法获取Grafana配置')
        }
      } else {
        console.log('🔧 Grafana配置不存在，显示空白表单')
        setConfig(null)
        setIsConfigured(false)
      }
    } finally {
      setLoading(false)
      setHasInitialized(true)
    }
  }

  // 保存配置
  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      console.log('💾 保存Grafana配置:', values)
      
      const response = await apiClient.post('/api/grafana/config', values)
      const data = response.data as any
      
      if (data.success) {
        message.success('Grafana配置保存成功')
        setConfig(values)
        setIsConfigured(true)
        
        // 重新获取配置以确保数据同步
        setTimeout(() => {
          fetchConfig()
        }, 1000)
      } else {
        message.error(data.error || '保存配置失败')
      }
    } catch (error) {
      console.error('保存Grafana配置失败:', error)
      message.error('保存配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 测试连接
  const handleTestConnection = async () => {
    try {
      setTestingConnection(true)
      const values = form.getFieldsValue()
      
      console.log('🔗 测试Grafana连接:', values)
      
      const response = await apiClient.post('/api/grafana/test', values)
      const data = response.data as any
      
      if (data.success) {
        message.success('Grafana连接测试成功')
      } else {
        message.error(data.error || 'Grafana连接测试失败')
      }
    } catch (error) {
      console.error('Grafana连接测试失败:', error)
      message.error('连接测试失败')
    } finally {
      setTestingConnection(false)
    }
  }

  // 删除配置
  const handleDelete = async () => {
    try {
      setLoading(true)
      
      const response = await apiClient.delete('/api/grafana/config')
      const data = response.data as any
      
      if (data.success) {
        message.success('Grafana配置删除成功')
        setConfig(null)
        setIsConfigured(false)
        form.resetFields()
      } else {
        message.error(data.error || '删除配置失败')
      }
    } catch (error) {
      console.error('删除Grafana配置失败:', error)
      message.error('删除配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasInitialized) {
      fetchConfig()
    }
  }, [hasInitialized])

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <Title level={2}>
            <SettingOutlined className="mr-2" />
            Grafana服务器配置
          </Title>
          <Text type="secondary">
            配置Grafana服务器连接信息，用于监控数据可视化
          </Text>
        </div>

        {isConfigured && (
          <Alert
            message="Grafana已配置"
            description="Grafana服务器连接已配置完成，可以正常使用监控功能。"
            type="success"
            showIcon
            className="mb-6"
          />
        )}

        <Card title="基本配置" className="mb-6">
          <Spin spinning={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              initialValues={{
                orgId: 1,
                enabled: true
              }}
            >
              <Form.Item
                name="serverUrl"
                label="服务器地址"
                rules={[
                  { required: true, message: '请输入Grafana服务器地址' },
                  { type: 'url', message: '请输入有效的URL地址' }
                ]}
              >
                <Input 
                  prefix={<LinkOutlined />}
                  placeholder="http://localhost:3000" 
                />
              </Form.Item>

              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input 
                  prefix={<UserOutlined />}
                  placeholder="admin" 
                />
              </Form.Item>

              <Form.Item
                name="orgId"
                label="组织ID"
                rules={[{ required: true, message: '请输入组织ID' }]}
              >
                <Input 
                  type="number"
                  placeholder="1" 
                />
              </Form.Item>

              <Divider>认证方式</Divider>
              
              <Text type="secondary" className="block mb-4">
                选择一种认证方式：使用密码或API密钥
              </Text>

              <Form.Item
                name="password"
                label="密码"
              >
                <Input.Password 
                  prefix={<LockOutlined />}
                  placeholder="留空则使用API密钥认证" 
                />
              </Form.Item>

              <Form.Item
                name="apiKey"
                label="API密钥"
              >
                <Input.Password 
                  prefix={<KeyOutlined />}
                  placeholder="留空则使用密码认证" 
                />
              </Form.Item>

              <Form.Item
                name="enabled"
                label="启用Grafana"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                    size="large"
                  >
                    保存配置
                  </Button>
                  
                  <Button
                    icon={<ExperimentOutlined />}
                    onClick={handleTestConnection}
                    loading={testingConnection}
                    size="large"
                  >
                    测试连接
                  </Button>

                  {isConfigured && (
                    <Button
                      danger
                      onClick={handleDelete}
                      loading={loading}
                      size="large"
                    >
                      删除配置
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </Spin>
        </Card>

        <Card title="配置说明" size="small">
          <Space direction="vertical" size="small">
            <Text>• <strong>服务器地址</strong>：Grafana服务器的完整URL地址</Text>
            <Text>• <strong>用户名</strong>：Grafana管理员用户名</Text>
            <Text>• <strong>组织ID</strong>：Grafana组织ID，默认为1</Text>
            <Text>• <strong>认证方式</strong>：可以使用密码或API密钥，推荐使用API密钥</Text>
            <Text>• <strong>API密钥获取</strong>：登录Grafana → Configuration → API Keys → New API Key</Text>
          </Space>
        </Card>
      </div>
    </MainLayout>
  )
}
