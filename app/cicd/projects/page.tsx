'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Input,
  Space,
  Typography,
  Alert,
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Tag
} from 'antd'
import {
  ProjectOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  GitlabOutlined,
  BranchesOutlined
} from '@ant-design/icons'

import MainLayout from '../../components/layout/MainLayout'
import { usePermissions } from '../../hooks/usePermissions'
import { CICDProjectWithDetails } from '../../types/cicd'
import CreateProjectWizard from '../../components/cicd/CreateProjectWizard'
import EnhancedProjectEditForm from '../../../components/cicd/EnhancedProjectEditForm'
import type { ColumnsType } from 'antd/es/table'

const { Title, Paragraph, Text } = Typography



const ProjectsPage: React.FC = () => {
  const { hasPermission } = usePermissions()
  
  // 状态管理
  const [projects, setProjects] = useState<CICDProjectWithDetails[]>([])

  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [enhancedEditModalVisible, setEnhancedEditModalVisible] = useState(false)
  const [editingProject, setEditingProject] = useState<CICDProjectWithDetails | null>(null)

  // 详情模态框状态
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [viewingProject, setViewingProject] = useState<CICDProjectWithDetails | null>(null)

  // 分页和搜索
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })
  const [searchText, setSearchText] = useState('')

  // 权限检查
  const canRead = hasPermission('cicd:read')
  const canWrite = hasPermission('cicd:write')

  // 加载项目列表
  const loadProjects = async (page = 1, search = '') => {
    if (!canRead) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/cicd/projects?page=${page}&limit=${pagination.pageSize}&search=${encodeURIComponent(search)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProjects(result.data.projects)
          setPagination(prev => ({
            ...prev,
            current: result.data.pagination.page,
            total: result.data.pagination.total
          }))
        } else {
          message.error(result.error || '加载项目列表失败')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '加载项目列表失败')
      }
    } catch (error) {
      console.error('加载项目列表错误:', error)
      message.error('加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }



  // 处理项目创建成功
  const handleCreateSuccess = () => {
    setCreateModalVisible(false)
    loadProjects(pagination.current, searchText)
  }



  // 删除项目
  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/cicd/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        message.success('项目删除成功')
        loadProjects(pagination.current, searchText)
      } else {
        const errorData = await response.json()
        message.error(errorData.message || '删除项目失败')
      }
    } catch (error) {
      console.error('删除项目错误:', error)
      message.error('删除项目失败')
    }
  }





  // 处理增强编辑项目
  const handleEnhancedEdit = (project: CICDProjectWithDetails) => {
    setEditingProject(project)
    setEnhancedEditModalVisible(true)
  }

  // 处理增强编辑保存
  const handleEnhancedEditSave = async (projectData: any) => {
    if (!editingProject) return

    try {
      const response = await fetch(`/api/cicd/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          message.success('项目更新成功')
          setEnhancedEditModalVisible(false)
          loadProjects(pagination.current, searchText)
        } else {
          message.error(result.error || '更新项目失败')
        }
      } else {
        message.error('更新项目失败')
      }
    } catch (error) {
      console.error('更新项目错误:', error)
      message.error('更新项目失败')
    }
  }

  // 表格列定义
  const columns: ColumnsType<CICDProjectWithDetails> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div className="text-gray-500 text-sm">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: '仓库地址',
      dataIndex: 'repositoryUrl',
      key: 'repository',
      render: (text) => text ? (
        <Tooltip title={text}>
          <a href={text} target="_blank" rel="noopener noreferrer" className="text-blue-500">
            <GitlabOutlined className="mr-1" />
            {text.length > 30 ? `${text.substring(0, 30)}...` : text}
          </a>
        </Tooltip>
      ) : (
        <Text type="secondary">未配置</Text>
      ),
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      render: (text) => (
        <Tag icon={<BranchesOutlined />} color="blue">
          {text}
        </Tag>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (environment: string) => {
        const colorMap = {
          dev: 'green',
          test: 'orange',
          prod: 'red'
        }
        return <Tag color={colorMap[environment as keyof typeof colorMap]}>{environment.toUpperCase()}</Tag>
      },
    },

    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Badge 
          status={isActive ? 'success' : 'default'} 
          text={isActive ? '活跃' : '禁用'} 
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {canWrite && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEnhancedEdit(record)}
                />
              </Tooltip>
              <Popconfirm
                title="确定要删除这个项目吗？"
                description="删除后无法恢复，请谨慎操作。"
                onConfirm={() => handleDeleteProject(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  // 初始化加载
  useEffect(() => {
    if (canRead) {
      loadProjects()
    }
  }, [canRead])

  // 权限检查
  if (!canRead) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert
            message="访问受限"
            description="您没有权限访问项目管理功能。"
            type="warning"
            showIcon
          />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">
            <ProjectOutlined className="mr-2" />
            持续集成
          </Title>
          <Paragraph className="text-gray-600 mb-0">
            管理CI构建流程，配置代码仓库、构建设置和通知人员
          </Paragraph>
        </div>

        {/* 操作栏 */}
        <Card className="glass-card mb-4">
          <div className="flex justify-between items-center">
            <Input.Search
              placeholder="搜索项目名称或描述"
              allowClear
              style={{ width: 300 }}
              onSearch={(value) => {
                setSearchText(value)
                loadProjects(1, value)
              }}
            />
            {canWrite && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建项目
              </Button>
            )}
          </div>
        </Card>

        {/* 项目列表 */}
        <Card className="glass-card">
          <Table
            columns={columns}
            dataSource={projects}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个项目`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, pageSize: pageSize || 10 }))
                loadProjects(page, searchText)
              },
            }}
          />
        </Card>

        {/* 创建项目向导 */}
        <CreateProjectWizard
          visible={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          onSuccess={handleCreateSuccess}
        />

        {/* 项目详情模态框 */}
        <Modal
          title={
            <Space>
              <ProjectOutlined />
              项目详情
            </Space>
          }
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false)
            setViewingProject(null)
          }}
          footer={[
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>,
            canWrite && viewingProject && (
              <Button
                key="edit"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailModalVisible(false)
                  handleEnhancedEdit(viewingProject)
                }}
              >
                编辑项目
              </Button>
            )
          ]}
          width={600}
        >
          {viewingProject && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div>
                <Typography.Title level={4}>基本信息</Typography.Title>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text strong>项目名称：</Text>
                    <div>{viewingProject.name}</div>
                  </div>
                  <div>
                    <Text strong>项目描述：</Text>
                    <div>{viewingProject.description || '无'}</div>
                  </div>
                  <div>
                    <Text strong>环境：</Text>
                    <div>
                      <Tag color={
                        viewingProject.environment === 'prod' ? 'red' :
                        viewingProject.environment === 'test' ? 'orange' : 'blue'
                      }>
                        {viewingProject.environment === 'prod' ? '生产' :
                         viewingProject.environment === 'test' ? '测试' : '开发'}
                      </Tag>
                    </div>
                  </div>
                  <div>
                    <Text strong>状态：</Text>
                    <div>
                      <Badge
                        status={viewingProject.isActive ? 'success' : 'default'}
                        text={viewingProject.isActive ? '活跃' : '停用'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 仓库信息 */}
              <div>
                <Typography.Title level={4}>仓库信息</Typography.Title>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text strong>仓库地址：</Text>
                    <div>
                      {viewingProject.repositoryUrl ? (
                        <a href={viewingProject.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                          <GitlabOutlined className="mr-1" />
                          {viewingProject.repositoryUrl}
                        </a>
                      ) : '未配置'}
                    </div>
                  </div>
                  <div>
                    <Text strong>分支：</Text>
                    <div>
                      {viewingProject.branch ? (
                        <Tag icon={<BranchesOutlined />}>{viewingProject.branch}</Tag>
                      ) : '未配置'}
                    </div>
                  </div>
                  <div>
                    <Text strong>仓库类型：</Text>
                    <div>{viewingProject.repositoryType || '未配置'}</div>
                  </div>
                </div>
              </div>

              {/* 构建配置 */}
              <div>
                <Typography.Title level={4}>构建配置</Typography.Title>
                <div className="space-y-4">
                  <div>
                    <Text strong>构建脚本：</Text>
                    <div className="mt-2">
                      {viewingProject.buildScript ? (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                          {viewingProject.buildScript}
                        </pre>
                      ) : (
                        <Text type="secondary">未配置构建脚本</Text>
                      )}
                    </div>
                  </div>
                  <div>
                    <Text strong>部署脚本：</Text>
                    <div className="mt-2">
                      {viewingProject.deployScript ? (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                          {viewingProject.deployScript}
                        </pre>
                      ) : (
                        <Text type="secondary">未配置部署脚本</Text>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 时间信息 */}
              <div>
                <Typography.Title level={4}>时间信息</Typography.Title>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text strong>创建时间：</Text>
                    <div>{new Date(viewingProject.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <Text strong>更新时间：</Text>
                    <div>{new Date(viewingProject.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>



        {/* 增强编辑表单 */}
        <EnhancedProjectEditForm
          visible={enhancedEditModalVisible}
          onClose={() => setEnhancedEditModalVisible(false)}
          onSave={handleEnhancedEditSave}
          project={editingProject || undefined}
        />
      </div>
    </MainLayout>
  )
}

export default ProjectsPage
