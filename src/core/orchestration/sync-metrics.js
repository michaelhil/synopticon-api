/**
 * Synchronization Metrics
 * Quality metrics and scoring for temporal alignment
 */

// Synchronization quality metrics factory
export const createSyncMetrics = (config = {}) => ({
  quality: config.quality || 1.0,
  latency: config.latency || 0,
  jitter: config.jitter || 0,
  droppedSamples: config.droppedSamples || 0,
  alignmentAccuracy: config.alignmentAccuracy || 0,
  lastUpdate: config.lastUpdate || Date.now(),
  
  // Quality scoring based on multiple factors
  computeOverallQuality() {
    const jitterPenalty = Math.min(this.jitter / 100, 0.3); // Max 30% penalty for jitter
    const dropPenalty = Math.min(this.droppedSamples / 1000, 0.4); // Max 40% penalty for drops
    const latencyPenalty = Math.min(this.latency / 1000, 0.2); // Max 20% penalty for latency
    
    return Math.max(0, 1.0 - jitterPenalty - dropPenalty - latencyPenalty);
  },

  // Update metrics with new measurements
  update(newMetrics) {
    Object.assign(this, newMetrics);
    this.lastUpdate = Date.now();
    return this;
  },

  // Get quality assessment as text
  getQualityAssessment() {
    const overall = this.computeOverallQuality();
    
    if (overall >= 0.9) return 'excellent';
    if (overall >= 0.7) return 'good';
    if (overall >= 0.5) return 'fair';
    return 'poor';
  },

  // Export as plain object
  toObject() {
    return {
      quality: this.quality,
      latency: this.latency,
      jitter: this.jitter,
      droppedSamples: this.droppedSamples,
      alignmentAccuracy: this.alignmentAccuracy,
      lastUpdate: this.lastUpdate,
      overallQuality: this.computeOverallQuality(),
      assessment: this.getQualityAssessment()
    };
  }
});