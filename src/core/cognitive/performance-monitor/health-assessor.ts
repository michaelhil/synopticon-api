/**
 * @fileoverview Health Assessment System
 * 
 * Calculates overall system health, component health scores, and generates
 * actionable optimization recommendations with intelligent prioritization.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  HealthAssessor,
  MetricType,
  Metric,
  Alert,
  SystemStatus,
  ComponentMetrics,
  OptimizationRecommendation,
  PERFORMANCE_THRESHOLDS
} from './types.js';

/**
 * Health calculation weights for different metrics
 */
const HEALTH_WEIGHTS: Record<string, number> = {
  'response-time': 0.25,
  'memory-usage': 0.20,
  'cpu-usage': 0.15,
  'error-rate': 0.20,
  'data-quality': 0.15,
  'fusion-accuracy': 0.05
};

/**
 * Create health assessor with comprehensive analysis capabilities
 */
export const createHealthAssessor = (
  alertThresholds: Partial<typeof PERFORMANCE_THRESHOLDS>
): HealthAssessor => {

  /**
   * Calculate overall system health score (0-1)
   */
  const calculateOverallHealth = (metrics: Map<MetricType, Metric>): number => {
    let weightedHealth = 0;
    let totalWeight = 0;

    // Calculate weighted health from each metric
    Object.entries(HEALTH_WEIGHTS).forEach(([metricType, weight]) => {
      const metric = metrics.get(metricType as MetricType);
      if (metric?.stats.current !== null && metric?.stats.current !== undefined) {
        const healthContribution = calculateMetricHealthContribution(metricType, metric);
        weightedHealth += healthContribution * weight;
        totalWeight += weight;
      }
    });

    // Normalize if we have any metrics
    if (totalWeight === 0) return 0.8; // Default health when no metrics available

    const baseHealth = weightedHealth / totalWeight;

    // Apply trend-based adjustments
    const trendAdjustment = calculateTrendAdjustment(metrics);
    
    // Apply volatility penalty
    const volatilityPenalty = calculateVolatilityPenalty(metrics);

    // Combine factors with bounds checking
    const finalHealth = Math.max(0, Math.min(1, baseHealth + trendAdjustment - volatilityPenalty));

    return finalHealth;
  };

  /**
   * Calculate health contribution from individual metric
   */
  const calculateMetricHealthContribution = (metricType: string, metric: Metric): number => {
    const current = metric.stats.current!;

    switch (metricType) {
      case 'response-time':
        return calculateResponseTimeHealth(current);
      
      case 'memory-usage':
        return calculateMemoryHealth(current);
      
      case 'cpu-usage':
        return calculateCPUHealth(current);
      
      case 'error-rate':
        return calculateErrorRateHealth(current);
      
      case 'data-quality':
      case 'fusion-accuracy':
      case 'prediction-accuracy':
        return current; // These are already in 0-1 range representing quality/health
      
      default:
        return 0.8; // Default health for unknown metrics
    }
  };

  /**
   * Calculate response time health score
   */
  const calculateResponseTimeHealth = (responseTime: number): number => {
    const tacticalThreshold = alertThresholds.TACTICAL_RESPONSE_TIME || 50;
    const operationalThreshold = alertThresholds.OPERATIONAL_RESPONSE_TIME || 500;
    const strategicThreshold = alertThresholds.STRATEGIC_RESPONSE_TIME || 5000;

    if (responseTime <= tacticalThreshold) {
      return 1.0; // Excellent response time
    } else if (responseTime <= operationalThreshold) {
      // Linear decline from 1.0 to 0.7
      return 1.0 - (responseTime - tacticalThreshold) / (operationalThreshold - tacticalThreshold) * 0.3;
    } else if (responseTime <= strategicThreshold) {
      // Linear decline from 0.7 to 0.2
      return 0.7 - (responseTime - operationalThreshold) / (strategicThreshold - operationalThreshold) * 0.5;
    } else {
      // Very poor response time
      return Math.max(0, 0.2 - (responseTime - strategicThreshold) / strategicThreshold * 0.2);
    }
  };

  /**
   * Calculate memory usage health score
   */
  const calculateMemoryHealth = (memoryPercent: number): number => {
    const warningThreshold = alertThresholds.MEMORY_WARNING || 0.8;
    
    if (memoryPercent <= 0.6) {
      return 1.0; // Healthy memory usage
    } else if (memoryPercent <= warningThreshold) {
      // Linear decline from 1.0 to 0.4
      return 1.0 - (memoryPercent - 0.6) / (warningThreshold - 0.6) * 0.6;
    } else {
      // Critical memory usage
      return Math.max(0, 0.4 - (memoryPercent - warningThreshold) / (1.0 - warningThreshold) * 0.4);
    }
  };

  /**
   * Calculate CPU usage health score
   */
  const calculateCPUHealth = (cpuPercent: number): number => {
    const warningThreshold = alertThresholds.CPU_WARNING || 0.7;
    
    if (cpuPercent <= 0.5) {
      return 1.0; // Healthy CPU usage
    } else if (cpuPercent <= warningThreshold) {
      // Linear decline from 1.0 to 0.5
      return 1.0 - (cpuPercent - 0.5) / (warningThreshold - 0.5) * 0.5;
    } else {
      // High CPU usage
      return Math.max(0, 0.5 - (cpuPercent - warningThreshold) / (1.0 - warningThreshold) * 0.5);
    }
  };

  /**
   * Calculate error rate health score
   */
  const calculateErrorRateHealth = (errorRate: number): number => {
    const warningThreshold = alertThresholds.ERROR_RATE_WARNING || 0.05;
    
    if (errorRate <= 0.01) {
      return 1.0; // Excellent error rate
    } else if (errorRate <= warningThreshold) {
      // Linear decline from 1.0 to 0.3
      return 1.0 - (errorRate - 0.01) / (warningThreshold - 0.01) * 0.7;
    } else {
      // High error rate
      return Math.max(0, 0.3 - (errorRate - warningThreshold) / (0.5 - warningThreshold) * 0.3);
    }
  };

  /**
   * Calculate trend-based health adjustment
   */
  const calculateTrendAdjustment = (metrics: Map<MetricType, Metric>): number => {
    let trendAdjustment = 0;
    let metricCount = 0;

    metrics.forEach((metric, type) => {
      if (metric.stats.sampleCount < 3) return; // Need enough samples

      const trend = metric.stats.trend;
      const weight = HEALTH_WEIGHTS[type] || 0.1;

      // Positive trends for metrics that should improve
      const shouldImprove = ['data-quality', 'fusion-accuracy', 'prediction-accuracy'].includes(type);
      if (shouldImprove) {
        trendAdjustment += trend * weight * 0.1; // Small positive adjustment for improving quality
      } else {
        trendAdjustment -= Math.abs(trend) * weight * 0.05; // Small negative adjustment for worsening performance
      }
      
      metricCount++;
    });

    return metricCount > 0 ? trendAdjustment / metricCount : 0;
  };

  /**
   * Calculate volatility penalty based on metric stability
   */
  const calculateVolatilityPenalty = (metrics: Map<MetricType, Metric>): number => {
    let totalVolatility = 0;
    let metricCount = 0;

    metrics.forEach((metric, type) => {
      if (metric.stats.sampleCount < 5) return;

      // Coefficient of variation as volatility measure
      const cv = metric.stats.average > 0 
        ? metric.stats.standardDeviation / metric.stats.average 
        : 0;

      const weight = HEALTH_WEIGHTS[type] || 0.1;
      totalVolatility += cv * weight;
      metricCount++;
    });

    if (metricCount === 0) return 0;

    const averageVolatility = totalVolatility / metricCount;
    
    // Convert volatility to penalty (0-0.2 range)
    return Math.min(0.2, averageVolatility * 0.5);
  };

  /**
   * Calculate health score for individual component
   */
  const calculateComponentHealth = (component: ComponentMetrics): number => {
    const healthFactors: number[] = [];

    // Response time factor
    if (component.responseTime !== undefined) {
      const responseHealth = calculateResponseTimeHealth(component.responseTime);
      healthFactors.push(responseHealth);
    }

    // Error rate factor
    if (component.errorRate !== undefined) {
      const errorHealth = calculateErrorRateHealth(component.errorRate);
      healthFactors.push(errorHealth);
    }

    // Memory usage factor
    if (component.memoryUsage !== undefined) {
      const memoryHealth = calculateMemoryHealth(component.memoryUsage);
      healthFactors.push(memoryHealth);
    }

    // CPU usage factor
    if (component.cpuUsage !== undefined) {
      const cpuHealth = calculateCPUHealth(component.cpuUsage);
      healthFactors.push(cpuHealth);
    }

    // Quality factors (accuracy, data quality)
    if (component.accuracy !== undefined) {
      healthFactors.push(component.accuracy);
    }
    
    if (component.dataQuality !== undefined) {
      healthFactors.push(component.dataQuality);
    }

    // Throughput factor (normalized)
    if (component.throughput !== undefined) {
      // Assume throughput is operations per second, normalize to 0-1 range
      const normalizedThroughput = Math.min(1, component.throughput / 1000);
      healthFactors.push(normalizedThroughput);
    }

    return healthFactors.length > 0
      ? healthFactors.reduce((sum, factor) => sum + factor, 0) / healthFactors.length
      : component.health || 0.8;
  };

  /**
   * Determine system status based on health and alerts
   */
  const determineSystemStatus = (health: number, alerts: Alert[]): SystemStatus => {
    const activeAlerts = alerts.filter(alert => !alert.resolved);
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning');

    // Critical status conditions
    if (criticalAlerts.length > 0 || health < 0.3) {
      return 'critical';
    }

    // Degraded status conditions
    if (health < 0.5 || criticalAlerts.length > 0) {
      return 'degraded';
    }

    // Warning status conditions
    if (health < 0.7 || warningAlerts.length > 2) {
      return 'warning';
    }

    return 'healthy';
  };

  /**
   * Generate actionable optimization recommendations
   */
  const generateRecommendations = (
    metrics: Map<MetricType, Metric>,
    alerts: Alert[],
    health: number
  ): OptimizationRecommendation[] => {
    const recommendations: OptimizationRecommendation[] = [];

    // Memory optimization recommendations
    const memoryMetric = metrics.get('memory-usage' as MetricType);
    if (memoryMetric?.stats.current && memoryMetric.stats.current > 0.7) {
      recommendations.push(createMemoryOptimizationRecommendation(memoryMetric.stats.current));
    }

    // CPU optimization recommendations
    const cpuMetric = metrics.get('cpu-usage' as MetricType);
    if (cpuMetric?.stats.current && cpuMetric.stats.current > 0.6) {
      recommendations.push(createCPUOptimizationRecommendation(cpuMetric.stats.current));
    }

    // Response time optimization recommendations
    const responseTimeMetric = metrics.get('response-time' as MetricType);
    if (responseTimeMetric?.stats.current && responseTimeMetric.stats.current > 1000) {
      recommendations.push(createResponseTimeOptimizationRecommendation(responseTimeMetric.stats.current));
    }

    // Error rate improvement recommendations
    const errorRateMetric = metrics.get('error-rate' as MetricType);
    if (errorRateMetric?.stats.current && errorRateMetric.stats.current > 0.02) {
      recommendations.push(createErrorRateImprovementRecommendation(errorRateMetric.stats.current));
    }

    // Data quality improvement recommendations
    const dataQualityMetric = metrics.get('data-quality' as MetricType);
    if (dataQualityMetric?.stats.current && dataQualityMetric.stats.current < 0.8) {
      recommendations.push(createDataQualityImprovementRecommendation(dataQualityMetric.stats.current));
    }

    // Alert-based recommendations
    const alertRecommendations = generateAlertBasedRecommendations(alerts);
    recommendations.push(...alertRecommendations);

    // Health-based recommendations
    if (health < 0.6) {
      recommendations.push(createSystemHealthRecommendation(health));
    }

    // Sort by priority and impact
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return b.impact - a.impact; // Higher impact first
    });
  };

  /**
   * Create memory optimization recommendation
   */
  const createMemoryOptimizationRecommendation = (memoryUsage: number): OptimizationRecommendation => {
    const severity = memoryUsage > 0.9 ? 'critical' : memoryUsage > 0.8 ? 'high' : 'medium';
    
    return {
      type: 'memory',
      priority: severity,
      title: 'Optimize Memory Usage',
      description: `Memory usage is at ${(memoryUsage * 100).toFixed(1)}%. Consider implementing memory optimization strategies.`,
      impact: memoryUsage > 0.9 ? 0.9 : 0.7,
      effort: memoryUsage > 0.9 ? 0.8 : 0.6,
      actions: [
        'Review memory usage patterns in cognitive components',
        'Implement garbage collection optimization',
        'Consider reducing data retention periods',
        'Optimize data structures and caching strategies',
        'Monitor for memory leaks in long-running processes'
      ]
    };
  };

  /**
   * Create CPU optimization recommendation
   */
  const createCPUOptimizationRecommendation = (cpuUsage: number): OptimizationRecommendation => {
    const severity = cpuUsage > 0.8 ? 'high' : 'medium';
    
    return {
      type: 'cpu',
      priority: severity,
      title: 'Optimize CPU Usage',
      description: `CPU usage is at ${(cpuUsage * 100).toFixed(1)}%. Consider optimizing processing efficiency.`,
      impact: 0.7,
      effort: 0.7,
      actions: [
        'Profile CPU-intensive operations',
        'Implement asynchronous processing where possible',
        'Optimize algorithmic complexity',
        'Consider workload distribution strategies',
        'Review and optimize frequent computations'
      ]
    };
  };

  /**
   * Create response time optimization recommendation
   */
  const createResponseTimeOptimizationRecommendation = (responseTime: number): OptimizationRecommendation => {
    const severity = responseTime > 5000 ? 'high' : 'medium';
    
    return {
      type: 'performance',
      priority: severity,
      title: 'Improve Response Time',
      description: `Average response time is ${responseTime.toFixed(0)}ms. Consider performance optimizations.`,
      impact: 0.8,
      effort: 0.6,
      actions: [
        'Implement caching strategies for frequent operations',
        'Optimize database queries and data access patterns',
        'Review and optimize critical path algorithms',
        'Consider parallel processing for independent operations',
        'Implement request prioritization and queuing'
      ]
    };
  };

  /**
   * Create error rate improvement recommendation
   */
  const createErrorRateImprovementRecommendation = (errorRate: number): OptimizationRecommendation => {
    const severity = errorRate > 0.1 ? 'high' : 'medium';
    
    return {
      type: 'performance',
      priority: severity,
      title: 'Reduce Error Rate',
      description: `System error rate is ${(errorRate * 100).toFixed(2)}%. Focus on improving reliability.`,
      impact: 0.9,
      effort: 0.5,
      actions: [
        'Analyze error patterns and root causes',
        'Implement improved input validation',
        'Add defensive programming practices',
        'Enhance error handling and recovery mechanisms',
        'Review and test edge cases more thoroughly'
      ]
    };
  };

  /**
   * Create data quality improvement recommendation
   */
  const createDataQualityImprovementRecommendation = (dataQuality: number): OptimizationRecommendation => {
    return {
      type: 'configuration',
      priority: 'medium',
      title: 'Improve Data Quality',
      description: `Data quality score is ${(dataQuality * 100).toFixed(1)}%. Consider data validation improvements.`,
      impact: 0.6,
      effort: 0.4,
      actions: [
        'Review data validation rules and thresholds',
        'Implement data quality monitoring',
        'Enhance sensor calibration procedures',
        'Add data preprocessing and cleaning steps',
        'Monitor data source reliability'
      ]
    };
  };

  /**
   * Generate recommendations based on active alerts
   */
  const generateAlertBasedRecommendations = (alerts: Alert[]): OptimizationRecommendation[] => {
    const recommendations: OptimizationRecommendation[] = [];
    const activeAlerts = alerts.filter(alert => !alert.resolved);
    
    // Group alerts by type
    const alertGroups = activeAlerts.reduce((groups, alert) => {
      const baseType = alert.type.replace(/-\w+$/, ''); // Remove suffix like '-critical', '-warning'
      if (!groups[baseType]) groups[baseType] = [];
      groups[baseType].push(alert);
      return groups;
    }, {} as Record<string, Alert[]>);

    // Generate recommendations for alert groups
    Object.entries(alertGroups).forEach(([alertType, groupAlerts]) => {
      if (groupAlerts.length >= 2) { // Multiple related alerts
        const severity = groupAlerts.some(a => a.severity === 'critical') ? 'critical' : 'high';
        recommendations.push({
          type: 'performance',
          priority: severity,
          title: `Address ${alertType.replace('-', ' ')} Issues`,
          description: `Multiple ${alertType} alerts detected. Immediate attention required.`,
          impact: 0.8,
          effort: 0.7,
          actions: [
            `Investigate root cause of ${alertType} issues`,
            'Implement immediate mitigation measures',
            'Review system capacity and scaling options',
            'Consider preventive monitoring improvements'
          ]
        });
      }
    });

    return recommendations;
  };

  /**
   * Create system health recommendation
   */
  const createSystemHealthRecommendation = (health: number): OptimizationRecommendation => {
    return {
      type: 'performance',
      priority: health < 0.4 ? 'critical' : 'high',
      title: 'Improve Overall System Health',
      description: `Overall system health is ${(health * 100).toFixed(1)}%. Comprehensive optimization needed.`,
      impact: 0.9,
      effort: 0.8,
      actions: [
        'Conduct comprehensive performance audit',
        'Review all active alerts and their root causes',
        'Implement system-wide monitoring improvements',
        'Consider architectural optimizations',
        'Establish performance baselines and SLAs'
      ]
    };
  };

  return {
    calculateOverallHealth,
    calculateComponentHealth,
    determineSystemStatus,
    generateRecommendations
  };
};