'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Switch,
  Typography,
  Row,
  Col,
  message,
  Spin,
  Alert,
  Divider,
  Tag,
  Tooltip,
  Space,
  Button
} from 'antd'
import {
  SecurityScanOutlined,
  LockOutlined,
  UnlockOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

interface SecurityConfig {
  enabled: boolean
  commandValidation: boolean
  privilegedCommandBlocking: boolean
  pathTraversalProtection: boolean
  commandHistory: boolean
  auditLogging: boolean
  rateLimiting: boolean
  sessionTimeout: number
  maxConcurrentSessions: number
}

const SecurityControlPanel: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<SecurityConfig>({
    enabled: true, // 默认开启
    commandValidation: true,
    privilegedCommandBlocking: true,
    pathTraversalProtection: true,
    commandHistory: true,
    auditLogging: true,
    rateLimiting: true,
    sessionTimeout: 3600,
    maxConcurrentSessions: 10
  })

  // 获取安全配置
  const fetchSecurityConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config/security')
      const data = await response.json()
      
      if (data.success) {
        setConfig(data.data)
      } else {
        message.error('获取安全配置失败')
      }
    } catch (error) {
      console.error('获取安全配置失败:', error)
      message.error('获取安全配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存安全配置
  const saveSecurityConfig = async (newConfig: SecurityConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/config/security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success('安全配置保存成功')
        setConfig(newConfig)
      } else {
        message.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存安全配置失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 更新配置项
  const updateConfig = (key: keyof SecurityConfig, value: any) => {
    const newConfig = { ...config, [key]: value }
    setConfig(newConfig)
    saveSecurityConfig(newConfig)
  }

  // 获取安全等级描述
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
      <div className="flex justify-center items-center h-32">
        <Spin size="large" />
      </div>
    )
  }

  const securityLevel = getSecurityLevel()

  return (
    <div className="space-y-4">
      {/* 安全状态总览 */}
      <div className={`p-4 rounded-lg border-2 ${
        config.enabled 
          ? 'border-green-500/30 bg-green-500/10' 
          : 'border-red-500/30 bg-red-500/10'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              config.enabled ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {config.enabled ? (
                <SecurityScanOutlined className="text-2xl text-green-400" />
              ) : (
                <WarningOutlined className="text-2xl text-red-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <Text className={`text-lg font-semibold ${
                  config.enabled ? 'text-green-300' : 'text-red-300'
                }`}>
                  安全防护 {config.enabled ? '已启用' : '已禁用'}
                </Text>
                <Tag color={securityLevel.color}>
                  安全等级: {securityLevel.text}
                </Tag>
              </div>
              <Text className="text-gray-400 text-sm">
                {config.enabled 
                  ? 'kubelet-wuhrai后端安全控制已激活，命令执行受到保护'
                  : '⚠️ 安全防护已关闭，命令执行不受限制'}
              </Text>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchSecurityConfig()}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Switch
              checked={config.enabled}
              onChange={(enabled) => updateConfig('enabled', enabled)}
              loading={saving}
              size="default"
              checkedChildren={<LockOutlined />}
              unCheckedChildren={<UnlockOutlined />}
            />
          </div>
        </div>
      </div>

      {/* 安全功能配置 */}
      <Card title={
        <div className="flex items-center space-x-2">
          <SettingOutlined className="text-blue-400" />
          <span className="text-white">安全功能配置</span>
        </div>
      } className="glass-card">
        {!config.enabled && (
          <Alert
            message="安全防护已禁用"
            description="启用安全防护后，可以配置具体的安全功能。建议保持安全防护开启状态。"
            type="warning"
            showIcon
            className="mb-4"
          />
        )}

        <div className="space-y-4">
          <Row gutter={[24, 16]}>
            {/* 命令验证 */}
            <Col span={12}>
              <div className={`p-4 rounded border ${
                config.commandValidation && config.enabled 
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <SafetyCertificateOutlined className={
                      config.commandValidation && config.enabled ? 'text-green-400' : 'text-gray-400'
                    } />
                    <Text className="text-white font-medium">命令验证</Text>
                  </div>
                  <Switch
                    checked={config.commandValidation}
                    onChange={(checked) => updateConfig('commandValidation', checked)}
                    disabled={!config.enabled}
                    loading={saving}
                    size="small"
                  />
                </div>
                <Text className="text-gray-400 text-xs">
                  验证用户输入的命令格式和语法
                </Text>
              </div>
            </Col>

            {/* 特权命令阻断 */}
            <Col span={12}>
              <div className={`p-4 rounded border ${
                config.privilegedCommandBlocking && config.enabled
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <WarningOutlined className={
                      config.privilegedCommandBlocking && config.enabled ? 'text-green-400' : 'text-gray-400'
                    } />
                    <Text className="text-white font-medium">特权命令阻断</Text>
                  </div>
                  <Switch
                    checked={config.privilegedCommandBlocking}
                    onChange={(checked) => updateConfig('privilegedCommandBlocking', checked)}
                    disabled={!config.enabled}
                    loading={saving}
                    size="small"
                  />
                </div>
                <Text className="text-gray-400 text-xs">
                  阻止执行危险的系统管理命令
                </Text>
              </div>
            </Col>

            {/* 路径遍历保护 */}
            <Col span={12}>
              <div className={`p-4 rounded border ${
                config.pathTraversalProtection && config.enabled
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <LockOutlined className={
                      config.pathTraversalProtection && config.enabled ? 'text-green-400' : 'text-gray-400'
                    } />
                    <Text className="text-white font-medium">路径遍历保护</Text>
                  </div>
                  <Switch
                    checked={config.pathTraversalProtection}
                    onChange={(checked) => updateConfig('pathTraversalProtection', checked)}
                    disabled={!config.enabled}
                    loading={saving}
                    size="small"
                  />
                </div>
                <Text className="text-gray-400 text-xs">
                  防止通过..等方式访问受限目录
                </Text>
              </div>
            </Col>

            {/* 命令历史记录 */}
            <Col span={12}>
              <div className={`p-4 rounded border ${
                config.commandHistory && config.enabled
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircleOutlined className={
                      config.commandHistory && config.enabled ? 'text-green-400' : 'text-gray-400'
                    } />
                    <Text className="text-white font-medium">命令历史记录</Text>
                  </div>
                  <Switch
                    checked={config.commandHistory}
                    onChange={(checked) => updateConfig('commandHistory', checked)}
                    disabled={!config.enabled}
                    loading={saving}
                    size="small"
                  />
                </div>
                <Text className="text-gray-400 text-xs">
                  记录所有执行的命令和结果
                </Text>
              </div>
            </Col>

            {/* 审计日志 */}
            <Col span={12}>
              <div className={`p-4 rounded border ${
                config.auditLogging && config.enabled
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <SafetyCertificateOutlined className={
                      config.auditLogging && config.enabled ? 'text-green-400' : 'text-gray-400'
                    } />
                    <Text className="text-white font-medium">审计日志</Text>
                  </div>
                  <Switch
                    checked={config.auditLogging}
                    onChange={(checked) => updateConfig('auditLogging', checked)}
                    disabled={!config.enabled}
                    loading={saving}
                    size="small"
                  />
                </div>
                <Text className="text-gray-400 text-xs">
                  详细记录用户操作和安全事件
                </Text>
              </div>
            </Col>

            {/* 速率限制 */}
            <Col span={12}>
              <div className={`p-4 rounded border ${
                config.rateLimiting && config.enabled
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <WarningOutlined className={
                      config.rateLimiting && config.enabled ? 'text-green-400' : 'text-gray-400'
                    } />
                    <Text className="text-white font-medium">速率限制</Text>
                  </div>
                  <Switch
                    checked={config.rateLimiting}
                    onChange={(checked) => updateConfig('rateLimiting', checked)}
                    disabled={!config.enabled}
                    loading={saving}
                    size="small"
                  />
                </div>
                <Text className="text-gray-400 text-xs">
                  限制命令执行频率，防止滥用
                </Text>
              </div>
            </Col>
          </Row>
        </div>

        <Divider />

        {/* 安全提示 */}
        <div className="text-center">
          <Text className="text-gray-400 text-sm">
            💡 安全配置会实时同步到kubelet-wuhrai后端，确保命令执行的安全性
          </Text>
        </div>
      </Card>
    </div>
  )
}

export default SecurityControlPanel