'use client';

import React, { useState } from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Typography,
  Space,
  Badge,
  Alert,
  Modal,
  Descriptions,
  Popconfirm,
  Empty,
  Tabs,
  Select,
  Row,
  Col
} from 'antd';

const { TabPane } = Tabs;
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { Alert as AlertType } from '../../types/monitoring';

const { Title, Text } = Typography;
const { Option } = Select;

interface AlertPanelProps {
  alerts: AlertType[];
  loading?: boolean;
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  showActions?: boolean;
  maxHeight?: number;
  title?: string;
}

// 获取严重程度配置
const getSeverityConfig = (severity: AlertType['severity']) => {
  const configs = {
    low: {
      color: '#1890ff',
      icon: <InfoCircleOutlined />,
      label: '低'
    },
    medium: {
      color: '#faad14',
      icon: <ExclamationCircleOutlined />,
      label: '中'
    },
    high: {
      color: '#ff7a45',
      icon: <WarningOutlined />,
      label: '高'
    },
    critical: {
      color: '#ff4d4f',
      icon: <ExclamationCircleOutlined />,
      label: '严重'
    }
  };
  return configs[severity];
};

// 获取状态配置
const getStatusConfig = (status: AlertType['status']) => {
  const configs = {
    firing: {
      color: '#ff4d4f',
      icon: <ExclamationCircleOutlined />,
      label: '告警中'
    },
    acknowledged: {
      color: '#faad14',
      icon: <ClockCircleOutlined />,
      label: '已确认'
    },
    resolved: {
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      label: '已解决'
    }
  };
  return configs[status];
};

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

// 计算持续时间
const getDuration = (startTime: number, endTime?: number) => {
  const end = endTime || Date.now();
  const duration = end - startTime;
  
  const minutes = Math.floor(duration / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  }
  return `${minutes}分钟`;
};

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  loading = false,
  onAcknowledge,
  onResolve,
  showActions = true,
  maxHeight = 400,
  title = "系统告警"
}) => {
  const [selectedAlert, setSelectedAlert] = useState<AlertType | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'firing' | 'acknowledged' | 'resolved'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'severity'>('time');

  // 过滤和排序告警
  const filteredAndSortedAlerts = React.useMemo(() => {
    let filtered = alerts;
    
    // 按状态过滤
    if (activeTab !== 'all') {
      filtered = alerts.filter(alert => alert.status === activeTab);
    }
    
    // 排序
    return filtered.sort((a, b) => {
      if (sortBy === 'time') {
        return b.startTime - a.startTime; // 最新的在前
      } else {
        // 按严重程度排序：critical > high > medium > low
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
    });
  }, [alerts, activeTab, sortBy]);

  // 统计数据
  const statistics = React.useMemo(() => {
    const total = alerts.length;
    const firing = alerts.filter(a => a.status === 'firing').length;
    const acknowledged = alerts.filter(a => a.status === 'acknowledged').length;
    const resolved = alerts.filter(a => a.status === 'resolved').length;
    const critical = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
    
    return { total, firing, acknowledged, resolved, critical };
  }, [alerts]);

  const handleAlertClick = (alert: AlertType) => {
    setSelectedAlert(alert);
  };

  const handleAcknowledge = (alert: AlertType) => {
    if (onAcknowledge) {
      onAcknowledge(alert.id);
    }
  };

  const handleResolve = (alert: AlertType) => {
    if (onResolve) {
      onResolve(alert.id);
    }
  };

  const renderAlertItem = (alert: AlertType) => {
    const severityConfig = getSeverityConfig(alert.severity);
    const statusConfig = getStatusConfig(alert.status);
    
    return (
      <List.Item
        key={alert.id}
        actions={showActions ? [
          <Button
            key="view"
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleAlertClick(alert)}
          >
            查看
          </Button>,
          ...(alert.status === 'firing' ? [
            <Button
              key="acknowledge"
              type="text"
              size="small"
              icon={<ClockCircleOutlined />}
              onClick={() => handleAcknowledge(alert)}
            >
              确认
            </Button>
          ] : []),
          ...(alert.status !== 'resolved' ? [
            <Popconfirm
              key="resolve"
              title="确定要解决这个告警吗？"
              onConfirm={() => handleResolve(alert)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
              >
                解决
              </Button>
            </Popconfirm>
          ] : [])
        ] : undefined}
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => handleAlertClick(alert)}
      >
        <List.Item.Meta
          avatar={
            <Badge dot color={severityConfig.color}>
              {severityConfig.icon}
            </Badge>
          }
          title={
            <Space>
              <Text strong>{alert.ruleName}</Text>
              <Tag color={severityConfig.color}>{severityConfig.label}</Tag>
              <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
            </Space>
          }
          description={
            <div>
              <Text type="secondary">{alert.description}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                开始时间: {formatTime(alert.startTime)} | 
                持续时间: {getDuration(alert.startTime, alert.endTime)}
                {alert.tags.length > 0 && (
                  <>
                    <br />
                    标签: {alert.tags.map(tag => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </>
                )}
              </Text>
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5} style={{ margin: 0 }}>
              {title}
            </Title>
            <Space>
              <Select
                value={sortBy}
                onChange={setSortBy}
                size="small"
                style={{ width: 100 }}
              >
                <Option value="time">按时间</Option>
                <Option value="severity">按严重程度</Option>
              </Select>
            </Space>
          </div>
        }
        size="small"
      >
        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{statistics.total}</div>
              <div className="text-sm text-gray-500">总告警</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{statistics.firing}</div>
              <div className="text-sm text-gray-500">活跃</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{statistics.acknowledged}</div>
              <div className="text-sm text-gray-500">已确认</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{statistics.resolved}</div>
              <div className="text-sm text-gray-500">已解决</div>
            </div>
          </Col>
        </Row>

        {/* 告警列表 */}
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as any)} size="small">
          <TabPane tab={`全部 (${statistics.total})`} key="all" />
          <TabPane tab={`告警中 (${statistics.firing})`} key="firing" />
          <TabPane tab={`已确认 (${statistics.acknowledged})`} key="acknowledged" />
          <TabPane tab={`已解决 (${statistics.resolved})`} key="resolved" />
        </Tabs>

        <div style={{ maxHeight, overflowY: 'auto' }}>
          <List
            loading={loading}
            dataSource={filteredAndSortedAlerts}
            renderItem={renderAlertItem}
            locale={{
              emptyText: <Empty description="暂无告警" />
            }}
          />
        </div>
      </Card>

      {/* 告警详情弹窗 */}
      <Modal
        title="告警详情"
        open={!!selectedAlert}
        onCancel={() => setSelectedAlert(null)}
        footer={
          selectedAlert && showActions ? [
            <Button key="close" onClick={() => setSelectedAlert(null)}>
              关闭
            </Button>,
            ...(selectedAlert.status === 'firing' ? [
              <Button
                key="acknowledge"
                type="default"
                icon={<ClockCircleOutlined />}
                onClick={() => {
                  handleAcknowledge(selectedAlert);
                  setSelectedAlert(null);
                }}
              >
                确认告警
              </Button>
            ] : []),
            ...(selectedAlert.status !== 'resolved' ? [
              <Button
                key="resolve"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => {
                  handleResolve(selectedAlert);
                  setSelectedAlert(null);
                }}
              >
                解决告警
              </Button>
            ] : [])
          ] : [
            <Button key="close" type="primary" onClick={() => setSelectedAlert(null)}>
              关闭
            </Button>
          ]
        }
        width={600}
      >
        {selectedAlert && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="告警规则">
              {selectedAlert.ruleName}
            </Descriptions.Item>
            <Descriptions.Item label="指标">
              {selectedAlert.metric}
            </Descriptions.Item>
            <Descriptions.Item label="当前值">
              <Text style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                {selectedAlert.currentValue}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="阈值">
              {selectedAlert.threshold}
            </Descriptions.Item>
            <Descriptions.Item label="严重程度">
              <Tag color={getSeverityConfig(selectedAlert.severity).color}>
                {getSeverityConfig(selectedAlert.severity).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getStatusConfig(selectedAlert.status).color}>
                {getStatusConfig(selectedAlert.status).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {formatTime(selectedAlert.startTime)}
            </Descriptions.Item>
            {selectedAlert.endTime && (
              <Descriptions.Item label="结束时间">
                {formatTime(selectedAlert.endTime)}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="持续时间">
              {getDuration(selectedAlert.startTime, selectedAlert.endTime)}
            </Descriptions.Item>
            {selectedAlert.acknowledgedBy && (
              <Descriptions.Item label="确认人">
                {selectedAlert.acknowledgedBy}
              </Descriptions.Item>
            )}
            {selectedAlert.acknowledgedAt && (
              <Descriptions.Item label="确认时间">
                {formatTime(selectedAlert.acknowledgedAt)}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="描述">
              {selectedAlert.description}
            </Descriptions.Item>
            {selectedAlert.tags.length > 0 && (
              <Descriptions.Item label="标签">
                {selectedAlert.tags.map(tag => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </>
  );
}; 