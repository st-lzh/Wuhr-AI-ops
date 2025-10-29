'use client'

import React, { useState, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import ServerCard from '../../components/servers/ServerCard'
import AddServerModal from '../../components/servers/AddServerModal'
import EditServerModal from '../../components/servers/EditServerModal'
import ServerDetailModal from '../../components/servers/ServerDetailModal'
import {
  Row,
  Col,
  Input,
  Select,
  Button,
  Space,
  Card,
  Statistic,
  Badge,
  Tag,
  Spin,
  Empty,
  message,
  Modal
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  FilterOutlined,
  DesktopOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons'

import { ServerInfo } from '../../types/access-management'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { PermissionGuard, PermissionButton } from '../../components/auth/PermissionGuard'

const { Option } = Select

const ServerListPage: React.FC = () => {
  // 只使用真实数据库数据
  const { user } = useAuth() // 保持认证状态检查
  const { canAccessServers } = usePermissions()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [locationFilter, setLocationFilter] = useState('')
  const [filteredServers, setFilteredServers] = useState<ServerInfo[]>([])

  const [testConnectionLoading, setTestConnectionLoading] = useState<string | null>(null)
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'success' | 'error' | null>>({})
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<ServerInfo | null>(null)
  const [viewingServer, setViewingServer] = useState<ServerInfo | null>(null)
  const [realServers, setRealServers] = useState<ServerInfo[]>([])
  const [realLoading, setRealLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)

  // 获取真实服务器数据
  const fetchRealServers = async () => {
    try {
      setRealLoading(true)
      const response = await fetch('/api/admin/servers')

      if (!response.ok) {
        throw new Error('获取服务器列表失败')
      }

      const result = await response.json()
      setRealServers(result.data.servers || [])
    } catch (error) {
      console.error('获取服务器列表失败:', error)
      message.error('获取服务器列表失败')
      setRealServers([])
    } finally {
      setRealLoading(false)
    }
  }

  // 页面加载时获取核心服务器数据，延迟加载统计数据
  useEffect(() => {
    fetchRealServers()
    // 延迟加载统计数据，避免阻塞主要内容
    const timer = setTimeout(() => {
      loadServerStats()
    }, 500) // 500ms后加载统计数据
    
    return () => clearTimeout(timer)
  }, [])

  // 只使用真实数据库数据
  const allServers = React.useMemo(() => realServers, [realServers])

  // 服务器统计状态
  const [stats, setStats] = useState<any>(null)

  // 加载服务器统计数据
  const loadServerStats = async () => {
    try {
      const response = await fetch('/api/admin/servers/stats')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStats(data.data)
          console.log('📊 [主机管理页面] 统计数据加载成功:', data.data)
        } else {
          console.error('📊 [主机管理页面] 统计API返回失败:', data.error)
        }
      } else {
        console.error('📊 [主机管理页面] 统计API请求失败')
      }
    } catch (error) {
      console.error('📊 [主机管理页面] 加载统计数据失败:', error)
      // 降级到本地计算
      const localStats = realServers.reduce((acc, server) => {
        acc.total++
        acc[server.status]++
        return acc
      }, {
        total: 0,
        online: 0,
        offline: 0,
        warning: 0,
        error: 0
      })
      setStats(localStats)
    }
  }

  // 获取所有唯一的标签
  const allTags = React.useMemo(() =>
    Array.from(new Set(allServers.flatMap(server => server.tags))),
    [allServers]
  )

  // 获取所有唯一的位置
  const allLocations = React.useMemo(() =>
    Array.from(new Set(allServers.map(server => server.location))),
    [allServers]
  )

  // 应用筛选
  useEffect(() => {
    let filtered = allServers

    if (statusFilter.length > 0) {
      filtered = filtered.filter(server => statusFilter.includes(server.status))
    }

    if (tagFilter.length > 0) {
      filtered = filtered.filter(server =>
        tagFilter.some(tag => server.tags.includes(tag))
      )
    }

    if (locationFilter) {
      filtered = filtered.filter(server =>
        server.location?.includes(locationFilter)
      )
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(server =>
        server.name.toLowerCase().includes(searchLower) ||
        server.hostname.toLowerCase().includes(searchLower) ||
        server.ip.includes(searchLower) ||
        server.description?.toLowerCase().includes(searchLower)
      )
    }

    setFilteredServers(filtered)
  }, [allServers, searchQuery, statusFilter, tagFilter, locationFilter])

  // 清除筛选
  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter([])
    setTagFilter([])
    setLocationFilter('')
  }





  // 查看主机详情
  const handleViewServer = (server: ServerInfo) => {
    setViewingServer(server)
    setDetailModalVisible(true)
  }

  // 编辑主机
  const handleEditServer = (server: ServerInfo) => {
    setEditingServer(server)
    setEditModalVisible(true)
  }

  // 添加主机成功回调
  const handleAddServerSuccess = (newServer: ServerInfo) => {
    setRealServers(prev => [newServer, ...prev])
    message.success(`主机 "${newServer.name}" 添加成功`)
  }

  // 编辑主机成功回调
  const handleEditServerSuccess = (updatedServer: ServerInfo) => {
    setRealServers(prev => prev.map(server =>
      server.id === updatedServer.id ? updatedServer : server
    ))
    message.success(`主机 "${updatedServer.name}" 更新成功`)
  }

  // 删除主机
  const handleDeleteServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/admin/servers?id=${serverId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除主机失败')
      }

      const result = await response.json()

      // 更新本地状态
      setRealServers(prev => prev.filter(server => server.id !== serverId))
      message.success(result.data?.message || '主机删除成功')
    } catch (error) {
      console.error('删除主机失败:', error)
      message.error(error instanceof Error ? error.message : '删除主机失败，请重试')
      throw error // 重新抛出错误，让调用方知道删除失败
    }
  }

  // 设置默认主机
  const handleSetDefaultServer = async (server: ServerInfo) => {
    try {
      const response = await fetch('/api/admin/servers/set-default', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverId: server.id })
      })

      const result = await response.json()
      if (result.success) {
        message.success(result.message || `主机 "${server.name}" 默认状态已更新`)
        fetchRealServers() // 重新获取数据以显示最新状态
      } else {
        message.error(result.error || '设置默认主机失败')
      }
    } catch (error) {
      console.error('设置默认主机失败:', error)
      message.error('设置默认主机失败')
    }
  }

  // 连接测试处理
  const handleTestConnection = async (server: ServerInfo) => {
    try {
      setTestConnectionLoading(server.id)
      setConnectionStatuses(prev => ({ ...prev, [server.id]: null }))

      // 显示开始测试的消息
      message.loading(`正在测试主机 "${server.name}" 的连接...`, 0)

      // 使用新的基于ID的连接测试API，增加超时时间
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000) // 90秒超时

      const response = await fetch(`/api/admin/servers/${server.id}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 使用cookie认证
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      message.destroy() // 清除loading消息

      if (response.ok) {
        const result = await response.json()
        setConnectionStatuses(prev => ({ ...prev, [server.id]: 'success' }))
        message.success(`主机 "${server.name}" 连接测试成功`)

        // 如果有系统信息，显示额外信息
        if (result.data?.systemInfo) {
          console.log('系统信息:', result.data.systemInfo)
        }
      } else {
        const errorData = await response.json()
        setConnectionStatuses(prev => ({ ...prev, [server.id]: 'error' }))
        message.error(`主机 "${server.name}" 连接测试失败: ${errorData.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('连接测试失败:', error)
      message.destroy() // 清除loading消息
      setConnectionStatuses(prev => ({ ...prev, [server.id]: 'error' }))

      if (error instanceof Error && error.name === 'AbortError') {
        message.error(`主机 "${server.name}" 连接测试超时，请检查网络连接`)
      } else {
        message.error(`主机 "${server.name}" 连接测试异常: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    } finally {
      setTestConnectionLoading(null)
    }
  }



  // 刷新服务器列表
  const handleRefresh = () => {
    fetchRealServers()
  }

  // 导出服务器配置
  const handleExportServers = async () => {
    try {
      setExportLoading(true)
      const response = await fetch('/api/admin/servers/export', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()

        // 动态导入xlsx库
        const XLSX = await import('xlsx')

        // 准备Excel数据
        const excelData = data.data.servers.map((server: any) => ({
          '主机名称': server.name,
          'IP地址': server.ip,
          'SSH端口': server.port,
          'SSH用户名': server.username,
          '操作系统': server.os,
          '位置': server.location || '',
          '描述': server.description || '',
          '标签': Array.isArray(server.tags) ? server.tags.join(',') : '',
          '主机组名称': server.groupName || '',
          '主机组颜色': server.groupColor || '',
          '创建时间': new Date(server.createdAt).toLocaleString(),
          '更新时间': new Date(server.updatedAt).toLocaleString()
        }))

        // 创建工作簿
        const wb = XLSX.utils.book_new()

        // 创建数据工作表
        const ws = XLSX.utils.json_to_sheet(excelData)

        // 设置列宽
        const colWidths = [
          { wch: 15 }, // 主机名称
          { wch: 15 }, // IP地址
          { wch: 8 },  // SSH端口
          { wch: 12 }, // SSH用户名
          { wch: 10 }, // 操作系统
          { wch: 15 }, // 位置
          { wch: 30 }, // 描述
          { wch: 20 }, // 标签
          { wch: 15 }, // 主机组名称
          { wch: 12 }, // 主机组颜色
          { wch: 20 }, // 创建时间
          { wch: 20 }  // 更新时间
        ]
        ws['!cols'] = colWidths

        // 添加数据工作表
        XLSX.utils.book_append_sheet(wb, ws, '服务器配置')

        // 创建模板工作表（用于导入参考）
        const templateData = [
          {
            '主机名称': 'web-server-01',
            'IP地址': '192.168.1.100',
            'SSH端口': 22,
            'SSH用户名': 'root',
            'SSH密码': 'your-password',
            '操作系统': 'Linux',
            '位置': '北京机房',
            '描述': 'Web服务器',
            '标签': 'web,production',
            '主机组名称': 'Web服务器组'
          },
          {
            '主机名称': 'db-server-01',
            'IP地址': '192.168.1.101',
            'SSH端口': 22,
            'SSH用户名': 'admin',
            'SSH密码': 'your-password',
            '操作系统': 'Ubuntu',
            '位置': '上海机房',
            '描述': '数据库服务器',
            '标签': 'database,mysql',
            '主机组名称': '数据库服务器组'
          }
        ]

        const templateWs = XLSX.utils.json_to_sheet(templateData)
        templateWs['!cols'] = [
          { wch: 15 }, // 主机名称
          { wch: 15 }, // IP地址
          { wch: 8 },  // SSH端口
          { wch: 12 }, // SSH用户名
          { wch: 15 }, // SSH密码
          { wch: 10 }, // 操作系统
          { wch: 15 }, // 位置
          { wch: 30 }, // 描述
          { wch: 20 }, // 标签
          { wch: 15 }  // 主机组名称
        ]

        // 添加模板工作表
        XLSX.utils.book_append_sheet(wb, templateWs, '导入模板')

        // 创建说明工作表
        const instructionData = [
          { '字段名称': '主机名称', '是否必填': '是', '说明': '服务器的显示名称，用于标识服务器', '示例': 'web-server-01' },
          { '字段名称': 'IP地址', '是否必填': '是', '说明': '服务器的IP地址，支持IPv4格式', '示例': '192.168.1.100' },
          { '字段名称': 'SSH端口', '是否必填': '否', '说明': 'SSH连接端口，默认为22', '示例': '22' },
          { '字段名称': 'SSH用户名', '是否必填': '是', '说明': 'SSH登录用户名', '示例': 'root' },
          { '字段名称': 'SSH密码', '是否必填': '是', '说明': 'SSH登录密码（导入时需要）', '示例': 'your-password' },
          { '字段名称': '操作系统', '是否必填': '否', '说明': '服务器操作系统，可选：Linux/Ubuntu/CentOS/Debian/RedHat', '示例': 'Linux' },
          { '字段名称': '位置', '是否必填': '否', '说明': '服务器物理位置或数据中心', '示例': '北京机房' },
          { '字段名称': '描述', '是否必填': '否', '说明': '服务器用途或其他说明信息', '示例': 'Web服务器' },
          { '字段名称': '标签', '是否必填': '否', '说明': '服务器标签，多个标签用英文逗号分隔', '示例': 'web,production' },
          { '字段名称': '主机组名称', '是否必填': '否', '说明': '服务器所属主机组的名称，不存在时会自动创建', '示例': 'Web服务器组' },
          { '字段名称': '', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '导入说明：', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '1. 请使用"导入模板"工作表作为参考', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '2. 必填字段不能为空', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '3. IP地址格式必须正确', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '4. 重复的主机名或IP将被跳过', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '5. 导入后需要重新设置SSH密码', '是否必填': '', '说明': '', '示例': '' },
          { '字段名称': '6. 主机组不存在时会自动创建', '是否必填': '', '说明': '', '示例': '' }
        ]

        const instructionWs = XLSX.utils.json_to_sheet(instructionData)
        instructionWs['!cols'] = [
          { wch: 25 }, // 字段名称
          { wch: 10 }, // 是否必填
          { wch: 40 }, // 说明
          { wch: 20 }  // 示例
        ]

        // 添加说明工作表
        XLSX.utils.book_append_sheet(wb, instructionWs, '填写说明')

        // 导出Excel文件
        const fileName = `servers-config-${new Date().toISOString().split('T')[0]}.xlsx`
        XLSX.writeFile(wb, fileName)

        message.success(`成功导出 ${data.data.servers.length} 个服务器配置到Excel文件`)
      } else {
        const errorData = await response.json()
        message.error(`导出失败: ${errorData.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('导出服务器配置失败:', error)
      message.error('导出服务器配置失败')
    } finally {
      setExportLoading(false)
    }
  }

  // 导入服务器配置
  const handleImportServers = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        setImportLoading(true)

        let servers: any[] = []

        if (file.name.endsWith('.json')) {
          // 处理JSON格式
          const text = await file.text()
          const config = JSON.parse(text)

          if (!config.servers || !Array.isArray(config.servers)) {
            message.error('JSON配置文件格式错误：缺少servers数组')
            setImportLoading(false)
            return
          }

          servers = config.servers
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // 处理Excel格式
          const XLSX = await import('xlsx')

          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })

          // 尝试从不同的工作表读取数据
          let worksheet
          if (workbook.SheetNames.includes('导入模板')) {
            worksheet = workbook.Sheets['导入模板']
          } else if (workbook.SheetNames.includes('服务器配置')) {
            worksheet = workbook.Sheets['服务器配置']
          } else {
            // 使用第一个工作表
            worksheet = workbook.Sheets[workbook.SheetNames[0]]
          }

          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          if (!jsonData || jsonData.length === 0) {
            message.error('Excel文件中没有找到有效数据')
            setImportLoading(false)
            return
          }

          // 转换Excel数据格式
          servers = jsonData.map((row: any) => ({
            name: row['主机名称'] || row['name'],
            ip: row['IP地址'] || row['ip'],
            port: parseInt(row['SSH端口'] || row['port']) || 22,
            username: row['SSH用户名'] || row['username'],
            password: row['SSH密码'] || row['password'],
            os: row['操作系统'] || row['os'] || 'Linux',
            location: row['位置'] || row['location'] || '',
            description: row['描述'] || row['description'] || '',
            tags: row['标签'] || row['tags'] ?
              (typeof (row['标签'] || row['tags']) === 'string' ?
                (row['标签'] || row['tags']).split(',').map((tag: string) => tag.trim()).filter(Boolean) :
                []) : [],
            groupName: row['主机组名称'] || row['groupName'] || ''
          })).filter((server: any) => server.name && server.ip && server.username) // 过滤掉必填字段为空的行

          if (servers.length === 0) {
            message.error('Excel文件中没有找到有效的服务器配置数据，请检查必填字段是否完整')
            setImportLoading(false)
            return
          }
        } else {
          message.error('不支持的文件格式，请使用.xlsx、.xls或.json文件')
          setImportLoading(false)
          return
        }

        // 发送导入请求
        const response = await fetch('/api/admin/servers/import', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ servers })
        })

        if (response.ok) {
          const result = await response.json()
          const { imported, skipped, errors } = result.data

          let successMessage = `成功导入 ${imported} 个服务器配置`
          if (skipped > 0) {
            successMessage += `，跳过 ${skipped} 个重复配置`
          }

          message.success(successMessage)

          // 如果有错误，显示详细信息
          if (errors && errors.length > 0) {
            Modal.warning({
              title: '导入完成，但有部分错误',
              content: (
                <div>
                  <p>成功导入: {imported} 个</p>
                  <p>跳过重复: {skipped} 个</p>
                  <p>错误详情:</p>
                  <ul style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {errors.slice(0, 10).map((error: string, index: number) => (
                      <li key={index} style={{ color: 'red', fontSize: '12px' }}>
                        {error}
                      </li>
                    ))}
                    {errors.length > 10 && <li>...还有 {errors.length - 10} 个错误</li>}
                  </ul>
                </div>
              ),
              width: 600
            })
          }

          fetchRealServers() // 刷新列表
        } else {
          const errorData = await response.json()
          message.error(`导入失败: ${errorData.error || '未知错误'}`)
        }
      } catch (error) {
        console.error('导入服务器配置失败:', error)
        message.error('导入服务器配置失败：文件格式错误或网络异常')
      } finally {
        setImportLoading(false)
      }
    }
    input.click()
  }

  return (
    <MainLayout>
      <PermissionGuard module="servers" action="read">
      <div className="p-6 space-y-6">
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              主机管理
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              管理和监控所有主机的状态和性能
            </p>
          </div>
          <Space>
            <Button
              type="default"
              icon={<DownloadOutlined />}
              onClick={handleExportServers}
              loading={exportLoading}
            >
              导出Excel
            </Button>
            <Button
              type="default"
              icon={<UploadOutlined />}
              onClick={handleImportServers}
              loading={importLoading}
            >
              导入Excel
            </Button>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={realLoading}
            >
              刷新
            </Button>
            <PermissionButton
              type="default"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
              module="servers"
              action="write"
              hideWhenNoPermission
              className="border-blue-500 text-blue-500 hover:border-blue-400 hover:text-blue-400 bg-transparent"
            >
              添加主机
            </PermissionButton>
          </Space>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="总服务器数"
                  value={stats.total}
                  prefix={<DesktopOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  健康度: {stats.healthPercentage}%
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="在线服务器"
                  value={stats.online}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  最近1小时连接: {stats.connection?.recentlyConnected || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="警告服务器"
                  value={stats.warning}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  问题率: {stats.problemPercentage}%
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="离线服务器"
                  value={stats.offline + (stats.error || 0)}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#f5222d' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  从未连接: {stats.connection?.neverConnected || 0}
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* 详细统计信息 */}
        {stats && (
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col xs={24} sm={12} md={8}>
              <Card title="操作系统分布" size="small">
                {stats.osStats?.length > 0 ? (
                  <div className="space-y-2">
                    {stats.osStats.map((os: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{os.os}</span>
                        <span className="text-sm font-medium">{os.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">暂无数据</div>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card title="位置分布" size="small">
                {stats.locationStats?.length > 0 ? (
                  <div className="space-y-2">
                    {stats.locationStats.map((location: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{location.location}</span>
                        <span className="text-sm font-medium">{location.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">暂无数据</div>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card title="新增统计" size="small">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">今日新增</span>
                    <span className="text-sm font-medium text-blue-600">{stats.newServers?.today || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">本周新增</span>
                    <span className="text-sm font-medium text-green-600">{stats.newServers?.weekly || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">本月新增</span>
                    <span className="text-sm font-medium text-purple-600">{stats.newServers?.monthly || 0}</span>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* 搜索和筛选 */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">筛选条件</h3>
              <Button 
                type="link" 
                onClick={clearFilters}
                disabled={!searchQuery && !statusFilter.length && !tagFilter.length && !locationFilter}
              >
                清除筛选
              </Button>
            </div>
            
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Input
                  placeholder="搜索服务器名称、IP或主机名"
                  prefix={<SearchOutlined />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                />
              </Col>
              
              <Col xs={24} sm={12} md={5}>
                <Select
                  mode="multiple"
                  placeholder="服务器状态"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="online">
                    <Badge status="success" text="在线" />
                  </Option>
                  <Option value="offline">
                    <Badge status="error" text="离线" />
                  </Option>
                  <Option value="warning">
                    <Badge status="warning" text="警告" />
                  </Option>
                  <Option value="error">
                    <Badge status="error" text="错误" />
                  </Option>
                </Select>
              </Col>
              
              <Col xs={24} sm={12} md={5}>
                <Select
                  mode="multiple"
                  placeholder="服务器标签"
                  value={tagFilter}
                  onChange={setTagFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {allTags.map(tag => (
                    <Option key={tag} value={tag}>
                      <Tag color="blue">{tag}</Tag>
                    </Option>
                  ))}
                </Select>
              </Col>
              
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="机房位置"
                  value={locationFilter}
                  onChange={setLocationFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {allLocations.map(location => (
                    <Option key={location} value={location}>
                      {location}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </div>
        </Card>

        {/* 服务器列表 */}
        <Card 
          title={
            <div className="flex items-center space-x-2">
              <FilterOutlined />
              <span>主机列表 ({filteredServers.length})</span>
            </div>
          }
        >
          <Spin spinning={realLoading}>
            {filteredServers.length === 0 ? (
              <Empty
                description="没有找到匹配的主机"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[16, 16]}>
                {filteredServers.map(server => (
                  <Col xs={24} sm={12} lg={8} xl={6} key={server.id}>
                    <ServerCard
                      server={server}
                      onView={handleViewServer}
                      onEdit={handleEditServer}
                      onTestConnection={handleTestConnection}
                      onSetDefault={handleSetDefaultServer}
                      testConnectionLoading={testConnectionLoading === server.id}
                      connectionStatus={connectionStatuses[server.id]}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </Spin>
        </Card>

        {/* 添加主机模态框 */}
        <AddServerModal
          visible={addModalVisible}
          onCancel={() => setAddModalVisible(false)}
          onSuccess={handleAddServerSuccess}
        />

        {/* 编辑主机模态框 */}
        <EditServerModal
          visible={editModalVisible}
          server={editingServer}
          onCancel={() => {
            setEditModalVisible(false)
            setEditingServer(null)
          }}
          onSuccess={handleEditServerSuccess}
          onDelete={handleDeleteServer}
        />

        {/* 主机详情模态框 */}
        <ServerDetailModal
          visible={detailModalVisible}
          server={viewingServer}
          onCancel={() => {
            setDetailModalVisible(false)
            setViewingServer(null)
          }}
          onEdit={(server) => {
            setDetailModalVisible(false)
            setViewingServer(null)
            handleEditServer(server)
          }}
          onTestConnection={handleTestConnection}
          onServerUpdate={fetchRealServers}
        />
      </div>
      </PermissionGuard>
    </MainLayout>
  )
}

export default ServerListPage