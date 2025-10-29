'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Card, Button, Space, Tag, Tooltip, Switch, Input, Select } from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  ClearOutlined, 
  DownloadOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { useProjectLogs, ProjectLogEntry } from '../../app/hooks/useProjectLogs'

const { Option } = Select

interface ProjectLogViewerProps {
  projectId?: string
  height?: string | number
  showControls?: boolean
  realtime?: boolean
  maxLines?: number
  className?: string
  onNewLog?: (log: ProjectLogEntry) => void
}

const ProjectLogViewer: React.FC<ProjectLogViewerProps> = ({
  projectId,
  height = 400,
  showControls = true,
  realtime = false,
  maxLines = 1000,
  className,
  onNewLog
}) => {
  const [isRealtime, setIsRealtime] = useState(realtime)
  const [searchText, setSearchText] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)

  const logContainerRef = useRef<HTMLDivElement>(null)

  const {
    logs,
    loading,
    error,
    connected,
    addLog,
    clearLogs,
    reconnect
  } = useProjectLogs({
    projectId,
    enabled: !!projectId,
    realtime: false, // 暂时禁用实时日志，避免404死循环
    maxLines,
    onNewLog: (log) => {
      // 自动滚动到底部
      if (autoScroll && logContainerRef.current) {
        setTimeout(() => {
          if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
          }
        }, 100)
      }
      // 调用外部回调
      onNewLog?.(log)
    }
  })

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchText || 
      log.message.toLowerCase().includes(searchText.toLowerCase()) ||
      log.action.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter

    return matchesSearch && matchesLevel
  })

  // 获取日志级别的颜色和图标
  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'error':
        return { color: '#ff4d4f', backgroundColor: '#fff2f0' }
      case 'warning':
        return { color: '#faad14', backgroundColor: '#fffbe6' }
      case 'success':
        return { color: '#52c41a', backgroundColor: '#f6ffed' }
      case 'info':
      default:
        return { color: '#1890ff', backgroundColor: '#f0f9ff' }
    }
  }

  // 导出日志
  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.action}] ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-${projectId}-logs-${new Date().toISOString().slice(0, 19)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <Card
      className={className}
      title={
        <div className="flex items-center justify-between">
          <span>项目日志</span>
          {showControls && (
            <Space>
              {/* 连接状态指示器 */}
              <Tooltip title={connected ? '已连接' : '未连接'}>
                {connected ? (
                  <WifiOutlined className="text-green-500" />
                ) : (
                  <DisconnectOutlined className="text-gray-400" />
                )}
              </Tooltip>
              
              {/* 实时开关 */}
              <Tooltip title="实时日志">
                <Switch
                  checked={isRealtime}
                  onChange={setIsRealtime}
                  checkedChildren={<PlayCircleOutlined />}
                  unCheckedChildren={<PauseCircleOutlined />}
                  size="small"
                />
              </Tooltip>

              {/* 自动滚动开关 */}
              <Tooltip title="自动滚动">
                <Switch
                  checked={autoScroll}
                  onChange={setAutoScroll}
                  size="small"
                />
              </Tooltip>
            </Space>
          )}
        </div>
      }
      extra={
        showControls && (
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={reconnect}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Button
              icon={<ClearOutlined />}
              onClick={clearLogs}
              size="small"
            >
              清空
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
              size="small"
            >
              导出
            </Button>
          </Space>
        )
      }
      size="small"
    >
      {/* 过滤控件 */}
      {showControls && (
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="搜索日志内容..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            size="small"
          />
          <Select
            value={levelFilter}
            onChange={setLevelFilter}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="all">所有级别</Option>
            <Option value="info">信息</Option>
            <Option value="success">成功</Option>
            <Option value="warning">警告</Option>
            <Option value="error">错误</Option>
          </Select>
        </div>
      )}

      {/* 日志内容 */}
      <div
        ref={logContainerRef}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          overflowY: 'auto',
          backgroundColor: '#001529',
          padding: '12px',
          borderRadius: '4px',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: '12px',
          lineHeight: '1.4'
        }}
      >
        {error && (
          <div className="text-red-400 mb-2 p-2 bg-red-900/20 rounded">
            ❌ {error}
          </div>
        )}

        {filteredLogs.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            {loading ? '正在加载日志...' : '暂无日志数据'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className="flex items-start gap-2 py-1 hover:bg-gray-800/50 rounded px-1"
            >
              {/* 时间戳 */}
              <span className="text-gray-400 text-xs shrink-0 w-20">
                {formatTimestamp(log.timestamp)}
              </span>

              {/* 级别标签 */}
              <Tag
                style={getLogLevelStyle(log.level)}
                className="shrink-0 text-xs"
              >
                {log.level.toUpperCase()}
              </Tag>

              {/* 操作类型 */}
              <span className="text-blue-400 text-xs shrink-0 w-24 truncate">
                [{log.action}]
              </span>

              {/* 消息内容 */}
              <span className="text-gray-200 flex-1">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 状态栏 */}
      {showControls && (
        <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
          <span>
            显示 {filteredLogs.length} / {logs.length} 条日志
          </span>
          <span>
            {isRealtime ? (connected ? '实时连接中' : '连接中断') : '静态模式'}
          </span>
        </div>
      )}
    </Card>
  )
}

export default ProjectLogViewer
