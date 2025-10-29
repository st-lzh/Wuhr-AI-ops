import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Card,
  Row,
  Col,
  Tag,
  message,
  Tabs,
  Alert,
  InputNumber,
  Checkbox,
  Switch,
  Divider
} from 'antd'
import {
  SaveOutlined,
  EyeOutlined,
  CodeOutlined,
  SettingOutlined,
  TagsOutlined,
  NotificationOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import UserSelector from '../../app/components/common/UserSelector'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface Project {
  id: string
  name: string
  description?: string
  repositoryUrl: string
  branch: string
  buildScript?: string
  tags?: string[]
  environmentVariables?: { [key: string]: string }
  notificationUsers?: string[]
  buildTriggers?: {
    onPush: boolean
    onPullRequest: boolean
    onSchedule: boolean
    scheduleExpression?: string
  }
  buildTimeout?: number
}

interface EnhancedProjectEditFormProps {
  visible: boolean
  onClose: () => void
  onSave: (project: Partial<Project>) => Promise<void>
  project?: Project
}

const EnhancedProjectEditForm: React.FC<EnhancedProjectEditFormProps> = ({
  visible,
  onClose,
  onSave,
  project
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [requireApproval, setRequireApproval] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (visible && project) {
      form.setFieldsValue({
        name: project.name,
        description: project.description || '',
        repositoryUrl: project.repositoryUrl,
        branch: project.branch,
        buildScript: project.buildScript || '',
        notificationUsers: project.notificationUsers || [],
        buildTriggers: {
          onPush: project.buildTriggers?.onPush ?? true,
          onPullRequest: project.buildTriggers?.onPullRequest ?? false,
          onSchedule: project.buildTriggers?.onSchedule ?? false,
          scheduleExpression: project.buildTriggers?.scheduleExpression || ''
        },
        buildTimeout: project.buildTimeout || 30,
        approvalUsers: (project as any).approvalUsers || [],
        requireApproval: (project as any).requireApproval || false
      })

      setTags(project.tags || [])
      setRequireApproval((project as any).requireApproval || false)
      
      // 转换环境变量格式
      const envVarArray = Object.entries(project.environmentVariables || {}).map(([key, value]) => ({
        key,
        value
      }))
      setEnvVars(envVarArray)
    } else if (visible && !project) {
      // 新建项目时的默认值
      form.resetFields()
      form.setFieldsValue({
        buildTriggers: {
          onPush: true,
          onPullRequest: false,
          onSchedule: false,
          scheduleExpression: ''
        },
        buildTimeout: 30,
        notificationUsers: [],
        approvalUsers: [],
        requireApproval: false
      })
      setTags([])
      setEnvVars([])
      setRequireApproval(false)
    }
  }, [visible, project, form])

  // 处理保存
  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()
      
      // 转换环境变量格式
      const environmentVariables: { [key: string]: string } = {}
      envVars.forEach(({ key, value }) => {
        if (key && value) {
          environmentVariables[key] = value
        }
      })

      const projectData: Partial<Project> = {
        ...values,
        tags,
        environmentVariables
      }

      await onSave(projectData)
      message.success('项目保存成功')
      onClose()
    } catch (error) {
      console.error('保存项目失败:', error)
      message.error('保存项目失败')
    } finally {
      setLoading(false)
    }
  }

  // 添加环境变量
  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  // 删除环境变量
  const removeEnvVar = (index: number) => {
    const newEnvVars = envVars.filter((_, i) => i !== index)
    setEnvVars(newEnvVars)
  }

  // 更新环境变量
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars]
    newEnvVars[index][field] = value
    setEnvVars(newEnvVars)
  }

  // 添加标签
  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
  }

  // 删除标签
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // 预览配置
  const renderPreview = () => {
    const values = form.getFieldsValue()
    return (
      <div style={{ padding: '16px' }}>
        <Title level={4}>项目配置预览</Title>
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Row gutter={[16, 8]}>
            <Col span={12}><Text strong>项目名称:</Text> {values.name}</Col>
            <Col span={12}><Text strong>分支:</Text> {values.branch}</Col>
            <Col span={24}><Text strong>描述:</Text> {values.description}</Col>
            <Col span={24}><Text strong>仓库地址:</Text> {values.repositoryUrl}</Col>
          </Row>
        </Card>



        {tags.length > 0 && (
          <Card size="small" title="项目标签" style={{ marginBottom: '16px' }}>
            {tags.map(tag => (
              <Tag key={tag} color="blue">{tag}</Tag>
            ))}
          </Card>
        )}

        {envVars.length > 0 && (
          <Card size="small" title="环境变量">
            {envVars.map(({ key, value }, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                <Text code>{key}</Text> = <Text code>{value}</Text>
              </div>
            ))}
          </Card>
        )}
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <CodeOutlined />
          {project ? '编辑项目' : '新建项目'}
          <Button
            type={previewMode ? 'primary' : 'default'}
            icon={<EyeOutlined />}
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? '编辑模式' : '预览模式'}
          </Button>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width="80%"
      style={{ top: 20 }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={handleSave}
            disabled={previewMode}
          >
            保存项目
          </Button>
        </Space>
      }
    >
      {previewMode ? (
        renderPreview()
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: <span><SettingOutlined />基本信息</span>,
              children: (
                <Form form={form} layout="vertical">
                  <Alert
                    message="项目基本配置"
                    description="设置项目的基本信息，包括名称、描述、仓库地址等。"
                    type="info"
                    showIcon
                    style={{ marginBottom: '16px' }}
                  />

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="项目名称"
                        name="name"
                        rules={[{ required: true, message: '请输入项目名称' }]}
                      >
                        <Input placeholder="输入项目名称" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="分支"
                        name="branch"
                        rules={[{ required: true, message: '请输入分支名称' }]}
                      >
                        <Input placeholder="main" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="项目描述"
                    name="description"
                  >
                    <TextArea rows={3} placeholder="输入项目描述（可选）" />
                  </Form.Item>

                  <Form.Item
                    label="仓库地址"
                    name="repositoryUrl"
                    rules={[
                      { required: true, message: '请输入仓库地址' },
                      { type: 'url', message: '请输入有效的URL地址' }
                    ]}
                  >
                    <Input placeholder="https://github.com/user/repo.git" />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="构建脚本"
                        name="buildScript"
                      >
                        <Input placeholder="npm run build（可选）" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              )
            },
            {
              key: 'tags',
              label: <span><TagsOutlined />标签和变量</span>,
              children: (
                <div>
                  <Alert
                    message="项目标签和环境变量"
                    description="设置项目标签用于分类管理，配置环境变量用于部署时的参数传递。"
                    type="info"
                    showIcon
                    style={{ marginBottom: '16px' }}
                  />

                  <Card title="项目标签" size="small" style={{ marginBottom: '16px' }}>
                    <Space wrap style={{ marginBottom: '12px' }}>
                      {tags.map(tag => (
                        <Tag
                          key={tag}
                          closable
                          onClose={() => removeTag(tag)}
                          color="blue"
                        >
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                    <Input.Search
                      placeholder="输入标签名称"
                      enterButton="添加"
                      onSearch={addTag}
                      style={{ width: '300px' }}
                    />
                  </Card>

                  <Card title="环境变量" size="small">
                    {envVars.map((envVar, index) => (
                      <Row key={index} gutter={8} style={{ marginBottom: '8px' }}>
                        <Col span={10}>
                          <Input
                            placeholder="变量名"
                            value={envVar.key}
                            onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <Input
                            placeholder="变量值"
                            value={envVar.value}
                            onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                          />
                        </Col>
                        <Col span={2}>
                          <Button
                            type="text"
                            danger
                            onClick={() => removeEnvVar(index)}
                          >
                            删除
                          </Button>
                        </Col>
                      </Row>
                    ))}
                    <Button type="dashed" onClick={addEnvVar} style={{ width: '100%' }}>
                      + 添加环境变量
                    </Button>
                  </Card>
                </div>
              )
            },
            {
              key: 'ci-config',
              label: <span><NotificationOutlined />CI配置</span>,
              children: (
                <div>
                  <Alert
                    message="持续集成配置"
                    description="配置CI构建流程的通知人员、构建触发器和超时设置。"
                    type="info"
                    showIcon
                    style={{ marginBottom: '16px' }}
                  />

                  <Card title="通知设置" size="small" style={{ marginBottom: '16px' }}>
                    <Form.Item
                      label="通知人员"
                      name="notificationUsers"
                      tooltip="选择在构建成功、失败或其他重要事件时需要通知的人员"
                    >
                      <UserSelector
                        placeholder="选择通知人员"
                        mode="multiple"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Card>

                  <Card title="审批设置" size="small" style={{ marginBottom: '16px' }}>
                    <Form.Item
                      name="requireApproval"
                      valuePropName="checked"
                    >
                      <Checkbox onChange={(e) => setRequireApproval(e.target.checked)}>
                        需要审批
                      </Checkbox>
                    </Form.Item>

                    {requireApproval && (
                      <Form.Item
                        label="审批人员"
                        name="approvalUsers"
                        rules={[{ required: requireApproval, message: '请选择审批人员' }]}
                        tooltip="选择有权限审批此项目构建的人员"
                      >
                        <UserSelector
                          placeholder="选择审批人员"
                          mode="multiple"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    )}
                  </Card>

                  <Card title="构建触发器" size="small" style={{ marginBottom: '16px' }}>
                    <Form.Item name={['buildTriggers', 'onPush']} valuePropName="checked">
                      <Checkbox>代码推送时自动构建</Checkbox>
                    </Form.Item>
                    <Form.Item name={['buildTriggers', 'onPullRequest']} valuePropName="checked">
                      <Checkbox>Pull Request时自动构建</Checkbox>
                    </Form.Item>
                    <Form.Item name={['buildTriggers', 'onSchedule']} valuePropName="checked">
                      <Checkbox>定时构建</Checkbox>
                    </Form.Item>
                    <Form.Item
                      label="定时表达式"
                      name={['buildTriggers', 'scheduleExpression']}
                      tooltip="使用Cron表达式，例如：0 2 * * * (每天凌晨2点)"
                    >
                      <Input placeholder="0 2 * * *" />
                    </Form.Item>
                  </Card>

                  <Card title="构建设置" size="small">
                    <Form.Item
                      label="构建超时时间"
                      name="buildTimeout"
                      tooltip="构建任务的最大执行时间，超时后将自动终止"
                    >
                      <InputNumber
                        min={1}
                        max={480}
                        placeholder="30"
                        addonAfter="分钟"
                        style={{ width: '200px' }}
                      />
                    </Form.Item>
                  </Card>
                </div>
              )
            }
          ]}
        />
      )}
    </Modal>
  )
}

export default EnhancedProjectEditForm
