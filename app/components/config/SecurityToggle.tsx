'use client'

import React, { useState, useEffect } from 'react'
import {
  Switch,
  Typography,
  Badge,
  message,
  Spin,
  Button
} from 'antd'
import {
  SecurityScanOutlined,
  SettingOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons'

const { Text } = Typography

interface SecurityConfig {
  enabled: boolean
  requireApproval: boolean  // 🔥 新增: 命令执行询问
  commandValidation: boolean
  privilegedCommandBlocking: boolean
  pathTraversalProtection: boolean
  commandHistory: boolean
  auditLogging: boolean
  rateLimiting: boolean
}

const SecurityToggle: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<SecurityConfig>({
    enabled: true,
    requireApproval: true,  // 🔥 新增: 默认启用命令执行询问
    commandValidation: true,
    privilegedCommandBlocking: true,
    pathTraversalProtection: true,
    commandHistory: true,
    auditLogging: true,
    rateLimiting: true
  })

  // 获取安全配置
  const fetchSecurityConfig = async () => {
    setLoading(true)
    try {
      // 🔥 从后端API获取配置
      const response = await fetch('/api/config/security')
      const data = await response.json()

      if (data.success && data.data) {
        const backendConfig = data.data
        setConfig(backendConfig)
        console.log('🔐 已从后端加载安全配置:', backendConfig)
      }
    } catch (error) {
      console.error('获取安全配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存安全配置
  const saveSecurityConfig = async (newConfig: SecurityConfig) => {
    setSaving(true)
    try {
      // 🔥 保存到后端
      const response = await fetch('/api/config/security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      })

      const data = await response.json()

      if (data.success) {
        message.success('安全配置已更新')
        setConfig(newConfig)

        // 🔥 同时更新localStorage，确保下次发送消息时使用最新配置
        localStorage.setItem('securityConfig', JSON.stringify(newConfig))
        console.log('🔐 安全配置已保存到后端和localStorage:', newConfig)
      } else {
        throw new Error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存安全配置失败:', error)
      message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  // 获取安全等级
  const getSecurityLevel = () => {
    const enabledFeatures = Object.values(config).filter(Boolean).length
    const totalFeatures = Object.keys(config).length - 2 // 排除 sessionTimeout 和 maxConcurrentSessions
    const percentage = (enabledFeatures / totalFeatures) * 100

    if (percentage >= 80) return { level: 'high', color: 'green', text: '高' }
    if (percentage >= 50) return { level: 'medium', color: 'orange', text: '中' }
    return { level: 'low', color: 'red', text: '低' }
  }

  useEffect(() => {
    fetchSecurityConfig()
  }, [])

  if (loading) {
    return (
      <div className="px-4 py-4 flex justify-center">
        <Spin />
      </div>
    )
  }

  const securityLevel = getSecurityLevel()

  return (
    <div className="space-y-4">
      {/* 安全防护 */}
      <div className="flex items-center justify-between">
        <Text className="text-gray-300">安全防护</Text>
        <Switch
          checked={config.enabled}
          onChange={(enabled) => {
            const newConfig = { ...config, enabled }
            setConfig(newConfig)
            saveSecurityConfig(newConfig)
          }}
          loading={saving}
          checkedChildren={<LockOutlined />}
          unCheckedChildren={<UnlockOutlined />}
        />
      </div>

      {/* 命令执行询问 */}
      {config.enabled && (
        <div className="flex items-center justify-between">
          <Text className="text-gray-300">命令执行询问</Text>
          <Switch
            checked={config.requireApproval}
            onChange={(requireApproval) => {
              const newConfig = { ...config, requireApproval }
              setConfig(newConfig)
              saveSecurityConfig(newConfig)
            }}
            loading={saving}
            checkedChildren={<LockOutlined />}
            unCheckedChildren={<UnlockOutlined />}
          />
        </div>
      )}

      {/* 其他安全功能 */}
      {config.enabled && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <Text className="text-gray-300">命令验证</Text>
              <Switch
                size="small"
                checked={config.commandValidation}
                onChange={(commandValidation) => {
                  const newConfig = { ...config, commandValidation }
                  setConfig(newConfig)
                  saveSecurityConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
            <div className="flex items-center justify-between">
              <Text className="text-gray-300">特权命令阻断</Text>
              <Switch
                size="small"
                checked={config.privilegedCommandBlocking}
                onChange={(privilegedCommandBlocking) => {
                  const newConfig = { ...config, privilegedCommandBlocking }
                  setConfig(newConfig)
                  saveSecurityConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
            <div className="flex items-center justify-between">
              <Text className="text-gray-300">路径遍历保护</Text>
              <Switch
                size="small"
                checked={config.pathTraversalProtection}
                onChange={(pathTraversalProtection) => {
                  const newConfig = { ...config, pathTraversalProtection }
                  setConfig(newConfig)
                  saveSecurityConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
            <div className="flex items-center justify-between">
              <Text className="text-gray-300">审计日志</Text>
              <Switch
                size="small"
                checked={config.auditLogging}
                onChange={(auditLogging) => {
                  const newConfig = { ...config, auditLogging }
                  setConfig(newConfig)
                  saveSecurityConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
            <div className="flex items-center justify-between">
              <Text className="text-gray-300">速率限制</Text>
              <Switch
                size="small"
                checked={config.rateLimiting}
                onChange={(rateLimiting) => {
                  const newConfig = { ...config, rateLimiting }
                  setConfig(newConfig)
                  saveSecurityConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
          </div>
        </div>
      )}

      {/* 配置提示 */}
      {!config.enabled && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
          <Text className="text-red-400 text-xs">
            ⚠️ 安全防护已关闭，命令执行不受限制
          </Text>
        </div>
      )}
    </div>
  )
}

export default SecurityToggle