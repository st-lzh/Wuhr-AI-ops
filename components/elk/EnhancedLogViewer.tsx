'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Input,
  Select,
  Button,
  Space,
  DatePicker,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
  Spin,
  Empty,
  Typography
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FilterOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Text } = Typography

interface LogEntry {
  '@timestamp': string
  level: string
  message: string
  source?: string
  host?: string
  logger?: string
  stack_trace?: string
  [key: string]: any
}

interface LogViewerProps {
  elkConfig: any
  height?: string
  onConfigChange?: (config: any) => void
}

const EnhancedLogViewer: React.FC<LogViewerProps> = ({ elkConfig, height = 'calc(100vh - 200px)', onConfigChange }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(1, 'hour'),
    dayjs()
  ])
  const [logLevel, setLogLevel] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const containerRef = useRef<HTMLDivElement>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout>()

  // 日志级别颜色映射
  const levelColors = {
    ERROR: 'red',
    FATAL: 'red',
    WARN: 'orange',
    WARNING: 'orange',
    INFO: 'blue',
    DEBUG: 'green',
    TRACE: 'gray'
  }

  // 表格列配置
  const columns = [
    {
      title: '时间',
      dataIndex: '@timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => (
        <Text style={{ fontSize: '12px' }}>
          {dayjs(timestamp).format('MM-DD HH:mm:ss.SSS')}
        </Text>
      ),
      sorter: (a: LogEntry, b: LogEntry) => 
        dayjs(a['@timestamp']).valueOf() - dayjs(b['@timestamp']).valueOf()
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => (
        <Tag color={levelColors[level as keyof typeof levelColors] || 'default'}>
          {level}
        </Tag>
      ),
      filters: [
        { text: 'ERROR', value: 'ERROR' },
        { text: 'WARN', value: 'WARN' },
        { text: 'INFO', value: 'INFO' },
        { text: 'DEBUG', value: 'DEBUG' }
      ],
      onFilter: (value: any, record: LogEntry) => record.level === value
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (source: string) => source || '-'
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host',
      width: 120,
      render: (host: string) => host || '-'
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: {
        showTitle: false
      },
      render: (message: string) => (
        <Tooltip title={message} placement="topLeft">
          <Text style={{ fontSize: '13px' }}>{message}</Text>
        </Tooltip>
      )
    }
  ]

  // 获取真实的Elasticsearch日志数据
  const fetchLogs = async () => {
    setLoading(true)
    try {
      // 构建查询参数
      const queryParams = {
        query: searchQuery || '*',
        timeRange: {
          from: timeRange[0].toISOString(),
          to: timeRange[1].toISOString()
        },
        size: pageSize,
        from: (currentPage - 1) * pageSize,
        sort: [{ '@timestamp': { order: 'desc' } }],
        filters: []
      }

      // 添加日志级别过滤器
      if (logLevel !== 'all') {
        (queryParams.filters as any[]).push({
          field: 'level',
          operator: 'is',
          value: logLevel
        })
      }

      console.log('🔍 查询参数:', queryParams)

      // 调用Elasticsearch搜索API
      const response = await fetch('/api/elk/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryParams)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setLogs(result.data.logs || [])
          console.log(`✅ 获取到 ${result.data.logs.length} 条日志，总计 ${result.data.total} 条`)
        } else {
          message.error(result.error || '获取日志失败')
          console.error('获取日志失败:', result.error)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        message.error(errorData.error || '获取日志失败')
        console.error('获取日志失败:', errorData)
      }
    } catch (error) {
      message.error('获取日志失败：网络错误')
      console.error('获取日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 搜索日志
  const handleSearch = () => {
    fetchLogs()
  }

  // 切换全屏模式
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (onConfigChange) {
      onConfigChange({
        ...elkConfig,
        layout: {
          ...elkConfig.layout,
          fullscreen: !isFullscreen
        }
      })
    }
  }

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchLogs()
      }, refreshInterval * 1000)
    } else {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [autoRefresh, refreshInterval])

  // 初始加载和参数变化时重新加载
  useEffect(() => {
    fetchLogs()
  }, [searchQuery, timeRange, logLevel, currentPage, pageSize])

  // 初始加载
  useEffect(() => {
    fetchLogs()
  }, [])

  const containerStyle: React.CSSProperties = {
    height: isFullscreen ? '100vh' : height,
    position: isFullscreen ? 'fixed' : 'relative',
    top: isFullscreen ? 0 : 'auto',
    left: isFullscreen ? 0 : 'auto',
    right: isFullscreen ? 0 : 'auto',
    bottom: isFullscreen ? 0 : 'auto',
    zIndex: isFullscreen ? 9999 : 'auto',
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column'
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* 工具栏 */}
      {showFilters && (
        <Card size="small" style={{ marginBottom: 8, flexShrink: 0 }}>
          <Space wrap>
            <Input.Search
              placeholder="搜索日志内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
            />
            
            <RangePicker
              value={timeRange}
              onChange={(dates) => dates && dates[0] && dates[1] && setTimeRange([dates[0], dates[1]])}
              showTime
              format="MM-DD HH:mm"
              style={{ width: 300 }}
            />
            
            <Select
              value={logLevel}
              onChange={setLogLevel}
              style={{ width: 120 }}
              placeholder="日志级别"
            >
              <Option value="all">全部级别</Option>
              <Option value="ERROR">ERROR</Option>
              <Option value="WARN">WARN</Option>
              <Option value="INFO">INFO</Option>
              <Option value="DEBUG">DEBUG</Option>
            </Select>

            <Space>
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                checkedChildren="自动刷新"
                unCheckedChildren="手动刷新"
              />
              
              {autoRefresh && (
                <Select
                  value={refreshInterval}
                  onChange={setRefreshInterval}
                  style={{ width: 80 }}
                  size="small"
                >
                  <Option value={10}>10s</Option>
                  <Option value={30}>30s</Option>
                  <Option value={60}>1m</Option>
                  <Option value={300}>5m</Option>
                </Select>
              )}
            </Space>

            <Button
              icon={<ReloadOutlined />}
              onClick={fetchLogs}
              loading={loading}
            >
              刷新
            </Button>

            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? 'primary' : 'default'}
            >
              过滤器
            </Button>

            <Button
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
          </Space>
        </Card>
      )}

      {/* 日志表格 */}
      <Card 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        bodyStyle={{ 
          flex: 1, 
          padding: 0,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Table
          columns={columns}
          dataSource={logs}
          loading={loading}
          size="small"
          rowKey={(record) => `${record['@timestamp']}-${Math.random()}`}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: logs.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size || 50)
            }
          }}
          scroll={{ 
            y: isFullscreen ? 'calc(100vh - 200px)' : 'calc(100% - 120px)',
            x: 'max-content'
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无日志数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </Card>
    </div>
  )
}

export default EnhancedLogViewer
