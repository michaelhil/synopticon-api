/**
 * Context Manager Factory
 * Core factory function for creating extended context managers
 */

import { createLLMClient } from '../llm-client.js';
import {
  createConversationContext,
  createSpeechChunk,
  createSpeechEvent
} from '../../../core/configuration/types.js';

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
} from './base-context-manager.js';

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
  semanticSearch: (query: string, contextId?: string, options?: any) => Promise<any>;
  findSimilarChunks: (referenceText: string, contextId?: string, options?: any) => Promise<any[]>;

  // Topic modeling functionality
  extractTopics: (contextId?: string, options?: any) => Promise<any>;
  getTopicEvolution: (contextId?: string, options?: any) => Promise<any>;

  // Enhanced context management
  getAnalysisHistory: (sessionId?: string) => Promise<any[]>;
  clearSession: (sessionId?: string) => Promise<void>;

  // Advanced access
  updateConfiguration: (newConfig: Partial<ContextManagerConfiguration>) => void;
  switchContext: (contextId: string) => boolean;
  getContextList: () => string[];
}

/**
 * Creates base context manager with core functionality
 */
export const createBaseContextManager = (
  config: Partial<ContextManagerConfiguration>,
  state: ContextManagerState
): BaseContextManager => {
  const configuration = createDefaultContextConfiguration(config);

  /**
   * Initialize LLM client if needed
   */
  const initialize = async (): Promise<void> => {
    if (!state.isInitialized) {
      state.llmClient = await createLLMClient(configuration.llmConfig);
      state.isInitialized = true;
    }
  };

  /**
   * Event emission helper
   */
  const emitEvent = (eventType: string, data: any, contextId?: string): void => {
    const event = createContextEvent(eventType, data, contextId);
    const callbacks = state.callbacks[eventType] || [];
    
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.warn('Context manager event callback error:', error);
      }
    });
  };

  /**
   * Helper to get context by ID
   */
  const getContext = (contextId?: string): ConversationContext | null => {
    const targetId = contextId || state.defaultContextId;
    return targetId ? state.activeContexts.get(targetId) || null : null;
  };

  /**
   * Create or get context
   */
  const createContext = async (contextId?: string): Promise<string> => {
    const id = contextId || `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!state.activeContexts.has(id)) {
      const context = createConversationContext({
        contextId: id,
        metadata: { createdAt: Date.now() }
      });
      
      state.activeContexts.set(id, context);
      
      // Set as default if this is the first context
      if (!state.defaultContextId) {
        state.defaultContextId = id;
      }
      
      emitEvent('onContextCreated', { contextId: id }, id);
    }
    
    return id;
  };

  /**
   * Add context chunk
   */
  const addContextChunk = async (chunk: ContextChunk, contextId?: string): Promise<void> => {
    await initialize();
    
    const targetContextId = contextId || state.defaultContextId || await createContext();
    const context = state.activeContexts.get(targetContextId);
    
    if (!context) {
      throw new Error(`Context '${targetContextId}' not found`);
    }
    
    // Validate chunk
    const validationResult = validateContextChunk(chunk);
    if (!validationResult.isValid) {
      throw new Error(`Invalid context chunk: ${validationResult.errors.join(', ')`);
    }
    
    // Create speech chunk and add to context
    const speechChunk = createSpeechChunk({
      chunkId: chunk.chunkId || `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: chunk.text,
      timestamp: chunk.timestamp || Date.now(),
      confidence: chunk.confidence || 1.0,
      metadata: chunk.metadata || {}
    });
    
    context.chunks.push(speechChunk);
    
    // Update metrics
    state.metrics = {
      ...state.metrics,
      totalChunks: state.metrics.totalChunks + 1,
      lastProcessedAt: Date.now()
    };
    
    emitEvent('onChunkAdded', { chunk: speechChunk, contextId: targetContextId }, targetContextId);
  };

  /**
   * Get context by ID
   */
  const getContextById = async (contextId: string): Promise<ConversationContext | null> => {
    return state.activeContexts.get(contextId) || null;
  };

  /**
   * Get status
   */
  const getStatus = () => ({
    isInitialized: state.isInitialized,
    strategy: state.configuration.strategy,
    activeContextCount: state.activeContexts.size,
    defaultContextId: state.defaultContextId,
    configuration: state.configuration,
    metrics: state.metrics
  });

  /**
   * Event subscription management
   */
  const subscribe = (eventType: string, callback: ContextEventCallback): ContextEventSubscription => {
    if (!state.callbacks[eventType]) {
      state.callbacks[eventType] = [];
    }
    state.callbacks[eventType].push(callback);
    
    return {
      unsubscribe: () => {
        const callbacks = state.callbacks[eventType];
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      }
    };
  };

  /**
   * Get metrics
   */
  const getMetrics = (): ContextMetrics => ({ ...state.metrics });

  /**
   * Cleanup
   */
  const cleanup = async (): Promise<void> => {
    state.activeContexts.clear();
    state.semanticIndex.clear();
    state.topicModel.clear();
    state.keywordIndex.clear();
    state.callbacks = {};
    state.metrics = createEmptyMetrics();
    state.isInitialized = false;
    state.defaultContextId = null;
  };

  return {
    initialize,
    createContext,
    addContextChunk,
    getContextById,
    getStatus,
    subscribe,
    getMetrics,
    cleanup
  };
};
