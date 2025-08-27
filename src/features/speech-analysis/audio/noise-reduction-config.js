/**
 * Noise Reduction Configuration
 * Configuration and state management for noise reduction
 */

export const createNoiseReductionConfig = (config = {}) => ({
  alpha: config.alpha || 2.0, // Spectral subtraction factor
  beta: config.beta || 0.01, // Noise floor factor
  frameSize: config.frameSize || 1024,
  hopSize: config.hopSize || 512,
  learningRate: config.learningRate || 0.95,
  minGain: config.minGain || 0.1, // Minimum gain to prevent over-subtraction
  maxGain: config.maxGain || 2.0
});

export const createNoiseReductionState = (config) => ({
  config,
  
  // Noise profile
  noiseProfile: null,
  noiseProfileInitialized: false,
  adaptationFrames: 0,
  targetAdaptationFrames: config.adaptationFrames || 20,
  
  // Processing buffers
  window: null,
  overlapBuffer: null,
  
  stats: {
    totalFrames: 0,
    noiseReductionApplied: 0,
    averageNoiseLevel: 0
  }
});