/**
 * @fileoverview LLM Integration System Type Definitions
 * 
 * Comprehensive type definitions for Large Language Model integration,
 * provider abstraction, analysis functions, and response processing.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';

/**
 * Supported LLM providers
 */
export const LLMProviders = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  AZURE_OPENAI: 'azure-openai',
  MOCK: 'mock'
} as const;

export type LLMProviderType = typeof LLMProviders[keyof typeof LLMProviders];

/**
 * LLM message format (OpenAI-compatible)
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM request configuration
 */
export interface LLMRequestConfig {
  model: string;
  messages: LLMMessage[];
  max_tokens: number;
  temperature: number;
  stream?: boolean;
}

/**
 * LLM API response structure
 */
export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  provider: string;
  error?: string;
  raw?: unknown;
}

/**
 * LLM provider configuration
 */
export interface LLMProviderConfig {
  name?: string;
  provider: LLMProviderType;
  apiKey?: string;
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  makeRequest: (messages: LLMMessage[], options?: Partial<LLMRequestConfig>) => Promise<LLMResponse>;
  provider: LLMProviderType;
  model: string;
}

/**
 * Performance data for analysis
 */
export interface PerformanceData {
  accuracy?: number;
  reactionTime?: number;
  errorRate?: number;
  workload?: number;
  fatigue?: number;
  trend?: 'improving' | 'stable' | 'declining';
  sessionDuration?: number;
  taskComplexity?: 'low' | 'moderate' | 'high';
}

/**
 * Fusion data for situational awareness analysis
 */
export interface FusionData {
  human?: {
    cognitiveLoad?: number;
    fatigue?: number;
    stress?: number;
  };
  system?: {
    health?: number;
    automationLevel?: number;
    performance?: number;
  };
  environment?: {
    totalRisk?: number;
    weatherRisk?: number;
    trafficRisk?: number;
  };
}

/**
 * Advisory context data
 */
export interface AdvisoryContext {
  mission?: {
    phase?: string;
    objectives?: string[];
    progress?: number;
  };
  alerts?: {
    level?: 'low' | 'normal' | 'high' | 'critical';
  };
  performance?: {
    status?: 'optimal' | 'nominal' | 'degraded' | 'critical';
  };
  environment?: {
    status?: 'favorable' | 'normal' | 'challenging' | 'hazardous';
  };
  userQuery?: string;
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysisResult {
  analysis: string;
  confidence: number;
  recommendations: string[];
  timestamp: number;
  source: 'llm-performance-analysis';
}

/**
 * Situational awareness analysis result
 */
export interface SituationalAwarenessResult {
  assessment: string;
  awarenessLevel: 'low' | 'moderate' | 'high';
  riskFactors: string[];
  recommendations: string[];
  timestamp: number;
  source: 'llm-situational-analysis';
}

/**
 * Advisory generation result
 */
export interface AdvisoryResult {
  advisory: string;
  priority: 'low' | 'normal' | 'high';
  actionItems: string[];
  timeframe: 'immediate' | 'short-term' | 'medium-term' | 'ongoing';
  timestamp: number;
  source: 'llm-advisory';
}

/**
 * Analysis request types
 */
export type AnalysisType = 'performance-analysis' | 'situational-awareness' | 'advisory';

/**
 * Analysis request structure
 */
export interface AnalysisRequest {
  type: AnalysisType;
  data: PerformanceData | FusionData | AdvisoryContext;
  options?: {
    priority?: 'low' | 'normal' | 'high';
    timeout?: number;
    retries?: number;
    model?: string;
  };
}

/**
 * Analysis functions interface
 */
export interface AnalysisFunctions {
  analyzePerformance: (data: PerformanceData, provider: LLMProvider) => Promise<PerformanceAnalysisResult>;
  analyzeSituationalAwareness: (data: FusionData, provider: LLMProvider) => Promise<SituationalAwarenessResult>;
  generateAdvisory: (context: AdvisoryContext, provider: LLMProvider) => Promise<AdvisoryResult>;
}

/**
 * LLM integration events
 */
export interface LLMEvents {
  analysisCompleted: {
    type: AnalysisType;
    result: PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult;
    duration: number;
    provider: string;
    requestId: string;
  };
  analysisError: {
    type: AnalysisType;
    error: string;
    provider: string;
    requestId: string;
  };
  rateLimitHit: {
    provider: string;
    retryAfter?: number;
  };
  providerSwitch: {
    from: string;
    to: string;
    reason: string;
  };
}

/**
 * LLM integration configuration
 */
export interface LLMIntegrationConfig {
  providers?: LLMProviderConfig[];
  fallbackEnabled?: boolean;
  cachingEnabled?: boolean;
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  retryAttempts?: number;
  cacheExpiryMs?: number;
}

/**
 * Request metrics
 */
export interface RequestMetrics {
  active: number;
  queued: number;
  cached: number;
  completed: number;
  failed: number;
}

/**
 * Provider metrics
 */
export interface ProviderMetrics {
  current: string;
  available: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: string;
}

/**
 * System capabilities
 */
export interface SystemCapabilities {
  providers: Array<{ provider: string; model: string }>;
  analysisTypes: AnalysisType[];
  features: {
    caching: boolean;
    fallback: boolean;
    concurrentRequests: number;
    rateLimiting: boolean;
  };
}

/**
 * LLM integration system interface
 */
export interface LLMIntegration {
  // Core analysis functionality
  analyze: (type: AnalysisType, data: unknown, options?: AnalysisRequest['options']) => Promise<
    PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult
  >;
  
  // System information
  getCapabilities: () => SystemCapabilities;
  getMetrics: () => {
    requests: RequestMetrics;
    provider: ProviderMetrics;
  };
  
  // Cache management
  clearCache: () => void;
  
  // Event handling
  on: <K extends keyof LLMEvents>(event: K, listener: (data: LLMEvents[K]) => void) => void;
  off: <K extends keyof LLMEvents>(event: K, listener: (data: LLMEvents[K]) => void) => void;
  emit: <K extends keyof LLMEvents>(event: K, data: LLMEvents[K]) => void;
}

/**
 * Mock response configuration
 */
export interface MockResponseConfig {
  delay?: { min: number; max: number };
  includeUsage?: boolean;
  simulateErrors?: boolean;
  errorRate?: number;
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  result: PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult;
  timestamp: number;
  accessCount: number;
}

/**
 * Request queue entry
 */
export interface QueuedRequest {
  id: string;
  request: AnalysisRequest;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  lastCheck: number;
  responseTime: number;
  errorRate: number;
  consecutiveFailures: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  windowMs: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

/**
 * Response parsing utilities interface
 */
export interface ResponseParsers {
  extractConfidence: (content: string) => number;
  extractRecommendations: (content: string) => string[];
  extractAwarenessLevel: (content: string) => 'low' | 'moderate' | 'high';
  extractRiskFactors: (content: string) => string[];
  extractPriority: (content: string) => 'low' | 'normal' | 'high';
  extractActionItems: (content: string) => string[];
  extractTimeframe: (content: string) => 'immediate' | 'short-term' | 'medium-term' | 'ongoing';
}

/**
 * Factory function types
 */
export type LLMProviderFactory = (config: LLMProviderConfig) => LLMProvider;
export type AnalysisFunctionsFactory = () => AnalysisFunctions;
export type LLMIntegrationFactory = (config?: LLMIntegrationConfig) => LLMIntegration;

/**
 * Provider-specific API configurations
 */
export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  version?: string;
}

export interface AzureOpenAIConfig {
  apiKey: string;
  baseURL: string;
  deployment: string;
  apiVersion?: string;
}

/**
 * Analysis context for enhanced responses
 */
export interface AnalysisContext {
  sessionId?: string;
  userId?: string;
  timestamp: number;
  previousAnalyses?: Array<{
    type: AnalysisType;
    result: unknown;
    timestamp: number;
  }>;
  systemState?: {
    mode: 'training' | 'operational' | 'emergency';
    phase: string;
    complexity: number;
  };
}

/**
 * Structured analysis prompts
 */
export interface AnalysisPrompts {
  performance: {
    system: string;
    template: string;
  };
  situationalAwareness: {
    system: string;
    template: string;
  };
  advisory: {
    system: string;
    template: string;
  };
}

/**
 * Performance monitoring for LLM operations
 */
export interface LLMPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  costEstimate?: {
    prompt: number;
    completion: number;
    total: number;
    currency: string;
  };
}