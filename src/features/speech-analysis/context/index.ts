/**
 * Context Management System - Main Factory
 * Modular architecture assembling semantic search, topic modeling, and summarization
 */

import { createLLMClient } from '../llm-client.js';
import {
  createConversationContext,
  createSpeechChunk,
  createSpeechEvent
} from '../../../core/configuration/types.ts';

import {
  type BaseContextManager,
  type ConversationContext,
  type ContextChunk,
  type ContextManagerConfiguration,
  type ContextMetrics,
  type ContextEvent,
  type ContextEventCallback,
  type ContextEventSubscription,
  ContextStrategy,
  CONTEXT_STRATEGIES,
  createDefaultContextConfiguration,
  createEmptyMetrics,
  validateContextChunk,
  validateConversationContext,
  createContextEvent
} from './base-context-manager.ts';

import { 
  createSemanticSearchEngine,
  type SemanticSearchEngine,
  type SemanticSearchOptions,
  type SemanticSearchResult
} from './semantic-search-engine.ts';

import {
  createTopicModelingEngine,
  type TopicModelingEngine,
  type TopicCluster,
  type TopicExtractionResult,
  type TopicEvolutionResult,
  type TopicModelingOptions
} from './topic-modeling-engine.ts';

import {
  createContextSummarizationEngine,
  type ContextSummarizationEngine,
  type SummarizationOptions,
  type SummaryResult
} from './context-summarization-engine.ts';

export interface ContextManagerState {
  llmClient: any;
  isInitialized: boolean;
  configuration: ContextManagerConfiguration;
  activeContexts: Map<string, ConversationContext>;
  defaultContextId: string | null;
  metrics: ContextMetrics;
  callbacks: Record<string, ContextEventCallback[]>;
  semanticIndex: Map<string, any>;
  topicModel: Map<string, any>;
  keywordIndex: Map<string, any>;
}

export interface ExtendedContextManager extends BaseContextManager {
  // Semantic search functionality
  semanticSearch: (query: string, contextId?: string, options?: SemanticSearchOptions) => Promise<SemanticSearchResult>;
  findSimilarChunks: (referenceText: string, contextId?: string, options?: SemanticSearchOptions) => Promise<any[]>;

  // Topic modeling functionality
  extractTopics: (contextId?: string, options?: TopicModelingOptions) => Promise<TopicExtractionResult>;
  getTopicEvolution: (contextId?: string, options?: TopicModelingOptions) => Promise<TopicEvolutionResult>;

  // Enhanced context management
  getAnalysisHistory: (sessionId?: string) => Promise<any[]>;
  clearSession: (sessionId?: string) => Promise<void>;

  // Advanced access
  updateConfiguration: (newConfig: Partial<ContextManagerConfiguration>) => void;
  switchContext: (contextId: string) => boolean;
  getContextList: () => string[];
}

/**
 * Creates a modular context manager with semantic search, topic modeling, and intelligent summarization
 */
export const createContextManager = (config: Partial<ContextManagerConfiguration> = {}): ExtendedContextManager => {
  const configuration = createDefaultContextConfiguration(config);
  
  // Create modular engines
  const semanticSearchEngine = createSemanticSearchEngine();
  const topicModelingEngine = createTopicModelingEngine();
  const summarizationEngine = createContextSummarizationEngine();

  // Initialize state
  const state: ContextManagerState = {
    llmClient: null,
    isInitialized: false,
    configuration,
    activeContexts: new Map(),
    defaultContextId: null,
    metrics: createEmptyMetrics(),
    callbacks: {
      onContextCreated: [],
      onContextUpdated: [],
      onSummaryGenerated: [],
      onContextCleared: [],
      onError: []
    },
    semanticIndex: new Map(),
    topicModel: new Map(),
    keywordIndex: new Map()
  };

  /**
   * Emit event to all subscribers
   */
  const emitEvent = (eventType: string, data: any, contextId?: string): void => {
    const callbacks = state.callbacks[eventType] || [];
    if (callbacks.length === 0) return;

    const event = createContextEvent(eventType, data, contextId);
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.warn(`Context manager event callback error for ${eventType}:`, error);
      }
    });
  };

  /**
   * Subscribe to context events
   */
  const subscribeToEvent = (eventType: string, callback: ContextEventCallback): ContextEventSubscription => {
    if (!state.callbacks[eventType]) {
      state.callbacks[eventType] = [];
    }

    state.callbacks[eventType].push(callback);

    return {
      unsubscribe: () => {
        const callbacks = state.callbacks[eventType];
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  };

  /**
   * Initialize the context manager
   */
  const initialize = async (llmConfig: Record<string, any> = {}): Promise<boolean> => {
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
      state.llmClient.onError((error: any) => {
        emitEvent('onError', { error: error.message }, state.defaultContextId || undefined);
      });

      state.isInitialized = true;

      console.log('✅ Context manager initialized successfully');

      // Emit ready event
      emitEvent('onContextCreated', {
        initialized: true,
        configuration: state.configuration
      });

      return true;

    } catch (error) {
      console.error('❌ Context manager initialization failed:', error);
      emitEvent('onError', {
        error: error instanceof Error ? error.message : String(error),
        phase: 'initialization'
      });
      return false;
    }
  };

  /**
   * Create a new conversation context
   */
  const createContext = async (sessionId?: string): Promise<string> => {
    const contextId = sessionId || `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context = createConversationContext({
      contextId,
      sessionId,
      chunks: [],
      summary: '',
      averageConfidence: 0,
      totalWords: 0,
      timeSpan: 0,
      lastUpdated: Date.now(),
      createdAt: Date.now()
    });

    state.activeContexts.set(contextId, context);

    if (!state.defaultContextId) {
      state.defaultContextId = contextId;
    }

    state.metrics = {
      ...state.metrics,
      totalSessions: state.metrics.totalSessions + 1
    };

    console.log(`📝 Created context: ${contextId}`);
    emitEvent('onContextCreated', { contextId, sessionId }, contextId);

    return contextId;
  };

  /**
   * Get a conversation context
   */
  const getContext = (contextId?: string): ConversationContext | null => {
    const targetContextId = contextId || state.defaultContextId;
    return targetContextId ? state.activeContexts.get(targetContextId) || null : null;
  };

  /**
   * Add a chunk to the context
   */
  const addChunk = async (chunk: ContextChunk, contextId?: string): Promise<void> => {
    const errors = validateContextChunk(chunk);
    if (errors.length > 0) {
      throw new Error(`Invalid chunk: ${errors.join(', ')}`);
    }

    const targetContextId = contextId || state.defaultContextId;
    if (!targetContextId) {
      throw new Error('No context available');
    }

    const context = state.activeContexts.get(targetContextId);
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    // Add chunk to context
    const updatedChunks = [...context.chunks, chunk];
    const totalWords = updatedChunks.reduce((sum, c) => sum + c.text.split(' ').length, 0);
    const averageConfidence = updatedChunks.reduce((sum, c) => sum + c.confidence, 0) / updatedChunks.length;
    const timeSpan = updatedChunks.length > 1 
      ? updatedChunks[updatedChunks.length - 1].timestamp - updatedChunks[0].timestamp 
      : 0;

    // Update context with new chunk
    const updatedContext: ConversationContext = {
      ...context,
      chunks: updatedChunks,
      totalWords,
      averageConfidence,
      timeSpan,
      lastUpdated: Date.now()
    };

    // Check if we need to generate a new summary
    let summary = context.summary;
    if (updatedChunks.length >= state.configuration.summaryThreshold) {
      const summaryResult = await summarizationEngine.generateSummary(
        updatedContext,
        state.llmClient,
        {
          strategy: state.configuration.strategy,
          maxLength: state.configuration.maxSummaryLength
        }
      );
      summary = summaryResult.summary;
      
      emitEvent('onSummaryGenerated', {
        contextId: targetContextId,
        summary,
        processingTime: summaryResult.processingTime,
        compressionRatio: summaryResult.compressionRatio
      }, targetContextId);

      state.metrics = {
        ...state.metrics,
        totalSummaries: state.metrics.totalSummaries + 1,
        averageSummaryTime: (state.metrics.averageSummaryTime + summaryResult.processingTime) / 2
      };
    }

    // Store updated context with summary
    const finalContext: ConversationContext = {
      ...updatedContext,
      summary
    };

    state.activeContexts.set(targetContextId, finalContext);

    // Update keyword index if semantic search is enabled
    if (state.configuration.enableSemanticSearch) {
      const keywords = semanticSearchEngine.extractKeywords(chunk.text);
      state.keywordIndex.set(chunk.chunkId, keywords);
    }

    state.metrics = {
      ...state.metrics,
      totalChunks: state.metrics.totalChunks + 1
    };

    emitEvent('onContextUpdated', {
      contextId: targetContextId,
      chunkId: chunk.chunkId,
      totalChunks: finalContext.chunks.length,
      totalWords: finalContext.totalWords
    }, targetContextId);
  };

  /**
   * Generate summary for context
   */
  const generateSummary = async (contextId?: string, options: SummarizationOptions = {}): Promise<string> => {
    const targetContextId = contextId || state.defaultContextId;
    const context = getContext(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    const summaryResult = await summarizationEngine.generateSummary(
      context,
      state.llmClient,
      {
        ...options,
        strategy: options.strategy || state.configuration.strategy,
        maxLength: options.maxLength || state.configuration.maxSummaryLength
      }
    );

    // Update context with new summary
    const updatedContext: ConversationContext = {
      ...context,
      summary: summaryResult.summary,
      lastUpdated: Date.now()
    };

    state.activeContexts.set(targetContextId, updatedContext);

    emitEvent('onSummaryGenerated', {
      contextId: targetContextId,
      summary: summaryResult.summary,
      processingTime: summaryResult.processingTime
    }, targetContextId);

    return summaryResult.summary;
  };

  /**
   * Perform semantic search
   */
  const semanticSearch = async (
    query: string,
    contextId?: string,
    options: SemanticSearchOptions = {}
  ): Promise<SemanticSearchResult> => {
    if (!state.configuration.enableSemanticSearch) {
      throw new Error('Semantic search is disabled');
    }

    const targetContextId = contextId || state.defaultContextId;
    const context = getContext(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    const results = semanticSearchEngine.performSemanticSearch(query, context, options);
    
    return {
      query,
      contextId: targetContextId,
      results,
      totalMatches: results.length,
      timestamp: Date.now()
    };
  };

  /**
   * Find similar chunks
   */
  const findSimilarChunks = async (
    referenceText: string,
    contextId?: string,
    options: SemanticSearchOptions = {}
  ): Promise<any[]> => {
    const targetContextId = contextId || state.defaultContextId;
    const context = getContext(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    return semanticSearchEngine.findSimilarChunks(referenceText, context, options);
  };

  /**
   * Extract topics from context
   */
  const extractTopics = async (
    contextId?: string,
    options: TopicModelingOptions = {}
  ): Promise<TopicExtractionResult> => {
    if (!state.configuration.enableTopicModeling) {
      throw new Error('Topic modeling is disabled');
    }

    const targetContextId = contextId || state.defaultContextId;
    const context = getContext(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    const topics = await topicModelingEngine.extractTopics(
      context,
      semanticSearchEngine.extractKeywords,
      state.llmClient,
      {
        maxTopics: options.maxTopics || state.configuration.maxTopics,
        ...options
      }
    );

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
  };

  /**
   * Get topic evolution over time
   */
  const getTopicEvolution = async (
    contextId?: string,
    options: TopicModelingOptions = {}
  ): Promise<TopicEvolutionResult> => {
    const targetContextId = contextId || state.defaultContextId;
    const context = getContext(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }

    const evolution = topicModelingEngine.analyzeTopicEvolution(
      context,
      semanticSearchEngine.extractKeywords,
      options
    );

    return {
      contextId: targetContextId,
      evolution,
      totalWindows: evolution.length,
      analysisTime: Date.now()
    };
  };

  /**
   * Clear a context
   */
  const clearContext = async (contextId?: string): Promise<void> => {
    const targetContextId = contextId || state.defaultContextId;
    
    if (targetContextId && state.activeContexts.has(targetContextId)) {
      state.activeContexts.delete(targetContextId);
      state.semanticIndex.delete(targetContextId);
      state.topicModel.delete(targetContextId);
      
      if (state.defaultContextId === targetContextId) {
        state.defaultContextId = state.activeContexts.size > 0 
          ? state.activeContexts.keys().next().value
          : null;
      }

      emitEvent('onContextCleared', { contextId: targetContextId }, targetContextId);
    }
  };

  /**
   * Get analysis history (chunks from context)
   */
  const getAnalysisHistory = async (sessionId?: string): Promise<any[]> => {
    const context = getContext(sessionId);
    if (!context) {
      return [];
    }

    return context.chunks.map(chunk => ({
      timestamp: chunk.timestamp,
      text: chunk.text,
      confidence: chunk.confidence,
      chunkId: chunk.chunkId,
      metadata: chunk.metadata
    }));
  };

  /**
   * Clear session (alias for clearContext)
   */
  const clearSession = async (sessionId?: string): Promise<void> => {
    await clearContext(sessionId);
  };

  /**
   * Get status information
   */
  const getStatus = () => ({
    isInitialized: state.isInitialized,
    strategy: state.configuration.strategy,
    activeContextCount: state.activeContexts.size,
    defaultContextId: state.defaultContextId,
    configuration: state.configuration,
    metrics: state.metrics,
    enabledFeatures: {
      semanticSearch: state.configuration.enableSemanticSearch,
      topicModeling: state.configuration.enableTopicModeling
    }
  });

  /**
   * Update configuration
   */
  const updateConfiguration = (newConfig: Partial<ContextManagerConfiguration>): void => {
    state.configuration = { ...state.configuration, ...newConfig };
  };

  /**
   * Switch active context
   */
  const switchContext = (contextId: string): boolean => {
    if (state.activeContexts.has(contextId)) {
      const oldContextId = state.defaultContextId;
      state.defaultContextId = contextId;
      
      if (oldContextId !== contextId) {
        state.metrics = {
          ...state.metrics,
          contextSwitches: state.metrics.contextSwitches + 1
        };
      }
      
      return true;
    }
    return false;
  };

  /**
   * Get list of active context IDs
   */
  const getContextList = (): string[] => {
    return Array.from(state.activeContexts.keys());
  };

  /**
   * Get metrics
   */
  const getMetrics = (): ContextMetrics => ({ ...state.metrics });

  /**
   * Cleanup resources
   */
  const cleanup = async (): Promise<void> => {
    try {
      if (state.llmClient && typeof state.llmClient.cleanup === 'function') {
        await state.llmClient.cleanup();
      }

      state.activeContexts.clear();
      state.semanticIndex.clear();
      state.topicModel.clear();
      state.keywordIndex.clear();

      // Clear callbacks
      Object.keys(state.callbacks).forEach(eventType => {
        state.callbacks[eventType] = [];
      });

      state.isInitialized = false;
      state.defaultContextId = null;

      console.log('🧹 Context manager cleaned up');
    } catch (error) {
      console.warn('Context manager cleanup error:', error);
    }
  };

  return {
    // Core functionality
    initialize,
    cleanup,
    createContext,
    getContext,
    addChunk,
    clearContext,
    generateSummary,
    getStatus,
    getMetrics,

    // Event subscriptions
    onContextCreated: (callback) => subscribeToEvent('onContextCreated', callback),
    onContextUpdated: (callback) => subscribeToEvent('onContextUpdated', callback),
    onSummaryGenerated: (callback) => subscribeToEvent('onSummaryGenerated', callback),
    onContextCleared: (callback) => subscribeToEvent('onContextCleared', callback),
    onError: (callback) => subscribeToEvent('onError', callback),

    // Semantic search functionality
    semanticSearch,
    findSimilarChunks,

    // Topic modeling functionality
    extractTopics,
    getTopicEvolution,

    // Enhanced context management
    getAnalysisHistory,
    clearSession,
    updateConfiguration,
    switchContext,
    getContextList
  };
};

// Re-export types and utilities
export {
  type BaseContextManager,
  type ConversationContext,
  type ContextChunk,
  type ContextManagerConfiguration,
  type ContextMetrics,
  type ContextEvent,
  type ContextEventCallback,
  type ContextEventSubscription,
  ContextStrategy,
  CONTEXT_STRATEGIES,
  type SemanticSearchResult,
  type TopicCluster,
  type TopicExtractionResult,
  type TopicEvolutionResult
};

// Export utility function for context analysis (backward compatibility)
export const analyzeContext = (context: any) => {
  const errors = validateConversationContext(context);
  if (errors.length > 0) {
    return { valid: false, error: errors.join(', ') };
  }

  const totalWords = context.chunks.reduce((sum: number, chunk: any) => sum + chunk.text.split(' ').length, 0);
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

// Default export
