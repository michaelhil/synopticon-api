/**
 * Conversation Analytics
 * Real-time conversation analysis and metrics
 * Following functional programming patterns with factory functions
 */

import {
  createSpeechEvent,
  createConversationContext
} from '../../core/configuration/types.ts';

// Import modular analytics components
import { createMetricsCalculator } from './analytics/metrics-calculator.js';
import { createTopicAnalyzer } from './analytics/topic-analyzer.js';
import { createInteractionAnalyzer } from './analytics/interaction-analyzer.js';
import { createQualityAssessor } from './analytics/quality-assessor.js';

// Conversation metrics factory
export const createConversationMetrics = (config = {}) => ({
  // Speaking time metrics
  speakingTime: {
    total: config.speakingTime?.total || 0,
    byParticipant: config.speakingTime?.byParticipant || new Map(),
    distribution: config.speakingTime?.distribution || {}
  },

  // Word count metrics
  wordCount: {
    total: config.wordCount?.total || 0,
    byParticipant: config.wordCount?.byParticipant || new Map(),
    averageWordsPerMinute: config.wordCount?.averageWordsPerMinute || 0,
    vocabulary: {
      unique: config.wordCount?.vocabulary?.unique || new Set(),
      repeated: config.wordCount?.vocabulary?.repeated || new Map()
    }
  },

  // Sentiment trends
  sentimentTrends: {
    overall: config.sentimentTrends?.overall || [],
    byParticipant: config.sentimentTrends?.byParticipant || new Map(),
    timeline: config.sentimentTrends?.timeline || [],
    averageSentiment: config.sentimentTrends?.averageSentiment || 0
  },

  // Topic analysis
  topics: {
    discovered: config.topics?.discovered || [],
    timeline: config.topics?.timeline || [],
    transitions: config.topics?.transitions || [],
    dominantTopics: config.topics?.dominantTopics || []
  },

  // Interaction patterns
  interactions: {
    turnTaking: config.interactions?.turnTaking || [],
    interruptions: config.interactions?.interruptions || 0,
    responseTimes: config.interactions?.responseTimes || [],
    engagement: config.interactions?.engagement || 'unknown'
  },

  // Conversation quality
  quality: {
    flow: config.quality?.flow || 0,
    coherence: config.quality?.coherence || 0,
    participation: config.quality?.participation || 0,
    overall: config.quality?.overall || 'unknown'
  },

  // Timestamps
  startTime: config.startTime || Date.now(),
  lastUpdate: config.lastUpdate || Date.now(),
  duration: config.duration || 0
});

// Conversation analytics engine factory
export const createConversationAnalytics = (config = {}) => {
  const state = {
    isInitialized: false,
    isAnalyzing: false,
    
    // Configuration
    config: {
      updateInterval: config.updateInterval || 5000, // 5 seconds
      sentimentWindow: config.sentimentWindow || 10, // Last 10 chunks
      topicThreshold: config.topicThreshold || 0.3,
      minWordCount: config.minWordCount || 5,
      ...config
    },

    // Analytics data
    metrics: createConversationMetrics(),
    rawData: {
      chunks: [],
      participants: new Map(),
      sessions: new Map()
    },

    // Processing state
    processingQueue: [],
    lastProcessed: 0,
    
    // Update timer
    updateTimer: null,

    // Callbacks
    callbacks: {
      onMetricsUpdate: [],
      onTopicDiscovered: [],
      onSentimentChange: [],
      onEngagementChange: [],
      onError: []
    }
  };

  // Create modular analytics components
  const metricsCalculator = createMetricsCalculator(state);
  const topicAnalyzer = createTopicAnalyzer(state);
  const interactionAnalyzer = createInteractionAnalyzer(state);
  const qualityAssessor = createQualityAssessor(state);

  // Initialize analytics engine
  const initialize = () => {
    if (state.isInitialized) {
      console.warn('Conversation analytics already initialized');
      return true;
    }

    console.log('📊 Initializing conversation analytics...');
    
    state.isInitialized = true;
    state.metrics.startTime = Date.now();
    
    console.log('✅ Conversation analytics initialized');
    return true;
  };

  // Start analytics processing
  const startAnalysis = () => {
    if (!state.isInitialized) {
      throw new Error('Analytics not initialized');
    }

    if (state.isAnalyzing) {
      console.warn('Analytics already running');
      return;
    }

    state.isAnalyzing = true;
    
    // Start periodic updates
    state.updateTimer = setInterval(() => {
      if (state.processingQueue.length > 0) {
        processQueue();
      }
      updateMetrics();
    }, state.config.updateInterval);

    console.log('📊 Conversation analytics started');
  };

  // Stop analytics processing
  const stopAnalysis = () => {
    if (!state.isAnalyzing) return;

    state.isAnalyzing = false;
    
    if (state.updateTimer) {
      clearInterval(state.updateTimer);
      state.updateTimer = null;
    }

    console.log('📊 Conversation analytics stopped');
  };

  // Add speech chunk for analysis
  const addChunk = (chunk, participantId = 'default', analysisResults = []) => {
    if (!state.isInitialized) {
      throw new Error('Analytics not initialized');
    }

    const enrichedChunk = {
      ...chunk,
      participantId,
      analysisResults,
      addedAt: Date.now()
    };

    // Add to raw data
    state.rawData.chunks.push(enrichedChunk);
    
    // Initialize participant if new
    if (!state.rawData.participants.has(participantId)) {
      state.rawData.participants.set(participantId, {
        id: participantId,
        chunks: [],
        totalWords: 0,
        totalTime: 0,
        sentimentHistory: [],
        topics: new Set()
      });
    }

    // Update participant data
    const participant = state.rawData.participants.get(participantId);
    participant.chunks.push(enrichedChunk);
    participant.totalWords += chunk.text.split(' ').length;
    
    // Add to processing queue
    state.processingQueue.push(enrichedChunk);

    console.log(`📊 Added chunk for participant ${participantId}: "${chunk.text.substring(0, 50)}..."`);
  };

  // Process queued chunks
  const processQueue = () => {
    const chunksToProcess = [...state.processingQueue];
    state.processingQueue = [];

    chunksToProcess.forEach(chunk => {
      processChunk(chunk);
    });

    state.lastProcessed = Date.now();
  };

  // Process individual chunk
  const processChunk = (chunk) => {
    try {
      // Update participant metrics using modular calculator
      metricsCalculator.updateParticipantMetrics(chunk.participantId, chunk);
      
    } catch (error) {
      console.warn('Error processing chunk:', error);
      notifyCallbacks('onError', { error: error.message, chunk });
    }
  };

  // Update all metrics
  const updateMetrics = () => {
    // Update duration
    state.metrics.duration = Date.now() - state.metrics.startTime;
    state.metrics.lastUpdate = Date.now();

    // Recalculate all metrics using modular components
    metricsCalculator.calculateSpeakingTimeMetrics();
    metricsCalculator.calculateWordCountMetrics();
    metricsCalculator.calculateSentimentTrends();
    topicAnalyzer.analyzeTopics();
    interactionAnalyzer.analyzeTurnTaking();
    
    // Update interaction engagement
    state.metrics.interactions.engagement = interactionAnalyzer.calculateEngagement();
    
    // Update quality metrics using modular assessor
    const qualityAssessment = qualityAssessor.getQualityAssessment();
    state.metrics.quality = {
      flow: qualityAssessment.flow.score / 100,
      coherence: qualityAssessment.coherence.score / 100,
      participation: qualityAssessment.participation.score / 100,
      overall: qualityAssessment.overall.rating
    };

    // Notify metrics update
    notifyCallbacks('onMetricsUpdate', state.metrics);
  };

  // Get current analytics data
  const getMetrics = () => ({
    ...state.metrics,
    // Convert Maps to Objects for serialization
    speakingTime: {
      ...state.metrics.speakingTime,
      byParticipant: Object.fromEntries(state.metrics.speakingTime.byParticipant)
    },
    wordCount: {
      ...state.metrics.wordCount,
      byParticipant: Object.fromEntries(state.metrics.wordCount.byParticipant),
      vocabulary: {
        unique: Array.from(state.metrics.wordCount.vocabulary.unique),
        repeated: Object.fromEntries(state.metrics.wordCount.vocabulary.repeated)
      }
    },
    sentimentTrends: {
      ...state.metrics.sentimentTrends,
      byParticipant: Object.fromEntries(state.metrics.sentimentTrends.byParticipant)
    }
  });

  // Get participant statistics using modular calculator
  const getParticipantStats = (participantId) => {
    return metricsCalculator.getParticipantStats(participantId);
  };

  // Get topic summary using modular analyzer
  const getTopicSummary = () => {
    return topicAnalyzer.getTopicSummary();
  };

  // Get interaction summary using modular analyzer
  const getInteractionSummary = () => {
    return interactionAnalyzer.getInteractionSummary();
  };

  // Get quality assessment using modular assessor
  const getQualityAssessment = () => {
    return qualityAssessor.getQualityAssessment();
  };

  // Helper functions
  const notifyCallbacks = (event, data) => {
    const callbacks = state.callbacks[event] || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Callback error for ${event}:`, error);
      }
    });
  };

  // Event handlers
  const onMetricsUpdate = (callback) => {
    state.callbacks.onMetricsUpdate.push(callback);
    return () => removeCallback('onMetricsUpdate', callback);
  };

  const onTopicDiscovered = (callback) => {
    state.callbacks.onTopicDiscovered.push(callback);
    return () => removeCallback('onTopicDiscovered', callback);
  };

  const onSentimentChange = (callback) => {
    state.callbacks.onSentimentChange.push(callback);
    return () => removeCallback('onSentimentChange', callback);
  };

  const onEngagementChange = (callback) => {
    state.callbacks.onEngagementChange.push(callback);
    return () => removeCallback('onEngagementChange', callback);
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => removeCallback('onError', callback);
  };

  const removeCallback = (event, callback) => {
    const callbacks = state.callbacks[event];
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    }
  };

  // Cleanup
  const cleanup = () => {
    stopAnalysis();
    
    // Clear all data
    state.rawData.chunks = [];
    state.rawData.participants.clear();
    state.rawData.sessions.clear();
    state.processingQueue = [];
    
    // Clear callbacks
    Object.keys(state.callbacks).forEach(event => {
      state.callbacks[event] = [];
    });
    
    state.isInitialized = false;
    console.log('🧹 Conversation analytics cleaned up');
  };

  return {
    // Core functionality
    initialize,
    startAnalysis,
    stopAnalysis,
    cleanup,
    
    // Data processing
    addChunk,
    
    // Data access - delegated to modular components
    getMetrics,
    getParticipantStats,
    getTopicSummary,
    getInteractionSummary,
    getQualityAssessment,
    
    // Event handlers
    onMetricsUpdate,
    onTopicDiscovered,
    onSentimentChange,
    onEngagementChange,
    onError,
    
    // Status
    isInitialized: () => state.isInitialized,
    isAnalyzing: () => state.isAnalyzing
  };
};

