'use client'

import React, { useState, useEffect } from 'react'
import {
  Switch,
  Typography,
  Badge,
  Spin,
  Button,
  message
} from 'antd'
import {
  CodeOutlined,
  SettingOutlined
} from '@ant-design/icons'

const { Text } = Typography

interface CustomToolsConfig {
  enabled: boolean
  tools: any[]
}

interface CustomToolsToggleProps {
  onToolClick?: (toolName: string) => void  // 🔧 新增：点击工具名称的回调
}

const CustomToolsToggle: React.FC<CustomToolsToggleProps> = ({ onToolClick }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<CustomToolsConfig>({
    enabled: false,
    tools: []
  })

  // 获取自定义工具配置
  const fetchCustomToolsConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config/custom-tools')
      const data = await response.json()
      
      if (data.success) {
        setConfig(data.data)
      } else {
        console.error('获取自定义工具配置失败')
      }
    } catch (error) {
      console.error('获取自定义工具配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存自定义工具配置
  const saveCustomToolsConfig = async (newConfig: CustomToolsConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/config/custom-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success('自定义工具配置已更新')
        setConfig(newConfig)
        window.dispatchEvent(new CustomEvent('custom-tools-config-updated', { detail: newConfig }))
      } else {
        message.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存自定义工具配置失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchCustomToolsConfig()
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
        <Text className="text-gray-300">启用自定义工具</Text>
        <Switch
          checked={config.enabled}
          onChange={(enabled) => {
            const newConfig = { ...config, enabled }
            setConfig(newConfig)
            saveCustomToolsConfig(newConfig)
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
              <span className="text-gray-400">配置工具:</span>
              <span className="text-white">{config.tools.length} 个</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">活跃工具:</span>
              <span className="text-white">
                {config.tools.filter(tool => tool.isActive).length} 个
              </span>
            </div>
            {config.tools.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 text-xs mb-1">已启用的工具 (点击复制到输入框):</div>
                <div className="text-white text-xs flex flex-wrap gap-1">
                  {config.tools.filter(tool => tool.isActive !== false).map((tool, index) => (
                    <span
                      key={index}
                      className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded text-xs cursor-pointer hover:bg-cyan-500/40 transition-colors"
                      onClick={() => {
                        if (onToolClick) {
                          onToolClick(tool.name || `Tool ${index + 1}`)
                        }
                      }}
                    >
                      {tool.name || `Tool ${index + 1}`}
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
            启用后可使用已配置的自定义工具。前往<Button type="link" href="/config/tools" size="small" className="p-0 h-auto text-blue-400">自定义工具</Button>完成配置
          </Text>
          <div className="mt-2 p-2 bg-blue-900/10 border border-blue-500/30 rounded">
            <div className="text-blue-400 text-xs font-semibold mb-1">💡 使用提示:</div>
            <div className="text-blue-300 text-xs space-y-1">
              <div>• 自定义工具支持Shell脚本、Python脚本等</div>
              <div>• 可配置输入参数和输出格式</div>
              <div>• 支持环境变量和路径配置</div>
              <div>• 工具执行结果会直接返回到对话中</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomToolsToggle
