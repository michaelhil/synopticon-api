/**
 * Audio Preprocessing Pipeline Configuration
 * Configuration management for the preprocessing pipeline
 */

export const createPreprocessingConfig = (config = {}) => ({
  frameSize: config.frameSize || 1024,
  sampleRate: config.sampleRate || 44100,
  enableNoiseReduction: config.enableNoiseReduction !== false,
  enableAGC: config.enableAGC !== false,
  enableHighPassFilter: config.enableHighPassFilter !== false,
  processingOrder: config.processingOrder || ['highpass', 'agc', 'denoise'],
  maxPoolSize: config.maxPoolSize || 100,
  ...config
});

export const createPreprocessingState = (config) => ({
  config,
  
  // Processing modules
  noiseReduction: null,
  agc: null,
  highPassFilter: null,
  
  // Processing state
  isInitialized: false,
  
  // Statistics
  stats: {
    totalFrames: 0,
    processingTime: 0,
    averageProcessingTime: 0,
    qualityImprovement: 0
  }
});
