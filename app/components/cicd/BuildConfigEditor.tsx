'use client'

import React, { useEffect, useState } from 'react'
import {
  Form,
  Input,
  Select,
  Card,
  Typography,
  Space,
  Button,
  Alert,
  Tooltip,
  Tag,
  Collapse,
  Checkbox,
  InputNumber
} from 'antd'
import {
  CodeOutlined,
  RocketOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  CopyOutlined,
  SettingOutlined
} from '@ant-design/icons'

import {
  ProjectTemplate,
  RepositoryInfo,
  ProjectDetectionResult
} from '../../types/project-template'
import { ServerInfo } from '../../types/server'


const { TextArea } = Input
const { Text, Title } = Typography
const { Option } = Select
const { Panel } = Collapse

interface BuildConfigEditorProps {
  form: any
  template?: ProjectTemplate
  repositoryInfo?: RepositoryInfo | null
  detection?: ProjectDetectionResult | null
  onServerSelect?: (serverId: string | undefined, serverInfo: ServerInfo | null) => void
}

const BuildConfigEditor: React.FC<BuildConfigEditorProps> = ({
  form,
  template,
  repositoryInfo,
  detection,
  onServerSelect
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const buildScriptTemplates = {
    'npm': {
      build: 'npm install && npm run build',
      deploy: 'npm run deploy',
      test: 'npm test'
    },
    'yarn': {
      build: 'yarn install && yarn build',
      deploy: 'yarn deploy',
      test: 'yarn test'
    },
    'maven': {
      build: './mvnw clean package',
      deploy: 'java -jar target/*.jar',
      test: './mvnw test'
    },
    'gradle': {
      build: './gradlew build',
      deploy: 'java -jar build/libs/*.jar',
      test: './gradlew test'
    },
    'pip': {
      build: 'pip install -r requirements.txt',
      deploy: 'python app.py',
      test: 'python -m pytest'
    },
    'docker': {
      build: 'docker build -t app .',
      deploy: 'docker run -p 3000:3000 app',
      test: 'docker run app npm test'
    },
    'kubernetes': {
      build: 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .\ndocker push ${IMAGE_NAME}:${BUILD_NUMBER}',
      deploy: 'kubectl apply -f k8s/\nkubectl set image deployment/app app=${IMAGE_NAME}:${BUILD_NUMBER}\nkubectl rollout status deployment/app',
      test: 'kubectl run test-pod --image=${IMAGE_NAME}:${BUILD_NUMBER} --rm -i --restart=Never -- npm test'
    }
  }

  useEffect(() => {
    if (template && !form.getFieldValue('buildScript')) {
      form.setFieldsValue({
        buildScript: template.defaultConfig.buildScript,
        environment: template.defaultConfig.environment
      })
    }
  }, [template, form])

  const applyTemplate = (packageManager: string) => {
    const scripts = buildScriptTemplates[packageManager as keyof typeof buildScriptTemplates]
    if (scripts) {
      form.setFieldsValue({
        buildScript: scripts.build
      })
    }
  }

  const renderSuggestions = () => {
    if (!detection && !repositoryInfo) return null

    const suggestions = []

    if (detection?.packageManager) {
      suggestions.push({
        type: 'packageManager',
        title: `检测到 ${detection.packageManager}`,
        description: `建议使用 ${detection.packageManager} 相关的构建脚本`,
        action: () => applyTemplate(detection.packageManager!)
      })
    }

    if (repositoryInfo?.hasDockerfile) {
      suggestions.push({
        type: 'docker',
        title: '检测到 Dockerfile',
        description: '建议使用 Docker 构建和部署',
        action: () => applyTemplate('docker')
      })
    }

    if (repositoryInfo?.hasCI) {
      suggestions.push({
        type: 'ci',
        title: '检测到 CI/CD 配置',
        description: '项目已有 CI/CD 配置，可参考现有脚本',
        action: null
      })
    }

    if (suggestions.length === 0) return null

    return (
      <Alert
        message="智能建议"
        description={
          <div>
            {suggestions.map((suggestion, index) => (
              <div key={index} style={{ marginBottom: 8 }}>
                <Space>
                  <BulbOutlined style={{ color: '#faad14' }} />
                  <Text strong>{suggestion.title}</Text>
                  {suggestion.action && (
                    <Button 
                      type="link" 
                      size="small"
                      onClick={suggestion.action}
                    >
                      应用
                    </Button>
                  )}
                </Space>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {suggestion.description}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
    )
  }



  return (
    <div className="build-config-editor">
      {renderSuggestions()}

      <Card title="构建配置" style={{ marginBottom: 16 }}>
        <Form.Item
          name="buildScript"
          label={
            <Space>
              <CodeOutlined />
              <span>构建脚本</span>
              <Tooltip title="用于编译、打包项目的命令">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入构建脚本' }]}
        >
          <TextArea
            placeholder="输入构建命令，如: npm install && npm run build"
            rows={3}
          />
        </Form.Item>



        <Form.Item
          name="environment"
          label="默认环境"
          rules={[{ required: true, message: '请选择默认环境' }]}
        >
          <Select placeholder="选择默认部署环境">
            <Option value="dev">开发环境</Option>
            <Option value="test">测试环境</Option>
            <Option value="prod">生产环境</Option>
          </Select>
        </Form.Item>
      </Card>

      <Collapse
        ghost
        onChange={(keys) => setShowAdvanced(keys.length > 0)}
      >
        <Panel header="高级配置" key="advanced">
          <Card size="small">
            <Form.Item
              name="testScript"
              label="测试脚本"
            >
              <TextArea
                placeholder="输入测试命令，如: npm test（可选）"
                rows={2}
              />
            </Form.Item>

            <Form.Item
              name="dockerFile"
              label="Dockerfile 路径"
            >
              <Input
                placeholder="Dockerfile 文件路径，如: ./Dockerfile（可选）"
              />
            </Form.Item>

            <Form.Item
              name="workingDirectory"
              label="工作目录"
            >
              <Input
                placeholder="构建工作目录，如: ./（可选）"
              />
            </Form.Item>

            <Form.Item
              name="environmentVariables"
              label="环境变量"
            >
              <TextArea
                placeholder="环境变量配置，每行一个，格式: KEY=VALUE（可选）"
                rows={3}
              />
            </Form.Item>
          </Card>
        </Panel>
      </Collapse>

      <Card title="构建触发器" style={{ marginTop: 16, marginBottom: 16 }}>
        <Alert
          message="构建触发器配置"
          description="配置何时自动触发构建任务，支持代码推送、Pull Request和定时触发。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item name={['buildTriggers', 'onPush']} valuePropName="checked" initialValue={true}>
          <Checkbox>
            <Space>
              <span>代码推送时自动构建</span>
              <Tooltip title="当代码推送到指定分支时自动触发构建">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item name={['buildTriggers', 'onPullRequest']} valuePropName="checked" initialValue={false}>
          <Checkbox>
            <Space>
              <span>Pull Request时自动构建</span>
              <Tooltip title="当创建或更新Pull Request时自动触发构建">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item name={['buildTriggers', 'onSchedule']} valuePropName="checked" initialValue={false}>
          <Checkbox>
            <Space>
              <span>定时构建</span>
              <Tooltip title="按照设定的时间表定时触发构建">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item
          label="定时表达式"
          name={['buildTriggers', 'scheduleExpression']}
          tooltip="使用Cron表达式，例如：0 2 * * * (每天凌晨2点)"
        >
          <Input
            placeholder="0 2 * * *"
            addonBefore="Cron:"
          />
        </Form.Item>

        <Form.Item
          label="构建超时"
          name="buildTimeout"
          tooltip="构建任务的最大执行时间，超时后将自动终止"
          initialValue={30}
        >
          <InputNumber
            min={1}
            max={480}
            addonAfter="分钟"
            style={{ width: 150 }}
          />
        </Form.Item>
      </Card>

      <Alert
        message="配置说明"
        description={
          <div>
            <p>• <strong>构建脚本</strong>：用于编译、打包项目的命令序列</p>
            <p>• <strong>测试脚本</strong>：用于运行项目测试的命令序列（可选）</p>
            <p>• <strong>环境变量</strong>：构建和测试过程中需要的环境变量</p>
            <p>• 多个命令可以用 <code>&&</code> 连接，如：<code>npm install && npm run build</code></p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />


    </div>
  )
}

export default BuildConfigEditor
