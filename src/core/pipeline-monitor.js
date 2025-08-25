/**
 * Pipeline Performance Monitoring System
 * Provides real-time monitoring, metrics collection, and performance analysis
 * Integrates with all pipelines to provide unified monitoring dashboard
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../shared/utils/error-handler.js';

// Performance metric types
export const MetricTypes = {
  LATENCY: 'latency',
  THROUGHPUT: 'throughput',
  ERROR_RATE: 'error_rate',
  MEMORY_USAGE: 'memory_usage',
  CPU_USAGE: 'cpu_usage',
  INITIALIZATION_TIME: 'initialization_time',
  CLEANUP_TIME: 'cleanup_time',
  FRAME_PROCESSING_TIME: 'frame_processing_time'
};

// Performance threshold levels
export const PerformanceThresholds = {
  LATENCY: {
    EXCELLENT: 16,    // 60+ FPS
    GOOD: 33,         // 30+ FPS
    ACCEPTABLE: 50,   // 20+ FPS
    POOR: 100         // 10+ FPS
  },
  THROUGHPUT: {
    EXCELLENT: 60,    // 60+ FPS
    GOOD: 30,         // 30+ FPS
    ACCEPTABLE: 15,   // 15+ FPS
    POOR: 5           // 5+ FPS
  },
  ERROR_RATE: {
    EXCELLENT: 0.001, // 0.1%
    GOOD: 0.01,       // 1%
    ACCEPTABLE: 0.05, // 5%
    POOR: 0.1         // 10%
  },
  MEMORY_USAGE: {
    EXCELLENT: 50 * 1024 * 1024,   // 50MB
    GOOD: 100 * 1024 * 1024,       // 100MB
    ACCEPTABLE: 200 * 1024 * 1024, // 200MB
    POOR: 500 * 1024 * 1024        // 500MB
  }
};

/**
 * Creates a performance monitoring system for pipelines
 * @param {Object} config - Monitoring configuration
 * @returns {Object} - Performance monitor instance
 */
export const createPipelineMonitor = (config = {}) => {
  const monitorConfig = {
    enableMetrics: config.enableMetrics !== false,
    enableAlerting: config.enableAlerting !== false,
    metricsBufferSize: config.metricsBufferSize || 1000,
    aggregationWindow: config.aggregationWindow || 5000, // 5 seconds
    alertThresholds: { ...PerformanceThresholds, ...config.alertThresholds },
    enableMemoryProfiling: config.enableMemoryProfiling !== false,
    enablePerformanceProfiling: config.enablePerformanceProfiling !== false,
    ...config
  };

  const state = {
    pipelines: new Map(),
    globalMetrics: {
      totalProcessed: 0,
      totalErrors: 0,
      totalInitializations: 0,
      totalCleanups: 0,
      startTime: Date.now()
    },
    metricsHistory: [],
    alerts: [],
    performanceProfile: null,
    memoryBaseline: null
  };

  /**
   * Registers a pipeline for monitoring
   * @param {string} pipelineId - Unique pipeline identifier
   * @param {string} pipelineName - Human-readable pipeline name
   * @param {Object} pipelineInstance - Pipeline instance
   */
  const registerPipeline = (pipelineId, pipelineName, pipelineInstance) => {
    if (!monitorConfig.enableMetrics) return;

    const pipelineMetrics = {
      id: pipelineId,
      name: pipelineName,
      instance: pipelineInstance,
      registeredAt: Date.now(),
      metrics: {
        processed: 0,
        errors: 0,
        totalProcessingTime: 0,
        averageLatency: 0,
        currentFps: 0,
        lastProcessTime: 0,
        initializationTime: 0,
        cleanupTime: 0,
        memoryUsage: 0,
        errorRate: 0,
        status: 'registered'
      },
      recentMetrics: [],
      performanceHistory: [],
      hooks: {
        beforeProcess: null,
        afterProcess: null,
        onError: null,
        onInitialize: null,
        onCleanup: null
      }
    };

    state.pipelines.set(pipelineId, pipelineMetrics);

    handleError(
      `Pipeline ${pipelineName} registered for monitoring`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { pipelineId, pipelineName }
    );
  };

  /**
   * Wraps a pipeline method with performance monitoring
   * @param {string} pipelineId - Pipeline identifier
   * @param {string} methodName - Method name to wrap
   * @param {Function} originalMethod - Original method
   * @returns {Function} - Wrapped method with monitoring
   */
  const wrapPipelineMethod = (pipelineId, methodName, originalMethod) => {
    if (!monitorConfig.enableMetrics) return originalMethod;

    return async function(...args) {
      const pipeline = state.pipelines.get(pipelineId);
      if (!pipeline) return originalMethod.apply(this, args);

      const startTime = performance.now();
      let error = null;
      let result = null;

      try {
        // Execute before hooks
        if (pipeline.hooks[`before${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`]) {
          pipeline.hooks[`before${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`]();
        }

        result = await originalMethod.apply(this, args);

        // Record successful execution
        recordMetric(pipelineId, methodName, performance.now() - startTime, true);

      } catch (err) {
        error = err;
        recordMetric(pipelineId, methodName, performance.now() - startTime, false);
        
        // Execute error hook
        if (pipeline.hooks.onError) {
          pipeline.hooks.onError(err, methodName);
        }

        throw err;
      } finally {
        // Execute after hooks
        if (pipeline.hooks[`after${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`]) {
          pipeline.hooks[`after${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`](result, error);
        }
      }

      return result;
    };
  };

  /**
   * Records a performance metric for a pipeline
   * @param {string} pipelineId - Pipeline identifier
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   */
  const recordMetric = (pipelineId, operation, duration, success = true) => {
    if (!monitorConfig.enableMetrics) return;

    const pipeline = state.pipelines.get(pipelineId);
    if (!pipeline) return;

    const timestamp = Date.now();
    
    // Update pipeline metrics
    if (operation === 'process') {
      pipeline.metrics.processed++;
      pipeline.metrics.totalProcessingTime += duration;
      pipeline.metrics.averageLatency = pipeline.metrics.totalProcessingTime / pipeline.metrics.processed;
      pipeline.metrics.lastProcessTime = timestamp;

      // Calculate current FPS (based on last 10 frames)
      pipeline.recentMetrics.push({ timestamp, duration, success });
      if (pipeline.recentMetrics.length > 10) {
        pipeline.recentMetrics.shift();
      }

      if (pipeline.recentMetrics.length >= 2) {
        const timeDiff = pipeline.recentMetrics[pipeline.recentMetrics.length - 1].timestamp - 
                        pipeline.recentMetrics[0].timestamp;
        pipeline.metrics.currentFps = Math.round((pipeline.recentMetrics.length - 1) / (timeDiff / 1000));
      }
    } else if (operation === 'initialize') {
      pipeline.metrics.initializationTime = duration;
      pipeline.metrics.status = 'initialized';
    } else if (operation === 'cleanup') {
      pipeline.metrics.cleanupTime = duration;
      pipeline.metrics.status = 'cleaned';
    }

    if (!success) {
      pipeline.metrics.errors++;
    }

    // Calculate error rate
    pipeline.metrics.errorRate = pipeline.metrics.errors / Math.max(1, pipeline.metrics.processed);

    // Update global metrics
    state.globalMetrics.totalProcessed++;
    if (!success) {
      state.globalMetrics.totalErrors++;
    }

    // Add to metrics history
    const metricEntry = {
      pipelineId,
      operation,
      duration,
      success,
      timestamp,
      fps: pipeline.metrics.currentFps,
      errorRate: pipeline.metrics.errorRate,
      memoryUsage: getMemoryUsage()
    };

    state.metricsHistory.push(metricEntry);

    // Maintain buffer size
    if (state.metricsHistory.length > monitorConfig.metricsBufferSize) {
      state.metricsHistory.shift();
    }

    // Check for performance alerts
    checkPerformanceAlerts(pipelineId, metricEntry);
  };

  /**
   * Checks for performance alerts and triggers notifications
   * @param {string} pipelineId - Pipeline identifier
   * @param {Object} metric - Latest metric entry
   */
  const checkPerformanceAlerts = (pipelineId, metric) => {
    if (!monitorConfig.enableAlerting) return;

    const pipeline = state.pipelines.get(pipelineId);
    if (!pipeline) return;

    const alerts = [];

    // Check latency alerts
    if (metric.duration > monitorConfig.alertThresholds.LATENCY.POOR) {
      alerts.push({
        type: 'LATENCY',
        severity: 'HIGH',
        message: `Pipeline ${pipeline.name} latency ${metric.duration.toFixed(2)}ms exceeds threshold`,
        pipelineId,
        timestamp: Date.now(),
        value: metric.duration,
        threshold: monitorConfig.alertThresholds.LATENCY.POOR
      });
    }

    // Check FPS alerts
    if (pipeline.metrics.currentFps < monitorConfig.alertThresholds.THROUGHPUT.POOR) {
      alerts.push({
        type: 'THROUGHPUT',
        severity: 'HIGH',
        message: `Pipeline ${pipeline.name} FPS ${pipeline.metrics.currentFps} below threshold`,
        pipelineId,
        timestamp: Date.now(),
        value: pipeline.metrics.currentFps,
        threshold: monitorConfig.alertThresholds.THROUGHPUT.POOR
      });
    }

    // Check error rate alerts
    if (pipeline.metrics.errorRate > monitorConfig.alertThresholds.ERROR_RATE.POOR) {
      alerts.push({
        type: 'ERROR_RATE',
        severity: 'HIGH',
        message: `Pipeline ${pipeline.name} error rate ${(pipeline.metrics.errorRate * 100).toFixed(2)}% exceeds threshold`,
        pipelineId,
        timestamp: Date.now(),
        value: pipeline.metrics.errorRate,
        threshold: monitorConfig.alertThresholds.ERROR_RATE.POOR
      });
    }

    // Add alerts to state
    state.alerts.push(...alerts);

    // Trigger alert handlers
    alerts.forEach(alert => {
      handleError(
        alert.message,
        ErrorCategory.PERFORMANCE,
        alert.severity === 'HIGH' ? ErrorSeverity.WARNING : ErrorSeverity.INFO,
        { alert, pipelineId }
      );
    });

    // Maintain alert history (keep last 100)
    if (state.alerts.length > 100) {
      state.alerts.splice(0, state.alerts.length - 100);
    }
  };

  /**
   * Gets memory usage information
   * @returns {number} - Memory usage in bytes
   */
  const getMemoryUsage = () => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    
    return 0;
  };

  /**
   * Gets comprehensive metrics for all pipelines
   * @returns {Object} - Complete metrics snapshot
   */
  const getMetrics = () => {
    if (!monitorConfig.enableMetrics) {
      return { enabled: false };
    }

    const pipelineMetrics = {};
    
    for (const [id, pipeline] of state.pipelines) {
      pipelineMetrics[id] = {
        ...pipeline.metrics,
        name: pipeline.name,
        registeredAt: pipeline.registeredAt,
        uptime: Date.now() - pipeline.registeredAt,
        recentPerformance: pipeline.recentMetrics.slice(-5),
        performanceGrade: getPerformanceGrade(pipeline.metrics)
      };
    }

    return {
      enabled: true,
      global: {
        ...state.globalMetrics,
        uptime: Date.now() - state.globalMetrics.startTime,
        totalPipelines: state.pipelines.size,
        activePipelines: Array.from(state.pipelines.values()).filter(p => p.metrics.status === 'initialized').length,
        currentMemoryUsage: getMemoryUsage(),
        overallErrorRate: state.globalMetrics.totalErrors / Math.max(1, state.globalMetrics.totalProcessed)
      },
      pipelines: pipelineMetrics,
      recentAlerts: state.alerts.slice(-10),
      metricsHistory: state.metricsHistory.slice(-50)
    };
  };

  /**
   * Gets performance grade for a pipeline
   * @param {Object} metrics - Pipeline metrics
   * @returns {string} - Performance grade (A-F)
   */
  const getPerformanceGrade = (metrics) => {
    let score = 100;

    // Latency score (40% weight)
    if (metrics.averageLatency > monitorConfig.alertThresholds.LATENCY.POOR) {
      score -= 40;
    } else if (metrics.averageLatency > monitorConfig.alertThresholds.LATENCY.ACCEPTABLE) {
      score -= 20;
    } else if (metrics.averageLatency > monitorConfig.alertThresholds.LATENCY.GOOD) {
      score -= 10;
    }

    // Error rate score (30% weight)
    if (metrics.errorRate > monitorConfig.alertThresholds.ERROR_RATE.POOR) {
      score -= 30;
    } else if (metrics.errorRate > monitorConfig.alertThresholds.ERROR_RATE.ACCEPTABLE) {
      score -= 15;
    } else if (metrics.errorRate > monitorConfig.alertThresholds.ERROR_RATE.GOOD) {
      score -= 5;
    }

    // Throughput score (30% weight)
    if (metrics.currentFps < monitorConfig.alertThresholds.THROUGHPUT.POOR) {
      score -= 30;
    } else if (metrics.currentFps < monitorConfig.alertThresholds.THROUGHPUT.ACCEPTABLE) {
      score -= 15;
    } else if (metrics.currentFps < monitorConfig.alertThresholds.THROUGHPUT.GOOD) {
      score -= 5;
    }

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  /**
   * Creates performance hooks for a pipeline
   * @param {string} pipelineId - Pipeline identifier
   * @returns {Object} - Performance hooks
   */
  const createPerformanceHooks = (pipelineId) => {
    const pipeline = state.pipelines.get(pipelineId);
    if (!pipeline) return {};

    return {
      beforeProcess: (frameData) => {
        pipeline.hooks.beforeProcess = () => {
          // Pre-processing setup
          pipeline.metrics.memoryUsage = getMemoryUsage();
        };
      },

      afterProcess: (result, error) => {
        pipeline.hooks.afterProcess = (processResult, processError) => {
          // Post-processing cleanup and analysis
          if (processError) {
            handleError(
              `Pipeline ${pipeline.name} processing error: ${processError.message}`,
              ErrorCategory.PROCESSING,
              ErrorSeverity.ERROR,
              { pipelineId, error: processError }
            );
          }
        };
      },

      onError: (error, operation) => {
        pipeline.hooks.onError = (err, op) => {
          handleError(
            `Pipeline ${pipeline.name} error in ${op}: ${err.message}`,
            ErrorCategory.PROCESSING,
            ErrorSeverity.ERROR,
            { pipelineId, operation: op, error: err }
          );
        };
      },

      onInitialize: () => {
        pipeline.hooks.onInitialize = () => {
          handleError(
            `Pipeline ${pipeline.name} initialization started`,
            ErrorCategory.INITIALIZATION,
            ErrorSeverity.INFO,
            { pipelineId }
          );
        };
      },

      onCleanup: () => {
        pipeline.hooks.onCleanup = () => {
          handleError(
            `Pipeline ${pipeline.name} cleanup started`,
            ErrorCategory.INITIALIZATION,
            ErrorSeverity.INFO,
            { pipelineId }
          );
        };
      }
    };
  };

  /**
   * Generates a performance report
   * @param {string} pipelineId - Optional pipeline ID for specific report
   * @returns {Object} - Performance report
   */
  const generateReport = (pipelineId = null) => {
    const metrics = getMetrics();
    if (!metrics.enabled) {
      return { error: 'Monitoring not enabled' };
    }

    if (pipelineId) {
      const pipeline = metrics.pipelines[pipelineId];
      if (!pipeline) {
        return { error: `Pipeline ${pipelineId} not found` };
      }

      return {
        pipelineId,
        name: pipeline.name,
        performanceGrade: pipeline.performanceGrade,
        summary: {
          processed: pipeline.processed,
          averageLatency: `${pipeline.averageLatency.toFixed(2)}ms`,
          currentFps: `${pipeline.currentFps} FPS`,
          errorRate: `${(pipeline.errorRate * 100).toFixed(2)}%`,
          uptime: `${(pipeline.uptime / 1000 / 60).toFixed(1)} minutes`
        },
        recommendations: generateRecommendations(pipeline)
      };
    }

    return {
      timestamp: Date.now(),
      global: metrics.global,
      pipelineCount: Object.keys(metrics.pipelines).length,
      averageGrade: calculateAverageGrade(metrics.pipelines),
      systemHealth: getSystemHealth(metrics),
      topIssues: getTopPerformanceIssues(metrics),
      recommendations: generateSystemRecommendations(metrics)
    };
  };

  /**
   * Generates recommendations for performance improvement
   * @param {Object} pipelineMetrics - Pipeline metrics
   * @returns {Array} - Array of recommendations
   */
  const generateRecommendations = (pipelineMetrics) => {
    const recommendations = [];

    if (pipelineMetrics.averageLatency > monitorConfig.alertThresholds.LATENCY.GOOD) {
      recommendations.push({
        type: 'LATENCY',
        priority: 'HIGH',
        message: 'Consider enabling resource pooling or reducing processing complexity',
        expectedImprovement: '20-40% latency reduction'
      });
    }

    if (pipelineMetrics.errorRate > monitorConfig.alertThresholds.ERROR_RATE.GOOD) {
      recommendations.push({
        type: 'ERROR_RATE',
        priority: 'HIGH',
        message: 'Review error handling and input validation',
        expectedImprovement: 'Reduced error rate and improved stability'
      });
    }

    if (pipelineMetrics.currentFps < monitorConfig.alertThresholds.THROUGHPUT.GOOD) {
      recommendations.push({
        type: 'THROUGHPUT',
        priority: 'MEDIUM',
        message: 'Consider optimizing processing pipeline or using lower resolution',
        expectedImprovement: '2-3x throughput improvement'
      });
    }

    return recommendations;
  };

  /**
   * Calculates average performance grade
   * @param {Object} pipelines - Pipeline metrics
   * @returns {string} - Average grade
   */
  const calculateAverageGrade = (pipelines) => {
    const grades = Object.values(pipelines).map(p => p.performanceGrade);
    const gradeValues = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const average = grades.reduce((sum, grade) => sum + gradeValues[grade], 0) / grades.length;
    
    if (average >= 3.5) return 'A';
    if (average >= 2.5) return 'B';
    if (average >= 1.5) return 'C';
    if (average >= 0.5) return 'D';
    return 'F';
  };

  /**
   * Gets system health status
   * @param {Object} metrics - System metrics
   * @returns {string} - Health status
   */
  const getSystemHealth = (metrics) => {
    const activePipelines = metrics.global.activePipelines;
    const errorRate = metrics.global.overallErrorRate;
    
    if (activePipelines === 0) return 'UNKNOWN';
    if (errorRate > 0.1) return 'CRITICAL';
    if (errorRate > 0.05) return 'WARNING';
    if (errorRate > 0.01) return 'DEGRADED';
    return 'HEALTHY';
  };

  /**
   * Gets top performance issues
   * @param {Object} metrics - System metrics
   * @returns {Array} - Top issues
   */
  const getTopPerformanceIssues = (metrics) => {
    const issues = [];
    
    Object.entries(metrics.pipelines).forEach(([id, pipeline]) => {
      if (pipeline.performanceGrade === 'F' || pipeline.performanceGrade === 'D') {
        issues.push({
          pipelineId: id,
          name: pipeline.name,
          grade: pipeline.performanceGrade,
          primaryIssue: pipeline.averageLatency > 100 ? 'HIGH_LATENCY' : 'LOW_THROUGHPUT'
        });
      }
    });

    return issues.slice(0, 5);
  };

  /**
   * Generates system-wide recommendations
   * @param {Object} metrics - System metrics
   * @returns {Array} - System recommendations
   */
  const generateSystemRecommendations = (metrics) => {
    const recommendations = [];
    
    if (metrics.global.overallErrorRate > 0.05) {
      recommendations.push({
        type: 'SYSTEM',
        priority: 'HIGH',
        message: 'High system-wide error rate detected. Review pipeline implementations.',
        action: 'Enable detailed error logging and review pipeline error handling'
      });
    }

    if (metrics.global.currentMemoryUsage > 200 * 1024 * 1024) {
      recommendations.push({
        type: 'MEMORY',
        priority: 'MEDIUM',
        message: 'High memory usage detected. Consider enabling resource pooling.',
        action: 'Enable enhanced memory pool and review object lifecycle management'
      });
    }

    return recommendations;
  };

  /**
   * Clears all monitoring data and resets metrics
   */
  const reset = () => {
    state.pipelines.clear();
    state.globalMetrics = {
      totalProcessed: 0,
      totalErrors: 0,
      totalInitializations: 0,
      totalCleanups: 0,
      startTime: Date.now()
    };
    state.metricsHistory = [];
    state.alerts = [];
  };

  return {
    // Registration and lifecycle
    registerPipeline,
    wrapPipelineMethod,
    createPerformanceHooks,
    
    // Metrics collection
    recordMetric,
    getMetrics,
    
    // Reporting and analysis
    generateReport,
    generateRecommendations,
    
    // Management
    reset,
    
    // Configuration access
    getConfig: () => ({ ...monitorConfig }),
    
    // Constants
    MetricTypes,
    PerformanceThresholds
  };
};

// Export default monitoring instance for global use
export default createPipelineMonitor;