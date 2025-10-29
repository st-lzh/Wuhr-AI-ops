'use client'

import React from 'react'
import { Card, Row, Col, Statistic, Progress, Button, List, Avatar, Badge, Typography, Space, Spin, Alert } from 'antd'
import {
  RobotOutlined,
  CloudServerOutlined,
  ApiOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  RightOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  UserOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  ReloadOutlined,
  RocketOutlined,
  ToolOutlined
} from '@ant-design/icons'
import Link from 'next/link'
import { useDashboard, defaultDashboardData } from '../../hooks/useDashboard'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Text, Paragraph } = Typography

const Dashboard: React.FC = () => {
  // 获取真实数据
  const { data, loading, error, refresh } = useDashboard()
  // 获取用户信息
  const { user } = usePermissions()

  // 使用真实数据或默认数据
  const dashboardData = data || defaultDashboardData

  // 图标映射
  const getStatIcon = (color: string) => {
    switch (color) {
      case 'blue': return <RobotOutlined className="text-blue-500" />
      case 'green': return <CloudServerOutlined className="text-green-500" />
      case 'purple': return <ApiOutlined className="text-purple-500" />
      case 'orange': return <LineChartOutlined className="text-orange-500" />
      case 'cyan': return <UserOutlined className="text-cyan-500" />
      default: return <DatabaseOutlined className="text-gray-500" />
    }
  }

  // 趋势图标
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpOutlined className="text-green-500" />
      case 'down': return <ArrowDownOutlined className="text-red-500" />
      default: return <MinusOutlined className="text-gray-500" />
    }
  }

  // 活动图标映射
  const getActivityIcon = (avatar: string) => {
    switch (avatar) {
      case 'RobotOutlined': return <RobotOutlined />
      case 'CloudServerOutlined': return <CloudServerOutlined />
      case 'ApiOutlined': return <ApiOutlined />
      case 'UserOutlined': return <UserOutlined />
      case 'DatabaseOutlined': return <DatabaseOutlined />
      default: return <ClockCircleOutlined />
    }
  }

  const quickActions = [
    {
      title: '启动 AI 助手',
      description: '基于kubelet-wuhrai的智能助手',
      icon: <RobotOutlined className="text-2xl text-blue-500" />,
      href: '/ai/system',
      color: 'blue',
      available: true,
    },
    {
      title: '主机管理',
      description: '管理和监控服务器',
      icon: <CloudServerOutlined className="text-2xl text-green-500" />,
      href: '/servers/list',
      color: 'green',
      available: true,
    },
    {
      title: '模型配置',
      description: '管理AI模型和推理配置',
      icon: <ApiOutlined className="text-2xl text-purple-500" />,
      href: '/config/models',
      color: 'purple',
      available: true,
    },
    {
      title: '监控面板',
      description: '查看系统监控和性能指标',
      icon: <LineChartOutlined className="text-2xl text-cyan-500" />,
      href: '/monitor',
      color: 'cyan',
      available: true,
    },
    {
      title: 'CI/CD 流水线',
      description: '管理持续集成和部署流水线',
      icon: <RocketOutlined className="text-2xl text-orange-500" />,
      href: '/cicd/jenkins-deployments',
      color: 'orange',
      available: true,
    },
    {
      title: 'DevOps 工具箱',
      description: '实用的开发运维工具集合',
      icon: <ToolOutlined className="text-2xl text-red-500" />,
      href: '/tools',
      color: 'red',
      available: true,
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined className="text-green-500" />
      case 'warning':
        return <ExclamationCircleOutlined className="text-orange-500" />
      case 'info':
        return <ClockCircleOutlined className="text-blue-500" />
      default:
        return <ClockCircleOutlined className="text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* 欢迎区域 */}
      <div className="glass-card p-8 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <Title level={2} className="!text-white !mb-2">
              欢迎回来，{user?.username || user?.email || '运维工程师'} 👋
            </Title>
            <Paragraph className="!text-gray-300 !mb-0 text-lg">
              今天是美好的一天，让我们开始高效的运维工作吧！
            </Paragraph>
          </div>
          <div className="animate-float">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl flex items-center justify-center">
              <RobotOutlined className="text-3xl text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      {loading ? (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4 text-gray-400">加载仪表盘数据...</div>
        </div>
      ) : error ? (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={refresh} icon={<ReloadOutlined />}>
              重试
            </Button>
          }
        />
      ) : (
        <Row gutter={[24, 24]}>
          {dashboardData.stats.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card className="glass-card hover:scale-105 transition-transform duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-gray-400 text-sm block mb-1">
                      {stat.title}
                    </Text>
                    <Statistic
                      value={stat.value}
                      suffix={stat.suffix}
                      valueStyle={{ color: '#f8fafc', fontSize: '24px', fontWeight: 'bold' }}
                    />
                    <div className="flex items-center space-x-1 mt-1">
                      {getTrendIcon(stat.trend)}
                      <Text className={`text-${stat.color}-500 text-sm`}>
                        {stat.change}
                      </Text>
                    </div>
                  </div>
                  <div className="text-4xl opacity-80">
                    {getStatIcon(stat.color)}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={[24, 24]}>
        {/* 快速操作 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center space-x-2">
                <ThunderboltOutlined className="text-blue-500" />
                <span className="text-white">快速操作</span>
              </div>
            }
            className="glass-card h-full"
          >
            <Row gutter={[16, 16]}>
              {quickActions.filter(action => action.available).map((action, index) => (
                <Col xs={24} sm={12} lg={8} key={index}>
                  <Link href={action.href}>
                    <Card
                      hoverable
                      className="text-center bg-transparent border-gray-600 hover:border-blue-500 transition-all duration-300 group"
                      styles={{ body: { padding: '20px 16px' } }}
                    >
                      <div className="space-y-3">
                        <div className="group-hover:scale-110 transition-transform duration-300">
                          {action.icon}
                        </div>
                        <div>
                          <Text className="text-white font-medium block group-hover:text-blue-300 transition-colors">
                            {action.title}
                          </Text>
                          <Text className="text-gray-400 text-sm">
                            {action.description}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* 系统状态 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <LineChartOutlined className="text-green-500" />
                  <span className="text-white">系统状态</span>
                </div>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={refresh}
                  loading={loading}
                  className="text-blue-400 hover:text-blue-300"
                  size="small"
                >
                  刷新
                </Button>
              </div>
            }
            className="glass-card h-full"
          >
            <Space direction="vertical" className="w-full" size="large">
              <div>
                <div className="flex justify-between mb-2">
                  <Text className="text-gray-300">CPU 使用率</Text>
                  <Text className="text-white font-medium">{dashboardData.systemHealth.cpu}%</Text>
                </div>
                <Progress
                  percent={dashboardData.systemHealth.cpu}
                  strokeColor={dashboardData.systemHealth.cpu > 80 ? "#ef4444" : dashboardData.systemHealth.cpu > 60 ? "#f59e0b" : "#3b82f6"}
                  trailColor="#374151"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Text className="text-gray-300">内存使用率</Text>
                  <Text className="text-white font-medium">{dashboardData.systemHealth.memory}%</Text>
                </div>
                <Progress
                  percent={dashboardData.systemHealth.memory}
                  strokeColor={dashboardData.systemHealth.memory > 85 ? "#ef4444" : dashboardData.systemHealth.memory > 70 ? "#f59e0b" : "#10b981"}
                  trailColor="#374151"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Text className="text-gray-300">磁盘使用率</Text>
                  <Text className="text-white font-medium">{dashboardData.systemHealth.disk}%</Text>
                </div>
                <Progress
                  percent={dashboardData.systemHealth.disk}
                  strokeColor={dashboardData.systemHealth.disk > 90 ? "#ef4444" : dashboardData.systemHealth.disk > 75 ? "#f59e0b" : "#f59e0b"}
                  trailColor="#374151"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Text className="text-gray-300">网络负载</Text>
                  <Text className="text-white font-medium">{dashboardData.systemHealth.network}%</Text>
                </div>
                <Progress
                  percent={dashboardData.systemHealth.network}
                  strokeColor={dashboardData.systemHealth.network > 80 ? "#ef4444" : dashboardData.systemHealth.network > 50 ? "#f59e0b" : "#8b5cf6"}
                  trailColor="#374151"
                />
              </div>

              {/* 系统健康状态 */}
              <div>
                <div className="flex justify-between mb-2">
                  <Text className="text-gray-300">系统状态</Text>
                  <Text className={`font-medium ${
                    dashboardData.systemHealth.cpu < 80 && dashboardData.systemHealth.memory < 85 && dashboardData.systemHealth.disk < 90 ? 'text-green-400' :
                    dashboardData.systemHealth.cpu > 90 || dashboardData.systemHealth.memory > 95 || dashboardData.systemHealth.disk > 95 ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {dashboardData.systemHealth.cpu < 80 && dashboardData.systemHealth.memory < 85 && dashboardData.systemHealth.disk < 90 ? '健康' :
                     dashboardData.systemHealth.cpu > 90 || dashboardData.systemHealth.memory > 95 || dashboardData.systemHealth.disk > 95 ? '严重' : '警告'}
                  </Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 最近活动 */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ClockCircleOutlined className="text-blue-500" />
              <span className="text-white">最近活动</span>
            </div>
            <Link href="/monitor">
              <Button type="link" className="text-blue-400 hover:text-blue-300">
                查看全部 <RightOutlined />
              </Button>
            </Link>
          </div>
        }
        className="glass-card"
      >
        <List
          dataSource={dashboardData.recentActivities}
          renderItem={(item) => (
            <List.Item className="border-b border-gray-700/30 last:border-b-0">
              <List.Item.Meta
                avatar={
                  <Badge dot status={item.status as any}>
                    <Avatar
                      icon={getActivityIcon(item.avatar)}
                      className="bg-gray-700 border-gray-600"
                    />
                  </Badge>
                }
                title={
                  <div className="flex items-center justify-between">
                    <Text className="text-white font-medium">{item.title}</Text>
                    <Text className="text-gray-400 text-sm">{item.time}</Text>
                  </div>
                }
                description={
                  <Text className="text-gray-400">{item.description}</Text>
                }
              />
              <div>{getStatusIcon(item.status)}</div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

export default Dashboard 