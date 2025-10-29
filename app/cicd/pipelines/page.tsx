'use client'

import React from 'react'
import { Typography } from 'antd'
import { BranchesOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import PipelineManager from '../../../components/cicd/PipelineManager'

const { Title, Paragraph } = Typography

const PipelinesPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <BranchesOutlined className="mr-2" />
            流水线管理
          </Title>
          <Paragraph className="text-gray-600 mb-0">
            管理CI/CD流水线，配置自动化构建和部署流程
          </Paragraph>
        </div>

        {/* 流水线管理组件 */}
        <PipelineManager />
      </div>
    </MainLayout>
  )
}

export default PipelinesPage
