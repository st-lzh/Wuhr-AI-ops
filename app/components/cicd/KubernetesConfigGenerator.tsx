'use client'

import React, { useState } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Typography,
  Card,
  Tabs,
  message
} from 'antd'
import {
  CloudOutlined,
  SettingOutlined,
  CopyOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { copyWithFeedback } from '../../utils/clipboard'

const { TextArea } = Input
const { Text } = Typography
const { Option } = Select
const { TabPane } = Tabs

interface KubernetesConfigGeneratorProps {
  visible: boolean
  onCancel: () => void
  onGenerate: (configs: { [key: string]: string }) => void
}

interface K8sConfig {
  appName: string
  namespace: string
  image: string
  port: number
  replicas: number
  resources: {
    requests: {
      cpu: string
      memory: string
    }
    limits: {
      cpu: string
      memory: string
    }
  }
  env: { name: string; value: string }[]
  service: {
    type: string
    port: number
    targetPort: number
  }
}

const KubernetesConfigGenerator: React.FC<KubernetesConfigGeneratorProps> = ({
  visible,
  onCancel,
  onGenerate
}) => {
  const [form] = Form.useForm()
  const [configs, setConfigs] = useState<{ [key: string]: string }>({})

  const generateDeployment = (config: K8sConfig): string => {
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.appName}
  namespace: ${config.namespace}
  labels:
    app: ${config.appName}
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.appName}
  template:
    metadata:
      labels:
        app: ${config.appName}
    spec:
      containers:
      - name: ${config.appName}
        image: ${config.image}
        ports:
        - containerPort: ${config.port}
        env:
${config.env.map(e => `        - name: ${e.name}\n          value: "${e.value}"`).join('\n')}
        resources:
          requests:
            cpu: ${config.resources.requests.cpu}
            memory: ${config.resources.requests.memory}
          limits:
            cpu: ${config.resources.limits.cpu}
            memory: ${config.resources.limits.memory}
        livenessProbe:
          httpGet:
            path: /health
            port: ${config.port}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: ${config.port}
          initialDelaySeconds: 5
          periodSeconds: 5`
  }

  const generateService = (config: K8sConfig): string => {
    return `apiVersion: v1
kind: Service
metadata:
  name: ${config.appName}-service
  namespace: ${config.namespace}
  labels:
    app: ${config.appName}
spec:
  type: ${config.service.type}
  ports:
  - port: ${config.service.port}
    targetPort: ${config.service.targetPort}
    protocol: TCP
  selector:
    app: ${config.appName}`
  }

  const generateConfigMap = (config: K8sConfig): string => {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${config.appName}-config
  namespace: ${config.namespace}
data:
  app.properties: |
    app.name=${config.appName}
    app.port=${config.port}
    app.env=production
  nginx.conf: |
    server {
        listen ${config.port};
        server_name localhost;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }`
  }

  const generateIngress = (config: K8sConfig): string => {
    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${config.appName}-ingress
  namespace: ${config.namespace}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - ${config.appName}.example.com
    secretName: ${config.appName}-tls
  rules:
  - host: ${config.appName}.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${config.appName}-service
            port:
              number: ${config.service.port}`
  }

  const generateNamespace = (config: K8sConfig): string => {
    return `apiVersion: v1
kind: Namespace
metadata:
  name: ${config.namespace}
  labels:
    name: ${config.namespace}`
  }

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields()
      
      const config: K8sConfig = {
        appName: values.appName,
        namespace: values.namespace || 'default',
        image: values.image,
        port: values.port || 3000,
        replicas: values.replicas || 3,
        resources: {
          requests: {
            cpu: values.requestsCpu || '100m',
            memory: values.requestsMemory || '128Mi'
          },
          limits: {
            cpu: values.limitsCpu || '500m',
            memory: values.limitsMemory || '512Mi'
          }
        },
        env: values.env || [],
        service: {
          type: values.serviceType || 'ClusterIP',
          port: values.servicePort || 80,
          targetPort: values.port || 3000
        }
      }

      const generatedConfigs = {
        'namespace.yaml': generateNamespace(config),
        'deployment.yaml': generateDeployment(config),
        'service.yaml': generateService(config),
        'configmap.yaml': generateConfigMap(config),
        'ingress.yaml': generateIngress(config)
      }

      setConfigs(generatedConfigs)
      onGenerate(generatedConfigs)
      message.success('Kubernetes 配置生成成功')
    } catch (error) {
      message.error('请填写完整的配置信息')
    }
  }

  const copyToClipboard = async (content: string) => {
    await copyWithFeedback(
      content,
      (msg) => message.success(msg),
      (msg) => message.error(msg)
    )
  }

  const downloadConfig = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      title={
        <Space>
          <CloudOutlined />
          Kubernetes 配置生成器
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="generate" type="primary" onClick={handleGenerate}>
          生成配置
        </Button>
      ]}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 配置表单 */}
        <div style={{ flex: 1 }}>
          <Card title="基本配置" size="small">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                namespace: 'default',
                port: 3000,
                replicas: 3,
                requestsCpu: '100m',
                requestsMemory: '128Mi',
                limitsCpu: '500m',
                limitsMemory: '512Mi',
                serviceType: 'ClusterIP',
                servicePort: 80
              }}
            >
              <Form.Item
                name="appName"
                label="应用名称"
                rules={[{ required: true, message: '请输入应用名称' }]}
              >
                <Input placeholder="my-app" />
              </Form.Item>

              <Form.Item
                name="namespace"
                label="命名空间"
              >
                <Input placeholder="default" />
              </Form.Item>

              <Form.Item
                name="image"
                label="镜像地址"
                rules={[{ required: true, message: '请输入镜像地址' }]}
              >
                <Input placeholder="registry.example.com/my-app:latest" />
              </Form.Item>

              <Form.Item
                name="port"
                label="容器端口"
              >
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="replicas"
                label="副本数量"
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="资源配置">
                <Space.Compact style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item name="requestsCpu" style={{ flex: 1, marginBottom: 0 }}>
                    <Input addonBefore="CPU请求" placeholder="100m" />
                  </Form.Item>
                  <Form.Item name="requestsMemory" style={{ flex: 1, marginBottom: 0 }}>
                    <Input addonBefore="内存请求" placeholder="128Mi" />
                  </Form.Item>
                </Space.Compact>
                <Space.Compact style={{ display: 'flex' }}>
                  <Form.Item name="limitsCpu" style={{ flex: 1, marginBottom: 0 }}>
                    <Input addonBefore="CPU限制" placeholder="500m" />
                  </Form.Item>
                  <Form.Item name="limitsMemory" style={{ flex: 1, marginBottom: 0 }}>
                    <Input addonBefore="内存限制" placeholder="512Mi" />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>

              <Form.Item label="服务配置">
                <Space.Compact style={{ display: 'flex' }}>
                  <Form.Item name="serviceType" style={{ flex: 1, marginBottom: 0 }}>
                    <Select placeholder="服务类型">
                      <Option value="ClusterIP">ClusterIP</Option>
                      <Option value="NodePort">NodePort</Option>
                      <Option value="LoadBalancer">LoadBalancer</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="servicePort" style={{ flex: 1, marginBottom: 0 }}>
                    <InputNumber placeholder="服务端口" min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* 生成的配置预览 */}
        <div style={{ flex: 1 }}>
          <Card title="生成的配置" size="small">
            {Object.keys(configs).length > 0 ? (
              <Tabs
                size="small"
                tabBarExtraContent={
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        const activeKey = Object.keys(configs)[0]
                        if (activeKey) copyToClipboard(configs[activeKey])
                      }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        const activeKey = Object.keys(configs)[0]
                        if (activeKey) downloadConfig(activeKey, configs[activeKey])
                      }}
                    />
                  </Space>
                }
              >
                {Object.entries(configs).map(([filename, content]) => (
                  <TabPane
                    tab={filename}
                    key={filename}
                  >
                    <TextArea
                      value={content}
                      rows={15}
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </TabPane>
                ))}
              </Tabs>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <CloudOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>填写配置信息并点击"生成配置"</div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Modal>
  )
}

export default KubernetesConfigGenerator
