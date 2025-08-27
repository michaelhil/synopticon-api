/**
 * Modular Context Management System
 * Replaces the monolithic context/index.ts with focused, composable modules
 */

import { createContextAggregator, type ContextAggregator, type ContextAggregatorConfig } from './context/context-aggregator.js';
import { createConversationContextManager, type ConversationContextManager } from './context/conversation-context.js';
import { createSpeakerContextManager, type SpeakerContextManager } from './context/speaker-context.js';
import { createTemporalContextManager, type TemporalContextManager } from './context/temporal-context.js';

// Legacy compatibility interface
export interface ContextManager extends ContextAggregator {
  // Backwards compatibility methods
  initialize: () => Promise<void>;
  processText: (text: string, timestamp: number, speakerId?: string) => Promise<void>;
  getContext: (sessionId?: string) => Promise<any>;
  analyzeContext: (text: string, options?: any) => Promise<any>;
}

/**
 * Create modular context manager with backwards compatibility
 */
export const createContextManager = (config: ContextAggregatorConfig = {}): ContextManager => {
  const aggregator = createContextAggregator(config);
  
  // Add legacy compatibility methods
  const initialize = async (): Promise<void> => {
    // Legacy initialization - now handled automatically
    console.log('Context manager initialized (modular)');
  };

  const processText = async (text: string, timestamp: number, speakerId?: string): Promise<void> => {
    await aggregator.processIncomingData({
      transcript: text,
      timestamp,
      confidence: 1.0,
      speakerFeatures: speakerId ? { speakerId } : undefined
    });
  };

  const getContext = async (sessionId?: string): Promise<any> => {
    const unified = await aggregator.getUnifiedContext();
    return unified?.currentState.conversation || null;
  };

  const analyzeContext = async (text: string, options: any = {}): Promise<any> => {
    // Simple analysis - extract topics and sentiment
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const topicWords = words.slice(0, 5); // Simple topic extraction
    
    return {
      topics: topicWords,
      sentiment: 0.5, // Neutral sentiment placeholder
      entities: [], // Would extract named entities
      summary: text.length > 100 ? text.substring(0, 100) + '...' : text
    };
  };

  return {
    ...aggregator,
    initialize,
    processText,
    getContext,
    analyzeContext
  };
};

// Export individual context managers for direct use
export {
  createContextAggregator,
  createConversationContextManager,
  createSpeakerContextManager,
  createTemporalContextManager
};

// Export types for external use
export type {
  ContextManager,
  ContextAggregator,
  ContextAggregatorConfig,
  ConversationContextManager,
  SpeakerContextManager,
  TemporalContextManager
};