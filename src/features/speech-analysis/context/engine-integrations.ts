/**
 * Engine Integrations
 * Integrates semantic search, topic modeling, and summarization engines with context manager
 */

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

import { type ContextManagerState } from './context-manager-factory.js';
import { type ConversationContext } from './base-context-manager.ts';

/**
 * Creates engine integration functions for the context manager
 */
export const createEngineIntegrations = (
  state: ContextManagerState,
  semanticSearchEngine: SemanticSearchEngine,
  topicModelingEngine: TopicModelingEngine,
  summarizationEngine: ContextSummarizationEngine
) => {
  /**
   * Helper to get context by ID
   */
  const getContext = (contextId?: string): ConversationContext | null => {
    const targetId = contextId || state.defaultContextId;
    return targetId ? state.activeContexts.get(targetId) || null : null;
  };

  /**
   * Semantic search functionality
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

    const results = await semanticSearchEngine.search(query, context, options);
    
    // Update semantic index
    state.semanticIndex.set(targetContextId, {
      lastQuery: query,
      results,
      timestamp: Date.now()
    });

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
   * Clear session functionality
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
    }
  };

  const clearSession = async (sessionId?: string): Promise<void> => {
    await clearContext(sessionId);
  };

  /**
   * Configuration and context management
   */
  const updateConfiguration = (newConfig: Partial<any>): void => {
    state.configuration = { ...state.configuration, ...newConfig };
  };

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

  const getContextList = (): string[] => {
    return Array.from(state.activeContexts.keys());
  };

  return {
    semanticSearch,
    findSimilarChunks,
    extractTopics,
    getTopicEvolution,
    getAnalysisHistory,
    clearContext,
    clearSession,
    updateConfiguration,
    switchContext,
    getContextList
  };
};