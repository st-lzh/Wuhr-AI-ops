'use client'

import React from 'react'
import { Card, Row, Col, Statistic, Button, Space, Typography, Alert } from 'antd'
import {
  ProjectOutlined,
  DeploymentUnitOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import Link from 'next/link'
import MainLayout from '../components/layout/MainLayout'
import { usePermissions } from '../hooks/usePermissions'

const { Title, Text, Paragraph } = Typography

const CICDOverviewPage: React.FC = () => {
  const { hasPermission, canAccess } = usePermissions()

  // 检查CI/CD访问权限
  const hasCICDAccess = hasPermission('cicd:read')

  if (!hasCICDAccess) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert
            message="访问受限"
            description="您没有权限访问CI/CD功能模块，请联系管理员获取相应权限。"
            type="warning"
            showIcon
          />
        </div>
      </MainLayout>
    )
  }

  // 模拟统计数据
  const stats = {
    projects: 12,
    activeDeployments: 3,
    pendingApprovals: 5,
    jenkinsConfigs: 8
  }

  const quickActions = [
    {
      title: '持续集成',
      description: '管理CI构建流程，配置代码仓库、构建设置和通知人员',
      icon: <ProjectOutlined className="text-2xl text-blue-500" />,
      href: '/cicd/projects',
      permission: 'cicd:read'
    },
    {
      title: '持续部署',
      description: '管理CD部署流程，配置部署主机、通知人员、审批人员和部署模板',
      icon: <RocketOutlined className="text-2xl text-green-500" />,
      href: '/cicd/deployments',
      permission: 'cicd:read'
    },
    {
      title: '模板管理',
      description: '管理部署模板，支持Kubernetes、Docker、Shell和Ansible等多种类型',
      icon: <FileTextOutlined className="text-2xl text-purple-500" />,
      href: '/cicd/templates',
      permission: 'cicd:read'
    },
    {
      title: '审批管理',
      description: '处理部署审批流程，查看审批历史',
      icon: <CheckCircleOutlined className="text-2xl text-orange-500" />,
      href: '/cicd/approvals',
      permission: 'cicd:read'
    },
    {
      title: 'Jenkins配置',
      description: '配置Jenkins服务器连接和作业设置',
      icon: <SettingOutlined className="text-2xl text-purple-500" />,
      href: '/cicd/jenkins',
      permission: 'cicd:read'
    }
  ]

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">
            CI/CD 管理中心
          </Title>
          <Paragraph className="text-gray-600 mb-0">
            管理持续集成和持续部署流程，实现自动化软件交付
          </Paragraph>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card h-full">
              <Statistic
                title="活跃项目"
                value={stats.projects}
                prefix={<ProjectOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card h-full">
              <Statistic
                title="正在部署"
                value={stats.activeDeployments}
                prefix={<PlayCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card h-full">
              <Statistic
                title="待审批"
                value={stats.pendingApprovals}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card h-full">
              <Statistic
                title="Jenkins配置"
                value={stats.jenkinsConfigs}
                prefix={<SettingOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 快速操作 */}
        <Card title="快速操作" className="glass-card">
          <Row gutter={[16, 16]}>
            {quickActions.map((action, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card 
                  className="h-full glass-card hover:shadow-lg transition-shadow cursor-pointer"
                  bodyStyle={{ padding: '20px' }}
                >
                  <div className="text-center">
                    <div className="mb-4">
                      {action.icon}
                    </div>
                    <Title level={4} className="mb-2">
                      {action.title}
                    </Title>
                    <Paragraph className="text-gray-600 mb-4">
                      {action.description}
                    </Paragraph>
                    <Link href={action.href}>
                      <Button 
                        type="primary" 
                        block
                        disabled={!hasPermission(action.permission)}
                      >
                        进入管理
                      </Button>
                    </Link>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        {/* 最近活动 */}
        <Card title="最近活动" className="glass-card">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <DeploymentUnitOutlined className="text-blue-500" />
              <div>
                <Text strong>项目 "web-frontend" 部署成功</Text>
                <div className="text-gray-500 text-sm">2分钟前</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
              <ClockCircleOutlined className="text-orange-500" />
              <div>
                <Text strong>部署任务等待审批</Text>
                <div className="text-gray-500 text-sm">5分钟前</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <CheckCircleOutlined className="text-green-500" />
              <div>
                <Text strong>Jenkins配置 "api-server" 更新完成</Text>
                <div className="text-gray-500 text-sm">10分钟前</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}

export default CICDOverviewPage
