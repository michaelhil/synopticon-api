/**
 * VAD configuration management
 */

export const createVADConfig = (config = {}) => ({
  // Algorithm weights
  energyWeight: config.energyWeight || 0.5,
  zcrWeight: config.zcrWeight || 0.2,
  entropyWeight: config.entropyWeight || 0.3,
  
  // Consensus threshold
  consensusThreshold: config.consensusThreshold || 0.6,
  
  // Smoothing parameters
  smoothingWindow: config.smoothingWindow || 5,
  hangoverFrames: config.hangoverFrames || 3, // Extend speech detection
  
  frameSize: config.frameSize || 1024,
  sampleRate: config.sampleRate || 44100
});

export const validateVADConfig = (config) => {
  const errors = [];
  
  if (config.energyWeight + config.zcrWeight + config.entropyWeight !== 1.0) {
    const total = config.energyWeight + config.zcrWeight + config.entropyWeight;
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

export const updateVADConfig = (currentConfig, updates) => {
  const newConfig = { ...currentConfig, ...updates };
  const errors = validateVADConfig(newConfig);
  
  if (errors.length > 0) {
    throw new Error(`Invalid VAD configuration: ${errors.join(', ')}`);
  }
  
  return newConfig;
};