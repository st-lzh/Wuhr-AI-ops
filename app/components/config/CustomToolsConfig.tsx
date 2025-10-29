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
  Badge,
  Tooltip,
  Upload,
  Popconfirm
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
  InfoCircleOutlined,
  CodeOutlined,
  UploadOutlined,
  FileOutlined,
  BugOutlined,
  ExperimentOutlined,
  CopyOutlined  // 🔧 新增复制图标
} from '@ant-design/icons'

const { Title, Text } = Typography
const { Panel } = Collapse
const { TextArea } = Input
const { Option } = Select

interface CustomTool {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  workingDirectory?: string
  env: Record<string, string>
  category: string
  version: string
  isActive: boolean
  timeout: number
  inputSchema: any
  outputSchema: any
  examples: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface CustomToolsConfig {
  enabled: boolean
  tools: CustomTool[]
  defaultTimeout: number
  maxConcurrency: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

const TOOL_CATEGORIES = [
  { value: 'system', label: '系统工具', color: 'blue' },
  { value: 'development', label: '开发工具', color: 'green' },
  { value: 'database', label: '数据库工具', color: 'purple' },
  { value: 'network', label: '网络工具', color: 'orange' },
  { value: 'security', label: '安全工具', color: 'red' },
  { value: 'analytics', label: '分析工具', color: 'cyan' },
  { value: 'automation', label: '自动化工具', color: 'yellow' },
  { value: 'custom', label: '自定义工具', color: 'gray' }
]

const CustomToolsConfig: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<CustomToolsConfig>({
    enabled: false,
    tools: [],
    defaultTimeout: 30000,
    maxConcurrency: 5,
    logLevel: 'info'
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTool, setEditingTool] = useState<CustomTool | null>(null)
  const [form] = Form.useForm()
  const [testing, setTesting] = useState<string[]>([])

  // 获取自定义工具配置
  const fetchCustomToolsConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config/custom-tools')
      const data = await response.json()

      if (data.success) {
        setConfig(data.data)
        console.log('🔧 [CustomToolsConfig] 配置已从数据库加载:', data.data)
      } else {
        message.error('获取自定义工具配置失败')
      }
    } catch (error) {
      console.error('获取自定义工具配置失败:', error)
      message.error('获取自定义工具配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存自定义工具配置
  const saveCustomToolsConfig = async (newConfig: CustomToolsConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/config/custom-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })

      const data = await response.json()

      if (data.success) {
        message.success('自定义工具配置保存成功')
        setConfig(newConfig)
        console.log('🔧 [CustomToolsConfig] 配置已保存到数据库:', newConfig)
      } else {
        message.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存自定义工具配置失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 测试自定义工具
  const testCustomTool = async (tool: CustomTool) => {
    setTesting([...testing, tool.id])
    try {
      const response = await fetch('/api/config/custom-tools/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tool.name,
          command: tool.command,
          args: tool.args,
          env: tool.env,
          workingDirectory: tool.workingDirectory,
          timeout: tool.timeout
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        message.success(`工具 "${tool.name}" 测试成功`)
      } else {
        message.error(`工具 "${tool.name}" 测试失败: ${data.error}`)
      }
    } catch (error) {
      console.error('测试工具失败:', error)
      message.error('测试工具失败')
    } finally {
      setTesting(testing.filter(id => id !== tool.id))
    }
  }

  // 添加或编辑工具
  const handleToolSubmit = (values: any) => {
    try {
      const toolData: CustomTool = {
        id: editingTool?.id || `tool_${Date.now()}`,
        name: values.name,
        description: values.description,
        command: values.command,
        args: values.args ? values.args.split(' ').filter((arg: string) => arg.trim()) : [],
        workingDirectory: values.workingDirectory,
        env: values.env ? JSON.parse(values.env) : {},
        category: values.category,
        version: values.version || '1.0.0',
        isActive: values.isActive !== false,
        timeout: values.timeout || config.defaultTimeout,
        inputSchema: values.inputSchema ? JSON.parse(values.inputSchema) : {},
        outputSchema: values.outputSchema ? JSON.parse(values.outputSchema) : {},
        examples: values.examples ? values.examples.split('\n').filter((ex: string) => ex.trim()) : [],
        tags: values.tags || [],
        createdAt: editingTool?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      let updatedTools: CustomTool[]
      if (editingTool) {
        updatedTools = config.tools.map(t => t.id === editingTool.id ? toolData : t)
        message.success('工具配置已更新')
      } else {
        updatedTools = [...config.tools, toolData]
        message.success('工具配置已添加')
      }

      const newConfig = { ...config, tools: updatedTools }
      setConfig(newConfig)
      setModalVisible(false)
      setEditingTool(null)
      form.resetFields()

      // 自动保存配置
      saveCustomToolsConfig(newConfig)
    } catch (error) {
      console.error('保存工具配置失败:', error)
      message.error('保存工具配置失败，请检查JSON格式')
    }
  }

  // 删除工具
  const deleteTool = (toolId: string) => {
    const updatedTools = config.tools.filter(t => t.id !== toolId)
    const newConfig = { ...config, tools: updatedTools }
    setConfig(newConfig)
    saveCustomToolsConfig(newConfig)
    message.success('工具配置已删除')
  }

  // 切换工具启用状态
  const toggleToolActive = (toolId: string) => {
    const updatedTools = config.tools.map(t => 
      t.id === toolId ? { ...t, isActive: !t.isActive } : t
    )
    const newConfig = { ...config, tools: updatedTools }
    setConfig(newConfig)
    saveCustomToolsConfig(newConfig)
  }

  // 打开编辑模态框
  const openEditModal = (tool: CustomTool | null = null) => {
    setEditingTool(tool)
    if (tool) {
      form.setFieldsValue({
        name: tool.name,
        description: tool.description,
        command: tool.command,
        args: Array.isArray(tool.args) ? tool.args.join(' ') : '',
        workingDirectory: tool.workingDirectory,
        env: JSON.stringify(tool.env || {}, null, 2),
        category: tool.category,
        version: tool.version,
        isActive: tool.isActive,
        timeout: tool.timeout,
        inputSchema: JSON.stringify(tool.inputSchema || {}, null, 2),
        outputSchema: JSON.stringify(tool.outputSchema || {}, null, 2),
        examples: Array.isArray(tool.examples) ? tool.examples.join('\n') : '',
        tags: Array.isArray(tool.tags) ? tool.tags : []
      })
    } else {
      form.resetFields()
    }
    setModalVisible(true)
  }

  // 导出配置
  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `custom-tools-config-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 🔧 复制工具名称到剪贴板（用于输入框）
  const copyToolToInput = async (tool: CustomTool) => {
    try {
      // 复制工具名称或描述性文本
      const textToCopy = `使用${tool.name}工具`
      await navigator.clipboard.writeText(textToCopy)
      message.success(`已复制"${textToCopy}"到剪贴板，可直接粘贴到输入框`)
    } catch (error) {
      console.error('复制失败:', error)
      message.error('复制失败，请手动输入')
    }
  }

  // 工具表格列
  const toolColumns = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CustomTool) => (
        <Space>
          <Tooltip title={record.isActive ? '工具已启用' : '工具已禁用'}>
            <Badge
              status={record.isActive ? 'success' : 'default'}
              dot
            />
          </Tooltip>
          <CodeOutlined />
          <Tooltip title="点击复制到输入框">
            <Text
              strong
              className="cursor-pointer hover:text-blue-500 transition-colors"
              onClick={() => copyToolToInput(record)}
            >
              {name}
            </Text>
          </Tooltip>
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
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const categoryConfig = TOOL_CATEGORIES.find(c => c.value === category)
        return (
          <Tag color={categoryConfig?.color || 'default'}>
            {categoryConfig?.label || category}
          </Tag>
        )
      }
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version: string) => <Text code>{version}</Text>
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: CustomTool) => (
        <Switch
          checked={isActive}
          onChange={() => toggleToolActive(record.id)}
          size="small"
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CustomTool) => (
        <Space size="small">
          <Tooltip title="复制到输入框">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToolToInput(record)}
            >
              复制
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<BugOutlined />}
            onClick={() => testCustomTool(record)}
            loading={testing.includes(record.id)}
          >
            测试
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个工具吗？"
            onConfirm={() => deleteTool(record.id)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  useEffect(() => {
    fetchCustomToolsConfig()
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
          <CodeOutlined className="mr-2" />
          自定义工具配置
        </Title>
        <Text className="text-gray-400">
          配置和管理自定义命令行工具和脚本
        </Text>
      </div>

      {/* 全局设置 */}
      <Card title="全局设置" className="glass-card">
        <Row gutter={24}>
          <Col span={6}>
            <div className="flex items-center justify-between">
              <div>
                <Text strong className="text-white">启用自定义工具</Text>
                <div className="text-xs text-gray-400 mt-1">
                  启用后可以使用配置的自定义工具
                </div>
              </div>
              <Switch
                checked={config.enabled}
                onChange={(enabled) => {
                  const newConfig = { ...config, enabled }
                  setConfig(newConfig)
                  saveCustomToolsConfig(newConfig)
                }}
                loading={saving}
              />
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text strong className="text-white block mb-1">默认超时时间</Text>
              <Input
                type="number"
                value={config.defaultTimeout / 1000}
                onChange={(e) => {
                  const timeout = parseInt(e.target.value) * 1000
                  const newConfig = { ...config, defaultTimeout: timeout }
                  setConfig(newConfig)
                }}
                onBlur={() => saveCustomToolsConfig(config)}
                suffix="秒"
                size="small"
              />
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text strong className="text-white block mb-1">最大并发数</Text>
              <Input
                type="number"
                value={config.maxConcurrency}
                onChange={(e) => {
                  const maxConcurrency = parseInt(e.target.value)
                  const newConfig = { ...config, maxConcurrency }
                  setConfig(newConfig)
                }}
                onBlur={() => saveCustomToolsConfig(config)}
                size="small"
                min="1"
                max="20"
              />
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text strong className="text-white block mb-1">日志级别</Text>
              <Select
                value={config.logLevel}
                onChange={(logLevel) => {
                  const newConfig = { ...config, logLevel }
                  setConfig(newConfig)
                  saveCustomToolsConfig(newConfig)
                }}
                size="small"
                className="w-full"
              >
                <Option value="debug">调试</Option>
                <Option value="info">信息</Option>
                <Option value="warn">警告</Option>
                <Option value="error">错误</Option>
              </Select>
            </div>
          </Col>
        </Row>

        {!config.enabled && (
          <Alert
            className="mt-4"
            message="自定义工具功能已禁用"
            description="启用自定义工具功能后，AI助手可以调用配置的命令行工具。"
            type="info"
            showIcon
          />
        )}
      </Card>

      {/* 自定义工具列表 */}
      <Card
        title={
          <Space>
            <CodeOutlined />
            <span>自定义工具</span>
            <Badge count={config.tools.length} color="blue" />
            <Badge count={config.tools.filter(t => t.isActive).length} color="green" />
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={exportConfig}
              size="small"
            >
              导出配置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchCustomToolsConfig()}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditModal()}
              disabled={!config.enabled}
            >
              添加工具
            </Button>
          </Space>
        }
        className="glass-card"
      >
        {config.tools.length === 0 ? (
          <div className="text-center py-12">
            <CodeOutlined className="text-4xl text-gray-500 mb-4" />
            <Text className="text-gray-400 block mb-4">
              尚未配置自定义工具
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openEditModal()}
              disabled={!config.enabled}
            >
              添加第一个工具
            </Button>
          </div>
        ) : (
          <Table
            columns={toolColumns}
            dataSource={config.tools}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* 添加/编辑工具模态框 */}
      <Modal
        title={editingTool ? '编辑自定义工具' : '添加自定义工具'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingTool(null)
          form.resetFields()
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleToolSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="工具名称"
                rules={[
                  { required: true, message: '请输入工具名称' },
                  { max: 50, message: '名称不能超过50个字符' }
                ]}
              >
                <Input placeholder="例如: kubectl-analyzer" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="工具分类"
                rules={[{ required: true, message: '请选择工具分类' }]}
              >
                <Select placeholder="选择分类">
                  {TOOL_CATEGORIES.map(cat => (
                    <Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="工具描述"
            rules={[{ required: true, message: '请输入工具描述' }]}
          >
            <TextArea rows={2} placeholder="详细描述工具的功能和用途" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="command"
                label="命令"
                rules={[{ required: true, message: '请输入命令' }]}
              >
                <Input placeholder="例如: python3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="args"
                label="参数"
                extra="多个参数用空格分隔"
              >
                <Input placeholder="例如: analyze.py --verbose" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="version"
                label="版本号"
              >
                <Input placeholder="例如: 1.0.0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="timeout"
                label="超时时间(秒)"
              >
                <Input type="number" placeholder="30" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="workingDirectory"
            label="工作目录"
            extra="可选，指定命令执行的工作目录"
          >
            <Input placeholder="/path/to/working/directory" />
          </Form.Item>

          <Form.Item
            name="env"
            label="环境变量"
            extra={'JSON格式，例如: {"API_KEY": "your-key"}'}
          >
            <TextArea 
              rows={3}
              placeholder='{"API_KEY": "your-api-key", "DEBUG": "true"}'
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
            extra="用于工具分组和搜索"
          >
            <Select
              mode="tags"
              placeholder="输入标签按回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Collapse ghost>
            <Panel header="高级配置" key="advanced">
              <Form.Item
                name="inputSchema"
                label="输入结构"
                extra="JSON Schema格式，定义工具输入参数结构"
              >
                <TextArea 
                  rows={4}
                  placeholder='{"type": "object", "properties": {"param1": {"type": "string"}}}'
                />
              </Form.Item>

              <Form.Item
                name="outputSchema"
                label="输出结构"
                extra="JSON Schema格式，定义工具输出结构"
              >
                <TextArea 
                  rows={4}
                  placeholder='{"type": "object", "properties": {"result": {"type": "string"}}}'
                />
              </Form.Item>

              <Form.Item
                name="examples"
                label="使用示例"
                extra="每行一个示例，用于工具文档"
              >
                <TextArea 
                  rows={3}
                  placeholder="analyze --type=pods --namespace=default&#10;analyze --help"
                />
              </Form.Item>

              <Form.Item
                name="isActive"
                label="启用状态"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Panel>
          </Collapse>

          <div className="flex justify-end space-x-2 mt-4">
            <Button onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              {editingTool ? '更新' : '添加'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default CustomToolsConfig