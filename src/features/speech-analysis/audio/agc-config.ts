/**
 * AGC Configuration and State Management
 * Configuration and state for Automatic Gain Control
 */

export interface AGCConfig {
  targetLevel: number; // dB
  maxGain: number; // dB
  minGain: number; // dB
  attackTime: number; // seconds
  releaseTime: number; // seconds
  sampleRate: number;
  lookAheadTime: number; // seconds
}

export interface AGCConfigInput {
  targetLevel?: number;
  maxGain?: number;
  minGain?: number;
  attackTime?: number;
  releaseTime?: number;
  sampleRate?: number;
  lookAheadTime?: number;
}

export interface AGCStats {
  totalFrames: number;
  gainAdjustments: number;
  averageGain: number;
  peakLevel: number;
  averageLevel: number;
}

export interface AGCState {
  config: AGCConfig;
  currentGain: number; // linear gain
  envelope: number;
  lookAheadBuffer: Float32Array | null;
  lookAheadIndex: number;
  attackCoeff: number;
  releaseCoeff: number;
  stats: AGCStats;
}

export const createAGCConfig = (config: AGCConfigInput = {}): AGCConfig => ({
  targetLevel: config.targetLevel ?? -12, // dB
  maxGain: config.maxGain ?? 20, // dB
  minGain: config.minGain ?? -10, // dB
  attackTime: config.attackTime ?? 0.001, // seconds
  releaseTime: config.releaseTime ?? 0.1, // seconds
  sampleRate: config.sampleRate ?? 44100,
  lookAheadTime: config.lookAheadTime ?? 0.005 // seconds
});

export const createAGCState = (config: AGCConfig): AGCState => ({
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