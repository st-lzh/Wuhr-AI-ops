'use client'

import React from 'react'
// import { Inter } from 'next/font/google' // 暂时注释掉避免网络问题
import './globals.css'
import { GlobalStateProvider } from './contexts/GlobalStateContext'
import { ThemeProvider } from './components/providers/ThemeProvider'
import { useTheme } from './hooks/useGlobalState'
import ErrorBoundary from './components/ErrorBoundary'
import AuthGuard from './components/auth/AuthGuard'
import { AuthInitializer } from './components/AuthInitializer'
import Script from "next/script";

// const inter = Inter({ subsets: ['latin'] }) // 暂时注释掉避免网络问题

// 内部布局组件，用于应用主题类
const InnerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme()
  
  React.useEffect(() => {
    // 应用主题类到body
    document.body.className = `font-sans ${isDark ? 'dark' : 'light'}`
  }, [isDark])

  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 基础meta标签 */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* SEO meta标签 */}
        <title>Wuhr AI Ops - 面向运维工程师的AI助手平台</title>
        <meta name="description" content="Wuhr AI Ops 是一个专为运维工程师设计的AI助手Web系统，集成Gemini CLI，提供智能运维解决方案，支持服务器管理、系统监控、工具箱等功能。" />
        <meta name="keywords" content="AI运维,运维助手,Gemini CLI,DevOps,服务器管理,系统监控,运维自动化,AI聊天,wuhrai" />
        <meta name="author" content="Wuhr AI" />
        
        {/* Open Graph meta标签 */}
        <meta property="og:title" content="Wuhr AI Ops - 面向运维工程师的AI助手平台" />
        <meta property="og:description" content="专为运维工程师设计的AI助手Web系统，集成Gemini CLI，提供智能运维解决方案。" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Wuhr AI Ops" />
        <meta property="og:locale" content="zh_CN" />
        
        {/* Twitter Card meta标签 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Wuhr AI Ops - 面向运维工程师的AI助手平台" />
        <meta name="twitter:description" content="专为运维工程师设计的AI助手Web系统，集成Gemini CLI，提供智能运维解决方案。" />
        
        {/* 其他重要meta标签 */}
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
        <meta name="theme-color" content="#1f2937" />
        
        {/* Favicon */}
        <link rel="icon" href="@https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/%E5%9B%BE%E6%A0%87/%E5%88%9B%E5%BB%BA%E8%B5%9B%E5%8D%9A%E6%9C%8B%E5%85%8B%E5%9B%BE%E6%A0%87%20%283%29.png" />
        <link rel="apple-touch-icon" href="@https://wuhrai-wordpress.oss-cn-hangzhou.aliyuncs.com/%E5%9B%BE%E6%A0%87/%E5%88%9B%E5%BB%BA%E8%B5%9B%E5%8D%9A%E6%9C%8B%E5%85%8B%E5%9B%BE%E6%A0%87%20%283%29.png" />
        
        {/* 性能优化预加载 */}
        <link rel="preconnect" href="https://ai.wuhrai.com" />
        <link rel="preconnect" href="https://gpt.wuhrai.com" />
        <link rel="dns-prefetch" href="//wuhrai.com" />
        
        {/* 外部链接预加载 */}
        <link rel="prefetch" href="/api/version" />
      </head>
      <body className="font-sans">
        <ErrorBoundary>
          <GlobalStateProvider>
            <ThemeProvider>
              <AuthInitializer>
                <InnerLayout>
                  {children}
                </InnerLayout>
              </AuthInitializer>
            </ThemeProvider>
          </GlobalStateProvider>
        </ErrorBoundary>
      
      {/* WUUNU SNIPPET - DON'T CHANGE THIS (START) */}
      {process.env.NODE_ENV !== "production" && (
        <>
          <Script id="wuunu-ws" strategy="afterInteractive">
            { `window.__WUUNU_WS__ = "http://127.0.0.1:58155/";` }
          </Script>
          <Script
            id="wuunu-widget"
            src="https://cdn.jsdelivr.net/npm/@wuunu/widget@0.1?cacheParam=468"
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        </>
      )}
      {/* WUUNU SNIPPET - DON'T CHANGE THIS (END) */}
</body>
    </html>
  )
} 
