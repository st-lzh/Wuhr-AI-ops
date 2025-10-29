'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Spin,
  Switch,
  Select,
  Table,
  Modal,
  Tag,
  Collapse,
  Divider,
  Alert,
  Badge
} from 'antd'
import {
  ToolOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  ApiOutlined,
  SettingOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const { Panel } = Collapse
const { TextArea } = Input

interface MCPServer {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  isConnected: boolean
  tools: MCPTool[]
  status: 'connected' | 'disconnected' | 'error'
}

interface MCPTool {
  name: string
  description: string
  inputSchema: any
  server: string
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  discoveryEnabled: boolean
  autoConnect: boolean
}

const MCPToolsConfig: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<MCPConfig>({
    enabled: false,
    servers: [],
    discoveryEnabled: true,
    autoConnect: true
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const [form] = Form.useForm()
  const [connecting, setConnecting] = useState<string[]>([])

  // 获取MCP配置
  const fetchMCPConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config/mcp-tools')
      const data = await response.json()
      
      if (data.success) {
        setConfig(data.data)
      } else {
        message.error('获取MCP配置失败')
      }
    } catch (error) {
      console.error('获取MCP配置失败:', error)
      message.error('获取MCP配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存MCP配置
  const saveMCPConfig = async (newConfig: MCPConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/config/mcp-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success('MCP配置保存成功')
        setConfig(newConfig)
      } else {
        message.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存MCP配置失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 测试MCP服务器连接
  const testServerConnection = async (server: MCPServer) => {
    setConnecting([...connecting, server.id])
    try {
      const response = await fetch('/api/config/mcp-tools/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success(`服务器 "${server.name}" 连接成功`)
        // 更新服务器状态和工具列表
        const updatedServers = config.servers.map(s => 
          s.id === server.id 
            ? { ...s, status: 'connected' as const, tools: data.tools || [], isConnected: true }
            : s
        )
        setConfig({ ...config, servers: updatedServers })
      } else {
        message.error(`服务器 "${server.name}" 连接失败: ${data.error}`)
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      message.error('测试连接失败')
    } finally {
      setConnecting(connecting.filter(id => id !== server.id))
    }
  }

  // 添加或编辑服务器
  const handleServerSubmit = (values: any) => {
    const serverData = {
      id: editingServer?.id || `server_${Date.now()}`,
      name: values.name,
      command: values.command,
      args: values.args ? values.args.split(' ').filter((arg: string) => arg.trim()) : [],
      env: values.env ? JSON.parse(values.env) : {},
      isConnected: false,
      tools: [],
      status: 'disconnected' as const
    }

    let updatedServers: MCPServer[]
    if (editingServer) {
      updatedServers = config.servers.map(s => s.id === editingServer.id ? serverData : s)
      message.success('服务器配置已更新')
    } else {
      updatedServers = [...config.servers, serverData]
      message.success('服务器配置已添加')
    }

    const newConfig = { ...config, servers: updatedServers }
    setConfig(newConfig)
    setModalVisible(false)
    setEditingServer(null)
    form.resetFields()

    // 自动保存配置
    saveMCPConfig(newConfig)
  }

  // 删除服务器
  const deleteServer = (serverId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个MCP服务器配置吗？',
      onOk: () => {
        const updatedServers = config.servers.filter(s => s.id !== serverId)
        const newConfig = { ...config, servers: updatedServers }
        setConfig(newConfig)
        saveMCPConfig(newConfig)
        message.success('服务器配置已删除')
      }
    })
  }

  // 打开编辑模态框
  const openEditModal = (server: MCPServer | null = null) => {
    setEditingServer(server)
    if (server) {
      form.setFieldsValue({
        name: server.name,
        command: server.command,
        args: server.args.join(' '),
        env: JSON.stringify(server.env, null, 2)
      })
    } else {
      form.resetFields()
    }
    setModalVisible(true)
  }

  // 工具表格列
  const toolColumns = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <ToolOutlined />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => (
        <Text type="secondary" ellipsis={{ tooltip: desc }}>
          {desc}
        </Text>
      )
    },
    {
      title: '服务器',
      dataIndex: 'server',
      key: 'server',
      render: (server: string) => <Tag color="blue">{server}</Tag>
    }
  ]

  // 获取所有工具
  const getAllTools = (): MCPTool[] => {
    return config.servers.flatMap(server => 
      server.tools.map(tool => ({ ...tool, server: server.name }))
    )
  }

  useEffect(() => {
    fetchMCPConfig()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <Title level={3} className="!text-white !mb-2">
          <ToolOutlined className="mr-2" />
          MCP工具配置
        </Title>
        <Text className="text-gray-400">
          配置和管理Model Context Protocol (MCP) 工具服务器
        </Text>
      </div>

      {/* 全局设置 */}
      <Card title="全局设置" className="glass-card">
        <Row gutter={24}>
          <Col span={8}>
            <div className="flex items-center justify-between">
              <div>
                <Text strong className="text-white">启用MCP工具</Text>
                <div className="text-xs text-gray-400 mt-1">
                  启用后将加载配置的MCP服务器
                </div>
              </div>
              <Switch
                checked={config.enabled}
                onChange={(enabled) => {
                  const newConfig = { ...config, enabled }
                  setConfig(newConfig)
                  saveMCPConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
          </Col>
          <Col span={8}>
            <div className="flex items-center justify-between">
              <div>
                <Text strong className="text-white">自动发现工具</Text>
                <div className="text-xs text-gray-400 mt-1">
                  启动时自动发现可用工具
                </div>
              </div>
              <Switch
                checked={config.discoveryEnabled}
                onChange={(discoveryEnabled) => {
                  const newConfig = { ...config, discoveryEnabled }
                  setConfig(newConfig)
                  saveMCPConfig(newConfig)
                }}
                disabled={!config.enabled}
                loading={saving}
              />
            </div>
          </Col>
          <Col span={8}>
            <div className="flex items-center justify-between">
              <div>
                <Text strong className="text-white">自动连接</Text>
                <div className="text-xs text-gray-400 mt-1">
                  启动时自动连接到服务器
                </div>
              </div>
              <Switch
                checked={config.autoConnect}
                onChange={(autoConnect) => {
                  const newConfig = { ...config, autoConnect }
                  setConfig(newConfig)
                  saveMCPConfig(newConfig)
                }}
                disabled={!config.enabled}
                loading={saving}
              />
            </div>
          </Col>
        </Row>

        {!config.enabled && (
          <Alert
            className="mt-4"
            message="MCP工具功能已禁用"
            description="启用MCP工具功能后，可以使用配置的外部工具服务器。"
            type="info"
            showIcon
          />
        )}
      </Card>

      {/* MCP服务器配置 */}
      <Card 
        title={
          <Space>
            <ApiOutlined />
            <span>MCP服务器</span>
            <Badge count={config.servers.length} color="blue" />
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchMCPConfig()}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditModal()}
              disabled={!config.enabled}
            >
              添加服务器
            </Button>
          </Space>
        }
        className="glass-card"
      >
        {config.servers.length === 0 ? (
          <div className="text-center py-12">
            <ApiOutlined className="text-4xl text-gray-500 mb-4" />
            <Text className="text-gray-400 block mb-4">
              尚未配置MCP服务器
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditModal()}
              disabled={!config.enabled}
            >
              添加第一个服务器
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {config.servers.map((server) => (
              <Card
                key={server.id}
                size="small"
                className="border border-gray-600/30"
                title={
                  <Space>
                    <Badge
                      status={
                        server.status === 'connected' ? 'success' :
                        server.status === 'error' ? 'error' : 'default'
                      }
                    />
                    <span className="text-white">{server.name}</span>
                    <Tag color={server.status === 'connected' ? 'green' : 'orange'}>
                      {server.status === 'connected' ? '已连接' : '未连接'}
                    </Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => testServerConnection(server)}
                      loading={connecting.includes(server.id)}
                    >
                      测试连接
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(server)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => deleteServer(server.id)}
                    >
                      删除
                    </Button>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Text className="text-gray-400 block">命令</Text>
                    <Text className="text-white font-mono text-sm">
                      {server.command} {server.args.join(' ')}
                    </Text>
                  </Col>
                  <Col span={8}>
                    <Text className="text-gray-400 block">环境变量</Text>
                    <Text className="text-white">
                      {Object.keys(server.env).length} 个变量
                    </Text>
                  </Col>
                  <Col span={8}>
                    <Text className="text-gray-400 block">可用工具</Text>
                    <Text className="text-white">
                      {server.tools.length} 个工具
                    </Text>
                  </Col>
                </Row>

                {server.tools.length > 0 && (
                  <div className="mt-3">
                    <Collapse ghost>
                      <Panel
                        header={`查看工具 (${server.tools.length})`}
                        key="tools"
                        className="text-gray-300"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          {server.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="p-2 bg-gray-700/50 rounded border border-gray-600/30"
                            >
                              <div className="flex items-center space-x-2">
                                <ToolOutlined className="text-blue-400" />
                                <Text strong className="text-white text-sm">
                                  {tool.name}
                                </Text>
                              </div>
                              <Text className="text-gray-400 text-xs mt-1 block">
                                {tool.description}
                              </Text>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </Collapse>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* 可用工具概览 */}
      <Card 
        title={
          <Space>
            <ToolOutlined />
            <span>可用工具</span>
            <Badge count={getAllTools().length} color="green" />
          </Space>
        }
        className="glass-card"
      >
        {getAllTools().length === 0 ? (
          <div className="text-center py-8">
            <ToolOutlined className="text-2xl text-gray-500 mb-2" />
            <Text className="text-gray-400">
              没有可用的MCP工具。请先添加并连接MCP服务器。
            </Text>
          </div>
        ) : (
          <Table
            columns={toolColumns}
            dataSource={getAllTools()}
            rowKey="name"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        )}
      </Card>

      {/* 添加/编辑服务器模态框 */}
      <Modal
        title={editingServer ? '编辑MCP服务器' : '添加MCP服务器'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingServer(null)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleServerSubmit}
        >
          <Form.Item
            name="name"
            label="服务器名称"
            rules={[
              { required: true, message: '请输入服务器名称' },
              { max: 50, message: '名称不能超过50个字符' }
            ]}
          >
            <Input placeholder="例如: 文件管理器" />
          </Form.Item>

          <Form.Item
            name="command"
            label="命令"
            rules={[
              { required: true, message: '请输入命令' }
            ]}
          >
            <Input placeholder="例如: python -m file_manager_server" />
          </Form.Item>

          <Form.Item
            name="args"
            label="参数"
            extra="多个参数用空格分隔"
          >
            <Input placeholder="例如: --port 8080 --debug" />
          </Form.Item>

          <Form.Item
            name="env"
            label="环境变量"
            extra={'JSON格式，例如: {"API_KEY": "your-key"}'}
          >
            <TextArea 
              rows={4}
              placeholder='{"API_KEY": "your-api-key", "DEBUG": "true"}'
            />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            <Button onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              {editingServer ? '更新' : '添加'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default MCPToolsConfig