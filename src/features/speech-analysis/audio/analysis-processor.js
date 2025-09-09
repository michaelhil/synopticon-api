/**
 * Audio Analysis Processor Module
 * Real-time frame processing and callback management
 */

export const createAnalysisProcessor = (state, featureExtractor, callbackNotifier) => {
  // Process audio frame
  const processAudioFrame = (event) => {
    const startTime = performance.now();
    
    // Get time domain data
    state.analyser.getFloatTimeDomainData(state.buffers.time);
    
    // Get frequency domain data
    state.analyser.getFloatFrequencyData(state.buffers.frequency);
    
    // Extract features
    const features = featureExtractor.extractFeatures(
      state.buffers.time,
      state.buffers.frequency,
      state.audioContext.sampleRate
    );
    
    // Update state
    Object.assign(state.features, features);
    
    // Notify callbacks
    callbackNotifier.notifyCallbacks('onFeatures', features);
    
    if (features.pitch > 0) {
      callbackNotifier.notifyCallbacks('onPitch', features.pitch);
    }
    
    callbackNotifier.notifyCallbacks('onEnergy', features.energy);
    callbackNotifier.notifyCallbacks('onSpectrum', state.buffers.frequency);
    
    // Update metrics
    updateMetrics(startTime);
  };

  // Update performance metrics
  const updateMetrics = (startTime) => {
    state.metrics.framesProcessed++;
    const processingTime = performance.now() - startTime;
    state.metrics.lastProcessTime = processingTime;
    state.metrics.averageLatency = 
      (state.metrics.averageLatency * 0.9) + (processingTime * 0.1);
  };

  // Get processing statistics
  const getProcessingStats = () => ({
    framesProcessed: state.metrics.framesProcessed,
    lastProcessTime: state.metrics.lastProcessTime,
    averageLatency: state.metrics.averageLatency,
    currentFeatures: { ...state.features }
  });

  // Reset metrics
  const resetMetrics = () => {
    state.metrics.framesProcessed = 0;
    state.metrics.lastProcessTime = 0;
    state.metrics.averageLatency = 0;
  };

  return {
    processAudioFrame,
    getProcessingStats,
    resetMetrics
  };
};
