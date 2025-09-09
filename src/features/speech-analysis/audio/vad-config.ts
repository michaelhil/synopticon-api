/**
 * VAD configuration management
 */

export interface VADConfig {
  // Algorithm weights
  energyWeight: number;
  zcrWeight: number;
  entropyWeight: number;
  
  // Consensus threshold
  consensusThreshold: number;
  
  // Smoothing parameters
  smoothingWindow: number;
  hangoverFrames: number; // Extend speech detection
  
  frameSize: number;
  sampleRate: number;
}

export interface VADConfigInput {
  energyWeight?: number;
  zcrWeight?: number;
  entropyWeight?: number;
  consensusThreshold?: number;
  smoothingWindow?: number;
  hangoverFrames?: number;
  frameSize?: number;
  sampleRate?: number;
}

export const createVADConfig = (config: VADConfigInput = {}): VADConfig => ({
  // Algorithm weights
  energyWeight: config.energyWeight ?? 0.5,
  zcrWeight: config.zcrWeight ?? 0.2,
  entropyWeight: config.entropyWeight ?? 0.3,
  
  // Consensus threshold
  consensusThreshold: config.consensusThreshold ?? 0.6,
  
  // Smoothing parameters
  smoothingWindow: config.smoothingWindow ?? 5,
  hangoverFrames: config.hangoverFrames ?? 3, // Extend speech detection
  
  frameSize: config.frameSize ?? 1024,
  sampleRate: config.sampleRate ?? 44100
});

export const validateVADConfig = (config: VADConfig): string[] => {
  const errors: string[] = [];
  
  const weightSum = config.energyWeight + config.zcrWeight + config.entropyWeight;
  if (Math.abs(weightSum - 1.0) >= 0.001) { // Use small epsilon for floating point comparison
    const total = weightSum;
    // Auto-normalize if close to 1.0
    if (Math.abs(total - 1.0) < 0.1) {
      config.energyWeight /= total;
      config.zcrWeight /= total;
      config.entropyWeight /= total;
    } else {
      errors.push('Algorithm weights must sum to 1.0');
    }
  }
  
  if (config.consensusThreshold < 0 || config.consensusThreshold > 1) {
    errors.push('Consensus threshold must be between 0 and 1');
  }
  
  if (config.smoothingWindow < 1) {
    errors.push('Smoothing window must be at least 1');
  }
  
  return errors;
};

export const updateVADConfig = (currentConfig: VADConfig, updates: Partial<VADConfig>): VADConfig => {
  const newConfig = { ...currentConfig, ...updates };
  const errors = validateVADConfig(newConfig);
  
  if (errors.length > 0) {
    throw new Error(`Invalid VAD configuration: ${errors.join(', ')`);
  }
  
  return newConfig;
};