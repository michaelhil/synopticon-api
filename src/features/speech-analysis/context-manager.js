/**
 * Conversation Context Manager
 * Manages conversation state, rolling summaries, and context windows
 * Following functional programming patterns with factory functions
 */

import { createLLMClient } from './llm-client.js';
import {
  createConversationContext,
  createSpeechChunk,
  createSpeechEvent
} from '../../core/types.js';

// Context management strategies
const CONTEXT_STRATEGIES = {
  rolling_window: {
    name: 'Rolling Window',
    description: 'Keep N most recent chunks in context'
  },
  summary_based: {
    name: 'Summary Based',
    description: 'Summarize old chunks, keep recent ones'
  },
  hybrid: {
    name: 'Hybrid',
    description: 'Combine summaries with rolling window'
  }
};

// Create context manager factory
export const createContextManager = (config = {}) => {
  const state = {
    llmClient: null,
    isInitialized: false,
    
    // Context configuration
    strategy: config.strategy || 'hybrid',
    maxChunks: config.maxChunks || 10,
    summaryThreshold: config.summaryThreshold || 20,
    maxSummaryLength: config.maxSummaryLength || 500,
    contextWindowSize: config.contextWindowSize || 2000, // characters
    
    // Enhanced intelligence configuration
    enableSemanticSearch: config.enableSemanticSearch !== false,
    enableTopicModeling: config.enableTopicModeling !== false,
    topicSimilarityThreshold: config.topicSimilarityThreshold || 0.7,
    maxTopics: config.maxTopics || 5,
    
    // Semantic search state
    semanticIndex: new Map(), // contextId -> semantic vectors/embeddings
    topicModel: new Map(), // contextId -> topic distribution
    keywordIndex: new Map(), // contextId -> keyword frequency map
    
    // Active contexts (supports multiple sessions)
    activeContexts: new Map(),
    defaultContextId: null,
    
    // Performance metrics
    metrics: {
      totalSessions: 0,
      totalChunks: 0,
      totalSummaries: 0,
      averageSummaryTime: 0,
      contextSwitches: 0
    },

    // Event callbacks
    callbacks: {
      onContextCreated: [],
      onContextUpdated: [],
      onSummaryGenerated: [],
      onContextCleared: [],
      onError: []
    }
  };

  // Initialize the context manager
  const initialize = async (llmConfig = {}) => {
    if (state.isInitialized) {
      console.warn('Context manager already initialized');
      return true;
    }

    console.log('🔄 Initializing context manager...');

    try {
      // Initialize LLM client for summary generation
      state.llmClient = createLLMClient({
        ...llmConfig,
        maxTokens: 200, // Shorter summaries
        temperature: 0.3 // More consistent summaries
      });

      await state.llmClient.initialize();

      // Setup LLM event handlers
      state.llmClient.onError((error) => {
        notifyCallbacks('onError', createSpeechEvent({
          type: 'context_llm_error',
          data: { error: error.message },
          severity: 'error'
        }));
      });

      // Create default context
      state.defaultContextId = await createContext('default');

      state.isInitialized = true;
      console.log('✅ Context manager initialized successfully');
      return true;

    } catch (error) {
      console.error('Context manager initialization failed:', error);
      throw new Error(`Context manager initialization failed: ${error.message}`);
    }
  };

  // Create a new conversation context
  const createContext = async (sessionId = null) => {
    const contextId = sessionId || `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (state.activeContexts.has(contextId)) {
      console.warn(`Context ${contextId} already exists`);
      return contextId;
    }

    const context = createConversationContext({
      sessionId: contextId,
      contextId,
      maxChunks: state.maxChunks,
      summaryThreshold: state.summaryThreshold
    });

    state.activeContexts.set(contextId, context);
    state.metrics.totalSessions++;

    console.log(`📝 Created new context: ${contextId}`);

    // Notify context creation
    notifyCallbacks('onContextCreated', createSpeechEvent({
      type: 'context_created',
      data: { contextId, strategy: state.strategy }
    }));

    return contextId;
  };

  // Add a speech chunk to context
  const addChunk = async (text, contextId = null, options = {}) => {
    const targetContextId = contextId || state.defaultContextId;
    
    if (!targetContextId || !state.activeContexts.has(targetContextId)) {
      throw new Error(`Context ${targetContextId} not found`);
    }

    const context = state.activeContexts.get(targetContextId);
    const chunk = createSpeechChunk({
      chunkId: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      index: context.totalChunks,
      text: text.trim(),
      confidence: options.confidence || 0.9,
      timestamp: Date.now(),
      duration: options.duration || 0,
      volume: options.volume || 0,
      pitch: options.pitch || null
    });

    // Add chunk to context
    context.chunks.push(chunk);
    context.totalChunks++;
    context.totalWords += text.trim().split(' ').length;
    context.lastUpdate = Date.now();

    // Update average confidence
    const totalConfidence = context.chunks.reduce((sum, c) => sum + c.confidence, 0);
    context.averageConfidence = totalConfidence / context.chunks.length;

    state.metrics.totalChunks++;

    console.log(`📝 Added chunk ${chunk.chunkId} to context ${targetContextId}`);

    // Check if we need to manage context size
    await manageContextSize(targetContextId);

    // Notify context update
    notifyCallbacks('onContextUpdated', createSpeechEvent({
      type: 'context_updated',
      data: { 
        contextId: targetContextId,
        chunkId: chunk.chunkId,
        totalChunks: context.totalChunks,
        contextSize: getContextSize(targetContextId)
      }
    }));

    return chunk.chunkId;
  };

  // Get context for analysis (formatted for LLM)
  const getContext = (contextId = null) => {
    const targetContextId = contextId || state.defaultContextId;
    
    if (!targetContextId || !state.activeContexts.has(targetContextId)) {
      return '';
    }

    const context = state.activeContexts.get(targetContextId);
    
    switch (state.strategy) {
      case 'rolling_window':
        return buildRollingWindowContext(context);
      case 'summary_based':
        return buildSummaryBasedContext(context);
      case 'hybrid':
      default:
        return buildHybridContext(context);
    }
  };

  // Get structured context data
  const getContextData = (contextId = null) => {
    const targetContextId = contextId || state.defaultContextId;
    
    if (!targetContextId || !state.activeContexts.has(targetContextId)) {
      return null;
    }

    const context = state.activeContexts.get(targetContextId);
    
    return {
      ...context,
      chunks: [...context.chunks], // Create shallow copy
      contextSize: getContextSize(targetContextId),
      formattedContext: getContext(targetContextId)
    };
  };

  // Force summary generation
  const generateSummary = async (contextId = null) => {
    const targetContextId = contextId || state.defaultContextId;
    
    if (!targetContextId || !state.activeContexts.has(targetContextId)) {
      throw new Error(`Context ${targetContextId} not found`);
    }

    const context = state.activeContexts.get(targetContextId);
    
    if (context.chunks.length < 3) {
      console.warn('Not enough chunks for meaningful summary');
      return context.summary;
    }

    console.log(`📋 Generating summary for context ${targetContextId}...`);
    const startTime = performance.now();

    try {
      // Determine chunks to summarize
      const chunksToSummarize = context.chunks.slice(0, -state.maxChunks);
      const textsToSummarize = chunksToSummarize.map(chunk => chunk.text);

      if (textsToSummarize.length === 0) {
        return context.summary;
      }

      // Generate summary using LLM
      const newSummary = await state.llmClient.generateSummary(
        textsToSummarize,
        context.summary
      );

      // Update context
      context.summary = newSummary.substring(0, state.maxSummaryLength);
      context.chunks = context.chunks.slice(-state.maxChunks); // Keep only recent chunks
      context.lastUpdate = Date.now();

      // Update metrics
      const summaryTime = performance.now() - startTime;
      state.metrics.totalSummaries++;
      state.metrics.averageSummaryTime = 
        (state.metrics.averageSummaryTime * (state.metrics.totalSummaries - 1) + summaryTime) / 
        state.metrics.totalSummaries;

      console.log(`✅ Summary generated in ${summaryTime.toFixed(2)}ms: "${newSummary.substring(0, 100)}..."`);

      // Notify summary generation
      notifyCallbacks('onSummaryGenerated', createSpeechEvent({
        type: 'summary_generated',
        data: { 
          contextId: targetContextId,
          summaryLength: newSummary.length,
          chunksProcessed: textsToSummarize.length,
          processingTime: summaryTime.toFixed(2)
        }
      }));

      return context.summary;

    } catch (error) {
      console.error('Summary generation failed:', error);
      
      // Notify error
      notifyCallbacks('onError', createSpeechEvent({
        type: 'summary_generation_error',
        data: { contextId: targetContextId, error: error.message },
        severity: 'error'
      }));

      throw error;
    }
  };

  // Clear context
  const clearContext = (contextId = null) => {
    const targetContextId = contextId || state.defaultContextId;
    
    if (!targetContextId || !state.activeContexts.has(targetContextId)) {
      console.warn(`Context ${targetContextId} not found`);
      return false;
    }

    const context = state.activeContexts.get(targetContextId);
    context.chunks = [];
    context.summary = '';
    context.totalChunks = 0;
    context.totalWords = 0;
    context.averageConfidence = 0;
    context.lastUpdate = Date.now();

    console.log(`🧹 Cleared context ${targetContextId}`);

    // Notify context clear
    notifyCallbacks('onContextCleared', createSpeechEvent({
      type: 'context_cleared',
      data: { contextId: targetContextId }
    }));

    return true;
  };

  // Remove context entirely
  const removeContext = (contextId) => {
    if (!contextId || !state.activeContexts.has(contextId)) {
      console.warn(`Context ${contextId} not found`);
      return false;
    }

    if (contextId === state.defaultContextId) {
      console.warn('Cannot remove default context, clearing instead');
      return clearContext(contextId);
    }

    state.activeContexts.delete(contextId);
    console.log(`🗑️ Removed context ${contextId}`);
    
    return true;
  };

  // Switch active default context
  const switchContext = (contextId) => {
    if (!contextId || !state.activeContexts.has(contextId)) {
      throw new Error(`Context ${contextId} not found`);
    }

    const oldContextId = state.defaultContextId;
    state.defaultContextId = contextId;
    state.metrics.contextSwitches++;

    console.log(`🔄 Switched context: ${oldContextId} → ${contextId}`);
    return true;
  };

  // Get all active contexts
  const getActiveContexts = () => {
    return Array.from(state.activeContexts.keys()).map(contextId => ({
      contextId,
      isDefault: contextId === state.defaultContextId,
      chunkCount: state.activeContexts.get(contextId).chunks.length,
      totalChunks: state.activeContexts.get(contextId).totalChunks,
      lastUpdate: state.activeContexts.get(contextId).lastUpdate,
      summaryLength: state.activeContexts.get(contextId).summary.length
    }));
  };

  // Enhanced semantic search capabilities
  const semanticSearch = async (query, contextId = null, options = {}) => {
    if (!state.enableSemanticSearch) {
      throw new Error('Semantic search is disabled');
    }

    const targetContextId = contextId || state.defaultContextId;
    const context = state.activeContexts.get(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    try {
      console.log(`🔍 Performing semantic search for: "${query.substring(0, 50)}..."`);
      
      // Simple semantic search using keyword matching and TF-IDF-like scoring
      const results = await performSemanticMatching(query, context, options);
      
      return {
        query,
        contextId: targetContextId,
        results,
        totalMatches: results.length,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  };

  // Perform semantic matching using keyword analysis and similarity
  const performSemanticMatching = async (query, context, options = {}) => {
    const queryKeywords = extractKeywords(query.toLowerCase());
    const results = [];
    
    // Score each chunk based on keyword overlap and context
    for (const chunk of context.chunks) {
      const chunkKeywords = extractKeywords(chunk.text.toLowerCase());
      const similarity = calculateSemanticSimilarity(queryKeywords, chunkKeywords, chunk.text, query);
      
      if (similarity.score > (options.threshold || 0.1)) {
        results.push({
          chunkId: chunk.chunkId,
          text: chunk.text,
          timestamp: chunk.timestamp,
          similarity: similarity.score,
          matchedKeywords: similarity.matches,
          contextSnippet: generateContextSnippet(chunk.text, queryKeywords),
          relevanceRanking: calculateRelevanceRanking(chunk, query, context)
        });
      }
    }

    // Sort by combined similarity and relevance score
    results.sort((a, b) => {
      const scoreA = (a.similarity * 0.7) + (a.relevanceRanking * 0.3);
      const scoreB = (b.similarity * 0.7) + (b.relevanceRanking * 0.3);
      return scoreB - scoreA;
    });

    return results.slice(0, options.maxResults || 10);
  };

  // Extract topic themes from conversation
  const extractTopics = async (contextId = null, options = {}) => {
    if (!state.enableTopicModeling) {
      throw new Error('Topic modeling is disabled');
    }

    const targetContextId = contextId || state.defaultContextId;
    const context = state.activeContexts.get(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    try {
      console.log(`📊 Extracting topics from context: ${targetContextId}`);
      
      // Simple topic extraction using keyword clustering and frequency analysis
      const topics = await performTopicExtraction(context, options);
      
      // Update topic model
      state.topicModel.set(targetContextId, {
        topics,
        timestamp: Date.now(),
        totalChunks: context.chunks.length
      });
      
      return {
        contextId: targetContextId,
        topics,
        totalChunks: context.chunks.length,
        extractionTime: Date.now()
      };

    } catch (error) {
      console.error('Topic extraction failed:', error);
      throw error;
    }
  };

  // Perform topic extraction using keyword clustering
  const performTopicExtraction = async (context, options = {}) => {
    const allText = context.chunks.map(c => c.text).join(' ');
    const keywords = extractKeywords(allText.toLowerCase());
    
    // Group keywords by semantic similarity
    const topicClusters = clusterKeywordsByTopic(keywords, allText);
    
    // Generate topic summaries using LLM
    const topics = [];
    for (const [topicName, keywordCluster] of Object.entries(topicClusters)) {
      if (keywordCluster.length < 2) continue; // Skip single-word topics
      
      try {
        const topicSummary = await generateTopicSummary(topicName, keywordCluster, context);
        topics.push({
          name: topicName,
          keywords: keywordCluster.slice(0, 10), // Top 10 keywords
          summary: topicSummary,
          frequency: keywordCluster.reduce((sum, kw) => sum + kw.frequency, 0),
          relevanceScore: calculateTopicRelevance(keywordCluster, context),
          chunks: findTopicChunks(keywordCluster, context.chunks)
        });
      } catch (error) {
        console.warn(`Failed to generate summary for topic '${topicName}':`, error);
        // Add topic without LLM-generated summary
        topics.push({
          name: topicName,
          keywords: keywordCluster.slice(0, 10),
          summary: `Topic focusing on: ${keywordCluster.slice(0, 3).map(kw => kw.word).join(', ')}`,
          frequency: keywordCluster.reduce((sum, kw) => sum + kw.frequency, 0),
          relevanceScore: calculateTopicRelevance(keywordCluster, context),
          chunks: findTopicChunks(keywordCluster, context.chunks)
        });
      }
    }

    // Sort by relevance and frequency
    topics.sort((a, b) => (b.relevanceScore * b.frequency) - (a.relevanceScore * a.frequency));
    
    return topics.slice(0, options.maxTopics || state.maxTopics);
  };

  // Find context chunks that are similar to query
  const findSimilarChunks = async (referenceText, contextId = null, options = {}) => {
    const targetContextId = contextId || state.defaultContextId;
    const context = state.activeContexts.get(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    const referenceKeywords = extractKeywords(referenceText.toLowerCase());
    const similarChunks = [];
    
    for (const chunk of context.chunks) {
      const chunkKeywords = extractKeywords(chunk.text.toLowerCase());
      const similarity = calculateSemanticSimilarity(referenceKeywords, chunkKeywords, chunk.text, referenceText);
      
      if (similarity.score > (options.threshold || 0.3)) {
        similarChunks.push({
          ...chunk,
          similarity: similarity.score,
          matchedKeywords: similarity.matches
        });
      }
    }

    similarChunks.sort((a, b) => b.similarity - a.similarity);
    return similarChunks.slice(0, options.maxResults || 5);
  };

  // Get topic evolution over time
  const getTopicEvolution = (contextId = null, options = {}) => {
    const targetContextId = contextId || state.defaultContextId;
    const context = state.activeContexts.get(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    const timeWindows = divideIntoTimeWindows(context.chunks, options.windowSize || 5);
    const evolution = [];
    
    for (const window of timeWindows) {
      const windowText = window.map(c => c.text).join(' ');
      const keywords = extractKeywords(windowText.toLowerCase());
      const topicClusters = clusterKeywordsByTopic(keywords, windowText);
      
      evolution.push({
        startTime: window[0].timestamp,
        endTime: window[window.length - 1].timestamp,
        chunkCount: window.length,
        topics: Object.keys(topicClusters).slice(0, 3), // Top 3 topics per window
        keywordDistribution: keywords.slice(0, 10) // Top 10 keywords per window
      });
    }
    
    return {
      contextId: targetContextId,
      evolution,
      totalWindows: evolution.length,
      analysisTime: Date.now()
    };
  };

  // Get manager status
  const getStatus = () => ({
    isInitialized: state.isInitialized,
    strategy: state.strategy,
    activeContextCount: state.activeContexts.size,
    defaultContextId: state.defaultContextId,
    configuration: {
      maxChunks: state.maxChunks,
      summaryThreshold: state.summaryThreshold,
      maxSummaryLength: state.maxSummaryLength,
      contextWindowSize: state.contextWindowSize,
      enableSemanticSearch: state.enableSemanticSearch,
      enableTopicModeling: state.enableTopicModeling
    },
    metrics: { ...state.metrics },
    llmStatus: state.llmClient ? state.llmClient.getStatus() : null,
    semanticIndexSize: state.semanticIndex.size,
    topicModelSize: state.topicModel.size
  });

  // Cleanup resources
  const cleanup = async () => {
    console.log('🧹 Cleaning up context manager...');

    if (state.llmClient) {
      await state.llmClient.cleanup();
      state.llmClient = null;
    }

    state.activeContexts.clear();
    state.defaultContextId = null;
    state.isInitialized = false;

    console.log('✅ Context manager cleanup complete');
  };

  // Private helper functions
  const manageContextSize = async (contextId) => {
    const context = state.activeContexts.get(contextId);
    
    // Check if we need to generate a summary
    if (context.totalChunks >= state.summaryThreshold && context.chunks.length > state.maxChunks) {
      try {
        await generateSummary(contextId);
      } catch (error) {
        console.warn('Automatic summary generation failed:', error.message);
        // Continue without summary - just trim chunks
        const excess = context.chunks.length - state.maxChunks;
        if (excess > 0) {
          context.chunks = context.chunks.slice(excess);
        }
      }
    }
  };

  const buildRollingWindowContext = (context) => {
    const recentChunks = context.chunks.slice(-state.maxChunks);
    if (recentChunks.length === 0) return '';
    
    return `Recent conversation:\n${recentChunks.map((chunk, i) => 
      `${i + 1}. ${chunk.text}`
    ).join('\n')}\n\n`;
  };

  const buildSummaryBasedContext = (context) => {
    let contextStr = '';
    
    if (context.summary) {
      contextStr += `Conversation summary:\n${context.summary}\n\n`;
    }
    
    // Add most recent chunk if available
    if (context.chunks.length > 0) {
      const lastChunk = context.chunks[context.chunks.length - 1];
      contextStr += `Current segment:\n${lastChunk.text}\n\n`;
    }
    
    return contextStr;
  };

  const buildHybridContext = (context) => {
    let contextStr = '';
    
    if (context.summary) {
      contextStr += `=== CONVERSATION CONTEXT ===\nPrevious conversation summary:\n${context.summary}\n\n`;
    }
    
    const recentChunks = context.chunks.slice(-Math.min(state.maxChunks, 5));
    if (recentChunks.length > 1) {
      contextStr += `Recent conversation segments:\n${recentChunks.slice(0, -1).map((chunk, i) => 
        `${i + 1}. ${chunk.text}`
      ).join('\n')}\n\n`;
    }
    
    if (contextStr) {
      contextStr += `=== END CONTEXT ===\n\n`;
    }
    
    return contextStr;
  };

  const getContextSize = (contextId) => {
    const context = state.activeContexts.get(contextId);
    if (!context) return 0;
    
    const summarySize = context.summary.length;
    const chunksSize = context.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
    return summarySize + chunksSize;
  };

  // Event subscription methods
  const onContextCreated = (callback) => subscribeCallback('onContextCreated', callback);
  const onContextUpdated = (callback) => subscribeCallback('onContextUpdated', callback);
  const onSummaryGenerated = (callback) => subscribeCallback('onSummaryGenerated', callback);
  const onContextCleared = (callback) => subscribeCallback('onContextCleared', callback);
  const onError = (callback) => subscribeCallback('onError', callback);

  // Helper functions
  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  const notifyCallbacks = (eventType, event) => {
    state.callbacks[eventType].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.warn(`Context manager ${eventType} callback error:`, error);
      }
    });
  };

  return {
    // Core functionality
    initialize,
    createContext,
    addChunk,
    getContext,
    getContextData,
    generateSummary,
    clearContext,
    removeContext,
    switchContext,
    cleanup,

    // Context management
    getActiveContexts,
    getDefaultContext: () => state.defaultContextId,
    
    // Status and configuration
    getStatus,
    isInitialized: () => state.isInitialized,
    getStrategy: () => state.strategy,
    
    // Configuration updates
    setMaxChunks: (maxChunks) => { state.maxChunks = maxChunks; },
    setSummaryThreshold: (threshold) => { state.summaryThreshold = threshold; },
    setStrategy: (strategy) => {
      if (CONTEXT_STRATEGIES[strategy]) {
        state.strategy = strategy;
        console.log(`🔄 Context strategy changed to: ${strategy}`);
      }
    },

    // Event handlers
    onContextCreated,
    onContextUpdated,
    onSummaryGenerated,
    onContextCleared,
    onError,

    // Utilities
    getMetrics: () => ({ ...state.metrics }),
    getSupportedStrategies: () => Object.keys(CONTEXT_STRATEGIES),
    getStrategyInfo: (strategy) => CONTEXT_STRATEGIES[strategy] || null,
    
    // Enhanced intelligence features
    semanticSearch,
    extractTopics,
    findSimilarChunks,
    getTopicEvolution,
    
    // Advanced features
    exportContext: (contextId) => {
      const context = state.activeContexts.get(contextId || state.defaultContextId);
      return context ? structuredClone(context) : null;
    },
    
    importContext: (contextData) => {
      if (!contextData || !contextData.contextId) {
        throw new Error('Invalid context data');
      }
      state.activeContexts.set(contextData.contextId, contextData);
      return contextData.contextId;
    }
  };

  // Helper functions for semantic search and topic modeling
  const extractKeywords = (text) => {
    // Simple keyword extraction using word frequency and filtering
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
      'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
      'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
      'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
      'because', 'any', 'these', 'give', 'day', 'most', 'us'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .map(([word, freq]) => ({ word, frequency: freq }))
      .sort((a, b) => b.frequency - a.frequency);
  };

  const calculateSemanticSimilarity = (queryKeywords, chunkKeywords, chunkText, query) => {
    const queryWords = queryKeywords.map(kw => kw.word);
    const chunkWords = chunkKeywords.map(kw => kw.word);
    
    // Calculate word overlap
    const matches = queryWords.filter(word => chunkWords.includes(word));
    const overlapScore = matches.length / Math.max(queryWords.length, 1);
    
    // Calculate position bonus (words appearing earlier get higher score)
    const positionBonus = matches.reduce((bonus, word) => {
      const position = chunkText.toLowerCase().indexOf(word);
      return bonus + (position === -1 ? 0 : Math.max(0, 1 - position / chunkText.length));
    }, 0) / Math.max(matches.length, 1);
    
    // Calculate frequency bonus
    const frequencyBonus = matches.reduce((bonus, word) => {
      const chunkKw = chunkKeywords.find(kw => kw.word === word);
      const queryKw = queryKeywords.find(kw => kw.word === word);
      return bonus + (chunkKw ? chunkKw.frequency * (queryKw ? queryKw.frequency : 1) : 0);
    }, 0) / Math.max(matches.length, 1);
    
    const score = (overlapScore * 0.5) + (positionBonus * 0.3) + (Math.min(frequencyBonus / 10, 1) * 0.2);
    
    return {
      score: Math.min(score, 1),
      matches,
      overlapScore,
      positionBonus,
      frequencyBonus
    };
  };

  const generateContextSnippet = (text, keywords) => {
    const keywordRegex = new RegExp(`\\b(${keywords.map(kw => kw.word).join('|')})\\b`, 'gi');
    const match = text.match(keywordRegex);
    
    if (!match) return text.substring(0, 100) + '...';
    
    const firstMatchIndex = text.search(keywordRegex);
    const start = Math.max(0, firstMatchIndex - 50);
    const end = Math.min(text.length, firstMatchIndex + 100);
    
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet.replace(keywordRegex, '**$1**');
  };

  const calculateRelevanceRanking = (chunk, query, context) => {
    // Simple relevance ranking based on recency and position
    const recencyScore = chunk.timestamp ? 
      (Date.now() - chunk.timestamp) / (1000 * 60 * 60) : 0; // Hours ago
    const positionScore = context.chunks.findIndex(c => c.chunkId === chunk.chunkId) / context.chunks.length;
    
    return Math.max(0, 1 - (recencyScore * 0.001)) * (1 - positionScore);
  };

  const clusterKeywordsByTopic = (keywords, fullText) => {
    // Simple topic clustering based on keyword co-occurrence and semantic grouping
    const topicClusters = {};
    
    // Group keywords by common themes
    const semanticGroups = {
      'technology': ['computer', 'software', 'system', 'data', 'digital', 'online', 'internet', 'app', 'platform', 'tech'],
      'business': ['company', 'market', 'customer', 'service', 'product', 'sales', 'revenue', 'profit', 'business', 'strategy'],
      'communication': ['talk', 'speak', 'discussion', 'meeting', 'conversation', 'message', 'email', 'call', 'chat', 'contact'],
      'development': ['project', 'build', 'create', 'develop', 'design', 'implement', 'feature', 'solution', 'improvement'],
      'analysis': ['data', 'analysis', 'report', 'metrics', 'results', 'statistics', 'performance', 'measure', 'evaluate'],
      'management': ['team', 'lead', 'manage', 'organize', 'plan', 'schedule', 'resource', 'process', 'workflow']
    };
    
    // Classify keywords into semantic groups
    for (const keyword of keywords) {
      let bestTopic = 'general';
      let bestScore = 0;
      
      for (const [topic, semanticWords] of Object.entries(semanticGroups)) {
        const score = semanticWords.filter(word => 
          keyword.word.includes(word) || word.includes(keyword.word)
        ).length;
        
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topic;
        }
      }
      
      if (!topicClusters[bestTopic]) {
        topicClusters[bestTopic] = [];
      }
      topicClusters[bestTopic].push(keyword);
    }
    
    // Filter out topics with too few keywords
    Object.keys(topicClusters).forEach(topic => {
      if (topicClusters[topic].length < 2) {
        delete topicClusters[topic];
      }
    });
    
    return topicClusters;
  };

  const generateTopicSummary = async (topicName, keywordCluster, context) => {
    const topKeywords = keywordCluster.slice(0, 5).map(kw => kw.word).join(', ');
    const prompt = `Summarize the topic "${topicName}" based on these key terms: ${topKeywords}. Keep it to one sentence.`;
    
    try {
      const summary = await state.llmClient.generate(prompt, {
        systemPrompt: 'You are a topic analysis assistant. Provide concise, informative topic summaries.',
        maxTokens: 50,
        temperature: 0.3
      });
      
      return summary.trim();
    } catch (error) {
      throw new Error(`Topic summary generation failed: ${error.message}`);
    }
  };

  const calculateTopicRelevance = (keywordCluster, context) => {
    // Calculate topic relevance based on keyword frequency and distribution
    const totalFrequency = keywordCluster.reduce((sum, kw) => sum + kw.frequency, 0);
    const totalWords = context.chunks.reduce((sum, chunk) => sum + chunk.text.split(' ').length, 0);
    
    const frequencyScore = totalFrequency / Math.max(totalWords, 1);
    const diversityScore = keywordCluster.length / Math.max(keywordCluster[0]?.frequency || 1, 1);
    
    return (frequencyScore * 0.7) + (Math.min(diversityScore, 1) * 0.3);
  };

  const findTopicChunks = (keywordCluster, chunks) => {
    const topicWords = keywordCluster.map(kw => kw.word);
    
    return chunks.filter(chunk => {
      const chunkWords = chunk.text.toLowerCase().split(/\s+/);
      const matches = topicWords.filter(word => chunkWords.includes(word));
      return matches.length >= Math.min(2, topicWords.length);
    }).map(chunk => ({
      chunkId: chunk.chunkId,
      timestamp: chunk.timestamp,
      excerpt: chunk.text.substring(0, 100) + (chunk.text.length > 100 ? '...' : '')
    }));
  };

  const divideIntoTimeWindows = (chunks, windowSize) => {
    const windows = [];
    for (let i = 0; i < chunks.length; i += windowSize) {
      windows.push(chunks.slice(i, i + windowSize));
    }
    return windows.filter(window => window.length > 0);
  };
};

// Context analysis utilities
export const analyzeContext = (context) => {
  if (!context || !context.chunks) {
    return { valid: false, error: 'Invalid context data' };
  }

  const totalWords = context.chunks.reduce((sum, chunk) => sum + chunk.text.split(' ').length, 0);
  const averageChunkLength = totalWords / context.chunks.length || 0;
  const timeSpan = context.chunks.length > 0 
    ? context.chunks[context.chunks.length - 1].timestamp - context.chunks[0].timestamp 
    : 0;

  return {
    valid: true,
    analysis: {
      chunkCount: context.chunks.length,
      totalWords,
      averageChunkLength: Math.round(averageChunkLength * 10) / 10,
      averageConfidence: Math.round(context.averageConfidence * 100) / 100,
      timeSpan,
      summaryLength: context.summary.length,
      contextRatio: context.summary.length / totalWords || 0
    }
  };
};

// Export context strategies
export { CONTEXT_STRATEGIES };

// Export default factory
// Export default factory (already exported above as const)