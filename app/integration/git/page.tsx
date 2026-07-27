'use client'

import React from 'react'
import { Typography } from 'antd'
import MainLayout from '../../components/layout/MainLayout'
import GitCredentialManager from '../../components/cicd/GitCredentialManager'

const { Title, Paragraph } = Typography

export default function GitIntegrationPage() {
  return (
    <MainLayout>
      <div className="p-6 space-y-5">
        <div>
          <Title level={2} className="!mb-1">代码接入</Title>
          <Paragraph type="secondary" className="!mb-0">管理私有 Git 仓库的加密访问凭据，供项目校验、构建与部署复用</Paragraph>
        </div>
        <GitCredentialManager embedded />
      </div>
    </MainLayout>
  )
}
