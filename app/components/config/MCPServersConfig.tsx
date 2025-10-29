'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Tag,
  Tooltip,
  message,
  Spin,
  Collapse,
  Alert
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ApiOutlined,
  ToolOutlined
} from '@ant-design/icons'
import MCPImportExport from './MCPImportExport'

const { Panel } = Collapse

interface MCPServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  isConnected?: boolean
  toolsCount?: number
}

interface MCPTool {
  name: string
  description?: string
  server: string
  inputSchema?: any
}

interface MCPServersConfigProps {
  value?: MCPServer[]
  onChange?: (servers: MCPServer[]) => void
}

const MCPServersConfig: React.FC<MCPServersConfigProps> = ({ value = [], onChange }) => {
  const [servers, setServers] = useState<MCPServer[]>(value)
  const [tools, setTools] = useState<MCPTool[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [testingServer, setTestingServer] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [useJsonInput, setUseJsonInput] = useState(true) // 🔥 默认使用JSON输入模式
  const [jsonInput, setJsonInput] = useState('')

  // 加载MCP服务器列表
  const loadServers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/mcp/servers')
      const data = await response.json()

      if (data.success) {
        setServers(data.data || [])
        if (onChange) {
          onChange(data.data || [])
        }
      } else {
        message.error(data.error || '加载MCP服务器列表失败')
      }
    } catch (error: any) {
      console.error('加载MCP服务器失败:', error)
      message.error('加载MCP服务器列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载MCP工具列表
  const loadTools = async () => {
    try {
      const response = await fetch('/api/mcp/tools')
      const data = await response.json()

      if (data.success) {
        setTools(data.data || [])
      }
    } catch (error: any) {
      console.error('加载MCP工具失败:', error)
    }
  }

  useEffect(() => {
    loadServers()
    loadTools()
  }, [])

  // 测试MCP服务器连接
  const testConnection = async (server: MCPServer) => {
    setTestingServer(server.name)
    try {
      const response = await fetch('/api/mcp/servers?action=test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env,
          url: server.url,
        }),
      })

      const data = await response.json()

      if (data.success && data.isConnected) {
        message.success(`连接成功！发现 ${data.toolsFound} 个工具`)
        if (data.tools && data.tools.length > 0) {
          Modal.info({
            title: `${server.name} - 可用工具`,
            content: (
              <ul>
                {data.tools.map((tool: string) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            ),
          })
        }
      } else {
        message.error(data.error || '连接失败')
      }
    } catch (error: any) {
      console.error('测试连接失败:', error)
      message.error('测试连接失败')
    } finally {
      setTestingServer(null)
    }
  }

  // 添加新服务器
  const handleAddServer = () => {
    form.resetFields()
    setModalVisible(true)
  }

  // 保存服务器配置
  const handleSaveServer = async () => {
    try {
      const values = await form.validateFields()

      // 解析环境变量
      const env: Record<string, string> = {}
      if (values.envString) {
        const envLines = values.envString.split('\n')
        envLines.forEach((line: string) => {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim()
          }
        })
      }

      // 解析参数
      const args = values.argsString
        ? values.argsString.split('\n').filter((arg: string) => arg.trim())
        : []

      const newServer: MCPServer = {
        name: values.name,
        command: values.command || '',
        args,
        env,
        url: values.url,
      }

      // 测试连接
      setTestingServer(newServer.name)
      const response = await fetch('/api/mcp/servers?action=test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newServer),
      })

      const data = await response.json()
      setTestingServer(null)

      if (data.success && data.isConnected) {
        message.success('服务器配置成功并已连接！')

        // 这里应该保存到配置文件，暂时只更新状态
        const updatedServers = [...servers, newServer]
        setServers(updatedServers)
        if (onChange) {
          onChange(updatedServers)
        }

        setModalVisible(false)
        loadTools() // 重新加载工具列表
      } else {
        Modal.confirm({
          title: '连接测试失败',
          content: `无法连接到服务器: ${data.error || '未知错误'}。是否仍要保存配置？`,
          onOk: () => {
            const updatedServers = [...servers, newServer]
            setServers(updatedServers)
            if (onChange) {
              onChange(updatedServers)
            }
            setModalVisible(false)
          },
        })
      }
    } catch (error: any) {
      console.error('保存服务器失败:', error)
      message.error('保存失败')
    }
  }

  // 删除服务器
  const handleDeleteServer = (serverName: string) => {
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
        loadTools() // 重新加载工具列表
      },
    })
  }

  // 处理导入
  const handleImportServers = (importedServers: MCPServer[]) => {
    const updatedServers = [...servers, ...importedServers]
    setServers(updatedServers)
    if (onChange) {
      onChange(updatedServers)
    }
    loadTools() // 重新加载工具列表
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      key: 'type',
      render: (record: MCPServer) => (
        <Tag color={record.url ? 'blue' : 'green'}>
          {record.url ? 'HTTP' : 'stdio'}
        </Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (record: MCPServer) => (
        record.isConnected ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已连接
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            未连接
          </Tag>
        )
      ),
    },
    {
      title: '工具数',
      dataIndex: 'toolsCount',
      key: 'toolsCount',
      render: (count: number) => count || 0,
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: MCPServer) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              type="link"
              icon={<SyncOutlined spin={testingServer === record.name} />}
              onClick={() => testConnection(record)}
              loading={testingServer === record.name}
            >
              测试
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteServer(record.name)}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="MCP服务器配置"
          description="配置Model Context Protocol (MCP)服务器以扩展AI助手的功能。MCP服务器可以提供额外的工具和能力。"
          type="info"
          showIcon
          icon={<ApiOutlined />}
        />

        <Card
          title={
            <Space>
              <ApiOutlined />
              MCP服务器列表
            </Space>
          }
          extra={
            <Space>
              <MCPImportExport
                servers={servers}
                onImport={handleImportServers}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddServer}
              >
                添加服务器
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={() => {
                  loadServers()
                  loadTools()
                }}
              >
                刷新
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

        {tools.length > 0 && (
          <Card
            title={
              <Space>
                <ToolOutlined />
                可用工具 ({tools.length})
              </Space>
            }
          >
            <Collapse>
              {Object.entries(
                tools.reduce((acc, tool) => {
                  if (!acc[tool.server]) {
                    acc[tool.server] = []
                  }
                  acc[tool.server].push(tool)
                  return acc
                }, {} as Record<string, MCPTool[]>)
              ).map(([server, serverTools]) => (
                <Panel
                  key={server}
                  header={`${server} (${serverTools.length} 个工具)`}
                >
                  <ul>
                    {serverTools.map(tool => (
                      <li key={`${server}-${tool.name}`}>
                        <strong>{tool.name}</strong>
                        {tool.description && `: ${tool.description}`}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </Collapse>
          </Card>
        )}
      </Space>

      <Modal
        title="添加MCP服务器"
        open={modalVisible}
        onOk={handleSaveServer}
        onCancel={() => setModalVisible(false)}
        width={600}
        confirmLoading={testingServer !== null}
      >
        <Alert
          message="提示"
          description="你可以使用顶部的「从Cursor导入」按钮批量导入多个服务器，或在此手动添加单个服务器。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="服务器名称"
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input placeholder="例如: sequential-thinking" />
          </Form.Item>

          <Form.Item label="连接类型">
            <Switch
              checkedChildren="HTTP"
              unCheckedChildren="stdio"
              onChange={(checked) => {
                if (checked) {
                  form.setFieldsValue({ command: '' })
                } else {
                  form.setFieldsValue({ url: '' })
                }
              }}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.url !== currentValues.url
            }
          >
            {({ getFieldValue }) => {
              const url = getFieldValue('url')
              return url ? (
                <Form.Item
                  name="url"
                  label="服务器URL"
                  rules={[{ required: true, message: '请输入服务器URL' }]}
                >
                  <Input placeholder="http://localhost:3000" />
                </Form.Item>
              ) : (
                <>
                  <Form.Item
                    name="command"
                    label="命令"
                    rules={[{ required: true, message: '请输入命令（如: npx, node, python）' }]}
                    tooltip="运行MCP服务器的命令，例如 npx, node, python 等"
                  >
                    <Input placeholder="npx" />
                  </Form.Item>

                  <Form.Item
                    name="argsString"
                    label="参数（每行一个）"
                    tooltip="命令参数，每行一个。例如Cursor中的args数组"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder={`-y\n@modelcontextprotocol/server-sequential-thinking`}
                    />
                  </Form.Item>

                  <Form.Item
                    name="envString"
                    label="环境变量（每行一个，格式: KEY=VALUE）"
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="API_KEY=your-key"
                    />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MCPServersConfig
