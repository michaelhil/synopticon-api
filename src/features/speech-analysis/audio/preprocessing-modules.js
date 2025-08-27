/**
 * Audio Preprocessing Modules Manager
 * Manages initialization and lifecycle of preprocessing modules
 */

export const createModulesManager = (state, createNoiseReduction, createAutomaticGainControl, createHighPassFilter) => {
  // Initialize processing modules
  const initialize = () => {
    if (state.config.enableNoiseReduction) {
      state.noiseReduction = createNoiseReduction(state.config.noiseReduction);
    }
    
    if (state.config.enableAGC) {
      state.agc = createAutomaticGainControl(state.config.agc);
    }
    
    if (state.config.enableHighPassFilter) {
      state.highPassFilter = createHighPassFilter(state.config.highpass);
    }
    
    state.isInitialized = true;
  };

  // Process audio through configured modules in order
  const processAudio = (audioBuffer, isQuiet) => {
    let processedAudio = new Float32Array(audioBuffer);
    const modulesApplied = [];
    
    // Process according to configured order
    for (const module of state.config.processingOrder) {
      switch (module) {
        case 'highpass':
          if (state.highPassFilter) {
            processedAudio = state.highPassFilter.processFrame(processedAudio);
            modulesApplied.push('highpass');
          }
          break;
          
        case 'agc':
          if (state.agc) {
            processedAudio = state.agc.processFrame(processedAudio);
            modulesApplied.push('agc');
          }
          break;
          
        case 'denoise':
          if (state.noiseReduction) {
            processedAudio = state.noiseReduction.processFrame(processedAudio, isQuiet);
            modulesApplied.push('denoise');
          }
          break;
      }
    }
    
    return { processedAudio, modulesApplied };
  };

  // Update configuration for all modules
  const updateConfig = (newConfig) => {
    if (newConfig.noiseReduction && state.noiseReduction) {
      state.noiseReduction.updateConfig(newConfig.noiseReduction);
    }
    if (newConfig.agc && state.agc) {
      state.agc.updateConfig(newConfig.agc);
    }
    if (newConfig.highpass && state.highPassFilter) {
      state.highPassFilter.updateConfig(newConfig.highpass);
    }
  };

  // Reset all modules
  const reset = () => {
    if (state.noiseReduction) state.noiseReduction.reset();
    if (state.agc) state.agc.reset();
    if (state.highPassFilter) state.highPassFilter.reset();
  };

  // Get statistics from all modules
  const getModuleStats = () => ({
    noiseReduction: state.noiseReduction ? state.noiseReduction.getStats() : null,
    agc: state.agc ? state.agc.getStats() : null,
    highPassFilter: state.highPassFilter ? state.highPassFilter.getStats() : null
  });

  return {
    initialize,
    processAudio,
    updateConfig,
    reset,
    getModuleStats
  };
};