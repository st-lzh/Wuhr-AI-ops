'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Typography } from 'antd'

const { Text } = Typography

interface EnhancedMarkdownRendererProps {
  content: string
  className?: string
  isStreaming?: boolean
  isDark?: boolean
}

const EnhancedMarkdownRenderer: React.FC<EnhancedMarkdownRendererProps> = ({ 
  content, 
  className = '', 
  isStreaming = false,
  isDark
}) => {
  
  // 动态检测主题
  const detectTheme = () => {
    if (typeof isDark === 'boolean') return isDark
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             document.body.classList.contains('dark') ||
             window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return true // 默认暗色主题
  }
  
  const isCurrentlyDark = detectTheme()
  
  // 预处理内容，增强格式化
  const preprocessContent = (text: string) => {
    let processedText = text

    // 0. 移除ANSI转义字符
    processedText = processedText.replace(/\x1b\[[0-9;]*m/g, '')

    // 1. 移除远程执行显示信息
    processedText = processedText
      .replace(/🌐\s*\[远程执行@[^\]]+\]\s*/g, '')
      .replace(/^\s*Running:\s*/gm, '')

    // 2. 简化处理，不添加任何标记
    // 命令和参数直接显示，不做特殊处理

    return processedText
  }

  const processedContent = preprocessContent(content)

  return (
    <div className={`enhanced-markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 区分 Markdown 代码块和内联代码，保留命令与原始输出的排版。
          pre: ({ children }) => (
            <pre className="enhanced-code-block">{children}</pre>
          ),
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeContent = String(children).replace(/\n$/, '')
            const isBlock = Boolean(match) || codeContent.includes('\n')

            if (isBlock) {
              return (
                <code className={`block-code ${className || ''}`} data-language={match?.[1] || 'text'} {...props}>
                  {codeContent}
                </code>
              )
            }

            // 不再处理特殊标记，直接返回普通内联代码

            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            )
          },
          
          // 增强标题渲染
          h1: ({ children }) => (
            <h1 className="enhanced-h1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="enhanced-h2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="enhanced-h3">
              {children}
            </h3>
          ),
          
          // 增强段落渲染
          p: ({ children }) => (
            <p className="enhanced-paragraph">
              {children}
            </p>
          ),

          // 增强列表渲染
          ul: ({ children }) => (
            <ul className="enhanced-list">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="enhanced-ordered-list">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="enhanced-list-item">
              {children}
            </li>
          ),

          // 增强引用块渲染
          blockquote: ({ children }) => (
            <div className="enhanced-blockquote info">
              <div className="blockquote-content">
                {children}
              </div>
            </div>
          ),

          // 增强表格渲染
          table: ({ children }) => (
            <div className="enhanced-table-wrapper">
              <table className="enhanced-table">
                {children}
              </table>
            </div>
          ),
          
          thead: ({ children }) => (
            <thead className="enhanced-thead">
              {children}
            </thead>
          ),
          
          tbody: ({ children }) => (
            <tbody className="enhanced-tbody">
              {children}
            </tbody>
          ),
          
          th: ({ children }) => (
            <th className="enhanced-th">
              {children}
            </th>
          ),
          
          td: ({ children }) => (
            <td className="enhanced-td">
              {children}
            </td>
          ),

          // 增强链接渲染
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="enhanced-link"
              target="_blank" 
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),

          // 增强强调文本
          strong: ({ children }) => (
            <strong className="enhanced-strong">
              {children}
            </strong>
          ),

          em: ({ children }) => (
            <em className="enhanced-em">
              {children}
            </em>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="streaming-cursor" />
      )}

      <style jsx>{`
        .enhanced-markdown-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
          line-height: 1.7;
          color: inherit;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .plain-text {
          color: inherit;
          font-family: inherit;
          line-height: inherit;
          white-space: pre-line;
        }

        .inline-code {
          background: transparent !important;
          color: inherit !important;
          padding: 0 !important;
          border-radius: 0 !important;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace !important;
          font-size: 0.95em !important;
          font-weight: 500 !important;
          border: none !important;
        }

        .enhanced-code-block {
          display: block;
          max-width: 100%;
          margin: 14px 0;
          padding: 14px 16px;
          overflow-x: auto;
          border: 1px solid ${isCurrentlyDark ? 'rgba(96, 165, 250, 0.24)' : 'rgba(37, 99, 235, 0.18)'};
          border-radius: 8px;
          background: ${isCurrentlyDark ? 'rgba(2, 6, 23, 0.72)' : 'rgba(241, 245, 249, 0.92)'};
          color: ${isCurrentlyDark ? '#dbeafe' : '#172554'};
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
          font-size: 0.9em;
          line-height: 1.65;
          white-space: pre;
        }

        .block-code {
          display: block;
          min-width: max-content;
          color: inherit !important;
          background: transparent !important;
          font: inherit;
          white-space: inherit;
        }

        .enhanced-h1, .enhanced-h2, .enhanced-h3 {
          color: inherit;
          margin: 20px 0 12px 0;
          font-weight: 600;
        }

        .enhanced-h1 {
          font-size: 1.25em;
          padding-bottom: 8px;
          border-bottom: 2px solid ${isCurrentlyDark ? '#334155' : '#e2e8f0'};
        }

        .enhanced-h2 {
          font-size: 1.15em;
        }

        .enhanced-h3 {
          font-size: 1.05em;
        }

        .enhanced-paragraph {
          margin: 12px 0;
          color: inherit;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .enhanced-list, .enhanced-ordered-list {
          margin: 12px 0;
          padding-left: 20px;
        }

        .enhanced-list-item {
          margin: 6px 0;
          color: inherit;
          line-height: 1.5;
        }

        .enhanced-blockquote {
          margin: 16px 0;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 0.95em;
          background: ${isCurrentlyDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)'};
          border-left: 3px solid ${isCurrentlyDark ? '#60a5fa' : '#3b82f6'};
        }

        .blockquote-content {
          flex: 1;
          color: inherit;
        }

        .enhanced-table-wrapper {
          margin: 16px 0;
          overflow-x: auto;
          border-radius: 6px;
          border: 1px solid ${isCurrentlyDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(209, 213, 219, 0.5)'};
        }

        .enhanced-table {
          width: 100%;
          border-collapse: collapse;
          background: transparent;
        }

        .enhanced-th {
          background: ${isCurrentlyDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(248, 250, 252, 0.5)'};
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 0.9em;
          color: inherit;
          border-bottom: 1px solid ${isCurrentlyDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(226, 232, 240, 0.5)'};
        }

        .enhanced-td {
          padding: 10px 12px;
          border-bottom: 1px solid ${isCurrentlyDark ? 'rgba(55, 65, 81, 0.2)' : 'rgba(241, 245, 249, 0.5)'};
          color: inherit;
          font-size: 0.9em;
        }

        .enhanced-link {
          color: ${isCurrentlyDark ? '#60a5fa' : '#2563eb'};
          text-decoration: none;
          font-weight: 500;
        }

        .enhanced-link:hover {
          text-decoration: underline;
        }

        .enhanced-strong {
          font-weight: 600;
          color: inherit;
        }

        .enhanced-em {
          font-style: italic;
          color: inherit;
          opacity: 0.8;
        }

        .streaming-cursor {
          display: inline-block;
          width: 1px;
          height: 1.2em;
          background-color: ${isCurrentlyDark ? '#60a5fa' : '#3b82f6'};
          animation: blink 1s infinite;
          margin-left: 2px;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* 全局文字颜色继承 */
        .enhanced-markdown-content * {
          color: inherit;
        }

        /* 内联代码样式 */
        .inline-code {
          color: revert !important;
        }


      `}</style>
    </div>
  )
}

export default EnhancedMarkdownRenderer
