'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Typography } from 'antd'

const { Text } = Typography

interface MarkdownRendererProps {
  content: string
  className?: string
  isStreaming?: boolean
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', isStreaming = false }) => {
  // 预处理内容，改善纯文本格式并添加颜色高亮
  const preprocessContent = (text: string) => {
    // 如果内容看起来像纯文本（没有明显的Markdown标记），进行格式化
    const hasMarkdownSyntax = /[#*`\[\]()_~]/.test(text) || text.includes('```')

    if (!hasMarkdownSyntax) {
      // 处理纯文本：保留换行，添加适当的段落分隔，并添加颜色标记
      let processedText = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n\n')

      // 添加颜色高亮标记
      processedText = addColorHighlights(processedText)
      return processedText
    }

    return addColorHighlights(text)
  }

  // 简化的内容高亮功能 - 减少视觉干扰，突出重点
  const addColorHighlights = (text: string) => {
    // 简化命令高亮 - 移除emoji，使用更清晰的格式
    text = text.replace(/^(\$\s+.+)$/gm, '**命令：** `$1`')
    text = text.replace(/^(kubectl\s+.+)$/gm, '**命令：** `$1`')
    text = text.replace(/^(docker\s+.+)$/gm, '**命令：** `$1`')

    // 简化状态信息 - 减少装饰性元素
    text = text.replace(/(Error|Failed|错误|失败|异常)([^。\n]*)/gi, '**错误：** $1$2')
    text = text.replace(/(Success|Successful|成功|完成|已启动|运行中)([^。\n]*)/gi, '**成功：** $1$2')

    return text
  }

  const processedContent = preprocessContent(content)

  return (
    <div className={`markdown-content overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块 - 防止溢出
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''

            if (language) {
              return (
                <div className="overflow-x-auto my-2">
                  <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="div"
                    className="rounded-md text-sm"
                    wrapLines={true}
                    wrapLongLines={true}
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              )
            }

            return (
              <code
                className="bg-gray-800 text-orange-400 px-1 py-0.5 rounded text-sm font-mono break-all"
                {...props}
              >
                {children}
              </code>
            )
          },
          
          // 标题
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mb-3 mt-4 border-b border-gray-600 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-white mb-2 mt-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-white mb-2 mt-2">
              {children}
            </h3>
          ),
          
          // 段落 - 优化间距和可读性
          p: ({ children }) => (
            <p className="text-gray-200 mb-3 leading-7 text-sm whitespace-pre-wrap">
              {children}
            </p>
          ),

          // 列表 - 简化样式
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-200 mb-3 space-y-0.5 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-200 mb-3 space-y-0.5 ml-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-200 text-sm leading-6">
              {children}
            </li>
          ),
          
          // 强调
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-blue-300">
              {children}
            </em>
          ),
          
          // 链接
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="text-blue-400 hover:text-blue-300 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-gray-800/50 rounded-r">
              <div className="text-gray-300 italic">
                {children}
              </div>
            </blockquote>
          ),
          
          // 表格
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-600 rounded">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-800">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-gray-900/50">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-gray-600">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-white font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-gray-300">
              {children}
            </td>
          ),
          
          // 水平线
          hr: () => (
            <hr className="border-gray-600 my-4" />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-blue-400 ml-1 animate-pulse" />
      )}
    </div>
  )
}

export default MarkdownRenderer
