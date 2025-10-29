'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Table,
  Modal,
  Space,
  Tag,
  message,
  Spin,
  Alert,
  Input
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ApiOutlined,
  CopyOutlined
} from '@ant-design/icons'

const { TextArea } = Input

interface MCPServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  isConnected?: boolean
  toolsCount?: number
}

interface MCPServersConfigSimpleProps {
  value?: MCPServer[]
  onChange?: (servers: MCPServer[]) => void
}

const MCPServersConfigSimple: React.FC<MCPServersConfigSimpleProps> = ({ value = [], onChange }) => {
  const [servers, setServers] = useState<MCPServer[]>(value)
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [jsonInput, setJsonInput] = useState('')

  // 解析Cursor格式JSON
  const parseCursorFormat = (json: string): MCPServer[] => {
    try {
      const parsed = JSON.parse(json)
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

  // 添加服务器
  const handleAddServer = () => {
    setJsonInput('')
    setModalVisible(true)
  }

  // 保存服务器
  const handleSave = () => {
    try {
      if (!jsonInput.trim()) {
        message.error('请输入JSON配置')
        return
      }

      const newServers = parseCursorFormat(jsonInput)
      const updatedServers = [...servers, ...newServers]
      setServers(updatedServers)

      if (onChange) {
        onChange(updatedServers)
      }

      message.success(`成功添加 ${newServers.length} 个MCP服务器`)
      setModalVisible(false)
    } catch (error: any) {
      message.error(error.message || '添加失败')
    }
  }

  // 删除服务器
  const handleDelete = (serverName: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除服务器 "${serverName}" 吗？`,
      onOk: () => {
        const updatedServers = servers.filter(s => s.name !== serverName)
        setServers(updatedServers)
        if (onChange) {
          onChange(updatedServers)
        }
        message.success('删除成功')
      },
    })
  }

  // 导出配置
  const handleExport = () => {
    const mcpServers: Record<string, any> = {}
    servers.forEach(server => {
      const config: any = { command: server.command }
      if (server.args && server.args.length > 0) config.args = server.args
      if (server.env && Object.keys(server.env).length > 0) config.env = server.env
      if (server.url) config.url = server.url
      mcpServers[server.name] = config
    })

    const json = JSON.stringify({ mcpServers }, null, 2)
    navigator.clipboard.writeText(json)
    message.success('配置已复制到剪贴板')
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
    },
    {
      title: '参数',
      key: 'args',
      render: (record: MCPServer) => (
        record.args && record.args.length > 0 ? (
          <Tag>{record.args.join(', ')}</Tag>
        ) : '-'
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: MCPServer) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.name)}
        >
          删除
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="MCP服务器配置"
          description="直接粘贴Cursor的MCP配置JSON即可添加服务器。支持一次添加多个。"
          type="info"
          showIcon
          icon={<ApiOutlined />}
        />

        <Card
          title={
            <Space>
              <ApiOutlined />
              MCP服务器列表 ({servers.length})
            </Space>
          }
          extra={
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddServer}
              >
                添加服务器
              </Button>
              <Button
                icon={<CopyOutlined />}
                onClick={handleExport}
                disabled={servers.length === 0}
              >
                导出配置
              </Button>
            </Space>
          }
        >
          <Spin spinning={loading}>
            <Table
              dataSource={servers}
              columns={columns}
              rowKey="name"
              pagination={false}
            />
          </Spin>
        </Card>
      </Space>

      <Modal
        title="添加MCP服务器"
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={700}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p><strong>直接粘贴Cursor的MCP配置：</strong></p>
          <pre style={{
            background: '#f5f5f5',
            padding: 10,
            borderRadius: 4,
            fontSize: 12,
            marginTop: 8
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
          rows={12}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="粘贴JSON配置..."
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>
    </div>
  )
}

export default MCPServersConfigSimple
