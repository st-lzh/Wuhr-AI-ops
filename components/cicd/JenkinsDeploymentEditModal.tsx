'use client'

import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  DatePicker,
  Switch,
  Divider,
  Typography
} from 'antd'
import UserSelector from '../../app/components/common/UserSelector'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const { Title, Text } = Typography

interface JenkinsDeploymentEditModalProps {
  visible: boolean
  deployment: any
  onCancel: () => void
  onSuccess: () => void
}

const JenkinsDeploymentEditModal: React.FC<JenkinsDeploymentEditModalProps> = ({
  visible,
  deployment,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [jenkinsJobs, setJenkinsJobs] = useState<any[]>([])
  const [requireApproval, setRequireApproval] = useState(false)

  // 加载Jenkins任务列表
  const loadJenkinsJobs = async () => {
    try {
      const response = await fetch('/api/jenkins/jobs')
      if (response.ok) {
        const data = await response.json()
        setJenkinsJobs(data.data || [])
      }
    } catch (error) {
      console.error('加载Jenkins任务失败:', error)
    }
  }

  useEffect(() => {
    if (visible) {
      loadJenkinsJobs()
      if (deployment) {
        // 设置表单初始值
        form.setFieldsValue({
          name: deployment.name,
          description: deployment.description,
          environment: deployment.environment,
          version: deployment.version,
          jenkinsJobIds: deployment.jenkinsJobIds || [],
          jenkinsJobName: deployment.jenkinsJobName,
          deployScript: deployment.deployScript,
          scheduledAt: deployment.scheduledAt ? dayjs(deployment.scheduledAt) : undefined,
          notificationUsers: deployment.notificationUsers || [],
          approvalUsers: deployment.approvalUsers || [],
          requireApproval: deployment.requireApproval || false
        })
        setRequireApproval(deployment.requireApproval || false)
      }
    }
  }, [visible, deployment, form])

  const handleSubmit = async (values: any) => {
    if (!deployment) return

    setLoading(true)
    try {
      const response = await fetch(`/api/cicd/deployments/${deployment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : null,
          requireApproval,
          // Jenkins部署任务特有字段
          isJenkinsDeployment: true,
          jenkinsJobIds: values.jenkinsJobIds,
          jenkinsJobName: values.jenkinsJobName
        }),
      })

      if (response.ok) {
        const result = await response.json()
        message.success(result.message || 'Jenkins部署任务更新成功')
        form.resetFields()
        onSuccess()
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '更新Jenkins部署任务失败')
      }
    } catch (error) {
      console.error('更新Jenkins部署任务失败:', error)
      message.error('更新Jenkins部署任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setRequireApproval(false)
    onCancel()
  }

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            编辑Jenkins部署任务
          </Title>
          <Text type="secondary">
            编辑Jenkins任务配置，无需配置主机信息
          </Text>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={700}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="输入Jenkins部署任务名称" />
        </Form.Item>

        <Form.Item
          name="description"
          label="任务描述"
        >
          <TextArea 
            rows={3} 
            placeholder="描述Jenkins部署任务的用途和功能"
          />
        </Form.Item>

        <Form.Item
          name="environment"
          label="部署环境"
          rules={[{ required: true, message: '请选择部署环境' }]}
        >
          <Select placeholder="选择部署环境">
            <Option value="dev">开发环境</Option>
            <Option value="test">测试环境</Option>
            <Option value="staging">预发布环境</Option>
            <Option value="prod">生产环境</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="version"
          label="版本号"
        >
          <Input placeholder="输入版本号（可选）" />
        </Form.Item>

        <Divider orientation="left">Jenkins配置</Divider>

        <Form.Item
          name="jenkinsJobIds"
          label="Jenkins任务"
          rules={[{ required: true, message: '请选择Jenkins任务' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择要执行的Jenkins任务"
            loading={jenkinsJobs.length === 0}
            onChange={(values, options) => {
              // 自动设置任务名称
              if (values.length > 0) {
                const selectedJobs = values.join(', ')
                form.setFieldValue('jenkinsJobName', selectedJobs)
              }
            }}
          >
            {jenkinsJobs.map(job => (
              <Option key={job.name} value={job.name}>
                {job.name} - {job.description || '无描述'}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="jenkinsJobName"
          label="任务显示名称"
          extra="用于在界面中显示的任务名称"
        >
          <Input placeholder="Jenkins任务显示名称" />
        </Form.Item>

        <Form.Item
          name="deployScript"
          label="部署脚本"
          extra="可选的额外部署脚本，在Jenkins任务执行后运行"
        >
          <TextArea 
            rows={4} 
            placeholder="输入额外的部署脚本（可选）"
          />
        </Form.Item>

        <Divider orientation="left">调度和通知</Divider>

        <Form.Item
          name="scheduledAt"
          label="计划执行时间"
          extra="留空表示立即执行"
        >
          <DatePicker
            showTime
            placeholder="选择计划执行时间"
            style={{ width: '100%' }}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </Form.Item>

        <Form.Item
          name="notificationUsers"
          label="通知人员"
          extra="任务状态变化时接收通知的人员"
        >
          <UserSelector
            placeholder="选择通知人员"
            mode="multiple"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="审批设置">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Switch
              checked={requireApproval}
              onChange={setRequireApproval}
              checkedChildren="需要审批"
              unCheckedChildren="无需审批"
            />
            {requireApproval && (
              <Form.Item
                name="approvalUsers"
                style={{ margin: 0 }}
                rules={[{ required: requireApproval, message: '请选择审批人员' }]}
              >
                <UserSelector
                  placeholder="选择审批人员"
                  mode="multiple"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}
          </Space>
        </Form.Item>

        <Form.Item className="mb-0">
          <Space className="w-full justify-end">
            <Button onClick={handleCancel}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存修改
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default JenkinsDeploymentEditModal
