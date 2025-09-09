/**
 * Performance metrics tracking for speech analysis pipeline
 */

export const createMetricsTracker = () => {
  const metrics = {
    totalSessions: 0,
    totalTranscriptions: 0,
    totalAnalyses: 0,
    averageLatency: 0,
    successRate: 0,
    errorCount: 0,
    lastProcessingTime: 0
  };

  // Update performance metrics
  const updateMetrics = (processingTime, success) => {
    const totalProcessed = metrics.totalTranscriptions + metrics.totalAnalyses;
    
    if (totalProcessed > 0) {
      metrics.averageLatency = 
        (metrics.averageLatency * (totalProcessed - 1) + processingTime) / totalProcessed;
    }
    
    if (success) {
      const successfulOps = totalProcessed - metrics.errorCount;
      metrics.successRate = successfulOps / totalProcessed;
    }

    metrics.lastProcessingTime = processingTime;
  };

  // Increment transcription count
  const incrementTranscriptions = () => {
    metrics.totalTranscriptions++;
  };

  // Increment analysis count
  const incrementAnalyses = () => {
    metrics.totalAnalyses++;
  };

  // Increment error count
  const incrementErrors = () => {
    metrics.errorCount++;
  };

  // Set total sessions
  const setTotalSessions = (count) => {
    metrics.totalSessions = count;
  };

  // Get current metrics
  const getMetrics = () => ({ ...metrics });

  // Get performance metrics with additional session data
  const getPerformanceMetrics = (isProcessing, activeSession, sessionData) => ({
    ...metrics,
    isProcessing,
    activeSession,
    sessionData: sessionData ? {
      startTime: sessionData.startTime,
      transcriptionCount: sessionData.transcriptions.length,
      analysisCount: sessionData.analyses.length
    } : null
  });

  return {
    updateMetrics,
    incrementTranscriptions,
    incrementAnalyses,
    incrementErrors,
    setTotalSessions,
    getMetrics,
    getPerformanceMetrics
  };
};
