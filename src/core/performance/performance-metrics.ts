/**
 * Performance Metrics Collection System
 * Comprehensive performance monitoring and metrics collection
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';
import type { EnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';

export interface MetricEntry {
  type: string;
  value: number;
  timestamp: number;
  metadata: Record<string, unknown>;
  id: string;
}

export interface PerformanceMetricsConfig {
  bufferSize?: number;
  samplingInterval?: number;
  enableMemoryMonitoring?: boolean;
  enablePerformanceAPI?: boolean;
  [key: string]: unknown;
}

export interface AggregatedStats {
  totalProcessed: number;
  totalErrors: number;
  averageProcessingTime: number;
  averageFrameRate: number;
  peakMemoryUsage: number;
  uptime: number;
}

export interface ProcessingTimeStats {
  count: number;
  average: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface FrameRateStats {
  current: number;
  average: number;
}

export interface MemoryStats {
  peak: number;
  current: number;
  poolEfficiency: number;
}

export interface ErrorStats {
  total: number;
  rate: number;
  recent: MetricEntry[];
}

export interface SystemHealthStats {
  isCollecting: boolean;
  bufferUtilization: number;
  samplingRate: number;
}

export interface MetricsReport {
  timestamp: number;
  uptime: number;
  aggregated: AggregatedStats & { errorRate: number };
  processingTime: ProcessingTimeStats;
  frameRate: FrameRateStats;
  memory: MemoryStats;
  errors: ErrorStats;
  health: SystemHealthStats;
}

export interface ExportedMetrics {
  config: PerformanceMetricsConfig;
  report: MetricsReport;
  rawMetrics: {
    processingTime: Array<{ value: number; timestamp: number; metadata: Record<string, unknown> }>;
    frameRate: Array<{ value: number; timestamp: number; metadata: Record<string, unknown> }>;
    memory: Array<{ value: number; timestamp: number; metadata: Record<string, unknown> }>;
    errors: Array<{ value: number; timestamp: number; metadata: Record<string, unknown> }>;
  };
}

export interface PerformanceMetricsCollector {
  // Collection control
  startCollection: () => void;
  stopCollection: () => void;
  isCollecting: () => boolean;
  
  // Metric recording
  recordMetric: (type: string, value: number, timestamp?: number) => void;
  recordProcessingTime: (pipelineName: string, duration: number, metadata?: Record<string, unknown>) => void;
  recordFrameRate: (fps: number, metadata?: Record<string, unknown>) => void;
  recordError: (type: string, error: Error | string, metadata?: Record<string, unknown>) => void;
  recordWarning: (type: string, message: string, metadata?: Record<string, unknown>) => void;
  
  // Reporting
  getMetricsReport: () => MetricsReport;
  getMetricsByType: (type: string, limit?: number) => Array<{ value: number; timestamp: number; metadata: Record<string, unknown> }>;
  exportMetrics: () => ExportedMetrics;
  
  // Utilities
  clearMetrics: () => void;
  cleanup: () => void;
  
  // Configuration
  updateConfig: (updates: Partial<PerformanceMetricsConfig>) => void;
  getConfig: () => PerformanceMetricsConfig;
}

interface MetricsCollectorState {
  config: Required<PerformanceMetricsConfig>;
  memoryPool: EnhancedMemoryPool;
  metricsBuffer: MetricEntry[];
  currentMetrics: {
    processingTime: MetricEntry[];
    frameRate: MetricEntry[];
    memoryUsage: MetricEntry[];
    cpuUsage: MetricEntry[];
    errors: MetricEntry[];
    warnings: MetricEntry[];
    [key: string]: MetricEntry[];
  };
  aggregatedStats: AggregatedStats;
  isCollecting: boolean;
  samplingInterval: NodeJS.Timeout | null;
}

export interface PerformanceMeasureResult<T> {
  result: T;
  duration: number;
}

/**
 * Create Performance Metrics Collector
 * 
 * Factory function that creates a comprehensive performance metrics collection
 * system for monitoring pipeline performance, memory usage, and system health.
 */
export const createPerformanceMetricsCollector = (config: PerformanceMetricsConfig = {}): PerformanceMetricsCollector => {
  const state: MetricsCollectorState = {
    config: {
      bufferSize: config.bufferSize ?? 1000,
      samplingInterval: config.samplingInterval ?? 100,
      enableMemoryMonitoring: config.enableMemoryMonitoring !== false,
      enablePerformanceAPI: config.enablePerformanceAPI !== false
    },
    memoryPool: createEnhancedMemoryPool(),
    metricsBuffer: [],
    currentMetrics: {
      processingTime: [],
      frameRate: [],
      memoryUsage: [],
      cpuUsage: [],
      errors: [],
      warnings: []
    },
    aggregatedStats: {
      totalProcessed: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      averageFrameRate: 0,
      peakMemoryUsage: 0,
      uptime: Date.now()
    },
    isCollecting: false,
    samplingInterval: null
  };

  // Metric entry factory
  const createMetricEntry = (type: string, value: number, timestamp: number = Date.now(), metadata: Record<string, unknown> = {}): MetricEntry => {
    return state.memoryPool.acquire('MetricEntry', {
      type,
      value,
      timestamp,
      metadata,
      id: `${type}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    }) as MetricEntry;
  };

  // Initialize memory pool for metrics
  const initializeMetricsPool = (): void => {
    state.memoryPool.registerFactory('MetricEntry', () => ({
      type: '',
      value: 0,
      timestamp: 0,
      metadata: {},
      id: ''
    }));
  };

  // Start metrics collection
  const startCollection = (): void => {
    if (state.isCollecting) return;
    
    state.isCollecting = true;
    state.aggregatedStats.uptime = Date.now();
    
    // Start sampling interval
    if (state.config.samplingInterval > 0) {
      state.samplingInterval = setInterval(() => {
        collectSystemMetrics();
      }, state.config.samplingInterval);
    }
    
    console.log('📊 Performance metrics collection started');
  };

  // Stop metrics collection
  const stopCollection = (): void => {
    if (!state.isCollecting) return;
    
    state.isCollecting = false;
    
    if (state.samplingInterval) {
      clearInterval(state.samplingInterval);
      state.samplingInterval = null;
    }
    
    console.log('📊 Performance metrics collection stopped');
  };

  // Collect system-level metrics
  const collectSystemMetrics = (): void => {
    try {
      // Memory metrics (if available)
      if (state.config.enableMemoryMonitoring && typeof performance !== 'undefined' && (performance as any).memory) {
        const memoryInfo = (performance as any).memory;
        recordMetric('memory_used', memoryInfo.usedJSHeapSize, Date.now(), {
          total: memoryInfo.totalJSHeapSize,
          limit: memoryInfo.jsHeapSizeLimit,
          pressure: memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit
        });
        
        // Update peak memory usage
        if (memoryInfo.usedJSHeapSize > state.aggregatedStats.peakMemoryUsage) {
          state.aggregatedStats.peakMemoryUsage = memoryInfo.usedJSHeapSize;
        }
      }
      
      // Performance entries (if available)
      if (state.config.enablePerformanceAPI && typeof performance !== 'undefined' && performance.getEntries) {
        const entries = performance.getEntries();
        const recentEntries = entries.filter(entry => 
          Date.now() - entry.startTime < state.config.samplingInterval * 2
        );
        
        recentEntries.forEach(entry => {
          if (entry.entryType === 'measure') {
            recordMetric('performance_measure', entry.duration, entry.startTime, {
              name: entry.name,
              entryType: entry.entryType
            });
          }
        });
      }
      
      // Memory pool metrics
      const poolStats = state.memoryPool.getStats();
      recordMetric('memory_pool_efficiency', poolStats.efficiency, Date.now(), {
        totalAcquisitions: poolStats.totalAcquisitions,
        reuseHits: poolStats.reuseHits,
        activeObjects: poolStats.activeObjects
      });
      
    } catch (error) {
      recordError('system_metrics_collection', error as Error, { 
        sampling: true,
        timestamp: Date.now() 
      });
    }
  };

  // Record a performance metric
  const recordMetric = (type: string, value: number, timestamp: number = Date.now()): void => {
    if (!state.isCollecting) return;
    
    try {
      const metric = createMetricEntry(type, value, timestamp);
      
      // Add to appropriate buffer
      if (state.currentMetrics[type]) {
        state.currentMetrics[type].push(metric);
        
        // Maintain buffer size
        if (state.currentMetrics[type].length > state.config.bufferSize) {
          const removed = state.currentMetrics[type].shift();
          if (removed) {
            state.memoryPool.release(removed);
          }
        }
      } else {
        // Add to general metrics buffer
        state.metricsBuffer.push(metric);
        
        if (state.metricsBuffer.length > state.config.bufferSize) {
          const removed = state.metricsBuffer.shift();
          if (removed) {
            state.memoryPool.release(removed);
          }
        }
      }
      
      // Update aggregated stats
      updateAggregatedStats(type, value);
      
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  };

  // Record processing time metric
  const recordProcessingTime = (pipelineName: string, duration: number, metadata: Record<string, unknown> = {}): void => {
    recordMetric('processing_time', duration, Date.now());
    state.aggregatedStats.totalProcessed++;
  };

  // Record frame rate metric
  const recordFrameRate = (fps: number, metadata: Record<string, unknown> = {}): void => {
    recordMetric('frame_rate', fps, Date.now());
  };

  // Record error metric
  const recordError = (type: string, error: Error | string, metadata: Record<string, unknown> = {}): void => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined;
    
    recordMetric('error', 1, Date.now());
    state.aggregatedStats.totalErrors++;
  };

  // Record warning metric
  const recordWarning = (type: string, message: string, metadata: Record<string, unknown> = {}): void => {
    recordMetric('warning', 1, Date.now());
  };

  // Update aggregated statistics
  const updateAggregatedStats = (type: string, value: number): void => {
    switch (type) {
      case 'processing_time':
        // Update average processing time
        const currentCount = state.aggregatedStats.totalProcessed;
        const currentAvg = state.aggregatedStats.averageProcessingTime;
        state.aggregatedStats.averageProcessingTime = 
          (currentAvg * currentCount + value) / (currentCount + 1);
        break;
        
      case 'frame_rate':
        // Update average frame rate
        const frameRateMetrics = state.currentMetrics.frameRate || [];
        if (frameRateMetrics.length > 0) {
          const total = frameRateMetrics.reduce((sum, m) => sum + m.value, 0);
          state.aggregatedStats.averageFrameRate = total / frameRateMetrics.length;
        }
        break;
    }
  };

  // Get comprehensive metrics report
  const getMetricsReport = (): MetricsReport => {
    const now = Date.now();
    const uptime = now - state.aggregatedStats.uptime;
    
    // Calculate percentiles for processing times
    const processingTimes = state.currentMetrics.processingTime?.map(m => m.value) || [];
    const sortedTimes = [...processingTimes].sort((a, b) => a - b);
    
    const calculatePercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil(arr.length * percentile / 100) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      timestamp: now,
      uptime,
      
      // Aggregated statistics
      aggregated: {
        ...state.aggregatedStats,
        uptime,
        errorRate: state.aggregatedStats.totalProcessed > 0 
          ? state.aggregatedStats.totalErrors / state.aggregatedStats.totalProcessed 
          : 0
      },
      
      // Processing time analysis
      processingTime: {
        count: processingTimes.length,
        average: state.aggregatedStats.averageProcessingTime,
        median: calculatePercentile(sortedTimes, 50),
        p95: calculatePercentile(sortedTimes, 95),
        p99: calculatePercentile(sortedTimes, 99),
        min: sortedTimes.length > 0 ? sortedTimes[0] : 0,
        max: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0
      },
      
      // Frame rate analysis
      frameRate: {
        current: state.aggregatedStats.averageFrameRate,
        average: state.aggregatedStats.averageFrameRate
      },
      
      // Memory analysis
      memory: {
        peak: state.aggregatedStats.peakMemoryUsage,
        current: getCurrentMemoryUsage(),
        poolEfficiency: state.memoryPool.getStats().efficiency
      },
      
      // Error analysis
      errors: {
        total: state.aggregatedStats.totalErrors,
        rate: state.aggregatedStats.totalProcessed > 0 
          ? state.aggregatedStats.totalErrors / state.aggregatedStats.totalProcessed 
          : 0,
        recent: state.currentMetrics.errors?.slice(-10) || []
      },
      
      // System health
      health: {
        isCollecting: state.isCollecting,
        bufferUtilization: state.metricsBuffer.length / state.config.bufferSize,
        samplingRate: 1000 / state.config.samplingInterval
      }
    };
  };

  // Get current memory usage
  const getCurrentMemoryUsage = (): number => {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  };

  // Get metrics by type
  const getMetricsByType = (type: string, limit: number = 100): Array<{ value: number; timestamp: number; metadata: Record<string, unknown> }> => {
    const metrics = state.currentMetrics[type] || [];
    return metrics.slice(-limit).map(m => ({
      value: m.value,
      timestamp: m.timestamp,
      metadata: m.metadata
    }));
  };

  // Clear all metrics
  const clearMetrics = (): void => {
    // Release all metrics back to pool
    Object.values(state.currentMetrics).forEach(metrics => {
      metrics.forEach(metric => state.memoryPool.release(metric));
    });
    
    state.metricsBuffer.forEach(metric => state.memoryPool.release(metric));
    
    // Clear buffers
    Object.keys(state.currentMetrics).forEach(key => {
      state.currentMetrics[key] = [];
    });
    state.metricsBuffer = [];
    
    // Reset aggregated stats
    state.aggregatedStats = {
      totalProcessed: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      averageFrameRate: 0,
      peakMemoryUsage: 0,
      uptime: Date.now()
    };
    
    console.log('📊 Performance metrics cleared');
  };

  // Export metrics to JSON
  const exportMetrics = (): ExportedMetrics => {
    return {
      config: state.config,
      report: getMetricsReport(),
      rawMetrics: {
        processingTime: getMetricsByType('processing_time'),
        frameRate: getMetricsByType('frame_rate'),
        memory: getMetricsByType('memory_used'),
        errors: getMetricsByType('error')
      }
    };
  };

  // Cleanup
  const cleanup = (): void => {
    stopCollection();
    clearMetrics();
    state.memoryPool.cleanup();
  };

  // Initialize the metrics system
  initializeMetricsPool();

  return {
    // Collection control
    startCollection,
    stopCollection,
    isCollecting: () => state.isCollecting,
    
    // Metric recording
    recordMetric,
    recordProcessingTime,
    recordFrameRate,
    recordError,
    recordWarning,
    
    // Reporting
    getMetricsReport,
    getMetricsByType,
    exportMetrics,
    
    // Utilities
    clearMetrics,
    cleanup,
    
    // Configuration
    updateConfig: (updates: Partial<PerformanceMetricsConfig>) => {
      Object.assign(state.config, updates);
    },
    getConfig: () => ({ ...state.config })
  };
};

// Global metrics collector instance
let globalMetricsCollector: PerformanceMetricsCollector | null = null;

/**
 * Get or create global metrics collector
 */
export const getGlobalMetricsCollector = (config: PerformanceMetricsConfig = {}): PerformanceMetricsCollector => {
  if (!globalMetricsCollector) {
    globalMetricsCollector = createPerformanceMetricsCollector(config);
  }
  return globalMetricsCollector;
};

/**
 * Measure execution time of an async function
 */
export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, unknown> = {}
): Promise<PerformanceMeasureResult<T>> => {
  const collector = getGlobalMetricsCollector();
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    collector.recordProcessingTime(name, duration, {
      success: true,
      ...metadata
    });
    
    return { result, duration };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    collector.recordError(name, error as Error, {
      duration,
      ...metadata
    });
    
    throw error;
  }
};