'use client'

import React from 'react'
import { Typography } from 'antd'
import MainLayout from '../../components/layout/MainLayout'
import CustomToolsConfig from '../../components/config/CustomToolsConfig'

const { Title, Text } = Typography

export default function CustomToolsPage() {
  return (
    <MainLayout>
      <div className="space-y-5">
        <div>
          <Title level={2} className="!mb-1">自定义工具</Title>
          <Text type="secondary">管理可由 AI 调用的命令、脚本和参数定义</Text>
        </div>
        <CustomToolsConfig />
      </div>
    </MainLayout>
  )
}
