/**
 * @fileoverview LLM Integration Engine
 * 
 * Main coordination engine for LLM-based analysis operations with caching,
 * rate limiting, provider management, and comprehensive metrics tracking.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../shared/utils/logger.js';
import { createLLMProvider, ProviderHealthCheck } from './llm-provider.js';
import { createAnalysisFunctions } from './analysis-functions.js';
import { createResponseProcessor } from './response-processing.js';
import type {
  LLMIntegration,
  LLMIntegrationConfig,
  AnalysisType,
  AnalysisRequest,
  PerformanceAnalysisResult,
  SituationalAwarenessResult,
  AdvisoryResult,
  LLMProviderConfig,
  LLMProvider,
  LLMEvents,
  RequestMetrics,
  ProviderMetrics,
  SystemCapabilities,
  QueuedRequest,
  CacheEntry,
  ProviderHealth,
  LLMPerformanceMetrics,
  PerformanceData,
  FusionData,
  AdvisoryContext
} from './types.js';

const logger = createLogger({ level: 2 });

/**
 * Create LLM integration system with comprehensive functionality
 */
export const createLLMIntegration = (config: LLMIntegrationConfig = {}): LLMIntegration => {
  const {
    providers = [],
    fallbackEnabled = true,
    cachingEnabled = true,
    maxConcurrentRequests = 5,
    requestTimeout = 30000,
    retryAttempts = 2,
    cacheExpiryMs = 5 * 60 * 1000 // 5 minutes
  } = config;

  // Internal state
  let currentProviderIndex = 0;
  let requestIdCounter = 0;
  const eventEmitter = new EventEmitter();
  
  // Providers and analysis functions
  const llmProviders: LLMProvider[] = [];
  const providerHealthStatus = new Map<string, ProviderHealth>();
  const analysisFunctions = createAnalysisFunctions();
  const responseProcessor = createResponseProcessor();
  
  // Request management
  const activeRequests = new Map<string, AbortController>();
  const requestQueue: QueuedRequest[] = [];
  const cache = new Map<string, CacheEntry>();
  
  // Metrics tracking
  const metrics: LLMPerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    tokenUsage: { prompt: 0, completion: 0, total: 0 },
    costEstimate: { prompt: 0, completion: 0, total: 0, currency: 'USD' }
  };

  // Rate limiting
  const rateLimitWindows = new Map<string, number[]>();

  /**
   * Initialize providers on creation
   */
  const initializeProviders = () => {
    providers.forEach((providerConfig: LLMProviderConfig) => {
      try {
        const provider = createLLMProvider(providerConfig);
        llmProviders.push(provider);
        
        // Initialize health status
        providerHealthStatus.set(provider.provider, {
          provider: provider.provider,
          status: 'healthy',
          lastCheck: Date.now(),
          responseTime: 0,
          errorRate: 0,
          consecutiveFailures: 0
        });
        
        logger.info(`Initialized LLM provider: ${provider.provider} (${provider.model})`);
      } catch (error) {
        logger.error(`Failed to initialize provider ${providerConfig.provider}:`, error as Error);
      }
    });

    if (llmProviders.length === 0) {
      logger.warn('No LLM providers initialized, falling back to mock provider');
      const mockProvider = createLLMProvider({
        provider: 'mock',
        model: 'mock-model'
      });
      llmProviders.push(mockProvider);
    }
  };

  /**
   * Main analysis function
   */
  const analyze = async (
    type: AnalysisType, 
    data: unknown, 
    options: AnalysisRequest['options'] = {}
  ): Promise<PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult> => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    metrics.totalRequests++;
    
    try {
      // Check cache first
      if (cachingEnabled) {
        const cacheKey = generateCacheKey(type, data);
        const cachedResult = getCachedResult(cacheKey);
        if (cachedResult) {
          updateCacheHitRate(true);
          return cachedResult;
        }
        updateCacheHitRate(false);
      }

      // Rate limiting check
      if (!checkRateLimit(getCurrentProvider().provider)) {
        throw new Error('Rate limit exceeded');
      }

      // Execute analysis
      const result = await executeAnalysis(type, data, options, requestId);
      
      // Cache result
      if (cachingEnabled && result) {
        const cacheKey = generateCacheKey(type, data);
        setCachedResult(cacheKey, result);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      updateMetrics(true, responseTime, result);
      
      // Emit success event
      eventEmitter.emit('analysisCompleted', {
        type,
        result,
        duration: responseTime,
        provider: getCurrentProvider().provider,
        requestId
      });

      metrics.successfulRequests++;
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      updateMetrics(false, responseTime);
      
      // Emit error event
      eventEmitter.emit('analysisError', {
        type,
        error: (error as Error).message,
        provider: getCurrentProvider().provider,
        requestId
      });

      metrics.failedRequests++;
      logger.error(`Analysis failed (${type}):`, error as Error);
      throw error;
    } finally {
      activeRequests.delete(requestId);
    }
  };

  /**
   * Execute analysis with provider fallback
   */
  const executeAnalysis = async (
    type: AnalysisType,
    data: unknown,
    options: AnalysisRequest['options'] = {},
    requestId: string
  ): Promise<PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult> => {
    let lastError: Error | null = null;
    const maxAttempts = fallbackEnabled ? llmProviders.length : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const provider = getCurrentProvider();
      const controller = new AbortController();
      activeRequests.set(requestId, controller);

      try {
        // Set request timeout
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || requestTimeout);
        
        const result = await executeAnalysisWithProvider(type, data, provider);
        
        clearTimeout(timeoutId);
        updateProviderHealth(provider.provider, true);
        
        return result;

      } catch (error) {
        lastError = error as Error;
        updateProviderHealth(provider.provider, false, (error as Error).message);
        
        if (fallbackEnabled && attempt < maxAttempts - 1) {
          switchToNextProvider((error as Error).message);
        }
      }
    }

    throw lastError || new Error('All providers failed');
  };

  /**
   * Execute analysis with specific provider
   */
  const executeAnalysisWithProvider = async (
    type: AnalysisType,
    data: unknown,
    provider: LLMProvider
  ): Promise<PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult> => {
    switch (type) {
      case 'performance-analysis':
        return await analysisFunctions.analyzePerformance(data as PerformanceData, provider);
      
      case 'situational-awareness':
        return await analysisFunctions.analyzeSituationalAwareness(data as FusionData, provider);
      
      case 'advisory':
        return await analysisFunctions.generateAdvisory(data as AdvisoryContext, provider);
      
      default:
        throw new Error(`Unsupported analysis type: ${type}`);
    }
  };

  /**
   * Provider management
   */
  const getCurrentProvider = (): LLMProvider => {
    if (llmProviders.length === 0) {
      throw new Error('No LLM providers available');
    }
    return llmProviders[currentProviderIndex];
  };

  const switchToNextProvider = (reason: string) => {
    const fromProvider = getCurrentProvider().provider;
    currentProviderIndex = (currentProviderIndex + 1) % llmProviders.length;
    const toProvider = getCurrentProvider().provider;
    
    logger.warn(`Switching from ${fromProvider} to ${toProvider}: ${reason}`);
    
    eventEmitter.emit('providerSwitch', {
      from: fromProvider,
      to: toProvider,
      reason
    });
  };

  /**
   * Provider health management
   */
  const updateProviderHealth = (providerName: string, success: boolean, error?: string) => {
    const health = providerHealthStatus.get(providerName);
    if (!health) return;

    health.lastCheck = Date.now();
    
    if (success) {
      health.status = 'healthy';
      health.consecutiveFailures = 0;
    } else {
      health.consecutiveFailures++;
      if (health.consecutiveFailures >= 3) {
        health.status = 'unavailable';
      } else {
        health.status = 'degraded';
      }
    }

    providerHealthStatus.set(providerName, health);
  };

  /**
   * Rate limiting
   */
  const checkRateLimit = (providerName: string): boolean => {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 50; // requests per minute
    
    if (!rateLimitWindows.has(providerName)) {
      rateLimitWindows.set(providerName, []);
    }
    
    const requests = rateLimitWindows.get(providerName)!;
    
    // Remove old requests outside the window
    const cutoff = now - windowMs;
    while (requests.length > 0 && requests[0] < cutoff) {
      requests.shift();
    }
    
    if (requests.length >= maxRequests) {
      eventEmitter.emit('rateLimitHit', {
        provider: providerName,
        retryAfter: windowMs
      });
      return false;
    }
    
    requests.push(now);
    return true;
  };

  /**
   * Cache management
   */
  const generateCacheKey = (type: AnalysisType, data: unknown): string => {
    return `${type}:${JSON.stringify(data)}`;
  };

  const getCachedResult = (key: string): PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult | null => {
    const entry = cache.get(key);
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > cacheExpiryMs;
    if (isExpired) {
      cache.delete(key);
      return null;
    }
    
    entry.accessCount++;
    return entry.result;
  };

  const setCachedResult = (key: string, result: PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult) => {
    cache.set(key, {
      result,
      timestamp: Date.now(),
      accessCount: 1
    });
  };

  const clearCache = () => {
    cache.clear();
    logger.info('LLM cache cleared');
  };

  /**
   * Metrics and monitoring
   */
  const updateMetrics = (
    success: boolean, 
    responseTime: number,
    result?: PerformanceAnalysisResult | SituationalAwarenessResult | AdvisoryResult
  ) => {
    // Update average response time
    const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime;
    metrics.averageResponseTime = totalTime / metrics.totalRequests;

    // Update token usage if available
    if (result && 'usage' in result && result.usage) {
      // This would need to be extended based on actual result structure
      // For now, we'll track basic metrics
    }
  };

  const updateCacheHitRate = (hit: boolean) => {
    const totalCacheChecks = metrics.totalRequests;
    const currentHits = metrics.cacheHitRate * (totalCacheChecks - 1);
    const newHits = currentHits + (hit ? 1 : 0);
    metrics.cacheHitRate = newHits / totalCacheChecks;
  };

  const generateRequestId = (): string => {
    return `req_${++requestIdCounter}_${Date.now()}`;
  };

  /**
   * System capabilities
   */
  const getCapabilities = (): SystemCapabilities => {
    return {
      providers: llmProviders.map(p => ({
        provider: p.provider,
        model: p.model
      })),
      analysisTypes: ['performance-analysis', 'situational-awareness', 'advisory'],
      features: {
        caching: cachingEnabled,
        fallback: fallbackEnabled,
        concurrentRequests: maxConcurrentRequests,
        rateLimiting: true
      }
    };
  };

  /**
   * Get current metrics
   */
  const getMetrics = () => {
    const currentProvider = getCurrentProvider();
    
    const requestMetrics: RequestMetrics = {
      active: activeRequests.size,
      queued: requestQueue.length,
      cached: cache.size,
      completed: metrics.successfulRequests,
      failed: metrics.failedRequests
    };

    const providerMetrics: ProviderMetrics = {
      current: currentProvider.provider,
      available: llmProviders.length,
      requestCount: metrics.totalRequests,
      errorCount: metrics.failedRequests,
      averageResponseTime: metrics.averageResponseTime,
      lastError: undefined // Could be tracked separately
    };

    return {
      requests: requestMetrics,
      provider: providerMetrics
    };
  };

  /**
   * Event handling
   */
  const on = <K extends keyof LLMEvents>(event: K, listener: (data: LLMEvents[K]) => void) => {
    eventEmitter.on(event, listener);
  };

  const off = <K extends keyof LLMEvents>(event: K, listener: (data: LLMEvents[K]) => void) => {
    eventEmitter.off(event, listener);
  };

  const emit = <K extends keyof LLMEvents>(event: K, data: LLMEvents[K]) => {
    eventEmitter.emit(event, data);
  };

  // Initialize providers
  initializeProviders();

  return {
    analyze,
    getCapabilities,
    getMetrics,
    clearCache,
    on,
    off,
    emit
  };
};

/**
 * Health check for all providers
 */
export const performHealthCheck = async (integration: LLMIntegration): Promise<ProviderHealth[]> => {
  const capabilities = integration.getCapabilities();
  const healthResults: ProviderHealth[] = [];

  for (const providerInfo of capabilities.providers) {
    try {
      // This would need access to the actual provider instance
      // For now, we'll return basic health info
      healthResults.push({
        provider: providerInfo.provider,
        status: 'healthy',
        lastCheck: Date.now(),
        responseTime: 0,
        errorRate: 0,
        consecutiveFailures: 0
      });
    } catch (error) {
      healthResults.push({
        provider: providerInfo.provider,
        status: 'unavailable',
        lastCheck: Date.now(),
        responseTime: 0,
        errorRate: 1,
        consecutiveFailures: 1
      });
    }
  }

  return healthResults;
};

/**
 * Utility function to validate analysis data
 */
export const validateAnalysisData = (type: AnalysisType, data: unknown): boolean => {
  switch (type) {
    case 'performance-analysis':
      return typeof data === 'object' && data !== null;
    case 'situational-awareness':
      return typeof data === 'object' && data !== null;
    case 'advisory':
      return typeof data === 'object' && data !== null;
    default:
      return false;
  }
};