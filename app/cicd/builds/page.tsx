'use client'

import React from 'react'
import { Typography } from 'antd'
import { BuildOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import BuildHistoryManager from '../../../components/cicd/BuildHistoryManager'

const { Title, Paragraph } = Typography

const BuildsPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <BuildOutlined className="mr-2" />
            构建历史
          </Title>
          <Paragraph className="text-gray-600 mb-0">
            查看构建历史记录、构建日志和状态监控
          </Paragraph>
        </div>

        {/* 构建历史管理组件 */}
        <BuildHistoryManager />
      </div>
    </MainLayout>
  )
}

export default BuildsPage
