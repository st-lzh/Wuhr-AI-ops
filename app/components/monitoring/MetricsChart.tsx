'use client';

import React, { useMemo } from 'react';
import { Line } from '@ant-design/charts';
import { Card, Select, Spin, Typography, Row, Col, Statistic } from 'antd';
import { MetricData, TimeRange } from '../../types/monitoring';

const { Title, Text } = Typography;
const { Option } = Select;

interface MetricsChartProps {
  title: string;
  metricData: MetricData;
  loading?: boolean;
  height?: number;
  showControls?: boolean;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange['period']) => void;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
}

const timeRangeOptions = [
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '6h', label: '6小时' },
  { value: '12h', label: '12小时' },
  { value: '24h', label: '24小时' },
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' }
];

export const MetricsChart: React.FC<MetricsChartProps> = ({
  title,
  metricData,
  loading = false,
  height = 300,
  showControls = true,
  timeRange,
  onTimeRangeChange,
  thresholds
}) => {
  // 格式化图表数据
  const chartData = useMemo(() => {
    return metricData.values.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString(),
      timestamp: point.timestamp,
      value: point.value,
      formattedTime: new Date(point.timestamp).toLocaleString()
    }));
  }, [metricData.values]);

  // 计算统计信息
  const statistics = useMemo(() => {
    if (metricData.values.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0 };
    }

    const values = metricData.values.map(v => v.value);
    const current = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      current: Math.round(current * 100) / 100,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100
    };
  }, [metricData.values]);

  // 图表配置
  const chartConfig = {
    data: chartData,
    xField: 'time',
    yField: 'value',
    height,
    smooth: true,
    point: {
      size: 3,
      shape: 'circle'
    },
    line: {
      style: {
        stroke: '#1890ff',
        lineWidth: 2
      }
    },
    area: {
      style: {
        fill: 'linear-gradient(270deg, #ffffff 0%, #1890ff 100%)',
        fillOpacity: 0.1
      }
    },
    xAxis: {
      type: 'category',
      label: {
        formatter: (text: string, item: any) => {
          // 只显示部分时间标签，避免拥挤
          const index = chartData.findIndex(d => d.time === text);
          const shouldShow = index % Math.ceil(chartData.length / 8) === 0;
          return shouldShow ? text : '';
        }
      }
    },
    yAxis: {
      label: {
        formatter: (value: number) => `${value}${metricData.unit}`
      }
    },
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: metricData.description || metricData.metric,
          value: `${datum.value}${metricData.unit}`,
          title: datum.formattedTime
        };
      }
    },
    // 添加阈值线
    annotations: [
      ...(thresholds?.warning ? [{
        type: 'line',
        start: ['min', thresholds.warning],
        end: ['max', thresholds.warning],
        style: {
          stroke: '#faad14',
          lineDash: [4, 4],
          lineWidth: 2
        },
        text: {
          content: `警告线: ${thresholds.warning}${metricData.unit}`,
          position: 'end',
          style: {
            fill: '#faad14',
            fontSize: 12
          }
        }
      }] : []),
      ...(thresholds?.critical ? [{
        type: 'line',
        start: ['min', thresholds.critical],
        end: ['max', thresholds.critical],
        style: {
          stroke: '#ff4d4f',
          lineDash: [4, 4],
          lineWidth: 2
        },
        text: {
          content: `危险线: ${thresholds.critical}${metricData.unit}`,
          position: 'end',
          style: {
            fill: '#ff4d4f',
            fontSize: 12
          }
        }
      }] : [])
    ]
  };

  // 获取当前值的状态颜色
  const getValueColor = (value: number) => {
    if (thresholds?.critical && value >= thresholds.critical) {
      return '#ff4d4f'; // 危险
    }
    if (thresholds?.warning && value >= thresholds.warning) {
      return '#faad14'; // 警告
    }
    return '#52c41a'; // 正常
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>
            {title}
          </Title>
          {showControls && timeRange && onTimeRangeChange && (
            <Select
              value={timeRange.period}
              onChange={onTimeRangeChange}
              style={{ width: 120 }}
              size="small"
            >
              {timeRangeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          )}
        </div>
      }
      size="small"
    >
      {loading ? (
        <div style={{ 
          height, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 统计信息 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic
                title="当前值"
                value={statistics.current}
                suffix={metricData.unit}
                valueStyle={{ 
                  color: getValueColor(statistics.current),
                  fontSize: '16px'
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="平均值"
                value={statistics.average}
                suffix={metricData.unit}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="最小值"
                value={statistics.min}
                suffix={metricData.unit}
                valueStyle={{ fontSize: '14px', color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="最大值"
                value={statistics.max}
                suffix={metricData.unit}
                valueStyle={{ fontSize: '14px', color: '#ff7875' }}
              />
            </Col>
          </Row>

          {/* 图表 */}
          {chartData.length > 0 ? (
            <Line {...chartConfig} />
          ) : (
            <div style={{ 
              height, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              color: '#8c8c8c'
            }}>
              <Text type="secondary">暂无数据</Text>
            </div>
          )}
        </>
      )}
    </Card>
  );
}; 