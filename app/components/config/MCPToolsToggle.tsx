'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Input,
  Switch,
  Typography,
  message
} from 'antd'
import {
  ApiOutlined,
  SearchOutlined,
  ToolOutlined
} from '@ant-design/icons'

const { Text } = Typography

export interface MCPToolSelection {
  serverId: string
  serverName: string
  toolName: string
  description?: string
}

interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface MCPServer {
  id: string
  name: string
  enabled?: boolean
  tools?: MCPTool[]
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  discoveryEnabled?: boolean
  autoConnect?: boolean
}

interface MCPToolsToggleProps {
  onToolClick?: (tool: MCPToolSelection) => void
}

const MCPToolsToggle: React.FC<MCPToolsToggleProps> = ({ onToolClick }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [config, setConfig] = useState<MCPConfig>({
    enabled: false,
    servers: []
  })

  const enabledServers = useMemo(
    () => config.servers.filter(server => server.enabled !== false),
    [config.servers]
  )
  const discoveredToolCount = useMemo(
    () => enabledServers.reduce((total, server) => total + (server.tools?.length || 0), 0),
    [enabledServers]
  )

  const availableTools = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    return enabledServers.flatMap(server =>
      (server.tools || []).map(tool => ({
        serverId: server.id,
        serverName: server.name,
        toolName: tool.name,
        description: tool.description
      }))
    ).filter(tool => !keyword || [tool.serverName, tool.toolName, tool.description]
      .some(value => value?.toLowerCase().includes(keyword)))
  }, [enabledServers, searchValue])

  // 获取已持久化的 MCP 配置和真实发现结果。
  const fetchMCPConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config/mcp-tools')
      const data = await response.json()

      if (data.success) {
        setConfig({
          ...data.data,
          servers: Array.isArray(data.data?.servers) ? data.data.servers : []
        })
      } else {
        message.error(data.error || '获取MCP配置失败')
      }
    } catch (error) {
      console.error('获取MCP配置失败:', error)
      message.error('获取MCP配置失败')
    } finally {
      setLoading(false)
    }
  }

  const saveMCPConfig = async (newConfig: MCPConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/config/mcp-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      })

      const data = await response.json()
      if (data.success) {
        message.success('MCP工具配置已更新')
        setConfig(newConfig)
        window.dispatchEvent(new CustomEvent('mcp-config-updated', { detail: newConfig }))
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
    return <div className="px-4 py-4 text-center text-sm text-gray-400">正在加载 MCP 工具…</div>
  }

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <div>
          <Text className="block text-gray-300">启用 MCP 工具</Text>
          <Text className="text-xs text-gray-500">未指定工具时由 AI 自动选择</Text>
        </div>
        <Switch
          checked={config.enabled}
          onChange={(enabled) => {
            const newConfig = { ...config, enabled }
            setConfig(newConfig)
            void saveMCPConfig(newConfig)
          }}
          loading={saving}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      </div>

      {config.enabled ? (
        <>
          <div className="rounded border border-gray-600/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Text className="text-sm text-gray-300">当前可用</Text>
              <Badge status={discoveredToolCount > 0 ? 'success' : 'warning'} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">MCP 服务器</span>
              <span className="text-white">{enabledServers.length} 个</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-400">已发现工具</span>
              <span className="text-white">{discoveredToolCount} 个</span>
            </div>
          </div>

          {discoveredToolCount > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Text className="text-sm text-gray-300">选择本次使用的工具</Text>
                <Text className="text-xs text-gray-500">点击后加载到输入框</Text>
              </div>
              <Input
                size="small"
                allowClear
                prefix={<SearchOutlined className="text-gray-500" />}
                placeholder="搜索工具或服务器"
                value={searchValue}
                onChange={event => setSearchValue(event.target.value)}
              />
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {availableTools.length > 0 ? availableTools.map(tool => (
                  <Button
                    key={`${tool.serverId}:${tool.toolName}`}
                    block
                    className="h-auto min-h-12 whitespace-normal px-3 py-2 text-left"
                    onClick={() => onToolClick?.(tool)}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <ToolOutlined className="mt-1 shrink-0 text-purple-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-gray-100">{tool.toolName}</div>
                        <div className="truncate text-xs text-gray-500">
                          {tool.serverName}{tool.description ? ` · ${tool.description}` : ''}
                        </div>
                      </div>
                    </div>
                  </Button>
                )) : (
                  <div className="rounded border border-gray-700 px-3 py-4 text-center text-xs text-gray-400">
                    没有匹配的 MCP 工具
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-gray-400">
              尚未发现可用工具。请先在模型管理的 MCP 工具页测试服务器连接，发现结果会持久化后显示在这里。
            </div>
          )}

          <Button type="link" href="/config/mcp" className="h-auto p-0 text-xs">
            <ApiOutlined /> 管理 MCP 服务器
          </Button>
        </>
      ) : (
        <div className="rounded border border-gray-500/30 bg-gray-900/20 p-3">
          <Text className="text-xs text-gray-400">
            启用后可让 AI 自动选择工具，也可以从这里明确指定本次使用的 MCP 工具。
          </Text>
        </div>
      )}
    </div>
  )
}

export default MCPToolsToggle
