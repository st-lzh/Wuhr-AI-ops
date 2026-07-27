'use client'

import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Switch, Dropdown, Badge, message, Modal, Grid } from 'antd'
import {
  DashboardOutlined,
  RobotOutlined,
  SettingOutlined,
  CloudServerOutlined,
  MonitorOutlined,
  ToolOutlined,
  UserOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  DeploymentUnitOutlined,
  ControlOutlined,
  FileTextOutlined,
  BulbOutlined,
  GlobalOutlined,
  ScheduleOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  ClusterOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '../../hooks/useGlobalState'
import { usePermissions } from '../../hooks/usePermissions'
import GlobalLoadingIndicator from '../GlobalLoadingIndicator'
import NotificationBell from '../notifications/NotificationBell'
import NotificationPanel from '../notifications/NotificationPanel'
import InfoNotificationBell from '../notifications/InfoNotificationBell'
import UnifiedNotificationBell from '../notifications/UnifiedNotificationBell'

const { Header, Sider, Content } = Layout

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [notificationVisible, setNotificationVisible] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0) // 初始为0，从API获取实时数据
  const [unreadCount, setUnreadCount] = useState(0) // 未读通知数量
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const screens = Grid.useBreakpoint()
  const { theme, toggleTheme, isDark } = useTheme()
  const pathname = usePathname()
  const {
    canAccessAI,
    canAccessServers,
    canAccessNetwork,
    canAccessCICD,
    canAccessApprovals,
    canAccessMonitoring,
    canAccessGrafana,
    canAccessNotifications,
    canAccessUsers,
    canAccessPermissions,
    canAccessConfig,
    canAccessImprove,
    isAuthenticated,
    user
  } = usePermissions()

  // 根据当前路径确定默认打开的菜单
  const getDefaultOpenKeys = () => {
    // 定义接入管理的所有子页面路径
    const integrationPages = [
      '/integration',       // 接入总览、代码接入和任务接入
      '/integration/alerts',
      '/integration/artifacts',
      '/monitor',           // Grafana配置
      '/servers/logs'       // ELK日志
    ]

    // 定义用户管理的所有子页面路径
    const userPages = [
      '/users',             // 用户管理相关页面
      '/admin/roles',       // 角色管理页面
      '/cicd/approvals',    // 审批管理页面
      '/notifications',     // 通知管理页面
      '/governance/credentials'
    ]

    // 定义CI&CD管理的所有子页面路径
    const cicdPages = [
      '/cicd',                    // 交付管理及兼容入口
      '/cicd/projects',           // 持续集成
      '/cicd/deployments',        // 持续部署
      '/cicd/jenkins-deployments', // Jenkins部署任务
      '/cicd/templates',          // 模板管理
      '/cicd/builds',             // 构建管理
      '/cicd/pipelines',          // 流水线管理
      '/cicd/ai-reports',         // AI 持久化报告
      '/cicd/logs',               // 日志管理
      '/cicd/tasks'               // 任务管理
    ]

    if (pathname.startsWith('/ai')) return ['/ai']
    if (pathname.startsWith('/improve')) return ['/improve']
    if (pathname.startsWith('/knowledge')) return ['/improve']
    if (pathname.startsWith('/config')) return ['/config']
    if (pathname.startsWith('/servers') && !pathname.startsWith('/servers/logs')) return ['/servers']
    if (pathname.startsWith('/network')) return ['/network']
    if (pathname.startsWith('/operations')) return ['/operations']
    if (pathname.startsWith('/governance')) return ['/users']

    // 检查是否在用户管理的任何子页面
    if (userPages.some(page => pathname.startsWith(page))) {
      return ['/users']
    }

    // 检查是否在CI&CD管理的任何子页面
    if (cicdPages.some(page => pathname.startsWith(page))) {
      return ['/cicd']
    }

    // 检查是否在接入管理的任何子页面
    if (integrationPages.some(page => pathname.startsWith(page))) {
      return ['/integration']
    }

    return []
  }

  // 初始化菜单展开状态
  useEffect(() => {
    setOpenKeys(getDefaultOpenKeys())
  }, [pathname])

  // 中小屏自动收起侧栏，避免固定侧栏挤压驾驶舱和表格内容。
  useEffect(() => {
    if (screens.xl === false) setCollapsed(true)
  }, [screens.xl])

  // 处理菜单展开状态变化
  const handleOpenChange = (keys: string[]) => {
    // 使用Antd Menu的默认行为，允许用户自由展开/折叠菜单
    // 只在用户主动点击时更新状态，不强制保持展开
    setOpenKeys(keys)
  }

  // 获取初始通知数量
  const fetchNotificationCount = async () => {
    try {
      // 同时获取审批任务和信息通知中的审批通知
      const [pendingApprovalsResponse, infoNotificationsResponse] = await Promise.all([
        fetch('/api/notifications/pending-approvals'),
        fetch('/api/notifications/info?includeRead=false&limit=1')
      ])

      const pendingApprovalsData = await pendingApprovalsResponse.json()
      const infoNotificationsData = await infoNotificationsResponse.json()

      let totalApprovalCount = 0
      let totalUnreadCount = 0

      // 统计审批任务数量
      if (pendingApprovalsData.success) {
        totalApprovalCount += pendingApprovalsData.data.total || 0
      }

      // 统计信息通知中的未读数量（包括审批通知）
      if (infoNotificationsData.success) {
        totalUnreadCount = infoNotificationsData.data.unreadCount || 0
        // 如果有审批通知的未读数量，也加入到审批计数中
        const unreadApprovalCount = infoNotificationsData.data.unreadApprovalCount || 0
        totalApprovalCount += unreadApprovalCount
      }

      setNotificationCount(totalApprovalCount)
      setUnreadCount(totalUnreadCount)

    } catch (error) {
      console.error('获取通知数量失败:', error)
      // 静默失败，不影响用户体验
    }
  }

  // 页面加载时获取通知数量 - 优化：延迟加载，减少重复查询
  useEffect(() => {
    // 延迟3秒加载，让页面先渲染完成
    const timer = setTimeout(() => {
      fetchNotificationCount()
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [])

  // 基于权限动态生成菜单项
  const getMenuItems = () => {
    const items = []

    // 仪表盘 - 所有用户都可以访问
    items.push({
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link href="/">仪表总览</Link>,
    })

    // AI助手
    if (canAccessAI('write')) {
      items.push({
        key: '/ai/system',
        icon: <RobotOutlined />,
        label: <Link href="/ai/system">智能助手</Link>,
      })
    }

    // AI 资产（self-improving 教训库 / 执行历史 / 技能 / 记忆）
    if (canAccessImprove('read')) {
      items.push({
        key: '/improve',
        icon: <BulbOutlined />,
        label: '智能资产',
        children: [
          {
            key: '/improve/lessons',
            label: <Link href="/improve/lessons">经验教训</Link>,
          },
          {
            key: '/improve/outcomes',
            label: <Link href="/improve/outcomes">执行记录</Link>,
          },
          {
            key: '/improve/skills',
            label: <Link href="/improve/skills">技能管理</Link>,
          },
          {
            key: '/improve/memory',
            label: <Link href="/improve/memory">记忆管理</Link>,
          },
          {
            key: '/knowledge',
            label: <Link href="/knowledge">知识管理</Link>,
          },
        ],
      })
    }

    // 用户管理
    if (canAccessUsers('read') || canAccessPermissions('read') || canAccessApprovals('read') || canAccessNotifications('read')) {
      const userChildren = []

      if (canAccessUsers('read')) {
        userChildren.push({
          key: '/users/info',
          label: <Link href="/users/info">用户列表</Link>,
        })
      }

      if (canAccessPermissions('read')) {
        userChildren.push({
          key: '/users/permissions',
          label: <Link href="/users/permissions">角色权限</Link>,
        })
      }

      if (canAccessApprovals('read')) {
        userChildren.push({
          key: '/cicd/approvals',
          label: <Link href="/cicd/approvals">审批中心</Link>,
        })
      }

      if (canAccessNotifications('read')) {
        userChildren.push({
          key: '/notifications',
          label: (
            <Link href="/notifications">
              消息通知
              {unreadCount > 0 && (
                <Badge
                  count={unreadCount}
                  size="small"
                  style={{ marginLeft: 8 }}
                />
              )}
            </Link>
          ),
        })
      }

      if (canAccessPermissions('read')) {
        userChildren.push({
          key: '/governance/audit',
          label: <Link href="/governance/audit">审计日志</Link>,
        })
        userChildren.push({
          key: '/governance/credentials',
          label: <Link href="/governance/credentials">凭据治理</Link>,
        })
      }

      items.push({
        key: '/users',
        icon: <SafetyCertificateOutlined />,
        label: '安全治理',
        children: userChildren,
      })
    }

    // 配置管理
    if (canAccessConfig('read')) {
      items.push({
        key: '/config',
        icon: <SettingOutlined />,
        label: '模型管理',
        children: [
          {
            key: '/config/models',
            label: <Link href="/config/models">模型接入</Link>,
          },
          {
            key: '/config/mcp',
            label: <Link href="/config/mcp">MCP工具</Link>,
          },
          {
            key: '/config/tools',
            label: <Link href="/config/tools">脚本管理</Link>,
          },
        ],
      })
    }

    // 主机管理
    if (canAccessServers('read')) {
      items.push({
        key: '/servers',
        icon: <CloudServerOutlined />,
        label: '主机管理',
        children: [
          {
            key: '/servers/list',
            label: <Link href="/servers/list">主机列表</Link>,
          },
          {
            key: '/servers/groups',
            label: <Link href="/servers/groups">主机分组</Link>,
          },
        ],
      })

      items.push({
        key: '/operations',
        icon: <ScheduleOutlined />,
        label: '作业中心',
        children: [
          { key: '/operations/jobs', label: <Link href="/operations/jobs">作业管理</Link> },
          { key: '/operations/runs', label: <Link href="/operations/runs">执行记录</Link> },
        ],
      })

    }

    // 网络管理：设备资产与真实变更执行统一入口
    if (canAccessNetwork('read')) {
      items.push({
        key: '/network',
        icon: <GlobalOutlined />,
        label: '网络管理',
        children: [
          { key: '/network/devices', label: <Link href="/network/devices">设备资产</Link> },
          { key: '/network/groups', label: <Link href="/network/groups">设备分组</Link> },
          { key: '/network/configs', label: <Link href="/network/configs">配置中心</Link> },
          { key: '/network/topology', label: <Link href="/network/topology">网络拓扑</Link> },
          { key: '/network/changes', label: <Link href="/network/changes">变更管理</Link> },
          { key: '/network/inspections', label: <Link href="/network/inspections">网络巡检</Link> },
          { key: '/network/alerts', label: <Link href="/network/alerts">网络告警</Link> },
        ],
      })
    }

    // CI/CD管理
    if (canAccessCICD('read')) {
      items.push({
        key: '/cicd',
        icon: <DeploymentUnitOutlined />,
        label: '交付管理',
        children: [
          {
            key: '/cicd/projects',
            label: <Link href="/cicd/projects">项目管理</Link>,
          },
          {
            key: '/cicd/deployments',
            label: <Link href="/cicd/deployments">部署管理</Link>,
          },
          {
            key: '/cicd/pipelines',
            label: <Link href="/cicd/pipelines">流水管理</Link>,
          },
          {
            key: '/cicd/builds',
            label: <Link href="/cicd/builds">构建记录</Link>,
          },
          {
            key: '/cicd/jenkins-deployments',
            label: <Link href="/cicd/jenkins-deployments">任务部署</Link>,
          },
          {
            key: '/cicd/templates',
            label: <Link href="/cicd/templates">模板管理</Link>,
          },
          {
            key: '/cicd/ai-reports',
            label: <Link href="/cicd/ai-reports">智能报告</Link>,
          },
        ],
      })
    }

    // 接入管理 - 基于配置和监控权限
    if (canAccessConfig('read') || canAccessMonitoring('read') || canAccessGrafana('read')) {
      const integrationChildren = []

      integrationChildren.push({
        key: '/integration',
        label: <Link href="/integration">接入总览</Link>,
      })

      if (canAccessServers('read')) {
        integrationChildren.push({
          key: '/servers/logs',
          label: <Link href="/servers/logs">日志接入</Link>,
        })
      }

      if (canAccessGrafana('read')) {
        integrationChildren.push({
          key: '/monitor',
          label: <Link href="/monitor">监控接入</Link>,
        })
      }

      if (canAccessConfig('read')) {
        integrationChildren.push({
          key: '/integration/git',
          label: <Link href="/integration/git">代码接入</Link>,
        })
      }

      if (canAccessCICD('read')) {
        integrationChildren.push({
          key: '/integration/jenkins',
          label: <Link href="/integration/jenkins">任务接入</Link>,
        })
        integrationChildren.push({
          key: '/integration/artifacts',
          label: <Link href="/integration/artifacts">制品管理</Link>,
        })
      }

      if (canAccessMonitoring('read')) {
        integrationChildren.push({
          key: '/integration/alerts',
          label: <Link href="/integration/alerts">告警接入</Link>,
        })
      }

      if (integrationChildren.length > 0) {
        items.push({
          key: '/integration',
          icon: <ControlOutlined />,
          label: '接入管理',
          children: integrationChildren,
        })
      }
    }

    // 无子菜单的直接入口统一排列在分组菜单之后，侧边栏层级更整齐
    if (canAccessServers('read')) {
      items.push({
        key: '/clusters',
        icon: <ClusterOutlined />,
        label: <Link href="/clusters">集群管理</Link>,
      })
    }

    if (canAccessMonitoring('read')) {
      items.push({
        key: '/events',
        icon: <AlertOutlined />,
        label: <Link href="/events">事件中心</Link>,
      })
    }

    // 工具箱 - 所有用户都可以访问
    items.push({
      key: '/tools',
      icon: <ToolOutlined />,
      label: <Link href="/tools">运维工具</Link>,
    })

    return items
  }

  const menuItems = getMenuItems()

  // 处理通知点击
  const handleNotificationClick = () => {
    setNotificationVisible(true)
  }

  // 处理用户菜单点击
  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        window.location.href = '/profile'
        break
      case 'settings':
        window.location.href = '/settings'
        break
      case 'logout':
        Modal.confirm({
          title: '确认退出',
          content: '您确定要退出登录吗？',
          okText: '确定',
          cancelText: '取消',
          onOk: async () => {
            try {
              // 设置退出标记，防止自动重新登录
              sessionStorage.setItem('user_logged_out', 'true')
              // 🔥 清除登录时间戳和刚登录标记，确保退出生效
              sessionStorage.removeItem('login_timestamp')
              sessionStorage.removeItem('just_logged_in')

              console.log('🚪 开始退出登录...')

              // 调用退出登录API
              const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
              })

              console.log('📡 退出登录响应状态:', response.status, response.ok)

              if (response.ok) {
                const data = await response.json()
                console.log('✅ 退出登录成功:', data)

                message.success('已退出登录')
                // 清除本地存储的认证状态
                localStorage.removeItem('auth')
                sessionStorage.removeItem('auth')
                // 跳转到登录页面
                window.location.href = '/login'
              } else {
                const errorText = await response.text()
                console.error('❌ 退出登录失败:', response.status, errorText)
                throw new Error(`退出登录失败: ${response.status} ${errorText}`)
              }
            } catch (error) {
              console.error('❌ 退出登录错误:', error)
              message.error('退出登录失败，请重试')
              // 如果退出失败，移除退出标记
              sessionStorage.removeItem('user_logged_out')
            }
          },
        })
        break
      default:
        break
    }
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  return (
    <Layout className="min-h-screen">
      {/* 全局加载指示器 */}
      <GlobalLoadingIndicator />
      
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={256}
        className="fixed left-0 top-0 bottom-0 z-10 overflow-auto"
      >
        {/* Logo */}
        <div className={`h-16 flex items-center justify-center px-4 border-b ${
          isDark ? 'border-gray-700/30' : 'border-gray-200/50'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
              <RobotOutlined className="text-white text-lg" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold gradient-text">Wuhr AI</h1>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Ops Platform
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          items={menuItems}
          className="border-r-0 bg-transparent"
        />
      </Sider>

      {/* 主内容区 */}
      <Layout
        className="transition-all duration-300 min-w-0"
        style={{
          marginLeft: collapsed ? 80 : 256,
          width: `calc(100% - ${collapsed ? 80 : 256}px)`,
        }}
      >
        {/* 顶部导航 */}
        <Header 
          className="fixed top-0 right-0 z-10 px-6 flex items-center justify-between"
          style={{
            left: collapsed ? 80 : 256,
          }}
        >
          {/* 左侧 */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`p-2 rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-gray-700/50 text-gray-300' 
                  : 'hover:bg-gray-200/50 text-gray-600'
              }`}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            
            <div className={`text-lg font-semibold ${
              isDark ? 'text-gray-100' : 'text-gray-800'
            }`}>
              运维AI助手平台
            </div>
          </div>

          {/* 右侧 */}
          <div className="flex items-center space-x-4">
            {/* 主题切换 */}
            <div className="flex items-center space-x-2">
              <SunOutlined className={isDark ? 'text-gray-400' : 'text-orange-500'} />
              <Switch
                checked={isDark}
                onChange={toggleTheme}
                size="small"
              />
              <MoonOutlined className={isDark ? 'text-blue-400' : 'text-gray-400'} />
            </div>

            {/* 统一通知铃铛 */}
            <UnifiedNotificationBell
              className={isDark
                ? 'text-gray-300 hover:text-blue-400'
                : 'text-gray-600 hover:text-blue-500'
              }
            />

            {/* 用户菜单 */}
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleUserMenuClick
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className={`flex items-center space-x-2 cursor-pointer px-3 py-2 rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-gray-700/50' 
                  : 'hover:bg-gray-200/50'
              }`}>
                <Avatar
                  size="small"
                  src={user?.avatar || undefined}
                  icon={<UserOutlined />}
                />
                <span className={`text-sm truncate max-w-32 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`} title={user?.email ? `${user.username} (${user.email})` : user?.username || '运维工程师'}>
                  {user?.username || user?.email || '运维工程师'}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 内容区域 */}
        <Content className="mt-16 p-6 min-w-0 min-h-[calc(100vh-64px)] bg-transparent">
          <div className="animate-fade-in min-w-0">
            {children}
          </div>
        </Content>
      </Layout>

      {/* 通知面板 */}
      <NotificationPanel
        visible={notificationVisible}
        onClose={() => setNotificationVisible(false)}
        onNotificationCountChange={setNotificationCount}
      />
    </Layout>
  )
}

export default MainLayout
