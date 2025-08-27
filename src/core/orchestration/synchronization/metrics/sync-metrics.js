/**
 * Synchronization Metrics and Quality Management
 * Provides comprehensive quality tracking and calculation for sync systems
 */

/**
 * Synchronization quality metrics factory
 */
export const createSyncMetrics = (config = {}) => ({
  quality: config.quality || 1.0,
  latency: config.latency || 0,
  jitter: config.jitter || 0,
  droppedSamples: config.droppedSamples || 0,
  alignmentAccuracy: config.alignmentAccuracy || 0,
  lastUpdate: config.lastUpdate || Date.now(),
  
  // Additional metrics for enhanced tracking
  totalAlignments: config.totalAlignments || 0,
  bufferUtilization: config.bufferUtilization || 0,
  correlationRate: config.correlationRate || 0,
  patternRate: config.patternRate || 0,
  lastSync: config.lastSync || 0,
  
  // Quality scoring based on multiple factors
  computeOverallQuality() {
    const jitterPenalty = Math.min(this.jitter / 100, 0.3); // Max 30% penalty for jitter
    const dropPenalty = Math.min(this.droppedSamples / 1000, 0.4); // Max 40% penalty for drops
    const latencyPenalty = Math.min(this.latency / 1000, 0.2); // Max 20% penalty for latency
    
    return Math.max(0, this.quality - jitterPenalty - dropPenalty - latencyPenalty);
  },

  // Get quality grade (A-F)
  getQualityGrade() {
    const overallQuality = this.computeOverallQuality();
    if (overallQuality >= 0.9) return 'A';
    if (overallQuality >= 0.8) return 'B';
    if (overallQuality >= 0.7) return 'C';
    if (overallQuality >= 0.6) return 'D';
    return 'F';
  },

  // Get detailed quality report
  getQualityReport() {
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
});

/**
 * Quality calculator for comprehensive sync monitoring
 */
export const createQualityCalculator = (config = {}) => {
  const calculatorConfig = {
    qualityWindow: config.qualityWindow || 100, // Number of samples to track
    degradationThreshold: config.degradationThreshold || 0.1,
    recoveryThreshold: config.recoveryThreshold || 0.05,
    alertThreshold: config.alertThreshold || 0.6,
    ...config
  };

  const state = {
    qualityHistory: [],
    alerts: [],
    overallMetrics: createSyncMetrics(),
    strategyMetrics: new Map(),
    degradationEvents: []
  };

  const updateQuality = (syncResults) => {
    const now = Date.now();
    
    // Calculate weighted average quality from all sync results
    const totalWeight = syncResults.reduce((sum, result) => sum + result.confidence, 0);
    const weightedQuality = syncResults.reduce((sum, result) => {
      return sum + (result.confidence || 0.5) * (result.quality || 0.5);
    }, 0) / Math.max(totalWeight, 1);

    // Calculate aggregate metrics
    const avgLatency = syncResults.reduce((sum, r) => sum + (r.latency || 0), 0) / syncResults.length;
    const avgJitter = Math.sqrt(
      syncResults.reduce((sum, r) => sum + Math.pow((r.latency || 0) - avgLatency, 2), 0) / syncResults.length
    );
    const totalDropped = syncResults.reduce((sum, r) => sum + (r.droppedSamples || 0), 0);

    const qualitySnapshot = createSyncMetrics({
      quality: weightedQuality,
      latency: avgLatency,
      jitter: avgJitter,
      droppedSamples: totalDropped,
      alignmentAccuracy: syncResults.reduce((sum, r) => sum + (r.alignmentAccuracy || 0), 0) / syncResults.length,
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
        const event = {
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

  const calculateOverallQuality = (syncResults) => {
    if (!syncResults || syncResults.length === 0) {
      return state.overallMetrics;
    }

    return updateQuality(syncResults);
  };

  const getOverallMetrics = () => {
    if (state.qualityHistory.length === 0) {
      return state.overallMetrics;
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

  const getQualityTrend = () => {
    if (state.qualityHistory.length < 10) {
      return { trend: 'insufficient_data', slope: 0 };
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

    let trend;
    if (Math.abs(slope) < 0.001) trend = 'stable';
    else if (slope > 0) trend = 'improving';
    else trend = 'degrading';

    return { trend, slope, confidence: Math.min(1, n / 20) };
  };

  const getAlerts = (severityFilter = null) => {
    const filtered = severityFilter 
      ? state.alerts.filter(alert => alert.severity === severityFilter)
      : state.alerts;

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  };

  const clearAlerts = () => {
    state.alerts = [];
  };

  const getQualityHistogram = (buckets = 10) => {
    if (state.qualityHistory.length === 0) {
      return { buckets: [], distribution: [] };
    }

    const qualities = state.qualityHistory.map(q => q.computeOverallQuality());
    const min = Math.min(...qualities);
    const max = Math.max(...qualities);
    const bucketSize = (max - min) / buckets;

    const histogram = new Array(buckets).fill(0);
    const bucketRanges = [];

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

  const cleanup = async () => {
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