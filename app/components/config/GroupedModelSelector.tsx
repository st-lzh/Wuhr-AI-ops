'use client'

import React, { useState, useEffect } from 'react'
import { Select, Collapse, Tag, Typography, Space, Spin } from 'antd'
import {
  CodeOutlined,
  EyeOutlined,
  FileTextOutlined,
  BulbOutlined,
  GlobalOutlined,
  ApiOutlined
} from '@ant-design/icons'

const { Panel } = Collapse
const { Text } = Typography

// 类别配置
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  text_generation: {
    label: '文本生成',
    icon: <FileTextOutlined />,
    color: '#1890ff'
  },
  vision_understanding: {
    label: '视觉理解',
    icon: <EyeOutlined />,
    color: '#52c41a'
  },
  code_generation: {
    label: '代码生成',
    icon: <CodeOutlined />,
    color: '#722ed1'
  },
  reasoning: {
    label: '推理分析',
    icon: <BulbOutlined />,
    color: '#fa8c16'
  },
  translation: {
    label: '翻译',
    icon: <GlobalOutlined />,
    color: '#13c2c2'
  },
  uncategorized: {
    label: '未分类',
    icon: <ApiOutlined />,
    color: '#8c8c8c'
  }
}

// 提供商配置
const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  doubao: { label: '豆包', color: '#722ed1' },
  qwen: { label: '通义千问', color: '#ff6b35' },
  deepseek: { label: 'DeepSeek', color: '#1890ff' },
  openai: { label: 'OpenAI', color: '#10a37f' }
}

// 预设模型接口
interface PresetModel {
  id: string
  name: string
  displayName: string
  provider: string
  description: string
  contextLength?: number
  maxTokens?: number
  supportedFeatures?: string[]
  isActive: boolean
  category?: string
  series?: string
  sortOrder?: number
  tags?: string[]
}

// 分组数据接口
interface GroupedPresetModels {
  provider: string
  categories: {
    category: string
    series: {
      series: string
      models: PresetModel[]
    }[]
  }[]
}

interface GroupedModelSelectorProps {
  value?: string
  onChange?: (value: string, model?: PresetModel) => void
  provider?: string
  placeholder?: string
  disabled?: boolean
}

const GroupedModelSelector: React.FC<GroupedModelSelectorProps> = ({
  value,
  onChange,
  provider,
  placeholder = '选择预设模型',
  disabled = false
}) => {
  const [groupedModels, setGroupedModels] = useState<GroupedPresetModels[]>([])
  const [flatModels, setFlatModels] = useState<PresetModel[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')

  // 加载预设模型
  useEffect(() => {
    fetchPresetModels()
  }, [provider])

  const fetchPresetModels = async () => {
    try {
      setLoading(true)

      // 获取分组数据
      const groupedUrl = provider
        ? `/api/config/preset-models?grouped=true&provider=${provider}`
        : '/api/config/preset-models?grouped=true'

      const groupedResponse = await fetch(groupedUrl)
      const groupedData = await groupedResponse.json()

      if (groupedData.success) {
        setGroupedModels(groupedData.groupedModels || [])
      }

      // 获取扁平数据用于 value 映射
      const flatUrl = provider
        ? `/api/config/preset-models?provider=${provider}`
        : '/api/config/preset-models'

      const flatResponse = await fetch(flatUrl)
      const flatData = await flatResponse.json()

      if (flatData.success) {
        setFlatModels(flatData.presetModels || [])
      }
    } catch (error) {
      console.error('Failed to fetch preset models:', error)
    } finally {
      setLoading(false)
    }
  }

  // 构建分组选项
  const buildGroupedOptions = () => {
    return groupedModels.map(providerGroup => {
      const providerInfo = PROVIDER_CONFIG[providerGroup.provider] || {
        label: providerGroup.provider,
        color: '#8c8c8c'
      }

      return (
        <Select.OptGroup
          key={providerGroup.provider}
          label={
            <Space>
              <Tag color={providerInfo.color}>{providerInfo.label}</Tag>
            </Space>
          }
        >
          {providerGroup.categories.map(categoryGroup => {
            const categoryInfo = CATEGORY_CONFIG[categoryGroup.category] || CATEGORY_CONFIG.uncategorized

            return categoryGroup.series.map(seriesGroup => {
              // 系列分组标题
              const seriesLabel = (
                <Space size="small">
                  <span style={{ color: categoryInfo.color }}>{categoryInfo.icon}</span>
                  <Text type="secondary">{categoryInfo.label}</Text>
                  <Text type="secondary">·</Text>
                  <Text strong>{seriesGroup.series}</Text>
                </Space>
              )

              return [
                // 系列标题（使用 disabled 选项作为分隔）
                <Select.Option
                  key={`${providerGroup.provider}-${categoryGroup.category}-${seriesGroup.series}-header`}
                  disabled
                  value=""
                  style={{ backgroundColor: '#fafafa', cursor: 'default' }}
                >
                  {seriesLabel}
                </Select.Option>,
                // 该系列下的模型
                ...seriesGroup.models.map(model => (
                  <Select.Option
                    key={model.id}
                    value={model.name}
                    label={model.displayName}
                  >
                    <Space direction="vertical" size={0} style={{ width: '100%', paddingLeft: 16 }}>
                      <Space>
                        <Text strong>{model.displayName}</Text>
                        {model.tags?.map(tag => (
                          <Tag key={tag} color="blue" style={{ fontSize: 10 }}>
                            {tag}
                          </Tag>
                        ))}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {model.description}
                      </Text>
                      {model.contextLength && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          上下文: {(model.contextLength / 1000).toFixed(0)}K tokens
                          {model.contextLength >= 1000000 && ' (1M)'}
                        </Text>
                      )}
                    </Space>
                  </Select.Option>
                ))
              ]
            })
          })}
        </Select.OptGroup>
      )
    })
  }

  // 扁平化选项（备用）
  const buildFlatOptions = () => {
    return flatModels.map(model => (
      <Select.Option key={model.id} value={model.name} label={model.displayName}>
        <Space>
          <Text strong>{model.displayName}</Text>
          <Text type="secondary">({model.provider})</Text>
        </Space>
      </Select.Option>
    ))
  }

  const handleChange = (modelName: string) => {
    const selectedModel = flatModels.find(m => m.name === modelName)
    onChange?.(modelName, selectedModel)
  }

  if (loading) {
    return (
      <Select
        placeholder={placeholder}
        disabled
        suffixIcon={<Spin size="small" />}
      />
    )
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      optionFilterProp="label"
      style={{ width: '100%' }}
      dropdownStyle={{ maxHeight: 600 }}
      listHeight={500}
    >
      {viewMode === 'grouped' ? buildGroupedOptions() : buildFlatOptions()}
    </Select>
  )
}

export default GroupedModelSelector
