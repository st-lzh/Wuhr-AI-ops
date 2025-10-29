'use client'

import React, { useState, useEffect } from 'react'
import { Select, Space, Typography, Spin, Tag, Button, Modal, Input } from 'antd'
import { FileTextOutlined, EyeOutlined } from '@ant-design/icons'

const { Option } = Select
const { Text, Paragraph } = Typography
const { TextArea } = Input

interface DeploymentTemplate {
  id: string
  name: string
  description?: string
  type: 'kubernetes' | 'docker' | 'shell' | 'ansible'
  content: string
  version: string
  isActive: boolean
  usageCount: number
}

interface TemplateSelectorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  style?: React.CSSProperties
  allowClear?: boolean
  templateType?: string // 过滤特定类型的模板
  onTemplateSelect?: (template: DeploymentTemplate | null) => void
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  value,
  onChange,
  placeholder = '选择部署模板',
  disabled = false,
  style,
  allowClear = true,
  templateType,
  onTemplateSelect
}) => {
  const [templates, setTemplates] = useState<DeploymentTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<DeploymentTemplate | null>(null)

  // 加载模板列表
  const loadTemplates = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (templateType) {
        params.append('type', templateType)
      }
      params.append('active', 'true') // 只加载启用的模板
      
      const response = await fetch(`/api/cicd/templates?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setTemplates(data.data.templates || [])
      }
    } catch (error) {
      console.error('加载模板列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    loadTemplates()
  }, [templateType])

  // 处理模板选择
  const handleChange = (templateId: string) => {
    const selectedTemplate = templates.find(t => t.id === templateId) || null
    onChange?.(templateId)
    onTemplateSelect?.(selectedTemplate)
  }

  // 处理清除选择
  const handleClear = () => {
    onChange?.('')
    onTemplateSelect?.(null)
  }

  // 获取类型颜色
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'kubernetes': return 'blue'
      case 'docker': return 'cyan'
      case 'shell': return 'green'
      case 'ansible': return 'orange'
      default: return 'default'
    }
  }

  // 获取类型显示名称
  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case 'kubernetes': return 'Kubernetes'
      case 'docker': return 'Docker'
      case 'shell': return 'Shell'
      case 'ansible': return 'Ansible'
      default: return type
    }
  }

  // 预览模板
  const handlePreview = (template: DeploymentTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewTemplate(template)
    setPreviewVisible(true)
  }

  return (
    <>
      <Select
        value={value}
        onChange={handleChange}
        onClear={handleClear}
        placeholder={placeholder}
        disabled={disabled}
        style={style}
        allowClear={allowClear}
        loading={loading}
        notFoundContent={loading ? <Spin size="small" /> : '暂无模板'}
        optionLabelProp="label"
      >
        {templates.map(template => (
          <Option key={template.id} value={template.id} label={template.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <FileTextOutlined />
                <div>
                  <Text strong>{template.name}</Text>
                  <br />
                  <Space size="small">
                    <Tag color={getTypeColor(template.type)}>
                      {getTypeDisplayName(template.type)}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      v{template.version}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      使用 {template.usageCount} 次
                    </Text>
                  </Space>
                  {template.description && (
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {template.description.length > 50 
                          ? `${template.description.substring(0, 50)}...` 
                          : template.description
                        }
                      </Text>
                    </div>
                  )}
                </div>
              </Space>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => handlePreview(template, e)}
                title="预览模板"
              />
            </div>
          </Option>
        ))}
      </Select>

      {/* 模板预览模态框 */}
      <Modal
        title={`预览模板: ${previewTemplate?.name}`}
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false)
          setPreviewTemplate(null)
        }}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {previewTemplate && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={getTypeColor(previewTemplate.type)}>
                {getTypeDisplayName(previewTemplate.type)}
              </Tag>
              <Text type="secondary">版本: {previewTemplate.version}</Text>
              <Text type="secondary">使用次数: {previewTemplate.usageCount}</Text>
            </Space>
            
            {previewTemplate.description && (
              <Paragraph style={{ marginBottom: 16 }}>
                {previewTemplate.description}
              </Paragraph>
            )}
            
            <div style={{ marginBottom: 8 }}>
              <Text strong>模板内容:</Text>
            </div>
            <TextArea
              value={previewTemplate.content}
              rows={15}
              readOnly
              style={{ 
                fontFamily: 'monospace',
                fontSize: '12px',
                backgroundColor: '#f5f5f5'
              }}
            />
          </div>
        )}
      </Modal>
    </>
  )
}

export default TemplateSelector
