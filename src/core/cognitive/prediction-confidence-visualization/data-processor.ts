/**
 * @fileoverview Data Processing System for Confidence Visualization
 * 
 * Handles confidence history management, uncertainty calculations,
 * temporal trend analysis, and statistical computations.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  ConfidenceVisualization,
  UncertaintyBounds,
  UncertaintyMetadata,
  VisualizationState,
  ConfidenceStats
} from './types.js';

export interface DataProcessor {
  updateHistory(confidenceData: ConfidenceVisualization): void;
  calculateUncertaintyBounds(confidence: number, metadata?: UncertaintyMetadata): UncertaintyBounds;
  calculateTemporalTrend(windowSize?: number): number;
  getConfidenceStats(): ConfidenceStats | null;
  smoothConfidenceData(data: ConfidenceVisualization): ConfidenceVisualization;
  detectAnomalies(threshold?: number): boolean;
  calculateConfidenceMetrics(): Record<string, number>;
}

export const createDataProcessor = (
  state: VisualizationState,
  historyLength: number
): DataProcessor => {

  /**
   * Update confidence history with new data
   */
  const updateHistory = (confidenceData: ConfidenceVisualization): void => {
    // Apply smoothing to new data
    const smoothedData = smoothConfidenceData(confidenceData);
    
    // Shift history array and add new data
    state.confidenceHistory.shift();
    state.confidenceHistory.push(smoothedData);
    
    state.currentConfidence = smoothedData;
    state.lastUpdate = Date.now();
    
    // Update temporal trend
    if (state.currentConfidence) {
      state.currentConfidence = {
        ...state.currentConfidence,
        temporalTrend: calculateTemporalTrend()
      };
    }
  };

  /**
   * Calculate uncertainty bounds for confidence with advanced metrics
   */
  const calculateUncertaintyBounds = (
    confidence: number, 
    metadata: UncertaintyMetadata = {}
  ): UncertaintyBounds => {
    const {
      sampleSize = 100,
      variability = 0.1,
      temporalStability = 0.8
    } = metadata;
    
    // Sample size uncertainty (inversely related to sample size)
    const sampleUncertainty = Math.sqrt(1 / Math.max(1, sampleSize)) * 0.5;
    
    // Variability uncertainty (directly related to data variability)
    const variabilityUncertainty = Math.min(0.3, variability * 0.3);
    
    // Temporal stability uncertainty (inversely related to stability)
    const temporalUncertainty = Math.min(0.2, (1 - Math.max(0, temporalStability)) * 0.2);
    
    // Historical variance uncertainty
    const historicalUncertainty = calculateHistoricalVariance() * 0.1;
    
    // Model uncertainty based on confidence distribution
    const modelUncertainty = calculateModelUncertainty(confidence);
    
    // Combine uncertainties using root sum of squares
    const totalUncertainty = Math.sqrt(
      sampleUncertainty ** 2 + 
      variabilityUncertainty ** 2 + 
      temporalUncertainty ** 2 +
      historicalUncertainty ** 2 +
      modelUncertainty ** 2
    );
    
    // Apply confidence-dependent scaling
    const scalingFactor = getUncertaintyScalingFactor(confidence);
    const scaledUncertainty = totalUncertainty * scalingFactor;
    
    return {
      upper: Math.min(1, confidence + scaledUncertainty),
      lower: Math.max(0, confidence - scaledUncertainty),
      uncertainty: scaledUncertainty
    };
  };

  /**
   * Calculate temporal trend using advanced regression analysis
   */
  const calculateTemporalTrend = (windowSize = 15): number => {
    const recentHistory = state.confidenceHistory
      .slice(-windowSize)
      .filter((item): item is ConfidenceVisualization => item !== null);
    
    if (recentHistory.length < 3) return 0;
    
    // Use weighted regression with more recent data having higher weights
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumW = 0;
    
    recentHistory.forEach((item, index) => {
      // Exponential weighting favoring recent data
      const weight = Math.exp(index / recentHistory.length);
      sumW += weight;
      sumX += index * weight;
      sumY += item.overallConfidence * weight;
      sumXY += index * item.overallConfidence * weight;
      sumXX += index * index * weight;
    });
    
    // Avoid division by zero
    if (sumW === 0 || (sumW * sumXX - sumX * sumX) === 0) return 0;
    
    // Weighted least squares slope
    const slope = (sumW * sumXY - sumX * sumY) / (sumW * sumXX - sumX * sumX);
    
    // Apply trend smoothing and normalization
    const smoothedSlope = applyTrendSmoothing(slope);
    
    // Normalize to [-1, 1] range with sigmoid scaling
    const normalizedTrend = Math.tanh(smoothedSlope * 20);
    
    return Math.max(-1, Math.min(1, normalizedTrend));
  };

  /**
   * Get comprehensive confidence statistics
   */
  const getConfidenceStats = (): ConfidenceStats | null => {
    if (!state.currentConfidence) return null;
    
    const featureConfidences = Array.from(state.currentConfidence.featureConfidences.values());
    const n = featureConfidences.length;
    
    if (n === 0) {
      return {
        overall: state.currentConfidence.overallConfidence,
        mean: state.currentConfidence.overallConfidence,
        min: state.currentConfidence.overallConfidence,
        max: state.currentConfidence.overallConfidence,
        std: 0,
        trend: state.currentConfidence.temporalTrend,
        uncertainty: state.currentConfidence.uncertaintyBounds.uncertainty
      };
    }
    
    // Calculate statistics
    const mean = featureConfidences.reduce((sum, conf) => sum + conf, 0) / n;
    const min = Math.min(...featureConfidences);
    const max = Math.max(...featureConfidences);
    
    // Standard deviation with Bessel's correction
    const variance = featureConfidences.reduce((sum, conf) => 
      sum + Math.pow(conf - mean, 2), 0) / Math.max(1, n - 1);
    const std = Math.sqrt(variance);
    
    return {
      overall: state.currentConfidence.overallConfidence,
      mean,
      min,
      max,
      std,
      trend: state.currentConfidence.temporalTrend,
      uncertainty: state.currentConfidence.uncertaintyBounds.uncertainty
    };
  };

  /**
   * Apply smoothing to confidence data to reduce noise
   */
  const smoothConfidenceData = (data: ConfidenceVisualization): ConfidenceVisualization => {
    // Get recent history for smoothing context
    const recentHistory = state.confidenceHistory
      .slice(-5)
      .filter((item): item is ConfidenceVisualization => item !== null);
    
    if (recentHistory.length === 0) return data;
    
    // Apply exponential smoothing to overall confidence
    const alpha = 0.3; // Smoothing factor
    const previousConfidence = recentHistory[recentHistory.length - 1].overallConfidence;
    const smoothedOverall = alpha * data.overallConfidence + (1 - alpha) * previousConfidence;
    
    // Smooth feature confidences
    const smoothedFeatureConfidences = new Map<string, number>();
    const previousFeatures = recentHistory[recentHistory.length - 1].featureConfidences;
    
    data.featureConfidences.forEach((confidence, feature) => {
      const previousFeatureConf = previousFeatures.get(feature) ?? confidence;
      const smoothedFeatureConf = alpha * confidence + (1 - alpha) * previousFeatureConf;
      smoothedFeatureConfidences.set(feature, smoothedFeatureConf);
    });
    
    return {
      ...data,
      overallConfidence: smoothedOverall,
      featureConfidences: smoothedFeatureConfidences
    };
  };

  /**
   * Detect anomalies in confidence patterns
   */
  const detectAnomalies = (threshold = 2.5): boolean => {
    if (!state.currentConfidence) return false;
    
    const recentHistory = state.confidenceHistory
      .slice(-10)
      .filter((item): item is ConfidenceVisualization => item !== null);
    
    if (recentHistory.length < 5) return false;
    
    // Calculate z-score for current confidence
    const confidences = recentHistory.map(item => item.overallConfidence);
    const mean = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - mean, 2), 0) / confidences.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return false;
    
    const zScore = Math.abs(state.currentConfidence.overallConfidence - mean) / std;
    
    return zScore > threshold;
  };

  /**
   * Calculate comprehensive confidence metrics
   */
  const calculateConfidenceMetrics = (): Record<string, number> => {
    if (!state.currentConfidence) return {};
    
    const metrics: Record<string, number> = {};
    
    // Basic metrics
    metrics.overall = state.currentConfidence.overallConfidence;
    metrics.trend = state.currentConfidence.temporalTrend;
    metrics.uncertainty = state.currentConfidence.uncertaintyBounds.uncertainty;
    
    // Feature diversity metrics
    const featureValues = Array.from(state.currentConfidence.featureConfidences.values());
    if (featureValues.length > 0) {
      metrics.featureCount = featureValues.length;
      metrics.featureMean = featureValues.reduce((sum, val) => sum + val, 0) / featureValues.length;
      metrics.featureStd = Math.sqrt(
        featureValues.reduce((sum, val) => sum + Math.pow(val - metrics.featureMean, 2), 0) / 
        Math.max(1, featureValues.length - 1)
      );
      metrics.featureRange = Math.max(...featureValues) - Math.min(...featureValues);
    }
    
    // Temporal metrics
    const validHistory = state.confidenceHistory.filter((item): item is ConfidenceVisualization => item !== null);
    if (validHistory.length > 1) {
      metrics.historicalMean = validHistory.reduce((sum, item) => sum + item.overallConfidence, 0) / validHistory.length;
      metrics.historicalVolatility = calculateHistoricalVolatility();
      metrics.trendStrength = Math.abs(state.currentConfidence.temporalTrend);
    }
    
    // Stability metrics
    metrics.isAnomaly = detectAnomalies() ? 1 : 0;
    metrics.stabilityScore = calculateStabilityScore();
    
    return metrics;
  };

  // Helper functions
  const calculateHistoricalVariance = (): number => {
    const validHistory = state.confidenceHistory.filter((item): item is ConfidenceVisualization => item !== null);
    if (validHistory.length < 2) return 0;
    
    const mean = validHistory.reduce((sum, item) => sum + item.overallConfidence, 0) / validHistory.length;
    const variance = validHistory.reduce((sum, item) => 
      sum + Math.pow(item.overallConfidence - mean, 2), 0) / validHistory.length;
    
    return variance;
  };

  const calculateModelUncertainty = (confidence: number): number => {
    // Model uncertainty is higher at confidence extremes (0 and 1)
    // and lower in the middle range
    const distanceFromCenter = Math.abs(confidence - 0.5) * 2;
    return distanceFromCenter * 0.1;
  };

  const getUncertaintyScalingFactor = (confidence: number): number => {
    // Scale uncertainty based on confidence level
    // Higher uncertainty for extreme confidence values
    const centerDistance = Math.abs(confidence - 0.5);
    return 1 + centerDistance * 0.5;
  };

  const applyTrendSmoothing = (slope: number): number => {
    // Apply smoothing to reduce noise in trend calculations
    const recentTrends = state.confidenceHistory
      .slice(-5)
      .filter((item): item is ConfidenceVisualization => item !== null)
      .map(item => item.temporalTrend);
    
    if (recentTrends.length === 0) return slope;
    
    const avgRecentTrend = recentTrends.reduce((sum, trend) => sum + trend, 0) / recentTrends.length;
    
    // Blend current slope with recent trend average
    return 0.7 * slope + 0.3 * avgRecentTrend;
  };

  const calculateHistoricalVolatility = (): number => {
    const validHistory = state.confidenceHistory.filter((item): item is ConfidenceVisualization => item !== null);
    if (validHistory.length < 2) return 0;
    
    // Calculate returns (differences between consecutive confidence values)
    const returns = validHistory.slice(1).map((item, index) => 
      item.overallConfidence - validHistory[index].overallConfidence
    );
    
    if (returns.length === 0) return 0;
    
    // Calculate volatility as standard deviation of returns
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  };

  const calculateStabilityScore = (): number => {
    const validHistory = state.confidenceHistory.filter((item): item is ConfidenceVisualization => item !== null);
    if (validHistory.length < 3) return 1;
    
    // Calculate stability based on consistency of confidence values and trends
    const confidenceStability = 1 - Math.min(1, calculateHistoricalVolatility() * 5);
    const trendStability = 1 - Math.min(1, Math.abs(state.currentConfidence?.temporalTrend ?? 0));
    
    return (confidenceStability + trendStability) / 2;
  };

  return {
    updateHistory,
    calculateUncertaintyBounds,
    calculateTemporalTrend,
    getConfidenceStats,
    smoothConfidenceData,
    detectAnomalies,
    calculateConfidenceMetrics
  };
};