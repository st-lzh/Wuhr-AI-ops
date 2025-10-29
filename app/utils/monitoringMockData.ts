import {
  SystemMetrics,
  Alert,
  AlertRule,
  MetricData,
  SystemHealth,
  MonitoringConfig,
  TimeRange
} from '../types/monitoring';

// 生成随机数据的工具函数
const randomBetween = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

const randomInt = (min: number, max: number): number => {
  return Math.floor(randomBetween(min, max));
};

// 生成时间序列数据
export const generateTimeSeriesData = (
  startTime: number,
  endTime: number,
  interval: number,
  baseValue: number,
  variance: number = 10
): Array<{ timestamp: number; value: number }> => {
  const data: Array<{ timestamp: number; value: number }> = [];
  let currentValue = baseValue;
  
  for (let time = startTime; time <= endTime; time += interval) {
    // 生成有趋势的随机数据
    const change = randomBetween(-variance, variance);
    currentValue = Math.max(0, Math.min(100, currentValue + change));
    
    data.push({
      timestamp: time,
      value: Math.round(currentValue * 100) / 100
    });
  }
  
  return data;
};

// 生成系统指标数据
export const generateSystemMetrics = (): SystemMetrics => {
  return {
    timestamp: Date.now(),
    cpu: {
      usage: randomBetween(15, 85),
      cores: 8,
      temperature: randomBetween(45, 75)
    },
    memory: {
      total: 16,
      used: randomBetween(6, 12),
      usage: randomBetween(40, 80),
      available: randomBetween(4, 10)
    },
    disk: {
      total: 500,
      used: randomBetween(200, 400),
      usage: randomBetween(40, 80),
      available: randomBetween(100, 300),
      io: {
        read: randomBetween(10, 100),
        write: randomBetween(5, 50)
      }
    },
    network: {
      upload: randomBetween(1, 50),
      download: randomBetween(5, 100),
      connections: randomInt(50, 500)
    },
    processes: {
      total: randomInt(200, 400),
      running: randomInt(20, 50),
      sleeping: randomInt(150, 350)
    }
  };
};

// 生成告警规则
export const generateAlertRules = (): AlertRule[] => {
  return [
    {
      id: 'rule-1',
      name: 'CPU使用率过高',
      metric: 'cpu.usage',
      operator: 'gt',
      threshold: 80,
      duration: 5,
      severity: 'high',
      enabled: true,
      description: 'CPU使用率持续超过80%',
      actions: [
        { type: 'notification', config: { channels: ['email', 'slack'] } }
      ]
    },
    {
      id: 'rule-2',
      name: '内存使用率过高',
      metric: 'memory.usage',
      operator: 'gt',
      threshold: 85,
      duration: 3,
      severity: 'high',
      enabled: true,
      description: '内存使用率持续超过85%',
      actions: [
        { type: 'notification', config: { channels: ['email'] } }
      ]
    },
    {
      id: 'rule-3',
      name: '磁盘使用率过高',
      metric: 'disk.usage',
      operator: 'gt',
      threshold: 90,
      duration: 10,
      severity: 'critical',
      enabled: true,
      description: '磁盘使用率持续超过90%',
      actions: [
        { type: 'notification', config: { channels: ['email', 'sms'] } }
      ]
    },
    {
      id: 'rule-4',
      name: '网络上传异常',
      metric: 'network.upload',
      operator: 'gt',
      threshold: 40,
      duration: 2,
      severity: 'medium',
      enabled: false,
      description: '网络上传速度异常高',
      actions: [
        { type: 'notification', config: { channels: ['email'] } }
      ]
    }
  ];
};

// 生成告警数据
export const generateAlerts = (): Alert[] => {
  const now = Date.now();
  return [
    {
      id: 'alert-1',
      ruleId: 'rule-1',
      ruleName: 'CPU使用率过高',
      metric: 'cpu.usage',
      currentValue: 87.5,
      threshold: 80,
      severity: 'high',
      status: 'firing',
      startTime: now - 15 * 60 * 1000, // 15分钟前
      description: 'CPU使用率持续高于阈值，当前值：87.5%',
      tags: ['production', 'web-server']
    },
    {
      id: 'alert-2',
      ruleId: 'rule-2',
      ruleName: '内存使用率过高',
      metric: 'memory.usage',
      currentValue: 89.2,
      threshold: 85,
      severity: 'high',
      status: 'acknowledged',
      startTime: now - 30 * 60 * 1000, // 30分钟前
      acknowledgedBy: 'admin',
      acknowledgedAt: now - 10 * 60 * 1000, // 10分钟前确认
      description: '内存使用率超过阈值，当前值：89.2%',
      tags: ['production', 'database']
    },
    {
      id: 'alert-3',
      ruleId: 'rule-3',
      ruleName: '磁盘使用率过高',
      metric: 'disk.usage',
      currentValue: 92.1,
      threshold: 90,
      severity: 'critical',
      status: 'resolved',
      startTime: now - 2 * 60 * 60 * 1000, // 2小时前
      endTime: now - 30 * 60 * 1000, // 30分钟前解决
      description: '磁盘使用率曾经超过阈值，已解决',
      tags: ['production', 'storage']
    }
  ];
};

// 生成指标历史数据
export const generateMetricHistory = (
  metric: string,
  timeRange: TimeRange
): MetricData => {
  const now = Date.now();
  const interval = 5 * 60 * 1000; // 5分钟间隔
  
  let startTime: number;
  let endTime = now;
  
  // 根据时间范围计算开始时间
  switch (timeRange.period) {
    case '5m':
      startTime = now - 5 * 60 * 1000;
      break;
    case '15m':
      startTime = now - 15 * 60 * 1000;
      break;
    case '1h':
      startTime = now - 60 * 60 * 1000;
      break;
    case '6h':
      startTime = now - 6 * 60 * 60 * 1000;
      break;
    case '12h':
      startTime = now - 12 * 60 * 60 * 1000;
      break;
    case '24h':
      startTime = now - 24 * 60 * 60 * 1000;
      break;
    case '7d':
      startTime = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      startTime = now - 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      startTime = timeRange.start;
      endTime = timeRange.end;
  }
  
  // 根据指标类型生成基础值和单位
  let baseValue: number;
  let unit: string;
  let description: string;
  
  switch (metric) {
    case 'cpu.usage':
      baseValue = 45;
      unit = '%';
      description = 'CPU使用率';
      break;
    case 'memory.usage':
      baseValue = 65;
      unit = '%';
      description = '内存使用率';
      break;
    case 'disk.usage':
      baseValue = 70;
      unit = '%';
      description = '磁盘使用率';
      break;
    case 'network.upload':
      baseValue = 15;
      unit = 'MB/s';
      description = '网络上传速度';
      break;
    case 'network.download':
      baseValue = 35;
      unit = 'MB/s';
      description = '网络下载速度';
      break;
    default:
      baseValue = 50;
      unit = '';
      description = metric;
  }
  
  return {
    metric,
    values: generateTimeSeriesData(startTime, endTime, interval, baseValue),
    unit,
    description
  };
};

// 生成系统健康状态
export const generateSystemHealth = (): SystemHealth => {
  const components = {
    'api-server': {
      status: 'healthy' as const,
      message: 'API服务器运行正常',
      lastCheck: Date.now() - 30000
    },
    'database': {
      status: 'warning' as const,
      message: '连接池使用率较高',
      lastCheck: Date.now() - 60000
    },
    'cache': {
      status: 'healthy' as const,
      message: 'Redis缓存正常',
      lastCheck: Date.now() - 45000
    },
    'storage': {
      status: 'critical' as const,
      message: '磁盘空间不足',
      lastCheck: Date.now() - 120000
    },
    'monitoring': {
      status: 'healthy' as const,
      message: '监控系统正常',
      lastCheck: Date.now() - 15000
    }
  };
  
  // 计算整体健康状态
  const statuses = Object.values(components).map(c => c.status);
  let overall: SystemHealth['overall'];
  
  if (statuses.includes('critical')) {
    overall = 'critical';
  } else if (statuses.includes('warning')) {
    overall = 'warning';
  } else if (statuses.every(s => s === 'healthy')) {
    overall = 'healthy';
  } else {
    overall = 'unknown';
  }
  
  return {
    overall,
    components,
    uptime: 7 * 24 * 60 * 60, // 7天运行时间
    version: '1.0.0'
  };
};

// 生成监控配置
export const generateMonitoringConfig = (): MonitoringConfig => {
  return {
    refreshInterval: 30, // 30秒
    retentionPeriod: 30, // 30天
    alertingEnabled: true,
    defaultTimeRange: {
      start: Date.now() - 24 * 60 * 60 * 1000, // 24小时前
      end: Date.now(),
      period: '24h'
    },
    thresholds: {
      cpu: { warning: 70, critical: 85 },
      memory: { warning: 80, critical: 90 },
      disk: { warning: 85, critical: 95 },
      network: { warning: 80, critical: 95 }
    }
  };
};

// 实时数据模拟器
export class MonitoringDataSimulator {
  private intervalId: NodeJS.Timeout | null = null;
  private callbacks: Array<(data: SystemMetrics) => void> = [];
  
  start(interval: number = 5000) {
    if (this.intervalId) {
      this.stop();
    }
    
    this.intervalId = setInterval(() => {
      const metrics = generateSystemMetrics();
      this.callbacks.forEach(callback => callback(metrics));
    }, interval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  subscribe(callback: (data: SystemMetrics) => void) {
    this.callbacks.push(callback);
    
    // 返回取消订阅函数
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }
}

// 导出单例实例
export const monitoringSimulator = new MonitoringDataSimulator(); 