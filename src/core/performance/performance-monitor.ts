/**
 * Performance Monitoring System
 * Tracks and analyzes pipeline performance, memory usage, and system health
 */

import type { PerformanceMetrics } from '../configuration/types.js';

export interface PerformanceAlertThresholds {
  latency: number; // ms
  memory: number; // bytes
  errorRate: number; // percentage (0-1)
}

export interface PerformanceMonitorConfig {
  maxHistorySize?: number;
  memoryCheckInterval?: number;
  latencyThreshold?: number;
  memoryThreshold?: number;
  errorRateThreshold?: number;
  alertThresholds?: Partial<PerformanceAlertThresholds>;
  [key: string]: unknown;
}

export interface PerformanceAlert {
  id: string;
  type: 'high_latency' | 'high_memory' | 'high_error_rate';
  message: string;
  timestamp: number;
  data: Record<string, unknown>;
  acknowledged: boolean;
}

export interface PipelineMetrics {
  totalOperations: number;
  successfulOperations: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  recentOperations: OperationRecord[];
  errors: ErrorRecord[];
}

export interface OperationRecord {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  metadata: Record<string, unknown>;
}

export interface ErrorRecord {
  timestamp: number;
  operation: string;
  duration: number;
  metadata: Record<string, unknown>;
}

export interface PipelineStats {
  name: string;
  totalOperations: number;
  successfulOperations: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  recentErrors: ErrorRecord[];
  lastOperation: OperationRecord | null;
}

export interface SystemStats {
  uptime: number;
  memory?: NodeJS.MemoryUsage;
}

export interface MonitoringStatus {
  isActive: boolean;
  historySize: number;
  startTime: number;
  uptime: number;
}

export interface AllStats {
  system: SystemStats;
  pipelines: Record<string, PipelineStats>;
  alerts: PerformanceAlert[];
  monitoring: MonitoringStatus;
}

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: string[];
}

export interface PerformanceMonitor {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  recordPipelineMetric: (
    pipelineName: string,
    operation: string,
    duration: number,
    success?: boolean,
    metadata?: Record<string, unknown>
  ) => void;
  createAlert: (
    type: PerformanceAlert['type'],
    message: string,
    data?: Record<string, unknown>
  ) => string;
  acknowledgeAlert: (alertId: string) => boolean;
  getPipelineStats: (pipelineName: string) => PipelineStats | null;
  getAllStats: () => AllStats;
  getHealthScore: () => HealthScore;
  isMonitoring: () => boolean;
}

interface PerformanceMonitorState {
  config: {
    maxHistorySize: number;
    memoryCheckInterval: number;
    alertThresholds: PerformanceAlertThresholds;
  } & Record<string, unknown>;
  metrics: Map<string, PipelineMetrics>;
  history: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  startTime: number;
  isMonitoring: boolean;
  intervalId: NodeJS.Timeout | null;
}

// Global performance monitor instance
let globalMonitor: PerformanceMonitor | null = null;

export const createPerformanceMonitor = (config: PerformanceMonitorConfig = {}): PerformanceMonitor => {
  const state: PerformanceMonitorState = {
    config: {
      maxHistorySize: config.maxHistorySize ?? 1000,
      memoryCheckInterval: config.memoryCheckInterval ?? 5000,
      alertThresholds: {
        latency: config.latencyThreshold ?? 100, // ms
        memory: config.memoryThreshold ?? 100 * 1024 * 1024, // 100MB
        errorRate: config.errorRateThreshold ?? 0.1 // 10%
      },
      ...config
    },
    metrics: new Map(),
    history: [],
    alerts: [],
    startTime: typeof Bun !== 'undefined' ? Bun.nanoseconds() : Date.now() * 1e6,
    isMonitoring: false,
    intervalId: null
  };

  const startMonitoring = (): void => {
    if (state.isMonitoring) return;
    
    state.isMonitoring = true;
    state.intervalId = setInterval(() => {
      collectSystemMetrics();
      checkThresholds();
      cleanupHistory();
    }, state.config.memoryCheckInterval);
    
    console.log('📊 Performance monitoring started');
  };

  const stopMonitoring = (): void => {
    if (!state.isMonitoring) return;
    
    state.isMonitoring = false;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    
    console.log('📊 Performance monitoring stopped');
  };

  const collectSystemMetrics = (): void => {
    const now = Date.now();
    let systemMetrics: Record<string, unknown> = {};
    
    // Bun-specific metrics (also works with Node.js)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      systemMetrics = {
        memoryUsage: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external
        },
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage ? process.cpuUsage() : null,
        // Bun-specific timing
        highResTime: typeof Bun !== 'undefined' ? Bun.nanoseconds() : Date.now() * 1e6
      };
    }
    
    // Browser specific metrics
    if (typeof window !== 'undefined' && window.performance) {
      systemMetrics = {
        ...systemMetrics,
        timing: window.performance.timing,
        memory: (window.performance as any).memory || null,
        navigation: window.performance.navigation || null
      };
    }
    
    const metrics: PerformanceMetrics = {
      timestamp: now,
      systemMetrics,
      activeMetrics: state.metrics.size,
      totalAlerts: state.alerts.length,
      pipelineCount: 0,
      memoryUsage: 0,
      avgLatency: 0
    };
    
    state.history.push(metrics);
  };

  const recordPipelineMetric = (
    pipelineName: string,
    operation: string,
    duration: number,
    success: boolean = true,
    metadata: Record<string, unknown> = {}
  ): void => {
    const now = Date.now();
    
    if (!state.metrics.has(pipelineName)) {
      state.metrics.set(pipelineName, {
        totalOperations: 0,
        successfulOperations: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        recentOperations: [],
        errors: []
      });
    }
    
    const pipelineMetrics = state.metrics.get(pipelineName)!;
    pipelineMetrics.totalOperations++;
    
    if (success) {
      pipelineMetrics.successfulOperations++;
      pipelineMetrics.totalDuration += duration;
      pipelineMetrics.minDuration = Math.min(pipelineMetrics.minDuration, duration);
      pipelineMetrics.maxDuration = Math.max(pipelineMetrics.maxDuration, duration);
    } else {
      pipelineMetrics.errors.push({
        timestamp: now,
        operation,
        duration,
        metadata
      });
    }
    
    // Keep recent operations for analysis
    pipelineMetrics.recentOperations.push({
      timestamp: now,
      operation,
      duration,
      success,
      metadata
    });
    
    // Limit recent operations to prevent memory growth
    if (pipelineMetrics.recentOperations.length > 100) {
      pipelineMetrics.recentOperations.shift();
    }
    
    // Check for performance issues
    if (duration > state.config.alertThresholds.latency) {
      createAlert('high_latency', `${pipelineName} operation took ${duration}ms`, {
        pipelineName,
        operation,
        duration,
        threshold: state.config.alertThresholds.latency
      });
    }
  };

  const createAlert = (
    type: PerformanceAlert['type'],
    message: string,
    data: Record<string, unknown> = {}
  ): string => {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      data,
      acknowledged: false
    };
    
    state.alerts.push(alert);
    console.warn(`⚠️ Performance Alert [${type}]: ${message}`);
    
    // Limit alerts to prevent memory growth
    if (state.alerts.length > 1000) {
      state.alerts.shift();
    }
    
    return alert.id;
  };

  const checkThresholds = (): void => {
    // Check memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > state.config.alertThresholds.memory) {
        createAlert('high_memory', `Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`, {
          heapUsed: memUsage.heapUsed,
          threshold: state.config.alertThresholds.memory
        });
      }
    }
    
    // Check error rates for each pipeline
    state.metrics.forEach((metrics, pipelineName) => {
      if (metrics.totalOperations > 10) { // Only check after significant operations
        const errorRate = (metrics.totalOperations - metrics.successfulOperations) / metrics.totalOperations;
        if (errorRate > state.config.alertThresholds.errorRate) {
          createAlert('high_error_rate', `${pipelineName} error rate: ${(errorRate * 100).toFixed(1)}%`, {
            pipelineName,
            errorRate,
            totalOperations: metrics.totalOperations,
            successfulOperations: metrics.successfulOperations
          });
        }
      }
    });
  };

  const cleanupHistory = (): void => {
    // Remove old history entries
    const cutoffTime = Date.now() - (60 * 60 * 1000); // Keep 1 hour of history
    state.history = state.history.filter(entry => entry.timestamp > cutoffTime);
    
    // Clean up old alerts
    const alertCutoffTime = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours of alerts
    state.alerts = state.alerts.filter(alert => alert.timestamp > alertCutoffTime);
  };

  const getPipelineStats = (pipelineName: string): PipelineStats | null => {
    const metrics = state.metrics.get(pipelineName);
    if (!metrics) return null;
    
    const avgDuration = metrics.successfulOperations > 0 
      ? metrics.totalDuration / metrics.successfulOperations 
      : 0;
    
    const successRate = metrics.totalOperations > 0 
      ? metrics.successfulOperations / metrics.totalOperations 
      : 0;
    
    return {
      name: pipelineName,
      totalOperations: metrics.totalOperations,
      successfulOperations: metrics.successfulOperations,
      successRate,
      avgDuration,
      minDuration: metrics.minDuration === Infinity ? 0 : metrics.minDuration,
      maxDuration: metrics.maxDuration,
      recentErrors: metrics.errors.slice(-10), // Last 10 errors
      lastOperation: metrics.recentOperations.length > 0 
        ? metrics.recentOperations[metrics.recentOperations.length - 1]
        : null
    };
  };

  const getAllStats = (): AllStats => {
    const pipelineStats: Record<string, PipelineStats> = {};
    state.metrics.forEach((_, pipelineName) => {
      const stats = getPipelineStats(pipelineName);
      if (stats) {
        pipelineStats[pipelineName] = stats;
      }
    });
    
    const now = Date.now();
    const uptime = now - (state.startTime / 1e6); // Convert nanoseconds to milliseconds
    
    const systemStats: SystemStats = { uptime };
    if (typeof process !== 'undefined' && process.memoryUsage) {
      systemStats.memory = process.memoryUsage();
    }
    
    return {
      system: systemStats,
      pipelines: pipelineStats,
      alerts: state.alerts.filter(a => !a.acknowledged).slice(-50), // Last 50 unacknowledged
      monitoring: {
        isActive: state.isMonitoring,
        historySize: state.history.length,
        startTime: state.startTime,
        uptime
      }
    };
  };

  const acknowledgeAlert = (alertId: string): boolean => {
    const alert = state.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  };

  const getHealthScore = (): HealthScore => {
    const stats = getAllStats();
    let score = 100;
    const factors: string[] = [];
    
    // Check pipeline health
    Object.values(stats.pipelines).forEach(pipeline => {
      if (pipeline.successRate < 0.95) {
        const penalty = (0.95 - pipeline.successRate) * 50;
        score -= penalty;
        factors.push(`${pipeline.name} success rate: ${(pipeline.successRate * 100).toFixed(1)}%`);
      }
      
      if (pipeline.avgDuration > 100) {
        const penalty = Math.min(20, (pipeline.avgDuration - 100) / 10);
        score -= penalty;
        factors.push(`${pipeline.name} avg latency: ${pipeline.avgDuration.toFixed(1)}ms`);
      }
    });
    
    // Check memory usage
    if (stats.system.memory && stats.system.memory.heapUsed > 200 * 1024 * 1024) {
      score -= 10;
      factors.push(`High memory usage: ${Math.round(stats.system.memory.heapUsed / 1024 / 1024)}MB`);
    }
    
    // Check alerts
    const criticalAlerts = stats.alerts.filter(a => a.type === 'high_memory' || a.type === 'high_error_rate');
    score -= criticalAlerts.length * 5;
    
    return {
      score: Math.max(0, Math.round(score)),
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      factors: factors.slice(0, 5) // Top 5 factors
    };
  };

  return {
    startMonitoring,
    stopMonitoring,
    recordPipelineMetric,
    createAlert,
    acknowledgeAlert,
    getPipelineStats,
    getAllStats,
    getHealthScore,
    isMonitoring: () => state.isMonitoring
  };
};

// Global monitor singleton
export const getGlobalMonitor = (): PerformanceMonitor => {
  if (!globalMonitor) {
    globalMonitor = createPerformanceMonitor();
    globalMonitor.startMonitoring();
  }
  return globalMonitor;
};

// Utility function to measure async operations
export const measureAsync = async <T>(
  operation: () => Promise<T>,
  pipelineName: string,
  operationName: string,
  monitor: PerformanceMonitor | null = null
): Promise<T> => {
  const perfMonitor = monitor || getGlobalMonitor();
  const startTime = Date.now();
  let success = true;
  let result: T;
  
  try {
    result = await operation();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    perfMonitor.recordPipelineMetric(pipelineName, operationName, duration, success);
  }
  
  return result;
};