/**
 * @fileoverview Pattern Detection Engine
 * 
 * Advanced pattern detection and analysis for temporal data including
 * trend analysis, anomaly detection, and correlation analysis.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  PatternDetector,
  TimeSeriesEntry,
  TrendAnalysis,
  AnomalyResult,
  Pattern,
  CorrelationResult
} from './types.js';

/**
 * Create pattern detector with advanced statistical methods
 */
export const createPatternDetector = (): PatternDetector => {
  
  const detectTrend = (series: TimeSeriesEntry<number>[]): TrendAnalysis => {
    if (series.length < 3) {
      return {
        direction: 'stable',
        slope: 0,
        confidence: 0,
        r_squared: 0,
        significance: 'low'
      };
    }
    
    const values = series.map(entry => entry.value);
    const indices = series.map((_, i) => i);
    
    const { slope, intercept, rSquared } = calculateLinearRegression(indices, values);
    
    // Determine trend direction with threshold
    const slopeThreshold = Math.abs(slope) > 0.01;
    let direction: TrendAnalysis['direction'];
    
    if (!slopeThreshold) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    // Calculate confidence based on R-squared and data points
    const confidence = Math.min(1, rSquared * Math.sqrt(series.length / 10));
    
    // Determine significance
    let significance: TrendAnalysis['significance'];
    if (rSquared > 0.7 && series.length > 10) {
      significance = 'high';
    } else if (rSquared > 0.4 && series.length > 5) {
      significance = 'medium';
    } else {
      significance = 'low';
    }
    
    return {
      direction,
      slope,
      confidence,
      r_squared: rSquared,
      significance
    };
  };
  
  const detectAnomaly = (
    series: TimeSeriesEntry<number>[], 
    threshold: number = 2.5
  ): AnomalyResult => {
    if (series.length < 5) {
      return {
        isAnomaly: false,
        severity: 'low',
        score: 0,
        threshold,
        context: 'Insufficient data for anomaly detection'
      };
    }
    
    const values = series.map(entry => entry.value);
    const latest = values[values.length - 1];
    
    // Use rolling statistics for dynamic thresholding
    const windowSize = Math.min(20, Math.floor(series.length * 0.3));
    const window = values.slice(-windowSize);
    
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    const std = Math.sqrt(variance);
    
    // Z-score based anomaly detection
    const zscore = Math.abs((latest - mean) / std);
    const isAnomaly = zscore > threshold;
    
    // Calculate severity
    let severity: AnomalyResult['severity'];
    if (zscore > 4) {
      severity = 'critical';
    } else if (zscore > 3) {
      severity = 'high';
    } else if (zscore > 2) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
    
    // Enhanced context with trend information
    const trendInfo = detectTrend(series.slice(-10));
    const context = `Z-score: ${zscore.toFixed(2)}, Trend: ${trendInfo.direction}, Window size: ${windowSize}`;
    
    return {
      isAnomaly,
      severity,
      score: zscore,
      threshold,
      context
    };
  };
  
  const findPattern = (
    series: TimeSeriesEntry<number>[], 
    type?: Pattern['type']
  ): Pattern | null => {
    if (series.length < 10) return null;
    
    const patterns: Pattern[] = [];
    
    // Detect different pattern types
    if (!type || type === 'cycle') {
      const cyclePattern = detectCyclicalPattern(series);
      if (cyclePattern) patterns.push(cyclePattern);
    }
    
    if (!type || type === 'trend') {
      const trendPattern = detectTrendPattern(series);
      if (trendPattern) patterns.push(trendPattern);
    }
    
    if (!type || type === 'anomaly') {
      const anomalyPattern = detectAnomalyPattern(series);
      if (anomalyPattern) patterns.push(anomalyPattern);
    }
    
    // Return pattern with highest confidence
    return patterns.length > 0 
      ? patterns.reduce((best, current) => current.confidence > best.confidence ? current : best)
      : null;
  };
  
  const calculateCorrelation = (series1: number[], series2: number[]): CorrelationResult => {
    if (series1.length !== series2.length || series1.length < 3) {
      return {
        coefficient: 0,
        strength: 'none',
        significance: false
      };
    }
    
    const n = series1.length;
    const mean1 = series1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = series2.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }
    
    if (denom1 === 0 || denom2 === 0) {
      return {
        coefficient: 0,
        strength: 'none',
        significance: false
      };
    }
    
    const coefficient = numerator / Math.sqrt(denom1 * denom2);
    
    // Determine strength of correlation
    const absCoeff = Math.abs(coefficient);
    let strength: CorrelationResult['strength'];
    
    if (absCoeff >= 0.8) {
      strength = 'very-strong';
    } else if (absCoeff >= 0.6) {
      strength = 'strong';
    } else if (absCoeff >= 0.4) {
      strength = 'moderate';
    } else if (absCoeff >= 0.2) {
      strength = 'weak';
    } else {
      strength = 'none';
    }
    
    // Simple significance test (approximate)
    const tStatistic = Math.abs(coefficient * Math.sqrt((n - 2) / (1 - coefficient * coefficient)));
    const significance = tStatistic > 2.0; // Approximate threshold for p < 0.05
    
    return {
      coefficient,
      strength,
      significance,
      pValue: significance ? undefined : 0.05 // Simplified
    };
  };
  
  return {
    detectTrend,
    detectAnomaly,
    findPattern,
    calculateCorrelation
  };
};

/**
 * Linear regression calculation
 */
const calculateLinearRegression = (x: number[], y: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} => {
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssResidual = y.reduce((sum, val, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(val - predicted, 2);
  }, 0);
  
  const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
  
  return { slope, intercept, rSquared };
};

/**
 * Detect cyclical patterns using autocorrelation
 */
const detectCyclicalPattern = (series: TimeSeriesEntry<number>[]): Pattern | null => {
  const values = series.map(entry => entry.value);
  const maxLag = Math.min(series.length / 3, 50);
  
  let bestLag = 0;
  let bestCorrelation = 0;
  
  for (let lag = 2; lag < maxLag; lag++) {
    const correlation = calculateAutocorrelation(values, lag);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  // Threshold for cyclical pattern detection
  if (bestCorrelation < 0.3 || bestLag < 3) return null;
  
  const timespan = {
    start: series[0].timestamp,
    end: series[series.length - 1].timestamp,
    duration: series[series.length - 1].timestamp - series[0].timestamp
  };
  
  return {
    type: 'cycle',
    confidence: bestCorrelation,
    description: `Cyclical pattern detected with period of ${bestLag} data points`,
    parameters: {
      period: bestLag,
      correlation: bestCorrelation,
      periodMs: bestLag * (timespan.duration / series.length)
    },
    timespan
  };
};

/**
 * Detect trend patterns
 */
const detectTrendPattern = (series: TimeSeriesEntry<number>[]): Pattern | null => {
  const trendAnalysis = createPatternDetector().detectTrend(series);
  
  if (trendAnalysis.significance === 'low') return null;
  
  const timespan = {
    start: series[0].timestamp,
    end: series[series.length - 1].timestamp,
    duration: series[series.length - 1].timestamp - series[0].timestamp
  };
  
  return {
    type: 'trend',
    confidence: trendAnalysis.confidence,
    description: `${trendAnalysis.direction} trend detected (slope: ${trendAnalysis.slope.toFixed(4)})`,
    parameters: {
      direction: trendAnalysis.direction,
      slope: trendAnalysis.slope,
      rSquared: trendAnalysis.r_squared
    },
    timespan
  };
};

/**
 * Detect anomaly patterns
 */
const detectAnomalyPattern = (series: TimeSeriesEntry<number>[]): Pattern | null => {
  const anomalyResult = createPatternDetector().detectAnomaly(series);
  
  if (!anomalyResult.isAnomaly || anomalyResult.severity === 'low') return null;
  
  const timespan = {
    start: series[series.length - 1].timestamp,
    end: series[series.length - 1].timestamp,
    duration: 0
  };
  
  return {
    type: 'anomaly',
    confidence: Math.min(1, anomalyResult.score / 4), // Normalize to 0-1
    description: `${anomalyResult.severity} severity anomaly detected`,
    parameters: {
      severity: anomalyResult.severity,
      score: anomalyResult.score,
      threshold: anomalyResult.threshold
    },
    timespan
  };
};

/**
 * Calculate autocorrelation at specific lag
 */
const calculateAutocorrelation = (values: number[], lag: number): number => {
  if (lag >= values.length) return 0;
  
  const n = values.length - lag;
  const series1 = values.slice(0, n);
  const series2 = values.slice(lag, lag + n);
  
  return createPatternDetector().calculateCorrelation(series1, series2).coefficient;
};

/**
 * Advanced pattern detection utilities
 */
export const PatternUtils = {
  /**
   * Detect multiple patterns in a series
   */
  detectAllPatterns: (series: TimeSeriesEntry<number>[]): Pattern[] => {
    const detector = createPatternDetector();
    const patterns: Pattern[] = [];
    
    const types: Pattern['type'][] = ['trend', 'cycle', 'anomaly'];
    
    for (const type of types) {
      const pattern = detector.findPattern(series, type);
      if (pattern) patterns.push(pattern);
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  },

  /**
   * Calculate pattern stability over time
   */
  calculatePatternStability: (
    series: TimeSeriesEntry<number>[],
    windowSize: number = 20
  ): number => {
    if (series.length < windowSize * 2) return 0;
    
    const detector = createPatternDetector();
    const windows = Math.floor(series.length / windowSize);
    const patterns: Pattern[] = [];
    
    for (let i = 0; i < windows; i++) {
      const start = i * windowSize;
      const end = start + windowSize;
      const window = series.slice(start, end);
      const pattern = detector.findPattern(window);
      if (pattern) patterns.push(pattern);
    }
    
    // Calculate consistency of pattern types
    if (patterns.length < 2) return 0;
    
    const typeCount = patterns.reduce((count, pattern) => {
      count[pattern.type] = (count[pattern.type] || 0) + 1;
      return count;
    }, {} as Record<string, number>);
    
    const dominantTypeCount = Math.max(...Object.values(typeCount));
    return dominantTypeCount / patterns.length;
  },

  /**
   * Predict future values based on detected patterns
   */
  predictNext: (
    series: TimeSeriesEntry<number>[],
    steps: number = 1
  ): TimeSeriesEntry<number>[] => {
    if (series.length < 5) return [];
    
    const detector = createPatternDetector();
    const trend = detector.detectTrend(series);
    const pattern = detector.findPattern(series, 'cycle');
    
    const predictions: TimeSeriesEntry<number>[] = [];
    const lastEntry = series[series.length - 1];
    const avgInterval = calculateAverageInterval(series);
    
    for (let i = 1; i <= steps; i++) {
      const timestamp = lastEntry.timestamp + i * avgInterval;
      let predictedValue = lastEntry.value;
      
      // Apply trend
      if (trend.significance !== 'low') {
        predictedValue += trend.slope * i;
      }
      
      // Apply cyclical pattern if detected
      if (pattern && pattern.type === 'cycle') {
        const period = pattern.parameters.period as number;
        const phase = (series.length + i - 1) % period;
        const cycleIndex = Math.floor(phase);
        
        if (cycleIndex < series.length) {
          const cycleValue = series[cycleIndex].value;
          const recentMean = series.slice(-period).reduce((sum, entry) => sum + entry.value, 0) / period;
          const cyclicalAdjustment = (cycleValue - recentMean) * pattern.confidence;
          predictedValue += cyclicalAdjustment;
        }
      }
      
      predictions.push({
        value: predictedValue,
        timestamp
      });
    }
    
    return predictions;
  }
};

/**
 * Calculate average time interval between data points
 */
const calculateAverageInterval = (series: TimeSeriesEntry<number>[]): number => {
  if (series.length < 2) return 0;
  
  const intervals: number[] = [];
  for (let i = 1; i < series.length; i++) {
    intervals.push(series[i].timestamp - series[i - 1].timestamp);
  }
  
  return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
};