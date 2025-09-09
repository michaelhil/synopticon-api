/**
 * @fileoverview Temporal Fusion System for Trend Analysis
 * 
 * Time-series analysis and trend detection for fusion data with
 * predictive modeling, anomaly detection, and temporal pattern recognition.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  TemporalFusion,
  TemporalFusionFactory,
  TemporalDataPoint,
  TemporalTrend
} from './types.js';

/**
 * Create temporal fusion system for trend analysis and prediction
 */
export const createTemporalFusion: TemporalFusionFactory = (maxHistory = 1000) => {
  const history = new Map<string, TemporalDataPoint[]>();
  const trendCache = new Map<string, { trend: TemporalTrend; timestamp: number }>();
  const cacheTimeout = 30000; // 30 second cache

  /**
   * Add data point to temporal series
   */
  const addDataPoint = (key: string, data: TemporalDataPoint): void => {
    if (!history.has(key)) {
      history.set(key, []);
    }
    
    const series = history.get(key)!;
    
    // Ensure timestamp is set
    const dataPoint = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };
    
    // Insert in chronological order (usually at end)
    const insertIndex = findInsertionIndex(series, dataPoint.timestamp);
    series.splice(insertIndex, 0, dataPoint);
    
    // Maintain history size limit
    if (series.length > maxHistory) {
      const removeCount = series.length - maxHistory;
      series.splice(0, removeCount);
    }
    
    // Invalidate trend cache for this key
    trendCache.delete(key);
  };

  /**
   * Get trend analysis for a data series
   */
  const getTrend = (key: string, duration = 60000): TemporalTrend => {
    // Check cache first
    const cached = trendCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
      return cached.trend;
    }

    const series = history.get(key) || [];
    const cutoff = Date.now() - duration;
    const recent = series.filter(p => p.timestamp >= cutoff);
    
    if (recent.length < 3) {
      const trend = { trend: 'insufficient-data' as const, confidence: 0, samples: recent.length };
      trendCache.set(key, { trend, timestamp: Date.now() });
      return trend;
    }
    
    const trend = calculateAdvancedTrend(recent, duration);
    trendCache.set(key, { trend, timestamp: Date.now() });
    return trend;
  };

  /**
   * Find correct insertion index for chronological ordering
   */
  const findInsertionIndex = (series: TemporalDataPoint[], timestamp: number): number => {
    // Binary search for insertion point
    let left = 0;
    let right = series.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (series[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  };

  /**
   * Calculate advanced trend with multiple indicators
   */
  const calculateAdvancedTrend = (data: TemporalDataPoint[], duration: number): TemporalTrend => {
    const n = data.length;
    if (n < 3) {
      return { trend: 'insufficient-data', confidence: 0, samples: n };
    }

    // Prepare time series for analysis
    const timePoints = data.map((p, i) => ({ x: i, y: p.value, timestamp: p.timestamp, quality: p.quality }));
    
    // Linear regression analysis
    const linearStats = calculateLinearRegression(timePoints);
    
    // Quality-weighted trend analysis
    const qualityWeightedStats = calculateQualityWeightedTrend(timePoints);
    
    // Confidence calculation
    const confidence = calculateTrendConfidence({
      dataPoints: timePoints,
      linearStats,
      qualityWeightedStats,
      duration
    });
    
    // Determine trend direction with statistical significance
    const slope = qualityWeightedStats.slope;
    const significance = Math.abs(slope) / Math.max(qualityWeightedStats.standardError, 0.001);
    
    let trendDirection: TemporalTrend['trend'];
    if (significance < 1.5) { // Not statistically significant
      trendDirection = 'stable';
    } else if (slope > 0.01) {
      trendDirection = 'increasing';
    } else if (slope < -0.01) {
      trendDirection = 'decreasing';
    } else {
      trendDirection = 'stable';
    }

    return {
      trend: trendDirection,
      slope,
      confidence,
      samples: n
    };
  };

  /**
   * Calculate linear regression statistics
   */
  const calculateLinearRegression = (points: Array<{ x: number; y: number }>) => {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const meanY = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const ssResidual = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    
    const rSquared = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal);
    
    return { slope, intercept, rSquared, n };
  };

  /**
   * Calculate quality-weighted trend with robust estimation
   */
  const calculateQualityWeightedTrend = (points: Array<{ x: number; y: number; quality: number }>) => {
    const n = points.length;
    
    // Weighted least squares regression
    const totalWeight = points.reduce((sum, p) => sum + p.quality, 0);
    if (totalWeight === 0) {
      return { slope: 0, intercept: 0, standardError: Infinity };
    }

    const weights = points.map(p => p.quality / totalWeight * n);
    
    const sumWX = points.reduce((sum, p, i) => sum + weights[i] * p.x, 0);
    const sumWY = points.reduce((sum, p, i) => sum + weights[i] * p.y, 0);
    const sumWXY = points.reduce((sum, p, i) => sum + weights[i] * p.x * p.y, 0);
    const sumWX2 = points.reduce((sum, p, i) => sum + weights[i] * p.x * p.x, 0);
    const sumW = weights.reduce((sum, w) => sum + w, 0);

    const denominator = sumW * sumWX2 - sumWX * sumWX;
    const slope = denominator === 0 ? 0 : (sumW * sumWXY - sumWX * sumWY) / denominator;
    const intercept = (sumWY - slope * sumWX) / sumW;
    
    // Calculate standard error
    const residualSumSquares = points.reduce((sum, p, i) => {
      const predicted = slope * p.x + intercept;
      return sum + weights[i] * Math.pow(p.y - predicted, 2);
    }, 0);
    
    const standardError = Math.sqrt(residualSumSquares / (sumW * sumWX2 - sumWX * sumWX));
    
    return { slope, intercept, standardError };
  };

  /**
   * Calculate trend confidence based on multiple factors
   */
  const calculateTrendConfidence = (params: {
    dataPoints: Array<{ x: number; y: number; quality: number; timestamp: number }>;
    linearStats: { slope: number; intercept: number; rSquared: number; n: number };
    qualityWeightedStats: { slope: number; intercept: number; standardError: number };
    duration: number;
  }): number => {
    const { dataPoints, linearStats, qualityWeightedStats, duration } = params;
    
    // Base confidence from sample size
    const sampleSizeConfidence = Math.min(1, dataPoints.length / 10);
    
    // Confidence from R-squared (goodness of fit)
    const fitConfidence = Math.max(0, linearStats.rSquared);
    
    // Confidence from data quality
    const avgQuality = dataPoints.reduce((sum, p) => sum + p.quality, 0) / dataPoints.length;
    const qualityConfidence = avgQuality;
    
    // Confidence from temporal coverage
    if (dataPoints.length < 2) {
      return 0;
    }
    
    const timeSpan = dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp;
    const coverageConfidence = Math.min(1, timeSpan / duration);
    
    // Confidence from statistical significance
    const tStatistic = Math.abs(qualityWeightedStats.slope) / Math.max(qualityWeightedStats.standardError, 0.001);
    const significanceConfidence = Math.min(1, tStatistic / 2); // t > 2 is good significance
    
    // Combined confidence with weights
    const confidence = (
      sampleSizeConfidence * 0.2 +
      fitConfidence * 0.2 +
      qualityConfidence * 0.2 +
      coverageConfidence * 0.2 +
      significanceConfidence * 0.2
    );
    
    return Math.max(0, Math.min(1, confidence));
  };

  /**
   * Clear all temporal data
   */
  const clearHistory = (): void => {
    history.clear();
    trendCache.clear();
  };

  /**
   * Get series statistics
   */
  const getSeriesStatistics = (key: string, duration?: number) => {
    const series = history.get(key) || [];
    const cutoff = duration ? Date.now() - duration : 0;
    const relevant = duration ? series.filter(p => p.timestamp >= cutoff) : series;
    
    if (relevant.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        range: 0
      };
    }

    const values = relevant.map(p => p.value).sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = values[Math.floor(values.length / 2)];
    const min = values[0];
    const max = values[values.length - 1];
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const range = max - min;

    return {
      count: relevant.length,
      mean,
      median,
      min,
      max,
      stdDev,
      range
    };
  };

  /**
   * Detect anomalies in recent data
   */
  const detectAnomalies = (key: string, duration = 300000, sensitivity = 2): Array<{
    dataPoint: TemporalDataPoint;
    anomalyScore: number;
    type: 'outlier' | 'trend-break' | 'quality-drop';
  }> => {
    const series = history.get(key) || [];
    const cutoff = Date.now() - duration;
    const recent = series.filter(p => p.timestamp >= cutoff);
    
    if (recent.length < 5) return [];

    const anomalies = [];
    const stats = getSeriesStatistics(key, duration);
    const threshold = stats.stdDev * sensitivity;

    for (let i = 0; i < recent.length; i++) {
      const point = recent[i];
      const deviation = Math.abs(point.value - stats.mean);
      
      // Statistical outlier detection
      if (deviation > threshold) {
        anomalies.push({
          dataPoint: point,
          anomalyScore: deviation / stats.stdDev,
          type: 'outlier' as const
        });
      }
      
      // Quality drop detection
      if (point.quality < 0.3) {
        anomalies.push({
          dataPoint: point,
          anomalyScore: 1 - point.quality,
          type: 'quality-drop' as const
        });
      }
      
      // Trend break detection (significant change in local slope)
      if (i >= 4 && i < recent.length - 2) {
        const beforeSlope = calculateLocalSlope(recent.slice(i-4, i));
        const afterSlope = calculateLocalSlope(recent.slice(i+1, i+3));
        
        if (Math.abs(beforeSlope - afterSlope) > stats.stdDev) {
          anomalies.push({
            dataPoint: point,
            anomalyScore: Math.abs(beforeSlope - afterSlope) / Math.max(stats.stdDev, 0.001),
            type: 'trend-break' as const
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, 5);
  };

  /**
   * Calculate local slope for trend break detection
   */
  const calculateLocalSlope = (localData: TemporalDataPoint[]): number => {
    if (localData.length < 2) return 0;
    
    const firstValue = localData[0].value;
    const lastValue = localData[localData.length - 1].value;
    const timeSpan = localData[localData.length - 1].timestamp - localData[0].timestamp;
    
    return timeSpan > 0 ? (lastValue - firstValue) / timeSpan * 1000 : 0; // slope per second
  };

  /**
   * Predict future values using trend analysis
   */
  const predictFutureValue = (key: string, forecastMs: number, confidence = 0.8): {
    predictedValue: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  } => {
    const trend = getTrend(key);
    const stats = getSeriesStatistics(key, 300000); // 5 minute window
    
    if (trend.trend === 'insufficient-data' || trend.confidence < confidence) {
      return {
        predictedValue: stats.mean || 0,
        confidence: 0.1,
        upperBound: stats.max || 0,
        lowerBound: stats.min || 0
      };
    }

    const currentValue = stats.mean;
    const timeInSeconds = forecastMs / 1000;
    const predictedChange = (trend.slope || 0) * timeInSeconds;
    const predictedValue = currentValue + predictedChange;
    
    // Uncertainty increases with forecast distance
    const uncertaintyFactor = Math.sqrt(timeInSeconds / 60); // sqrt scaling with time
    const uncertainty = stats.stdDev * uncertaintyFactor;
    
    return {
      predictedValue,
      confidence: trend.confidence * Math.exp(-uncertaintyFactor * 0.1),
      upperBound: predictedValue + uncertainty * 1.96, // 95% confidence interval
      lowerBound: predictedValue - uncertainty * 1.96
    };
  };

  /**
   * Get all available series keys
   */
  const getAvailableSeries = (): string[] => {
    return Array.from(history.keys());
  };

  /**
   * Get memory usage statistics
   */
  const getMemoryStats = () => {
    const totalPoints = Array.from(history.values()).reduce((sum, series) => sum + series.length, 0);
    const seriesCount = history.size;
    const cacheSize = trendCache.size;
    
    return {
      totalDataPoints: totalPoints,
      seriesCount,
      cacheSize,
      maxHistoryPerSeries: maxHistory,
      averagePointsPerSeries: seriesCount > 0 ? totalPoints / seriesCount : 0
    };
  };

  return {
    addDataPoint,
    getTrend,
    clearHistory,
    getSeriesStatistics,
    detectAnomalies,
    predictFutureValue,
    getAvailableSeries,
    getMemoryStats
  };
};

/**
 * Utility functions for temporal analysis
 */
export const TemporalAnalysisUtils = {
  /**
   * Create data smoothing filter
   */
  createSmoothingFilter: (windowSize = 5) => {
    const buffer: number[] = [];
    
    return (value: number): number => {
      buffer.push(value);
      if (buffer.length > windowSize) {
        buffer.shift();
      }
      
      return buffer.reduce((sum, v) => sum + v, 0) / buffer.length;
    };
  },

  /**
   * Calculate change rate between two time periods
   */
  calculateChangeRate: (current: number, previous: number, timeSpanMs: number): number => {
    if (timeSpanMs <= 0) return 0;
    const change = current - previous;
    const timeSpanSeconds = timeSpanMs / 1000;
    return change / timeSpanSeconds; // Change per second
  },

  /**
   * Normalize trend slope to percentage change per minute
   */
  normalizeSlope: (slope: number, baseValue = 1): number => {
    return (slope * 60 / baseValue) * 100; // Percentage change per minute
  },

  /**
   * Classify trend strength
   */
  classifyTrendStrength: (slope: number, confidence: number): 'strong' | 'moderate' | 'weak' | 'insignificant' => {
    const absSlope = Math.abs(slope);
    
    if (confidence < 0.5) return 'insignificant';
    if (absSlope > 0.05 && confidence > 0.8) return 'strong';
    if (absSlope > 0.02 && confidence > 0.6) return 'moderate';
    return 'weak';
  }
};