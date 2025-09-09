/**
 * Speech Recognition Metrics Calculator
 * Comprehensive metrics tracking, analysis, and reporting
 */

export const createMetricsCalculator = () => {
  const initializeMetrics = (state) => {
    if (!state.metrics) {
      state.metrics = {};
    }

    // Core speech recognition metrics
    const coreMetrics = {
      totalWords: 0,
      totalCharacters: 0,
      totalSessions: 0,
      averageConfidence: 0,
      errors: 0,
      totalProcessingTime: 0,
      sessionStartTime: null,
      sessionDuration: 0
    };

    // Advanced metrics
    const advancedMetrics = {
      wordsPerMinute: 0,
      charactersPerSecond: 0,
      averageWordLength: 0,
      confidenceDistribution: {
        high: 0, // > 0.8
        medium: 0, // 0.5 - 0.8
        low: 0 // < 0.5
      },
      errorTypes: {},
      backendUsage: {},
      languageDistribution: {},
      sessionHistory: []
    };

    // Performance metrics
    const performanceMetrics = {
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      totalResponses: 0,
      timeouts: 0,
      retries: 0
    };

    // Audio quality metrics (if available)
    const audioMetrics = {
      averageVolumeLevel: 0,
      averageSignalLevel: 0,
      averageBackgroundNoise: 0,
      averageSNR: 0,
      silencePeriods: 0,
      totalAudioDuration: 0
    };

    // Merge with existing metrics to preserve any existing data
    state.metrics = {
      ...coreMetrics,
      ...advancedMetrics,
      ...performanceMetrics,
      ...audioMetrics,
      ...state.metrics
    };

    console.log('📊 Metrics calculator initialized');
    return state.metrics;
  };

  const updateWordMetrics = (state, words, confidence) => {
    if (!words || !Array.isArray(words)) {
      return;
    }

    const previousTotalWords = state.metrics.totalWords;
    const newWordCount = words.length;
    
    // Update word count
    state.metrics.totalWords += newWordCount;
    
    // Update character count
    const newCharacterCount = words.reduce((sum, word) => sum + (word.word || '').length, 0);
    state.metrics.totalCharacters += newCharacterCount;
    
    // Update average word length
    if (state.metrics.totalWords > 0) {
      state.metrics.averageWordLength = state.metrics.totalCharacters / state.metrics.totalWords;
    }

    // Update confidence metrics
    if (confidence > 0) {
      const {totalWords} = state.metrics;
      const previousAvg = state.metrics.averageConfidence;
      
      // Weighted average confidence
      state.metrics.averageConfidence = 
        (previousAvg * previousTotalWords + confidence * newWordCount) / totalWords;
        
      // Update confidence distribution
      updateConfidenceDistribution(state, confidence, newWordCount);
    }

    // Calculate speaking rate if we have timing info
    updateSpeakingRate(state);
  };

  const updateConfidenceDistribution = (state, confidence, wordCount) => {
    if (confidence > 0.8) {
      state.metrics.confidenceDistribution.high += wordCount;
    } else if (confidence >= 0.5) {
      state.metrics.confidenceDistribution.medium += wordCount;
    } else {
      state.metrics.confidenceDistribution.low += wordCount;
    }
  };

  const updateSpeakingRate = (state) => {
    if (!state.metrics.sessionStartTime || state.metrics.totalWords === 0) {
      return;
    }

    const sessionDuration = (Date.now() - state.metrics.sessionStartTime) / 1000; // seconds
    state.metrics.sessionDuration = sessionDuration;

    if (sessionDuration > 0) {
      // Words per minute
      state.metrics.wordsPerMinute = (state.metrics.totalWords / sessionDuration) * 60;
      
      // Characters per second
      state.metrics.charactersPerSecond = state.metrics.totalCharacters / sessionDuration;
    }
  };

  const updateProcessingTime = (state, processingTime) => {
    if (typeof processingTime !== 'number' || processingTime < 0) {
      return;
    }

    state.metrics.totalProcessingTime += processingTime;
    state.metrics.totalResponses++;

    // Update response time statistics
    state.metrics.averageResponseTime = 
      state.metrics.totalProcessingTime / state.metrics.totalResponses;
      
    state.metrics.minResponseTime = Math.min(state.metrics.minResponseTime, processingTime);
    state.metrics.maxResponseTime = Math.max(state.metrics.maxResponseTime, processingTime);
  };

  const updateErrorMetrics = (state, error) => {
    state.metrics.errors++;

    // Track error types
    const errorType = error.code || error.error || error.name || 'unknown';
    if (!state.metrics.errorTypes[errorType]) {
      state.metrics.errorTypes[errorType] = 0;
    }
    state.metrics.errorTypes[errorType]++;

    // Update last error info
    state.metrics.lastError = {
      type: errorType,
      message: error.message || error,
      timestamp: Date.now()
    };
  };

  const updateBackendUsage = (state, backendName) => {
    if (!backendName) {
      return;
    }

    if (!state.metrics.backendUsage[backendName]) {
      state.metrics.backendUsage[backendName] = {
        sessions: 0,
        totalWords: 0,
        averageConfidence: 0,
        errors: 0
      };
    }

    const backend = state.metrics.backendUsage[backendName];
    backend.sessions++;
    
    // This will be updated when words are processed
    backend.currentSessionStart = Date.now();
  };

  const updateLanguageDistribution = (state, language) => {
    if (!language) {
      return;
    }

    if (!state.metrics.languageDistribution[language]) {
      state.metrics.languageDistribution[language] = {
        sessions: 0,
        totalWords: 0,
        averageConfidence: 0
      };
    }

    state.metrics.languageDistribution[language].sessions++;
  };

  const startSession = (state, backendName, language) => {
    state.metrics.totalSessions++;
    state.metrics.sessionStartTime = Date.now();
    
    // Reset session-specific metrics
    const sessionMetrics = {
      sessionWords: 0,
      sessionCharacters: 0,
      sessionStartTime: Date.now(),
      sessionDuration: 0,
      sessionBackend: backendName,
      sessionLanguage: language,
      sessionErrors: 0
    };

    // Store current session info
    state.currentSession = sessionMetrics;

    updateBackendUsage(state, backendName);
    updateLanguageDistribution(state, language);

    console.log(`📈 Started metrics session: ${backendName} (${language})`);
  };

  const endSession = (state) => {
    if (!state.currentSession || !state.metrics.sessionStartTime) {
      return null;
    }

    const sessionEndTime = Date.now();
    const sessionDuration = (sessionEndTime - state.metrics.sessionStartTime) / 1000;
    
    // Update session duration
    state.metrics.sessionDuration = sessionDuration;
    state.currentSession.sessionDuration = sessionDuration;
    state.currentSession.endTime = sessionEndTime;

    // Calculate session-specific rates
    if (sessionDuration > 0) {
      state.currentSession.wordsPerMinute = (state.currentSession.sessionWords / sessionDuration) * 60;
      state.currentSession.charactersPerSecond = state.currentSession.sessionCharacters / sessionDuration;
    }

    // Store in session history
    if (!state.metrics.sessionHistory) {
      state.metrics.sessionHistory = [];
    }
    
    state.metrics.sessionHistory.push({...state.currentSession});
    
    // Keep only last 50 sessions
    if (state.metrics.sessionHistory.length > 50) {
      state.metrics.sessionHistory = state.metrics.sessionHistory.slice(-50);
    }

    const sessionSummary = {
      duration: sessionDuration,
      words: state.currentSession.sessionWords,
      characters: state.currentSession.sessionCharacters,
      wordsPerMinute: state.currentSession.wordsPerMinute || 0,
      charactersPerSecond: state.currentSession.charactersPerSecond || 0,
      backend: state.currentSession.sessionBackend,
      language: state.currentSession.sessionLanguage,
      errors: state.currentSession.sessionErrors
    };

    // Clear current session
    state.currentSession = null;
    state.metrics.sessionStartTime = null;

    console.log('📊 Session ended:', sessionSummary);
    return sessionSummary;
  };

  const updateAudioMetrics = (state, audioData) => {
    if (!audioData || typeof audioData !== 'object') {
      return;
    }

    const {metrics} = state;

    // Update rolling averages for audio metrics
    if (typeof audioData.volumeLevel === 'number') {
      metrics.averageVolumeLevel = updateRollingAverage(
        metrics.averageVolumeLevel, audioData.volumeLevel, 0.1
      );
    }

    if (typeof audioData.signalLevel === 'number') {
      metrics.averageSignalLevel = updateRollingAverage(
        metrics.averageSignalLevel, audioData.signalLevel, 0.1
      );
    }

    if (typeof audioData.backgroundNoise === 'number') {
      metrics.averageBackgroundNoise = updateRollingAverage(
        metrics.averageBackgroundNoise, audioData.backgroundNoise, 0.1
      );
    }

    if (typeof audioData.snrEstimate === 'number') {
      metrics.averageSNR = updateRollingAverage(
        metrics.averageSNR, audioData.snrEstimate, 0.1
      );
    }

    // Detect silence periods (low volume levels)
    if (typeof audioData.volumeLevel === 'number' && audioData.volumeLevel < 0.01) {
      metrics.silencePeriods++;
    }
  };

  const updateRollingAverage = (currentAverage, newValue, alpha = 0.1) => {
    // Exponential moving average
    return currentAverage * (1 - alpha) + newValue * alpha;
  };

  const generateMetricsReport = (state, format = 'summary') => {
    const {metrics} = state;
    const now = Date.now();

    const baseReport = {
      timestamp: now,
      totalSessions: metrics.totalSessions,
      totalWords: metrics.totalWords,
      totalCharacters: metrics.totalCharacters,
      averageConfidence: Math.round(metrics.averageConfidence * 100) / 100,
      totalErrors: metrics.errors,
      wordsPerMinute: Math.round(metrics.wordsPerMinute * 10) / 10,
      charactersPerSecond: Math.round(metrics.charactersPerSecond * 10) / 10
    };

    if (format === 'summary') {
      return baseReport;
    }

    const detailedReport = {
      ...baseReport,
      performance: {
        averageResponseTime: Math.round(metrics.averageResponseTime * 10) / 10,
        minResponseTime: metrics.minResponseTime === Infinity ? 0 : metrics.minResponseTime,
        maxResponseTime: metrics.maxResponseTime,
        totalResponses: metrics.totalResponses,
        timeouts: metrics.timeouts,
        retries: metrics.retries
      },
      confidence: {
        average: Math.round(metrics.averageConfidence * 100) / 100,
        distribution: {
          high: Math.round((metrics.confidenceDistribution.high / metrics.totalWords) * 100) || 0,
          medium: Math.round((metrics.confidenceDistribution.medium / metrics.totalWords) * 100) || 0,
          low: Math.round((metrics.confidenceDistribution.low / metrics.totalWords) * 100) || 0
        }
      },
      errors: {
        total: metrics.errors,
        types: metrics.errorTypes,
        errorRate: metrics.totalSessions > 0 ? Math.round((metrics.errors / metrics.totalSessions) * 100) / 100 : 0
      },
      backends: metrics.backendUsage,
      languages: metrics.languageDistribution,
      audio: {
        averageVolumeLevel: Math.round(metrics.averageVolumeLevel * 100) / 100,
        averageSignalLevel: Math.round(metrics.averageSignalLevel),
        averageBackgroundNoise: Math.round(metrics.averageBackgroundNoise),
        averageSNR: Math.round(metrics.averageSNR * 10) / 10,
        silencePeriods: metrics.silencePeriods
      }
    };

    if (format === 'detailed') {
      return detailedReport;
    }

    // Full report includes session history
    return {
      ...detailedReport,
      sessionHistory: metrics.sessionHistory || []
    };
  };

  const resetMetrics = (state, preserveHistory = false) => {
    const currentHistory = preserveHistory ? (state.metrics.sessionHistory || []) : [];
    
    initializeMetrics(state);
    
    if (preserveHistory) {
      state.metrics.sessionHistory = currentHistory;
    }

    console.log(`📊 Metrics reset (history ${preserveHistory ? 'preserved' : 'cleared'})`);
  };

  const exportMetrics = (state, format = 'json') => {
    const report = generateMetricsReport(state, 'full');
    
    switch (format.toLowerCase()) {
    case 'csv':
      return convertToCSV(report);
    case 'txt':
      return convertToText(report);
    case 'json':
    default:
      return JSON.stringify(report, null, 2);
    }
  };

  const convertToCSV = (report) => {
    // Simple CSV conversion for basic metrics
    const rows = [
      ['Metric', 'Value'],
      ['Total Sessions', report.totalSessions],
      ['Total Words', report.totalWords],
      ['Total Characters', report.totalCharacters],
      ['Average Confidence', report.averageConfidence],
      ['Total Errors', report.totalErrors],
      ['Words per Minute', report.wordsPerMinute],
      ['Characters per Second', report.charactersPerSecond],
      ['Error Rate', report.errors?.errorRate || 0]
    ];

    return rows.map(row => row.join(',')).join('\n');
  };

  const convertToText = (report) => {
    return `
Speech Recognition Metrics Report
Generated: ${new Date(report.timestamp).toLocaleString()}

=== SUMMARY ===
Total Sessions: ${report.totalSessions}
Total Words: ${report.totalWords}
Total Characters: ${report.totalCharacters}
Average Confidence: ${report.averageConfidence}%
Total Errors: ${report.totalErrors}

=== PERFORMANCE ===
Words per Minute: ${report.wordsPerMinute}
Characters per Second: ${report.charactersPerSecond}
Average Response Time: ${report.performance?.averageResponseTime || 0}ms
Error Rate: ${report.errors?.errorRate || 0}%

=== AUDIO QUALITY ===
Average Volume Level: ${report.audio?.averageVolumeLevel || 0}
Average Signal Level: ${report.audio?.averageSignalLevel || 0}
Average SNR: ${report.audio?.averageSNR || 0}dB
    `.trim();
  };

  return {
    initializeMetrics,
    updateWordMetrics,
    updateProcessingTime,
    updateErrorMetrics,
    updateBackendUsage,
    updateLanguageDistribution,
    updateAudioMetrics,
    startSession,
    endSession,
    generateMetricsReport,
    resetMetrics,
    exportMetrics
  };
};
