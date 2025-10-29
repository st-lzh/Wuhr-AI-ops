'use client'

import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Switch, Dropdown, Badge, message, Modal } from 'antd'
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
  const { theme, toggleTheme, isDark } = useTheme()
  const pathname = usePathname()
  const {
    canAccessAI,
    canAccessServers,
    canAccessCICD,
    canAccessApprovals,
    canAccessMonitoring,
    canAccessGrafana,
    canAccessNotifications,
    canAccessUsers,
    canAccessPermissions,
    canAccessConfig,
    isAuthenticated,
    user
  } = usePermissions()

  // 根据当前路径确定默认打开的菜单
  const getDefaultOpenKeys = () => {
    // 定义接入管理的所有子页面路径
    const integrationPages = [
      '/monitor',           // Grafana配置
      '/servers/logs'       // ELK日志
    ]

    // 定义用户管理的所有子页面路径
    const userPages = [
      '/users',             // 用户管理相关页面
      '/cicd/approvals',    // 审批管理页面
      '/notifications'      // 通知管理页面
    ]

    // 定义CI&CD管理的所有子页面路径
    const cicdPages = [
      '/cicd/projects',           // 持续集成
      '/cicd/deployments',        // 持续部署
      '/cicd/jenkins-deployments', // Jenkins部署任务
      '/cicd/templates',          // 模板管理
      '/cicd/builds',             // 构建管理
      '/cicd/pipelines',          // 流水线管理
      '/cicd/logs',               // 日志管理
      '/cicd/tasks'               // 任务管理
    ]

    if (pathname.startsWith('/ai')) return ['/ai']
    if (pathname.startsWith('/config')) return ['/config']
    if (pathname.startsWith('/servers') && !pathname.startsWith('/servers/logs')) return ['/servers']

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
      label: <Link href="/">仪表盘</Link>,
    })

    // AI助手
    if (canAccessAI('write')) {
      items.push({
        key: '/ai/system',
        icon: <RobotOutlined />,
        label: <Link href="/ai/system">AI 助手</Link>,
      })
    }

    // 用户管理
    if (canAccessUsers('read') || canAccessPermissions('read') || canAccessApprovals('read') || canAccessNotifications('read')) {
      const userChildren = []

      if (canAccessUsers('read')) {
        userChildren.push({
          key: '/users/info',
          label: <Link href="/users/info">用户信息</Link>,
        })
      }

      if (canAccessPermissions('read')) {
        userChildren.push({
          key: '/users/permissions',
          label: <Link href="/users/permissions">权限管理</Link>,
        })
      }

      if (canAccessApprovals('read')) {
        userChildren.push({
          key: '/cicd/approvals',
          label: <Link href="/cicd/approvals">审批管理</Link>,
        })
      }

      if (canAccessNotifications('read')) {
        userChildren.push({
          key: '/notifications',
          label: (
            <Link href="/notifications">
              通知管理
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

      items.push({
        key: '/users',
        icon: <UserOutlined />,
        label: '用户管理',
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
            label: <Link href="/config/models">模型配置</Link>,
          },
          {
            key: '/config/models/preset',
            label: <Link href="/config/models/preset">预设模型</Link>,
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
            label: <Link href="/servers/groups">主机组列表</Link>,
          },
        ],
      })
    }

    // CI/CD管理
    if (canAccessCICD('read')) {
      items.push({
        key: '/cicd',
        icon: <DeploymentUnitOutlined />,
        label: 'CI&CD',
        children: [
          {
            key: '/cicd/projects',
            label: <Link href="/cicd/projects">持续集成</Link>,
          },
          {
            key: '/cicd/deployments',
            label: <Link href="/cicd/deployments">持续部署</Link>,
          },
          {
            key: '/cicd/jenkins-deployments',
            label: <Link href="/cicd/jenkins-deployments">Jenkins部署</Link>,
          },
          {
            key: '/cicd/templates',
            label: <Link href="/cicd/templates">模板管理</Link>,
          },
        ],
      })
    }

    // 接入管理 - 基于配置和监控权限
    if (canAccessConfig('read') || canAccessMonitoring('read') || canAccessGrafana('read')) {
      const integrationChildren = []

      if (canAccessServers('read')) {
        integrationChildren.push({
          key: '/servers/logs',
          label: <Link href="/servers/logs">ELK日志</Link>,
        })
      }

      if (canAccessGrafana('read')) {
        integrationChildren.push({
          key: '/monitor',
          label: <Link href="/monitor">grafana监控</Link>,
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

    // 工具箱 - 所有用户都可以访问
    items.push({
      key: '/tools',
      icon: <ToolOutlined />,
      label: <Link href="/tools">工具箱</Link>,
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
      <Layout className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`}>
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
                  src={user?.avatar || "https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/%E5%9B%BE%E6%A0%87/%E5%88%9B%E5%BB%BA%E8%B5%9B%E5%8D%9A%E6%9C%8B%E5%85%8B%E5%9B%BE%E6%A0%87%20%283%29.png"}
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
        <Content className="mt-16 p-6 min-h-[calc(100vh-64px)] bg-transparent">
          <div className="animate-fade-in">
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