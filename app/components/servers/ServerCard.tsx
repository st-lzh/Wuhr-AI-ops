import React from 'react'
import { Card, Tag, Badge, Button, Tooltip, Typography } from 'antd'
import {
  DesktopOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  EyeOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons'
import { ServerInfo } from '../../types/access-management'

const { Text, Paragraph } = Typography

interface ServerCardProps {
  server: ServerInfo
  onView?: (server: ServerInfo) => void
  onEdit?: (server: ServerInfo) => void
  onTestConnection?: (server: ServerInfo) => void
  onSetDefault?: (server: ServerInfo) => void
  loading?: boolean
  testConnectionLoading?: boolean
  connectionStatus?: 'success' | 'error' | null
}

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onView,
  onEdit,
  onTestConnection,
  onSetDefault,
  loading = false,
  testConnectionLoading = false,
  connectionStatus = null
}) => {
  // 状态颜色映射
  const getStatusConfig = (status: ServerInfo['status']) => {
    switch (status) {
      case 'online':
        return { color: 'green', text: '在线', badge: 'success' }
      case 'offline':
        return { color: 'red', text: '离线', badge: 'error' }
      case 'warning':
        return { color: 'orange', text: '警告', badge: 'warning' }
      case 'error':
        return { color: 'red', text: '错误', badge: 'error' }
      default:
        return { color: 'gray', text: '未知', badge: 'default' }
    }
  }

  const statusConfig = getStatusConfig(server.status)

  // 格式化时间
  const formatTime = (date: Date | string) => {
    if (!date) return '未知'

    const dateObj = typeof date === 'string' ? new Date(date) : date

    // 检查日期是否有效
    if (isNaN(dateObj.getTime())) return '无效日期'

    return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
      Math.round((dateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    )
  }

  return (
    <Card
      className="server-card"
      hoverable
      size="small"
      title={
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <DesktopOutlined className="text-blue-500 flex-shrink-0" />
            <span className="font-medium truncate">{server.name}</span>
            <Tooltip title={server.isDefault ? "默认主机" : "设为默认主机"}>
              <Button
                type="text"
                size="small"
                icon={server.isDefault ? <StarFilled /> : <StarOutlined />}
                onClick={() => onSetDefault?.(server)}
                className={`${
                  server.isDefault 
                    ? "text-yellow-500 hover:text-yellow-600" 
                    : "text-gray-400 hover:text-yellow-500"
                } p-0 h-auto min-w-0 flex-shrink-0`}
                style={{ border: 'none', boxShadow: 'none' }}
              />
            </Tooltip>
            <Badge status={statusConfig.badge as any} text={statusConfig.text} className="flex-shrink-0" />
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
            <Tooltip title="连接测试">
              <Button
                type="text"
                size="small"
                icon={
                  connectionStatus === 'success' ? (
                    <CheckCircleOutlined className="text-green-500" />
                  ) : connectionStatus === 'error' ? (
                    <CloseCircleOutlined className="text-red-500" />
                  ) : (
                    <ApiOutlined />
                  )
                }
                onClick={() => onTestConnection?.(server)}
                loading={testConnectionLoading}
                className={
                  connectionStatus === 'success'
                    ? "text-green-500 hover:text-green-600"
                    : connectionStatus === 'error'
                    ? "text-red-500 hover:text-red-600"
                    : "text-blue-500 hover:text-blue-600"
                }
                style={{
                  border: '1px solid #d9d9d9'
                }}
              />
            </Tooltip>
            <Tooltip title="查看详情">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onView?.(server)}
              />
            </Tooltip>
            <Tooltip title="设置">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => onEdit?.(server)}
              />
            </Tooltip>
          </div>
        </div>
      }
      extra={null}
      styles={{
        body: { padding: '12px 16px' }
      }}
    >
      <div className="space-y-3">
        {/* 基本信息 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <Text type="secondary">主机名:</Text>
            <br />
            <Text code className="text-xs">{server.hostname}</Text>
          </div>
          <div>
            <Text type="secondary">IP地址:</Text>
            <br />
            <Text code className="text-xs">{server.ip}:{server.port}</Text>
          </div>
        </div>

        {/* 系统信息 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <Text type="secondary">操作系统:</Text>
            <br />
            <Text className="text-xs">{server.os}</Text>
          </div>
          <div className="flex items-center space-x-1">
            <EnvironmentOutlined className="text-gray-400" />
            <Text type="secondary" className="text-xs">{server.location}</Text>
          </div>
        </div>

        {/* 描述 */}
        {server.description && (
          <div>
            <Paragraph 
              className="text-xs text-gray-600 mb-0" 
              ellipsis={{ rows: 2, tooltip: server.description }}
            >
              {server.description}
            </Paragraph>
          </div>
        )}

        {/* 标签和主机组 */}
        <div className="space-y-2">
          {/* 主机组信息 */}
          {(server as any).groupName && (
            <div className="flex items-center space-x-1">
              <TeamOutlined className="text-gray-400" />
              <Tag color={(server as any).groupColor || '#1890ff'} className="text-xs">
                {(server as any).groupName}
              </Tag>
            </div>
          )}
          
          {/* 标签 */}
          <div className="flex flex-wrap gap-1">
            {server.tags.map(tag => (
              <Tag key={tag} color="blue">
                {tag}
              </Tag>
            ))}
          </div>
        </div>

        {/* 更新时间 */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <ClockCircleOutlined />
            <span>更新: {formatTime(server.updatedAt)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>创建: {formatTime(server.createdAt)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default ServerCard 