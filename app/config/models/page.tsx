'use client'

import React from 'react'
import { Typography } from 'antd'
import MainLayout from '../../components/layout/MainLayout'
import ModelConnectionsConfig from '../../components/config/ModelConnectionsConfig'

const { Title, Text } = Typography

export default function ModelManagementPage() {
  return (
    <MainLayout>
      <div className="space-y-5">
        <div>
          <Title level={2} className="!mb-1">模型接入</Title>
          <Text type="secondary">配置模型提供商、访问凭据和默认模型</Text>
        </div>
        <ModelConnectionsConfig />
      </div>
    </MainLayout>
  )
}
