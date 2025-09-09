/**
 * Base Context Manager Interface and Types
 * Foundation interfaces and utilities for all context management strategies
 */

export interface ContextChunk {
  readonly chunkId: string;
  readonly text: string;
  readonly timestamp: number;
  readonly confidence: number;
  readonly metadata?: Record<string, any>;
}

export interface ConversationContext {
  readonly contextId: string;
  readonly sessionId?: string;
  readonly chunks: readonly ContextChunk[];
  readonly summary: string;
  readonly averageConfidence: number;
  readonly totalWords: number;
  readonly timeSpan: number;
  readonly lastUpdated: number;
  readonly createdAt: number;
  readonly metadata?: Record<string, any>;
}

export interface ContextMetrics {
  readonly totalSessions: number;
  readonly totalChunks: number;
  readonly totalSummaries: number;
  readonly averageSummaryTime: number;
  readonly contextSwitches: number;
}

export interface ContextManagerConfiguration {
  readonly strategy: ContextStrategy;
  readonly maxChunks: number;
  readonly summaryThreshold: number;
  readonly maxSummaryLength: number;
  readonly contextWindowSize: number;
  readonly enableSemanticSearch: boolean;
  readonly enableTopicModeling: boolean;
  readonly topicSimilarityThreshold: number;
  readonly maxTopics: number;
}

export enum ContextStrategy {
  ROLLING_WINDOW = 'rolling_window',
  SUMMARY_BASED = 'summary_based',
  HYBRID = 'hybrid'
}

export interface ContextEvent {
  readonly type: string;
  readonly data: any;
  readonly timestamp: number;
  readonly contextId?: string;
}

export type ContextEventCallback = (event: ContextEvent) => void;

export interface ContextEventSubscription {
  unsubscribe: () => void;
}

export interface BaseContextManager {
  // Lifecycle
  initialize: (llmConfig?: Record<string, any>) => Promise<boolean>;
  cleanup: () => Promise<void>;

  // Context management
  createContext: (sessionId?: string) => Promise<string>;
  getContext: (contextId?: string) => ConversationContext | null;
  addChunk: (chunk: ContextChunk, contextId?: string) => Promise<void>;
  clearContext: (contextId?: string) => Promise<void>;

  // Summarization
  generateSummary: (contextId?: string, options?: Record<string, any>) => Promise<string>;

  // Status
  getStatus: () => any;
  getMetrics: () => ContextMetrics;

  // Events
  onContextCreated: (callback: ContextEventCallback) => ContextEventSubscription;
  onContextUpdated: (callback: ContextEventCallback) => ContextEventSubscription;
  onSummaryGenerated: (callback: ContextEventCallback) => ContextEventSubscription;
  onContextCleared: (callback: ContextEventCallback) => ContextEventSubscription;
  onError: (callback: ContextEventCallback) => ContextEventSubscription;
}

export const CONTEXT_STRATEGIES = {
  [ContextStrategy.ROLLING_WINDOW]: {
    name: 'Rolling Window',
    description: 'Keep N most recent chunks in context'
  },
  [ContextStrategy.SUMMARY_BASED]: {
    name: 'Summary Based',
    description: 'Summarize old chunks, keep recent ones'
  },
  [ContextStrategy.HYBRID]: {
    name: 'Hybrid',
    description: 'Combine summaries with rolling window'
  }
} as const;

/**
 * Creates default configuration for context managers
 */
export const createDefaultContextConfiguration = (config: Partial<ContextManagerConfiguration> = {}): ContextManagerConfiguration => {
  return {
    strategy: config.strategy || ContextStrategy.HYBRID,
    maxChunks: config.maxChunks || 10,
    summaryThreshold: config.summaryThreshold || 20,
    maxSummaryLength: config.maxSummaryLength || 500,
    contextWindowSize: config.contextWindowSize || 2000,
    enableSemanticSearch: config.enableSemanticSearch !== false,
    enableTopicModeling: config.enableTopicModeling !== false,
    topicSimilarityThreshold: config.topicSimilarityThreshold || 0.7,
    maxTopics: config.maxTopics || 5
  };
};

/**
 * Creates an empty metrics object
 */
export const createEmptyMetrics = (): ContextMetrics => ({
  totalSessions: 0,
  totalChunks: 0,
  totalSummaries: 0,
  averageSummaryTime: 0,
  contextSwitches: 0
});

/**
 * Validates a context chunk
 */
export const validateContextChunk = (chunk: any): string[] => {
  const errors: string[] = [];
  
  if (!chunk.chunkId) {
    errors.push('Chunk ID is required');
  }
  
  if (!chunk.text || typeof chunk.text !== 'string') {
    errors.push('Chunk text must be a non-empty string');
  }
  
  if (typeof chunk.timestamp !== 'number' || chunk.timestamp < 0) {
    errors.push('Chunk timestamp must be a non-negative number');
  }
  
  if (typeof chunk.confidence !== 'number' || chunk.confidence < 0 || chunk.confidence > 1) {
    errors.push('Chunk confidence must be between 0 and 1');
  }
  
  return errors;
};

/**
 * Validates a conversation context
 */
export const validateConversationContext = (context: any): string[] => {
  const errors: string[] = [];
  
  if (!context.contextId) {
    errors.push('Context ID is required');
  }
  
  if (!Array.isArray(context.chunks)) {
    errors.push('Context chunks must be an array');
  }
  
  if (typeof context.summary !== 'string') {
    errors.push('Context summary must be a string');
  }
  
  if (typeof context.averageConfidence !== 'number' || context.averageConfidence < 0 || context.averageConfidence > 1) {
    errors.push('Average confidence must be between 0 and 1');
  }
  
  return errors;
};

/**
 * Creates a context event
 */
export const createContextEvent = (type: string, data: any, contextId?: string): ContextEvent => ({
  type,
  data,
  timestamp: Date.now(),
  contextId
});
