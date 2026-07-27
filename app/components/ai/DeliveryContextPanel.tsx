'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Select, Space, Spin, Tag, Typography, message } from 'antd'
import {
  BranchesOutlined,
  BugOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import type {
  CICDCatalog,
  CICDContextSelection,
  CICDMentionOption
} from '../../types/cicd-ai'

const { Text } = Typography

interface DeliveryContextPanelProps {
  value: CICDContextSelection
  onChange: (value: CICDContextSelection) => void
  onCatalogChange: (catalog: CICDCatalog) => void
  onOperationClick: (operation: string) => void
  onFocusInput: () => void
}

const EMPTY_CATALOG: CICDCatalog = { projects: [], pipelines: [], deployments: [], builds: [] }

export function catalogToMentionOptions(catalog: CICDCatalog): CICDMentionOption[] {
  return [
    ...catalog.projects.map(project => ({
      key: `project:${project.id}`,
      id: project.id,
      type: 'project' as const,
      label: project.name,
      detail: `项目 · ${project.environment} · ${project.branch}`,
      projectId: project.id
    })),
    ...catalog.pipelines.map(pipeline => ({
      key: `pipeline:${pipeline.id}`,
      id: pipeline.id,
      type: 'pipeline' as const,
      label: pipeline.name,
      detail: `流水线 · ${pipeline.jenkinsJobName} · ${pipeline.isActive ? '已启用' : '已停用'}`,
      projectId: pipeline.projectId
    })),
    ...catalog.deployments.map(deployment => ({
      key: `deployment:${deployment.id}`,
      id: deployment.id,
      type: 'deployment' as const,
      label: deployment.name,
      detail: `发布 · ${deployment.environment} · ${deployment.status}`,
      projectId: deployment.projectId
    })),
    ...catalog.builds.map(build => ({
      key: `build:${build.id}`,
      id: build.id,
      type: 'build' as const,
      label: build.name,
      detail: `构建 · ${build.status}`,
      projectId: build.projectId
    }))
  ]
}

const DeliveryContextPanel: React.FC<DeliveryContextPanelProps> = ({
  value,
  onChange,
  onCatalogChange,
  onOperationClick,
  onFocusInput
}) => {
  const [catalog, setCatalog] = useState<CICDCatalog>(EMPTY_CATALOG)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showSelector, setShowSelector] = useState(false)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/ai/cicd/context', { credentials: 'include' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '获取交付对象失败')
      setCatalog(result.data)
      onCatalogChange(result.data)
    } catch (error) {
      const text = error instanceof Error ? error.message : '获取交付对象失败'
      setLoadError(text)
      message.error(text)
    } finally {
      setLoading(false)
    }
  }, [onCatalogChange])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const deployments = useMemo(
    () => value.projectId ? catalog.deployments.filter(item => item.projectId === value.projectId) : catalog.deployments,
    [catalog.deployments, value.projectId]
  )
  const pipelines = useMemo(
    () => value.projectId ? catalog.pipelines.filter(item => item.projectId === value.projectId) : catalog.pipelines,
    [catalog.pipelines, value.projectId]
  )
  const builds = useMemo(
    () => value.projectId ? catalog.builds.filter(item => item.projectId === value.projectId) : catalog.builds,
    [catalog.builds, value.projectId]
  )

  const selectedDeployment = catalog.deployments.find(item => item.id === value.deploymentId)
  const selectedBuild = catalog.builds.find(item => item.id === value.buildId)
  const selectedPipeline = catalog.pipelines.find(item => item.id === value.pipelineId)
  const hasContext = !!(value.projectId || value.pipelineId || value.deploymentId || value.buildId)

  if (loading && catalog.projects.length === 0) {
    return <div className="flex justify-center px-4 py-6"><Spin size="small" /></div>
  }

  return (
    <div className="space-y-3 px-4">
      {loadError && (
        <Alert
          type="error"
          showIcon
          message="交付对象加载失败"
          action={<Button size="small" onClick={() => void loadCatalog()}>重试</Button>}
        />
      )}

      {hasContext && (
        <div className="min-w-0 overflow-hidden rounded border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex min-w-0 flex-wrap gap-1">
            {value.projectName && <Tag color="blue" className="m-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={value.projectName}>#{value.projectName}</Tag>}
            {value.pipelineName && <Tag color="geekblue" className="m-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={value.pipelineName}>#{value.pipelineName}</Tag>}
            {value.deploymentName && <Tag color="purple" className="m-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={value.deploymentName}>#{value.deploymentName}</Tag>}
            {value.buildName && <Tag color="cyan" className="m-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={value.buildName}>#{value.buildName}</Tag>}
          </div>
          {(selectedPipeline || selectedDeployment || selectedBuild) && (
            <Text className="mt-2 block text-xs text-gray-400">
              {selectedBuild?.status || selectedDeployment?.status || (selectedPipeline?.isActive ? '已启用' : '已停用')}
              {selectedDeployment?.requireApproval ? ' · 需要审批' : ''}
            </Text>
          )}
        </div>
      )}

      {!loadError && (
        <div className="flex items-center justify-between gap-2">
          <Space size={4} wrap>
            <Button type={hasContext ? 'link' : 'primary'} size="small" className={hasContext ? 'h-auto p-0 text-xs' : 'text-xs'} onClick={onFocusInput}>
              {hasContext ? '更换对象' : '# 选择对象'}
            </Button>
            <Button
              type="link"
              size="small"
              className="h-auto p-0 text-xs"
              onClick={() => setShowSelector(current => !current)}
            >
              {showSelector ? '收起选择器' : '精确选择'}
            </Button>
            {hasContext && (
              <Button type="link" size="small" className="h-auto p-0 text-xs" onClick={() => onChange({})}>
                清除
              </Button>
            )}
          </Space>
          <Button
            type="text"
            size="small"
            aria-label="刷新交付对象"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadCatalog()}
          />
        </div>
      )}

      {showSelector && !loadError && (
        catalog.projects.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无交付项目" />
        ) : (
          <div className="space-y-2 rounded border border-gray-600/40 p-3">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="选择项目"
              value={value.projectId}
              options={catalog.projects.map(project => ({
                value: project.id,
                label: project.name,
                title: `${project.environment} · ${project.branch}`
              }))}
              onChange={(projectId) => {
                const project = catalog.projects.find(item => item.id === projectId)
                onChange(projectId ? { kind: 'project', projectId, projectName: project?.name } : {})
              }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="可选流水线"
              value={value.pipelineId}
              suffixIcon={<BranchesOutlined />}
              options={pipelines.map(pipeline => ({
                value: pipeline.id,
                label: pipeline.name,
                title: `${pipeline.jenkinsJobName} · ${pipeline.isActive ? '已启用' : '已停用'}`
              }))}
              onChange={(pipelineId) => {
                if (!pipelineId) {
                  onChange({
                    kind: value.deploymentId ? 'deployment' : value.buildId ? 'build' : value.projectId ? 'project' : undefined,
                    projectId: value.projectId,
                    projectName: value.projectName,
                    deploymentId: value.deploymentId,
                    deploymentName: value.deploymentName,
                    buildId: value.buildId,
                    buildName: value.buildName
                  })
                  return
                }
                const pipeline = catalog.pipelines.find(item => item.id === pipelineId)
                const project = catalog.projects.find(item => item.id === pipeline?.projectId)
                onChange({
                  kind: 'pipeline',
                  projectId: pipeline?.projectId || value.projectId,
                  projectName: project?.name || pipeline?.projectName || value.projectName,
                  pipelineId,
                  pipelineName: pipeline?.name
                })
              }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="可选发布任务"
              value={value.deploymentId}
              options={deployments.map(deployment => ({
                value: deployment.id,
                label: deployment.name,
                title: `${deployment.environment} · ${deployment.status}`
              }))}
              onChange={(deploymentId) => {
                if (!deploymentId) {
                  onChange({
                    kind: value.pipelineId ? 'pipeline' : value.projectId ? 'project' : value.buildId ? 'build' : undefined,
                    projectId: value.projectId,
                    projectName: value.projectName,
                    pipelineId: value.pipelineId,
                    pipelineName: value.pipelineName,
                    buildId: value.buildId,
                    buildName: value.buildName
                  })
                  return
                }
                const deployment = catalog.deployments.find(item => item.id === deploymentId)
                const project = catalog.projects.find(item => item.id === deployment?.projectId)
                onChange({
                  kind: 'deployment',
                  projectId: deployment?.projectId || value.projectId,
                  projectName: project?.name || deployment?.projectName || value.projectName,
                  pipelineId: value.pipelineId,
                  pipelineName: value.pipelineName,
                  deploymentId,
                  deploymentName: deployment?.name
                })
              }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="可选构建记录"
              value={value.buildId}
              options={builds.map(build => ({
                value: build.id,
                label: build.name,
                title: `${build.pipelineName || '流水线'} · ${build.status}`
              }))}
              onChange={(buildId) => {
                if (!buildId) {
                  onChange({
                    kind: value.deploymentId ? 'deployment' : value.projectId ? 'project' : undefined,
                    projectId: value.projectId,
                    projectName: value.projectName,
                    pipelineId: value.pipelineId,
                    pipelineName: value.pipelineName,
                    deploymentId: value.deploymentId,
                    deploymentName: value.deploymentName
                  })
                  return
                }
                const build = catalog.builds.find(item => item.id === buildId)
                const project = catalog.projects.find(item => item.id === build?.projectId)
                onChange({
                  kind: 'build',
                  projectId: build?.projectId || value.projectId,
                  projectName: project?.name || build?.projectName || value.projectName,
                  pipelineId: build?.pipelineId || value.pipelineId,
                  pipelineName: build?.pipelineName || value.pipelineName,
                  buildId,
                  buildName: build?.name
                })
              }}
            />
          </div>
        )
      )}

      {hasContext && (
        <div>
          <Space wrap size={[6, 6]}>
            <Button size="small" icon={<BugOutlined />} onClick={() => onOperationClick('/故障分析')}>故障分析</Button>
            <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => onOperationClick('/风险评估')}>风险评估</Button>
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onOperationClick('/状态检查')}>状态检查</Button>
            <Button size="small" icon={<CloudUploadOutlined />} disabled={!value.deploymentId} onClick={() => onOperationClick('/发布执行')}>发布执行</Button>
          </Space>
          {value.deploymentId && <Text className="mt-2 block text-xs text-gray-500">发布执行仍需审批</Text>}
        </div>
      )}
    </div>
  )
}

export default DeliveryContextPanel
