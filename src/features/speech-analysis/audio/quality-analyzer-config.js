/**
 * Audio Quality Analyzer Configuration
 * Configuration management for audio quality analysis
 */

export const createQualityAnalyzerConfig = (config = {}) => ({
  frameSize: config.frameSize || 1024,
  sampleRate: config.sampleRate || 44100,
  maxPoolSize: config.maxPoolSize || 100,
  qualityThresholds: {
    excellent: config.excellentThreshold || 85,
    good: config.goodThreshold || 70,
    fair: config.fairThreshold || 50,
    poor: config.poorThreshold || 30
  },
  ...config
});

export const createQualityAnalyzerState = (config, snrCalculator, thdCalculator, clippingDetector) => ({
  config,
  
  // Individual analyzers
  snrCalculator,
  thdCalculator,
  clippingDetector,
  
  // Overall statistics
  stats: {
    totalFrames: 0,
    overallQuality: 0,
    qualityDistribution: {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0
    },
    qualityTrend: []
  }
});