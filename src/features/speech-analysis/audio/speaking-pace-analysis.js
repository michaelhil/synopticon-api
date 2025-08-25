/**
 * Speaking Pace Analysis Module
 * Advanced speech rate, fluency, and articulation pattern analysis
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';

// Speaking rate calculation (Words Per Minute)
export const createSpeakingRateAnalyzer = (config = {}) => {
  const state = {
    config: {
      // Rate calculation parameters
      windowSize: config.windowSize || 10000, // ms
      minWordLength: config.minWordLength || 2,
      syllablePattern: config.syllablePattern || /[aeiouyAEIOUY]+/g,
      
      // Smoothing and adaptation
      smoothingFactor: config.smoothingFactor || 0.3,
      adaptiveWindow: config.adaptiveWindow !== false,
      
      // Rate categories (WPM ranges)
      rateCategories: config.rateCategories || {
        verySlow: [0, 80],
        slow: [80, 120],
        normal: [120, 160],
        fast: [160, 200],
        veryFast: [200, 300]
      }
    },
    
    // Speech tracking
    speechSegments: [],
    wordEvents: [],
    syllableEvents: [],
    
    // Current metrics
    currentRate: 0,
    smoothedRate: 0,
    
    // Statistics
    stats: {
      totalWords: 0,
      totalSyllables: 0,
      totalSpeechTime: 0,
      averageRate: 0,
      peakRate: 0,
      rateVariability: 0,
      rateDistribution: {}
    }
  };

  // Initialize rate distribution
  Object.keys(state.config.rateCategories).forEach(category => {
    state.stats.rateDistribution[category] = 0;
  });

  // Estimate syllable count from text
  const estimateSyllables = (word) => {
    if (!word || word.length < state.config.minWordLength) return 0;
    
    // Remove non-alphabetic characters
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length === 0) return 0;
    
    // Count vowel groups
    const syllables = cleanWord.match(state.config.syllablePattern) || [];
    let count = syllables.length;
    
    // Adjust for silent 'e'
    if (cleanWord.endsWith('e') && count > 1) {
      count--;
    }
    
    // Ensure at least one syllable
    return Math.max(1, count);
  };

  // Add speech segment with timing information
  const addSpeechSegment = (text, startTime, endTime, speakerId = null) => {
    if (!text || typeof text !== 'string') return;
    
    const words = text.trim().split(/\s+/).filter(word => 
      word.length >= state.config.minWordLength && /[a-zA-Z]/.test(word)
    );
    
    if (words.length === 0) return;
    
    const duration = endTime - startTime;
    const wordRate = words.length / (duration / 60000); // WPM
    
    // Calculate syllables
    const syllables = words.reduce((sum, word) => sum + estimateSyllables(word), 0);
    const syllableRate = syllables / (duration / 60000); // Syllables per minute
    
    const segment = {
      text,
      startTime,
      endTime,
      duration,
      wordCount: words.length,
      syllableCount: syllables,
      wordRate,
      syllableRate,
      speakerId,
      timestamp: Date.now()
    };
    
    // Add to tracking
    state.speechSegments.push(segment);
    
    // Add individual word events
    const wordDuration = duration / words.length;
    words.forEach((word, index) => {
      const wordTime = startTime + (index * wordDuration);
      state.wordEvents.push({
        word,
        time: wordTime,
        syllables: estimateSyllables(word),
        segmentIndex: state.speechSegments.length - 1
      });
      
      // Add syllable events
      const syllableCount = estimateSyllables(word);
      const syllableDuration = wordDuration / syllableCount;
      for (let s = 0; s < syllableCount; s++) {
        state.syllableEvents.push({
          time: wordTime + (s * syllableDuration),
          wordIndex: state.wordEvents.length - 1,
          syllableIndex: s
        });
      }
    });
    
    // Update current rates
    state.currentRate = wordRate;
    state.smoothedRate = state.smoothedRate === 0 ? wordRate :
      state.config.smoothingFactor * wordRate + (1 - state.config.smoothingFactor) * state.smoothedRate;
    
    // Update statistics
    state.stats.totalWords += words.length;
    state.stats.totalSyllables += syllables;
    state.stats.totalSpeechTime += duration;
    
    const overallRate = state.stats.totalWords / (state.stats.totalSpeechTime / 60000);
    state.stats.averageRate = overallRate;
    state.stats.peakRate = Math.max(state.stats.peakRate, wordRate);
    
    // Update rate distribution
    const category = categorizeRate(wordRate);
    if (category) {
      state.stats.rateDistribution[category]++;
    }
    
    return segment;
  };

  // Categorize speaking rate
  const categorizeRate = (rate) => {
    for (const [category, [min, max]] of Object.entries(state.config.rateCategories)) {
      if (rate >= min && rate < max) {
        return category;
      }
    }
    return null;
  };

  // Calculate rate variability over recent segments
  const calculateRateVariability = (timeWindow = state.config.windowSize) => {
    const cutoffTime = Date.now() - timeWindow;
    const recentSegments = state.speechSegments.filter(seg => seg.timestamp >= cutoffTime);
    
    if (recentSegments.length < 2) return 0;
    
    const rates = recentSegments.map(seg => seg.wordRate);
    const meanRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - meanRate, 2), 0) / rates.length;
    
    state.stats.rateVariability = Math.sqrt(variance);
    return state.stats.rateVariability;
  };

  // Get rate statistics over time window
  const getRateStats = (timeWindow = state.config.windowSize) => {
    const cutoffTime = Date.now() - timeWindow;
    const recentSegments = state.speechSegments.filter(seg => seg.timestamp >= cutoffTime);
    
    if (recentSegments.length === 0) {
      return {
        averageRate: 0,
        medianRate: 0,
        minRate: 0,
        maxRate: 0,
        variability: 0,
        segmentCount: 0
      };
    }
    
    const rates = recentSegments.map(seg => seg.wordRate).sort((a, b) => a - b);
    const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const medianRate = rates[Math.floor(rates.length / 2)];
    
    return {
      averageRate,
      medianRate,
      minRate: rates[0],
      maxRate: rates[rates.length - 1],
      variability: calculateRateVariability(timeWindow),
      segmentCount: recentSegments.length,
      category: categorizeRate(averageRate)
    };
  };

  return {
    addSpeechSegment,
    getCurrentRate: () => state.currentRate,
    getSmoothedRate: () => state.smoothedRate,
    getRateStats,
    calculateRateVariability,
    categorizeRate,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.speechSegments = [];
      state.wordEvents = [];
      state.syllableEvents = [];
      state.currentRate = 0;
      state.smoothedRate = 0;
      state.stats = {
        totalWords: 0,
        totalSyllables: 0,
        totalSpeechTime: 0,
        averageRate: 0,
        peakRate: 0,
        rateVariability: 0,
        rateDistribution: {}
      };
      Object.keys(state.config.rateCategories).forEach(category => {
        state.stats.rateDistribution[category] = 0;
      });
    }
  };
};

// Fluency analysis for hesitations, filler words, and speech flow
export const createFluencyAnalyzer = (config = {}) => {
  const state = {
    config: {
      // Filler word patterns
      fillerWords: config.fillerWords || [
        'um', 'uh', 'er', 'ah', 'like', 'you know', 'so', 'well',
        'actually', 'basically', 'literally', 'sort of', 'kind of'
      ],
      
      // Pause detection
      minPauseLength: config.minPauseLength || 200, // ms
      hesitationPauseLength: config.hesitationPauseLength || 500, // ms
      
      // Repetition detection
      repetitionWindow: config.repetitionWindow || 3, // words
      
      // Fluency scoring
      fluencyWeights: config.fluencyWeights || {
        fillers: 0.3,
        pauses: 0.3,
        repetitions: 0.2,
        flow: 0.2
      }
    },
    
    // Tracking arrays
    fillerEvents: [],
    pauseEvents: [],
    repetitionEvents: [],
    speechFlow: [],
    
    // Current state
    lastWordTime: null,
    recentWords: [],
    
    // Statistics
    stats: {
      totalFillers: 0,
      totalPauses: 0,
      totalRepetitions: 0,
      averagePauseLength: 0,
      fillerRate: 0, // fillers per minute
      fluencyScore: 100, // 0-100 scale
      speechFlowIndex: 0
    }
  };

  // Detect filler words in text
  const detectFillers = (text, timestamp) => {
    if (!text || typeof text !== 'string') return [];
    
    const words = text.toLowerCase().split(/\s+/);
    const fillers = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[.,!?;:]*/g, ''); // Remove punctuation
      
      // Check single word fillers
      if (state.config.fillerWords.includes(word)) {
        fillers.push({
          type: 'single',
          text: word,
          position: i,
          timestamp: timestamp + (i * 100) // Approximate timing
        });
      }
      
      // Check multi-word fillers
      if (i < words.length - 1) {
        const twoWordPhrase = `${word} ${words[i + 1].replace(/[.,!?;:]*/g, '')}`;
        if (state.config.fillerWords.includes(twoWordPhrase)) {
          fillers.push({
            type: 'phrase',
            text: twoWordPhrase,
            position: i,
            timestamp: timestamp + (i * 100)
          });
          i++; // Skip next word
        }
      }
    }
    
    // Add to tracking
    state.fillerEvents.push(...fillers);
    state.stats.totalFillers += fillers.length;
    
    return fillers;
  };

  // Detect repetitions in recent speech
  const detectRepetitions = (text, timestamp) => {
    if (!text || typeof text !== 'string') return [];
    
    const words = text.toLowerCase().split(/\s+/)
      .map(word => word.replace(/[.,!?;:]*/g, ''))
      .filter(word => word.length > 0);
    
    const repetitions = [];
    
    // Add new words to recent words buffer
    words.forEach(word => {
      state.recentWords.push({ word, time: timestamp });
    });
    
    // Maintain buffer size
    while (state.recentWords.length > state.config.repetitionWindow * 3) {
      state.recentWords.shift();
    }
    
    // Look for repetitions in recent window
    const recentWordTexts = state.recentWords.map(w => w.word);
    const wordCounts = {};
    
    recentWordTexts.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Find words that appear more than once
    for (const [word, count] of Object.entries(wordCounts)) {
      if (count > 1 && word.length > 2) { // Ignore short words
        repetitions.push({
          word,
          count,
          timestamp,
          severity: count > 2 ? 'high' : 'moderate'
        });
      }
    }
    
    // Add to tracking
    state.repetitionEvents.push(...repetitions);
    state.stats.totalRepetitions += repetitions.length;
    
    return repetitions;
  };

  // Add pause information
  const addPause = (startTime, endTime, type = 'normal') => {
    const duration = endTime - startTime;
    
    if (duration >= state.config.minPauseLength) {
      const pause = {
        startTime,
        endTime,
        duration,
        type: duration >= state.config.hesitationPauseLength ? 'hesitation' : type,
        timestamp: Date.now()
      };
      
      state.pauseEvents.push(pause);
      state.stats.totalPauses++;
      
      // Update average pause length
      const totalPauseDuration = state.pauseEvents.reduce((sum, p) => sum + p.duration, 0);
      state.stats.averagePauseLength = totalPauseDuration / state.pauseEvents.length;
      
      return pause;
    }
    
    return null;
  };

  // Calculate speech flow index
  const calculateSpeechFlow = (speechSegments, timeWindow = 30000) => {
    const cutoffTime = Date.now() - timeWindow;
    const recentSegments = speechSegments.filter(seg => seg.timestamp >= cutoffTime);
    
    if (recentSegments.length === 0) return 0;
    
    // Calculate flow based on segment continuity and duration
    let flowScore = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < recentSegments.length; i++) {
      const segment = recentSegments[i];
      totalDuration += segment.duration;
      
      // Base score from segment length (longer = better flow)
      const lengthScore = Math.min(1, segment.duration / 3000); // 3 seconds max
      
      // Penalty for very short segments (indicates choppy speech)
      const choppyPenalty = segment.duration < 1000 ? 0.5 : 1;
      
      // Bonus for consistent rate within segment
      const rateConsistency = segment.wordCount > 0 ? 
        Math.min(1, segment.wordRate / 150) : 0; // 150 WPM as reference
      
      flowScore += lengthScore * choppyPenalty * rateConsistency * segment.duration;
    }
    
    // Normalize by total duration
    const averageFlow = totalDuration > 0 ? flowScore / totalDuration : 0;
    state.stats.speechFlowIndex = Math.max(0, Math.min(1, averageFlow));
    
    return state.stats.speechFlowIndex;
  };

  // Calculate overall fluency score
  const calculateFluencyScore = (speechDuration = 0, timeWindow = 30000) => {
    if (speechDuration === 0) return state.stats.fluencyScore;
    
    const weights = state.config.fluencyWeights;
    const cutoffTime = Date.now() - timeWindow;
    
    // Filter events to time window
    const recentFillers = state.fillerEvents.filter(f => f.timestamp >= cutoffTime);
    const recentPauses = state.pauseEvents.filter(p => p.timestamp >= cutoffTime);
    const recentRepetitions = state.repetitionEvents.filter(r => r.timestamp >= cutoffTime);
    
    // Calculate component scores (0-100)
    const fillerScore = Math.max(0, 100 - (recentFillers.length / (speechDuration / 60000)) * 10);
    
    const hesitationPauses = recentPauses.filter(p => p.type === 'hesitation').length;
    const pauseScore = Math.max(0, 100 - (hesitationPauses / (speechDuration / 60000)) * 15);
    
    const repetitionScore = Math.max(0, 100 - recentRepetitions.length * 5);
    
    const flowScore = state.stats.speechFlowIndex * 100;
    
    // Weighted combination
    const fluencyScore = 
      (fillerScore * weights.fillers) +
      (pauseScore * weights.pauses) +
      (repetitionScore * weights.repetitions) +
      (flowScore * weights.flow);
    
    state.stats.fluencyScore = Math.max(0, Math.min(100, fluencyScore));
    
    // Update filler rate
    state.stats.fillerRate = speechDuration > 0 ? 
      (recentFillers.length / (speechDuration / 60000)) : 0;
    
    return {
      overall: state.stats.fluencyScore,
      components: {
        fillers: fillerScore,
        pauses: pauseScore,
        repetitions: repetitionScore,
        flow: flowScore
      },
      details: {
        fillerCount: recentFillers.length,
        hesitationPauses: hesitationPauses,
        repetitionCount: recentRepetitions.length,
        flowIndex: state.stats.speechFlowIndex
      }
    };
  };

  // Process speech segment for fluency analysis
  const processSegment = (text, startTime, endTime, speechSegments = []) => {
    const fillers = detectFillers(text, startTime);
    const repetitions = detectRepetitions(text, startTime);
    const speechFlow = calculateSpeechFlow(speechSegments);
    const fluency = calculateFluencyScore(endTime - startTime);
    
    return {
      fillers,
      repetitions,
      speechFlow,
      fluency,
      timestamp: Date.now()
    };
  };

  return {
    detectFillers,
    detectRepetitions,
    addPause,
    calculateSpeechFlow,
    calculateFluencyScore,
    processSegment,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.fillerEvents = [];
      state.pauseEvents = [];
      state.repetitionEvents = [];
      state.speechFlow = [];
      state.lastWordTime = null;
      state.recentWords = [];
      state.stats = {
        totalFillers: 0,
        totalPauses: 0,
        totalRepetitions: 0,
        averagePauseLength: 0,
        fillerRate: 0,
        fluencyScore: 100,
        speechFlowIndex: 0
      };
    }
  };
};

// Complete speaking pace analysis system
export const createSpeakingPaceAnalysis = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      // Processing parameters
      enableRateAnalysis: config.enableRateAnalysis !== false,
      enableFluencyAnalysis: config.enableFluencyAnalysis !== false,
      
      // Update intervals
      analysisInterval: config.analysisInterval || 1000, // ms
      reportingWindow: config.reportingWindow || 30000, // ms
      
      ...config
    },
    
    // Components
    rateAnalyzer: null,
    fluencyAnalyzer: null,
    
    // Processing state
    lastAnalysisTime: 0,
    isInitialized: false,
    
    // Statistics
    stats: {
      totalSegments: 0,
      totalAnalyses: 0,
      processingTime: 0
    }
  };

  // Initialize components
  const initialize = () => {
    if (state.config.enableRateAnalysis) {
      state.rateAnalyzer = createSpeakingRateAnalyzer(state.config.rate);
    }
    
    if (state.config.enableFluencyAnalysis) {
      state.fluencyAnalyzer = createFluencyAnalyzer(state.config.fluency);
    }
    
    state.isInitialized = true;
  };

  // Register pace analysis result type
  memoryPool.registerFactory('PaceAnalysisResult', () => ({
    _pooled: true,
    timestamp: 0,
    speakingRate: {
      current: 0,
      smoothed: 0,
      category: 'normal',
      variability: 0
    },
    fluency: {
      score: 100,
      fillerCount: 0,
      pauseCount: 0,
      repetitionCount: 0,
      flowIndex: 0
    },
    segment: null,
    processing: {
      rateAnalyzed: false,
      fluencyAnalyzed: false,
      processingTime: 0
    }
  }));

  // Process speech segment for pace analysis
  const processSegment = (text, startTime, endTime, speakerId = null) => {
    if (!state.isInitialized) {
      initialize();
    }
    
    const processingStart = performance.now();
    const timestamp = Date.now();
    
    // Skip too frequent updates
    if (timestamp - state.lastAnalysisTime < state.config.analysisInterval) {
      return null;
    }
    
    let rateResult = null;
    let fluencyResult = null;
    
    // Analyze speaking rate
    if (state.rateAnalyzer) {
      const segment = state.rateAnalyzer.addSpeechSegment(text, startTime, endTime, speakerId);
      if (segment) {
        rateResult = {
          current: segment.wordRate,
          smoothed: state.rateAnalyzer.getSmoothedRate(),
          category: state.rateAnalyzer.categorizeRate(segment.wordRate),
          variability: state.rateAnalyzer.calculateRateVariability()
        };
      }
    }
    
    // Analyze fluency
    if (state.fluencyAnalyzer) {
      const speechSegments = state.rateAnalyzer ? state.rateAnalyzer.getStats() : [];
      fluencyResult = state.fluencyAnalyzer.processSegment(text, startTime, endTime, speechSegments);
    }
    
    const processingTime = performance.now() - processingStart;
    
    // Update statistics
    state.stats.totalSegments++;
    state.stats.totalAnalyses++;
    state.stats.processingTime += processingTime;
    state.lastAnalysisTime = timestamp;
    
    // Create result if we have analysis data
    if (rateResult || fluencyResult) {
      const result = memoryPool.acquire('PaceAnalysisResult');
      
      result.timestamp = timestamp;
      
      if (rateResult) {
        result.speakingRate = rateResult;
      }
      
      if (fluencyResult) {
        result.fluency = {
          score: fluencyResult.fluency.overall,
          fillerCount: fluencyResult.fillers.length,
          pauseCount: fluencyResult.fluency.details.hesitationPauses || 0,
          repetitionCount: fluencyResult.repetitions.length,
          flowIndex: fluencyResult.speechFlow
        };
      }
      
      result.segment = {
        text,
        startTime,
        endTime,
        duration: endTime - startTime,
        speakerId
      };
      
      result.processing = {
        rateAnalyzed: rateResult !== null,
        fluencyAnalyzed: fluencyResult !== null,
        processingTime
      };
      
      return result;
    }
    
    return null;
  };

  // Add pause information (for fluency analysis)
  const addPause = (startTime, endTime, type = 'normal') => {
    if (!state.isInitialized) {
      initialize();
    }
    
    if (state.fluencyAnalyzer) {
      return state.fluencyAnalyzer.addPause(startTime, endTime, type);
    }
    
    return null;
  };

  // Release pace analysis result
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Get current pace metrics
  const getCurrentPaceMetrics = () => {
    const metrics = {};
    
    if (state.rateAnalyzer) {
      metrics.speakingRate = {
        current: state.rateAnalyzer.getCurrentRate(),
        smoothed: state.rateAnalyzer.getSmoothedRate(),
        stats: state.rateAnalyzer.getRateStats()
      };
    }
    
    if (state.fluencyAnalyzer) {
      metrics.fluency = {
        score: state.fluencyAnalyzer.getStats().fluencyScore,
        fillerRate: state.fluencyAnalyzer.getStats().fillerRate,
        flowIndex: state.fluencyAnalyzer.getStats().speechFlowIndex
      };
    }
    
    return metrics;
  };

  // Get comprehensive analysis report
  const getAnalysisReport = (timeWindow = state.config.reportingWindow) => {
    const report = {
      timeWindow,
      timestamp: Date.now(),
      speakingRate: null,
      fluency: null,
      summary: null
    };
    
    if (state.rateAnalyzer) {
      const rateStats = state.rateAnalyzer.getRateStats(timeWindow);
      report.speakingRate = {
        ...rateStats,
        overall: state.rateAnalyzer.getStats()
      };
    }
    
    if (state.fluencyAnalyzer) {
      const fluencyStats = state.fluencyAnalyzer.getStats();
      report.fluency = {
        score: fluencyStats.fluencyScore,
        components: {
          fillers: fluencyStats.totalFillers,
          pauses: fluencyStats.totalPauses,
          repetitions: fluencyStats.totalRepetitions,
          flow: fluencyStats.speechFlowIndex
        },
        rates: {
          filler: fluencyStats.fillerRate,
          averagePause: fluencyStats.averagePauseLength
        }
      };
    }
    
    // Generate summary
    report.summary = generateSummary(report);
    
    return report;
  };

  // Generate human-readable summary
  const generateSummary = (report) => {
    const insights = [];
    
    if (report.speakingRate) {
      const rate = report.speakingRate.averageRate;
      const category = report.speakingRate.category;
      insights.push(`Speaking rate: ${Math.round(rate)} WPM (${category})`);
      
      if (report.speakingRate.variability > 30) {
        insights.push('High rate variability detected');
      }
    }
    
    if (report.fluency) {
      const score = Math.round(report.fluency.score);
      insights.push(`Fluency score: ${score}/100`);
      
      if (report.fluency.rates.filler > 5) {
        insights.push('High filler word usage');
      }
      
      if (report.fluency.components.flow < 0.7) {
        insights.push('Choppy speech flow detected');
      }
    }
    
    return insights;
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    averageProcessingTime: state.stats.totalSegments > 0 ? 
      state.stats.processingTime / state.stats.totalSegments : 0,
    components: {
      rate: state.rateAnalyzer ? state.rateAnalyzer.getStats() : null,
      fluency: state.fluencyAnalyzer ? state.fluencyAnalyzer.getStats() : null
    },
    memoryPool: memoryPool.getStats()
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (newConfig.rate && state.rateAnalyzer) {
      state.rateAnalyzer.updateConfig(newConfig.rate);
    }
    if (newConfig.fluency && state.fluencyAnalyzer) {
      state.fluencyAnalyzer.updateConfig(newConfig.fluency);
    }
  };

  // Reset analysis system
  const reset = () => {
    if (state.rateAnalyzer) state.rateAnalyzer.reset();
    if (state.fluencyAnalyzer) state.fluencyAnalyzer.reset();
    
    state.lastAnalysisTime = 0;
    state.stats = {
      totalSegments: 0,
      totalAnalyses: 0,
      processingTime: 0
    };
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    processSegment,
    addPause,
    releaseResult,
    getCurrentPaceMetrics,
    getAnalysisReport,
    getStats,
    updateConfig,
    reset,
    cleanup,
    isInitialized: () => state.isInitialized
  };
};