'use client'

import React, { useState, useEffect } from 'react'
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Typography,
  Alert,
  Tooltip
} from 'antd'
import {
  SafetyOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  GithubOutlined,
  GitlabOutlined,
  KeyOutlined,
  UserOutlined,
  LockOutlined
} from '@ant-design/icons'
import GitCredentialModal from './GitCredentialModal'

const { Text } = Typography

interface GitCredential {
  id: string
  name: string
  platform: string
  authType: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface GitCredentialManagerProps {
  visible: boolean
  onCancel: () => void
  onSuccess?: () => void
}

const GitCredentialManager: React.FC<GitCredentialManagerProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [credentials, setCredentials] = useState<GitCredential[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editingCredential, setEditingCredential] = useState<GitCredential | null>(null)

  // 加载认证配置列表
  const loadCredentials = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/git/credentials')
      const result = await response.json()
      
      if (result.success) {
        setCredentials(result.data || [])
      } else {
        message.error(result.error || '加载认证配置失败')
      }
    } catch (error) {
      console.error('加载认证配置失败:', error)
      message.error('加载认证配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除认证配置
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/git/credentials/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success('认证配置删除成功')
        loadCredentials() // 重新加载列表
        onSuccess?.() // 通知父组件更新
      } else {
        message.error(result.error || '删除认证配置失败')
      }
    } catch (error) {
      console.error('删除认证配置失败:', error)
      message.error('删除认证配置失败')
    }
  }

  // 设置默认认证配置
  const handleSetDefault = async (id: string, isDefault: boolean) => {
    try {
      const response = await fetch(`/api/git/credentials/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isDefault: !isDefault })
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success(isDefault ? '已取消默认设置' : '已设为默认配置')
        loadCredentials() // 重新加载列表
        onSuccess?.() // 通知父组件更新
      } else {
        message.error(result.error || '设置默认配置失败')
      }
    } catch (error) {
      console.error('设置默认配置失败:', error)
      message.error('设置默认配置失败')
    }
  }

  // 获取平台图标
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'github': return <GithubOutlined />
      case 'gitlab': return <GitlabOutlined />
      default: return <SafetyOutlined />
    }
  }

  // 获取认证类型图标
  const getAuthTypeIcon = (authType: string) => {
    switch (authType) {
      case 'token': return <KeyOutlined />
      case 'ssh': return <SafetyOutlined />
      case 'username_password': return <UserOutlined />
      default: return <LockOutlined />
    }
  }

  // 获取认证类型显示名称
  const getAuthTypeDisplayName = (authType: string) => {
    switch (authType) {
      case 'token': return 'Personal Access Token'
      case 'ssh': return 'SSH密钥'
      case 'username_password': return '用户名密码'
      default: return authType
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: GitCredential) => (
        <Space>
          {getPlatformIcon(record.platform)}
          <Text strong>{name}</Text>
          {record.isDefault && (
            <Tag color="orange" icon={<StarFilled />}>
              默认
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color="blue">
          {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </Tag>
      )
    },
    {
      title: '认证方式',
      dataIndex: 'authType',
      key: 'authType',
      render: (authType: string) => (
        <Space>
          {getAuthTypeIcon(authType)}
          <Text>{getAuthTypeDisplayName(authType)}</Text>
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: GitCredential) => (
        <Space>
          <Tooltip title={record.isDefault ? '取消默认' : '设为默认'}>
            <Button
              type="text"
              size="small"
              icon={record.isDefault ? <StarFilled /> : <StarOutlined />}
              onClick={() => handleSetDefault(record.id, record.isDefault)}
              style={{ color: record.isDefault ? '#faad14' : undefined }}
            />
          </Tooltip>
          
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingCredential(record)
                setCreateModalVisible(true)
              }}
            />
          </Tooltip>
          
          <Popconfirm
            title="确认删除"
            description={`确定要删除认证配置"${record.name}"吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okType="danger"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 初始化加载
  useEffect(() => {
    if (visible) {
      loadCredentials()
    }
  }, [visible])

  return (
    <>
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            Git认证配置管理
          </Space>
        }
        open={visible}
        onCancel={onCancel}
        width={800}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingCredential(null)
                setCreateModalVisible(true)
              }}
            >
              新增认证配置
            </Button>
            <Button
              icon={<SafetyOutlined />}
              onClick={loadCredentials}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>

        <Alert
          message="认证配置说明"
          description="认证配置用于访问私有Git仓库。您可以为不同的Git平台配置多个认证信息，并设置默认配置。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={credentials}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个配置`
          }}
        />
      </Modal>

      {/* 创建/编辑认证配置模态框 */}
      <GitCredentialModal
        visible={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          setEditingCredential(null)
        }}
        onSuccess={() => {
          setCreateModalVisible(false)
          setEditingCredential(null)
          loadCredentials() // 重新加载列表
          onSuccess?.() // 通知父组件更新
        }}
        editingCredential={editingCredential}
      />
    </>
  )
}

export default GitCredentialManager
