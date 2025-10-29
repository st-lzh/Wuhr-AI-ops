'use client'

import React from 'react'
import {
  Form,
  Input,
  Button,
  Space,
  Tag,
  Row,
  Col
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons'

interface ServerTagManagerProps {
  tags: string[]
  newTag: string
  onTagsChange: (tags: string[]) => void
  onNewTagChange: (tag: string) => void
}

const ServerTagManager: React.FC<ServerTagManagerProps> = ({
  tags,
  newTag,
  onTagsChange,
  onNewTagChange
}) => {
  // 添加标签
  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      onTagsChange([...tags, newTag])
      onNewTagChange('')
    }
  }

  // 删除标签
  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove))
  }

  // 处理回车键添加标签
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <Form.Item label="主机标签">
      <div className="space-y-3">
        {/* 添加标签输入框 */}
        <Row gutter={8}>
          <Col flex="auto">
            <Input
              placeholder="输入标签名称，如: 生产环境、Web服务器等"
              value={newTag}
              onChange={(e) => onNewTagChange(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={20}
            />
          </Col>
          <Col>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddTag}
              disabled={!newTag || tags.includes(newTag)}
            >
              添加标签
            </Button>
          </Col>
        </Row>

        {/* 标签列表 */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-gray-500">已添加的标签:</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Tag
                  key={index}
                  closable
                  onClose={() => handleRemoveTag(tag)}
                  color="blue"
                  className="flex items-center"
                >
                  <span>{tag}</span>
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 预设标签建议 */}
        {tags.length === 0 && (
          <div className="text-xs text-gray-400">
            建议标签: 生产环境、测试环境、Web服务器、数据库服务器、负载均衡器、缓存服务器
          </div>
        )}
      </div>
    </Form.Item>
  )
}

export default ServerTagManager
