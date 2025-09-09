/**
 * @fileoverview Main Performance Monitor Factory and Orchestration
 * 
 * Orchestrates all performance monitoring components into a unified system
 * with advanced analytics, predictive capabilities, and intelligent optimization.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../shared/utils/logger.js';
import { createMetricsCollector } from './metrics-collector.js';
import { createAlertManager } from './alert-manager.js';
import { createHealthAssessor } from './health-assessor.js';
import { createPredictiveAnalyzer } from './predictive-analyzer.js';

import type {
  PerformanceMonitor,
  PerformanceMonitorConfig,
  PerformanceSummary,
  CognitiveSystem,
  MetricType,
  Metric,
  Alert,
  SystemStatus,
  EventHooks,
  PERFORMANCE_THRESHOLDS
} from './types.js';

// Re-export types and constants
export * from './types.js';
export { METRIC_TYPES, PERFORMANCE_THRESHOLDS } from './types.js';

const logger = createLogger({ level: 2, component: 'PerformanceMonitor' });

/**
 * Create comprehensive performance monitoring system
 */
export const createPerformanceMonitor = (
  cognitiveSystem: CognitiveSystem,
  config: PerformanceMonitorConfig = {}
): PerformanceMonitor => {

  // Configuration with defaults
  const {
    monitoringInterval = 1000,
    historySize = 10000,
    alertThresholds = PERFORMANCE_THRESHOLDS,
    enableAutoOptimization = true,
    enablePredictiveMonitoring = true,
    enableProactiveAlerting = false,
    maxAlertHistory = 1000,
    metricsRetentionPeriod = 24 * 60 * 60 * 1000 // 24 hours
  } = config;

  // State management
  const emitter = new EventEmitter();
  let monitoringTimer: NodeJS.Timeout | null = null;
  let isMonitoring = false;
  let lastHealthCheck = 0;
  const startTime = Date.now();

  // Component initialization
  const metricsCollector = createMetricsCollector(cognitiveSystem, historySize);
  const alertManager = createAlertManager(alertThresholds, maxAlertHistory);
  const healthAssessor = createHealthAssessor(alertThresholds);
  const predictiveAnalyzer = enablePredictiveMonitoring 
    ? createPredictiveAnalyzer(alertThresholds) 
    : null;

  // Performance tracking
  const performanceStats = {
    monitoringCycles: 0,
    collectionErrors: 0,
    alertsGenerated: 0,
    optimizationActions: 0,
    predictionsMade: 0,
    lastOptimizationTime: 0
  };

  /**
   * Start comprehensive monitoring system
   */
  const startMonitoring = (): void => {
    if (isMonitoring) {
      logger.warn('Performance monitoring already running');
      return;
    }

    isMonitoring = true;
    logger.info('🚀 Starting comprehensive performance monitoring system');

    // Initialize metrics collection
    initializeMetricsCollection();

    // Start main monitoring loop
    monitoringTimer = setInterval(async () => {
      await performMonitoringCycle();
    }, monitoringInterval);

    // Start periodic maintenance tasks
    startMaintenanceTasks();

    // Hook into system events for real-time monitoring
    hookSystemEvents();

    emitter.emit('monitoring-started', { timestamp: Date.now() });
    logger.info('✅ Performance monitoring system started successfully');
  };

  /**
   * Stop monitoring system and cleanup resources
   */
  const stopMonitoring = (): void => {
    if (!isMonitoring) return;

    isMonitoring = false;

    // Clear monitoring timer
    if (monitoringTimer) {
      clearInterval(monitoringTimer);
      monitoringTimer = null;
    }

    // Unhook system events
    unhookSystemEvents();

    emitter.emit('monitoring-stopped', { 
      timestamp: Date.now(),
      totalCycles: performanceStats.monitoringCycles,
      uptime: Date.now() - startTime
    });

    logger.info('⏹️ Performance monitoring system stopped');
  };

  /**
   * Get comprehensive performance summary
   */
  const getPerformanceSummary = (): PerformanceSummary => {
    const timestamp = Date.now();
    const metrics = metricsCollector.getAllMetrics();
    const alerts = alertManager.getAllAlerts();
    const activeAlerts = alertManager.getActiveAlerts();
    
    // Calculate overall health
    const overallHealth = healthAssessor.calculateOverallHealth(metrics);
    const systemStatus = healthAssessor.determineSystemStatus(overallHealth, activeAlerts);

    // Process metrics for summary
    const metricsSummary: PerformanceSummary['metrics'] = {};
    metrics.forEach((metric, type) => {
      metricsSummary[type] = {
        current: metric.stats.current,
        trend: metric.stats.trend,
        status: determineMetricStatus(type, metric.stats.current, activeAlerts)
      };
    });

    // Alert statistics
    const alertStats = alertManager.getAlertStats();

    // Component health (placeholder - would be populated from actual components)
    const components: PerformanceSummary['components'] = {};

    // Generate recommendations
    const recommendations = healthAssessor.generateRecommendations(metrics, activeAlerts, overallHealth);

    return {
      timestamp,
      overallHealth,
      status: systemStatus,
      metrics: metricsSummary,
      alerts: {
        active: activeAlerts.length,
        total: alerts.length,
        bySeveityCount: alertStats
      },
      components,
      recommendations: recommendations.slice(0, 5).map(r => r.title) // Top 5 recommendations
    };
  };

  /**
   * Get all metrics (returns copy)
   */
  const getMetrics = (): Map<MetricType, Metric> => {
    return metricsCollector.getAllMetrics();
  };

  /**
   * Get all alerts (returns copy)
   */
  const getAlerts = (): Alert[] => {
    return alertManager.getAllAlerts();
  };

  /**
   * Record custom metric
   */
  const recordMetric = (
    type: MetricType, 
    value: number, 
    timestamp: number = Date.now(),
    metadata?: Record<string, unknown>
  ): void => {
    try {
      metricsCollector.recordMetric(type, value, timestamp, metadata);
      
      // Emit metric recorded event
      emitter.emit('metric-recorded', {
        type,
        value,
        timestamp,
        metadata
      });
      
    } catch (error) {
      logger.error('Failed to record metric:', error);
      performanceStats.collectionErrors++;
    }
  };

  /**
   * Check if monitoring is currently active
   */
  const isMonitoringActive = (): boolean => {
    return isMonitoring;
  };

  // Core monitoring cycle implementation

  /**
   * Main monitoring cycle - collects metrics, checks alerts, analyzes trends
   */
  const performMonitoringCycle = async (): Promise<void> => {
    const cycleStart = Date.now();
    
    try {
      performanceStats.monitoringCycles++;

      // Collect all metrics
      await collectAllMetrics();

      // Check thresholds and generate alerts
      await checkAlertsAndThresholds();

      // Perform health assessment
      await performHealthAssessment();

      // Predictive analysis (if enabled)
      if (predictiveAnalyzer && enablePredictiveMonitoring) {
        await performPredictiveAnalysis();
      }

      // Auto-optimization (if enabled)
      if (enableAutoOptimization) {
        await performAutoOptimization();
      }

      // Emit cycle completion
      const cycleDuration = Date.now() - cycleStart;
      emitter.emit('monitoring-cycle-completed', {
        cycle: performanceStats.monitoringCycles,
        duration: cycleDuration,
        timestamp: Date.now()
      });

      // Performance self-monitoring
      if (cycleDuration > monitoringInterval * 0.8) {
        logger.warn(`Monitoring cycle took ${cycleDuration}ms (${monitoringInterval}ms interval)`);
      }

    } catch (error) {
      performanceStats.collectionErrors++;
      logger.error('Error in monitoring cycle:', error);
      emitter.emit('monitoring-cycle-error', { 
        error: (error as Error).message,
        cycle: performanceStats.monitoringCycles 
      });
    }
  };

  /**
   * Collect metrics from all sources
   */
  const collectAllMetrics = async (): Promise<void> => {
    const timestamp = Date.now();

    try {
      // Collect system metrics
      const systemMetrics = await metricsCollector.collectSystemMetrics(timestamp);
      
      // Collect component metrics
      const componentMetrics = await metricsCollector.collectComponentMetrics(timestamp);
      
      // Emit metrics collected event
      emitter.emit('metrics-collected', {
        systemMetrics,
        componentMetrics,
        timestamp
      });

    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      throw error;
    }
  };

  /**
   * Check alert thresholds and manage alerts
   */
  const checkAlertsAndThresholds = (): void => {
    try {
      const metrics = metricsCollector.getAllMetrics();
      const newAlerts = alertManager.checkThresholds(metrics);
      
      // Process new alerts
      newAlerts.forEach(alert => {
        performanceStats.alertsGenerated++;
        emitter.emit('alert-triggered', alert);
        
        if (alert.severity === 'critical') {
          logger.error(`Critical alert: ${alert.message}`);
        } else {
          logger.warn(`Alert: ${alert.message}`);
        }
      });

      // Check for proactive alerts (if enabled)
      if (enableProactiveAlerting && predictiveAnalyzer) {
        const predictiveAlerts = predictiveAnalyzer.detectAnomalies(metrics);
        predictiveAlerts.forEach(alert => {
          alertManager.addAlert(alert);
          emitter.emit('predictive-alert-triggered', alert);
        });
      }

    } catch (error) {
      logger.error('Failed to check alerts:', error);
    }
  };

  /**
   * Perform comprehensive health assessment
   */
  const performHealthAssessment = (): void => {
    try {
      const currentTime = Date.now();
      
      // Throttle health checks to reduce overhead
      if (currentTime - lastHealthCheck < monitoringInterval * 5) {
        return;
      }

      const metrics = metricsCollector.getAllMetrics();
      const alerts = alertManager.getActiveAlerts();
      
      const previousHealth = lastHealthCheck > 0 ? 
        healthAssessor.calculateOverallHealth(metrics) : null;
      
      const currentHealth = healthAssessor.calculateOverallHealth(metrics);
      const systemStatus = healthAssessor.determineSystemStatus(currentHealth, alerts);
      
      // Emit health status
      emitter.emit('health-assessed', {
        health: currentHealth,
        status: systemStatus,
        timestamp: currentTime,
        previousHealth
      });

      // Check for significant health changes
      if (previousHealth !== null && Math.abs(currentHealth - previousHealth) > 0.1) {
        emitter.emit('health-change-detected', {
          current: currentHealth,
          previous: previousHealth,
          change: currentHealth - previousHealth,
          timestamp: currentTime
        });
      }

      lastHealthCheck = currentTime;

    } catch (error) {
      logger.error('Failed to perform health assessment:', error);
    }
  };

  /**
   * Perform predictive analysis
   */
  const performPredictiveAnalysis = async (): Promise<void> => {
    if (!predictiveAnalyzer) return;

    try {
      const metrics = metricsCollector.getAllMetrics();
      
      // Generate predictions
      const predictions = predictiveAnalyzer.predictMetricTrends(metrics);
      performanceStats.predictionsMade += predictions.length;
      
      // Generate proactive recommendations
      const proactiveRecommendations = predictiveAnalyzer.generateProactiveRecommendations(predictions);
      
      // Emit predictions
      if (predictions.length > 0) {
        emitter.emit('predictions-generated', {
          predictions,
          recommendations: proactiveRecommendations,
          timestamp: Date.now()
        });
      }

      // Resource forecasting
      const resourceForecast = predictiveAnalyzer.forecastResourceNeeds(3600000); // 1 hour ahead
      emitter.emit('resource-forecast-updated', {
        forecast: resourceForecast,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Failed to perform predictive analysis:', error);
    }
  };

  /**
   * Perform automatic optimization actions
   */
  const performAutoOptimization = (): void => {
    try {
      const metrics = metricsCollector.getAllMetrics();
      const alerts = alertManager.getActiveAlerts();
      const health = healthAssessor.calculateOverallHealth(metrics);
      
      // Generate optimization recommendations
      const recommendations = healthAssessor.generateRecommendations(metrics, alerts, health);
      
      // Apply low-risk, high-impact optimizations automatically
      const autoOptimizations = recommendations.filter(rec => 
        rec.priority === 'high' && 
        rec.effort < 0.3 && 
        rec.impact > 0.7
      );

      if (autoOptimizations.length > 0) {
        performanceStats.optimizationActions += autoOptimizations.length;
        performanceStats.lastOptimizationTime = Date.now();
        
        emitter.emit('auto-optimizations-applied', {
          optimizations: autoOptimizations,
          timestamp: Date.now()
        });
        
        logger.info(`Applied ${autoOptimizations.length} automatic optimizations`);
      }

    } catch (error) {
      logger.error('Failed to perform auto-optimization:', error);
    }
  };

  // System integration and event handling

  /**
   * Initialize metrics collection
   */
  const initializeMetricsCollection = (): void => {
    // Initialize baseline metrics
    const timestamp = Date.now();
    
    // Record initial system state
    recordMetric('component-health' as MetricType, 0.8, timestamp);
    
    logger.info('Metrics collection initialized');
  };

  /**
   * Hook into cognitive system events
   */
  const hookSystemEvents = (): void => {
    // This would hook into the actual cognitive system events
    // For now, we'll use placeholder event handling
    
    emitter.on('system-event', (eventData) => {
      handleSystemEvent(eventData);
    });
    
    logger.info('System event hooks installed');
  };

  /**
   * Unhook system events
   */
  const unhookSystemEvents = (): void => {
    emitter.removeAllListeners('system-event');
    logger.info('System event hooks removed');
  };

  /**
   * Handle system events for real-time monitoring
   */
  const handleSystemEvent = (eventData: any): void => {
    try {
      // Process different event types
      switch (eventData.type) {
        case 'error':
          recordMetric('error-rate' as MetricType, 1, eventData.timestamp);
          break;
        case 'response':
          recordMetric('response-time' as MetricType, eventData.duration, eventData.timestamp);
          break;
        case 'operation':
          recordMetric('throughput' as MetricType, 1, eventData.timestamp);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle system event:', error);
    }
  };

  /**
   * Start maintenance tasks (cleanup, optimization)
   */
  const startMaintenanceTasks = (): void => {
    // Cleanup old metrics every hour
    setInterval(() => {
      metricsCollector.clearOldMetrics(metricsRetentionPeriod);
      alertManager.clearOldAlerts(metricsRetentionPeriod);
      logger.info('Performed metrics and alerts cleanup');
    }, 3600000); // 1 hour
    
    logger.info('Maintenance tasks started');
  };

  /**
   * Determine metric status based on current value and alerts
   */
  const determineMetricStatus = (
    metricType: MetricType, 
    currentValue: number | null, 
    alerts: Alert[]
  ): 'good' | 'warning' | 'critical' => {
    if (currentValue === null) return 'good';
    
    // Check for related alerts
    const relatedAlerts = alerts.filter(alert => 
      alert.type.includes(metricType.replace('-', '_'))
    );
    
    if (relatedAlerts.some(alert => alert.severity === 'critical')) {
      return 'critical';
    }
    
    if (relatedAlerts.some(alert => alert.severity === 'warning')) {
      return 'warning';
    }
    
    return 'good';
  };

  // Public API
  return {
    startMonitoring,
    stopMonitoring,
    getPerformanceSummary,
    getMetrics,
    getAlerts,
    recordMetric,
    isMonitoring: isMonitoringActive,
    
    // Event handling
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
};