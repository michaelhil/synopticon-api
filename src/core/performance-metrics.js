/**
 * Performance Metrics Collection System
 * Comprehensive performance monitoring and metrics collection
 */

import { createEnhancedMemoryPool } from '../utils/enhanced-memory-pool.js';

/**
 * Create Performance Metrics Collector
 * 
 * Factory function that creates a comprehensive performance metrics collection
 * system for monitoring pipeline performance, memory usage, and system health.
 * 
 * @param {Object} config - Metrics configuration
 * @param {number} [config.bufferSize=1000] - Metrics buffer size
 * @param {number} [config.samplingInterval=100] - Sampling interval in ms
 * @param {boolean} [config.enableMemoryMonitoring=true] - Enable memory monitoring
 * @param {boolean} [config.enablePerformanceAPI=true] - Use Performance API if available
 * @returns {Object} Metrics collector with collection and reporting methods
 */
export const createPerformanceMetricsCollector = (config = {}) => {
  const state = {
    config: {
      bufferSize: config.bufferSize || 1000,
      samplingInterval: config.samplingInterval || 100,
      enableMemoryMonitoring: config.enableMemoryMonitoring !== false,
      enablePerformanceAPI: config.enablePerformanceAPI !== false,
      ...config
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
  const createMetricEntry = (type, value, timestamp = Date.now(), metadata = {}) => {
    return state.memoryPool.acquire('MetricEntry', {
      type,
      value,
      timestamp,
      metadata,
      id: `${type}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    });
  };

  // Initialize memory pool for metrics
  const initializeMetricsPool = () => {
    state.memoryPool.registerFactory('MetricEntry', () => ({
      type: null,
      value: null,
      timestamp: 0,
      metadata: {},
      id: null
    }));
  };

  // Start metrics collection
  const startCollection = () => {
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
  const stopCollection = () => {
    if (!state.isCollecting) return;
    
    state.isCollecting = false;
    
    if (state.samplingInterval) {
      clearInterval(state.samplingInterval);
      state.samplingInterval = null;
    }
    
    console.log('📊 Performance metrics collection stopped');
  };

  // Collect system-level metrics
  const collectSystemMetrics = () => {
    try {
      // Memory metrics (if available)
      if (state.config.enableMemoryMonitoring && typeof performance !== 'undefined' && performance.memory) {
        const memoryInfo = performance.memory;
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
      recordError('system_metrics_collection', error, { 
        sampling: true,
        timestamp: Date.now() 
      });
    }
  };

  // Record a performance metric
  const recordMetric = (type, value, timestamp = Date.now(), metadata = {}) => {
    if (!state.isCollecting) return;
    
    try {
      const metric = createMetricEntry(type, value, timestamp, metadata);
      
      // Add to appropriate buffer
      if (state.currentMetrics[type]) {
        state.currentMetrics[type].push(metric);
        
        // Maintain buffer size
        if (state.currentMetrics[type].length > state.config.bufferSize) {
          const removed = state.currentMetrics[type].shift();
          state.memoryPool.release(removed);
        }
      } else {
        // Add to general metrics buffer
        state.metricsBuffer.push(metric);
        
        if (state.metricsBuffer.length > state.config.bufferSize) {
          const removed = state.metricsBuffer.shift();
          state.memoryPool.release(removed);
        }
      }
      
      // Update aggregated stats
      updateAggregatedStats(type, value, metadata);
      
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  };

  // Record processing time metric
  const recordProcessingTime = (pipelineName, duration, metadata = {}) => {
    recordMetric('processing_time', duration, Date.now(), {
      pipeline: pipelineName,
      ...metadata
    });
    
    state.aggregatedStats.totalProcessed++;
  };

  // Record frame rate metric
  const recordFrameRate = (fps, metadata = {}) => {
    recordMetric('frame_rate', fps, Date.now(), metadata);
  };

  // Record error metric
  const recordError = (type, error, metadata = {}) => {
    recordMetric('error', 1, Date.now(), {
      errorType: type,
      message: error.message || error,
      stack: error.stack,
      ...metadata
    });
    
    state.aggregatedStats.totalErrors++;
  };

  // Record warning metric
  const recordWarning = (type, message, metadata = {}) => {
    recordMetric('warning', 1, Date.now(), {
      warningType: type,
      message,
      ...metadata
    });
  };

  // Update aggregated statistics
  const updateAggregatedStats = (type, value, metadata) => {
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
  const getMetricsReport = () => {
    const now = Date.now();
    const uptime = now - state.aggregatedStats.uptime;
    
    // Calculate percentiles for processing times
    const processingTimes = state.currentMetrics.processing_time?.map(m => m.value) || [];
    const sortedTimes = [...processingTimes].sort((a, b) => a - b);
    
    const calculatePercentile = (arr, percentile) => {
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
  const getCurrentMemoryUsage = () => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  };

  // Get metrics by type
  const getMetricsByType = (type, limit = 100) => {
    const metrics = state.currentMetrics[type] || [];
    return metrics.slice(-limit).map(m => ({
      value: m.value,
      timestamp: m.timestamp,
      metadata: m.metadata
    }));
  };

  // Clear all metrics
  const clearMetrics = () => {
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
  const exportMetrics = () => {
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
  const cleanup = () => {
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
    updateConfig: (updates) => {
      Object.assign(state.config, updates);
    },
    getConfig: () => ({ ...state.config })
  };
};

// Global metrics collector instance
let globalMetricsCollector = null;

/**
 * Get or create global metrics collector
 * @param {Object} config - Optional configuration for new instance
 * @returns {Object} Global metrics collector instance
 */
export const getGlobalMetricsCollector = (config = {}) => {
  if (!globalMetricsCollector) {
    globalMetricsCollector = createPerformanceMetricsCollector(config);
  }
  return globalMetricsCollector;
};

/**
 * Measure execution time of an async function
 * @param {string} name - Measurement name
 * @param {Function} fn - Function to measure
 * @param {Object} metadata - Additional metadata
 * @returns {Promise} Result of the function with timing information
 */
export const measurePerformance = async (name, fn, metadata = {}) => {
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
    
    collector.recordError(name, error, {
      duration,
      ...metadata
    });
    
    throw error;
  }
};