'use client'

import React from 'react'
import { Card, Descriptions, Typography, Tag, Space, Alert } from 'antd'
import { ProjectOutlined, BranchesOutlined, CodeOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { CreateProjectWizardData, RepositoryInfo, ProjectDetectionResult } from '../../types/project-template'

const { Text } = Typography

interface ProjectSummaryProps {
  data: Partial<CreateProjectWizardData>
  repositoryInfo?: RepositoryInfo | null
  detection?: ProjectDetectionResult | null
  selectedServer?: any
}

const ProjectSummary: React.FC<ProjectSummaryProps> = ({ data, repositoryInfo, detection, selectedServer }) => {
  return (
    <div className="project-summary">
      <Card 
        title={<Space><ProjectOutlined /><span>项目基本信息</span></Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="项目名称">
            <Text strong>{data.name}</Text>
          </Descriptions.Item>
          {data.description && (
            <Descriptions.Item label="项目描述">
              {data.description}
            </Descriptions.Item>
          )}
          {data.template && (
            <Descriptions.Item label="项目模板">
              <Space>
                <span>{data.template.icon}</span>
                <Text strong>{data.template.name}</Text>
                <Tag color="blue">{data.template.category}</Tag>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {data.template.description}
                </Text>
              </div>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card 
        title={<Space><BranchesOutlined /><span>仓库配置</span></Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="仓库地址">
            <Text code copyable>{data.repositoryUrl}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="仓库类型">
            <Tag>{data.repositoryType?.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="默认分支">
            <Tag color="green">{data.branch}</Tag>
          </Descriptions.Item>
          {repositoryInfo && (
            <Descriptions.Item label="验证状态">
              <Space>
                {repositoryInfo.accessible ? (
                  <>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text type="success">验证成功</Text>
                  </>
                ) : (
                  <>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    <Text type="danger">验证失败</Text>
                  </>
                )}
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card 
        title={<Space><CodeOutlined /><span>构建配置</span></Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="构建脚本">
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs text-gray-800 dark:text-gray-200">
              {data.buildScript || '未配置'}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="部署脚本">
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs text-gray-800 dark:text-gray-200">
              {(data as any).deployScript || '未配置'}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="默认环境">
            <Tag color="orange">{data.environment}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {selectedServer && (
        <Card
          title={<Space><CodeOutlined /><span>部署主机</span></Space>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={1} size="small">
            <Descriptions.Item label="主机名称">
              <Text strong>{selectedServer.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="主机地址">
              <Text code>{selectedServer.ip}:{selectedServer.port}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="操作系统">
              {selectedServer.os} {selectedServer.version}
            </Descriptions.Item>
            <Descriptions.Item label="位置">
              {selectedServer.location}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedServer.status === 'online' ? 'green' : 'red'}>
                {selectedServer.status === 'online' ? '在线' : '离线'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {detection && (
        <Card 
          title={<Space><InfoCircleOutlined /><span>项目分析结果</span></Space>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {detection.detectedType && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>检测到的项目类型: </Text>
              <Tag color="blue">{detection.detectedType}</Tag>
              <Tag color="green">{Math.round(detection.confidence * 100)}% 置信度</Tag>
            </div>
          )}
          {detection.frameworks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>技术栈: </Text>
              <Space wrap>
                {detection.frameworks.map(framework => (
                  <Tag key={framework}>{framework}</Tag>
                ))}
              </Space>
            </div>
          )}
          {detection.packageManager && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>包管理器: </Text>
              <Tag color="purple">{detection.packageManager}</Tag>
            </div>
          )}
          <div>
            <Space>
              {detection.hasDockerfile && <Tag color="blue">Docker</Tag>}
              {detection.hasCI && <Tag color="green">CI/CD</Tag>}
            </Space>
          </div>
        </Card>
      )}

      <Alert
        message="确认创建"
        description="请仔细检查以上配置信息，确认无误后点击创建项目按钮。项目创建后，您可以在项目管理页面进行进一步的配置和管理。"
        type="success"
        showIcon
      />
    </div>
  )
}

export default ProjectSummary
