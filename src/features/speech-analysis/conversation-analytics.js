/**
 * Conversation Analytics
 * Real-time conversation analysis and metrics
 * Following functional programming patterns with factory functions
 */

import {
  createSpeechEvent,
  createConversationContext
} from '../../core/types.js';

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
      // Update word count metrics
      updateWordCount(chunk);
      
      // Update speaking time metrics  
      updateSpeakingTime(chunk);
      
      // Analyze sentiment
      analyzeSentiment(chunk);
      
      // Extract topics
      extractTopics(chunk);
      
      // Analyze interaction patterns
      analyzeInteractions(chunk);

    } catch (error) {
      console.warn('Error processing chunk:', error);
      notifyCallbacks('onError', { error: error.message, chunk });
    }
  };

  // Update word count metrics
  const updateWordCount = (chunk) => {
    const words = chunk.text.trim().split(/\s+/).filter(word => word.length > 0);
    const participantId = chunk.participantId;

    // Update total word count
    state.metrics.wordCount.total += words.length;

    // Update participant word count
    if (!state.metrics.wordCount.byParticipant.has(participantId)) {
      state.metrics.wordCount.byParticipant.set(participantId, 0);
    }
    state.metrics.wordCount.byParticipant.set(
      participantId,
      state.metrics.wordCount.byParticipant.get(participantId) + words.length
    );

    // Update vocabulary
    words.forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleanWord.length > 2) {
        if (state.metrics.wordCount.vocabulary.unique.has(cleanWord)) {
          const count = state.metrics.wordCount.vocabulary.repeated.get(cleanWord) || 0;
          state.metrics.wordCount.vocabulary.repeated.set(cleanWord, count + 1);
        } else {
          state.metrics.wordCount.vocabulary.unique.add(cleanWord);
        }
      }
    });

    // Calculate words per minute
    const durationMinutes = (Date.now() - state.metrics.startTime) / (1000 * 60);
    state.metrics.wordCount.averageWordsPerMinute = 
      Math.round(state.metrics.wordCount.total / Math.max(durationMinutes, 0.1));
  };

  // Update speaking time metrics
  const updateSpeakingTime = (chunk) => {
    const participantId = chunk.participantId;
    const speakingDuration = chunk.duration || estimateSpeakingDuration(chunk.text);

    // Update total speaking time
    state.metrics.speakingTime.total += speakingDuration;

    // Update participant speaking time
    if (!state.metrics.speakingTime.byParticipant.has(participantId)) {
      state.metrics.speakingTime.byParticipant.set(participantId, 0);
    }
    state.metrics.speakingTime.byParticipant.set(
      participantId,
      state.metrics.speakingTime.byParticipant.get(participantId) + speakingDuration
    );

    // Update distribution
    const totalTime = state.metrics.speakingTime.total;
    const distribution = {};
    state.metrics.speakingTime.byParticipant.forEach((time, id) => {
      distribution[id] = Math.round((time / totalTime) * 100);
    });
    state.metrics.speakingTime.distribution = distribution;
  };

  // Estimate speaking duration from text
  const estimateSpeakingDuration = (text) => {
    // Average speaking rate: ~150 words per minute
    const words = text.trim().split(/\s+/).length;
    return (words / 150) * 60 * 1000; // Convert to milliseconds
  };

  // Analyze sentiment from chunk and analysis results
  const analyzeSentiment = (chunk) => {
    let sentimentScore = 0;
    let sentimentLabel = 'neutral';

    // Extract sentiment from analysis results
    const sentimentAnalysis = chunk.analysisResults?.find(result => 
      result.prompt.toLowerCase().includes('sentiment')
    );

    if (sentimentAnalysis && sentimentAnalysis.result) {
      sentimentScore = extractSentimentScore(sentimentAnalysis.result);
      sentimentLabel = extractSentimentLabel(sentimentAnalysis.result);
    } else {
      // Simple keyword-based sentiment analysis as fallback
      const sentiment = analyzeTextSentiment(chunk.text);
      sentimentScore = sentiment.score;
      sentimentLabel = sentiment.label;
    }

    const sentimentData = {
      score: sentimentScore,
      label: sentimentLabel,
      text: chunk.text.substring(0, 100),
      timestamp: chunk.timestamp,
      participantId: chunk.participantId
    };

    // Update overall sentiment
    state.metrics.sentimentTrends.overall.push(sentimentData);
    
    // Keep only recent sentiment data
    if (state.metrics.sentimentTrends.overall.length > state.config.sentimentWindow * 10) {
      state.metrics.sentimentTrends.overall = state.metrics.sentimentTrends.overall.slice(-state.config.sentimentWindow * 5);
    }

    // Update participant sentiment
    const participantId = chunk.participantId;
    if (!state.metrics.sentimentTrends.byParticipant.has(participantId)) {
      state.metrics.sentimentTrends.byParticipant.set(participantId, []);
    }
    state.metrics.sentimentTrends.byParticipant.get(participantId).push(sentimentData);

    // Update timeline
    state.metrics.sentimentTrends.timeline.push({
      timestamp: chunk.timestamp,
      score: sentimentScore,
      participantId
    });

    // Calculate average sentiment
    const recentSentiments = state.metrics.sentimentTrends.overall.slice(-state.config.sentimentWindow);
    state.metrics.sentimentTrends.averageSentiment = 
      recentSentiments.reduce((sum, s) => sum + s.score, 0) / Math.max(recentSentiments.length, 1);

    // Check for significant sentiment changes
    if (recentSentiments.length >= 3) {
      const currentAvg = recentSentiments.slice(-3).reduce((sum, s) => sum + s.score, 0) / 3;
      const previousAvg = recentSentiments.slice(-6, -3).reduce((sum, s) => sum + s.score, 0) / 3;
      
      if (Math.abs(currentAvg - previousAvg) > 0.3) {
        notifyCallbacks('onSentimentChange', {
          from: previousAvg,
          to: currentAvg,
          change: currentAvg - previousAvg,
          participant: participantId
        });
      }
    }
  };

  // Extract sentiment score from analysis result
  const extractSentimentScore = (result) => {
    const text = result.toLowerCase();
    
    // Look for explicit sentiment words and scores
    const positiveWords = ['positive', 'good', 'great', 'excellent', 'happy', 'joy', 'love', 'wonderful'];
    const negativeWords = ['negative', 'bad', 'terrible', 'sad', 'angry', 'hate', 'awful', 'horrible'];
    
    let score = 0;
    positiveWords.forEach(word => {
      if (text.includes(word)) score += 0.2;
    });
    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 0.2;
    });
    
    return Math.max(-1, Math.min(1, score));
  };

  // Extract sentiment label from analysis result
  const extractSentimentLabel = (result) => {
    const text = result.toLowerCase();
    
    if (text.includes('positive') || text.includes('good') || text.includes('happy')) {
      return 'positive';
    } else if (text.includes('negative') || text.includes('bad') || text.includes('sad')) {
      return 'negative';
    } else {
      return 'neutral';
    }
  };

  // Simple text-based sentiment analysis
  const analyzeTextSentiment = (text) => {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'like', 'happy', 'yes'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'horrible', 'no', 'wrong', 'problem'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const score = (positiveCount - negativeCount) / Math.max(words.length, 1);
    let label = 'neutral';
    
    if (score > 0.1) label = 'positive';
    else if (score < -0.1) label = 'negative';
    
    return { score: Math.max(-1, Math.min(1, score)), label };
  };

  // Extract topics from chunk
  const extractTopics = (chunk) => {
    const topics = extractTopicsFromText(chunk.text);
    const participantId = chunk.participantId;

    topics.forEach(topic => {
      // Check if topic already exists
      const existingTopic = state.metrics.topics.discovered.find(t => t.name === topic.name);
      
      if (existingTopic) {
        existingTopic.mentions++;
        existingTopic.lastMention = chunk.timestamp;
        existingTopic.participants.add(participantId);
      } else {
        const newTopic = {
          name: topic.name,
          confidence: topic.confidence,
          mentions: 1,
          firstMention: chunk.timestamp,
          lastMention: chunk.timestamp,
          participants: new Set([participantId]),
          keywords: topic.keywords
        };
        
        state.metrics.topics.discovered.push(newTopic);
        
        notifyCallbacks('onTopicDiscovered', {
          topic: newTopic,
          chunk: chunk.text.substring(0, 100)
        });
      }
    });

    // Update timeline
    if (topics.length > 0) {
      state.metrics.topics.timeline.push({
        timestamp: chunk.timestamp,
        topics: topics.map(t => t.name),
        participantId
      });
    }

    // Update dominant topics
    updateDominantTopics();
  };

  // Simple topic extraction from text
  const extractTopicsFromText = (text) => {
    const topicKeywords = {
      'business': ['business', 'company', 'revenue', 'profit', 'market', 'sales', 'client', 'customer'],
      'technology': ['technology', 'software', 'system', 'application', 'code', 'programming', 'computer'],
      'project': ['project', 'task', 'deadline', 'milestone', 'deliverable', 'requirements'],
      'meeting': ['meeting', 'agenda', 'discuss', 'presentation', 'decision', 'action'],
      'team': ['team', 'colleague', 'collaboration', 'together', 'group', 'member'],
      'problem': ['problem', 'issue', 'bug', 'error', 'fix', 'solution', 'trouble'],
      'planning': ['plan', 'strategy', 'goal', 'objective', 'future', 'roadmap', 'schedule']
    };

    const words = text.toLowerCase().split(/\s+/);
    const topics = [];

    Object.entries(topicKeywords).forEach(([topicName, keywords]) => {
      const matches = keywords.filter(keyword => 
        words.some(word => word.includes(keyword))
      );
      
      if (matches.length > 0) {
        const confidence = matches.length / keywords.length;
        if (confidence >= state.config.topicThreshold) {
          topics.push({
            name: topicName,
            confidence,
            keywords: matches
          });
        }
      }
    });

    return topics;
  };

  // Update dominant topics based on recent activity
  const updateDominantTopics = () => {
    const topicCounts = new Map();
    
    // Count recent topic mentions (last hour)
    const recentTimeline = state.metrics.topics.timeline.filter(
      entry => Date.now() - entry.timestamp < 3600000 // 1 hour
    );
    
    recentTimeline.forEach(entry => {
      entry.topics.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    // Sort by count and take top 5
    state.metrics.topics.dominantTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  };

  // Analyze interaction patterns
  const analyzeInteractions = (chunk) => {
    const participantId = chunk.participantId;
    
    // Track turn taking
    const lastEntry = state.metrics.interactions.turnTaking[state.metrics.interactions.turnTaking.length - 1];
    
    if (lastEntry && lastEntry.participant !== participantId) {
      // New speaker, calculate response time
      const responseTime = chunk.timestamp - lastEntry.endTime;
      state.metrics.interactions.responseTimes.push(responseTime);
      
      // Check for interruption (very short response time)
      if (responseTime < 1000) { // Less than 1 second
        state.metrics.interactions.interruptions++;
      }
    }

    // Add turn taking entry
    state.metrics.interactions.turnTaking.push({
      participant: participantId,
      startTime: chunk.timestamp,
      endTime: chunk.timestamp + (chunk.duration || estimateSpeakingDuration(chunk.text)),
      text: chunk.text.substring(0, 50)
    });

    // Keep turn taking history manageable
    if (state.metrics.interactions.turnTaking.length > 100) {
      state.metrics.interactions.turnTaking = state.metrics.interactions.turnTaking.slice(-50);
    }

    // Calculate engagement
    updateEngagement();
  };

  // Update engagement metrics
  const updateEngagement = () => {
    const participantCount = state.rawData.participants.size;
    const totalChunks = state.rawData.chunks.length;
    
    if (participantCount === 0 || totalChunks === 0) {
      state.metrics.interactions.engagement = 'unknown';
      return;
    }

    // Calculate participation balance
    const chunkCounts = Array.from(state.rawData.participants.values())
      .map(p => p.chunks.length);
    
    const avgChunks = chunkCounts.reduce((sum, count) => sum + count, 0) / chunkCounts.length;
    const variance = chunkCounts.reduce((sum, count) => sum + Math.pow(count - avgChunks, 2), 0) / chunkCounts.length;
    const balance = 1 - (Math.sqrt(variance) / avgChunks);

    // Determine engagement level
    if (balance > 0.8 && avgChunks > 5) {
      state.metrics.interactions.engagement = 'high';
    } else if (balance > 0.6 && avgChunks > 3) {
      state.metrics.interactions.engagement = 'medium';
    } else {
      state.metrics.interactions.engagement = 'low';
    }
  };

  // Update all metrics
  const updateMetrics = () => {
    // Update duration
    state.metrics.duration = Date.now() - state.metrics.startTime;
    state.metrics.lastUpdate = Date.now();

    // Calculate conversation quality
    updateConversationQuality();

    // Notify metrics update
    notifyCallbacks('onMetricsUpdate', state.metrics);
  };

  // Update conversation quality metrics
  const updateConversationQuality = () => {
    // Flow: based on turn-taking smoothness
    const avgResponseTime = state.metrics.interactions.responseTimes.length > 0
      ? state.metrics.interactions.responseTimes.reduce((sum, time) => sum + time, 0) / state.metrics.interactions.responseTimes.length
      : 0;
    
    const flow = Math.max(0, 1 - (avgResponseTime / 10000)); // Normalize to 0-1

    // Coherence: based on topic consistency
    const coherence = state.metrics.topics.discovered.length > 0 
      ? Math.min(1, state.metrics.topics.dominantTopics.reduce((sum, topic) => sum + topic.count, 0) / Math.max(state.rawData.chunks.length, 1))
      : 0;

    // Participation: based on engagement
    const participation = state.metrics.interactions.engagement === 'high' ? 0.9 :
                         state.metrics.interactions.engagement === 'medium' ? 0.6 :
                         state.metrics.interactions.engagement === 'low' ? 0.3 : 0;

    // Overall quality
    const overall = (flow + coherence + participation) / 3;
    const overallLabel = overall > 0.7 ? 'excellent' :
                        overall > 0.5 ? 'good' :
                        overall > 0.3 ? 'fair' : 'poor';

    state.metrics.quality = {
      flow: Math.round(flow * 100) / 100,
      coherence: Math.round(coherence * 100) / 100,
      participation: Math.round(participation * 100) / 100,
      overall: overallLabel
    };
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
        unique: state.metrics.wordCount.vocabulary.unique.size,
        repeated: Object.fromEntries(state.metrics.wordCount.vocabulary.repeated)
      }
    },
    sentimentTrends: {
      ...state.metrics.sentimentTrends,
      byParticipant: Object.fromEntries(state.metrics.sentimentTrends.byParticipant)
    }
  });

  // Get summary report
  const getSummary = () => {
    const metrics = getMetrics();
    const participants = Array.from(state.rawData.participants.keys());
    
    return {
      overview: {
        duration: Math.round(metrics.duration / 1000), // seconds
        participants: participants.length,
        totalWords: metrics.wordCount.total,
        averageWPM: metrics.wordCount.averageWordsPerMinute,
        overallSentiment: metrics.sentimentTrends.averageSentiment,
        conversationQuality: metrics.quality.overall
      },
      
      participation: {
        speakingDistribution: metrics.speakingTime.distribution,
        mostActive: participants.length > 0 ? 
          Array.from(state.metrics.wordCount.byParticipant.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] : null,
        engagement: metrics.interactions.engagement
      },
      
      topics: {
        discovered: metrics.topics.discovered.length,
        dominant: metrics.topics.dominantTopics.slice(0, 3),
        topicTransitions: metrics.topics.timeline.length
      },
      
      sentiment: {
        overall: metrics.sentimentTrends.averageSentiment > 0.1 ? 'positive' :
                metrics.sentimentTrends.averageSentiment < -0.1 ? 'negative' : 'neutral',
        stability: calculateSentimentStability()
      },
      
      interactions: {
        turnChanges: metrics.interactions.turnTaking.length,
        interruptions: metrics.interactions.interruptions,
        averageResponseTime: metrics.interactions.responseTimes.length > 0
          ? Math.round(metrics.interactions.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.interactions.responseTimes.length)
          : 0
      }
    };
  };

  // Calculate sentiment stability
  const calculateSentimentStability = () => {
    const sentiments = state.metrics.sentimentTrends.overall.slice(-20).map(s => s.score);
    if (sentiments.length < 2) return 'unknown';
    
    const variance = sentiments.reduce((sum, score, i) => {
      if (i === 0) return 0;
      return sum + Math.pow(score - sentiments[i - 1], 2);
    }, 0) / (sentiments.length - 1);
    
    return variance < 0.1 ? 'stable' : variance < 0.3 ? 'moderate' : 'volatile';
  };

  // Reset analytics
  const reset = () => {
    state.metrics = createConversationMetrics();
    state.rawData = {
      chunks: [],
      participants: new Map(),
      sessions: new Map()
    };
    state.processingQueue = [];
    state.lastProcessed = 0;
    
    console.log('📊 Conversation analytics reset');
  };

  // Cleanup resources
  const cleanup = () => {
    stopAnalysis();
    reset();
    state.isInitialized = false;
    console.log('🧹 Conversation analytics cleaned up');
  };

  // Event subscription methods
  const onMetricsUpdate = (callback) => subscribeCallback('onMetricsUpdate', callback);
  const onTopicDiscovered = (callback) => subscribeCallback('onTopicDiscovered', callback);
  const onSentimentChange = (callback) => subscribeCallback('onSentimentChange', callback);
  const onEngagementChange = (callback) => subscribeCallback('onEngagementChange', callback);
  const onError = (callback) => subscribeCallback('onError', callback);

  // Helper functions
  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  const notifyCallbacks = (eventType, data) => {
    state.callbacks[eventType].forEach(callback => {
      try {
        callback(createSpeechEvent({
          type: eventType,
          data,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn(`Analytics ${eventType} callback error:`, error);
      }
    });
  };

  return {
    // Core functionality
    initialize,
    startAnalysis,
    stopAnalysis,
    addChunk,
    reset,
    cleanup,

    // Status
    isInitialized: () => state.isInitialized,
    isAnalyzing: () => state.isAnalyzing,

    // Data access
    getMetrics,
    getSummary,
    getRawData: () => ({
      chunks: [...state.rawData.chunks],
      participants: Object.fromEntries(state.rawData.participants),
      sessions: Object.fromEntries(state.rawData.sessions)
    }),

    // Event handlers
    onMetricsUpdate,
    onTopicDiscovered,
    onSentimentChange,
    onEngagementChange,
    onError,

    // Configuration
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
    },
    getConfig: () => ({ ...state.config })
  };
};

// Export metrics factory for external use
// Export conversation metrics factory (already exported above as const)