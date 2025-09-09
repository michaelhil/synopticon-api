/**
 * @fileoverview Alert Management System
 * 
 * Handles performance threshold monitoring, alert generation, resolution,
 * and intelligent alert aggregation with advanced notification strategies.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  AlertManager,
  Alert,
  AlertSeverity,
  MetricType,
  Metric,
  PERFORMANCE_THRESHOLDS
} from './types.js';

/**
 * Generate unique alert ID
 */
const generateAlertId = (): string => {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Create alert manager with advanced alerting capabilities
 */
export const createAlertManager = (
  alertThresholds: Partial<typeof PERFORMANCE_THRESHOLDS>,
  maxAlertHistory: number = 1000
): AlertManager => {
  
  const alerts: Alert[] = [];
  const suppressionTracker = new Map<string, number>(); // Track alert suppression

  /**
   * Check all metrics against thresholds and generate alerts
   */
  const checkThresholds = (metrics: Map<MetricType, Metric>): Alert[] => {
    const newAlerts: Alert[] = [];
    const currentTime = Date.now();

    // Response time alerts
    const responseTime = metrics.get('response-time' as MetricType);
    if (responseTime?.stats.current !== null && responseTime?.stats.current !== undefined) {
      const alerts = checkResponseTimeThresholds(responseTime, currentTime);
      newAlerts.push(...alerts);
    }

    // Memory usage alerts
    const memoryUsage = metrics.get('memory-usage' as MetricType);
    if (memoryUsage?.stats.current !== null && memoryUsage?.stats.current !== undefined) {
      const alert = checkMemoryUsageThreshold(memoryUsage, currentTime);
      if (alert) newAlerts.push(alert);
    }

    // CPU usage alerts
    const cpuUsage = metrics.get('cpu-usage' as MetricType);
    if (cpuUsage?.stats.current !== null && cpuUsage?.stats.current !== undefined) {
      const alert = checkCPUUsageThreshold(cpuUsage, currentTime);
      if (alert) newAlerts.push(alert);
    }

    // Error rate alerts
    const errorRate = metrics.get('error-rate' as MetricType);
    if (errorRate?.stats.current !== null && errorRate?.stats.current !== undefined) {
      const alert = checkErrorRateThreshold(errorRate, currentTime);
      if (alert) newAlerts.push(alert);
    }

    // Data quality alerts
    const dataQuality = metrics.get('data-quality' as MetricType);
    if (dataQuality?.stats.current !== null && dataQuality?.stats.current !== undefined) {
      const alert = checkDataQualityThreshold(dataQuality, currentTime);
      if (alert) newAlerts.push(alert);
    }

    // Trend-based alerts
    const trendAlerts = checkTrendAlerts(metrics, currentTime);
    newAlerts.push(...trendAlerts);

    // Statistical anomaly alerts
    const anomalyAlerts = checkAnomalyAlerts(metrics, currentTime);
    newAlerts.push(...anomalyAlerts);

    // Filter out suppressed alerts and add new ones
    const filteredAlerts = newAlerts.filter(alert => !isAlertSuppressed(alert));
    filteredAlerts.forEach(alert => addAlert(alert));

    return filteredAlerts;
  };

  /**
   * Add new alert to the system
   */
  const addAlert = (alertData: Omit<Alert, 'id'>): Alert => {
    const alert: Alert = {
      id: generateAlertId(),
      ...alertData
    };

    alerts.push(alert);
    
    // Maintain history size
    if (alerts.length > maxAlertHistory) {
      // Remove oldest resolved alerts first
      const resolvedAlerts = alerts
        .map((alert, index) => ({ alert, index }))
        .filter(({ alert }) => alert.resolved)
        .sort(({ alert: a }, { alert: b }) => a.timestamp - b.timestamp);

      if (resolvedAlerts.length > 0) {
        const oldestResolvedIndex = resolvedAlerts[0].index;
        alerts.splice(oldestResolvedIndex, 1);
      } else {
        // Remove oldest alert if no resolved alerts
        alerts.shift();
      }
    }

    // Update suppression tracker
    updateSuppressionTracker(alert);

    return alert;
  };

  /**
   * Resolve an alert by ID
   */
  const resolveAlert = (alertId: string): boolean => {
    const alert = alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      // Create resolved version (maintain immutability)
      const resolvedAlert: Alert = {
        ...alert,
        resolved: true,
        resolvedAt: Date.now()
      };
      
      // Replace in array
      const index = alerts.indexOf(alert);
      alerts[index] = resolvedAlert;
      
      return true;
    }
    return false;
  };

  /**
   * Get all active (unresolved) alerts
   */
  const getActiveAlerts = (): Alert[] => {
    return alerts.filter(alert => !alert.resolved);
  };

  /**
   * Get all alerts (active and resolved)
   */
  const getAllAlerts = (): Alert[] => {
    return [...alerts]; // Return copy to prevent mutation
  };

  /**
   * Clear old alerts beyond retention period
   */
  const clearOldAlerts = (retentionPeriod: number): void => {
    const cutoffTime = Date.now() - retentionPeriod;
    const filteredAlerts = alerts.filter(alert => alert.timestamp > cutoffTime);
    
    // Clear the array and refill with filtered alerts
    alerts.length = 0;
    alerts.push(...filteredAlerts);
  };

  /**
   * Get alert statistics by severity
   */
  const getAlertStats = (): Record<AlertSeverity, number> => {
    const stats: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0
    };

    alerts.forEach(alert => {
      if (!alert.resolved) {
        stats[alert.severity]++;
      }
    });

    return stats;
  };

  // Threshold checking functions

  /**
   * Check response time thresholds (tactical, operational, strategic)
   */
  const checkResponseTimeThresholds = (responseTime: Metric, currentTime: number): Alert[] => {
    const alerts: Alert[] = [];
    const current = responseTime.stats.current!;

    if (current > (alertThresholds.STRATEGIC_RESPONSE_TIME || 5000)) {
      alerts.push({
        type: 'response-time-critical',
        severity: 'critical',
        message: `Response time critically high: ${current.toFixed(0)}ms (threshold: ${alertThresholds.STRATEGIC_RESPONSE_TIME}ms)`,
        timestamp: currentTime,
        source: 'performance-monitor',
        resolved: false,
        metadata: {
          currentValue: current,
          threshold: alertThresholds.STRATEGIC_RESPONSE_TIME,
          trend: responseTime.stats.trend
        }
      });
    } else if (current > (alertThresholds.OPERATIONAL_RESPONSE_TIME || 500)) {
      alerts.push({
        type: 'response-time-warning',
        severity: 'warning',
        message: `Response time elevated: ${current.toFixed(0)}ms (threshold: ${alertThresholds.OPERATIONAL_RESPONSE_TIME}ms)`,
        timestamp: currentTime,
        source: 'performance-monitor',
        resolved: false,
        metadata: {
          currentValue: current,
          threshold: alertThresholds.OPERATIONAL_RESPONSE_TIME,
          trend: responseTime.stats.trend
        }
      });
    }

    return alerts;
  };

  /**
   * Check memory usage threshold
   */
  const checkMemoryUsageThreshold = (memoryUsage: Metric, currentTime: number): Alert | null => {
    const current = memoryUsage.stats.current!;
    const threshold = alertThresholds.MEMORY_WARNING || 0.8;

    if (current > threshold) {
      const severity: AlertSeverity = current > 0.95 ? 'critical' : 'warning';
      return {
        type: 'memory-usage-high',
        severity,
        message: `Memory usage ${severity}: ${(current * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
        timestamp: currentTime,
        source: 'performance-monitor',
        resolved: false,
        metadata: {
          currentValue: current,
          threshold,
          trend: memoryUsage.stats.trend,
          percentUsed: current * 100
        }
      };
    }

    return null;
  };

  /**
   * Check CPU usage threshold
   */
  const checkCPUUsageThreshold = (cpuUsage: Metric, currentTime: number): Alert | null => {
    const current = cpuUsage.stats.current!;
    const threshold = alertThresholds.CPU_WARNING || 0.7;

    if (current > threshold) {
      const severity: AlertSeverity = current > 0.9 ? 'critical' : 'warning';
      return {
        type: 'cpu-usage-high',
        severity,
        message: `CPU usage ${severity}: ${(current * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
        timestamp: currentTime,
        source: 'performance-monitor',
        resolved: false,
        metadata: {
          currentValue: current,
          threshold,
          trend: cpuUsage.stats.trend,
          percentUsed: current * 100
        }
      };
    }

    return null;
  };

  /**
   * Check error rate threshold
   */
  const checkErrorRateThreshold = (errorRate: Metric, currentTime: number): Alert | null => {
    const current = errorRate.stats.current!;
    const threshold = alertThresholds.ERROR_RATE_WARNING || 0.05;

    if (current > threshold) {
      const severity: AlertSeverity = current > 0.2 ? 'critical' : 'warning';
      return {
        type: 'error-rate-high',
        severity,
        message: `Error rate ${severity}: ${(current * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
        timestamp: currentTime,
        source: 'performance-monitor',
        resolved: false,
        metadata: {
          currentValue: current,
          threshold,
          trend: errorRate.stats.trend,
          percentErrors: current * 100
        }
      };
    }

    return null;
  };

  /**
   * Check data quality threshold
   */
  const checkDataQualityThreshold = (dataQuality: Metric, currentTime: number): Alert | null => {
    const current = dataQuality.stats.current!;
    const threshold = alertThresholds.DATA_QUALITY_WARNING || 0.7;

    if (current < threshold) {
      const severity: AlertSeverity = current < 0.5 ? 'critical' : 'warning';
      return {
        type: 'data-quality-low',
        severity,
        message: `Data quality ${severity}: ${(current * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
        timestamp: currentTime,
        source: 'performance-monitor',
        resolved: false,
        metadata: {
          currentValue: current,
          threshold,
          trend: dataQuality.stats.trend,
          qualityPercent: current * 100
        }
      };
    }

    return null;
  };

  /**
   * Check for concerning trends in metrics
   */
  const checkTrendAlerts = (metrics: Map<MetricType, Metric>, currentTime: number): Alert[] => {
    const trendAlerts: Alert[] = [];

    metrics.forEach((metric, type) => {
      if (metric.stats.sampleCount < 5) return; // Need enough samples for trend analysis

      const trend = metric.stats.trend;
      const trendThreshold = 0.1; // Configurable trend sensitivity

      // Negative trends for metrics that should increase (accuracy, data quality)
      const shouldIncrease = ['fusion-accuracy', 'prediction-accuracy', 'data-quality'].includes(type);
      if (shouldIncrease && trend < -trendThreshold) {
        trendAlerts.push({
          type: `${type}-declining-trend`,
          severity: 'warning',
          message: `${formatMetricName(type)} showing declining trend: ${(trend * 100).toFixed(1)}% change`,
          timestamp: currentTime,
          source: 'performance-monitor',
          resolved: false,
          metadata: {
            metricType: type,
            trend,
            currentValue: metric.stats.current
          }
        });
      }

      // Positive trends for metrics that should decrease (response time, error rate, memory usage)
      const shouldDecrease = ['response-time', 'error-rate', 'memory-usage', 'cpu-usage'].includes(type);
      if (shouldDecrease && trend > trendThreshold) {
        trendAlerts.push({
          type: `${type}-increasing-trend`,
          severity: 'warning',
          message: `${formatMetricName(type)} showing concerning upward trend: ${(trend * 100).toFixed(1)}% change`,
          timestamp: currentTime,
          source: 'performance-monitor',
          resolved: false,
          metadata: {
            metricType: type,
            trend,
            currentValue: metric.stats.current
          }
        });
      }
    });

    return trendAlerts;
  };

  /**
   * Check for statistical anomalies in metrics
   */
  const checkAnomalyAlerts = (metrics: Map<MetricType, Metric>, currentTime: number): Alert[] => {
    const anomalyAlerts: Alert[] = [];

    metrics.forEach((metric, type) => {
      if (metric.stats.sampleCount < 10 || metric.stats.current === null) return;

      const current = metric.stats.current;
      const average = metric.stats.average;
      const stdDev = metric.stats.standardDeviation;

      // Z-score calculation
      if (stdDev > 0) {
        const zScore = Math.abs(current - average) / stdDev;
        
        // Alert on significant deviations (2+ standard deviations)
        if (zScore > 2) {
          const severity: AlertSeverity = zScore > 3 ? 'critical' : 'warning';
          anomalyAlerts.push({
            type: `${type}-anomaly`,
            severity,
            message: `${formatMetricName(type)} anomaly detected: current value ${current.toFixed(2)} is ${zScore.toFixed(1)} standard deviations from average`,
            timestamp: currentTime,
            source: 'performance-monitor',
            resolved: false,
            metadata: {
              metricType: type,
              currentValue: current,
              average,
              standardDeviation: stdDev,
              zScore
            }
          });
        }
      }
    });

    return anomalyAlerts;
  };

  /**
   * Check if alert should be suppressed (to prevent spam)
   */
  const isAlertSuppressed = (alert: Omit<Alert, 'id'>): boolean => {
    const suppressionKey = `${alert.type}_${alert.severity}`;
    const lastTriggered = suppressionTracker.get(suppressionKey) || 0;
    const suppressionWindow = getSupprassionWindow(alert.severity);
    
    return (alert.timestamp - lastTriggered) < suppressionWindow;
  };

  /**
   * Update suppression tracker
   */
  const updateSuppressionTracker = (alert: Alert): void => {
    const suppressionKey = `${alert.type}_${alert.severity}`;
    suppressionTracker.set(suppressionKey, alert.timestamp);
  };

  /**
   * Get suppression window based on severity
   */
  const getSupprassionWindow = (severity: AlertSeverity): number => {
    const windows = {
      info: 300000,      // 5 minutes
      warning: 600000,   // 10 minutes
      critical: 180000   // 3 minutes (shorter for critical)
    };
    return windows[severity];
  };

  /**
   * Format metric name for human readability
   */
  const formatMetricName = (metricType: string): string => {
    return metricType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('\n') ');
  };

  return {
    checkThresholds,
    addAlert,
    resolveAlert,
    getActiveAlerts,
    getAllAlerts,
    clearOldAlerts,
    getAlertStats
  };
};