/**
 * Conversation Context Manager - Compatibility Layer
 * Provides backward compatibility while using the new modular TypeScript implementation
 */

import createContextManager, {
  analyzeContext,
  CONTEXT_STRATEGIES,
  ContextStrategy,
  type ContextManagerConfiguration,
  type ConversationContext,
  type ContextChunk,
  type SemanticSearchResult,
  type TopicExtractionResult,
  type TopicEvolutionResult
} from './context/index.ts';

// Export the main factory function
export { createContextManager };

// Export utilities and constants
export {
  analyzeContext,
  CONTEXT_STRATEGIES,
  ContextStrategy
};

// Export types for TypeScript consumers
export type {
  ContextManagerConfiguration,
  ConversationContext,
  ContextChunk,
  SemanticSearchResult,
  TopicExtractionResult,
  TopicEvolutionResult
};

// Default export for backward compatibility
