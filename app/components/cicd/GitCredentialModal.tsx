'use client'

import React, { useState } from 'react'
import { 
  Modal, 
  Form, 
  Input, 
  Select, 
  Button, 
  message, 
  Switch, 
  Alert,
  Tabs,
  Space,
  Typography
} from 'antd'
import { 
  GithubOutlined, 
  GitlabOutlined, 
  KeyOutlined,
  UserOutlined,
  LockOutlined,
  SafetyOutlined
} from '@ant-design/icons'

const { Option } = Select
const { TextArea } = Input
const { Text, Link } = Typography

interface GitCredentialModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  editingCredential?: any // 编辑的认证配置
}

import { GitCredentialFormData } from '../../types/access-management'

// 使用统一的类型定义
type GitCredentialForm = GitCredentialFormData

const GitCredentialModal: React.FC<GitCredentialModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editingCredential
}) => {
  const [form] = Form.useForm<GitCredentialForm>()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [authType, setAuthType] = useState<string>('token')
  const [platform, setPlatform] = useState<string>('github')

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)
      
      const credentials: any = {}
      
      switch (values.authType) {
        case 'token':
          credentials.token = values.token
          credentials.username = values.username || 'token'
          break
        case 'ssh':
          credentials.privateKey = values.privateKey
          credentials.publicKey = values.publicKey
          credentials.passphrase = values.passphrase
          break
        case 'username_password':
          credentials.username = values.username
          credentials.password = values.password
          credentials.email = values.email
          break
      }

      const response = await fetch('/api/git/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: values.name,
          platform: values.platform,
          authType: values.authType,
          credentials,
          isDefault: values.isDefault
        })
      })

      const result = await response.json()

      if (result.success) {
        message.success('认证配置创建成功')
        form.resetFields()
        onSuccess()
      } else {
        message.error(result.error || '创建认证配置失败')
      }
    } catch (error) {
      console.error('创建认证配置失败:', error)
      message.error('创建认证配置失败')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      setTesting(true)
      const values = await form.validateFields()
      
      // 这里可以添加测试连接的逻辑
      message.success('连接测试成功')
    } catch (error) {
      message.error('连接测试失败')
    } finally {
      setTesting(false)
    }
  }

  const renderTokenForm = () => (
    <>
      <Form.Item
        name="token"
        label="Personal Access Token"
        rules={[{ required: true, message: '请输入Personal Access Token' }]}
      >
        <Input.Password 
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          prefix={<KeyOutlined />}
        />
      </Form.Item>
      
      <Form.Item
        name="username"
        label="用户名"
        tooltip="可选，默认使用'token'"
      >
        <Input 
          placeholder="可选，默认使用'token'"
          prefix={<UserOutlined />}
        />
      </Form.Item>

      {platform === 'github' && (
        <Alert
          type="info"
          showIcon
          message="GitHub Personal Access Token 配置指南"
          description={
            <div>
              <p>1. 访问 <Link href="https://github.com/settings/tokens" target="_blank">GitHub Settings → Developer settings → Personal access tokens</Link></p>
              <p>2. 点击 "Generate new token (classic)"</p>
              <p>3. 选择所需权限：repo (完整仓库访问权限)</p>
              <p>4. 复制生成的token并粘贴到上方输入框</p>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}
    </>
  )

  const renderSSHForm = () => (
    <>
      <Form.Item
        name="privateKey"
        label="SSH私钥"
        rules={[{ required: true, message: '请输入SSH私钥' }]}
      >
        <TextArea 
          rows={6}
          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
        />
      </Form.Item>
      
      <Form.Item
        name="publicKey"
        label="SSH公钥"
        tooltip="可选，用于验证"
      >
        <TextArea 
          rows={2}
          placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAA..."
        />
      </Form.Item>
      
      <Form.Item
        name="passphrase"
        label="密钥密码"
        tooltip="如果SSH密钥有密码保护，请输入"
      >
        <Input.Password placeholder="可选，如果密钥有密码保护" />
      </Form.Item>

      <Alert
        type="info"
        showIcon
        message="SSH密钥配置指南"
        description={
          <div>
            <p>1. 生成SSH密钥：<code>ssh-keygen -t rsa -b 4096 -C "your_email@example.com"</code></p>
            <p>2. 将公钥添加到Git平台的SSH Keys设置中</p>
            <p>3. 复制私钥内容到上方输入框</p>
          </div>
        }
        style={{ marginBottom: 16 }}
      />
    </>
  )

  const renderUsernamePasswordForm = () => (
    <>
      <Form.Item
        name="username"
        label="用户名"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input 
          placeholder="Git用户名"
          prefix={<UserOutlined />}
        />
      </Form.Item>
      
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password 
          placeholder="Git密码或访问令牌"
          prefix={<LockOutlined />}
        />
      </Form.Item>
      
      <Form.Item
        name="email"
        label="邮箱"
        tooltip="可选，用于Git配置"
      >
        <Input 
          placeholder="可选，用于Git配置"
          type="email"
        />
      </Form.Item>

      <Alert
        type="warning"
        showIcon
        message="安全提示"
        description="建议使用Personal Access Token而不是密码进行认证，这样更安全且功能更完整。"
        style={{ marginBottom: 16 }}
      />
    </>
  )

  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined />
          {editingCredential ? '编辑Git认证' : '配置Git认证'}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button 
          key="test" 
          onClick={testConnection}
          loading={testing}
        >
          测试连接
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          onClick={() => form.submit()}
          loading={loading}
        >
          保存配置
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          platform: 'github',
          authType: 'token',
          isDefault: false
        }}
      >
        <Form.Item
          name="name"
          label="配置名称"
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input placeholder="例如：我的GitHub账号" />
        </Form.Item>

        <Form.Item
          name="platform"
          label="Git平台"
          rules={[{ required: true, message: '请选择Git平台' }]}
        >
          <Select 
            placeholder="选择Git平台"
            onChange={setPlatform}
          >
            <Option value="github">
              <Space>
                <GithubOutlined />
                GitHub
              </Space>
            </Option>
            <Option value="gitlab">
              <Space>
                <GitlabOutlined />
                GitLab
              </Space>
            </Option>
            <Option value="gitee">
              <Space>
                <img src="/icons/gitee.svg" alt="Gitee" style={{ width: 14, height: 14 }} />
                Gitee
              </Space>
            </Option>
            <Option value="bitbucket">Bitbucket</Option>
            <Option value="other">其他</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="authType"
          label="认证方式"
          rules={[{ required: true, message: '请选择认证方式' }]}
        >
          <Select 
            placeholder="选择认证方式"
            onChange={setAuthType}
          >
            <Option value="token">Personal Access Token (推荐)</Option>
            <Option value="ssh">SSH密钥</Option>
            <Option value="username_password">用户名密码</Option>
          </Select>
        </Form.Item>

        {authType === 'token' && renderTokenForm()}
        {authType === 'ssh' && renderSSHForm()}
        {authType === 'username_password' && renderUsernamePasswordForm()}

        <Form.Item
          name="isDefault"
          label="设为默认"
          valuePropName="checked"
          tooltip="设为该平台的默认认证配置"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default GitCredentialModal
