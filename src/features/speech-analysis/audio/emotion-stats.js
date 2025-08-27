/**
 * Emotion detection statistics tracking and analysis
 */

export const createEmotionStats = () => {
  const stats = {
    totalFrames: 0,
    emotionUpdates: 0,
    processingTime: 0,
    
    // Emotion frequency tracking
    emotionCounts: {
      neutral: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      fear: 0,
      surprise: 0,
      disgust: 0
    },
    
    // Processing performance
    averageProcessingTime: 0,
    minProcessingTime: Infinity,
    maxProcessingTime: 0,
    
    // Feature extraction stats
    prosodicExtractions: 0,
    classificationAttempts: 0,
    confidenceSum: 0
  };

  // Record a processed frame
  const recordFrame = (result, processingTime = 0) => {
    stats.totalFrames++;
    stats.processingTime += processingTime;
    
    // Update processing time statistics
    stats.averageProcessingTime = stats.processingTime / stats.totalFrames;
    stats.minProcessingTime = Math.min(stats.minProcessingTime, processingTime);
    stats.maxProcessingTime = Math.max(stats.maxProcessingTime, processingTime);
    
    if (result) {
      // Track emotion classifications
      if (result.emotion && stats.emotionCounts.hasOwnProperty(result.emotion)) {
        stats.emotionCounts[result.emotion]++;
      }
      
      // Track confidence
      if (typeof result.confidence === 'number') {
        stats.confidenceSum += result.confidence;
      }
      
      // Track processing stages
      if (result.processing?.prosodicExtracted) {
        stats.prosodicExtractions++;
      }
      
      if (result.processing?.emotionClassified) {
        stats.emotionUpdates++;
        stats.classificationAttempts++;
      }
    }
  };

  // Get comprehensive statistics
  const getStats = (componentStats = {}) => {
    const totalEmotions = Object.values(stats.emotionCounts).reduce((sum, count) => sum + count, 0);
    
    const emotionDistribution = {};
    for (const [emotion, count] of Object.entries(stats.emotionCounts)) {
      emotionDistribution[emotion] = totalEmotions > 0 ? count / totalEmotions : 0;
    }
    
    const averageConfidence = stats.emotionUpdates > 0 ? 
      stats.confidenceSum / stats.emotionUpdates : 0;
    
    return {
      ...stats,
      
      // Derived statistics
      emotionDistribution,
      averageConfidence,
      emotionUpdateRate: stats.totalFrames > 0 ? stats.emotionUpdates / stats.totalFrames : 0,
      prosodicExtractionRate: stats.totalFrames > 0 ? stats.prosodicExtractions / stats.totalFrames : 0,
      classificationSuccessRate: stats.classificationAttempts > 0 ? stats.emotionUpdates / stats.classificationAttempts : 0,
      
      // Performance metrics
      performance: {
        averageProcessingTime: stats.averageProcessingTime,
        minProcessingTime: stats.minProcessingTime === Infinity ? 0 : stats.minProcessingTime,
        maxProcessingTime: stats.maxProcessingTime,
        framesPerSecond: stats.averageProcessingTime > 0 ? 1000 / stats.averageProcessingTime : 0
      },
      
      // Component statistics
      components: componentStats
    };
  };

  // Get real-time metrics
  const getRealTimeMetrics = () => {
    
    return {
      efficiency: stats.prosodicExtractions / Math.max(stats.totalFrames, 1),
      accuracy: stats.emotionUpdates / Math.max(stats.classificationAttempts, 1),
      responsiveness: stats.emotionUpdateRate,
      stability: 1 - (stats.maxProcessingTime - stats.minProcessingTime) / Math.max(stats.maxProcessingTime, 1)
    };
  };

  // Get emotion summary
  const getEmotionSummary = () => {
    const totalEmotions = Object.values(stats.emotionCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalEmotions === 0) {
      return {
        dominant: 'neutral',
        diversity: 0,
        activity: 0
      };
    }
    
    // Find dominant emotion
    const [dominant] = Object.entries(stats.emotionCounts)
      .reduce((a, b) => a[1] > b[1] ? a : b);
    
    // Calculate emotional diversity (entropy-like measure)
    let diversity = 0;
    for (const count of Object.values(stats.emotionCounts)) {
      if (count > 0) {
        const p = count / totalEmotions;
        diversity -= p * Math.log2(p);
      }
    }
    diversity /= Math.log2(Object.keys(stats.emotionCounts).length); // Normalize
    
    // Calculate emotional activity (non-neutral emotions)
    const activity = (totalEmotions - stats.emotionCounts.neutral) / totalEmotions;
    
    return {
      dominant,
      diversity,
      activity
    };
  };

  // Reset all statistics
  const reset = () => {
    stats.totalFrames = 0;
    stats.emotionUpdates = 0;
    stats.processingTime = 0;
    stats.averageProcessingTime = 0;
    stats.minProcessingTime = Infinity;
    stats.maxProcessingTime = 0;
    stats.prosodicExtractions = 0;
    stats.classificationAttempts = 0;
    stats.confidenceSum = 0;
    
    // Reset emotion counts
    for (const emotion of Object.keys(stats.emotionCounts)) {
      stats.emotionCounts[emotion] = 0;
    }
  };

  // Export statistics for analysis
  const exportStats = () => ({
    timestamp: Date.now(),
    rawStats: { ...stats },
    summary: getStats(),
    realTimeMetrics: getRealTimeMetrics(),
    emotionSummary: getEmotionSummary()
  });

  // Update emotion count manually (for testing)
  const recordEmotion = (emotion, confidence = 1) => {
    if (stats.emotionCounts.hasOwnProperty(emotion)) {
      stats.emotionCounts[emotion]++;
      stats.emotionUpdates++;
      stats.confidenceSum += confidence;
    }
  };

  return {
    recordFrame,
    getStats,
    getRealTimeMetrics,
    getEmotionSummary,
    reset,
    exportStats,
    recordEmotion,
    
    // Direct access to raw stats for testing
    getRawStats: () => ({ ...stats })
  };
};