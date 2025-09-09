/**
 * @fileoverview LLM Integration System - Main Export Interface
 * 
 * Unified export interface for the LLM integration system, providing
 * comprehensive access to all LLM capabilities with backward compatibility.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// Core integration engine
export { 
  createLLMIntegration,
  performHealthCheck,
  validateAnalysisData 
} from './llm-integration-engine.js';

// Provider abstraction
export { 
  createLLMProvider,
  makeRealAPIRequest,
  generateMockResponse,
  ProviderHealthCheck 
} from './llm-provider.js';

// Analysis functions
export { 
  createAnalysisFunctions,
  extractConfidenceFromResponse,
  extractRecommendationsFromResponse,
  extractAwarenessLevel,
  extractRiskFactors,
  extractPriority,
  extractActionItems,
  extractTimeframe,
  ResponseQuality 
} from './analysis-functions.js';

// Response processing
export { 
  createResponseProcessor,
  ResponseValidator,
  MetricsExtractor,
  ContentFormatter 
} from './response-processing.js';

// Type definitions
export type {
  // Core interfaces
  LLMIntegration,
  LLMProvider,
  AnalysisFunctions,
  
  // Configuration types
  LLMIntegrationConfig,
  LLMProviderConfig,
  OpenAIConfig,
  AnthropicConfig,
  AzureOpenAIConfig,
  MockResponseConfig,
  
  // Analysis types
  AnalysisType,
  AnalysisRequest,
  PerformanceAnalysisResult,
  SituationalAwarenessResult,
  AdvisoryResult,
  
  // Data structures
  PerformanceData,
  FusionData,
  AdvisoryContext,
  AnalysisContext,
  
  // System types
  SystemCapabilities,
  RequestMetrics,
  ProviderMetrics,
  ProviderHealth,
  LLMPerformanceMetrics,
  
  // Communication types
  LLMMessage,
  LLMRequestConfig,
  LLMResponse,
  LLMEvents,
  
  // Utility types
  CacheEntry,
  QueuedRequest,
  RateLimitConfig,
  RetryConfig,
  ResponseParsers,
  AnalysisPrompts,
  
  // Factory types
  LLMProviderFactory,
  AnalysisFunctionsFactory,
  LLMIntegrationFactory,
  
  // Provider types
  LLMProviderType
} from './types.js';

// Provider constants
export { LLMProviders } from './types.js';

/**
 * Default configuration for LLM integration
 */
export const defaultLLMConfig: Partial<LLMIntegrationConfig> = {
  fallbackEnabled: true,
  cachingEnabled: true,
  maxConcurrentRequests: 5,
  requestTimeout: 30000,
  retryAttempts: 2,
  cacheExpiryMs: 5 * 60 * 1000 // 5 minutes
};

/**
 * Create a basic LLM integration instance with default settings
 */
export const createDefaultLLMIntegration = (providers: LLMProviderConfig[] = []) => {
  return createLLMIntegration({
    ...defaultLLMConfig,
    providers
  });
};

/**
 * Convenience factory for creating mock LLM integration for testing
 */
export const createMockLLMIntegration = () => {
  return createLLMIntegration({
    ...defaultLLMConfig,
    providers: [{
      provider: 'mock',
      model: 'mock-model'
    }]
  });
};

/**
 * Type guard utilities for analysis data
 */
export const AnalysisDataGuards = {
  isPerformanceData: (data: unknown): data is PerformanceData => {
    return typeof data === 'object' && data !== null;
  },
  
  isFusionData: (data: unknown): data is FusionData => {
    return typeof data === 'object' && data !== null;
  },
  
  isAdvisoryContext: (data: unknown): data is AdvisoryContext => {
    return typeof data === 'object' && data !== null;
  }
};

/**
 * Utility functions for common operations
 */
export const LLMUtils = {
  /**
   * Generate analysis request ID
   */
  generateRequestId: (): string => {
    return `llm_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Calculate estimated tokens for text
   */
  estimateTokens: (text: string): number => {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  },

  /**
   * Format duration for human reading
   */
  formatDuration: (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  },

  /**
   * Validate provider configuration
   */
  validateProviderConfig: (config: LLMProviderConfig): boolean => {
    if (!config.provider || !config.model) return false;
    if (config.provider !== 'mock' && !config.apiKey) return false;
    return true;
  },

  /**
   * Generate cache key for analysis request
   */
  generateCacheKey: (type: AnalysisType, data: unknown): string => {
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    return `${type}:${Buffer.from(dataStr).toString('base64').substr(0, 50)}`;
  }
};

/**
 * Analysis type constants for convenience
 */
export const AnalysisTypes = {
  PERFORMANCE: 'performance-analysis' as const,
  SITUATIONAL_AWARENESS: 'situational-awareness' as const,
  ADVISORY: 'advisory' as const
} as const;

/**
 * Common analysis priorities
 */
export const AnalysisPriorities = {
  LOW: 'low' as const,
  NORMAL: 'normal' as const,
  HIGH: 'high' as const
} as const;

/**
 * Standard timeframes for advisory results
 */
export const AdvisoryTimeframes = {
  IMMEDIATE: 'immediate' as const,
  SHORT_TERM: 'short-term' as const,
  MEDIUM_TERM: 'medium-term' as const,
  ONGOING: 'ongoing' as const
} as const;

import type { 
  LLMIntegrationConfig, 
  LLMProviderConfig,
  PerformanceData,
  FusionData,
  AdvisoryContext,
  AnalysisType
} from './types.js';