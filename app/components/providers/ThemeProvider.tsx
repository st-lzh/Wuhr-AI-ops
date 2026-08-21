'use client'

import React, { useEffect } from 'react'
import { ConfigProvider, theme } from 'antd'
import { useTheme } from '../../hooks/useGlobalState'

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme: currentTheme, isDark } = useTheme()

  // 更新 HTML 类名
  useEffect(() => {
    const htmlElement = document.documentElement
    const bodyElement = document.body

    console.log('🎨 [ThemeProvider] 应用主题:', currentTheme, '是否暗色:', isDark)

    if (isDark) {
      htmlElement.classList.add('dark')
      htmlElement.classList.remove('light')
      bodyElement.classList.add('dark')
      bodyElement.classList.remove('light')
    } else {
      htmlElement.classList.add('light')
      htmlElement.classList.remove('dark')
      bodyElement.classList.add('light')
      bodyElement.classList.remove('dark')
    }
  }, [isDark, currentTheme])

  // 深色主题配置
  const darkThemeConfig = {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: '#3b82f6',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
      borderRadius: 8,
      fontSize: 14,
      colorBgContainer: 'rgba(15, 23, 42, 0.6)',
      colorBgElevated: 'rgba(15, 23, 42, 0.8)',
      colorBorder: 'rgba(71, 85, 105, 0.3)',
      colorText: '#f8fafc',
      colorTextSecondary: '#cbd5e1',
      colorLink: '#60a5fa',
      colorLinkHover: '#93c5fd',
      colorLinkActive: '#3b82f6',
    },
    components: {
      Layout: {
        bodyBg: 'transparent',
        siderBg: 'rgba(15, 23, 42, 0.8)',
        headerBg: 'rgba(15, 23, 42, 0.9)',
      },
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: 'rgba(59, 130, 246, 0.2)',
        itemHoverBg: 'rgba(59, 130, 246, 0.1)',
        itemColor: '#cbd5e1',
        itemSelectedColor: '#3b82f6',
        itemHoverColor: '#3b82f6',
        subMenuItemBg: 'transparent',
      },
      Button: {
        defaultBg: 'transparent',
        defaultColor: '#cbd5e1',
        defaultBorderColor: 'rgba(148, 163, 184, 0.35)',
        defaultHoverBg: 'rgba(59, 130, 246, 0.10)',
        defaultActiveBg: 'rgba(59, 130, 246, 0.16)',
        defaultHoverColor: '#93c5fd',
        defaultHoverBorderColor: 'rgba(96, 165, 250, 0.65)',
        defaultActiveColor: '#bfdbfe',
        defaultActiveBorderColor: '#60a5fa',
        textHoverBg: 'rgba(59, 130, 246, 0.10)',
        defaultShadow: 'none',
        primaryShadow: 'none',
        dangerShadow: 'none',
      },
      Card: {
        colorBgContainer: 'rgba(15, 23, 42, 0.6)',
        colorBorderSecondary: 'rgba(71, 85, 105, 0.3)',
      },
      Input: {
        colorBgContainer: 'rgba(15, 23, 42, 0.6)',
        colorBorder: 'rgba(71, 85, 105, 0.3)',
      },
      Select: {
        colorBgContainer: 'rgba(15, 23, 42, 0.6)',
        colorBorder: 'rgba(71, 85, 105, 0.3)',
      },
      Form: {
        labelColor: '#cbd5e1',
      },
      Modal: {
        contentBg: 'rgba(15, 23, 42, 0.9)',
        headerBg: 'rgba(15, 23, 42, 0.9)',
        footerBg: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
      },
    },
  }

  // 浅色主题配置
  const lightThemeConfig = {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#3b82f6',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
      borderRadius: 8,
      fontSize: 14,
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBorder: '#e2e8f0',
      colorText: '#1e293b',
      colorTextSecondary: '#64748b',
      colorLink: '#2563eb',
      colorLinkHover: '#1d4ed8',
      colorLinkActive: '#1e40af',
    },
    components: {
      Layout: {
        bodyBg: 'transparent',
        siderBg: 'rgba(255, 255, 255, 0.9)',
        headerBg: 'rgba(255, 255, 255, 0.9)',
      },
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: 'rgba(59, 130, 246, 0.1)',
        itemHoverBg: 'rgba(59, 130, 246, 0.05)',
        itemColor: '#64748b',
        itemSelectedColor: '#3b82f6',
        itemHoverColor: '#3b82f6',
        subMenuItemBg: 'transparent',
      },
      Button: {
        defaultBg: 'transparent',
        defaultColor: '#334155',
        defaultBorderColor: '#cbd5e1',
        defaultHoverBg: 'rgba(59, 130, 246, 0.07)',
        defaultActiveBg: 'rgba(59, 130, 246, 0.12)',
        defaultHoverColor: '#2563eb',
        defaultHoverBorderColor: '#60a5fa',
        defaultActiveColor: '#1d4ed8',
        defaultActiveBorderColor: '#3b82f6',
        textHoverBg: 'rgba(59, 130, 246, 0.07)',
        defaultShadow: 'none',
        primaryShadow: 'none',
        dangerShadow: 'none',
      },
      Card: {
        colorBgContainer: 'rgba(255, 255, 255, 0.8)',
        colorBorderSecondary: '#e2e8f0',
      },
      Input: {
        colorBgContainer: '#ffffff',
        colorBorder: '#e2e8f0',
      },
      Select: {
        colorBgContainer: '#ffffff',
        colorBorder: '#e2e8f0',
      },
      Modal: {
        contentBg: '#ffffff',
        headerBg: '#ffffff',
        footerBg: '#ffffff',
        titleColor: '#0f172a',
      },
    },
  }

  const themeConfig = isDark ? darkThemeConfig : lightThemeConfig

  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  )
}
