/**
 * @fileoverview Synchronization Metrics and Quality Management
 * 
 * Provides comprehensive quality tracking, calculation, and analysis
 * for synchronization systems with real-time monitoring and alerting.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// ==========================================
// Type Definitions
// ==========================================

/**
 * Basic synchronization metrics
 */
export interface SyncMetrics {
  /** Overall synchronization quality (0.0 - 1.0) */
  quality: number;
  /** Average latency in milliseconds */
  latency: number;
  /** Timing jitter/variance in milliseconds */
  jitter: number;
  /** Number of dropped samples/frames */
  droppedSamples: number;
  /** Alignment accuracy score (0.0 - 1.0) */
  alignmentAccuracy: number;
  /** Last update timestamp */
  lastUpdate: number;
  /** Total number of alignments performed */
  totalAlignments: number;
  /** Buffer utilization percentage (0.0 - 1.0) */
  bufferUtilization: number;
  /** Correlation detection rate (0.0 - 1.0) */
  correlationRate: number;
  /** Pattern recognition rate (0.0 - 1.0) */
  patternRate: number;
  /** Last successful sync timestamp */
  lastSync: number;
}

/**
 * Enhanced sync metrics with computed methods
 */
export interface EnhancedSyncMetrics extends SyncMetrics {
  /** Compute overall quality with penalties */
  computeOverallQuality(): number;
  /** Get letter grade for quality */
  getQualityGrade(): QualityGrade;
  /** Get detailed quality report */
  getQualityReport(): QualityReport;
}

/**
 * Quality grades
 */
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Quality report components
 */
export interface QualityReport {
  /** Overall computed quality */
  overall: number;
  /** Letter grade */
  grade: QualityGrade;
  /** Component quality metrics */
  components: {
    baseQuality: number;
    latency: number;
    jitter: number;
    reliability: number;
    accuracy: number;
  };
  /** Report timestamp */
  timestamp: number;
}

/**
 * Quality calculator configuration
 */
export interface QualityCalculatorConfig {
  /** Number of quality samples to track in history */
  qualityWindow?: number;
  /** Threshold for detecting quality degradation */
  degradationThreshold?: number;
  /** Threshold for quality recovery detection */
  recoveryThreshold?: number;
  /** Minimum quality before generating alerts */
  alertThreshold?: number;
}

/**
 * Quality degradation event
 */
export interface QualityDegradationEvent {
  /** Event type identifier */
  type: 'quality_degradation';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Amount of quality degradation */
  degradation: number;
  /** Event timestamp */
  timestamp: number;
  /** Previous quality level */
  oldQuality: number;
  /** New quality level */
  newQuality: number;
}

/**
 * Quality alert
 */
export interface QualityAlert {
  /** Alert type */
  type: 'low_quality' | 'quality_degradation';
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
  /** Associated quality value */
  quality?: number;
  /** Quality degradation amount */
  degradation?: number;
  /** Alert timestamp */
  timestamp: number;
  /** Human-readable message */
  message: string;
  /** Previous quality for degradation alerts */
  oldQuality?: number;
  /** New quality for degradation alerts */
  newQuality?: number;
}

/**
 * Rolling quality statistics
 */
export interface RollingQualityStats {
  /** Average quality over window */
  average: number;
  /** Minimum quality in window */
  minimum: number;
  /** Maximum quality in window */
  maximum: number;
  /** Quality variance */
  variance: number;
}

/**
 * Enhanced metrics with rolling statistics
 */
export interface EnhancedMetrics extends SyncMetrics {
  /** Rolling statistics */
  rolling: RollingQualityStats;
  /** Size of quality history */
  historySize: number;
}

/**
 * Quality trend analysis
 */
export interface QualityTrend {
  /** Trend direction */
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
  /** Linear trend slope */
  slope: number;
  /** Confidence in trend analysis (0.0 - 1.0) */
  confidence: number;
}

/**
 * Quality histogram bucket
 */
export interface QualityHistogramBucket {
  /** Bucket range start */
  start: number;
  /** Bucket range end */
  end: number;
}

/**
 * Quality distribution histogram
 */
export interface QualityHistogram {
  /** Histogram buckets */
  buckets: QualityHistogramBucket[];
  /** Sample distribution across buckets */
  distribution: number[];
  /** Total number of samples */
  total: number;
}

/**
 * Synchronization result for quality calculation
 */
export interface SyncResult {
  /** Result confidence (0.0 - 1.0) */
  confidence?: number;
  /** Result quality (0.0 - 1.0) */
  quality?: number;
  /** Result latency in milliseconds */
  latency?: number;
  /** Number of dropped samples */
  droppedSamples?: number;
  /** Alignment accuracy (0.0 - 1.0) */
  alignmentAccuracy?: number;
}

/**
 * Quality calculator interface
 */
export interface QualityCalculator {
  /** Calculate overall quality from sync results */
  calculateOverallQuality(syncResults: SyncResult[]): EnhancedSyncMetrics;
  /** Update quality with new results */
  updateQuality(syncResults: SyncResult[]): EnhancedSyncMetrics;
  /** Get overall quality metrics */
  getOverallMetrics(): EnhancedMetrics;
  /** Get quality trend analysis */
  getQualityTrend(): QualityTrend;
  /** Get quality alerts */
  getAlerts(severityFilter?: string): QualityAlert[];
  /** Clear all alerts */
  clearAlerts(): void;
  /** Get quality distribution histogram */
  getQualityHistogram(buckets?: number): QualityHistogram;
  /** Clean up resources */
  cleanup(): Promise<void>;
}

// ==========================================
// Quality Metrics Factory
// ==========================================

/**
 * Creates enhanced synchronization metrics with computed methods
 * 
 * @param config - Initial metric values
 * @returns Enhanced sync metrics object
 */
export const createSyncMetrics = (config: Partial<SyncMetrics> = {}): EnhancedSyncMetrics => {
  const metrics: SyncMetrics = {
    quality: config.quality ?? 1.0,
    latency: config.latency ?? 0,
    jitter: config.jitter ?? 0,
    droppedSamples: config.droppedSamples ?? 0,
    alignmentAccuracy: config.alignmentAccuracy ?? 0,
    lastUpdate: config.lastUpdate ?? Date.now(),
    totalAlignments: config.totalAlignments ?? 0,
    bufferUtilization: config.bufferUtilization ?? 0,
    correlationRate: config.correlationRate ?? 0,
    patternRate: config.patternRate ?? 0,
    lastSync: config.lastSync ?? 0
  };

  return {
    ...metrics,

    /**
     * Compute overall quality with penalties for various factors
     */
    computeOverallQuality(): number {
      const jitterPenalty = Math.min(this.jitter / 100, 0.3); // Max 30% penalty for jitter
      const dropPenalty = Math.min(this.droppedSamples / 1000, 0.4); // Max 40% penalty for drops
      const latencyPenalty = Math.min(this.latency / 1000, 0.2); // Max 20% penalty for latency

      return Math.max(0, this.quality - jitterPenalty - dropPenalty - latencyPenalty);
    },

    /**
     * Get letter grade based on overall quality
     */
    getQualityGrade(): QualityGrade {
      const overallQuality = this.computeOverallQuality();
      if (overallQuality >= 0.9) return 'A';
      if (overallQuality >= 0.8) return 'B';
      if (overallQuality >= 0.7) return 'C';
      if (overallQuality >= 0.6) return 'D';
      return 'F';
    },

    /**
     * Get comprehensive quality report
     */
    getQualityReport(): QualityReport {
      return {
        overall: this.computeOverallQuality(),
        grade: this.getQualityGrade(),
        components: {
          baseQuality: this.quality,
          latency: this.latency,
          jitter: this.jitter,
          reliability: 1 - (this.droppedSamples / Math.max(this.totalAlignments, 1)),
          accuracy: this.alignmentAccuracy
        },
        timestamp: this.lastUpdate
      };
    }
  };
};

// ==========================================
// Quality Calculator Factory
// ==========================================

/**
 * Internal calculator state
 */
interface QualityCalculatorState {
  qualityHistory: EnhancedSyncMetrics[];
  alerts: QualityAlert[];
  overallMetrics: EnhancedSyncMetrics;
  strategyMetrics: Map<string, EnhancedSyncMetrics>;
  degradationEvents: QualityDegradationEvent[];
}

/**
 * Creates comprehensive quality calculator for sync monitoring
 * 
 * @param config - Calculator configuration
 * @returns Quality calculator instance
 */
export const createQualityCalculator = (config: QualityCalculatorConfig = {}): QualityCalculator => {
  const calculatorConfig = {
    qualityWindow: config.qualityWindow ?? 100, // Number of samples to track
    degradationThreshold: config.degradationThreshold ?? 0.1,
    recoveryThreshold: config.recoveryThreshold ?? 0.05,
    alertThreshold: config.alertThreshold ?? 0.6,
    ...config
  };

  const state: QualityCalculatorState = {
    qualityHistory: [],
    alerts: [],
    overallMetrics: createSyncMetrics(),
    strategyMetrics: new Map(),
    degradationEvents: []
  };

  /**
   * Update quality metrics from sync results
   */
  const updateQuality = (syncResults: SyncResult[]): EnhancedSyncMetrics => {
    const now = Date.now();

    // Calculate weighted average quality from all sync results
    const totalWeight = syncResults.reduce((sum, result) => sum + (result.confidence ?? 0.5), 0);
    const weightedQuality = syncResults.reduce((sum, result) => {
      return sum + (result.confidence ?? 0.5) * (result.quality ?? 0.5);
    }, 0) / Math.max(totalWeight, 1);

    // Calculate aggregate metrics
    const avgLatency = syncResults.reduce((sum, r) => sum + (r.latency ?? 0), 0) / syncResults.length;
    const avgJitter = Math.sqrt(
      syncResults.reduce((sum, r) => sum + Math.pow((r.latency ?? 0) - avgLatency, 2), 0) / syncResults.length
    );
    const totalDropped = syncResults.reduce((sum, r) => sum + (r.droppedSamples ?? 0), 0);

    const qualitySnapshot = createSyncMetrics({
      quality: weightedQuality,
      latency: avgLatency,
      jitter: avgJitter,
      droppedSamples: totalDropped,
      alignmentAccuracy: syncResults.reduce((sum, r) => sum + (r.alignmentAccuracy ?? 0), 0) / syncResults.length,
      totalAlignments: syncResults.length,
      lastUpdate: now
    });

    // Add to history
    state.qualityHistory.push(qualitySnapshot);
    if (state.qualityHistory.length > calculatorConfig.qualityWindow) {
      state.qualityHistory.shift();
    }

    // Update overall metrics
    state.overallMetrics = qualitySnapshot;

    // Detect quality degradation
    if (state.qualityHistory.length >= 10) {
      const recentAvg = state.qualityHistory.slice(-5)
        .reduce((sum, q) => sum + q.computeOverallQuality(), 0) / 5;
      const olderAvg = state.qualityHistory.slice(-10, -5)
        .reduce((sum, q) => sum + q.computeOverallQuality(), 0) / 5;

      const degradation = olderAvg - recentAvg;

      if (degradation > calculatorConfig.degradationThreshold) {
        const event: QualityDegradationEvent = {
          type: 'quality_degradation',
          severity: degradation > 0.2 ? 'high' : 'medium',
          degradation,
          timestamp: now,
          oldQuality: olderAvg,
          newQuality: recentAvg
        };

        state.degradationEvents.push(event);
        state.alerts.push({
          ...event,
          message: `Sync quality degraded by ${(degradation * 100).toFixed(1)}%`
        });
      }
    }

    // Generate alerts for low quality
    const currentQuality = qualitySnapshot.computeOverallQuality();
    if (currentQuality < calculatorConfig.alertThreshold) {
      state.alerts.push({
        type: 'low_quality',
        severity: currentQuality < 0.4 ? 'critical' : 'warning',
        quality: currentQuality,
        timestamp: now,
        message: `Sync quality is ${qualitySnapshot.getQualityGrade()} (${(currentQuality * 100).toFixed(1)}%)`
      });
    }

    // Limit alert history
    if (state.alerts.length > 50) {
      state.alerts.splice(0, 10);
    }

    return qualitySnapshot;
  };

  /**
   * Calculate overall quality from sync results
   */
  const calculateOverallQuality = (syncResults: SyncResult[]): EnhancedSyncMetrics => {
    if (!syncResults || syncResults.length === 0) {
      return state.overallMetrics;
    }

    return updateQuality(syncResults);
  };

  /**
   * Get enhanced overall metrics with rolling statistics
   */
  const getOverallMetrics = (): EnhancedMetrics => {
    if (state.qualityHistory.length === 0) {
      return {
        ...state.overallMetrics,
        rolling: { average: 0, minimum: 0, maximum: 0, variance: 0 },
        historySize: 0
      };
    }

    // Calculate rolling statistics
    const recentQualities = state.qualityHistory.slice(-20).map(q => q.computeOverallQuality());
    const avgQuality = recentQualities.reduce((sum, q) => sum + q, 0) / recentQualities.length;
    const minQuality = Math.min(...recentQualities);
    const maxQuality = Math.max(...recentQualities);

    return {
      ...state.overallMetrics,
      rolling: {
        average: avgQuality,
        minimum: minQuality,
        maximum: maxQuality,
        variance: recentQualities.reduce((sum, q) => sum + Math.pow(q - avgQuality, 2), 0) / recentQualities.length
      },
      historySize: state.qualityHistory.length
    };
  };

  /**
   * Analyze quality trend over time
   */
  const getQualityTrend = (): QualityTrend => {
    if (state.qualityHistory.length < 10) {
      return { trend: 'insufficient_data', slope: 0, confidence: 0 };
    }

    // Calculate linear trend over recent history
    const recent = state.qualityHistory.slice(-20);
    const qualities = recent.map(q => q.computeOverallQuality());

    const n = qualities.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices
    const sumY = qualities.reduce((sum, q) => sum + q, 0);
    const sumXY = qualities.reduce((sum, q, i) => sum + i * q, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squared indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;

    let trend: QualityTrend['trend'];
    if (Math.abs(slope) < 0.001) trend = 'stable';
    else if (slope > 0) trend = 'improving';
    else trend = 'degrading';

    return { trend, slope, confidence: Math.min(1, n / 20) };
  };

  /**
   * Get quality alerts with optional severity filtering
   */
  const getAlerts = (severityFilter?: string): QualityAlert[] => {
    const filtered = severityFilter
      ? state.alerts.filter(alert => alert.severity === severityFilter)
      : state.alerts;

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  };

  /**
   * Clear all quality alerts
   */
  const clearAlerts = (): void => {
    state.alerts = [];
  };

  /**
   * Generate quality distribution histogram
   */
  const getQualityHistogram = (buckets = 10): QualityHistogram => {
    if (state.qualityHistory.length === 0) {
      return { buckets: [], distribution: [], total: 0 };
    }

    const qualities = state.qualityHistory.map(q => q.computeOverallQuality());
    const min = Math.min(...qualities);
    const max = Math.max(...qualities);
    const bucketSize = (max - min) / buckets;

    const histogram = new Array(buckets).fill(0);
    const bucketRanges: QualityHistogramBucket[] = [];

    for (let i = 0; i < buckets; i++) {
      const rangeStart = min + i * bucketSize;
      const rangeEnd = min + (i + 1) * bucketSize;
      bucketRanges.push({ start: rangeStart, end: rangeEnd });
    }

    qualities.forEach(quality => {
      const bucketIndex = Math.min(Math.floor((quality - min) / bucketSize), buckets - 1);
      histogram[bucketIndex]++;
    });

    return {
      buckets: bucketRanges,
      distribution: histogram,
      total: qualities.length
    };
  };

  /**
   * Clean up calculator resources
   */
  const cleanup = async (): Promise<void> => {
    state.qualityHistory = [];
    state.alerts = [];
    state.degradationEvents = [];
    state.strategyMetrics.clear();
  };

  return {
    calculateOverallQuality,
    updateQuality,
    getOverallMetrics,
    getQualityTrend,
    getAlerts,
    clearAlerts,
    getQualityHistogram,
    cleanup
  };
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Create basic sync metrics with defaults
 */
export const createBasicSyncMetrics = (overrides: Partial<SyncMetrics> = {}): SyncMetrics => ({
  quality: 1.0,
  latency: 0,
  jitter: 0,
  droppedSamples: 0,
  alignmentAccuracy: 0,
  lastUpdate: Date.now(),
  totalAlignments: 0,
  bufferUtilization: 0,
  correlationRate: 0,
  patternRate: 0,
  lastSync: 0,
  ...overrides
});

/**
 * Merge multiple sync metrics into aggregate
 */
export const mergeSyncMetrics = (metricsList: SyncMetrics[]): SyncMetrics => {
  if (metricsList.length === 0) {
    return createBasicSyncMetrics();
  }

  const count = metricsList.length;
  const merged = metricsList.reduce((acc, metrics) => ({
    quality: acc.quality + metrics.quality,
    latency: acc.latency + metrics.latency,
    jitter: acc.jitter + metrics.jitter,
    droppedSamples: acc.droppedSamples + metrics.droppedSamples,
    alignmentAccuracy: acc.alignmentAccuracy + metrics.alignmentAccuracy,
    totalAlignments: acc.totalAlignments + metrics.totalAlignments,
    bufferUtilization: acc.bufferUtilization + metrics.bufferUtilization,
    correlationRate: acc.correlationRate + metrics.correlationRate,
    patternRate: acc.patternRate + metrics.patternRate,
    lastUpdate: Math.max(acc.lastUpdate, metrics.lastUpdate),
    lastSync: Math.max(acc.lastSync, metrics.lastSync)
  }), createBasicSyncMetrics());

  return {
    ...merged,
    quality: merged.quality / count,
    latency: merged.latency / count,
    jitter: merged.jitter / count,
    alignmentAccuracy: merged.alignmentAccuracy / count,
    bufferUtilization: merged.bufferUtilization / count,
    correlationRate: merged.correlationRate / count,
    patternRate: merged.patternRate / count
  };
};

/**
 * Compare two sync metrics for quality assessment
 */
export const compareSyncMetrics = (a: SyncMetrics, b: SyncMetrics): {
  better: 'a' | 'b' | 'equal';
  score: number;
  details: Record<string, 'a' | 'b' | 'equal'>;
} => {
  const details = {
    quality: a.quality > b.quality ? 'a' : a.quality < b.quality ? 'b' : 'equal',
    latency: a.latency < b.latency ? 'a' : a.latency > b.latency ? 'b' : 'equal',
    jitter: a.jitter < b.jitter ? 'a' : a.jitter > b.jitter ? 'b' : 'equal',
    reliability: (1 - a.droppedSamples / Math.max(a.totalAlignments, 1)) > 
                (1 - b.droppedSamples / Math.max(b.totalAlignments, 1)) ? 'a' : 'b'
  };

  const scoreA = a.quality * 0.4 + (1 / Math.max(a.latency, 1)) * 0.3 + 
                 (1 / Math.max(a.jitter, 1)) * 0.2 + a.alignmentAccuracy * 0.1;
  const scoreB = b.quality * 0.4 + (1 / Math.max(b.latency, 1)) * 0.3 + 
                 (1 / Math.max(b.jitter, 1)) * 0.2 + b.alignmentAccuracy * 0.1;

  return {
    better: scoreA > scoreB ? 'a' : scoreA < scoreB ? 'b' : 'equal',
    score: scoreA - scoreB,
    details
  };
};