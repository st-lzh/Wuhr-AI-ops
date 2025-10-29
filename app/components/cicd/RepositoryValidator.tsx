'use client'

import React, { useState, useEffect } from 'react'
import { 
  Form, 
  Input, 
  Select, 
  Button, 
  Alert, 
  Space, 
  Typography, 
  Tag, 
  Spin,
  Card,
  List,
  Tooltip,
  message
} from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  BranchesOutlined,
  CodeOutlined,
  FileTextOutlined,
  SettingOutlined,
  ReloadOutlined,
  SafetyOutlined
} from '@ant-design/icons'
import GitCredentialModal from './GitCredentialModal'
import GitCredentialManager from './GitCredentialManager'
import { RepositoryInfo, ProjectDetectionResult } from '../../types/project-template'

const { Text, Title } = Typography
const { Option } = Select

interface RepositoryValidatorProps {
  form: any
  onValidationComplete?: (repositoryInfo: RepositoryInfo, detection?: ProjectDetectionResult, gitCredentialId?: string) => void
  initialUrl?: string
  initialType?: string
}

const RepositoryValidator: React.FC<RepositoryValidatorProps> = ({
  form,
  onValidationComplete,
  initialUrl = '',
  initialType = 'git'
}) => {
  const [validating, setValidating] = useState(false)
  const [repositoryInfo, setRepositoryInfo] = useState<RepositoryInfo | null>(null)
  const [detection, setDetection] = useState<ProjectDetectionResult | null>(null)
  const [lastValidatedUrl, setLastValidatedUrl] = useState('')
  const [repositoryUrl, setRepositoryUrl] = useState(initialUrl)
  const [credentialModalVisible, setCredentialModalVisible] = useState(false)
  const [credentialManagerVisible, setCredentialManagerVisible] = useState(false)
  const [credentials, setCredentials] = useState<any[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | undefined>()

  // 处理仓库地址输入变化
  const handleRepositoryUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRepositoryUrl(value)

    // 同步更新表单字段
    form.setFieldsValue({ repositoryUrl: value })

    // 如果URL变化且与上次验证的URL不同，清除验证结果
    if (value !== lastValidatedUrl && repositoryInfo) {
      setRepositoryInfo(null)
      setDetection(null)
    }
  }

  // 获取用户的Git认证配置
  const fetchCredentials = async () => {
    try {
      const response = await fetch('/api/git/credentials')
      const result = await response.json()
      if (result.success) {
        setCredentials(result.data)
      }
    } catch (error) {
      console.error('获取认证配置失败:', error)
    }
  }

  // 组件初始化时获取认证配置
  useEffect(() => {
    fetchCredentials()
  }, [])

  // 监听URL变化，自动清除验证结果
  useEffect(() => {
    const currentUrl = form.getFieldValue('repositoryUrl')
    if (currentUrl !== lastValidatedUrl && repositoryInfo) {
      setRepositoryInfo(null)
      setDetection(null)
    }
  }, [form.getFieldValue('repositoryUrl')])

  // 验证仓库
  const validateRepository = async () => {
    try {
      const url = repositoryUrl.trim()
      const type = form.getFieldValue('repositoryType') || 'git'

      if (!url) {
        message.warning('请先输入仓库地址')
        return
      }

      setValidating(true)
      setRepositoryInfo(null)
      setDetection(null)

      const response = await fetch('/api/cicd/projects/validate-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          type,
          credentialId: selectedCredentialId
        })
      })

      const result = await response.json()

      if (result.success) {
        const { repositoryInfo: repoInfo, detection: detectionResult } = result.data
        setRepositoryInfo(repoInfo)
        setDetection(detectionResult)
        setLastValidatedUrl(url)

        // 如果验证成功，自动填充分支信息
        if (repoInfo.accessible && repoInfo.defaultBranch) {
          form.setFieldsValue({
            branch: repoInfo.defaultBranch
          })
        }

        // 回调通知父组件，包含Git认证配置ID
        if (onValidationComplete) {
          onValidationComplete(repoInfo, detectionResult, selectedCredentialId)
        }

        if (repoInfo.accessible) {
          message.success('仓库验证成功')
        } else {
          message.error(repoInfo.error || '仓库验证失败')
        }
      } else {
        message.error(result.error || '验证请求失败')
      }
    } catch (error) {
      console.error('仓库验证失败:', error)
      message.error('验证请求失败')
    } finally {
      setValidating(false)
    }
  }

  // 渲染验证状态
  const renderValidationStatus = () => {
    if (!repositoryInfo) return null

    const { accessible, error, branches, projectType, packageManager, hasDockerfile, hasCI } = repositoryInfo

    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Space>
            {accessible ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            )}
            <Text strong>
              {accessible ? '仓库验证成功' : '仓库验证失败'}
            </Text>
          </Space>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"

            style={{ marginBottom: 12 }}
          />
        )}

        {accessible && (
          <div>
            {/* 分支信息 */}
            {branches && branches.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Space>
                  <BranchesOutlined />
                  <Text type="secondary">可用分支:</Text>
                  {branches.slice(0, 3).map(branch => (
                    <Tag key={branch}>{branch}</Tag>
                  ))}
                  {branches.length > 3 && (
                    <Tooltip title={branches.slice(3).join(', ')}>
                      <Tag>+{branches.length - 3}</Tag>
                    </Tooltip>
                  )}
                </Space>
              </div>
            )}

            {/* 项目信息 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {projectType && (
                <Tag icon={<CodeOutlined />} color="blue">
                  {projectType}
                </Tag>
              )}
              {packageManager && (
                <Tag icon={<SettingOutlined />} color="green">
                  {packageManager}
                </Tag>
              )}
              {hasDockerfile && (
                <Tag icon={<FileTextOutlined />} color="purple">
                  Docker
                </Tag>
              )}
              {hasCI && (
                <Tag color="orange">
                  CI/CD
                </Tag>
              )}
            </div>
          </div>
        )}
      </Card>
    )
  }

  // 渲染检测结果
  const renderDetectionResult = () => {
    if (!detection || !detection.suggestions.length) return null

    return (
      <Card 
        size="small" 
        title="项目类型检测结果" 
        style={{ marginTop: 16 }}
      >
        <List
          size="small"
          dataSource={detection.suggestions}
          renderItem={(suggestion) => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <span>{suggestion.template.icon}</span>
                    <Text strong>{suggestion.template.name}</Text>
                    <Tag color="blue">
                      {Math.round(suggestion.confidence * 100)}% 匹配
                    </Tag>
                  </Space>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {suggestion.reason}
                </Text>
              </div>
            </List.Item>
          )}
        />

        {detection.frameworks.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">检测到的技术栈: </Text>
            {detection.frameworks.map(framework => (
              <Tag key={framework}>{framework}</Tag>
            ))}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="repository-validator">
      <Form.Item
        name="repositoryUrl"
        label="仓库地址"
        rules={[
          { required: true, message: '请输入仓库地址' },
          { type: 'url', message: '请输入有效的URL地址' }
        ]}
      >
        <Input
          placeholder="输入Git仓库地址，如: https://github.com/user/repo.git"
          value={repositoryUrl}
          onChange={handleRepositoryUrlChange}
          suffix={
            <Button
              type="text"
              size="small"
              icon={validating ? <LoadingOutlined /> : <ReloadOutlined />}
              onClick={validateRepository}
              loading={validating}
              disabled={!repositoryUrl || !repositoryUrl.trim()}
            >
              验证
            </Button>
          }
        />
      </Form.Item>

      {/* 认证配置选择 */}
      <Space style={{ width: '100%', marginBottom: 16 }} direction="vertical">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyOutlined style={{ color: '#1890ff' }} />
          <Text strong>认证配置</Text>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setCredentialModalVisible(true)}
          >
            新增认证
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => setCredentialManagerVisible(true)}
          >
            管理认证
          </Button>
        </div>

        <Select
          placeholder="选择认证配置（可选，用于私有仓库）"
          allowClear
          value={selectedCredentialId}
          onChange={setSelectedCredentialId}
          style={{ width: '100%' }}
        >
          {credentials.map((cred: any) => (
            <Option key={cred.id} value={cred.id}>
              <Space>
                <SafetyOutlined />
                {cred.name}
                <Tag color="blue">{cred.platform}</Tag>
                <Tag color="green">{cred.authType === 'token' ? 'Token' : cred.authType === 'ssh' ? 'SSH' : '用户名密码'}</Tag>
                {cred.isDefault && <Tag color="orange">默认</Tag>}
              </Space>
            </Option>
          ))}
        </Select>
      </Space>

      <Form.Item
        name="repositoryType"
        label="仓库类型"
        initialValue={initialType}
      >
        <Select placeholder="选择仓库类型">
          <Option value="git">Git</Option>
          <Option value="svn">SVN</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="branch"
        label="默认分支"
        rules={[{ required: true, message: '请输入分支名称' }]}
      >
        <Select
          placeholder="选择或输入分支名称"
          showSearch
          allowClear

          notFoundContent={validating ? <Spin size="small" /> : '输入分支名称'}
        >
          {repositoryInfo?.branches?.map(branch => (
            <Option key={branch} value={branch}>
              {branch}
              {branch === repositoryInfo.defaultBranch && (
                <Tag style={{ marginLeft: 8 }}>默认</Tag>
              )}
            </Option>
          ))}
        </Select>
      </Form.Item>

      {/* 验证状态显示 */}
      {renderValidationStatus()}

      {/* 检测结果显示 */}
      {renderDetectionResult()}

      {/* 帮助信息 */}
      <Alert
        message="仓库验证说明"
        description={
          <div>
            <p>• 验证功能会检查仓库的可访问性和基本信息</p>
            <p>• 支持 GitHub、GitLab、Gitee 等主流代码托管平台</p>
            <p>• 会自动检测项目类型并推荐合适的构建配置</p>
            <p>• 私有仓库需要配置认证信息才能访问</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />

      {/* Git认证配置模态框 */}
      <GitCredentialModal
        visible={credentialModalVisible}
        onCancel={() => setCredentialModalVisible(false)}
        onSuccess={() => {
          setCredentialModalVisible(false)
          fetchCredentials() // 重新获取认证配置列表
        }}
      />

      {/* Git认证配置管理器 */}
      <GitCredentialManager
        visible={credentialManagerVisible}
        onCancel={() => setCredentialManagerVisible(false)}
        onSuccess={() => {
          fetchCredentials() // 重新获取认证配置列表
        }}
      />
    </div>
  )
}

export default RepositoryValidator
