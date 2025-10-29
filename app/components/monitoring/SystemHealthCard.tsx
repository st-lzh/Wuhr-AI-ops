'use client';

import React from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Progress,
  Tag,
  Space,
  Tooltip,
  Statistic
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  QuestionCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { SystemHealth } from '../../types/monitoring';

const { Title, Text } = Typography;

interface SystemHealthCardProps {
  systemHealth: SystemHealth;
  loading?: boolean;
}

// 获取健康状态配置
const getHealthConfig = (status: SystemHealth['overall']) => {
  const configs = {
    healthy: {
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      label: '健康',
      progress: 100
    },
    warning: {
      color: '#faad14',
      icon: <WarningOutlined />,
      label: '警告',
      progress: 75
    },
    critical: {
      color: '#ff4d4f',
      icon: <ExclamationCircleOutlined />,
      label: '严重',
      progress: 25
    },
    unknown: {
      color: '#8c8c8c',
      icon: <QuestionCircleOutlined />,
      label: '未知',
      progress: 0
    }
  };
  return configs[status];
};

// 格式化运行时间
const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}天${hours}小时${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
};

// 格式化最后检查时间
const formatLastCheck = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 1) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

export const SystemHealthCard: React.FC<SystemHealthCardProps> = ({
  systemHealth,
  loading = false
}) => {
  const overallConfig = getHealthConfig(systemHealth.overall);
  
  // 计算组件健康统计
  const componentStats = React.useMemo(() => {
    const components = Object.values(systemHealth.components);
    const total = components.length;
    const healthy = components.filter(c => c.status === 'healthy').length;
    const warning = components.filter(c => c.status === 'warning').length;
    const critical = components.filter(c => c.status === 'critical').length;
    const unknown = components.filter(c => c.status === 'unknown').length;
    
    return { total, healthy, warning, critical, unknown };
  }, [systemHealth.components]);

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: overallConfig.color }}>
            {overallConfig.icon}
          </span>
          <Title level={5} style={{ margin: 0 }}>
            系统健康状态
          </Title>
          <Tag color={overallConfig.color}>
            {overallConfig.label}
          </Tag>
        </div>
      }
      loading={loading}
      size="small"
    >
      {/* 整体健康状态 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <div className="text-center">
            <Progress
              type="circle"
              percent={overallConfig.progress}
              width={80}
              strokeColor={overallConfig.color}
              format={() => overallConfig.icon}
            />
            <div style={{ marginTop: 8 }}>
              <Text strong>整体状态</Text>
              <br />
              <Text style={{ color: overallConfig.color }}>
                {overallConfig.label}
              </Text>
            </div>
          </div>
        </Col>
        <Col span={8}>
          <Statistic
            title="系统版本"
            value={systemHealth.version}
            valueStyle={{ fontSize: '20px' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="运行时间"
            value={formatUptime(systemHealth.uptime)}
            valueStyle={{ fontSize: '16px' }}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
      </Row>

      {/* 组件统计 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-600">{componentStats.total}</div>
            <div className="text-sm text-gray-500">总组件</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center">
            <div className="text-xl font-bold text-green-500">{componentStats.healthy}</div>
            <div className="text-sm text-gray-500">健康</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center">
            <div className="text-xl font-bold text-yellow-500">{componentStats.warning}</div>
            <div className="text-sm text-gray-500">警告</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center">
            <div className="text-xl font-bold text-red-500">{componentStats.critical}</div>
            <div className="text-sm text-gray-500">严重</div>
          </div>
        </Col>
      </Row>

      {/* 组件详情 */}
      <div>
        <Title level={5} style={{ marginBottom: 12 }}>
          组件状态详情
        </Title>
        <Row gutter={[16, 16]}>
          {Object.entries(systemHealth.components).map(([name, component]) => {
            const config = getHealthConfig(component.status);
            
            return (
              <Col span={12} key={name}>
                <Card
                  size="small"
                  style={{
                    borderColor: config.color,
                    borderWidth: 2
                  }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{name}</Text>
                      <Tag color={config.color}>
                        {config.label}
                      </Tag>
                    </div>
                    
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {component.message}
                    </Text>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tooltip title={`最后检查: ${new Date(component.lastCheck).toLocaleString()}`}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {formatLastCheck(component.lastCheck)}
                        </Text>
                      </Tooltip>
                      <span style={{ color: config.color }}>
                        {config.icon}
                      </span>
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    </Card>
  );
}; 