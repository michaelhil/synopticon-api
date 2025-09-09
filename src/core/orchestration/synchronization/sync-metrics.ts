/**
 * @fileoverview Synchronization Metrics System
 * 
 * Quality assessment and performance metrics for stream synchronization
 * with multi-factor scoring and temporal analysis capabilities.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type { SyncMetrics, SyncMetricsConfig, SyncMetricsFactory } from './types.js';

/**
 * Create synchronization quality metrics with performance assessment
 */
export const createSyncMetrics: SyncMetricsFactory = (config = {}) => ({
  quality: config.quality || 1.0,
  latency: config.latency || 0,
  jitter: config.jitter || 0,
  droppedSamples: config.droppedSamples || 0,
  alignmentAccuracy: config.alignmentAccuracy || 0,
  lastUpdate: config.lastUpdate || Date.now(),
  
  /**
   * Quality scoring based on multiple performance factors
   * Combines latency, jitter, drops, and alignment accuracy into overall score
   */
  computeOverallQuality(): number {
    // Jitter penalty: up to 30% reduction for high variance
    const jitterPenalty = Math.min(this.jitter / 100, 0.3);
    
    // Drop penalty: up to 40% reduction for excessive sample loss
    const dropPenalty = Math.min(this.droppedSamples / 1000, 0.4);
    
    // Latency penalty: up to 20% reduction for high delays
    const latencyPenalty = Math.min(this.latency / 1000, 0.2);
    
    // Alignment penalty: up to 10% reduction for poor alignment
    const alignmentPenalty = Math.min(this.alignmentAccuracy / 500, 0.1);
    
    return Math.max(0, 1.0 - jitterPenalty - dropPenalty - latencyPenalty - alignmentPenalty);
  }
});

/**
 * Advanced metrics calculator with statistical analysis
 */
export const createAdvancedSyncMetrics = () => {
  const state = {
    history: [] as Array<{
      timestamp: number;
      latency: number;
      jitter: number;
      quality: number;
    }>,
    maxHistorySize: 1000
  };

  /**
   * Update metrics with new measurement
   */
  const updateMetrics = (metrics: SyncMetrics) => {
    state.history.push({
      timestamp: Date.now(),
      latency: metrics.latency,
      jitter: metrics.jitter,
      quality: metrics.quality
    });

    // Maintain history size
    if (state.history.length > state.maxHistorySize) {
      state.history.shift();
    }
  };

  /**
   * Calculate statistical analysis of sync performance
   */
  const getStatistics = (windowMs = 60000) => {
    const cutoff = Date.now() - windowMs;
    const recent = state.history.filter(h => h.timestamp > cutoff);

    if (recent.length === 0) {
      return {
        count: 0,
        averageLatency: 0,
        averageJitter: 0,
        averageQuality: 0,
        latencyStdDev: 0,
        jitterStdDev: 0,
        qualityTrend: 'stable'
      };
    }

    const avgLatency = recent.reduce((sum, h) => sum + h.latency, 0) / recent.length;
    const avgJitter = recent.reduce((sum, h) => sum + h.jitter, 0) / recent.length;
    const avgQuality = recent.reduce((sum, h) => sum + h.quality, 0) / recent.length;

    // Calculate standard deviations
    const latencyVariance = recent.reduce((sum, h) => sum + Math.pow(h.latency - avgLatency, 2), 0) / recent.length;
    const jitterVariance = recent.reduce((sum, h) => sum + Math.pow(h.jitter - avgJitter, 2), 0) / recent.length;

    const latencyStdDev = Math.sqrt(latencyVariance);
    const jitterStdDev = Math.sqrt(jitterVariance);

    // Calculate quality trend
    let qualityTrend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (recent.length > 10) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, h) => sum + h.quality, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, h) => sum + h.quality, 0) / secondHalf.length;
      
      const diff = secondAvg - firstAvg;
      if (diff > 0.05) qualityTrend = 'improving';
      else if (diff < -0.05) qualityTrend = 'degrading';
    }

    return {
      count: recent.length,
      averageLatency: avgLatency,
      averageJitter: avgJitter,
      averageQuality: avgQuality,
      latencyStdDev,
      jitterStdDev,
      qualityTrend,
      timespan: windowMs
    };
  };

  /**
   * Get performance recommendations based on metrics
   */
  const getRecommendations = () => {
    const stats = getStatistics();
    const recommendations: string[] = [];

    if (stats.averageLatency > 50) {
      recommendations.push('High latency detected - consider reducing buffer size or processing overhead');
    }

    if (stats.averageJitter > 20) {
      recommendations.push('High jitter detected - check system load and network conditions');
    }

    if (stats.averageQuality < 0.8) {
      recommendations.push('Poor sync quality - verify stream timing and reduce processing complexity');
    }

    if (stats.latencyStdDev > 30) {
      recommendations.push('Inconsistent latency - stabilize processing pipeline');
    }

    if (stats.qualityTrend === 'degrading') {
      recommendations.push('Quality degrading over time - investigate resource usage patterns');
    }

    return recommendations;
  };

  /**
   * Generate performance report
   */
  const generateReport = (windowMs = 300000) => {
    const stats = getStatistics(windowMs);
    const recommendations = getRecommendations();

    return {
      summary: {
        period: windowMs,
        sampleCount: stats.count,
        overallQuality: stats.averageQuality,
        stability: stats.latencyStdDev < 10 && stats.jitterStdDev < 5 ? 'stable' : 'unstable'
      },
      performance: {
        latency: {
          average: stats.averageLatency,
          stdDev: stats.latencyStdDev,
          grade: stats.averageLatency < 10 ? 'excellent' : stats.averageLatency < 30 ? 'good' : 'poor'
        },
        jitter: {
          average: stats.averageJitter,
          stdDev: stats.jitterStdDev,
          grade: stats.averageJitter < 5 ? 'excellent' : stats.averageJitter < 15 ? 'good' : 'poor'
        },
        quality: {
          average: stats.averageQuality,
          trend: stats.qualityTrend,
          grade: stats.averageQuality > 0.9 ? 'excellent' : stats.averageQuality > 0.7 ? 'good' : 'poor'
        }
      },
      recommendations,
      generatedAt: new Date().toISOString()
    };
  };

  /**
   * Clear metrics history
   */
  const clearHistory = () => {
    state.history = [];
  };

  return {
    updateMetrics,
    getStatistics,
    getRecommendations,
    generateReport,
    clearHistory,
    getHistorySize: () => state.history.length
  };
};

/**
 * Utility functions for metrics analysis
 */
export const MetricsUtils = {
  /**
   * Calculate percentile from sorted array
   */
  calculatePercentile: (sortedArray: number[], percentile: number): number => {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    return sortedArray[lower] * (upper - index) + sortedArray[upper] * (index - lower);
  },

  /**
   * Grade metrics performance
   */
  gradePerformance: (latency: number, jitter: number, quality: number): string => {
    const latencyScore = latency < 10 ? 5 : latency < 30 ? 3 : 1;
    const jitterScore = jitter < 5 ? 5 : jitter < 15 ? 3 : 1;
    const qualityScore = quality > 0.9 ? 5 : quality > 0.7 ? 3 : 1;
    
    const total = (latencyScore + jitterScore + qualityScore) / 3;
    
    if (total >= 4.5) return 'excellent';
    if (total >= 3.5) return 'good';
    if (total >= 2.5) return 'fair';
    return 'poor';
  },

  /**
   * Calculate confidence interval
   */
  calculateConfidenceInterval: (values: number[], confidence = 0.95): { lower: number; upper: number; margin: number } => {
    if (values.length < 2) return { lower: 0, upper: 0, margin: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    const stdError = Math.sqrt(variance / values.length);

    // Using t-distribution approximation for small samples
    const tValue = values.length > 30 ? 1.96 : 2.576; // Simplified t-values
    const margin = tValue * stdError;

    return {
      lower: Math.max(0, mean - margin),
      upper: mean + margin,
      margin
    };
  }
};

/**
 * Specialized metrics for different synchronization strategies
 */
export const StrategySpecificMetrics = {
  hardware: (baseMetrics: SyncMetrics) => ({
    ...baseMetrics,
    precision: 'microsecond',
    expectedLatency: '< 1ms',
    reliability: baseMetrics.quality > 0.95 ? 'high' : 'medium'
  }),

  software: (baseMetrics: SyncMetrics) => ({
    ...baseMetrics,
    precision: 'millisecond',
    expectedLatency: '< 10ms',
    clockDrift: baseMetrics.jitter,
    reliability: baseMetrics.quality > 0.8 ? 'medium' : 'low'
  }),

  buffer: (baseMetrics: SyncMetrics) => ({
    ...baseMetrics,
    precision: 'configurable',
    expectedLatency: '< 50ms',
    bufferEfficiency: Math.max(0, 1 - baseMetrics.droppedSamples / 1000),
    reliability: baseMetrics.quality > 0.7 ? 'medium' : 'low'
  }),

  event: (baseMetrics: SyncMetrics) => ({
    ...baseMetrics,
    precision: 'event-dependent',
    expectedLatency: '< 5ms (with events)',
    eventCoverage: baseMetrics.alignmentAccuracy > 0 ? 'good' : 'poor',
    reliability: baseMetrics.quality > 0.9 ? 'high' : 'variable'
  })
};