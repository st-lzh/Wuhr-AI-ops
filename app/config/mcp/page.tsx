'use client'

import React from 'react'
import { Typography } from 'antd'
import MainLayout from '../../components/layout/MainLayout'
import MCPToolsConfig from '../../components/config/MCPToolsConfig'

const { Title, Text } = Typography

export default function MCPToolsPage() {
  return (
    <MainLayout>
      <div className="space-y-5">
        <div>
          <Title level={2} className="!mb-1">MCP 工具</Title>
          <Text type="secondary">管理 MCP 服务器、连接状态和已发现工具</Text>
        </div>
        <MCPToolsConfig />
      </div>
    </MainLayout>
  )
}
