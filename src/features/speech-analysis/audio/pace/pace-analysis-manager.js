/**
 * Pace Analysis Manager
 * Orchestrates speaking rate analysis and fluency analysis for comprehensive pace metrics
 */

import { createEnhancedMemoryPool } from '../../../shared/utils/enhanced-memory-pool.js';
import { createSpeakingRateAnalyzer } from './speaking-rate-analyzer.js';
import { createFluencyAnalyzer } from './fluency-analyzer.js';

export const createPaceAnalysisManager = (config = {}) => {
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
      const {category} = report.speakingRate;
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