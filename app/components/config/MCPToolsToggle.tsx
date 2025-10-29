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
  ToolOutlined,
  SettingOutlined
} from '@ant-design/icons'

const { Text } = Typography

interface MCPConfig {
  enabled: boolean
  servers: any[]
}

const MCPToolsToggle: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<MCPConfig>({
    enabled: false,
    servers: []
  })

  // 获取MCP配置
  const fetchMCPConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config/mcp-tools')
      const data = await response.json()
      
      if (data.success) {
        setConfig(data.data)
      } else {
        console.error('获取MCP配置失败')
      }
    } catch (error) {
      console.error('获取MCP配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存MCP配置
  const saveMCPConfig = async (newConfig: MCPConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/config/mcp-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success('MCP工具配置已更新')
        setConfig(newConfig)
      } else {
        message.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存MCP配置失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchMCPConfig()
  }, [])

  if (loading) {
    return (
      <div className="px-4 py-4 flex justify-center">
        <Spin />
      </div>
    )
  }

  return (
    <div className="px-4 space-y-4">
      <div className="flex items-center justify-between">
        <Text className="text-gray-300">启用MCP工具</Text>
        <Switch
          checked={config.enabled}
          onChange={(enabled) => {
            const newConfig = { ...config, enabled }
            setConfig(newConfig)
            saveMCPConfig(newConfig)
          }}
          loading={saving}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      </div>

      {/* 当前配置状态 */}
      {config.enabled && (
        <div className="mt-4 p-3 rounded border border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <Text className="text-gray-300 text-sm">当前状态</Text>
            <Badge
              status="success"
              text={<span className="text-green-400 text-xs">已启用</span>}
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">MCP服务器:</span>
              <span className="text-white">{config.servers.length} 个</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">可用工具:</span>
              <span className="text-white">
                {config.servers.reduce((total, server) => total + (server.tools?.length || 0), 0)} 个
              </span>
            </div>
            {config.servers.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 text-xs mb-1">启用的服务器:</div>
                <div className="text-white text-xs flex flex-wrap gap-1">
                  {config.servers.filter(server => server.enabled !== false).map((server, index) => (
                    <span key={index} className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                      {server.name || `Server ${index + 1}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 配置提示 */}
      {!config.enabled && (
        <div className="mt-4 p-3 bg-gray-900/20 border border-gray-500/30 rounded">
          <Text className="text-gray-400 text-xs">
            启用后可使用已配置的MCP工具。前往<Button type="link" size="small" className="p-0 h-auto text-blue-400">模型管理</Button>配置MCP服务器
          </Text>
        </div>
      )}
    </div>
  )
}

export default MCPToolsToggle