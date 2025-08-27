/**
 * LLM Client for Speech Analysis
 * 
 * Provides a unified interface for various LLM backends with automatic fallback,
 * intelligent caching, and comprehensive error handling for speech analysis tasks.
 * 
 * Features:
 * - Multiple backend support (WebLLM, Transformers.js, Mock)
 * - Automatic backend detection and fallback
 * - Intelligent response caching
 * - Performance metrics and monitoring
 * - Concurrent request management
 * - Graceful error handling and retry logic
 * 
 * @example
 * ```javascript
 * import { createLLMClient } from './llm-client.js';
 * 
 * const llmClient = createLLMClient({
 *   preferredBackend: 'webllm',
 *   fallbackBackends: ['transformers_js', 'mock'],
 *   enableCache: true
 * });
 * 
 * await llmClient.initialize();
 * const result = await llmClient.generate('Analyze sentiment', 'Hello world');
 * ```
 */

import { checkFeatures, detectRuntime } from '../../shared/utils/runtime-detector.js';
import { createAnalysisPromptResult } from '../../core/configuration/types.ts';
import { createLLMConfig, createLLMState } from './llm-config.js';
import { createBackendManager } from './llm-backends.js';
import { createLLMCache } from './llm-cache.js';
import { createMetricsTracker } from './llm-metrics.js';

// Create LLM client factory
export const createLLMClient = (config = {}) => {
  const llmConfig = createLLMConfig(config);
  const state = createLLMState(llmConfig);
  
  // Initialize runtime detection
  state.runtime = detectRuntime();
  state.features = checkFeatures();
  
  // Create components
  const backendManager = createBackendManager();
  const cache = createLLMCache(llmConfig.cacheSize, llmConfig.compressionEnabled);
  const metricsTracker = createMetricsTracker(state.callbacks);
  
  // Notify error callbacks
  const notifyError = (error) => {
    state.callbacks.onError.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.warn('LLM error callback failed:', callbackError);
      }
    });
  };
  
  // Notify progress callbacks
  const notifyProgress = (progress) => {
    state.callbacks.onProgress.forEach(callback => {
      try {
        callback(progress);
      } catch (callbackError) {
        console.warn('LLM progress callback failed:', callbackError);
      }
    });
  };

  // Initialize the best available backend
  const initialize = async () => {
    const bestBackend = await backendManager.findBestBackend(
      llmConfig.preferredBackend,
      llmConfig.fallbackBackends
    );
    
    if (!bestBackend) {
      throw new Error('No LLM backends available. All backends failed to initialize.');
    }
    
    try {
      const backend = backendManager.getBackend(bestBackend);
      const backendInfo = backendManager.getBackendInfo(bestBackend);
      
      console.log(`🔄 Initializing ${backendInfo?.name || bestBackend}...`);
      
      await backend.initialize(llmConfig);
      
      state.activeBackend = bestBackend;
      state.isReady = true;
      
      console.log(`✅ ${backendInfo?.name || bestBackend} initialized successfully`);
      
      // Notify ready callbacks
      state.callbacks.onReady.forEach(callback => {
        try {
          callback({ backend: bestBackend, model: llmConfig.model });
        } catch (error) {
          console.warn('LLM ready callback error:', error);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to initialize ${bestBackend}:`, error);
      notifyError(new Error(`${bestBackend} initialization failed: ${error.message}`));
      throw error;
    }
  };

  // Generate analysis using active backend
  const generate = async (prompt, text = '', systemPrompt = null) => {
    if (!state.isReady || !state.activeBackend) {
      throw new Error('LLM client not initialized');
    }

    const startTime = performance.now();
    
    try {
      // Check cache first
      if (llmConfig.enableCache && cache.has(prompt, text, systemPrompt)) {
        metricsTracker.recordCacheHit();
        const cachedResult = cache.get(prompt, text, systemPrompt);
        console.log('💾 Using cached response');
        return cachedResult;
      }

      // Get active backend
      const backend = backendManager.getBackend(state.activeBackend);
      if (!backend) {
        throw new Error(`Backend ${state.activeBackend} not available`);
      }

      // Generate response
      const response = await backend.generate(prompt, systemPrompt);
      const processingTime = performance.now() - startTime;
      
      // Cache the response
      if (llmConfig.enableCache) {
        cache.set(prompt, text, systemPrompt, response);
      }
      
      // Record success metrics
      metricsTracker.recordSuccess(processingTime);
      
      return response;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      metricsTracker.recordFailure(processingTime);
      
      console.warn('LLM generation failed:', error.message);
      notifyError(error);
      
      // Try fallback if graceful degradation is enabled
      if (llmConfig.gracefulDegradation) {
        return await attemptFallback(prompt, text, systemPrompt);
      }
      
      throw error;
    }
  };

  // Attempt fallback to other backends
  const attemptFallback = async (prompt, text, systemPrompt) => {
    const fallbackBackends = llmConfig.fallbackBackends.filter(b => b !== state.activeBackend);
    
    for (const backendName of fallbackBackends) {
      try {
        const backend = backendManager.getBackend(backendName);
        if (!backend) continue;
        
        const isAvailable = await backend.checkAvailability();
        if (!isAvailable) continue;
        
        console.log(`🔄 Switching to fallback backend: ${backendName}`);
        
        await backend.initialize(llmConfig);
        const response = await backend.generate(prompt, systemPrompt);
        
        // Record backend switch
        metricsTracker.recordBackendSwitch(state.activeBackend, backendName, 'fallback');
        state.activeBackend = backendName;
        
        return response;
      } catch (error) {
        console.warn(`Fallback to ${backendName} failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('All fallback backends failed');
  };

  // Generate multiple analyses with concurrency control
  const generateMultipleAnalyses = async (prompts, text, systemPrompt = null) => {
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return [];
    }

    notifyProgress({ stage: 'starting', total: prompts.length, completed: 0 });

    const results = [];
    const maxConcurrent = Math.min(prompts.length, llmConfig.maxConcurrentRequests);
    
    // Process prompts in batches to respect concurrency limits
    for (let i = 0; i < prompts.length; i += maxConcurrent) {
      const batch = prompts.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (prompt, index) => {
        const globalIndex = i + index;
        try {
          const startTime = performance.now();
          const result = await generate(prompt, text, systemPrompt);
          const processingTime = performance.now() - startTime;
          
          notifyProgress({ 
            stage: 'processing', 
            total: prompts.length, 
            completed: globalIndex + 1 
          });
          
          return createAnalysisPromptResult({
            prompt,
            result,
            confidence: 0.9, // Assume high confidence for successful generation
            processingTime
          });
        } catch (error) {
          console.warn(`Analysis ${globalIndex + 1} failed:`, error.message);
          return createAnalysisPromptResult({
            prompt,
            result: 'Analysis failed',
            confidence: 0,
            error: error.message
          });
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    notifyProgress({ stage: 'completed', total: prompts.length, completed: results.length });
    console.log(`✅ Completed ${results.length} analyses`);
    return results;
  };

  // Generate conversation summary
  const generateSummary = async (chunks, existingSummary = '') => {
    if (!chunks || chunks.length === 0) {
      return existingSummary || 'No conversation to summarize.';
    }

    const chunksText = chunks.join('\n\n');
    const summaryPrompt = existingSummary 
      ? `You have an existing conversation summary: "${existingSummary}"\n\nNew conversation chunks to integrate:\n${chunksText}\n\nCreate an updated summary that incorporates both the existing summary and new chunks. Keep it concise but comprehensive.`
      : `Create a concise summary of the following conversation chunks:\n${chunksText}\n\nSummary:`;

    try {
      return await generate(summaryPrompt, '', 'You are a helpful assistant that creates conversation summaries. Keep summaries concise and informative.');
    } catch (error) {
      console.warn('Summary generation failed:', error.message);
      return existingSummary || 'Summary generation failed.';
    }
  };

  // Get client status
  const getStatus = () => ({
    isReady: state.isReady,
    activeBackend: state.activeBackend,
    backendInfo: backendManager.getBackendInfo(state.activeBackend),
    model: llmConfig.model,
    metrics: metricsTracker.getMetrics(),
    performance: metricsTracker.getPerformanceStats(),
    cache: cache.getStats(),
    queueLength: state.requestQueue.length
  });

  // Cleanup resources
  const cleanup = async () => {
    if (state.activeBackend) {
      const backend = backendManager.getBackend(state.activeBackend);
      if (backend) {
        try {
          await backend.cleanup();
        } catch (error) {
          console.warn('LLM backend cleanup error:', error);
        }
      }
    }
    
    cache.clear();
    state.requestQueue.length = 0;
    state.isReady = false;
    state.activeBackend = null;
  };

  // Event handlers
  const onReady = (callback) => {
    state.callbacks.onReady.push(callback);
    return () => {
      const index = state.callbacks.onReady.indexOf(callback);
      if (index !== -1) state.callbacks.onReady.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  const onProgress = (callback) => {
    state.callbacks.onProgress.push(callback);
    return () => {
      const index = state.callbacks.onProgress.indexOf(callback);
      if (index !== -1) state.callbacks.onProgress.splice(index, 1);
    };
  };

  return {
    // Core functionality
    initialize,
    generate,
    generateMultipleAnalyses,
    generateSummary,
    
    // Information and status
    getStatus,
    isReady: () => state.isReady,
    getAvailableBackends: backendManager.getAvailableBackends,
    
    // Event handling
    onReady,
    onError,
    onProgress,
    
    // Configuration and maintenance
    getConfiguration: () => ({ ...llmConfig }),
    updateConfiguration: (updates) => Object.assign(llmConfig, updates),
    clearCache: cache.clear,
    getMetrics: metricsTracker.getMetrics,
    getPerformanceStats: metricsTracker.getPerformanceStats,
    
    // Lifecycle
    cleanup
  };
};