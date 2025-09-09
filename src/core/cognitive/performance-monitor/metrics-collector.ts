/**
 * @fileoverview Metrics Collection System
 * 
 * Handles collection, aggregation, and storage of performance metrics
 * from system resources and cognitive components with advanced analytics.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  MetricsCollector,
  CognitiveSystem,
  MetricType,
  Metric,
  MetricSample,
  MetricStats,
  SystemResourceMetrics,
  ComponentMetrics,
  ComponentType,
  METRIC_TYPES
} from './types.js';

/**
 * Create metrics collector with advanced analytics capabilities
 */
export const createMetricsCollector = (
  cognitiveSystem: CognitiveSystem,
  historySize: number = 10000
): MetricsCollector => {
  
  const metrics = new Map<MetricType, Metric>();
  let lastCpuUsage: NodeJS.CpuUsage | null = null;

  /**
   * Initialize all metric types with empty data structures
   */
  const initializeMetrics = (): void => {
    const metricTypes = Object.values(METRIC_TYPES);
    
    for (const type of metricTypes) {
      metrics.set(type as MetricType, {
        type: type as MetricType,
        samples: [],
        stats: {
          current: null,
          average: 0,
          min: 0,
          max: 0,
          trend: 0,
          standardDeviation: 0,
          sampleCount: 0
        },
        lastUpdated: Date.now()
      });
    }
  };

  /**
   * Collect comprehensive system resource metrics
   */
  const collectSystemMetrics = async (timestamp: number): Promise<SystemResourceMetrics> => {
    try {
      // Memory metrics with detailed breakdown
      const memoryUsage = process.memoryUsage ? process.memoryUsage() : null;
      const memoryMetrics = memoryUsage ? {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        heapPercent: memoryUsage.heapUsed / memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      } : {
        heapUsed: 0,
        heapTotal: 0,
        heapPercent: 0,
        external: 0,
        rss: 0
      };

      // Record memory usage metric
      recordMetric('memory-usage' as MetricType, memoryMetrics.heapPercent, timestamp);

      // CPU usage with improved calculation
      const cpuUsage = await getCPUUsage();
      recordMetric('cpu-usage' as MetricType, cpuUsage, timestamp);

      // Event loop lag measurement
      const eventLoopLag = await measureEventLoopLag();

      // Garbage collection stats (if available)
      const gcStats = getGCStats();

      return {
        memoryUsage: memoryMetrics,
        cpuUsage,
        eventLoopLag,
        gcStats
      };

    } catch (error) {
      console.error('Error collecting system metrics:', error);
      throw error;
    }
  };

  /**
   * Collect metrics from all cognitive system components
   */
  const collectComponentMetrics = async (timestamp: number): Promise<Record<string, ComponentMetrics>> => {
    const componentMetrics: Record<string, ComponentMetrics> = {};

    try {
      // Pipeline system metrics
      if (cognitiveSystem.pipelineSystem) {
        const pipelineMetrics = cognitiveSystem.pipelineSystem.getMetrics();
        componentMetrics.pipeline = {
          type: 'pipeline',
          health: cognitiveSystem.pipelineSystem.getHealth(),
          ...pipelineMetrics
        };

        // Record pipeline-specific metrics
        if (pipelineMetrics.responseTime) {
          recordMetric('response-time' as MetricType, pipelineMetrics.responseTime, timestamp);
        }
        if (pipelineMetrics.throughput) {
          recordMetric('throughput' as MetricType, pipelineMetrics.throughput, timestamp);
        }
      }

      // Fusion engine metrics  
      if (cognitiveSystem.fusionEngine) {
        const fusionQuality = cognitiveSystem.fusionEngine.getDataQuality();
        const fusionAccuracy = cognitiveSystem.fusionEngine.getAccuracy();
        const fusionMetrics = cognitiveSystem.fusionEngine.getMetrics();
        
        componentMetrics.fusion = {
          type: 'fusion',
          health: calculateComponentHealthFromMetrics(fusionMetrics),
          accuracy: fusionAccuracy,
          dataQuality: fusionQuality,
          ...fusionMetrics
        };

        recordMetric('data-quality' as MetricType, fusionQuality, timestamp);
        recordMetric('fusion-accuracy' as MetricType, fusionAccuracy, timestamp);
      }

      // LLM integration metrics
      if (cognitiveSystem.llmIntegration) {
        const llmMetrics = cognitiveSystem.llmIntegration.getMetrics();
        componentMetrics.llm = {
          type: 'llm',
          health: cognitiveSystem.llmIntegration.getHealth(),
          ...llmMetrics
        };
      }

      // Predictor metrics
      if (cognitiveSystem.predictor) {
        const predictorAccuracy = cognitiveSystem.predictor.getAccuracy();
        const predictorMetrics = cognitiveSystem.predictor.getMetrics();
        
        componentMetrics.predictor = {
          type: 'predictor',
          health: calculateComponentHealthFromMetrics(predictorMetrics),
          accuracy: predictorAccuracy,
          ...predictorMetrics
        };

        recordMetric('prediction-accuracy' as MetricType, predictorAccuracy, timestamp);
      }

      // Overall system error rate
      if (cognitiveSystem.getErrorRate) {
        const errorRate = cognitiveSystem.getErrorRate();
        recordMetric('error-rate' as MetricType, errorRate, timestamp);
      }

      return componentMetrics;

    } catch (error) {
      console.error('Error collecting component metrics:', error);
      throw error;
    }
  };

  /**
   * Record a metric sample with enhanced statistical analysis
   */
  const recordMetric = (
    type: MetricType, 
    value: number, 
    timestamp: number, 
    metadata?: Record<string, unknown>
  ): void => {
    if (!metrics.has(type)) {
      initializeMetrics();
    }

    const metric = metrics.get(type)!;
    
    // Add new sample with validation
    const validatedValue = validateMetricValue(type, value);
    const sample: MetricSample = {
      value: validatedValue,
      timestamp,
      metadata
    };
    
    metric.samples.push(sample);
    
    // Maintain history size with intelligent pruning
    if (metric.samples.length > historySize) {
      // Remove oldest samples but keep important outliers
      const prunedSamples = intelligentPrune(metric.samples, historySize);
      metric.samples = prunedSamples;
    }
    
    // Update statistics
    updateMetricStats(metric);
    metric.lastUpdated = timestamp;
  };

  /**
   * Get specific metric data
   */
  const getMetric = (type: MetricType): Metric | undefined => {
    return metrics.get(type);
  };

  /**
   * Get all metrics (returns copy to prevent mutation)
   */
  const getAllMetrics = (): Map<MetricType, Metric> => {
    return new Map(metrics);
  };

  /**
   * Clear old metrics beyond retention period
   */
  const clearOldMetrics = (retentionPeriod: number): void => {
    const cutoffTime = Date.now() - retentionPeriod;
    
    metrics.forEach((metric, type) => {
      const filteredSamples = metric.samples.filter(
        sample => sample.timestamp > cutoffTime
      );
      
      if (filteredSamples.length !== metric.samples.length) {
        metric.samples = filteredSamples;
        updateMetricStats(metric);
      }
    });
  };

  // Helper functions

  /**
   * Calculate CPU usage with improved accuracy
   */
  const getCPUUsage = async (): Promise<number> => {
    return new Promise((resolve) => {
      if (!process.cpuUsage) {
        resolve(0);
        return;
      }

      const start = process.cpuUsage(lastCpuUsage);
      
      setTimeout(() => {
        const current = process.cpuUsage(start);
        const userPercent = current.user / 1000000; // Convert to seconds
        const systemPercent = current.system / 1000000;
        const totalPercent = (userPercent + systemPercent) / 0.1; // 100ms sampling period
        
        lastCpuUsage = process.cpuUsage();
        resolve(Math.min(1, totalPercent)); // Cap at 100%
      }, 100);
    });
  };

  /**
   * Measure event loop lag
   */
  const measureEventLoopLag = (): Promise<number> => {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
        resolve(lag);
      });
    });
  };

  /**
   * Get garbage collection statistics
   */
  const getGCStats = (): { collections: number; duration: number } | undefined => {
    // This would integrate with v8 performance hooks in a real implementation
    // For now, return undefined as it requires native modules
    return undefined;
  };

  /**
   * Calculate component health from metrics
   */
  const calculateComponentHealthFromMetrics = (componentMetrics: ComponentMetrics): number => {
    const healthFactors: number[] = [];

    // Response time health
    if (componentMetrics.responseTime !== undefined) {
      const responseTimeHealth = Math.max(0, 1 - (componentMetrics.responseTime / 1000));
      healthFactors.push(responseTimeHealth);
    }

    // Error rate health  
    if (componentMetrics.errorRate !== undefined) {
      const errorHealth = Math.max(0, 1 - (componentMetrics.errorRate / 0.1));
      healthFactors.push(errorHealth);
    }

    // Memory usage health
    if (componentMetrics.memoryUsage !== undefined) {
      const memoryHealth = Math.max(0, 1 - componentMetrics.memoryUsage);
      healthFactors.push(memoryHealth);
    }

    // CPU usage health
    if (componentMetrics.cpuUsage !== undefined) {
      const cpuHealth = Math.max(0, 1 - componentMetrics.cpuUsage);
      healthFactors.push(cpuHealth);
    }

    // Accuracy health (for applicable components)
    if (componentMetrics.accuracy !== undefined) {
      healthFactors.push(componentMetrics.accuracy);
    }

    return healthFactors.length > 0
      ? healthFactors.reduce((sum, factor) => sum + factor, 0) / healthFactors.length
      : 0.8; // Default health
  };

  /**
   * Validate metric values and apply bounds
   */
  const validateMetricValue = (type: MetricType, value: number): number => {
    // Handle NaN and infinite values
    if (!Number.isFinite(value)) {
      return 0;
    }

    // Apply metric-specific bounds
    const bounds: Record<string, { min: number; max: number }> = {
      'memory-usage': { min: 0, max: 1 },
      'cpu-usage': { min: 0, max: 1 },
      'error-rate': { min: 0, max: 1 },
      'data-quality': { min: 0, max: 1 },
      'fusion-accuracy': { min: 0, max: 1 },
      'prediction-accuracy': { min: 0, max: 1 },
      'component-health': { min: 0, max: 1 }
    };

    const bound = bounds[type];
    if (bound) {
      return Math.max(bound.min, Math.min(bound.max, value));
    }

    return value;
  };

  /**
   * Intelligent pruning that preserves important data points
   */
  const intelligentPrune = (samples: MetricSample[], targetSize: number): MetricSample[] => {
    if (samples.length <= targetSize) return samples;

    // Always keep recent samples
    const recentCount = Math.floor(targetSize * 0.5);
    const recentSamples = samples.slice(-recentCount);

    // Keep outliers and trend change points from older samples
    const olderSamples = samples.slice(0, -recentCount);
    const importantOlderSamples = selectImportantSamples(
      olderSamples, 
      targetSize - recentCount
    );

    return [...importantOlderSamples, ...recentSamples];
  };

  /**
   * Select important samples (outliers, trend changes)
   */
  const selectImportantSamples = (samples: MetricSample[], count: number): MetricSample[] => {
    if (samples.length <= count) return samples;

    // Calculate importance scores
    const scoredSamples = samples.map((sample, index) => {
      let score = 0;

      // Outlier score
      const values = samples.map(s => s.value);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const outlierScore = Math.abs(sample.value - mean);
      score += outlierScore;

      // Trend change score (if not first or last sample)
      if (index > 0 && index < samples.length - 1) {
        const prevSlope = sample.value - samples[index - 1].value;
        const nextSlope = samples[index + 1].value - sample.value;
        const trendChangeScore = Math.abs(nextSlope - prevSlope);
        score += trendChangeScore;
      }

      return { sample, score, index };
    });

    // Select top scoring samples
    return scoredSamples
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .sort((a, b) => a.index - b.index) // Restore chronological order
      .map(item => item.sample);
  };

  /**
   * Update metric statistics with advanced calculations
   */
  const updateMetricStats = (metric: Metric): void => {
    const values = metric.samples
      .map(s => s.value)
      .filter(v => Number.isFinite(v));

    if (values.length === 0) {
      metric.stats = {
        current: null,
        average: 0,
        min: 0,
        max: 0,
        trend: 0,
        standardDeviation: 0,
        sampleCount: 0
      };
      return;
    }

    // Basic statistics
    const current = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    // Trend calculation using linear regression
    const trend = calculateTrend(values);

    metric.stats = {
      current,
      average,
      min,
      max,
      trend,
      standardDeviation,
      sampleCount: values.length
    };
  };

  /**
   * Calculate trend using simple linear regression
   */
  const calculateTrend = (values: number[]): number => {
    if (values.length < 2) return 0;

    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    // Calculate slope
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return 0;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    
    // Normalize slope relative to data range
    const dataRange = Math.max(...values) - Math.min(...values);
    return dataRange > 0 ? slope / dataRange : 0;
  };

  // Initialize metrics on creation
  initializeMetrics();

  return {
    collectSystemMetrics,
    collectComponentMetrics,
    recordMetric,
    getMetric,
    getAllMetrics,
    clearOldMetrics
  };
};