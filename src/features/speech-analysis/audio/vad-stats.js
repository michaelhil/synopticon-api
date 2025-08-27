/**
 * VAD statistics tracking and analysis
 */

export const createVADStats = () => {
  const stats = {
    totalFrames: 0,
    speechFrames: 0,
    consensusDecisions: 0,
    algorithmAgreement: {
      all: 0,        // All 3 algorithms agree
      majority: 0,   // 2 out of 3 agree
      minority: 0    // Only 1 or 0 agree
    }
  };

  // Record frame processing result
  const recordFrame = (result) => {
    stats.totalFrames++;
    
    if (result.isVoiceActive) {
      stats.speechFrames++;
    }

    if (result.decision?.smoothed) {
      stats.consensusDecisions++;
    }

    // Track algorithm agreement
    const activeCount = result.consensus?.activeCount || 0;
    if (activeCount === 3) {
      stats.algorithmAgreement.all++;
    } else if (activeCount >= 2) {
      stats.algorithmAgreement.majority++;
    } else {
      stats.algorithmAgreement.minority++;
    }
  };

  // Get comprehensive statistics
  const getStats = (individualVADs = {}) => {
    const voiceActivityRatio = stats.totalFrames > 0 ? 
      stats.speechFrames / stats.totalFrames : 0;
    
    const consensusRatio = stats.totalFrames > 0 ? 
      stats.consensusDecisions / stats.totalFrames : 0;

    const algorithmAgreementRatios = {
      all: stats.totalFrames > 0 ? stats.algorithmAgreement.all / stats.totalFrames : 0,
      majority: stats.totalFrames > 0 ? stats.algorithmAgreement.majority / stats.totalFrames : 0,
      minority: stats.totalFrames > 0 ? stats.algorithmAgreement.minority / stats.totalFrames : 0
    };

    return {
      ...stats,
      voiceActivityRatio,
      consensusRatio,
      algorithmAgreementRatios,
      individual: individualVADs
    };
  };

  // Reset all statistics
  const reset = () => {
    stats.totalFrames = 0;
    stats.speechFrames = 0;
    stats.consensusDecisions = 0;
    stats.algorithmAgreement = {
      all: 0,
      majority: 0,
      minority: 0
    };
  };

  // Get performance metrics
  const getPerformanceMetrics = () => {
    if (stats.totalFrames === 0) {
      return {
        efficiency: 0,
        reliability: 0,
        consistency: 0
      };
    }

    const efficiency = stats.voiceActivityRatio;
    const reliability = stats.algorithmAgreement.all / stats.totalFrames;
    const consistency = (stats.algorithmAgreement.all + stats.algorithmAgreement.majority) / stats.totalFrames;

    return {
      efficiency,    // How much voice activity detected
      reliability,   // How often all algorithms agree
      consistency    // How often majority agrees
    };
  };

  // Export data for analysis
  const exportStats = () => ({
    timestamp: Date.now(),
    stats: { ...stats },
    derived: getStats(),
    performance: getPerformanceMetrics()
  });

  return {
    recordFrame,
    getStats,
    reset,
    getPerformanceMetrics,
    exportStats,
    
    // Direct access to raw stats
    getRawStats: () => ({ ...stats })
  };
};