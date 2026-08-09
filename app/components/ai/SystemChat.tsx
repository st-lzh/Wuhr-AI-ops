'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import styles from './SystemChat.module.css'
import {
  Card,
  Input,
  Button,
  Select,
  Switch,
  Slider,
  Typography,
  Space,
  Avatar,
  Badge,
  Tooltip,
  message,
  Row,
  Col,
  Collapse,
  Tag,
  Dropdown,
  Modal,
  List,
  Empty,
  Spin
} from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  SettingOutlined,
  ClearOutlined,
  DownloadOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  BulbOutlined,

  StopOutlined,
  HistoryOutlined,
  SearchOutlined,
  CloudUploadOutlined,
  PlusOutlined,

  CloseOutlined,
  MonitorOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  DesktopOutlined,
  ToolOutlined,
  CodeOutlined,
  SecurityScanOutlined,
  RocketOutlined,
  BookOutlined
} from '@ant-design/icons'
import { useAgentChat } from '../../hooks/useAgentChat'
import { detectMode, getModeSuggestionText } from '../../../lib/utils/modeDetection'
import AgentStreamRenderer from './AgentStreamRenderer'


// 模型配置接口
interface ModelConfig {
  id: string
  modelName: string
  displayName: string
  provider: string
  apiKey: string
  baseUrl?: string
  description?: string
  isActive: boolean
  isDefault: boolean
}

interface KnowledgeReference {
  id: string
  title: string
  description?: string
  tags: string[]
  content?: string
}



import FileUpload from './FileUpload'
import type { FileInfo } from './FileUpload'
import EnhancedAIMessageRenderer from './EnhancedAIMessageRenderer'
import UserMessageRenderer from './UserMessageRenderer'
import { isMultimodalModel } from '../../utils/modelUtils'
import MCPToolsToggle, { type MCPToolSelection } from '../config/MCPToolsToggle'
import CustomToolsToggle from '../config/CustomToolsToggle'
import SecurityToggle from '../config/SecurityToggle'
import DecisionLogDrawer from './DecisionLogDrawer'
import HostMentionInput, { ChatTargetCluster, ChatTargetDevice, ChatTargetHost, HostTargetSelection } from './HostMentionInput'
import DeliveryContextPanel, { catalogToMentionOptions } from './DeliveryContextPanel'
import type { CICDCatalog, CICDContextSelection, CICDMentionOption } from '../../types/cicd-ai'
import { useTheme } from '../../hooks/useGlobalState'
import { buildAgentInstallCommand } from '../../../lib/agentRelease'


const { Text, Title } = Typography
const { Panel } = Collapse

const CICD_INTENT_PROMPTS: Record<string, string> = {
  diagnose: '/故障分析 请基于当前交付对象的真实状态、日志和时间线定位根因，并给出按优先级排序的修复建议。',
  risk: '/风险评估 请检查当前交付对象的配置、审批、环境和最近执行记录，给出发布风险、证据与建议。',
  status: '/状态检查 请汇总当前交付对象的真实状态、关键时间、审批进度和下一步建议。',
  optimize: '请分析当前持续集成流水线的阶段、触发器、参数和最近构建记录，找出稳定性与效率瓶颈，并给出可落地的优化方案。'
}

const PANEL_SUMMARY_TAG_CLASS = 'm-0 min-w-0 max-w-[104px] overflow-hidden text-ellipsis whitespace-nowrap text-xs'
const HEADER_ACTION_BUTTON_CLASS = '!flex !h-8 !min-w-0 !items-center !justify-center !rounded-md !px-2 !text-xs !font-medium'
const HEADER_ACTION_LABEL_CLASS = 'hidden xl:inline'

const SystemChat: React.FC = () => {
  const { isDark } = useTheme()

  // 使用增强的Agent Chat hook
  const {
    currentSession,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    streamingMessageId,
    config,
    sendMessage,
    stopGeneration,
    resendMessage,
    deleteMessage,
    copyMessage,
    clearMessages,
    exportSession,
    updateConfig,
    loadSession,
    getSessions,
    deleteSession,
    startNewSession,
    setMessages, // 🔥 用于命令批准按钮更新消息状态
    // 代理模式功能
    isAgentMode,
    setIsAgentMode,
    currentAgentSession,
    getMessageAgentSession
  } = useAgentChat({
    initialConfig: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      enableStreaming: true, // 启用流式传输
      systemPrompt: ''
    }
  })

  // Agent流式数据状态
  const [agentStreamData, setAgentStreamData] = useState<Array<{
    type: 'text' | 'command' | 'output' | 'error' | 'done' | 'thinking' | 'command_approval_request' | 'command_approved' | 'command_rejected' | string
    content?: string
    timestamp: string | number
    metadata?: any
    data?: any
  }>>([])
  const [showAgentStream, setShowAgentStream] = useState(false)

  // 🔧 自定义工具配置状态
  const [customToolsConfig, setCustomToolsConfig] = useState<{enabled: boolean, tools: any[]}>({ enabled: false, tools: [] })

  // 🔧 MCP工具配置状态
  const [mcpToolsConfig, setMcpToolsConfig] = useState<{enabled: boolean, servers: any[]}>({ enabled: false, servers: [] })

  // 🔧 安全控制配置状态
  const [securityEnabled, setSecurityEnabled] = useState<boolean>(true)
  const messageListRef = useRef<HTMLDivElement>(null)


  // 认证状态（现在通过httpOnly cookie自动处理）

  // 模型配置相关状态
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [currentModelConfig, setCurrentModelConfig] = useState<ModelConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [defaultsLoaded, setDefaultsLoaded] = useState(false) // 跟踪默认配置是否已加载

  // 获取默认配置 - 修复时序问题
  const fetchDefaultConfigs = async () => {
    try {
      const response = await fetch('/api/config/defaults')
      const result = await response.json()

      if (result.success) {
        const { defaultServer, defaultModel, defaultApiKey, defaultGroup } = result.data

        console.log('🏠 获取到默认配置:', { 
          hasDefaultServer: !!defaultServer, 
          hasDefaultGroup: !!defaultGroup,
          hasDefaultModel: !!defaultModel 
        })

        // 优先处理默认主机（单机模式）
        if (defaultServer) {
          setHostSelectionMode('single')
          updateConfig({ hostId: defaultServer.id })
          setHostConfig(prev => ({
            ...prev,
            selectedServerId: defaultServer.id
          }))
          console.log('🏠 自动加载默认主机:', defaultServer.name)
          console.log('✅ 默认主机自动选择完成:', defaultServer.name)
        }
        // 如果没有默认主机但有默认主机组，自动设置主机组模式
        else if (defaultGroup) {
          setHostSelectionMode('group')
          setSelectedGroupId(defaultGroup.id)
          console.log('🏠 自动加载默认主机组:', defaultGroup.name, '包含', defaultGroup.serverCount, '台服务器')
        }

        // 如果有默认模型，自动设置
        if (defaultModel) {
          const modelConfig: ModelConfig = {
            id: defaultModel.id,
            modelName: defaultModel.modelName,
            displayName: defaultModel.displayName,
            provider: defaultModel.provider,
            apiKey: defaultModel.apiKey,
            baseUrl: defaultModel.baseUrl,
            isActive: true,
            isDefault: defaultModel.isDefault || false
          }
          setCurrentModelConfig(modelConfig)
          setSelectedModelId(defaultModel.id)
          console.log('🤖 自动加载默认模型:', defaultModel.displayName)
        } else if (defaultApiKey) {
          // 如果没有默认模型但有默认API Key，使用默认API Key
          console.log('🔑 使用默认API Key:', defaultApiKey.name)
        }

        setDefaultsLoaded(true)
      }
    } catch (error) {
      console.error('获取默认配置失败:', error)
      setDefaultsLoaded(true) // 即使失败也标记为已尝试加载
    }
  }

  // 获取可用模型列表
  const fetchAvailableModels = async () => {
    try {
      setConfigLoading(true)
      const response = await fetch('/api/config/user-model-selection', {
        method: 'PUT', // 使用PUT方法获取可选择的模型列表
      })
      const result = await response.json()

      if (result.success) {
        setAvailableModels(result.data)
      } else {
        message.error('获取可用模型失败')
      }
    } catch (error) {
      message.error('获取可用模型失败')
    } finally {
      setConfigLoading(false)
    }
  }

  // 获取用户当前选择的模型
  const fetchUserModelSelection = async () => {
    try {
      const response = await fetch('/api/config/user-model-selection')
      const result = await response.json()

      if (result.success && result.data) {
        setSelectedModelId(result.data.selectedModelId)
        setCurrentModelConfig(result.data.selectedModel)
      }
    } catch (error) {
      // 静默处理，不显示错误
    }
  }

  // 保存用户模型选择
  const saveUserModelSelection = async (modelId: string) => {
    try {
      setConfigLoading(true)
      const response = await fetch('/api/config/user-model-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedModelId: modelId }),
      })

      const result = await response.json()

      if (result.success) {
        setSelectedModelId(modelId)
        setCurrentModelConfig(result.data.selectedModel)
        message.success(result.message || '模型选择已保存')
      } else {
        message.error(result.error || '保存模型选择失败')
      }
    } catch (error) {
      message.error('保存模型选择失败')
    } finally {
      setConfigLoading(false)
    }
  }

  // 输入框状态 - 不再缓存到localStorage
  const [inputValue, setInputValue] = useState('')

  // 代理模式控制状态
  const [showAgentMode, setShowAgentMode] = useState(true)

  // 移除输入框内容缓存逻辑
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([])
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeReference[]>([])
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([])
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [isK8sMode, setIsK8sMode] = useState(false)

  // AI 决策记录抽屉（展示当前会话相关的 lesson + 最近 outcomes）
  // 用户体验：点头部按钮打开，关闭不影响 chat 主流
  const [decisionLogOpen, setDecisionLogOpen] = useState(false)

  // 主机配置状态
  const [hostConfig, setHostConfig] = useState({
    selectedServerId: ''
  })
  
  // 主机选择模式：'single' | 'group' - 默认为单机模式
  const [hostSelectionMode, setHostSelectionMode] = useState<'single' | 'group'>('single')

  // 服务器列表状态
  const [servers, setServers] = useState<any[]>([])
  const [serverGroups, setServerGroups] = useState<any[]>([])
  const [networkDevices, setNetworkDevices] = useState<ChatTargetDevice[]>([])
  const [k8sClusters, setK8sClusters] = useState<ChatTargetCluster[]>([])
  const [networkGroups, setNetworkGroups] = useState<any[]>([])
  const [loadingServers, setLoadingServers] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [targetSelections, setTargetSelections] = useState<HostTargetSelection[]>([])
  const [cicdContext, setCicdContext] = useState<CICDContextSelection>({})
  const [cicdCatalog, setCicdCatalog] = useState<CICDCatalog>({ projects: [], pipelines: [], deployments: [], builds: [] })

  const selectedGroup = useMemo(
    () => serverGroups.find(group => group.id === selectedGroupId),
    [selectedGroupId, serverGroups]
  )
  const mentionedTargetHostIds = useMemo<string[]>(
    () => Array.from(new Set(targetSelections.flatMap(selection => selection.hostIds))),
    [targetSelections]
  )
  const mentionedNetworkDeviceIds = useMemo<string[]>(
    () => Array.from(new Set(targetSelections.flatMap(selection => selection.deviceIds || []))),
    [targetSelections]
  )
  const effectiveNetworkDevices = useMemo(() => {
    const byId = new Map(networkDevices.map(device => [device.id, device]))
    return mentionedNetworkDeviceIds.map(id => byId.get(id)).filter(Boolean) as ChatTargetDevice[]
  }, [mentionedNetworkDeviceIds, networkDevices])
  const hasNetworkTarget = effectiveNetworkDevices.length > 0
  const groupTargetHostIds = useMemo<string[]>(
    () => hostSelectionMode === 'group' && selectedGroup
      ? (selectedGroup.servers || []).map((server: any) => server.id)
      : [],
    [hostSelectionMode, selectedGroup]
  )
  // 输入框中的显式 @ 选择优先于右侧面板，避免把未预期的主机混入批量任务。
  const effectiveTargetHostIds: string[] = mentionedTargetHostIds.length > 0
    ? mentionedTargetHostIds
    : groupTargetHostIds
  const effectiveTargetHosts = useMemo(() => {
    const allHosts = [...servers, ...(selectedGroup?.servers || [])]
    const byId = new Map(allHosts.map((server: any) => [server.id, server]))
    return effectiveTargetHostIds.map(id => byId.get(id)).filter(Boolean)
  }, [effectiveTargetHostIds, selectedGroup, servers])
  const isBatchExecution = effectiveTargetHostIds.length > 1
  const hasCICDContext = !!(cicdContext.projectId || cicdContext.pipelineId || cicdContext.deploymentId || cicdContext.buildId)
  const deliveryContextCount = [
    cicdContext.projectId,
    cicdContext.pipelineId,
    cicdContext.deploymentId,
    cicdContext.buildId
  ].filter(Boolean).length
  const deliveryContextPrimaryName = cicdContext.deploymentName
    || cicdContext.buildName
    || cicdContext.pipelineName
    || cicdContext.projectName
    || '已选择'
  const deliveryContextSummary = hasCICDContext && deliveryContextCount > 1
    ? `${deliveryContextPrimaryName} +${deliveryContextCount - 1}`
    : deliveryContextPrimaryName
  const deliveryContextTitle = [
    cicdContext.projectName,
    cicdContext.pipelineName,
    cicdContext.deploymentName,
    cicdContext.buildName
  ].filter(Boolean).join(' / ') || deliveryContextPrimaryName
  const cicdMentionOptions = useMemo(
    () => catalogToMentionOptions(cicdCatalog),
    [cicdCatalog]
  )
  const selectedCICDMentions = useMemo(
    () => cicdMentionOptions.filter(option =>
      option.id === cicdContext.projectId
      || option.id === cicdContext.pipelineId
      || option.id === cicdContext.deploymentId
      || option.id === cicdContext.buildId
    ),
    [cicdContext.buildId, cicdContext.deploymentId, cicdContext.pipelineId, cicdContext.projectId, cicdMentionOptions]
  )
  const approvalCoordinator = useMemo(() => {
    // @ 单台主机时直接调用这台主机上的 Agent；只有真正批量时才允许
    // 右侧选中的主机或默认主机充当统一协调节点。
    if (effectiveTargetHosts.length === 1) return effectiveTargetHosts[0]
    return servers.find(server => server.id === hostConfig.selectedServerId)
      || servers.find(server => server.isDefault)
      || effectiveTargetHosts[0]
  }, [effectiveTargetHosts, hostConfig.selectedServerId, servers])
  const hasExecutionTarget = effectiveTargetHostIds.length > 0 || !!hostConfig.selectedServerId
  const hasConversationTarget = hasExecutionTarget || hasCICDContext || hasNetworkTarget

  const handleTargetSelectionsChange = useCallback((next: HostTargetSelection[]) => {
    const hasCluster = next.some(item => item.type === 'cluster')
    const hasNonCluster = next.some(item => item.type !== 'cluster')
    if (hasCluster && hasNonCluster) {
      const selectingCluster = next[next.length - 1]?.type === 'cluster'
      message.warning('一次对话不能混合集群和其他资源，已按最后选择的资源类型切换。')
      setTargetSelections(next.filter(item => selectingCluster ? item.type === 'cluster' : item.type !== 'cluster'))
      if (selectingCluster) setIsK8sMode(true)
      return
    }
    const hasHost = next.some(item => item.hostIds.length > 0)
    const hasDevice = next.some(item => (item.deviceIds?.length || 0) > 0)
    if (hasHost && hasDevice) {
      const newest = next[next.length - 1]
      const selectingDevice = (newest.deviceIds?.length || 0) > 0
      message.warning('一次对话不能混合服务器和网络设备，已按最后选择的资源类型切换。')
      setTargetSelections(next.filter(item => selectingDevice ? (item.deviceIds?.length || 0) > 0 : item.hostIds.length > 0))
      return
    }
    setTargetSelections(next)
    if (hasCluster) setIsK8sMode(true)
  }, [])

  const handleCICDMentionSelect = useCallback((selection: CICDMentionOption) => {
    if (selection.type === 'project') {
      const project = cicdCatalog.projects.find(item => item.id === selection.id)
      setCicdContext({
        kind: 'project',
        projectId: selection.id,
        projectName: project?.name || selection.label
      })
      return
    }

    if (selection.type === 'deployment') {
      const deployment = cicdCatalog.deployments.find(item => item.id === selection.id)
      const project = cicdCatalog.projects.find(item => item.id === deployment?.projectId)
      setCicdContext({
        kind: 'deployment',
        projectId: deployment?.projectId || undefined,
        projectName: project?.name || deployment?.projectName || undefined,
        deploymentId: selection.id,
        deploymentName: deployment?.name || selection.label
      })
      return
    }

    if (selection.type === 'pipeline') {
      const pipeline = cicdCatalog.pipelines.find(item => item.id === selection.id)
      const project = cicdCatalog.projects.find(item => item.id === pipeline?.projectId)
      setCicdContext({
        kind: 'pipeline',
        projectId: pipeline?.projectId || undefined,
        projectName: project?.name || pipeline?.projectName || undefined,
        pipelineId: selection.id,
        pipelineName: pipeline?.name || selection.label
      })
      return
    }

    const build = cicdCatalog.builds.find(item => item.id === selection.id)
    const project = cicdCatalog.projects.find(item => item.id === build?.projectId)
    setCicdContext({
      kind: 'build',
      projectId: build?.projectId || undefined,
      projectName: project?.name || build?.projectName || undefined,
      pipelineId: build?.pipelineId || undefined,
      pipelineName: build?.pipelineName || undefined,
      buildId: selection.id,
      buildName: build?.name || selection.label
    })
  }, [cicdCatalog])

  const handleCICDMentionRemove = useCallback((selection: CICDMentionOption) => {
    setCicdContext(current => {
      if (selection.type === 'project') return {}
      if (selection.type === 'pipeline') {
        return current.projectId ? {
          kind: 'project',
          projectId: current.projectId,
          projectName: current.projectName
        } : {}
      }
      if (selection.type === 'deployment') {
        return current.pipelineId ? {
          kind: 'pipeline',
          projectId: current.projectId,
          projectName: current.projectName,
          pipelineId: current.pipelineId,
          pipelineName: current.pipelineName
        } : current.projectId ? {
          kind: 'project',
          projectId: current.projectId,
          projectName: current.projectName
        } : {}
      }
      return current.pipelineId ? {
        kind: 'pipeline',
        projectId: current.projectId,
        projectName: current.projectName,
        pipelineId: current.pipelineId,
        pipelineName: current.pipelineName
      } : current.projectId ? {
        kind: 'project',
        projectId: current.projectId,
        projectName: current.projectName
      } : {}
    })
  }, [])

  const handleCICDOperationClick = useCallback((operation: string) => {
    setInputValue(current => current.trim()
      ? `${operation} ${current.trim()}`
      : `${operation} `
    )
    requestAnimationFrame(() => textAreaRef.current?.focus())
  }, [])

  // kubelet-wuhrai检查状态
  const [kubeletCheckLoading, setKubeletCheckLoading] = useState(false)

  const textAreaRef = useRef<any>(null)
  const cicdDeepLinkAppliedRef = useRef(false)

  const handleCICDCatalogChange = useCallback((catalog: CICDCatalog) => {
    setCicdCatalog(catalog)
    setCicdContext(current => {
      const project = catalog.projects.find(item => item.id === current.projectId)
      const pipeline = catalog.pipelines.find(item => item.id === current.pipelineId)
      const deployment = catalog.deployments.find(item => item.id === current.deploymentId)
      const build = catalog.builds.find(item => item.id === current.buildId)
      return {
        ...current,
        projectName: project?.name || current.projectName,
        pipelineName: pipeline?.name || build?.pipelineName || current.pipelineName,
        deploymentName: deployment?.name || current.deploymentName,
        buildName: build?.name || current.buildName
      }
    })
  }, [])

  // CI/CD 页面通过只包含数据库 ID 的深链接进入助手；名称和快照仍由服务端目录与解析器补齐。
  useEffect(() => {
    if (cicdDeepLinkAppliedRef.current || typeof window === 'undefined') return
    cicdDeepLinkAppliedRef.current = true

    // 兼容旧查询参数链接；新链接使用 hash，避免认证重定向时丢失上下文。
    const queryParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const hasQueryContext = ['projectId', 'pipelineId', 'deploymentId', 'buildId']
      .some(key => queryParams.has(key))
    const params = hasQueryContext ? queryParams : hashParams
    const projectId = params.get('projectId') || undefined
    const pipelineId = params.get('pipelineId') || undefined
    const deploymentId = params.get('deploymentId') || undefined
    const buildId = params.get('buildId') || undefined
    if (!projectId && !pipelineId && !deploymentId && !buildId) return

    setCicdContext({
      kind: buildId ? 'build' : deploymentId ? 'deployment' : pipelineId ? 'pipeline' : 'project',
      projectId,
      pipelineId,
      deploymentId,
      buildId
    })
    const intent = params.get('intent') || 'status'
    setInputValue(CICD_INTENT_PROMPTS[intent] || CICD_INTENT_PROMPTS.status)
    requestAnimationFrame(() => textAreaRef.current?.focus())
  }, [])

  // 获取服务器列表
  const fetchServers = async () => {
    setLoadingServers(true)
    try {
      const response = await fetch('/api/admin/servers?limit=100', {
        credentials: 'include', // 包含httpOnly cookie
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // 转换服务器数据格式 - 注意API返回的是 { servers, pagination } 结构
          const serverList = data.data.servers || data.data || []
          const formattedServers = serverList.map((server: any) => ({
            id: server.id,
            name: server.name,
            hostname: server.hostname,
            ip: server.ip || server.hostname, // 使用ip字段，如果没有则使用hostname
            status: server.status || 'offline', // 直接使用数据库中的状态
            tags: Array.isArray(server.tags) ? server.tags : [],
            groupId: server.groupId,
            groupName: server.group?.name,
            port: server.port || 22,
            username: server.username,
            datacenter: server.location, // 使用location字段作为datacenter
            isDefault: server.isDefault || false // 包含默认状态
          }))
          setServers(formattedServers)
          console.log('✅ 获取服务器列表成功，共', formattedServers.length, '台服务器')
        } else {
          console.error('获取服务器列表失败:', data.error)
          message.error('获取服务器列表失败')
        }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('获取服务器列表失败:', error)
      message.error('获取服务器列表失败')
    } finally {
      setLoadingServers(false)
    }
  }

  // 获取主机组列表
  const fetchServerGroups = async () => {
    try {
      const response = await fetch('/api/servers/groups', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setServerGroups(data.data)
          console.log('✅ 获取主机组列表成功，共', data.data.length, '个主机组')
        }
      }
    } catch (error) {
      console.error('获取主机组列表失败:', error)
    }
  }

  // 获取网络设备和设备组。凭据字段由后端脱敏，浏览器只接收 @ 选择所需元数据。
  const fetchNetworkTargets = async () => {
    try {
      const [devicesResponse, groupsResponse] = await Promise.all([
        fetch('/api/network/devices', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/network/groups', { credentials: 'include', cache: 'no-store' })
      ])
      if (!devicesResponse.ok || !groupsResponse.ok) return
      const [devicesPayload, groupsPayload] = await Promise.all([devicesResponse.json(), groupsResponse.json()])
      if (!devicesPayload.success || !groupsPayload.success) return
      const groups = groupsPayload.data || []
      setNetworkGroups(groups)
      setNetworkDevices((devicesPayload.data || []).map((device: any) => ({
        id: device.id,
        name: device.name,
        managementIp: device.managementIp,
        status: device.status || 'unknown',
        type: device.type,
        vendor: device.vendor,
        platform: device.platform,
        tags: Array.isArray(device.tags) ? device.tags : [],
        groupId: device.groupId,
        groupName: groups.find((group: any) => group.id === device.groupId)?.name,
        readOnly: device.readOnly === true
      })))
    } catch (error) {
      console.warn('获取网络设备目标失败:', error)
    }
  }

  const fetchK8sClusters = async () => {
    try {
      const response = await fetch('/api/k8s/clusters', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json()
      if (response.ok && payload.success) setK8sClusters(payload.data || [])
    } catch (error) {
      console.warn('获取 Kubernetes 集群目标失败:', error)
    }
  }

  const fetchKnowledgeDocuments = async () => {
    try {
      const response = await fetch('/api/knowledge/documents', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json()
      if (response.ok && payload.success) setKnowledgeDocuments(payload.data || [])
    } catch (error) {
      console.warn('获取知识文档失败:', error)
    }
  }

  const handleKnowledgeSelection = async (ids: string[]) => {
    setSelectedKnowledgeIds(ids)
    const missing = ids.filter(id => !knowledgeDocuments.find(item => item.id === id)?.content)
    if (missing.length === 0) return
    const loaded = await Promise.all(missing.map(async id => {
      const response = await fetch(`/api/knowledge/documents/${id}`, { credentials: 'include', cache: 'no-store' })
      const payload = await response.json()
      return response.ok && payload.success ? payload.data as KnowledgeReference : null
    }))
    setKnowledgeDocuments(current => current.map(item => loaded.find(detail => detail?.id === item.id) || item))
  }

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查焦点是否在输入框或其他可编辑元素上
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.contentEditable === 'true') {
        return // 在输入框中不触发快捷键
      }

      // Ctrl + K: 切换K8s模式
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setIsK8sMode(prev => !prev)
        message.info(`已切换到${!isK8sMode ? 'K8s集群' : 'Linux系统'}模式`)
      }
      // Ctrl + L: 强制切换到Linux模式
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        setIsK8sMode(false)
        message.info('已切换到Linux模式')
      }
    }

    // 添加全局键盘事件监听
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      // 确保移除事件监听器
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isK8sMode])

  // 组件清理函数 - 修复内存泄漏和状态清理
  useEffect(() => {
    return () => {
      console.log('🧹 [SystemChat] 组件卸载，清理所有状态和资源')
      
      // 🔥 清理组件本地状态
      setInputValue('')
      setUploadedFiles([])
      setShowFileUpload(false)
      setShowHistory(false)
      setHistorySearchQuery('')
      setAgentStreamData([]) // 清理Agent流式数据
      setShowAgentStream(false)
      
      // 🔥 清理服务器和模型相关状态
      setServers([])
      setServerGroups([])
      setNetworkDevices([])
      setNetworkGroups([])
      setKnowledgeDocuments([])
      setSelectedKnowledgeIds([])
      setAvailableModels([])
      setSelectedModelId('')
      setCurrentModelConfig(null)
      setHistorySessions([])
      
      // 🔥 修复：清理sessionStorage中的连接测试标记，防止内存泄漏
      try {
        const keys = Object.keys(sessionStorage)
        keys.forEach(key => {
          if (key.startsWith('connection_test_') || 
              key.startsWith('agent_') || 
              key.startsWith('chat_') ||
              key.startsWith('kubelet_check_') ||
              key.startsWith('model_config_') ||
              key.startsWith('server_status_')) {
            sessionStorage.removeItem(key)
          }
        })
        console.log('✅ [SystemChat] sessionStorage清理完成')
      } catch (error) {
        console.warn('清理sessionStorage失败:', error)
      }
      
      console.log('✅ [SystemChat] 组件清理完成')
    }
  }, [])

  // 监听来自AgentStreamRenderer的kubelet检查事件
  useEffect(() => {
    const handleCheckKubeletStatus = (event: CustomEvent) => {
      const { serverId } = event.detail
      if (serverId) {
        checkKubeletWuhrai(serverId)
      }
    }

    window.addEventListener('check-kubelet-status', handleCheckKubeletStatus as EventListener)

    return () => {
      window.removeEventListener('check-kubelet-status', handleCheckKubeletStatus as EventListener)
    }
  }, [])

  // 自动测试服务器连接 - 修复异步时序问题和重复执行
  // 自动测试服务器连接 - 已删除，不再需要连接状态检测

  // 检查kubelet-wuhrai状态
  const checkKubeletWuhrai = async (serverId: string) => {
    if (!serverId) return

    setKubeletCheckLoading(true)
    try {
      const response = await fetch(`/api/servers/${serverId}/check-kubelet-wuhrai`, {
        credentials: 'include', // 包含认证cookie
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

              if (result.success) {
        const { kubeletStatus, kubeletVersion, recommendations } = result.data

        let statusText = ''
        let statusType: 'success' | 'warning' | 'error' = 'error'

        if (kubeletStatus === 'installed') {
          statusText = `✅ kubelet-wuhrai已安装 ${kubeletVersion ? `(v${kubeletVersion})` : ''}`
          statusType = 'success'
        } else if (kubeletStatus === 'auto_installed') {
          statusText = `🚀 kubelet-wuhrai已自动部署 ${kubeletVersion ? `(v${kubeletVersion})` : ''}`
          statusType = 'success'
        } else {
          statusText = '❌ kubelet-wuhrai未安装'
          statusType = 'error'
        }

        // 显示详细信息
        Modal.info({
          title: '远程主机kubelet-wuhrai状态',
          content: (
            <div className="space-y-3">
              <div>
                <strong>状态：</strong> {statusText}
              </div>

              {recommendations.map((rec: any, index: number) => (
                <div key={index} className={`p-2 rounded border ${
                  rec.type === 'success' ? 'bg-transparent text-blue-400 border-blue-500/30' :
                  rec.type === 'warning' ? 'bg-transparent text-yellow-400 border-yellow-500/30' :
                  rec.type === 'error' ? 'bg-transparent text-red-400 border-red-500/30' :
                  'bg-transparent text-blue-400 border-blue-500/30'
                }`}>
                  {rec.message}
                </div>
              ))}

              {kubeletStatus === 'not_installed' && (
                <div className="mt-4 p-3 bg-transparent border border-gray-500/30 rounded">
                  <strong className="text-gray-300">安装选项：</strong>
                  <div className="mt-2 space-y-3">
                    <Button
                      type="primary"
                      icon={<CloudUploadOutlined />}
                      onClick={() => {
                        Modal.destroyAll()
                        installKubeletWuhrai(serverId)
                      }}
                      block
                    >
                      自动安装 kubelet-wuhrai
                    </Button>
                    <div className="text-xs text-gray-500 text-center">
                      或手动在服务器上执行以下命令：
                    </div>
                    <div className="p-2 bg-transparent border border-gray-600/30 rounded text-sm text-gray-400 font-mono">
                      {buildAgentInstallCommand(2081)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ),
          width: 600
        })
      } else {
        message.error(`检查失败: ${result.error}`)
      }
    } catch (error) {
      // 显示更详细的错误信息
      if (error instanceof Error) {
        message.error(`检查kubelet-wuhrai状态失败: ${error.message}`)
      } else {
        message.error('检查kubelet-wuhrai状态失败')
      }

      // 显示错误详情对话框
      Modal.error({
        title: 'kubelet-wuhrai状态检查失败',
        content: (
          <div>
            <p>无法检查远程主机上的kubelet-wuhrai状态。可能的原因：</p>
            <ul>
              <li>SSH连接失败</li>
              <li>远程主机无法访问</li>
              <li>认证问题</li>
              <li>网络连接问题</li>
            </ul>
            <div className="mt-4 p-3 bg-transparent border border-red-500/30 rounded text-red-400">
              <p><strong>错误详情：</strong></p>
              <code className="text-red-300">{error instanceof Error ? error.message : String(error)}</code>
            </div>
          </div>
        ),
        width: 500
      })
    } finally {
      setKubeletCheckLoading(false)
    }
  }

  // 🔥 自动安装kubelet-wuhrai到远程服务器
  const installKubeletWuhrai = async (serverId: string) => {
    if (!serverId) {
      message.error('未选择服务器')
      return
    }

    // 显示安装进度对话框
    const installModal = Modal.info({
      title: '正在安装 kubelet-wuhrai...',
      content: (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Spin size="small" />
            <span>正在连接到远程服务器并执行安装脚本...</span>
          </div>
          <div className="text-gray-400 text-sm">
            这可能需要1-2分钟，请耐心等待
          </div>
        </div>
      ),
      width: 500,
      okButtonProps: { style: { display: 'none' } }
    })

    try {
      const response = await fetch(`/api/servers/${serverId}/install-kubelet-wuhrai`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ port: 2081 })
      })

      const result = await response.json()
      installModal.destroy()

      if (result.success) {
        Modal.success({
          title: 'kubelet-wuhrai 安装成功',
          content: (
            <div className="space-y-3">
              <div className="text-green-400">
                ✅ 服务已成功安装并启动在端口 {result.data?.kubeletPort || 2081}
              </div>
              <div className="mt-3 p-3 bg-transparent border border-gray-600/30 rounded">
                <strong className="text-gray-300">安装日志：</strong>
                <div className="mt-2 max-h-40 overflow-y-auto text-xs text-gray-400 font-mono">
                  {result.data?.logs?.slice(-10).map((log: string, i: number) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          ),
          width: 600
        })

        // 刷新kubelet状态
        setTimeout(() => {
          checkKubeletWuhrai(serverId)
        }, 1000)
      } else {
        Modal.error({
          title: 'kubelet-wuhrai 安装失败',
          content: (
            <div className="space-y-3">
              <div className="text-red-400">
                ❌ {result.error || '安装过程中出现错误'}
              </div>
              {result.data?.logs && (
                <div className="mt-3 p-3 bg-transparent border border-red-500/30 rounded">
                  <strong className="text-gray-300">安装日志：</strong>
                  <div className="mt-2 max-h-40 overflow-y-auto text-xs text-gray-400 font-mono">
                    {result.data.logs.map((log: string, i: number) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-sm text-gray-400">
                请尝试手动安装或检查服务器SSH连接是否正常
              </div>
            </div>
          ),
          width: 600
        })
      }
    } catch (error) {
      installModal.destroy()
      Modal.error({
        title: '安装请求失败',
        content: (
          <div>
            <p className="text-red-400">
              ❌ {error instanceof Error ? error.message : '网络请求失败'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              请检查网络连接和服务器状态
            </p>
          </div>
        )
      })
    }
  }

  // 组件挂载时获取服务器列表和模型配置
  // 移除自动数据预加载，改为按需加载
  // useEffect(() => {
  //   fetchServers()
  //   fetchServerGroups()
  //   fetchAvailableModels()
  //   fetchUserModelSelection()
  // }, [])
  
  // 延迟加载服务器和服务器组数据 - 修复无限循环问题
  const loadHostData = useCallback(async () => {
    console.log('🔄 loadHostData 被调用，当前数据状态 - servers:', servers.length, 'serverGroups:', serverGroups.length)
    if (servers.length === 0) {
      console.log('🔄 正在获取服务器列表...')
      await fetchServers()
    }
    if (serverGroups.length === 0) {
      console.log('🔄 正在获取主机组列表...')
      await fetchServerGroups()
    }
    if (networkDevices.length === 0) {
      await fetchNetworkTargets()
    }
    if (k8sClusters.length === 0) {
      await fetchK8sClusters()
    }
  }, []) // 🔥 修复：移除依赖数组中的状态，避免无限循环
  
  // 延迟加载模型数据 - 修复无限循环问题
  const loadModelData = useCallback(async () => {
    if (availableModels.length === 0) {
      await fetchAvailableModels()
    }
    if (!selectedModelId && !currentModelConfig) {
      await fetchUserModelSelection()
    }
  }, []) // 🔥 修复：移除依赖数组中的状态，避免无限循环

  // 组件挂载时优先加载默认配置 - 修复重复触发问题
  useEffect(() => {
    const initializeComponent = async () => {
      if (!defaultsLoaded) {
        console.log('🚀 开始初始化组件，加载默认配置...')
        // 先确保基础数据已加载，再加载默认配置
        await Promise.all([
          loadHostData(),
          loadModelData(),
          fetchKnowledgeDocuments()
        ])
        
        // 然后加载默认配置
        await fetchDefaultConfigs()
        
        console.log('✅ 组件初始化完成')
      }
    }
    
    initializeComponent()
  }, [defaultsLoaded]) // 🔥 修复：只依赖defaultsLoaded，避免函数引用变化导致重复执行

  // 监听主机配置变化，更新聊天配置 - 只使用远程执行
  useEffect(() => {
    // hostId 始终是运行后端 Agent 的协调节点，主机组 ID 不能冒充主机 ID。
    updateConfig({ hostId: approvalCoordinator?.id })
  }, [approvalCoordinator?.id, updateConfig])



  // 检查是否有可用的模型配置
  const isConfigValid = () => {
    return !!currentModelConfig
  }

  // 导出菜单
  const exportMenuItems = [
    {
      key: 'json',
      label: '导出为 JSON',
      icon: <FileTextOutlined />,
      onClick: () => exportSession()
    },
    {
      key: 'markdown',
      label: '导出为 Markdown',
      icon: <FileTextOutlined />,
      onClick: () => exportSession()
    }
  ]

  // 历史会话状态
  const [historySessions, setHistorySessions] = useState<any[]>([])
  
  // 历史会话列表 - 禁用自动加载，改为按需加载
  useEffect(() => {
    // 移除自动加载历史会话，只有在用户主动打开历史面板时才加载
    // 这样每次进入AI助手都是全新的状态
    console.log('📝 [SystemChat] 组件初始化 - 不自动加载历史会话')
  }, [getSessions, historyRefreshKey])
  
  // 历史会话列表
  const getHistorySessions = () => {
    // 确保返回有效的数组
    const sessions = !historySearchQuery ? historySessions : []

    if (!Array.isArray(sessions)) {
      console.warn('历史会话数据不是数组:', sessions)
      return []
    }

    // 如果有搜索查询，进行客户端搜索
    if (historySearchQuery && typeof window !== 'undefined') {
      return sessions.filter((session: any) => {
        if (!session || !session.title) return false
        return session.title.toLowerCase().includes(historySearchQuery.toLowerCase())
      })
    }

    return sessions
  }

  // 快捷命令 - 前四个：Linux系统运维命令，后四个：K8s集群运维命令
  const quickCommands = [
    // Linux系统运维命令（前四个）
    {
      label: '系统性能监控',
      command: '监控系统CPU、内存、磁盘IO和网络性能指标',
      icon: <MonitorOutlined />,
      description: '实时监控系统关键性能指标',
      category: 'system'
    },
    {
      label: '进程资源分析',
      command: '分析系统进程资源占用，找出高CPU和内存消耗进程',
      icon: <DesktopOutlined />,
      description: '识别和管理资源消耗较高的进程',
      category: 'system'
    },
    {
      label: '存储空间管理',
      command: '检查磁盘空间使用情况，列出大文件和日志',
      icon: <DatabaseOutlined />,
      description: '管理磁盘空间，列出大文件',
      category: 'system'
    },
    {
      label: '网络连接诊断',
      command: '诊断网络连接问题，检查端口监听和防火墙状态',
      icon: <BulbOutlined />,
      description: '排查网络连接和端口访问问题',
      category: 'system'
    },
    // K8s集群运维命令（后四个）
    {
      label: '集群状态检查',
      command: '检查Kubernetes集群状态，包括节点和组件健康状况',
      icon: <ApiOutlined />,
      description: '全面检查K8s集群节点和核心组件状态',
      category: 'k8s'
    },
    {
      label: '系统状态监控',
      command: '查看所有命名空间的Pod运行状态和资源使用情况',
      icon: <ThunderboltOutlined />,
      description: '监控集群中所有Pod的运行状态',
      category: 'k8s'
    },
    {
      label: '服务网络诊断',
      command: '诊断Kubernetes服务网络连接和DNS解析问题',
      icon: <GlobalOutlined />,
      description: '排查K8s服务间网络连接问题',
      category: 'k8s'
    },
    {
      label: '资源配额分析',
      command: '分析集群资源配额使用情况和容量规划建议',
      icon: <FileTextOutlined />,
      description: '查看集群资源使用率和优化建议',
      category: 'k8s'
    }
  ]

  // 动态生成命令显示名称
  const getCommandDisplayName = (cmd: any, index: number) => {
    if (isK8sMode) {
      // K8s模式：所有命令前添加"集群"前缀
      if (cmd.label.startsWith('集群') || cmd.label.startsWith('系统')) {
        return cmd.label.replace(/^(集群|系统)/, '集群')
      }
      return `集群${cmd.label}`
    } else {
      // Linux模式：所有命令前添加"系统"前缀
      if (cmd.label.startsWith('集群') || cmd.label.startsWith('系统')) {
        return cmd.label.replace(/^(集群|系统)/, '系统')
      }
      return `系统${cmd.label}`
    }
  }

  // 发送消息处理
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    // 检查是否已选择模型
    if (!currentModelConfig) {
      message.error('请先选择一个AI模型')
      return
    }

    // 支持右侧单机选择，以及输入框 @ /主机组选择的一台或多台目标。
    if (!hasConversationTarget) {
      message.error('请使用 @ 选择主机或网络设备，或使用 # 选择交付对象')
      return
    }
    if (hasNetworkTarget && !approvalCoordinator) {
      message.error('网络设备对话仍需要一台默认主机作为 AI 协调节点，请先在主机管理中设置默认主机')
      return
    }

    // 删除：不需要显示"正在处理您的请求"提示

    // 智能模式检测
    const currentMode = isK8sMode ? 'k8s' : 'linux'
    const modeDetectionResult = hasNetworkTarget
      ? { detectedMode: 'linux', suggestedMode: 'linux', confidence: 0, reason: '网络设备使用独立执行工具' } as any
      : detectMode(inputValue, currentMode)
    
    // 如果检测到模式不匹配且置信度足够高，询问用户是否切换
    const suggestionText = getModeSuggestionText(modeDetectionResult, currentMode)
    if (suggestionText && modeDetectionResult.confidence > 0.6) {
      const shouldSwitch = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '🤖 智能模式检测',
          content: (
            <div>
              <p>{suggestionText}</p>
              <p className="text-gray-500 text-sm mt-2">
                检测原因: {modeDetectionResult.reason}
              </p>
            </div>
          ),
          okText: `切换到${modeDetectionResult.suggestedMode === 'k8s' ? 'K8s' : 'Linux'}模式`,
          cancelText: '保持当前模式',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })

      if (shouldSwitch) {
        setIsK8sMode(modeDetectionResult.suggestedMode === 'k8s')
        const newModeText = modeDetectionResult.suggestedMode === 'k8s' ? 'K8s集群' : 'Linux系统'
        message.success(`已切换到${newModeText}模式`)
      }
    }

    // 检查当前模型是否支持多模态
    const isMultimodal = isMultimodalModel(config.model)

    let finalMessage = inputValue
    let imageFiles: FileInfo[] = []
    let textFiles: FileInfo[] = []

    // 分类上传的文件
    if (uploadedFiles.length > 0) {
      imageFiles = uploadedFiles.filter(f => f.status === 'success' && f.type.startsWith('image/'))
      textFiles = uploadedFiles.filter(f => f.status === 'success' && !f.type.startsWith('image/') && f.content)

      // 处理文本文件
      if (textFiles.length > 0) {
        const fileContents = textFiles
          .map(f => `[文件: ${f.name}]\n${f.content}`)
          .join('\n\n')
        finalMessage = `${inputValue}\n\n${fileContents}`
      }

      // 处理图像文件
      if (imageFiles.length > 0) {
        if (isMultimodal) {
          // 多模态模型：将图像信息添加到消息中
          const imageInfo = imageFiles
            .map(f => `[图像: ${f.name}]`)
            .join(', ')
          finalMessage = `${finalMessage}\n\n包含图像: ${imageInfo}`
        } else {
          // 非多模态模型：提示用户选择支持图像的模型
          message.warning('当前模型不支持图像理解，请选择支持多模态的模型（如 GPT-4V、Gemini Pro Vision 等）')
          return
        }
      }
    }

    const selectedKnowledge = selectedKnowledgeIds
      .map(id => knowledgeDocuments.find(item => item.id === id))
      .filter((item): item is KnowledgeReference => Boolean(item?.content))
    if (selectedKnowledge.length > 0) {
      const knowledgeContext = selectedKnowledge.map(item =>
        `[知识库来源：${item.title}]\n${(item.content || '').slice(0, 30000)}`
      ).join('\n\n')
      finalMessage = `${finalMessage}\n\n以下是团队知识库的已选参考资料。请区分资料事实与实时检查结果，并在结论中标注来源文档：\n${knowledgeContext}`
    }

    // 构建请求配置,使用数据库中的模型配置
    console.log('🔍 [SystemChat] 当前模型配置:', {
      hasConfig: !!currentModelConfig,
      modelName: currentModelConfig?.modelName,
      provider: currentModelConfig?.provider,
      hasApiKey: !!currentModelConfig?.apiKey,
      apiKeyLength: currentModelConfig?.apiKey?.length,
      baseUrl: currentModelConfig?.baseUrl
    })

    const requestConfig = {
      model: currentModelConfig.modelName,
      apiKey: currentModelConfig.apiKey,
      baseUrl: currentModelConfig.baseUrl,
      provider: currentModelConfig.provider,
      hostId: approvalCoordinator?.id,
      targetHostIds: effectiveTargetHostIds,
      targetHosts: effectiveTargetHosts.map((host: any) => ({
        id: host.id,
        name: host.name,
        ip: host.ip
      })),
      batchLabel: targetSelections.length > 0
        ? targetSelections.map(selection => `@${selection.label}`).join('、')
        : selectedGroup?.name,
      networkDeviceIds: mentionedNetworkDeviceIds,
      networkTargets: effectiveNetworkDevices.map(device => ({
        id: device.id,
        name: device.name,
        managementIp: device.managementIp,
        type: device.type,
        vendor: device.vendor,
        platform: device.platform,
        readOnly: device.readOnly
      })),
      networkBatchLabel: hasNetworkTarget
        ? targetSelections.filter(item => (item.deviceIds?.length || 0) > 0).map(item => `@${item.label}`).join('、')
        : undefined,
      cicdContext,
      isK8sMode: hasNetworkTarget ? false : isK8sMode,
      // 🔧 添加自定义工具
      customTools: customToolsConfig.enabled ? customToolsConfig.tools : [],
      mcpToolsEnabled: mcpToolsConfig.enabled,
      mcpServers: mcpToolsConfig.enabled ? mcpToolsConfig.servers : []
    }

    console.log('🚀 [SystemChat] 发送请求配置:', {
      model: requestConfig.model,
      provider: requestConfig.provider,
      hasApiKey: !!requestConfig.apiKey,
      apiKeyPreview: requestConfig.apiKey ? '[REDACTED]' : '(无)',
      baseUrl: requestConfig.baseUrl,
      hostId: requestConfig.hostId,
      targetCount: requestConfig.targetHostIds.length,
      networkTargetCount: requestConfig.networkDeviceIds.length,
      cicdContext: requestConfig.cicdContext,
      isK8sMode: requestConfig.isK8sMode
    })

    const selectedCluster = targetSelections.find(selection => selection.type === 'cluster')
    if (selectedCluster) {
      finalMessage = `[目标 Kubernetes 集群：${selectedCluster.label}；所有 kubectl/helm 命令必须显式使用 context=${selectedCluster.clusterContext}，默认 namespace=${selectedCluster.defaultNamespace}]\n\n${finalMessage}`
    }
    await sendMessage(finalMessage, requestConfig)

    // 删除：不需要显示"消息已发送"提示

    setInputValue('')
    // 清空已上传文件，不再操作localStorage
    setUploadedFiles([])
  }



  // 根据当前模式生成正确的tooltip描述
  const getTooltipDescription = (cmd: any) => {
    // 如果是K8s模式
    if (isK8sMode) {
      // 如果命令本身就是K8s类别，直接使用原描述
      if (cmd.category === 'k8s') {
        return cmd.description
      }
      // 如果是system类别的命令，转换为K8s相关描述
      switch (cmd.label) {
        case '系统性能监控':
          return '实时监控K8s集群节点关键性能指标'
        case '进程资源分析':
          return '识别和管理集群中资源列出消耗较高的Pod'
        case '存储空间管理':
          return '管理K8s集群存储资源，列出不必要的PV/PVC'
        case '网络连接诊断':
          return '排查K8s集群网络连接和Service访问问题'
        default:
          return cmd.description
      }
    } else {
      // 如果是Linux模式
      // 如果命令本身就是system类别，直接使用原描述
      if (cmd.category === 'system') {
        return cmd.description
      }
      // 如果是k8s类别的命令，转换为Linux系统相关描述
      switch (cmd.label) {
        case '集群状态检查':
          return '全面检查Linux系统状态和核心服务健康度'
        case '系统状态监控':
          return '监控系统中所有进程和服务的运行状态'
        case '服务网络诊断':
          return '排查Linux系统网络连接和服务访问问题'
        case '资源配额分析':
          return '查看系统资源使用率和性能优化建议'
        default:
          return cmd.description
      }
    }
  }

  // 根据当前模式和命令类别生成正确的命令描述
  const getCommandDescription = (cmd: any) => {
    // 如果是K8s模式
    if (isK8sMode) {
      // 如果命令本身就是K8s类别，直接使用原描述
      if (cmd.category === 'k8s') {
        return cmd.command
      }
      // 如果是system类别的命令，转换为K8s相关描述
      switch (cmd.label) {
        case '系统性能监控':
          return '监控Kubernetes集群节点CPU、内存、磁盘IO和网络性能指标'
        case '进程资源分析':
          return '分析Kubernetes集群中Pod和容器资源占用情况'
        case '存储空间管理':
          return '检查Kubernetes集群存储卷使用情况和PV/PVC状态'
        case '网络连接诊断':
          return '诊断Kubernetes集群网络连接问题，检查Service和Ingress状态'
        default:
          return cmd.command
      }
    } else {
      // 如果是Linux模式
      // 如果命令本身就是system类别，直接使用原描述
      if (cmd.category === 'system') {
        return cmd.command
      }
      // 如果是k8s类别的命令，转换为Linux系统相关描述
      switch (cmd.label) {
        case '集群状态检查':
          return '检查Linux系统状态，包括服务运行状况和系统健康度'
        case '系统状态监控':
          return '查看系统进程状态和服务运行情况'
        case '服务网络诊断':
          return '诊断Linux系统网络连接和DNS解析问题'
        case '资源配额分析':
          return '分析系统资源使用情况和性能优化建议'
        default:
          return cmd.command
      }
    }
  }

  const handleQuickCommand = (cmd: any) => {
    const commandDescription = getCommandDescription(cmd)
    setInputValue(commandDescription)
    textAreaRef.current?.focus()
  }

  // MCP 菜单只负责明确用户意图，不自动发送或执行工具。
  const handleMCPToolClick = (tool: MCPToolSelection) => {
    const instruction = `请使用 MCP 工具「${tool.serverName}/${tool.toolName}」`
    setInputValue(currentValue => currentValue.trim()
      ? `${currentValue.trimEnd()}\n${instruction}：`
      : `${instruction}：`
    )
    requestAnimationFrame(() => {
      textAreaRef.current?.focus()
      const textarea = textAreaRef.current?.resizableTextArea?.textArea
      const cursor = textarea?.value?.length || 0
      textarea?.setSelectionRange(cursor, cursor)
    })
    message.success(`已加载 MCP 工具：${tool.toolName}`)
  }

  // 文件上传处理
  const handleFileAnalyzed = (files: FileInfo[]) => {
    setUploadedFiles(files)
  }

  const handleFileContentChange = (content: string) => {
    setInputValue(content)
    textAreaRef.current?.focus()
  }

  // 只滚动消息容器，避免 scrollIntoView 连带滚动外层页面并遮住顶部工具栏。
  const scrollToBottom = useCallback(() => {
    const messageList = messageListRef.current
    if (!messageList) return
    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: isStreaming ? 'auto' : 'smooth'
    })
  }, [isStreaming])

  // 监听消息变化，自动滚动
  useEffect(() => {
    const frameId = requestAnimationFrame(scrollToBottom)
    return () => cancelAnimationFrame(frameId)
  }, [messages, streamingMessage, scrollToBottom])

  // 使用ref跟踪完成状态，避免无限循环
  const completionMarkAddedRef = useRef(false)
  const lastStreamingMessageRef = useRef('')
  const agentDataSavedRef = useRef(false) // 🔥 跟踪agentStreamData是否已保存
  const agentStreamDataRef = useRef(agentStreamData) // 🔥 保持agentStreamData的最新引用
  const streamingMessageIdRef = useRef(streamingMessageId) // 🔥 保持streamingMessageId的最新引用

  // 同步agentStreamData到ref
  useEffect(() => {
    agentStreamDataRef.current = agentStreamData
  }, [agentStreamData])

  // 同步streamingMessageId到ref
  useEffect(() => {
    streamingMessageIdRef.current = streamingMessageId
  }, [streamingMessageId])

  // 🔥 监听isStreaming状态变化，当新消息开始时清空Agent流式数据
  const prevIsStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (isStreaming && !prevIsStreamingRef.current) {
      // 从false变为true，说明开始新的流式消息
      console.log('🔄 [SystemChat] 检测到新流式消息开始，清空旧的执行流程数据')
      setAgentStreamData([])
      setShowAgentStream(false)
      lastStreamingMessageRef.current = ''
      completionMarkAddedRef.current = false
      agentDataSavedRef.current = false // 重置保存标记
    }
    prevIsStreamingRef.current = isStreaming
  }, [isStreaming])

  // 监听流式消息变化，实时更新Agent流式数据
  useEffect(() => {
    if (isStreaming && streamingMessage && streamingMessage !== lastStreamingMessageRef.current) {
      lastStreamingMessageRef.current = streamingMessage
      completionMarkAddedRef.current = false // 重置完成标记

      // 解析流式消息并更新Agent流式数据
      try {
        // 尝试解析最新的流式数据
        const lines = streamingMessage.split('\n')
        const newStreamData: typeof agentStreamData = []

        for (const line of lines) {
          if (line.includes('🤔')) {
            newStreamData.push({
              type: 'thinking',
              content: line.replace('🤔 ', ''),
              timestamp: new Date().toISOString()
            })
          } else if (line.includes('💻 执行:')) {
            // 🔧 提取toolName（格式: "💻 执行: [toolName] command" 或 "💻 执行: command"）
            const commandMatch = line.match(/💻 执行: (?:\[([^\]]+)\] )?(.+)/)
            const toolName = commandMatch?.[1] // toolName在括号内
            const command = commandMatch?.[2] || line.replace('💻 执行: ', '') // 命令内容

            newStreamData.push({
              type: 'command',
              content: command,
              timestamp: new Date().toISOString(),
              metadata: toolName ? { toolName } : undefined
            })
          } else if (line.includes('命令已拒绝')) {
            // 🔥 检测到命令拒绝标记
            newStreamData.push({
              type: 'command_rejected',
              content: line.replace(/^命令已拒绝:\s*/, ''),
              timestamp: new Date().toISOString()
            })
          } else if (line.includes('🔐 命令需要批准')) {
            // 🔥 检测到批准请求标记 - 从文本中提取approvalId并添加到对应command的metadata
            const approvalIdMatch = line.match(/🔐 命令需要批准 (.+)/)
            const approvalIdFromText = approvalIdMatch ? approvalIdMatch[1].trim() : null

            // 🔥 从pendingApprovals数组中查找对应的批准请求
            const currentMessage = messages.find(msg =>
              msg.metadata?.pendingApprovals?.some((approval: any) =>
                approval.approvalId === approvalIdFromText
              )
            )
            const approvalData = currentMessage?.metadata?.pendingApprovals?.find((approval: any) =>
              approval.approvalId === approvalIdFromText
            )

            if (approvalData && newStreamData.length > 0) {
              // 找到最后一个command类型的数据
              const lastCommandIndex = newStreamData.map((item, idx) => ({ item, idx }))
                .reverse()
                .find(({ item }) => item.type === 'command')?.idx

              if (lastCommandIndex !== undefined) {
                // 将批准信息添加到command的metadata中
                newStreamData[lastCommandIndex] = {
                  ...newStreamData[lastCommandIndex],
                  metadata: {
                    ...newStreamData[lastCommandIndex].metadata,
                    approvalId: approvalData.approvalId,
                    command: approvalData.command,
                    tool: approvalData.tool,
                    hostInfo: approvalData.hostInfo
                  }
                }
              }
            }
            // 不创建新的数据项，跳过这一行
          } else if (line.includes('💬 AI回复:')) {
            // 🔥 检测到AI回复标记，后续内容是命令输出，标记为output类型
            newStreamData.push({
              type: 'output',
              content: '', // 标记行本身不显示内容
              timestamp: new Date().toISOString(),
              metadata: { isOutputStart: true }
            })
          } else if (line.trim() && !line.includes('🤔') && !line.includes('💻') && !line.includes('🔐') && !line.includes('命令已拒绝')) {
            // 🔥 检查前一项是否是output类型，如果是则继续添加为output
            const lastItem = newStreamData[newStreamData.length - 1]
            if (lastItem && lastItem.type === 'output') {
              newStreamData.push({
                type: 'output',
                content: line,
                timestamp: new Date().toISOString()
              })
            }
            // 🔥 跳过其他text内容（AI分析总结）
          }
        }

        if (newStreamData.length > 0) {
          setAgentStreamData(newStreamData)
          setShowAgentStream(true)
        }
      } catch (error) {
        console.warn('解析Agent流式数据失败:', error)
      }
    }
  }, [isStreaming, streamingMessage, messages])

  // 单独处理流式结束状态 - 使用ref避免依赖agentStreamData
  useEffect(() => {
    if (!isStreaming && showAgentStream && !completionMarkAddedRef.current) {
      completionMarkAddedRef.current = true
      setAgentStreamData(prev => {
        // 检查是否已经有完成标记
        const hasCompletionMark = prev.some(item => item.type === 'done')
        if (!hasCompletionMark && prev.length > 0) {
          return [...prev, {
            type: 'done',
            content: '执行完成',
            timestamp: new Date().toISOString()
          }]
        }
        return prev
      })
    }
  }, [isStreaming, showAgentStream])

  // 🔥 保存AgentStreamData到消息metadata (流式结束时) - 使用ref避免依赖警告
  useEffect(() => {
    if (!isStreaming && !agentDataSavedRef.current) {
      // 延迟保存,确保agentStreamData已完全更新
      const timeoutId = setTimeout(() => {
        const currentAgentData = agentStreamDataRef.current
        const currentMessageId = streamingMessageIdRef.current

        if (currentAgentData.length > 0 && currentMessageId) {
          console.log('💾 [历史会话] 保存AgentStreamData到消息:', {
            messageId: currentMessageId,
            dataCount: currentAgentData.length
          })

          agentDataSavedRef.current = true

          // 🔥 更新本地state（历史会话通过解析内容恢复，不需要存储到Redis）
          setMessages(prev => prev.map(msg => {
            if (msg.id === currentMessageId && msg.type === 'ai') {
              return {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  agentStreamData: currentAgentData
                }
              }
            }
            return msg
          }))
        }
      }, 500) // 延迟500ms保存

      return () => clearTimeout(timeoutId)
    }
  }, [isStreaming])

  // 🔄 加载会话时恢复AgentStreamData
  useEffect(() => {
    // 🔥 只在非流式状态下才恢复数据
    if (isStreaming) return

    // 🔥 找到最后一条AI消息
    const lastAiMessage = messages.filter(msg => msg.type === 'ai').pop()

    if (lastAiMessage?.metadata?.agentStreamData && lastAiMessage.metadata.agentStreamData.length > 0) {
      console.log('🔄 [历史会话] 恢复AgentStreamData:', {
        messageId: lastAiMessage.id,
        dataCount: lastAiMessage.metadata.agentStreamData.length
      })
      setAgentStreamData(lastAiMessage.metadata.agentStreamData)
      setShowAgentStream(true)
    } else if (lastAiMessage && !lastAiMessage.metadata?.agentStreamData) {
      // 🔥 如果最后一条AI消息没有执行流程数据,清空全局agentStreamData
      console.log('🔄 [历史会话] 清空全局AgentStreamData,避免显示旧数据')
      setAgentStreamData([])
      setShowAgentStream(false)
    }
  }, [messages, isStreaming])

  // 🔧 从消息内容解析AgentStreamData的辅助函数
  const parseContentToAgentStreamData = (content: string): typeof agentStreamData => {
    const lines = content.split('\n')
    const streamData: typeof agentStreamData = []
    let isInAIReply = false
    let aiReplyContent = ''

    // 辅助函数:保存AI回复
    const saveAIReply = () => {
      if (isInAIReply && aiReplyContent.trim()) {
        streamData.push({
          type: 'text',
          content: aiReplyContent.trim(),
          timestamp: new Date().toISOString()
        })
        isInAIReply = false
        aiReplyContent = ''
      }
    }

    for (const line of lines) {
      if (line.includes('🤔')) {
        // 遇到新的思考标记,先保存之前的AI回复
        saveAIReply()
        streamData.push({
          type: 'thinking',
          content: line.replace('🤔 ', '').trim(),
          timestamp: new Date().toISOString()
        })
      } else if (line.includes('💻 执行:')) {
        // 遇到新的命令标记,先保存之前的AI回复
        saveAIReply()
        // 🔧 提取toolName（格式: "💻 执行: [toolName] command" 或 "💻 执行: command"）
        const commandMatch = line.match(/💻 执行: (?:\[([^\]]+)\] )?(.+)/)
        const toolName = commandMatch?.[1]
        const command = commandMatch?.[2] || line.replace('💻 执行: ', '').trim()

        streamData.push({
          type: 'command',
          content: command,
          timestamp: new Date().toISOString(),
          metadata: toolName ? { toolName } : undefined
        })
      } else if (line.includes('💬 AI回复:')) {
        // 开始收集AI回复内容
        saveAIReply() // 先保存之前的AI回复(如果有)
        isInAIReply = true
        aiReplyContent = ''
      } else if (line.includes('📤 输出:')) {
        // 遇到输出标记,先保存之前的AI回复
        saveAIReply()
        // 然后添加输出
        streamData.push({
          type: 'output',
          content: line.replace('📤 输出:', '').trim(),
          timestamp: new Date().toISOString()
        })
      } else if (line.includes('✅') || line.includes('❌')) {
        // 遇到状态标记,先保存之前的AI回复
        saveAIReply()
        streamData.push({
          type: 'output',
          content: line.replace(/^(✅|❌)\s*/, '').trim(),
          timestamp: new Date().toISOString()
        })
      } else if (isInAIReply) {
        // 收集AI回复的内容行
        aiReplyContent += (aiReplyContent ? '\n' : '') + line
      }
    }

    // 如果最后还有未保存的AI回复
    saveAIReply()

    return streamData
  }

  // 🔧 加载自定义工具配置和其他配置
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        // 加载自定义工具配置
        const customToolsResponse = await fetch('/api/config/custom-tools')
        const customToolsData = await customToolsResponse.json()
        if (customToolsData.success) {
          setCustomToolsConfig(customToolsData.data)
        }

        // 加载MCP工具配置
        const mcpResponse = await fetch('/api/config/mcp-tools')
        const mcpData = await mcpResponse.json()
        if (mcpData.success) {
          setMcpToolsConfig({
            enabled: mcpData.data?.enabled || false,
            servers: Array.isArray(mcpData.data?.servers) ? mcpData.data.servers : []
          })
        }

        // 加载安全控制配置
        const securityResponse = await fetch('/api/config/security')
        const securityData = await securityResponse.json()
        if (securityData.success) {
          setSecurityEnabled(securityData.data?.enabled ?? true)
        }
      } catch (error) {
        console.error('加载配置失败:', error)
      }
    }

    const handleSecurityConfigUpdated = (event: Event) => {
      setSecurityEnabled((event as CustomEvent).detail?.enabled ?? true)
    }
    const handleMCPConfigUpdated = (event: Event) => {
      const nextConfig = (event as CustomEvent).detail
      setMcpToolsConfig({
        enabled: nextConfig?.enabled ?? false,
        servers: Array.isArray(nextConfig?.servers) ? nextConfig.servers : []
      })
    }
    const handleCustomToolsConfigUpdated = (event: Event) => {
      const nextConfig = (event as CustomEvent).detail
      setCustomToolsConfig({
        enabled: nextConfig?.enabled ?? false,
        tools: Array.isArray(nextConfig?.tools) ? nextConfig.tools : []
      })
    }

    loadConfigs()
    window.addEventListener('security-config-updated', handleSecurityConfigUpdated)
    window.addEventListener('mcp-config-updated', handleMCPConfigUpdated)
    window.addEventListener('custom-tools-config-updated', handleCustomToolsConfigUpdated)
    return () => {
      window.removeEventListener('security-config-updated', handleSecurityConfigUpdated)
      window.removeEventListener('mcp-config-updated', handleMCPConfigUpdated)
      window.removeEventListener('custom-tools-config-updated', handleCustomToolsConfigUpdated)
    }
  }, [])

  // 🔧 根据toolName（id）查找displayName的辅助函数
  const getToolDisplayName = (toolName: string): string => {
    const tool = customToolsConfig.tools.find(t => t.id === toolName || t.name === toolName)
    return tool?.displayName || tool?.name || toolName
  }

  // 渲染消息
  const renderMessage = (msg: any, index: number) => {
    const isUser = msg.type === 'user'
    const isError = msg.status === 'error'

    // 🔧 检查是否使用了自定义工具（从当前消息的agentStreamData或从前一条用户消息）
    const hasCustomTool = !isUser && (
      // 方法1: 从agentStreamData检测
      (msg.metadata?.agentStreamData?.some((item: any) => item.type === 'command' && item.metadata?.toolName)) ||
      // 方法2: 检查前一条用户消息是否包含"使用XXX工具"
      (index > 0 && messages[index - 1]?.type === 'user' && /使用.+工具/.test(messages[index - 1]?.content))
    )

    const customToolName = hasCustomTool ? (
      msg.metadata?.agentStreamData?.find((item: any) => item.metadata?.toolName)?.metadata?.toolName ||
      messages[index - 1]?.content?.match(/使用(.+?)工具/)?.[1]
    ) : null

    return (
      <div
        key={msg.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 ${styles.messageAppear}`}
      >
        <div
          className={`flex items-start space-x-3 ${
            isUser ? 'flex-row-reverse space-x-reverse max-w-[75%] ml-auto' : 'w-full pr-3'
          }`}
        >
          {/* 头像 - 固定尺寸防止变形 */}
          <div className={`flex-shrink-0 ${styles.avatarFixed}`}>
            <Avatar
              size={40}
              icon={isUser ? <UserOutlined /> : <RobotOutlined />}
              className={
                isUser
                  ? 'bg-blue-500'
                  : isError
                  ? 'bg-red-500'
                  : 'bg-gradient-to-br from-green-500 to-blue-500'
              }
            />
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            {isUser ? (
              <UserMessageRenderer
                content={msg.content}
                timestamp={msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp}
                className="user-message"
              />
            ) : (
              <div>
                {/* Agent流式执行过程显示 - 移到AI回复上方，执行完成后自动折叠 */}
                {(() => {
                  // 🔥 判断是否显示执行流程 - 每条消息只显示自己的数据
                  let currentStreamData: typeof agentStreamData = []
                  let shouldShowStream = false

                  // 情况1: 当前正在流式传输的消息（实时显示）
                  if (isStreaming && showAgentStream && agentStreamData.length > 0 && index === messages.length - 1) {
                    currentStreamData = agentStreamData
                    shouldShowStream = true
                  }
                  // 情况2: 历史消息或已完成的消息 - 只使用消息自己metadata中的数据
                  else if (!isStreaming || index < messages.length - 1) {
                    if (msg.metadata?.agentStreamData && msg.metadata.agentStreamData.length > 0) {
                      currentStreamData = msg.metadata.agentStreamData
                      shouldShowStream = true
                    }
                  }

                  // 🔥 检查是否使用了自定义工具（针对当前消息）
                  // 🔥 只有当用户明确说"使用XX工具"时，才显示自定义工具标签
                  // 不再根据执行的命令来判断，避免误判
                  const msgHasCustomTool = (index > 0 && messages[index - 1]?.type === 'user' && /使用.+工具/.test(messages[index - 1]?.content))

                  // 🔧 从用户消息中提取工具名称
                  const toolId = messages[index - 1]?.content?.match(/使用(.+?)工具/)?.[1]
                  const msgCustomToolName = msgHasCustomTool && toolId ? getToolDisplayName(toolId) : null

                  return shouldShowStream && currentStreamData.length > 0 ? (
                    <div className="mb-4">
                      <AgentStreamRenderer
                        streamData={currentStreamData as any}
                        isStreaming={isStreaming && index === messages.length - 1}
                        className="agent-stream-display"
                        autoCollapse={!(isStreaming && index === messages.length - 1)} // 🔥 流式中不折叠，完成后默认折叠
                        customToolName={msgHasCustomTool ? msgCustomToolName || undefined : undefined}
                        hostInfo={approvalCoordinator
                          ? { ip: approvalCoordinator.ip, port: 2081 }
                          : undefined}
                      />
                    </div>
                  ) : null
                })()}

                {/* 显示思考状态的加载动画 */}
                {msg.metadata?.isThinking ? (
                  <div className="flex items-center space-x-2 py-4">
                    <Spin size="small" />
                    <Text className="text-gray-400 text-sm">AI正在思考...</Text>
                  </div>
                ) : (
                  <>
                    <EnhancedAIMessageRenderer
                      content={msg.content}
                      messageId={msg.id}
                      isError={isError}
                      isRejected={msg.status === 'rejected' || msg.metadata?.approvalRejected === true}
                      isStreaming={false}
                      isAgentMode={showAgentMode && isAgentMode}
                      agentSession={getMessageAgentSession(msg.id)}
                      metadata={msg.metadata}
                      className="ai-response"
                      onAgentModeToggle={(enabled) => {
                        setShowAgentMode(enabled)
                      }}
                    />
                  </>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto lg:overflow-hidden">
        <Row gutter={24} className="min-h-0 lg:h-full lg:flex-1">
          {/* 左侧对话区域 */}
          <Col xs={24} lg={18} className="flex min-h-[640px] flex-col lg:h-full lg:min-h-0">
          <Card
            title={
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 shadow-sm shadow-blue-500/20">
                    <RobotOutlined className="text-sm text-white" />
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Text strong className={`shrink-0 !text-sm ${isDark ? '!text-white' : '!text-slate-900'}`}>
                      Wuhr AI
                    </Text>
                    <Text
                      className={`hidden max-w-[76px] truncate !text-xs lg:inline ${isDark ? 'text-gray-400' : 'text-slate-500'}`}
                      title={currentModelConfig?.displayName || '选择模型'}
                    >
                      {currentModelConfig?.displayName || '选择模型'}
                    </Text>
                    <span className={`
                      hidden shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium sm:inline-flex
                      ${isK8sMode
                        ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                        : 'border-green-500/40 bg-green-500/15 text-green-400'
                      }
                    `}>
                      {isK8sMode ? 'K8s' : 'Linux'}
                    </span>
                  </div>
                  <div className={`flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 ${
                    isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <Badge status={isLoading ? 'processing' : isConfigValid() ? 'success' : 'error'} />
                    <Text className={`hidden !text-[11px] md:inline ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      {isLoading ? '处理中' : isConfigValid() ? '就绪' : '未配置'}
                    </Text>
                  </div>
                </div>

                <div className={`flex shrink-0 items-center gap-1 rounded-lg border p-1 ${
                  isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50/90'
                }`}>

                  {/* AI 决策记录抽屉：展示本次会话相关的 lesson + 最近 skill outcomes */}
                  <Tooltip title="查看本会话相关的 AI 资产（lessons / outcomes）">
                    <Button
                      size="small"
                      icon={<BulbOutlined className="text-amber-500" />}
                      onClick={() => setDecisionLogOpen(true)}
                      className={HEADER_ACTION_BUTTON_CLASS}
                    >
                      <span className={HEADER_ACTION_LABEL_CLASS}>决策记录</span>
                    </Button>
                  </Tooltip>

                  <Tooltip title="创建一个全新的 AI 会话">
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={async () => {
                        console.log('🔄 [SystemChat] 用户点击新会话按钮，清理组件状态')

                        // 🔥 清理SystemChat组件的本地状态
                        setInputValue('')
                        setUploadedFiles([])
                        setShowFileUpload(false)
                        setAgentStreamData([]) // 清理Agent流式数据
                        setShowAgentStream(false)

                        // 🔥 清理sessionStorage中的连接测试标记
                        try {
                          const keys = Object.keys(sessionStorage)
                          keys.forEach(key => {
                            if (key.startsWith('connection_test_') || key.startsWith('agent_') || key.startsWith('chat_')) {
                              sessionStorage.removeItem(key)
                            }
                          })
                        } catch (error) {
                          console.warn('清理sessionStorage失败:', error)
                        }

                        // 🔥 调用hook的startNewSession（已经增强了状态清理）
                        await startNewSession()

                        console.log('✅ [SystemChat] 新会话创建完成，所有状态已清理')
                      }}
                      disabled={isLoading}
                      className={HEADER_ACTION_BUTTON_CLASS}
                    >
                      <span className={HEADER_ACTION_LABEL_CLASS}>新建会话</span>
                    </Button>
                  </Tooltip>

                  <Tooltip title="查看和恢复历史会话">
                    <Button
                      size="small"
                      icon={<HistoryOutlined />}
                      onClick={async () => {
                        // 只有在点击历史按钮时才加载历史会话
                        console.log('📚 [SystemChat] 用户主动打开历史面板，开始加载历史会话')
                        try {
                          const allSessions = await getSessions()
                          setHistorySessions(Array.isArray(allSessions) ? allSessions : [])
                          setShowHistory(true)
                        } catch (error) {
                          console.error('加载历史会话失败:', error)
                          setHistorySessions([])
                          message.error('加载历史会话失败')
                        }
                      }}
                      className={HEADER_ACTION_BUTTON_CLASS}
                    >
                      <span className={HEADER_ACTION_LABEL_CLASS}>会话历史</span>
                    </Button>
                  </Tooltip>

                  <Tooltip title={messages.length === 0 ? '当前没有可导出的消息' : '导出当前会话'}>
                    <Dropdown
                      menu={{ items: exportMenuItems }}
                      disabled={!currentSession || messages.length === 0}
                    >
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        disabled={!currentSession || messages.length === 0}
                        className={HEADER_ACTION_BUTTON_CLASS}
                      >
                        <span className={HEADER_ACTION_LABEL_CLASS}>导出会话</span>
                      </Button>
                    </Dropdown>
                  </Tooltip>

                  <Tooltip title={messages.length === 0 ? '当前没有可清空的消息' : '清空当前会话消息'}>
                    <Button
                      danger
                      size="small"
                      icon={<ClearOutlined />}
                      onClick={() => {
                        console.log('🧹 [SystemChat] 用户点击清除消息，清理相关状态')

                        // 🔥 清理消息和相关状态
                        clearMessages()
                        setAgentStreamData([]) // 清理Agent流式数据
                        setShowAgentStream(false)

                        console.log('✅ [SystemChat] 消息清除完成')
                      }}
                      disabled={messages.length === 0}
                      className={HEADER_ACTION_BUTTON_CLASS}
                    >
                      <span className={HEADER_ACTION_LABEL_CLASS}>清空消息</span>
                    </Button>
                  </Tooltip>
                </div>
              </div>
            }
            className="glass-card flex min-h-0 flex-1 flex-col"
            styles={{
              header: { padding: '12px 16px' },
              title: { width: '100%', overflow: 'visible', whiteSpace: 'normal' },
              body: { padding: 0, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }
            }}
          >
            {/* 消息列表 */}
            <div ref={messageListRef} className={`flex-1 overflow-y-auto p-4 space-y-4 min-h-0 ${styles.messageContainer}`}>
              {messages.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <RobotOutlined className="text-2xl text-white" />
                  </div>
                  <Title level={4} className="!text-gray-300 !mb-2">
                    欢迎使用 Wuhr AI
                  </Title>
                  <Text className="text-gray-400">
                    智能AI助手，专精于Kubernetes和DevOps运维
                  </Text>
                  

                  {/* 快捷命令 */}
                  <div className="mt-8">
                    <Text className="text-gray-300 block mb-4">运维常用命令：</Text>

                    {/* 动态显示所有命令，根据模式添加前缀 */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
                      {quickCommands.map((cmd, index) => (
                        <Tooltip key={index} title={getTooltipDescription(cmd)}>
                          <Button
                            block
                            onClick={() => handleQuickCommand(cmd)}
                            className={`text-left h-auto py-3 ${
                              isK8sMode
                                ? 'border-blue-500/30 hover:border-blue-400'
                                : 'border-green-500/30 hover:border-green-400'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {cmd.icon}
                              <span className="text-sm">{getCommandDisplayName(cmd, index)}</span>
                            </div>
                          </Button>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(renderMessage)}
                  
                  {/* 移除重复的流式响应显示，保留Agent流式执行过程显示（有颜色有命令的版本）*/}
                </>
              )}

              {/* 移除重复的加载指示器，因为useRedisChat已经创建了"正在思考中..."的消息 */}
            </div>

            {/* 输入区域 */}
            <div className="border-t border-gray-700/30 pt-3 px-4 pb-4">
              {knowledgeDocuments.length > 0 && (
                <div className="mb-3 flex min-w-0 items-center gap-2">
                  <BookOutlined className="shrink-0 text-blue-400" />
                  <Select
                    mode="multiple"
                    value={selectedKnowledgeIds}
                    onChange={handleKnowledgeSelection}
                    maxCount={3}
                    maxTagCount="responsive"
                    allowClear
                    className="min-w-0 flex-1"
                    placeholder="引用团队知识（最多 3 篇）"
                    optionFilterProp="label"
                    options={knowledgeDocuments.map(item => ({
                      value: item.id,
                      label: item.title,
                      title: item.description || item.title
                    }))}
                  />
                </div>
              )}
              {/* 文件上传区域 */}
              {showFileUpload && (
                <div className="mb-4">
                  <FileUpload
                    onFileAnalyzed={handleFileAnalyzed}
                    onFileContentChange={handleFileContentChange}
                    maxFiles={5}
                    maxFileSize={0.2}
                  />
                </div>
              )}

              {/* 已上传文件显示 */}
              {uploadedFiles.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Text className="text-gray-400 text-sm">已选择文件:</Text>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => setUploadedFiles([])}
                    >
                      清空
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 bg-gray-700 rounded px-3 py-1"
                      >
                        <FileTextOutlined className="text-blue-400" />
                        <Text className="text-gray-300 text-sm">{file.name}</Text>
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={() => {
                            setUploadedFiles(files => files.filter((_, i) => i !== index))
                          }}
                          className="text-gray-400 hover:text-red-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <HostMentionInput
                  inputRef={textAreaRef}
                  value={inputValue}
                  onChange={setInputValue}
                  servers={servers as ChatTargetHost[]}
                  devices={networkDevices}
                  clusters={k8sClusters}
                  selections={targetSelections}
                  onSelectionsChange={handleTargetSelectionsChange}
                  deliveryOptions={cicdMentionOptions}
                  deliverySelections={selectedCICDMentions}
                  onDeliverySelect={handleCICDMentionSelect}
                  onDeliveryRemove={handleCICDMentionRemove}
                  onSubmit={handleSendMessage}
                  disabled={isLoading}
                />

                <div className="flex flex-col space-y-2">
                  {/* 优化的模式切换按钮 */}
                  <Tooltip title={`当前: ${isK8sMode ? 'Kubernetes集群' : 'Linux系统'}模式 | 快捷键: Ctrl+K切换 | Ctrl+L强制Linux | 智能模式检测已启用`}>
                    <Button
                      icon={isK8sMode ? <GlobalOutlined /> : <DesktopOutlined />}
                      onClick={() => setIsK8sMode(!isK8sMode)}
                      type="default"
                      className={`
                        transition-all duration-300 ease-in-out
                        ${isK8sMode 
                          ? 'border-blue-500/60 hover:border-blue-400 bg-blue-500/10 hover:bg-blue-500/20' 
                          : 'border-green-500/60 hover:border-green-400 bg-green-500/10 hover:bg-green-500/20'
                        }
                        shadow-sm hover:shadow-md
                      `}
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        color: isK8sMode ? '#3b82f6' : '#10b981',
                        fontWeight: '600',
                        fontSize: '12px',
                        height: '36px',
                        minWidth: '80px'
                      }}
                    >
                      <div className="flex flex-col items-center leading-none">
                        <span className={`${isK8sMode ? 'text-blue-400' : 'text-green-400'} font-semibold`}>
                          {isK8sMode ? 'K8s' : 'Linux'}
                        </span>
                        <span className="text-xs opacity-75 -mt-0.5">
                          {isK8sMode ? '集群' : '系统'}
                        </span>
                      </div>
                    </Button>
                  </Tooltip>

                  <div className="flex space-x-2">
                    <Tooltip title="上传文本、日志或 YAML 作为本次会话上下文（单文件 200KB）">
                      <Button
                        icon={<CloudUploadOutlined />}
                        onClick={() => setShowFileUpload(!showFileUpload)}
                        type={showFileUpload ? 'primary' : 'default'}
                      />
                    </Tooltip>

                    {isLoading ? (
                      <Button
                        danger
                        icon={<StopOutlined />}
                        onClick={() => {
                          stopGeneration()
                          message.success('已停止AI生成', 1)
                        }}
                        loading={false}
                        style={{
                          backgroundColor: '#ff4d4f',
                          borderColor: '#ff4d4f',
                          color: 'white',
                          fontWeight: '600'
                        }}
                      >
                        停止
                      </Button>
                    ) : (
                      <Button
                        type="text"
                        icon={<SendOutlined />}
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || !currentModelConfig || !hasConversationTarget}
                        loading={isLoading}
                        className="hover:bg-blue-500/10"
                        style={{
                          color: (!inputValue.trim() || !currentModelConfig || !hasConversationTarget) ? undefined : '#1890ff',
                          border: '1px solid #d9d9d9'
                        }}
                      >
                        发送
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className={`flex items-center space-x-2 flex-wrap ${styles.tagContainer}`}>
                  {/* 基础配置标签 */}
                  <Tag color="blue" className="text-xs">
                    {currentModelConfig?.displayName || '未选择模型'}
                  </Tag>
                  <Tag color={config.enableStreaming ? 'blue' : 'gray'} className="text-xs">
                    {config.enableStreaming ? '流式传输' : '标准模式'}
                  </Tag>
                  <Tag color={hasExecutionTarget ? 'purple' : 'default'} className="text-xs">
                    {hasNetworkTarget
                      ? `网络设备 ${effectiveNetworkDevices.length}台`
                      : isBatchExecution
                        ? `批量执行 ${effectiveTargetHostIds.length}台`
                        : hasExecutionTarget ? '单机执行' : '未选目标'}
                  </Tag>
                  {hasCICDContext && (
                    <Tag color="geekblue" className="text-xs">
                      交付对象
                    </Tag>
                  )}

                  {/* 高级功能配置标签 - 仅在启用时显示 */}
                  {mcpToolsConfig.enabled && (
                    <Tag color="purple" className="text-xs">
                      MCP工具
                    </Tag>
                  )}
                  {customToolsConfig.enabled && (
                    <Tag color="cyan" className="text-xs">
                      自定义工具
                    </Tag>
                  )}
                  {securityEnabled && (
                    <Tag color="red" className="text-xs">
                      安全控制
                    </Tag>
                  )}

                  {/* 未完成配置警告 */}
                  {!isConfigValid() && (
                    <Tag color="red" className="text-xs">配置未完成</Tag>
                  )}
                </div>

                <div className="flex flex-col items-end">
                  <Text className="text-gray-400 text-sm">
                    Enter发送 | Shift+Enter换行
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    Ctrl+K切换模式 | Ctrl+L切换到Linux
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧配置面板 */}
        <Col xs={24} lg={6} className="mt-6 min-h-[480px] lg:mt-0 lg:h-full lg:min-h-0">
          <Card
            title={
              <div className="flex items-center space-x-2">
                <SettingOutlined className="text-blue-500" />
                <span className="text-white">会话设置</span>
              </div>
            }
            className="glass-card flex h-full min-h-0 flex-col"
            styles={{
              body: {
                padding: '16px 0',
                minHeight: 0,
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden'
              }
            }}
          >
            <Collapse
              defaultActiveKey={['model-config']}
              ghost
              expandIconPosition="end"
              onChange={(activeKeys) => {
                // 按需加载数据
                if (activeKeys.includes('host-config')) {
                  loadHostData()
                }
                if (activeKeys.includes('model-config')) {
                  loadModelData()
                }
              }}
            >
              {/* 目标资源面板：@ 是主要入口，统一展示主机和网络设备。 */}
              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <ApiOutlined className="text-blue-400" />
                      <span className="text-gray-300">目标资源</span>
                    </div>
                    <Tag color={hasNetworkTarget ? 'geekblue' : isBatchExecution ? 'purple' : hasExecutionTarget ? 'blue' : 'default'} className={PANEL_SUMMARY_TAG_CLASS}>
                      {hasNetworkTarget
                        ? `${effectiveNetworkDevices.length}台设备`
                        : isBatchExecution
                          ? `${effectiveTargetHostIds.length}台主机`
                          : hasExecutionTarget ? '单机' : '未选择'}
                    </Tag>
                  </div>
                }
                key="host-config"
              >
                <div className="space-y-3 px-4">
                  {(targetSelections.length > 0 || groupTargetHostIds.length > 0) && (
                  <div className="rounded border border-gray-600/60 p-3">
                    {targetSelections.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {targetSelections.map(selection => (
                            <Tag key={selection.key} color={selection.type === 'host' ? 'blue' : selection.type.startsWith('device') ? 'geekblue' : 'purple'} className="m-0 text-xs">
                              @{selection.label} · {selection.deviceIds?.length || selection.hostIds.length}台
                            </Tag>
                          ))}
                        </div>
                        <div className="mt-2 text-right">
                          <Button type="link" size="small" className="h-auto p-0 text-xs" onClick={() => setTargetSelections([])}>
                            清除目标
                          </Button>
                        </div>
                      </>
                    ) : groupTargetHostIds.length > 0 ? (
                      <div>
                        <Tag color="purple" className="m-0 text-xs">
                          @{selectedGroup?.name || '默认主机组'} · {groupTargetHostIds.length}台
                        </Tag>
                        <div className="mt-2 text-right">
                          <Button
                            type="link"
                            size="small"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              setSelectedGroupId('')
                              setHostSelectionMode('single')
                            }}
                          >
                            清除分组
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Text className="block text-sm text-gray-300">协调主机</Text>
                      {approvalCoordinator && (
                        <Badge status={approvalCoordinator.status === 'online' ? 'success' : 'error'} text={approvalCoordinator.status === 'online' ? '在线' : '离线'} />
                      )}
                    </div>
                    <Select
                      value={hostConfig.selectedServerId || undefined}
                      onChange={(value) => {
                        setHostConfig({ selectedServerId: value })
                        if (effectiveTargetHostIds.length === 0) {
                          setHostSelectionMode('single')
                          setSelectedGroupId('')
                        }
                      }}
                      className="w-full"
                      placeholder={(isBatchExecution || hasNetworkTarget) ? '自动选择协调主机' : '选择默认主机'}
                      loading={loadingServers}
                      showSearch
                      optionFilterProp="label"
                      options={servers.map(server => ({
                        label: `${server.name} ${server.ip}`,
                        value: server.id,
                        disabled: server.status !== 'online'
                      }))}
                      optionRender={(option) => {
                        const server = servers.find(item => item.id === option.value)
                        if (!server) return option.label
                        return (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate">{server.name}{server.isDefault ? ' · 默认' : ''}</div>
                              <div className="truncate text-xs text-gray-500">{server.ip}</div>
                            </div>
                            <Badge status={server.status === 'online' ? 'success' : 'error'} />
                          </div>
                        )
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                    <Text className="text-xs text-gray-400">使用 @ 可随时更换目标</Text>
                    <Space size={4}>
                      {approvalCoordinator && (
                        <Button
                          type="text"
                          size="small"
                          loading={kubeletCheckLoading}
                          onClick={() => checkKubeletWuhrai(approvalCoordinator.id)}
                          className="h-6 px-2 text-xs text-blue-400"
                        >
                          {kubeletCheckLoading ? '检查中' : '检查 Agent'}
                        </Button>
                      )}
                    <Button
                      type="link"
                      size="small"
                      className="h-auto p-0 text-xs"
                      onClick={() => textAreaRef.current?.focus()}
                    >
                        选择目标
                    </Button>
                    </Space>
                  </div>
                </div>
              </Panel>

              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <RocketOutlined className="text-indigo-400" />
                      <span className="text-gray-300">交付对象</span>
                    </div>
                    <Tag
                      color={hasCICDContext ? 'geekblue' : 'default'}
                      className={PANEL_SUMMARY_TAG_CLASS}
                      title={hasCICDContext ? deliveryContextTitle : '未选择'}
                    >
                      {hasCICDContext ? deliveryContextSummary : '未选择'}
                    </Tag>
                  </div>
                }
                key="delivery-context"
              >
                <DeliveryContextPanel
                  value={cicdContext}
                  onChange={setCicdContext}
                  onCatalogChange={handleCICDCatalogChange}
                  onOperationClick={handleCICDOperationClick}
                  onFocusInput={() => textAreaRef.current?.focus()}
                />
              </Panel>

              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <RobotOutlined className="text-green-500" />
                      <span className="text-gray-300">模型配置</span>
                    </div>
                    <Tag
                      color={currentModelConfig ? 'green' : 'default'}
                      className={PANEL_SUMMARY_TAG_CLASS}
                      title={currentModelConfig?.displayName || '未配置'}
                    >
                      {currentModelConfig?.displayName || '未配置'}
                    </Tag>
                  </div>
                }
                key="model-config"
              >
                <div className="px-4 space-y-4">
                  <div>
                    <Text className="text-gray-300 block mb-2">选择模型</Text>
                    <Select
                      value={selectedModelId}
                      onChange={(value) => saveUserModelSelection(value)}
                      loading={configLoading}
                      className="w-full"
                      placeholder="选择AI模型"
                      showSearch
                      filterOption={(input, option) => {
                        const label = typeof option?.label === 'string' ? option.label : ''
                        return label.toLowerCase().includes(input.toLowerCase())
                      }}
                      options={availableModels.map(model => ({
                        value: model.id,
                        label: (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-white truncate flex-1">
                              {model.modelName}
                            </span>
                            {model.isDefault && <Tag color="gold" className="ml-2">默认</Tag>}
                          </div>
                        )
                      }))}
                      notFoundContent={
                        <div className="text-center py-4">
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                              <span className="text-gray-400">
                                暂无可用模型<br/>
                                请先在<a href="/config/models" className="text-blue-400">模型接入</a>中添加模型配置
                              </span>
                            }
                          />
                        </div>
                      }
                    />
                  </div>

                  {/* 当前配置状态 */}
                  {currentModelConfig && (
                    <div className="mt-4 p-3 rounded border border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <Text className="text-gray-300 text-sm">当前配置</Text>
                        <Badge
                          status="success"
                          text={<span className="text-green-400 text-xs">已配置</span>}
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">模型:</span>
                          <span className="text-white">{currentModelConfig.displayName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">提供商:</span>
                          <span className="text-white">{currentModelConfig.provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">API密钥:</span>
                          <span className="text-green-400">已配置</span>
                        </div>
                        {currentModelConfig.baseUrl && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Base URL:</span>
                            <span className="text-white text-xs truncate max-w-32" title={currentModelConfig.baseUrl}>
                              {currentModelConfig.baseUrl}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>

              {/* 安全控制面板 */}
              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <SecurityScanOutlined className="text-red-500" />
                      <span className="text-gray-300">安全控制</span>
                    </div>
                    <Tag color={securityEnabled ? 'red' : 'default'} className={PANEL_SUMMARY_TAG_CLASS}>
                      {securityEnabled ? '已开启' : '已关闭'}
                    </Tag>
                  </div>
                }
                key="security-control"
              >
                <SecurityToggle />
              </Panel>

              {/* MCP工具配置面板 */}
              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <ToolOutlined className="text-purple-500" />
                      <span className="text-gray-300">MCP工具</span>
                    </div>
                    <Tag color={mcpToolsConfig.enabled ? 'purple' : 'default'} className={PANEL_SUMMARY_TAG_CLASS}>
                      {mcpToolsConfig.enabled ? '已开启' : '已关闭'}
                    </Tag>
                  </div>
                }
                key="mcp-tools"
              >
                <MCPToolsToggle onToolClick={handleMCPToolClick} />
              </Panel>

              {/* 自定义工具配置面板 */}
              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <CodeOutlined className="text-cyan-500" />
                      <span className="text-gray-300">自定义工具</span>
                    </div>
                    <Tag color={customToolsConfig.enabled ? 'cyan' : 'default'} className={PANEL_SUMMARY_TAG_CLASS}>
                      {customToolsConfig.enabled ? '已开启' : '已关闭'}
                    </Tag>
                  </div>
                }
                key="custom-tools"
              >
                <CustomToolsToggle onToolClick={(toolName) => setInputValue(`使用${toolName}工具`)} />
              </Panel>

              {/* 高级参数面板 */}
              <Panel
                header={
                  <div className="flex min-w-0 w-full items-center justify-between gap-2 pr-2">
                    <div className="flex shrink-0 items-center space-x-2">
                      <ThunderboltOutlined className="text-orange-500" />
                      <span className="text-gray-300">高级参数</span>
                    </div>
                    <Tag color="orange" className={PANEL_SUMMARY_TAG_CLASS} title={`Temperature ${config.temperature.toFixed(1)}`}>
                      T {config.temperature.toFixed(1)}
                    </Tag>
                  </div>
                }
                key="advanced"
              >
                <div className="px-4 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <Text className="text-gray-300 font-medium">Temperature</Text>
                        <div className="text-xs text-gray-500 mt-1">
                          控制回复的创造性和随机性
                        </div>
                      </div>
                      <div className="text-right">
                        <Text className="text-blue-400 font-mono text-sm">
                          {config.temperature.toFixed(1)}
                        </Text>
                        <div className="text-xs text-gray-500">
                          {config.temperature <= 0.3 ? '保守' :
                           config.temperature <= 0.7 ? '平衡' : '创新'}
                        </div>
                      </div>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={config.temperature}
                      onChange={(value) => updateConfig({ temperature: value })}
                      marks={{
                        0: { label: '0.0', style: { color: '#6b7280', fontSize: '10px' } },
                        0.3: { label: '0.3', style: { color: '#6b7280', fontSize: '10px' } },
                        0.7: { label: '0.7', style: { color: '#3b82f6', fontSize: '10px' } },
                        1: { label: '1.0', style: { color: '#6b7280', fontSize: '10px' } }
                      }}
                      tooltip={{
                        formatter: (value) => `${value?.toFixed(1)} - ${
                          (value || 0) <= 0.3 ? '保守模式' :
                          (value || 0) <= 0.7 ? '平衡模式' : '创新模式'
                        }`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>更确定</span>
                      <span>更随机</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Text className="text-gray-300">Max Tokens</Text>
                      <Text className="text-gray-400">{config.maxTokens}</Text>
                    </div>
                    <Slider
                      min={100}
                      max={4000}
                      step={100}
                      value={config.maxTokens}
                      onChange={(value) => updateConfig({ maxTokens: value })}
                    />
                  </div>
                </div>
              </Panel>
            </Collapse>



            {/* 状态信息 */}
            <div className="px-4 space-y-3">
              <div className="flex justify-between">
                <Text className="text-gray-400">消息数量</Text>
                <Text className="text-white">{messages.length}</Text>
              </div>
              
              {isStreaming && (
                <div className="flex justify-between">
                  <Text className="text-gray-400">流式状态</Text>
                  <Badge
                    status="processing"
                    text={<Text className="text-blue-500">传输中...</Text>}
                  />
                </div>
              )}
              
              <div className="flex justify-between">
                <Text className="text-gray-400">Token 使用</Text>
                <Text className="text-white">
                  {messages.reduce((total, msg) => {
                    return total + (msg.metadata?.tokenUsage?.totalTokens || 0)
                  }, 0)} tokens
                </Text>
              </div>

              <div className="flex justify-between">
                <Text className="text-gray-400">模型状态</Text>
                <Badge
                  status={isConfigValid() ? "success" : "error"}
                  text={
                    <Text className={isConfigValid() ? "text-green-500" : "text-red-500"}>
                      {isConfigValid() ? '配置完成' : '未配置'}
                    </Text>
                  }
                />
              </div>
            </div>
          </Card>
        </Col>
        </Row>
      </div>

      <Modal
        title="对话历史"
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        footer={null}
        width={600}
      >
        <div className="space-y-4">
          <Input
            placeholder="搜索会话..."
            prefix={<SearchOutlined />}
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
          />
          
          <List
            key={historyRefreshKey}
            dataSource={getHistorySessions()}
            renderItem={(session) => {
              // 数据验证：确保session存在且有必要的属性
              if (!session || !session.id) {
                return null
              }

              return (
                <List.Item
                  actions={[
                    <Button
                      key="load"
                      type="text"
                      onClick={() => {
                        loadSession(session.id)
                        setShowHistory(false)
                      }}
                    >
                      加载
                    </Button>,
                    <Button
                      key="delete"
                      type="text"
                      danger
                      onClick={async () => {
                        try {
                          // 执行删除操作
                          const success = await deleteSession(session.id)

                          if (success) {
                            // 重新获取历史会话列表
                            const allSessions = await getSessions()
                            setHistorySessions(Array.isArray(allSessions) ? allSessions : [])

                            // 强制刷新历史对话列表
                            setHistoryRefreshKey(prev => prev + 1)
                            setHistorySearchQuery('')
                            message.success('会话已删除')
                          } else {
                            message.error('删除失败，请重试')
                          }
                        } catch (error) {
                          console.error('💥 删除操作异常:', error)
                          message.error('删除失败，请重试')
                        }
                      }}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={session.title || '未命名会话'}
                    description={
                      <div className="text-gray-400">
                        <div>
                          {/* 显示消息数量 */}
                          {typeof session.messageCount === 'number'
                            ? `${session.messageCount} 条消息`
                            : (session.messages && Array.isArray(session.messages)
                                ? `${session.messages.length} 条消息`
                                : '0 条消息'
                              )
                          }
                        </div>
                        <div>
                          {/* 安全访问updatedAt属性 */}
                          {session.updatedAt
                            ? (session.updatedAt instanceof Date
                                ? session.updatedAt.toLocaleString()
                                : new Date(session.updatedAt).toLocaleString()
                              )
                            : (session.createdAt
                                ? (session.createdAt instanceof Date
                                    ? session.createdAt.toLocaleString()
                                    : new Date(session.createdAt).toLocaleString()
                                  )
                                : '时间未知'
                              )
                          }
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )
            }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无历史会话"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </div>
      </Modal>

      {/* AI 决策记录抽屉：当前会话执行流程 + 持久化 lesson/outcome */}
      <DecisionLogDrawer
        open={decisionLogOpen}
        onClose={() => setDecisionLogOpen(false)}
        messages={messages}
      />
    </>
  )
}

export default SystemChat
