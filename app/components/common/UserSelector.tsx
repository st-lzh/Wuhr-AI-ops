'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Select, Avatar, Space, Typography, Spin } from 'antd'
import { UserOutlined } from '@ant-design/icons'

const { Option } = Select
const { Text } = Typography

// 全局用户缓存
let userCache: { users: User[]; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

interface User {
  id: string
  username: string
  email: string
  role: string
}

interface UserSelectorProps {
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  mode?: 'multiple' | 'tags' | 'single'
  disabled?: boolean
  style?: React.CSSProperties
  allowClear?: boolean
}

const UserSelector: React.FC<UserSelectorProps> = ({
  value,
  onChange,
  placeholder = '选择用户',
  mode = 'multiple',
  disabled = false,
  style,
  allowClear = true
}) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const loadingRef = useRef(false)

  // 加载用户列表
  const loadUsers = async (search?: string) => {
    // 防止重复加载
    if (loadingRef.current) {
      return
    }

    // 如果没有搜索条件，尝试使用缓存
    if (!search && userCache && Date.now() - userCache.timestamp < CACHE_DURATION) {
      console.log('📋 使用缓存的用户列表')
      setUsers(userCache.users)
      return
    }

    loadingRef.current = true
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      params.append('limit', '50')

      console.log('📋 获取用户列表（用于选择器）')
      const response = await fetch(`/api/users?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        const userList = data.data.users || []
        setUsers(userList)

        // 只缓存非搜索结果
        if (!search) {
          userCache = {
            users: userList,
            timestamp: Date.now()
          }
        }

        console.log(`✅ 获取用户列表成功，共 ${userList.length} 个用户`)
      }
    } catch (error) {
      console.error('❌ 加载用户列表失败:', error)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  // 搜索用户
  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (value.length >= 2) {
      loadUsers(value)
    } else if (value.length === 0) {
      loadUsers()
    }
  }

  // 初始化加载
  useEffect(() => {
    // 检查是否已有缓存
    if (userCache && Date.now() - userCache.timestamp < CACHE_DURATION) {
      console.log('📋 使用缓存的用户列表（初始化）')
      setUsers(userCache.users)
    } else {
      loadUsers()
    }
  }, [])

  // 渲染用户选项
  const renderUserOption = (user: User) => (
    <Option key={user.id} value={user.id}>
      <Space>
        <Avatar size="small" icon={<UserOutlined />} />
        <div>
          <Text strong>{user.username}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {user.email} • {user.role}
          </Text>
        </div>
      </Space>
    </Option>
  )

  // 渲染选中的用户标签
  const renderSelectedUser = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) return userId

    return (
      <Space size="small">
        <Avatar size="small" icon={<UserOutlined />} />
        <Text>{user.username}</Text>
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
      loading={loading}
      notFoundContent={loading ? <Spin size="small" /> : '暂无用户'}
      optionLabelProp="label"
      // 使用Antd默认的tag样式，保持与其他选择器一致
      // tagRender={mode === 'multiple' ? ({ label, value, closable, onClose }) => (
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
      //     {renderSelectedUser(value as string)}
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
      {users.map(user => (
        <Option key={user.id} value={user.id} label={user.username}>
          <Space>
            <Avatar size="small" icon={<UserOutlined />} />
            <div>
              <Text strong>{user.username}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {user.email} • {user.role}
              </Text>
            </div>
          </Space>
        </Option>
      ))}
    </Select>
  )
}

export default UserSelector
