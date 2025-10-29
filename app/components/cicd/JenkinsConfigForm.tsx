'use client'

import React, { useState, useEffect } from 'react'
import {
  Form,
  Input,
  Button,
  Select,
  Space,
  Alert,
  message,
  Card,
  Typography,
  Divider
} from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons'

const { Option } = Select
const { TextArea } = Input
const { Text } = Typography

interface JenkinsConfigFormProps {
  initialValues?: any
  onSubmit: (values: any) => Promise<void>
  onCancel: () => void
  loading?: boolean
  mode?: 'create' | 'edit'
}

interface Project {
  id: string
  name: string
}

const JenkinsConfigForm: React.FC<JenkinsConfigFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  mode = 'create'
}) => {
  const [form] = Form.useForm()
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{
    status: 'none' | 'success' | 'error'
    message?: string
    details?: any
  }>({ status: 'none' })

  // 加载项目列表
  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const response = await fetch('/api/cicd/projects?limit=100')
      const data = await response.json()
      
      if (data.success) {
        setProjects(data.data.projects || [])
      } else {
        message.error('加载项目列表失败')
      }
    } catch (error) {
      console.error('加载项目列表失败:', error)
      message.error('加载项目列表失败')
    } finally {
      setLoadingProjects(false)
    }
  }

  // 测试Jenkins连接
  const testConnection = async () => {
    try {
      const values = await form.validateFields(['serverUrl', 'username', 'apiToken'])
      
      setTestingConnection(true)
      setConnectionStatus({ status: 'none' })

      const response = await fetch('/api/cicd/jenkins/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serverUrl: values.serverUrl,
          username: values.username,
          apiToken: values.apiToken
        })
      })

      const data = await response.json()

      if (data.success) {
        setConnectionStatus({
          status: 'success',
          message: '连接测试成功',
          details: data.data
        })
        message.success('Jenkins连接测试成功')
      } else {
        setConnectionStatus({
          status: 'error',
          message: data.error || '连接测试失败'
        })
        message.error(data.error || '连接测试失败')
      }
    } catch (error) {
      console.error('连接测试失败:', error)
      setConnectionStatus({
        status: 'error',
        message: '连接测试异常'
      })
      message.error('连接测试异常')
    } finally {
      setTestingConnection(false)
    }
  }

  // 表单提交
  const handleSubmit = async (values: any) => {
    try {
      await onSubmit(values)
    } catch (error) {
      console.error('提交失败:', error)
    }
  }

  // 初始化
  useEffect(() => {
    loadProjects()
    
    if (initialValues) {
      form.setFieldsValue(initialValues)
    }
  }, [initialValues])

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={initialValues}
    >
      <Form.Item
        label="项目"
        name="projectId"
        rules={[{ required: true, message: '请选择项目' }]}
      >
        <Select
          placeholder="选择项目"
          loading={loadingProjects}
          disabled={mode === 'edit'}
        >
          {projects.map(project => (
            <Option key={project.id} value={project.id}>
              {project.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        label="配置名称"
        name="name"
        rules={[{ required: true, message: '请输入配置名称' }]}
      >
        <Input placeholder="例如：Web项目Jenkins" />
      </Form.Item>

      <Form.Item
        label="描述"
        name="description"
      >
        <TextArea 
          placeholder="配置描述（可选）"
          rows={2}
        />
      </Form.Item>

      <Divider>Jenkins服务器配置</Divider>

      <Form.Item
        label="Jenkins服务器URL"
        name="serverUrl"
        rules={[
          { required: true, message: '请输入Jenkins服务器URL' },
          { type: 'url', message: '请输入有效的URL' }
        ]}
      >
        <Input placeholder="https://jenkins.example.com" />
      </Form.Item>

      <Form.Item
        label="用户名"
        name="username"
        rules={[{ required: true, message: '请输入Jenkins用户名' }]}
      >
        <Input placeholder="Jenkins用户名" />
      </Form.Item>

      <Form.Item
        label="API Token"
        name="apiToken"
        rules={[{ required: true, message: '请输入Jenkins API Token' }]}
      >
        <Input.Password placeholder="Jenkins API Token" />
      </Form.Item>

      <Form.Item
        label="作业名称"
        name="jobName"
      >
        <Input placeholder="Jenkins作业名称（可选）" />
      </Form.Item>

      <Form.Item
        label="Webhook URL"
        name="webhookUrl"
        rules={[{ type: 'url', message: '请输入有效的URL' }]}
      >
        <Input placeholder="Webhook回调URL（可选）" />
      </Form.Item>

      {/* 连接测试区域 */}
      <Card size="small" className="mb-4">
        <div className="flex justify-between items-center">
          <Text>连接测试</Text>
          <Button
            type="default"
            onClick={testConnection}
            loading={testingConnection}
            icon={testingConnection ? <LoadingOutlined /> : undefined}
          >
            测试连接
          </Button>
        </div>
        
        {connectionStatus.status !== 'none' && (
          <div className="mt-3">
            {connectionStatus.status === 'success' && (
              <Alert
                type="success"
                message={connectionStatus.message}
                description={
                  connectionStatus.details && (
                    <div>
                      <div>Jenkins版本: {connectionStatus.details.version}</div>
                      <div>作业数量: {connectionStatus.details.jobCount}</div>
                      {connectionStatus.details.user && (
                        <div>当前用户: {connectionStatus.details.user}</div>
                      )}
                    </div>
                  )
                }
                icon={<CheckCircleOutlined />}
                showIcon
              />
            )}
            
            {connectionStatus.status === 'error' && (
              <Alert
                type="error"
                message={connectionStatus.message}
                icon={<ExclamationCircleOutlined />}
                showIcon
              />
            )}
          </div>
        )}
      </Card>

      {/* 表单操作按钮 */}
      <Form.Item>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
          >
            {mode === 'create' ? '创建配置' : '保存修改'}
          </Button>
          <Button onClick={onCancel}>
            取消
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default JenkinsConfigForm
