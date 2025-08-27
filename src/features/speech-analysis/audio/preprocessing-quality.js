/**
 * Audio Quality Metrics Calculator
 * Calculates quality metrics for preprocessed audio
 */

export const createQualityCalculator = (state) => {
  // Calculate quality metrics
  const calculateQualityMetrics = (processedAudio, originalAudio) => {
    const signalLevel = processedAudio.reduce((sum, s) => sum + Math.abs(s), 0) / processedAudio.length;
    const originalLevel = originalAudio.reduce((sum, s) => sum + Math.abs(s), 0) / originalAudio.length;
    
    return {
      signalLevel: 20 * Math.log10(signalLevel + 1e-10),
      noiseLevel: originalLevel > 0 ? 20 * Math.log10((originalLevel - signalLevel + 1e-10) / originalLevel) : -60,
      dcOffset: state.highPassFilter ? state.highPassFilter.getStats().dcOffset : 0
    };
  };

  // Update processing statistics
  const updateStats = (processingTime) => {
    state.stats.totalFrames++;
    state.stats.processingTime += processingTime;
    state.stats.averageProcessingTime = state.stats.processingTime / state.stats.totalFrames;
  };

  // Reset statistics
  const resetStats = () => {
    state.stats = {
      totalFrames: 0,
      processingTime: 0,
      averageProcessingTime: 0,
      qualityImprovement: 0
    };
  };

  // Calculate processing efficiency
  const getProcessingEfficiency = () => {
    return state.stats.totalFrames > 0 ? 
      (state.config.frameSize / state.config.sampleRate * 1000) / state.stats.averageProcessingTime : 0;
  };

  return {
    calculateQualityMetrics,
    updateStats,
    resetStats,
    getProcessingEfficiency
  };
};