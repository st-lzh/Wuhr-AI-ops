// 系统监控相关类型定义
export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number; // 百分比
    cores: number;
    temperature?: number;
  };
  memory: {
    total: number; // GB
    used: number; // GB
    usage: number; // 百分比
    available: number; // GB
  };
  disk: {
    total: number; // GB
    used: number; // GB
    usage: number; // 百分比
    available: number; // GB
    io: {
      read: number; // MB/s
      write: number; // MB/s
    };
  };
  network: {
    upload: number; // MB/s
    download: number; // MB/s
    connections: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string; // cpu.usage, memory.usage, disk.usage, network.upload 等
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // 持续时间（分钟）
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  description?: string;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'sms' | 'notification';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved' | 'acknowledged';
  startTime: number;
  endTime?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  description: string;
  tags: string[];
}

export interface MonitoringDashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  refreshInterval: number; // 秒
  timeRange: TimeRange;
  isDefault: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'alert' | 'table' | 'gauge';
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: WidgetConfig;
}

export interface WidgetConfig {
  metrics: string[];
  chartType?: 'line' | 'area' | 'bar' | 'pie' | 'gauge';
  timeRange?: TimeRange;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  threshold?: {
    warning: number;
    critical: number;
  };
  unit?: string;
  decimals?: number;
}

export interface TimeRange {
  start: number;
  end: number;
  period: '5m' | '15m' | '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | 'custom';
}

export interface MetricData {
  metric: string;
  values: Array<{
    timestamp: number;
    value: number;
  }>;
  unit: string;
  description?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  components: {
    [key: string]: {
      status: 'healthy' | 'warning' | 'critical' | 'unknown';
      message?: string;
      lastCheck: number;
    };
  };
  uptime: number; // 秒
  version: string;
}

export interface MonitoringConfig {
  refreshInterval: number;
  retentionPeriod: number; // 天
  alertingEnabled: boolean;
  defaultTimeRange: TimeRange;
  thresholds: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    disk: { warning: number; critical: number };
    network: { warning: number; critical: number };
  };
} 