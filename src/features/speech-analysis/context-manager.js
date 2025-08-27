/**
 * Conversation Context Manager - Compatibility Layer
 * Provides backward compatibility while using the new modular TypeScript implementation
 */

import createContextManager, {
  CONTEXT_STRATEGIES,
  ContextStrategy,
  analyzeContext
} from './context/index.ts';

// Export the main factory function
export { createContextManager };

// Export utilities and constants
export {
  analyzeContext,
  CONTEXT_STRATEGIES,
  ContextStrategy
};

// Types available from TypeScript import
// ContextManagerConfiguration, ConversationContext, ContextChunk,
// SemanticSearchResult, TopicExtractionResult, TopicEvolutionResult

// Default export for backward compatibility
