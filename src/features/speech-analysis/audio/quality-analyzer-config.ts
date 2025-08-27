/**
 * Audio Quality Analyzer Configuration
 * Configuration management for audio quality analysis
 * TypeScript implementation with comprehensive type safety
 */

export interface QualityThresholds {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

export interface QualityDistribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

export interface QualityTrendEntry {
  quality: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  timestamp: number;
}

export interface QualityAnalyzerConfig {
  frameSize: number;
  sampleRate: number;
  maxPoolSize: number;
  qualityThresholds: QualityThresholds;
  [key: string]: any;
}

export interface QualityAnalyzerStats {
  totalFrames: number;
  overallQuality: number;
  qualityDistribution: QualityDistribution;
  qualityTrend: QualityTrendEntry[];
}

export interface QualityAnalyzerState {
  config: QualityAnalyzerConfig;
  snrCalculator: any;
  thdCalculator: any;
  clippingDetector: any;
  stats: QualityAnalyzerStats;
}

export const createQualityAnalyzerConfig = (config: Partial<QualityAnalyzerConfig> = {}): QualityAnalyzerConfig => ({
  frameSize: config.frameSize || 1024,
  sampleRate: config.sampleRate || 44100,
  maxPoolSize: config.maxPoolSize || 100,
  qualityThresholds: {
    excellent: config.qualityThresholds?.excellent ?? 85,
    good: config.qualityThresholds?.good ?? 70,
    fair: config.qualityThresholds?.fair ?? 50,
    poor: config.qualityThresholds?.poor ?? 30
  },
  ...config
});

export const createQualityAnalyzerState = (
  config: QualityAnalyzerConfig,
  snrCalculator: any,
  thdCalculator: any,
  clippingDetector: any
): QualityAnalyzerState => ({
  config,
  snrCalculator,
  thdCalculator,
  clippingDetector,
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