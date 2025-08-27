/**
 * AGC Configuration and State Management
 * Configuration and state for Automatic Gain Control
 */

export const createAGCConfig = (config = {}) => ({
  targetLevel: config.targetLevel || -12, // dB
  maxGain: config.maxGain || 20, // dB
  minGain: config.minGain || -10, // dB
  attackTime: config.attackTime || 0.001, // seconds
  releaseTime: config.releaseTime || 0.1, // seconds
  sampleRate: config.sampleRate || 44100,
  lookAheadTime: config.lookAheadTime || 0.005 // seconds
});

export const createAGCState = (config) => ({
  config,
  
  // AGC state
  currentGain: 1.0, // linear gain
  envelope: 0.0,
  lookAheadBuffer: null,
  lookAheadIndex: 0,
  
  // Coefficients
  attackCoeff: 0,
  releaseCoeff: 0,
  
  stats: {
    totalFrames: 0,
    gainAdjustments: 0,
    averageGain: 0,
    peakLevel: -Infinity,
    averageLevel: 0
  }
});