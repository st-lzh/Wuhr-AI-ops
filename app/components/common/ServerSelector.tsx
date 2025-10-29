'use client'

import React, { useState, useEffect } from 'react'
import { Select, Avatar, Space, Typography, Spin, Tag } from 'antd'
import { CloudServerOutlined } from '@ant-design/icons'

const { Option } = Select
const { Text } = Typography

interface Server {
  id: string
  name: string
  hostname: string
  ip: string
  status: string
  environment: string
  tags?: string[]
}

interface ServerSelectorProps {
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  mode?: 'multiple' | 'tags' | 'single'
  disabled?: boolean
  style?: React.CSSProperties
  allowClear?: boolean
  environment?: string // 过滤特定环境的主机
}

const ServerSelector: React.FC<ServerSelectorProps> = ({
  value,
  onChange,
  placeholder = '选择部署主机',
  mode = 'multiple',
  disabled = false,
  style,
  allowClear = true,
  environment
}) => {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [statusChecking, setStatusChecking] = useState(false)

  // 实时检查服务器状态
  const checkServerStatus = async (serverIds: string[]) => {
    if (serverIds.length === 0) return

    setStatusChecking(true)
    try {
      const response = await fetch(`/api/servers/status?ids=${serverIds.join(',')}`)
      const data = await response.json()

      if (data.success && data.data?.servers) {
        // 更新服务器状态
        setServers(prevServers =>
          prevServers.map(server => {
            const updatedServer = data.data.servers.find((s: any) => s.id === server.id)
            return updatedServer ? { ...server, ...updatedServer } : server
          })
        )
      }
    } catch (error) {
      console.error('检查服务器状态失败:', error)
    } finally {
      setStatusChecking(false)
    }
  }

  // 加载主机列表
  const loadServers = async (search?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      if (environment) {
        params.append('environment', environment)
      }
      params.append('limit', '100')
      
      const response = await fetch(`/api/servers?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        const servers = data.data.servers || []
        setServers(servers)

        // 加载完成后检查服务器状态
        const serverIds = servers.map((s: any) => s.id)
        if (serverIds.length > 0) {
          setTimeout(() => checkServerStatus(serverIds), 500)
        }
      }
    } catch (error) {
      console.error('加载主机列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 搜索主机
  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (value.length >= 2) {
      loadServers(value)
    } else if (value.length === 0) {
      loadServers()
    }
  }

  // 初始化加载
  useEffect(() => {
    loadServers()
  }, [environment])

  // 定时检查服务器状态
  useEffect(() => {
    if (servers.length === 0) return

    const serverIds = servers.map(s => s.id)

    // 立即检查一次状态
    checkServerStatus(serverIds)

    // 每60秒检查一次状态
    const interval = setInterval(() => {
      checkServerStatus(serverIds)
    }, 60000)

    return () => clearInterval(interval)
  }, [servers.length])

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'green'
      case 'offline': return 'red'
      case 'maintenance': return 'orange'
      case 'warning': return 'orange'
      case 'error': return 'red'
      default: return 'default'
    }
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return '在线'
      case 'offline': return '离线'
      case 'maintenance': return '维护中'
      case 'warning': return '警告'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  // 获取环境颜色
  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'prod': return 'red'
      case 'test': return 'orange'
      case 'dev': return 'blue'
      default: return 'default'
    }
  }

  // 渲染主机选项
  const renderServerOption = (server: Server) => (
    <Option key={server.id} value={server.id}>
      <Space>
        <Avatar 
          size="small" 
          icon={<CloudServerOutlined />}
          style={{ backgroundColor: getStatusColor(server.status) }}
        />
        <div>
          <Text strong>{server.name}</Text>
          <br />
          <Space size="small">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {server.hostname} ({server.ip})
            </Text>
            <Tag color={getEnvironmentColor(server.environment)}>
              {server.environment}
            </Tag>
            <Tag color={getStatusColor(server.status)}>
              {getStatusText(server.status)}
            </Tag>
          </Space>
        </div>
      </Space>
    </Option>
  )

  // 渲染选中的主机标签
  const renderSelectedServer = (serverId: string) => {
    const server = servers.find(s => s.id === serverId)
    if (!server) return serverId

    return (
      <Space size="small">
        <Avatar 
          size="small" 
          icon={<CloudServerOutlined />}
          style={{ backgroundColor: getStatusColor(server.status) }}
        />
        <Text>{server.name}</Text>
        <Tag color={getEnvironmentColor(server.environment)}>
          {server.environment}
        </Tag>
      </Space>
    )
  }

  return (
    <Select
      mode={mode === 'single' ? undefined : mode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      allowClear={allowClear}
      showSearch
      filterOption={false}
      onSearch={handleSearch}
      loading={loading || statusChecking}
      notFoundContent={loading ? <Spin size="small" /> : statusChecking ? '检查状态中...' : '暂无主机'}
      optionLabelProp="label"
      // 使用Antd默认的tag样式，保持与其他选择器一致
      // tagRender={mode === 'multiple' || mode === 'tags' ? ({ label, value, closable, onClose }) => (
      //   <div
      //     style={{
      //       display: 'inline-flex',
      //       alignItems: 'center',
      //       padding: '2px 8px',
      //       margin: '2px',
      //       background: '#f0f0f0',
      //       borderRadius: '4px',
      //       fontSize: '12px'
      //     }}
      //   >
      //     {renderSelectedServer(value as string)}
      //     {closable && (
      //       <span
      //         style={{ marginLeft: '4px', cursor: 'pointer' }}
      //         onClick={onClose}
      //       >
      //         ×
      //       </span>
      //     )}
      //   </div>
      // ) : undefined}
    >
      {servers.map(server => (
        <Option key={server.id} value={server.id} label={server.name}>
          <Space>
            <Avatar 
              size="small" 
              icon={<CloudServerOutlined />}
              style={{ backgroundColor: getStatusColor(server.status) }}
            />
            <div>
              <Text strong>{server.name}</Text>
              <br />
              <Space size="small">
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {server.hostname} ({server.ip})
                </Text>
                <Tag color={getEnvironmentColor(server.environment)}>
                  {server.environment}
                </Tag>
                <Tag color={getStatusColor(server.status)}>
                  {getStatusText(server.status)}
                </Tag>
              </Space>
            </div>
          </Space>
        </Option>
      ))}
    </Select>
  )
}

export default ServerSelector
