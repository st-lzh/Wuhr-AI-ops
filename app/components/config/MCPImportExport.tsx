'use client'

import React, { useState } from 'react'
import { Modal, Button, Input, message, Space } from 'antd'
import { ImportOutlined, ExportOutlined, CopyOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface MCPServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

interface MCPImportExportProps {
  servers: MCPServer[]
  onImport: (servers: MCPServer[]) => void
  onExport?: () => void
}

const MCPImportExport: React.FC<MCPImportExportProps> = ({ servers, onImport }) => {
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [jsonInput, setJsonInput] = useState('')

  // Cursor格式转换为内部格式
  const parseCursorFormat = (json: string): MCPServer[] => {
    try {
      const parsed = JSON.parse(json)

      // 检查是否是Cursor的 mcpServers 格式
      const mcpServers = parsed.mcpServers || parsed

      return Object.entries(mcpServers).map(([name, config]: [string, any]) => ({
        name,
        command: config.command,
        args: config.args,
        env: config.env,
        url: config.url
      }))
    } catch (error) {
      throw new Error('JSON格式不正确，请检查后重试')
    }
  }

  // 内部格式转换为Cursor格式
  const toCursorFormat = (servers: MCPServer[]): string => {
    const mcpServers: Record<string, any> = {}

    servers.forEach(server => {
      const config: any = {
        command: server.command
      }

      if (server.args && server.args.length > 0) {
        config.args = server.args
      }

      if (server.env && Object.keys(server.env).length > 0) {
        config.env = server.env
      }

      if (server.url) {
        config.url = server.url
      }

      mcpServers[server.name] = config
    })

    return JSON.stringify({ mcpServers }, null, 2)
  }

  // 处理导入
  const handleImport = () => {
    try {
      const importedServers = parseCursorFormat(jsonInput)
      onImport(importedServers)
      message.success(`成功导入 ${importedServers.length} 个MCP服务器`)
      setImportModalVisible(false)
      setJsonInput('')
    } catch (error: any) {
      message.error(error.message || '导入失败')
    }
  }

  // 处理导出
  const handleExport = () => {
    const cursorFormat = toCursorFormat(servers)
    navigator.clipboard.writeText(cursorFormat)
    message.success('配置已复制到剪贴板')
  }

  return (
    <>
      <Space>
        <Button
          icon={<ImportOutlined />}
          onClick={() => setImportModalVisible(true)}
        >
          从Cursor导入
        </Button>
        <Button
          icon={<ExportOutlined />}
          onClick={() => setExportModalVisible(true)}
        >
          导出为Cursor格式
        </Button>
      </Space>

      {/* 导入Modal */}
      <Modal
        title="从Cursor导入MCP配置"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false)
          setJsonInput('')
        }}
        width={700}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p>粘贴Cursor的MCP配置JSON（支持完整或部分配置）：</p>
          <pre style={{
            background: '#f5f5f5',
            padding: 10,
            borderRadius: 4,
            fontSize: 12
          }}>
{`{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    }
  }
}`}
          </pre>
        </div>
        <TextArea
          rows={10}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="粘贴JSON配置..."
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>

      {/* 导出Modal */}
      <Modal
        title="导出为Cursor格式"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setExportModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleExport}
          >
            复制到剪贴板
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p>以下配置可以直接粘贴到Cursor的设置中：</p>
        </div>
        <TextArea
          rows={15}
          value={toCursorFormat(servers)}
          readOnly
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>
    </>
  )
}

export default MCPImportExport
