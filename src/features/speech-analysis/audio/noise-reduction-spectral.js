/**
 * Spectral Processing for Noise Reduction
 * Handles noise profile management and spectral subtraction
 */

export const createSpectralProcessor = (state) => {
  // Update noise profile during quiet segments
  const updateNoiseProfile = (magnitudes) => {
    if (!state.noiseProfileInitialized) {
      state.noiseProfile = new Float32Array(magnitudes.length);
      for (let i = 0; i < magnitudes.length; i++) {
        state.noiseProfile[i] = magnitudes[i];
      }
      state.noiseProfileInitialized = true;
    } else {
      // Exponential moving average
      const rate = state.config.learningRate;
      for (let i = 0; i < magnitudes.length; i++) {
        state.noiseProfile[i] = rate * state.noiseProfile[i] + (1 - rate) * magnitudes[i];
      }
    }
    
    state.adaptationFrames++;
  };

  // Apply spectral subtraction
  const applySpectralSubtraction = (magnitudes) => {
    if (!state.noiseProfile) {
      return magnitudes;
    }

    const enhancedMagnitudes = new Float32Array(magnitudes.length);
    
    for (let i = 0; i < magnitudes.length; i++) {
      const signalMag = magnitudes[i];
      const noiseMag = state.noiseProfile[i];
      
      // Spectral subtraction
      const subtractedMag = signalMag - state.config.alpha * noiseMag;
      const flooredMag = Math.max(subtractedMag, state.config.beta * signalMag);
      
      // Apply gain limits
      const gain = signalMag > 0 ? flooredMag / signalMag : 1;
      const limitedGain = Math.max(state.config.minGain, Math.min(state.config.maxGain, gain));
      
      enhancedMagnitudes[i] = signalMag * limitedGain;
    }
    
    return enhancedMagnitudes;
  };

  // Update statistics
  const updateStats = () => {
    state.stats.totalFrames++;
    if (state.noiseProfile) {
      state.stats.noiseReductionApplied++;
      const avgNoise = state.noiseProfile.reduce((sum, n) => sum + n, 0) / state.noiseProfile.length;
      state.stats.averageNoiseLevel = avgNoise;
    }
  };

  return {
    updateNoiseProfile,
    applySpectralSubtraction,
    updateStats
  };
};