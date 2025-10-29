import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SystemMetrics,
  Alert,
  AlertRule,
  MetricData,
  SystemHealth,
  MonitoringConfig,
  TimeRange
} from '../types/monitoring';
import {
  generateSystemMetrics,
  generateAlerts,
  generateAlertRules,
  generateMetricHistory,
  generateSystemHealth,
  generateMonitoringConfig,
  monitoringSimulator
} from '../utils/monitoringMockData';

export interface UseMonitoringReturn {
  // 当前指标
  currentMetrics: SystemMetrics | null;
  
  // 告警相关
  alerts: Alert[];
  alertRules: AlertRule[];
  activeAlertsCount: number;
  criticalAlertsCount: number;
  
  // 系统健康
  systemHealth: SystemHealth | null;
  
  // 配置
  config: MonitoringConfig;
  
  // 加载状态
  loading: boolean;
  
  // 数据操作方法
  refreshData: () => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  updateAlertRule: (rule: AlertRule) => void;
  toggleAlertRule: (ruleId: string) => void;
  getMetricHistory: (metric: string, timeRange: TimeRange) => MetricData;
  
  // 实时数据控制
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  isRealTimeEnabled: boolean;
}

export const useMonitoring = (autoRefresh: boolean = true): UseMonitoringReturn => {
  // 状态管理
  const [currentMetrics, setCurrentMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [config] = useState<MonitoringConfig>(generateMonitoringConfig());
  const [loading, setLoading] = useState(true);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(autoRefresh);
  
  // 引用
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 刷新数据
  const refreshData = useCallback(() => {
    setLoading(true);
    
    // 模拟异步数据加载
    setTimeout(() => {
      setCurrentMetrics(generateSystemMetrics());
      setAlerts(generateAlerts());
      setSystemHealth(generateSystemHealth());
      setLoading(false);
    }, 300);
  }, []);
  
  // 初始化数据
  useEffect(() => {
    setAlertRules(generateAlertRules());
    refreshData();
  }, [refreshData]);
  
  // 实时数据更新
  const startRealTimeUpdates = useCallback(() => {
    if (isRealTimeEnabled) return;
    
    setIsRealTimeEnabled(true);
    
    // 订阅实时数据
    unsubscribeRef.current = monitoringSimulator.subscribe((metrics) => {
      setCurrentMetrics(metrics);
      
      // 同时更新系统健康状态
      setSystemHealth(generateSystemHealth());
    });
    
    // 启动模拟器
    monitoringSimulator.start(config.refreshInterval * 1000);
  }, [isRealTimeEnabled, config.refreshInterval]);
  
  const stopRealTimeUpdates = useCallback(() => {
    if (!isRealTimeEnabled) return;
    
    setIsRealTimeEnabled(false);
    
    // 取消订阅
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // 停止模拟器
    monitoringSimulator.stop();
  }, [isRealTimeEnabled]);
  
  // 自动刷新控制
  useEffect(() => {
    if (autoRefresh && !isRealTimeEnabled) {
      const scheduleRefresh = () => {
        refreshTimeoutRef.current = setTimeout(() => {
          refreshData();
          scheduleRefresh();
        }, config.refreshInterval * 1000);
      };
      
      scheduleRefresh();
      
      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
    }
  }, [autoRefresh, isRealTimeEnabled, config.refreshInterval, refreshData]);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopRealTimeUpdates();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [stopRealTimeUpdates]);
  
  // 确认告警
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? {
            ...alert,
            status: 'acknowledged' as const,
            acknowledgedBy: 'current-user',
            acknowledgedAt: Date.now()
          }
        : alert
    ));
  }, []);
  
  // 解决告警
  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? {
            ...alert,
            status: 'resolved' as const,
            endTime: Date.now()
          }
        : alert
    ));
  }, []);
  
  // 更新告警规则
  const updateAlertRule = useCallback((updatedRule: AlertRule) => {
    setAlertRules(prev => prev.map(rule => 
      rule.id === updatedRule.id ? updatedRule : rule
    ));
  }, []);
  
  // 切换告警规则启用状态
  const toggleAlertRule = useCallback((ruleId: string) => {
    setAlertRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, enabled: !rule.enabled }
        : rule
    ));
  }, []);
  
  // 获取指标历史数据
  const getMetricHistory = useCallback((metric: string, timeRange: TimeRange): MetricData => {
    return generateMetricHistory(metric, timeRange);
  }, []);
  
  // 计算统计数据
  const activeAlertsCount = alerts.filter(alert => 
    alert.status === 'firing' || alert.status === 'acknowledged'
  ).length;
  
  const criticalAlertsCount = alerts.filter(alert => 
    alert.severity === 'critical' && 
    (alert.status === 'firing' || alert.status === 'acknowledged')
  ).length;
  
  return {
    currentMetrics,
    alerts,
    alertRules,
    activeAlertsCount,
    criticalAlertsCount,
    systemHealth,
    config,
    loading,
    refreshData,
    acknowledgeAlert,
    resolveAlert,
    updateAlertRule,
    toggleAlertRule,
    getMetricHistory,
    startRealTimeUpdates,
    stopRealTimeUpdates,
    isRealTimeEnabled
  };
}; 