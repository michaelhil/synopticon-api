/**
 * Cognitive System Performance Monitor
 * Real-time performance monitoring, optimization, and alerting
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Performance metric types
 */
export const METRIC_TYPES = {
  RESPONSE_TIME: 'response-time',
  THROUGHPUT: 'throughput',
  MEMORY_USAGE: 'memory-usage',
  CPU_USAGE: 'cpu-usage',
  ERROR_RATE: 'error-rate',
  DATA_QUALITY: 'data-quality',
  FUSION_ACCURACY: 'fusion-accuracy',
  PREDICTION_ACCURACY: 'prediction-accuracy',
  COMPONENT_HEALTH: 'component-health'
};

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  TACTICAL_RESPONSE_TIME: 50,      // ms
  OPERATIONAL_RESPONSE_TIME: 500,  // ms
  STRATEGIC_RESPONSE_TIME: 5000,   // ms
  MEMORY_WARNING: 0.8,             // 80% of available memory
  CPU_WARNING: 0.7,                // 70% CPU usage
  ERROR_RATE_WARNING: 0.05,        // 5% error rate
  DATA_QUALITY_WARNING: 0.7        // 70% data quality
};

/**
 * Create performance monitor
 */
export const createPerformanceMonitor = (cognitiveSystem, config = {}) => {
  const {
    monitoringInterval = 1000,     // 1 second
    historySize = 10000,           // Keep 10k samples
    alertThresholds = PERFORMANCE_THRESHOLDS,
    enableAutoOptimization = true,
    enablePredictiveMonitoring = true
  } = config;
  
  const metrics = new Map();
  const alerts = [];
  const emitter = new EventEmitter();
  let monitoringTimer = null;
  let isMonitoring = false;
  
  // Component performance tracking
  const componentTimers = new Map();
  const operationCounters = new Map();
  const memorySnapshots = [];
  
  /**
   * Start performance monitoring
   */
  const startMonitoring = () => {
    if (isMonitoring) return;
    
    isMonitoring = true;
    
    // Initialize metrics
    initializeMetrics();
    
    // Start periodic monitoring
    monitoringTimer = setInterval(() => {
      collectMetrics();
    }, monitoringInterval);
    
    // Hook into system events for real-time tracking
    hookSystemEvents();
    
    logger.info('✅ Cognitive system performance monitoring started');
  };
  
  /**
   * Stop performance monitoring
   */
  const stopMonitoring = () => {
    if (!isMonitoring) return;
    
    isMonitoring = false;
    
    if (monitoringTimer) {
      clearInterval(monitoringTimer);
      monitoringTimer = null;
    }
    
    unhookSystemEvents();
    
    logger.info('⏹️ Cognitive system performance monitoring stopped');
  };
  
  /**
   * Initialize metric storage
   */
  const initializeMetrics = () => {
    Object.values(METRIC_TYPES).forEach(type => {
      if (!metrics.has(type)) {
        metrics.set(type, {
          type,
          samples: [],
          current: null,
          average: null,
          min: null,
          max: null,
          trend: 'stable'
        });
      }
    });
  };
  
  /**
   * Collect current performance metrics
   */
  const collectMetrics = async () => {
    const timestamp = Date.now();
    
    // Collect system metrics
    await collectSystemMetrics(timestamp);
    
    // Collect component-specific metrics
    await collectComponentMetrics(timestamp);
    
    // Analyze trends and detect anomalies
    analyzePerformanceTrends();
    
    // Check for threshold violations
    checkPerformanceAlerts(timestamp);
    
    // Auto-optimize if enabled
    if (enableAutoOptimization) {
      await performAutoOptimization();
    }
  };
  
  /**
   * Collect system-level metrics
   */
  const collectSystemMetrics = async (timestamp) => {
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage ? process.memoryUsage() : null;
      if (memoryUsage) {
        const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        recordMetric(METRIC_TYPES.MEMORY_USAGE, memoryPercent, timestamp);
        memorySnapshots.push({ ...memoryUsage, timestamp });
        
        // Keep memory snapshots limited
        if (memorySnapshots.length > 1000) {
          memorySnapshots.shift();
        }
      }
      
      // CPU usage (simplified - would need platform-specific implementation)
      const cpuUsage = await getCPUUsage();
      recordMetric(METRIC_TYPES.CPU_USAGE, cpuUsage, timestamp);
      
    } catch (error) {
      logger.warn('Failed to collect system metrics:', error);
    }
  };
  
  /**
   * Collect component-specific metrics
   */
  const collectComponentMetrics = async (timestamp) => {
    try {
      // Pipeline system metrics
      if (cognitiveSystem.pipelineSystem) {
        const pipelineMetrics = cognitiveSystem.pipelineSystem.getMetrics();
        
        recordMetric(METRIC_TYPES.THROUGHPUT, 
          pipelineMetrics.resource?.active || 0, timestamp);
        
        recordMetric(METRIC_TYPES.COMPONENT_HEALTH,
          calculateComponentHealth('pipeline', pipelineMetrics), timestamp);
      }
      
      // Fusion engine metrics
      if (cognitiveSystem.fusionEngine) {
        const fusionQuality = cognitiveSystem.fusionEngine.getDataQuality();
        
        recordMetric(METRIC_TYPES.DATA_QUALITY,
          fusionQuality.averageQuality || 0, timestamp);
        
        recordMetric(METRIC_TYPES.FUSION_ACCURACY,
          fusionQuality.averageConfidence || 0, timestamp);
      }
      
      // LLM integration metrics
      if (cognitiveSystem.llmIntegration) {
        const llmMetrics = cognitiveSystem.llmIntegration.getMetrics();
        
        recordMetric(METRIC_TYPES.COMPONENT_HEALTH,
          calculateComponentHealth('llm', llmMetrics), timestamp);
      }
      
      // Calculate error rate
      const errorRate = calculateRecentErrorRate();
      recordMetric(METRIC_TYPES.ERROR_RATE, errorRate, timestamp);
      
    } catch (error) {
      logger.warn('Failed to collect component metrics:', error);
    }
  };
  
  /**
   * Record a metric sample
   */
  const recordMetric = (type, value, timestamp) => {
    const metric = metrics.get(type);
    if (!metric) return;
    
    const sample = { value, timestamp };
    metric.samples.push(sample);
    
    // Maintain sample size limit
    if (metric.samples.length > historySize) {
      metric.samples.shift();
    }
    
    // Update current stats
    metric.current = value;
    updateMetricStats(metric);
  };
  
  /**
   * Update metric statistics
   */
  const updateMetricStats = (metric) => {
    const values = metric.samples.map(s => s.value).filter(v => typeof v === 'number');
    
    if (values.length === 0) return;
    
    metric.min = Math.min(...values);
    metric.max = Math.max(...values);
    metric.average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate trend (simple moving average comparison)
    if (values.length >= 10) {
      const recent = values.slice(-5);
      const previous = values.slice(-10, -5);
      
      const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const previousAvg = previous.reduce((sum, val) => sum + val, 0) / previous.length;
      
      const change = recentAvg - previousAvg;
      const changePercent = Math.abs(change / previousAvg);
      
      if (changePercent < 0.05) {
        metric.trend = 'stable';
      } else if (change > 0) {
        metric.trend = 'increasing';
      } else {
        metric.trend = 'decreasing';
      }
    }
  };
  
  /**
   * Hook into system events for real-time performance tracking
   */
  const hookSystemEvents = () => {
    // Pipeline system events
    if (cognitiveSystem.pipelineSystem) {
      cognitiveSystem.pipelineSystem.on('taskCompleted', (event) => {
        const responseTime = event.task.duration;
        const level = event.task.level;
        
        recordMetric(METRIC_TYPES.RESPONSE_TIME, responseTime, Date.now());
        
        // Check response time thresholds
        if (level === 'tactical' && responseTime > alertThresholds.TACTICAL_RESPONSE_TIME) {
          createAlert('tactical-response-time-exceeded', {
            responseTime,
            threshold: alertThresholds.TACTICAL_RESPONSE_TIME,
            level
          });
        }
      });
      
      cognitiveSystem.pipelineSystem.on('taskFailed', (event) => {
        incrementOperationCounter('pipeline-errors');
      });
    }
    
    // State manager events
    if (cognitiveSystem.stateManager) {
      cognitiveSystem.stateManager.on('stateChange', (event) => {
        incrementOperationCounter('state-updates');
      });
    }
    
    // Fusion engine events
    if (cognitiveSystem.fusionEngine) {
      cognitiveSystem.fusionEngine.on('fusionCompleted', (event) => {
        incrementOperationCounter('fusion-operations');
      });
    }
  };
  
  /**
   * Unhook system events
   */
  const unhookSystemEvents = () => {
    // Remove event listeners (implementation depends on specific event system)
    // For now, we'll just clear the maps
    componentTimers.clear();
    operationCounters.clear();
  };
  
  /**
   * Increment operation counter
   */
  const incrementOperationCounter = (operation) => {
    const current = operationCounters.get(operation) || 0;
    operationCounters.set(operation, current + 1);
  };
  
  /**
   * Calculate component health score
   */
  const calculateComponentHealth = (component, metrics) => {
    let healthScore = 1.0;
    
    switch (component) {
      case 'pipeline':
        // Consider active vs available resources
        if (metrics.resource) {
          const utilization = metrics.resource.active / (metrics.resource.active + metrics.resource.available);
          if (utilization > 0.9) healthScore *= 0.8;
        }
        break;
        
      case 'llm':
        // Consider request success rate and queue size
        if (metrics.requests) {
          if (metrics.requests.active > 5) healthScore *= 0.9;
        }
        break;
    }
    
    return healthScore;
  };
  
  /**
   * Calculate recent error rate
   */
  const calculateRecentErrorRate = () => {
    const totalOperations = Array.from(operationCounters.values()).reduce((sum, count) => sum + count, 0);
    const errorOperations = operationCounters.get('pipeline-errors') || 0;
    
    return totalOperations > 0 ? errorOperations / totalOperations : 0;
  };
  
  /**
   * Get simplified CPU usage (placeholder - would need OS-specific implementation)
   */
  const getCPUUsage = async () => {
    // Simplified CPU usage calculation
    // In a real implementation, this would use OS-specific APIs
    return Math.random() * 0.5; // Mock: 0-50% CPU usage
  };
  
  /**
   * Analyze performance trends
   */
  const analyzePerformanceTrends = () => {
    metrics.forEach((metric, type) => {
      if (metric.samples.length < 10) return;
      
      // Detect performance degradation
      if (type === METRIC_TYPES.RESPONSE_TIME && metric.trend === 'increasing') {
        const recentAvg = metric.samples.slice(-5).reduce((sum, s) => sum + s.value, 0) / 5;
        const baselineAvg = metric.average;
        
        if (recentAvg > baselineAvg * 1.5) {
          createAlert('performance-degradation', {
            metric: type,
            current: recentAvg,
            baseline: baselineAvg,
            degradationPercent: ((recentAvg - baselineAvg) / baselineAvg) * 100
          });
        }
      }
      
      // Detect memory leaks
      if (type === METRIC_TYPES.MEMORY_USAGE && metric.trend === 'increasing') {
        const growth = metric.max - metric.min;
        if (growth > 0.3) { // 30% growth
          createAlert('potential-memory-leak', {
            growth,
            current: metric.current,
            max: metric.max
          });
        }
      }
    });
  };
  
  /**
   * Check for performance alert conditions
   */
  const checkPerformanceAlerts = (timestamp) => {
    // Check response time thresholds
    const responseTimeMetric = metrics.get(METRIC_TYPES.RESPONSE_TIME);
    if (responseTimeMetric && responseTimeMetric.current > alertThresholds.STRATEGIC_RESPONSE_TIME) {
      createAlert('response-time-critical', {
        responseTime: responseTimeMetric.current,
        threshold: alertThresholds.STRATEGIC_RESPONSE_TIME
      }, timestamp);
    }
    
    // Check memory usage
    const memoryMetric = metrics.get(METRIC_TYPES.MEMORY_USAGE);
    if (memoryMetric && memoryMetric.current > alertThresholds.MEMORY_WARNING) {
      createAlert('memory-usage-high', {
        usage: memoryMetric.current,
        threshold: alertThresholds.MEMORY_WARNING
      }, timestamp);
    }
    
    // Check error rate
    const errorRateMetric = metrics.get(METRIC_TYPES.ERROR_RATE);
    if (errorRateMetric && errorRateMetric.current > alertThresholds.ERROR_RATE_WARNING) {
      createAlert('error-rate-high', {
        errorRate: errorRateMetric.current,
        threshold: alertThresholds.ERROR_RATE_WARNING
      }, timestamp);
    }
  };
  
  /**
   * Create performance alert
   */
  const createAlert = (type, data, timestamp = Date.now()) => {
    const alert = {
      id: `perf-alert-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp,
      data,
      severity: determineAlertSeverity(type, data),
      resolved: false
    };
    
    alerts.push(alert);
    
    // Keep alerts history limited
    if (alerts.length > 1000) {
      alerts.shift();
    }
    
    // Emit alert event
    emitter.emit('performanceAlert', alert);
    
    logger.warn(`Performance alert: ${type}`, data);
  };
  
  /**
   * Determine alert severity
   */
  const determineAlertSeverity = (type, data) => {
    switch (type) {
      case 'tactical-response-time-exceeded':
      case 'response-time-critical':
        return 'critical';
      
      case 'performance-degradation':
      case 'memory-usage-high':
      case 'error-rate-high':
        return 'warning';
      
      case 'potential-memory-leak':
        return 'info';
      
      default:
        return 'info';
    }
  };
  
  /**
   * Auto-optimization based on performance metrics
   */
  const performAutoOptimization = async () => {
    const memoryMetric = metrics.get(METRIC_TYPES.MEMORY_USAGE);
    const cpuMetric = metrics.get(METRIC_TYPES.CPU_USAGE);
    const responseTimeMetric = metrics.get(METRIC_TYPES.RESPONSE_TIME);
    
    // Optimize memory usage
    if (memoryMetric && memoryMetric.current > 0.8) {
      await optimizeMemoryUsage();
    }
    
    // Optimize CPU usage
    if (cpuMetric && cpuMetric.current > 0.7) {
      await optimizeCPUUsage();
    }
    
    // Optimize response times
    if (responseTimeMetric && responseTimeMetric.current > alertThresholds.OPERATIONAL_RESPONSE_TIME) {
      await optimizeResponseTimes();
    }
  };
  
  /**
   * Optimization strategies
   */
  const optimizeMemoryUsage = async () => {
    logger.info('Performing memory optimization');
    
    // Clear old metric samples
    metrics.forEach(metric => {
      if (metric.samples.length > historySize * 0.8) {
        const keepCount = Math.floor(historySize * 0.6);
        metric.samples = metric.samples.slice(-keepCount);
      }
    });
    
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  };
  
  const optimizeCPUUsage = async () => {
    logger.info('Performing CPU optimization');
    
    // Reduce pipeline concurrency temporarily
    if (cognitiveSystem.pipelineSystem && cognitiveSystem.pipelineSystem.reduceCapacity) {
      cognitiveSystem.pipelineSystem.reduceCapacity(0.8);
      
      // Restore capacity after 30 seconds
      setTimeout(() => {
        if (cognitiveSystem.pipelineSystem.restoreCapacity) {
          cognitiveSystem.pipelineSystem.restoreCapacity();
        }
      }, 30000);
    }
  };
  
  const optimizeResponseTimes = async () => {
    logger.info('Performing response time optimization');
    
    // Enable more aggressive caching
    if (cognitiveSystem.llmIntegration && cognitiveSystem.llmIntegration.enableAggressiveCaching) {
      cognitiveSystem.llmIntegration.enableAggressiveCaching();
    }
  };
  
  /**
   * Get performance summary
   */
  const getPerformanceSummary = () => {
    const summary = {
      timestamp: Date.now(),
      isMonitoring,
      overall: {
        health: calculateOverallHealth(),
        status: determineOverallStatus()
      },
      metrics: {},
      alerts: {
        active: alerts.filter(a => !a.resolved).length,
        total: alerts.length,
        recent: alerts.filter(a => Date.now() - a.timestamp < 300000) // Last 5 minutes
      },
      operations: Object.fromEntries(operationCounters)
    };
    
    // Include current metric values
    metrics.forEach((metric, type) => {
      summary.metrics[type] = {
        current: metric.current,
        average: metric.average,
        trend: metric.trend,
        samples: metric.samples.length
      };
    });
    
    return summary;
  };
  
  /**
   * Calculate overall system health
   */
  const calculateOverallHealth = () => {
    const healthFactors = [];
    
    // Response time health
    const responseTime = metrics.get(METRIC_TYPES.RESPONSE_TIME);
    if (responseTime && responseTime.current !== null) {
      const timeHealth = Math.max(0, 1 - (responseTime.current / alertThresholds.STRATEGIC_RESPONSE_TIME));
      healthFactors.push(timeHealth);
    }
    
    // Memory health
    const memory = metrics.get(METRIC_TYPES.MEMORY_USAGE);
    if (memory && memory.current !== null) {
      const memoryHealth = Math.max(0, 1 - (memory.current / alertThresholds.MEMORY_WARNING));
      healthFactors.push(memoryHealth);
    }
    
    // Error rate health
    const errorRate = metrics.get(METRIC_TYPES.ERROR_RATE);
    if (errorRate && errorRate.current !== null) {
      const errorHealth = Math.max(0, 1 - (errorRate.current / alertThresholds.ERROR_RATE_WARNING));
      healthFactors.push(errorHealth);
    }
    
    if (healthFactors.length === 0) return 0.8; // Default health
    
    return healthFactors.reduce((sum, val) => sum + val, 0) / healthFactors.length;
  };
  
  /**
   * Determine overall system status
   */
  const determineOverallStatus = () => {
    const health = calculateOverallHealth();
    const activeAlerts = alerts.filter(a => !a.resolved && Date.now() - a.timestamp < 300000);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    if (criticalAlerts.length > 0) return 'critical';
    if (health < 0.5) return 'degraded';
    if (activeAlerts.length > 0) return 'warning';
    return 'healthy';
  };
  
  return {
    startMonitoring,
    stopMonitoring,
    getPerformanceSummary,
    getMetrics: () => new Map(metrics), // Return copy
    getAlerts: () => [...alerts], // Return copy
    recordMetric,
    isMonitoring: () => isMonitoring,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
};