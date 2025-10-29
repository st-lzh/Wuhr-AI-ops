'use client'

import React from 'react'
import { Button, message } from 'antd'
import { ExperimentOutlined } from '@ant-design/icons'
import { FormInstance } from 'antd/es/form'

interface ServerConnectionTestProps {
  form: FormInstance
  loading: boolean
  onLoadingChange: (loading: boolean) => void
  serverId?: string // 如果是编辑模式，传入服务器ID
}

const ServerConnectionTest: React.FC<ServerConnectionTestProps> = ({
  form,
  loading,
  onLoadingChange,
  serverId
}) => {
  // 连接测试
  const handleTestConnection = async () => {
    try {
      // 验证必要字段
      const values = await form.validateFields(['hostname', 'ip', 'port', 'username'])

      // 获取所有表单值，包括认证信息
      const allValues = form.getFieldsValue()

      // 构建连接测试数据
      const testData = {
        hostname: values.hostname,
        ip: values.ip,
        port: values.port,
        username: values.username,
        password: allValues.password || '',
        keyPath: allValues.keyPath || ''
      }

      onLoadingChange(true)

      // 选择API端点
      const apiUrl = serverId 
        ? `/api/admin/servers/${serverId}/test-connection`
        : '/api/admin/servers/test-connection'

      // 调用连接测试API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        message.success('连接测试成功！')
        
        // 如果有系统信息，显示详细信息
        if (result.data?.systemInfo) {
          const { systemInfo } = result.data
          message.info(
            `系统信息 - 运行时间: ${systemInfo.uptime || '未知'}, 内存: ${systemInfo.memory || '未知'}`,
            5
          )
        }
      } else {
        const errorMessage = result.error || result.message || '连接测试失败'
        message.error(`连接测试失败: ${errorMessage}`)
      }
    } catch (error) {
      console.error('连接测试异常:', error)
      message.error('连接测试异常，请检查网络连接')
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <Button
      icon={<ExperimentOutlined />}
      loading={loading}
      onClick={handleTestConnection}
    >
      连接测试
    </Button>
  )
}

export default ServerConnectionTest
