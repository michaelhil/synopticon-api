/**
 * @fileoverview Predictive Analytics System
 * 
 * Advanced predictive analytics for performance monitoring including
 * trend forecasting, anomaly detection, and proactive optimization recommendations.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  PredictiveAnalyzer,
  MetricType,
  Metric,
  Alert,
  PredictiveMetrics,
  OptimizationRecommendation,
  PERFORMANCE_THRESHOLDS
} from './types.js';

/**
 * Forecasting parameters for different metric types
 */
const FORECASTING_PARAMS: Record<string, {
  seasonality: number;
  sensitivity: number;
  horizon: number;
}> = {
  'response-time': { seasonality: 3600000, sensitivity: 0.1, horizon: 1800000 }, // 1hr seasonality, 30min horizon
  'memory-usage': { seasonality: 7200000, sensitivity: 0.05, horizon: 3600000 }, // 2hr seasonality, 1hr horizon
  'cpu-usage': { seasonality: 1800000, sensitivity: 0.15, horizon: 900000 },     // 30min seasonality, 15min horizon
  'error-rate': { seasonality: 3600000, sensitivity: 0.2, horizon: 1800000 },   // 1hr seasonality, 30min horizon
  'throughput': { seasonality: 3600000, sensitivity: 0.1, horizon: 1800000 }
};

/**
 * Anomaly detection parameters
 */
const ANOMALY_PARAMS = {
  windowSize: 50,        // Number of samples for baseline
  zScoreThreshold: 2.5,  // Z-score threshold for anomalies
  changePointThreshold: 0.3, // Threshold for detecting significant changes
  minSamples: 10         // Minimum samples needed for detection
};

/**
 * Create predictive analyzer with advanced forecasting capabilities
 */
export const createPredictiveAnalyzer = (
  alertThresholds: Partial<typeof PERFORMANCE_THRESHOLDS>
): PredictiveAnalyzer => {

  /**
   * Predict future metric trends using multiple forecasting methods
   */
  const predictMetricTrends = (metrics: Map<MetricType, Metric>): PredictiveMetrics[] => {
    const predictions: PredictiveMetrics[] = [];

    metrics.forEach((metric, type) => {
      if (metric.stats.sampleCount < 10) return; // Need minimum samples

      try {
        // Get forecasting parameters for this metric type
        const params = FORECASTING_PARAMS[type] || FORECASTING_PARAMS['response-time'];
        
        // Multiple prediction methods
        const trendPrediction = predictWithTrendAnalysis(metric, params);
        const seasonalPrediction = predictWithSeasonalAnalysis(metric, params);
        const regressionPrediction = predictWithRegression(metric, params);
        
        // Ensemble prediction (weighted average)
        const ensemblePrediction = combineForecasts([
          { prediction: trendPrediction, weight: 0.4 },
          { prediction: seasonalPrediction, weight: 0.3 },
          { prediction: regressionPrediction, weight: 0.3 }
        ]);

        if (ensemblePrediction) {
          predictions.push({
            metricType: type,
            predictedValue: ensemblePrediction.predictedValue,
            confidence: ensemblePrediction.confidence,
            timeHorizon: params.horizon,
            trend: determineTrend(ensemblePrediction.predictedValue, metric.stats.current),
            riskLevel: assessRiskLevel(type, ensemblePrediction.predictedValue)
          });
        }
      } catch (error) {
        console.warn(`Failed to predict trends for ${type}:`, error);
      }
    });

    return predictions;
  };

  /**
   * Predict using trend analysis (linear extrapolation)
   */
  const predictWithTrendAnalysis = (
    metric: Metric, 
    params: typeof FORECASTING_PARAMS[string]
  ): { predictedValue: number; confidence: number } | null => {
    const samples = metric.samples.slice(-20); // Use recent samples
    if (samples.length < 5) return null;

    // Calculate trend using linear regression
    const trend = calculateLinearTrend(samples.map(s => s.value));
    const currentValue = metric.stats.current || 0;
    
    // Extrapolate trend forward
    const timeSteps = params.horizon / 60000; // Convert to minutes
    const predictedValue = currentValue + (trend * timeSteps);
    
    // Confidence decreases with prediction distance and trend volatility
    const volatility = metric.stats.standardDeviation / Math.max(0.1, metric.stats.average);
    const confidence = Math.max(0.1, Math.min(0.9, 0.8 - (volatility * 2) - (timeSteps * 0.01)));
    
    return { predictedValue, confidence };
  };

  /**
   * Predict using seasonal analysis
   */
  const predictWithSeasonalAnalysis = (
    metric: Metric,
    params: typeof FORECASTING_PARAMS[string]
  ): { predictedValue: number; confidence: number } | null => {
    const samples = metric.samples;
    if (samples.length < 20) return null;

    // Extract seasonal patterns
    const seasonalPattern = extractSeasonalPattern(samples, params.seasonality);
    if (!seasonalPattern) return null;

    // Current time phase in seasonal cycle
    const currentTime = Date.now();
    const seasonalPhase = (currentTime % params.seasonality) / params.seasonality;
    
    // Predict based on seasonal pattern
    const predictedValue = seasonalPattern[Math.floor(seasonalPhase * seasonalPattern.length)];
    
    // Confidence based on pattern consistency
    const patternConfidence = calculatePatternConsistency(seasonalPattern);
    
    return { 
      predictedValue,
      confidence: Math.max(0.2, Math.min(0.8, patternConfidence))
    };
  };

  /**
   * Predict using polynomial regression
   */
  const predictWithRegression = (
    metric: Metric,
    params: typeof FORECASTING_PARAMS[string]
  ): { predictedValue: number; confidence: number } | null => {
    const recentSamples = metric.samples.slice(-30);
    if (recentSamples.length < 10) return null;

    // Fit polynomial regression (degree 2)
    const coefficients = fitPolynomialRegression(
      recentSamples.map((_, i) => i),
      recentSamples.map(s => s.value),
      2
    );

    if (!coefficients) return null;

    // Predict forward
    const timeSteps = params.horizon / (5 * 60 * 1000); // Assuming 5-minute intervals
    const x = recentSamples.length + timeSteps;
    const predictedValue = evaluatePolynomial(coefficients, x);

    // Confidence based on R-squared of regression
    const rSquared = calculateRSquared(
      recentSamples.map((_, i) => i),
      recentSamples.map(s => s.value),
      coefficients
    );

    return {
      predictedValue,
      confidence: Math.max(0.1, Math.min(0.85, rSquared))
    };
  };

  /**
   * Detect anomalies in metrics using statistical methods
   */
  const detectAnomalies = (metrics: Map<MetricType, Metric>): Alert[] => {
    const anomalyAlerts: Alert[] = [];
    const currentTime = Date.now();

    metrics.forEach((metric, type) => {
      if (metric.stats.sampleCount < ANOMALY_PARAMS.minSamples) return;

      try {
        // Statistical anomaly detection
        const statisticalAnomalies = detectStatisticalAnomalies(metric, type);
        anomalyAlerts.push(...statisticalAnomalies);

        // Change point detection
        const changePointAnomalies = detectChangePoints(metric, type);
        anomalyAlerts.push(...changePointAnomalies);

        // Contextual anomaly detection (time-based)
        const contextualAnomalies = detectContextualAnomalies(metric, type);
        anomalyAlerts.push(...contextualAnomalies);

      } catch (error) {
        console.warn(`Anomaly detection failed for ${type}:`, error);
      }
    });

    return anomalyAlerts;
  };

  /**
   * Forecast future resource needs
   */
  const forecastResourceNeeds = (timeHorizon: number): Record<string, number> => {
    // This would integrate with current resource usage patterns
    // For now, return placeholder forecasts
    const forecastPeriodHours = timeHorizon / (1000 * 60 * 60);
    
    return {
      memory: Math.min(1.0, 0.6 + (forecastPeriodHours * 0.02)), // 2% increase per hour
      cpu: Math.min(1.0, 0.5 + (forecastPeriodHours * 0.015)),   // 1.5% increase per hour
      storage: Math.min(1.0, 0.3 + (forecastPeriodHours * 0.01)), // 1% increase per hour
      network: Math.min(1.0, 0.4 + (forecastPeriodHours * 0.005)) // 0.5% increase per hour
    };
  };

  /**
   * Generate proactive recommendations based on predictions
   */
  const generateProactiveRecommendations = (predictions: PredictiveMetrics[]): OptimizationRecommendation[] => {
    const recommendations: OptimizationRecommendation[] = [];

    predictions.forEach(prediction => {
      if (prediction.confidence < 0.5) return; // Skip low-confidence predictions

      const recommendation = generatePredictiveRecommendation(prediction);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    });

    return recommendations.sort((a, b) => {
      // Sort by risk level and impact
      const riskOrder = { high: 3, medium: 2, low: 1 };
      return (riskOrder[b.priority as keyof typeof riskOrder] || 0) - 
             (riskOrder[a.priority as keyof typeof riskOrder] || 0);
    });
  };

  // Helper functions

  /**
   * Calculate linear trend using least squares
   */
  const calculateLinearTrend = (values: number[]): number => {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const denominator = n * sumXX - sumX * sumX;
    return denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  };

  /**
   * Extract seasonal patterns from time series data
   */
  const extractSeasonalPattern = (
    samples: Array<{ value: number; timestamp: number }>,
    seasonalPeriod: number
  ): number[] | null => {
    if (samples.length < 20) return null;

    const pattern: number[] = [];
    const patternSize = 24; // 24 points per seasonal cycle

    for (let i = 0; i < patternSize; i++) {
      const phaseStart = (i / patternSize) * seasonalPeriod;
      const phaseEnd = ((i + 1) / patternSize) * seasonalPeriod;
      
      // Find samples in this phase across multiple cycles
      const phaseSamples = samples.filter(sample => {
        const phase = sample.timestamp % seasonalPeriod;
        return phase >= phaseStart && phase < phaseEnd;
      });

      if (phaseSamples.length > 0) {
        const average = phaseSamples.reduce((sum, s) => sum + s.value, 0) / phaseSamples.length;
        pattern.push(average);
      } else {
        pattern.push(0);
      }
    }

    return pattern;
  };

  /**
   * Calculate pattern consistency score
   */
  const calculatePatternConsistency = (pattern: number[]): number => {
    if (pattern.length < 3) return 0;
    
    const mean = pattern.reduce((sum, val) => sum + val, 0) / pattern.length;
    const variance = pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pattern.length;
    
    // Lower variance indicates more consistent pattern
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    return Math.max(0, 1 - coefficientOfVariation);
  };

  /**
   * Fit polynomial regression
   */
  const fitPolynomialRegression = (
    x: number[],
    y: number[],
    degree: number
  ): number[] | null => {
    if (x.length !== y.length || x.length <= degree) return null;

    // Create Vandermonde matrix
    const matrix: number[][] = [];
    for (let i = 0; i < x.length; i++) {
      const row: number[] = [];
      for (let j = 0; j <= degree; j++) {
        row.push(Math.pow(x[i], j));
      }
      matrix.push(row);
    }

    // Solve using normal equations (simplified implementation)
    try {
      return solveLinearSystem(matrix, y);
    } catch {
      return null;
    }
  };

  /**
   * Evaluate polynomial at given x
   */
  const evaluatePolynomial = (coefficients: number[], x: number): number => {
    let result = 0;
    for (let i = 0; i < coefficients.length; i++) {
      result += coefficients[i] * Math.pow(x, i);
    }
    return result;
  };

  /**
   * Calculate R-squared for regression quality
   */
  const calculateRSquared = (x: number[], y: number[], coefficients: number[]): number => {
    const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < x.length; i++) {
      const predicted = evaluatePolynomial(coefficients, x[i]);
      ssRes += Math.pow(y[i] - predicted, 2);
      ssTot += Math.pow(y[i] - yMean, 2);
    }
    
    return ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  };

  /**
   * Simple linear system solver (Gaussian elimination)
   */
  const solveLinearSystem = (matrix: number[][], b: number[]): number[] => {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make diagonal 1
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) throw new Error('Singular matrix');
      
      for (let j = 0; j <= n; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j <= n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    return augmented.map(row => row[n]);
  };

  /**
   * Combine multiple forecasts using weighted average
   */
  const combineForecasts = (
    forecasts: Array<{ prediction: { predictedValue: number; confidence: number } | null; weight: number }>
  ): { predictedValue: number; confidence: number } | null => {
    const validForecasts = forecasts.filter(f => f.prediction !== null);
    if (validForecasts.length === 0) return null;

    let weightedValue = 0;
    let weightedConfidence = 0;
    let totalWeight = 0;

    validForecasts.forEach(({ prediction, weight }) => {
      if (prediction) {
        const adjustedWeight = weight * prediction.confidence;
        weightedValue += prediction.predictedValue * adjustedWeight;
        weightedConfidence += prediction.confidence * adjustedWeight;
        totalWeight += adjustedWeight;
      }
    });

    if (totalWeight === 0) return null;

    return {
      predictedValue: weightedValue / totalWeight,
      confidence: Math.min(0.95, weightedConfidence / totalWeight)
    };
  };

  /**
   * Determine trend direction
   */
  const determineTrend = (predicted: number, current: number | null): 'increasing' | 'decreasing' | 'stable' => {
    if (current === null) return 'stable';
    
    const change = (predicted - current) / Math.max(0.1, Math.abs(current));
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  };

  /**
   * Assess risk level based on predicted value and thresholds
   */
  const assessRiskLevel = (metricType: MetricType, predictedValue: number): 'low' | 'medium' | 'high' => {
    const thresholds = {
      'response-time': { medium: 1000, high: 3000 },
      'memory-usage': { medium: 0.7, high: 0.85 },
      'cpu-usage': { medium: 0.6, high: 0.8 },
      'error-rate': { medium: 0.02, high: 0.05 }
    };

    const threshold = thresholds[metricType as keyof typeof thresholds];
    if (!threshold) return 'low';

    if (predictedValue >= threshold.high) return 'high';
    if (predictedValue >= threshold.medium) return 'medium';
    return 'low';
  };

  /**
   * Detect statistical anomalies using Z-score
   */
  const detectStatisticalAnomalies = (metric: Metric, type: MetricType): Alert[] => {
    const alerts: Alert[] = [];
    const current = metric.stats.current;
    
    if (current === null || metric.stats.standardDeviation === 0) return alerts;

    const zScore = Math.abs(current - metric.stats.average) / metric.stats.standardDeviation;
    
    if (zScore > ANOMALY_PARAMS.zScoreThreshold) {
      alerts.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: `${type}-statistical-anomaly`,
        severity: zScore > 3 ? 'critical' : 'warning',
        message: `Statistical anomaly detected in ${type}: Z-score ${zScore.toFixed(2)}`,
        timestamp: Date.now(),
        source: 'predictive-analyzer',
        resolved: false,
        metadata: {
          zScore,
          currentValue: current,
          average: metric.stats.average,
          standardDeviation: metric.stats.standardDeviation
        }
      });
    }

    return alerts;
  };

  /**
   * Detect change points in time series
   */
  const detectChangePoints = (metric: Metric, type: MetricType): Alert[] => {
    const alerts: Alert[] = [];
    const samples = metric.samples;
    
    if (samples.length < 20) return alerts;

    // Simple change point detection using sliding windows
    const windowSize = Math.min(10, Math.floor(samples.length / 4));
    const recentWindow = samples.slice(-windowSize).map(s => s.value);
    const previousWindow = samples.slice(-windowSize * 2, -windowSize).map(s => s.value);
    
    if (previousWindow.length === 0) return alerts;

    const recentMean = recentWindow.reduce((sum, val) => sum + val, 0) / recentWindow.length;
    const previousMean = previousWindow.reduce((sum, val) => sum + val, 0) / previousWindow.length;
    
    const relativeChange = Math.abs(recentMean - previousMean) / Math.max(0.1, previousMean);
    
    if (relativeChange > ANOMALY_PARAMS.changePointThreshold) {
      alerts.push({
        id: `changepoint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: `${type}-change-point`,
        severity: 'warning',
        message: `Significant change detected in ${type}: ${(relativeChange * 100).toFixed(1)}% change`,
        timestamp: Date.now(),
        source: 'predictive-analyzer',
        resolved: false,
        metadata: {
          relativeChange,
          recentMean,
          previousMean,
          changeDirection: recentMean > previousMean ? 'increase' : 'decrease'
        }
      });
    }

    return alerts;
  };

  /**
   * Detect contextual anomalies (time-based)
   */
  const detectContextualAnomalies = (metric: Metric, type: MetricType): Alert[] => {
    // This would implement contextual anomaly detection based on time patterns
    // For now, return empty array as it requires more complex temporal analysis
    return [];
  };

  /**
   * Generate recommendation based on prediction
   */
  const generatePredictiveRecommendation = (prediction: PredictiveMetrics): OptimizationRecommendation | null => {
    if (prediction.riskLevel === 'low') return null;

    const timeHorizonHours = prediction.timeHorizon / (1000 * 60 * 60);
    const priority = prediction.riskLevel === 'high' ? 'high' : 'medium';

    return {
      type: 'performance',
      priority: priority as 'high' | 'medium',
      title: `Proactive ${prediction.metricType} Optimization`,
      description: `Predicted ${prediction.metricType} will reach ${prediction.predictedValue.toFixed(2)} in ${timeHorizonHours.toFixed(1)} hours (${prediction.trend} trend, ${prediction.riskLevel} risk)`,
      impact: prediction.riskLevel === 'high' ? 0.8 : 0.6,
      effort: 0.5,
      actions: [
        `Monitor ${prediction.metricType} closely over the next ${timeHorizonHours.toFixed(1)} hours`,
        'Consider preemptive scaling or optimization measures',
        'Review capacity planning and resource allocation',
        'Implement preventive measures before threshold breach'
      ],
      metadata: {
        prediction: prediction.predictedValue,
        confidence: prediction.confidence,
        timeHorizon: prediction.timeHorizon,
        trend: prediction.trend
      }
    };
  };

  return {
    predictMetricTrends,
    detectAnomalies,
    forecastResourceNeeds,
    generateProactiveRecommendations
  };
};