'use client'

import React, { useState } from 'react'
import { Card, Collapse, Typography, Divider, Tag } from 'antd'
import { BulbOutlined, CheckCircleOutlined, DownOutlined, RightOutlined } from '@ant-design/icons'
import MarkdownRenderer from './MarkdownRenderer'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

interface ReasoningChainRendererProps {
  content: string
  modelName?: string
  className?: string
}

const ReasoningChainRenderer: React.FC<ReasoningChainRendererProps> = ({ 
  content, 
  modelName = '', 
  className = '' 
}) => {
  const [activeKey, setActiveKey] = useState<string | string[]>(['reasoning'])

  // 检测是否为推理模型
  const isReasoningModel = (model: string) => {
    return model.toLowerCase().includes('o1') || 
           model.toLowerCase().includes('reasoning') ||
           model.toLowerCase().includes('think')
  }

  // 智能解析思考链内容
  const parseReasoningContent = (text: string) => {
    // 检查是否包含明确的思考过程标记
    const hasThinkingMarkers = /思考过程|思考：|reasoning|thinking|分析：|推理：/i.test(text)
    const hasConclusionMarkers = /结论|答案：|conclusion|最终答案|总结：|因此：/i.test(text)

    if (hasThinkingMarkers || hasConclusionMarkers) {
      // 有明确标记，按标记分割
      const parts = text.split(/(?=思考过程|思考：|reasoning|thinking|分析：|推理：|结论|答案：|conclusion|最终答案|总结：|因此：)/i)

      let reasoning = ''
      let conclusion = ''

      for (const part of parts) {
        if (/思考过程|思考：|reasoning|thinking|分析：|推理：/i.test(part)) {
          reasoning += part + '\n\n'
        } else if (/结论|答案：|conclusion|最终答案|总结：|因此：/i.test(part)) {
          conclusion += part + '\n\n'
        } else if (!reasoning && !conclusion) {
          // 第一部分，可能是思考过程
          reasoning = part
        } else {
          // 后续部分，添加到结论
          conclusion += part + '\n\n'
        }
      }

      return {
        reasoning: reasoning.trim(),
        conclusion: conclusion.trim(),
        hasReasoning: reasoning.trim().length > 0
      }
    } else {
      // 没有明确标记，智能分割
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim())

      if (paragraphs.length > 2) {
        // 多段落：前70%作为思考过程，后30%作为结论
        const splitPoint = Math.ceil(paragraphs.length * 0.7)
        return {
          reasoning: paragraphs.slice(0, splitPoint).join('\n\n'),
          conclusion: paragraphs.slice(splitPoint).join('\n\n'),
          hasReasoning: true
        }
      } else {
        // 少于3段落：全部作为结论
        return {
          reasoning: '',
          conclusion: text,
          hasReasoning: false
        }
      }
    }
  }

  // 如果不是推理模型，使用普通渲染
  if (!isReasoningModel(modelName)) {
    return (
      <div className={className}>
        <MarkdownRenderer content={content} />
      </div>
    )
  }

  const { reasoning, conclusion, hasReasoning } = parseReasoningContent(content)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 简洁的模型标识 */}
      {isReasoningModel(modelName) && (
        <div className="flex items-center space-x-2 mb-2">
          <Tag color="blue" className="text-xs">
            推理模型
          </Tag>
          <Text type="secondary" className="text-xs">
            {modelName}
          </Text>
        </div>
      )}

      {/* 思考过程 - 简化设计 */}
      {hasReasoning && (
        <Collapse
          activeKey={activeKey}
          onChange={setActiveKey}
          className="reasoning-collapse"
          size="small"
          ghost
        >
          <Panel
            header={
              <div className="flex items-center space-x-2">
                <BulbOutlined className="text-yellow-400 text-sm" />
                <Text className="text-gray-300 text-sm">
                  思考过程
                </Text>
                <Text type="secondary" className="text-xs">
                  (点击展开)
                </Text>
              </div>
            }
            key="reasoning"
            className="reasoning-panel"
          >
            <div className="bg-gray-800/30 border-l-2 border-yellow-400 pl-3 py-2 rounded-r text-gray-400 text-sm overflow-hidden">
              <MarkdownRenderer content={reasoning} />
            </div>
          </Panel>
        </Collapse>
      )}

      {/* 简化的分隔线 */}
      {hasReasoning && conclusion && (
        <div className="flex items-center space-x-2 my-3">
          <div className="flex-1 h-px bg-gray-600"></div>
          <CheckCircleOutlined className="text-green-400 text-sm" />
          <Text className="text-green-400 text-xs">最终答案</Text>
          <div className="flex-1 h-px bg-gray-600"></div>
        </div>
      )}

      {/* 最终答案 - 突出显示 */}
      {conclusion && (
        <div className="bg-gray-700/20 border border-gray-600 rounded p-3 overflow-hidden">
          <MarkdownRenderer content={conclusion} />
        </div>
      )}

      <style jsx>{`
        .reasoning-collapse .ant-collapse-item {
          border: none;
          background: transparent;
        }

        .reasoning-collapse .ant-collapse-header {
          background: rgba(55, 65, 81, 0.2);
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 4px;
        }

        .reasoning-collapse .ant-collapse-content {
          background: transparent;
          border: none;
        }

        .reasoning-panel .ant-collapse-content-box {
          padding: 4px 0;
        }
      `}</style>
    </div>
  )
}

export default ReasoningChainRenderer
