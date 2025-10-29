'use client'

import React, { useState, useEffect } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Tabs,
  Alert,
  Badge,
  Space,
  Switch,
  Button,
  message
} from 'antd'
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  TeamOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { ServerGroupInfo } from '../../types/server'

const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

interface ServerFormFieldsProps {
  isEdit?: boolean
}

const ServerFormFields: React.FC<ServerFormFieldsProps> = ({ isEdit = false }) => {
  const [serverGroups, setServerGroups] = useState<ServerGroupInfo[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)

  const fetchServerGroups = async () => {
    try {
      setGroupsLoading(true)
      const response = await fetch('/api/servers/groups')
      const result = await response.json()
      
      if (result.success) {
        setServerGroups(result.data)
      }
    } catch (error) {
      console.error('获取主机组列表失败:', error)
    } finally {
      setGroupsLoading(false)
    }
  }

  useEffect(() => {
    fetchServerGroups()
  }, [])

  return (
    <Tabs defaultActiveKey="basic" type="card">
      <TabPane tab="基本信息" key="basic">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="主机名称"
              rules={[{ required: true, message: '请输入主机名称' }]}
            >
              <Input placeholder="例如: Web服务器-01" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="hostname"
              label="主机域名"
              rules={[{ required: true, message: '请输入主机域名' }]}
            >
              <Input placeholder="例如: web01.example.com" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="ip"
              label="IP地址"
              rules={[
                { required: true, message: '请输入IP地址' },
                { 
                  pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 
                  message: '请输入有效的IP地址' 
                }
              ]}
            >
              <Input placeholder="例如: 192.168.1.10" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="port"
              label="SSH端口"
              rules={[{ required: true, message: '请输入SSH端口' }]}
            >
              <InputNumber
                min={1}
                max={65535}
                style={{ width: '100%' }}
                placeholder="默认: 22"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="主机描述"
        >
          <TextArea
            rows={3}
            placeholder="请输入主机描述信息..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </TabPane>

      <TabPane tab="系统信息" key="system">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="os"
              label="操作系统"
              rules={[{ required: true, message: '请选择操作系统' }]}
            >
              <Select placeholder="请选择操作系统">
                <Option value="Ubuntu 22.04 LTS">Ubuntu 22.04 LTS</Option>
                <Option value="Ubuntu 20.04 LTS">Ubuntu 20.04 LTS</Option>
                <Option value="CentOS 7">CentOS 7</Option>
                <Option value="CentOS 8">CentOS 8</Option>
                <Option value="Rocky Linux 8">Rocky Linux 8</Option>
                <Option value="Rocky Linux 9">Rocky Linux 9</Option>
                <Option value="Debian 11">Debian 11</Option>
                <Option value="Debian 12">Debian 12</Option>
                <Option value="Red Hat Enterprise Linux 8">Red Hat Enterprise Linux 8</Option>
                <Option value="Red Hat Enterprise Linux 9">Red Hat Enterprise Linux 9</Option>
                <Option value="SUSE Linux Enterprise Server 15">SUSE Linux Enterprise Server 15</Option>
                <Option value="Amazon Linux 2">Amazon Linux 2</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="version"
              label="系统版本"
            >
              <Input placeholder="例如: 22.04.3 LTS" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="location"
              label="机房位置"
              rules={[{ required: true, message: '请选择机房位置' }]}
            >
              <Select placeholder="请选择机房位置">
                <Option value="北京机房">北京机房</Option>
                <Option value="上海机房">上海机房</Option>
                <Option value="广州机房">广州机房</Option>
                <Option value="深圳机房">深圳机房</Option>
                <Option value="杭州机房">杭州机房</Option>
                <Option value="成都机房">成都机房</Option>
                <Option value="香港机房">香港机房</Option>
                <Option value="新加坡机房">新加坡机房</Option>
                <Option value="美国西部">美国西部</Option>
                <Option value="美国东部">美国东部</Option>
                <Option value="欧洲">欧洲</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="groupId"
              label="主机组"
            >
              <Select 
                placeholder="请选择主机组（可选）"
                allowClear
                loading={groupsLoading}
                showSearch
                filterOption={(input, option) => {
                  const label = option?.label || option?.children
                  if (typeof label === 'string') {
                    return label.toLowerCase().includes(input.toLowerCase())
                  }
                  return false
                }}
              >
                {serverGroups.map(group => (
                  <Option key={group.id} value={group.id}>
                    <Space>
                      <Badge color={group.color || '#1890ff'} />
                      <span>{group.name}</span>
                      <span style={{ color: '#999' }}>({group.serverCount || 0}台)</span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="isDefault"
              label="设为默认主机"
              valuePropName="checked"
              extra="启用后，AI助手将优先使用此主机执行命令"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Col>
        </Row>
      </TabPane>

      <TabPane tab="SSH配置" key="ssh">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="username"
              label="SSH用户名"
              rules={[{ required: true, message: '请输入SSH用户名' }]}
            >
              <Input placeholder="例如: root, ubuntu, admin" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="password"
              label="SSH密码"
              extra={isEdit ? "留空表示不更改现有密码" : "如果使用密钥认证，可以不填写密码"}
            >
              <Input.Password
                placeholder={isEdit ? "留空不更改密码" : "SSH登录密码"}
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="keyPath"
          label="SSH密钥路径"
          extra="私钥文件的绝对路径，例如: /home/user/.ssh/id_rsa"
        >
          <Input placeholder="例如: ~/.ssh/id_rsa" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="kubeletPort"
              label="kubelet-wuhrai端口"
              extra="kubelet-wuhrai HTTP服务监听端口"
              initialValue={2081}
            >
              <InputNumber
                min={1024}
                max={65535}
                style={{ width: '100%' }}
                placeholder="默认: 2081"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="autoInstallKubelet"
              label="自动安装kubelet-wuhrai"
              valuePropName="checked"
              initialValue={true}
              extra="启用后，添加主机时自动安装kubelet-wuhrai服务"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" defaultChecked />
            </Form.Item>
          </Col>
        </Row>
      </TabPane>
    </Tabs>
  )
}

export default ServerFormFields