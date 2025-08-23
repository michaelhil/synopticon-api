/**
 * JavaScript-Only LLM Client
 * Supports multiple backends without Python dependencies
 * Following functional programming patterns with factory functions
 */

import { detectRuntime, checkFeatures } from '../utils/runtime-detector.js';
import { 
  createLLMConfig, 
  createAnalysisPromptResult,
  createSpeechEvent 
} from '../core/types.js';

// LLM Backend priority order (avoiding Python dependencies)
const LLM_BACKENDS = {
  webllm: {
    name: 'WebLLM',
    description: 'Browser-native LLM inference using WebGPU',
    requirements: ['browser', 'webgpu'],
    pythonFree: true
  },
  transformers_js: {
    name: '@xenova/transformers',
    description: 'JavaScript port of Hugging Face transformers',
    requirements: ['browser', 'node'],
    pythonFree: true
  },
  tfjs_models: {
    name: 'TensorFlow.js',
    description: 'TensorFlow.js based text generation models',
    requirements: ['browser', 'node'],
    pythonFree: true
  },
  mock: {
    name: 'Mock Analysis',
    description: 'Simulated analysis for development and testing',
    requirements: ['browser', 'node'],
    pythonFree: true
  }
};

// Create LLM client factory
export const createLLMClient = (config = {}) => {
  const state = {
    runtime: detectRuntime(),
    features: checkFeatures(),
    config: createLLMConfig(config),
    activeBackend: null,
    loadedModel: null,
    isReady: false,
    requestQueue: [],
    isProcessing: false,
    cache: new Map(),
    
    // Performance optimizations
    enableQuantization: config.enableQuantization !== false,
    maxCacheSize: config.maxCacheSize || 100,
    compressionEnabled: config.compressionEnabled !== false,
    modelCacheEnabled: config.modelCacheEnabled !== false,
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      cacheHits: 0
    },
    callbacks: {
      onReady: [],
      onError: [],
      onProgress: []
    }
  };

  // Backend implementations
  const backends = {
    webllm: createWebLLMBackend(),
    transformers_js: createTransformersJSBackend(),
    tfjs_models: createTensorFlowJSBackend(),
    mock: createMockBackend()
  };

  // Initialize the best available backend
  const initialize = async () => {
    
    const backendPriority = [
      state.config.preferredBackend,
      ...state.config.fallbackBackends
    ].filter(Boolean);

    for (const backendName of backendPriority) {
      if (!backends[backendName]) {
        console.warn(`Unknown LLM backend: ${backendName}`);
        continue;
      }

      try {
        console.log(`🔄 Attempting to initialize ${LLM_BACKENDS[backendName]?.name}...`);
        const backend = backends[backendName];
        const isAvailable = await backend.checkAvailability();

        if (isAvailable) {
          state.activeBackend = backendName;
          await backend.initialize(state.config);
          state.isReady = true;
          
          console.log(`✅ ${LLM_BACKENDS[backendName]?.name} initialized successfully`);
          
          // Notify ready callbacks
          state.callbacks.onReady.forEach(callback => {
            try {
              callback({ backend: backendName, model: state.config.model });
            } catch (error) {
              console.warn('LLM ready callback error:', error);
            }
          });

          return true;
        }
      } catch (error) {
        console.warn(`Failed to initialize ${backendName}:`, error.message);
        notifyError(new Error(`${backendName} initialization failed: ${error.message}`));
        continue;
      }
    }

    throw new Error('No LLM backends available. All backends failed to initialize.');
  };

  // Generate analysis using active backend
  const generateAnalysis = async (prompt, text, systemPrompt = null) => {
    if (!state.isReady || !state.activeBackend) {
      throw new Error('LLM client not initialized');
    }

    const startTime = performance.now();
    state.metrics.totalRequests++;

    // Check cache first with optimizations
    const cacheKey = generateCacheKey(prompt, text, systemPrompt);
    if (state.config.enableCache && state.cache.has(cacheKey)) {
      state.metrics.cacheHits++;
      
      const cached = state.cache.get(cacheKey);
      cached.accessCount++; // Track access for LRU
      cached.lastAccess = Date.now();
      
      // Decompress if needed
      const result = cached.compressed ? 
        decompressResult(cached.data) : cached.data;
        
      return result;
    }

    try {
      const backend = backends[state.activeBackend];
      const result = await backend.generate({
        prompt,
        text,
        systemPrompt: systemPrompt || state.config.defaultSystemPrompt,
        temperature: state.config.temperature,
        maxTokens: state.config.maxTokens,
        topP: state.config.topP,
        topK: state.config.topK
      });

      // Update metrics
      const latency = performance.now() - startTime;
      state.metrics.successfulRequests++;
      state.metrics.averageLatency = 
        (state.metrics.averageLatency * (state.metrics.totalRequests - 1) + latency) / 
        state.metrics.totalRequests;

      // Cache result with optimizations
      if (state.config.enableCache) {
        manageCacheSize();
        
        // Compress result if enabled
        const cacheData = state.compressionEnabled ? 
          compressResult(result) : result;
          
        state.cache.set(cacheKey, {
          data: cacheData,
          timestamp: Date.now(),
          compressed: state.compressionEnabled,
          accessCount: 1
        });
      }

      return result;

    } catch (error) {
      state.metrics.failedRequests++;
      const analysisError = new Error(`Analysis failed: ${error.message}`);
      notifyError(analysisError);
      throw analysisError;
    }
  };

  // Process multiple prompts concurrently
  const generateMultipleAnalyses = async (prompts, text, systemPrompt = null) => {
    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error('No prompts provided for analysis');
    }

    console.log(`🔄 Processing ${prompts.length} analysis prompts...`);

    const results = [];
    const maxConcurrent = Math.min(prompts.length, state.config.maxConcurrentRequests);
    
    // Process prompts in batches to respect concurrency limits
    for (let i = 0; i < prompts.length; i += maxConcurrent) {
      const batch = prompts.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (prompt, index) => {
        const globalIndex = i + index;
        try {
          const startTime = performance.now();
          const result = await generateAnalysis(prompt, text, systemPrompt);
          const processingTime = performance.now() - startTime;
          
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
      return await generateAnalysis(summaryPrompt, '', 'You are a helpful assistant that creates conversation summaries. Keep summaries concise and informative.');
    } catch (error) {
      console.warn('Summary generation failed:', error.message);
      return existingSummary || 'Summary generation failed.';
    }
  };

  // Get client status
  const getStatus = () => ({
    isReady: state.isReady,
    activeBackend: state.activeBackend,
    backendInfo: state.activeBackend ? LLM_BACKENDS[state.activeBackend] : null,
    model: state.config.model,
    metrics: { ...state.metrics },
    cacheSize: state.cache.size,
    queueLength: state.requestQueue.length
  });

  // Cleanup resources
  const cleanup = async () => {
    if (state.activeBackend && backends[state.activeBackend]) {
      try {
        await backends[state.activeBackend].cleanup();
      } catch (error) {
        console.warn('LLM backend cleanup error:', error);
      }
    }
    
    state.cache.clear();
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

  // Utility functions
  const generateCacheKey = (prompt, text, systemPrompt) => {
    const content = `${systemPrompt || ''}|${prompt}|${text}`;
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  };

  const notifyError = (error) => {
    state.callbacks.onError.forEach(callback => {
      try {
        callback(error);
      } catch (cbError) {
        console.warn('LLM error callback failed:', cbError);
      }
    });
  };

  // Performance optimization helper functions
  const manageCacheSize = () => {
    if (state.cache.size < state.maxCacheSize) return;
    
    // LRU eviction based on access count and recency
    const entries = Array.from(state.cache.entries());
    entries.sort((a, b) => {
      const [, dataA] = a;
      const [, dataB] = b;
      
      // Score based on access count and recency (higher = keep)
      const scoreA = dataA.accessCount + (Date.now() - dataA.lastAccess) / (1000 * 60 * 60); // Hours
      const scoreB = dataB.accessCount + (Date.now() - dataB.lastAccess) / (1000 * 60 * 60);
      
      return scoreA - scoreB; // Lower score gets evicted first
    });
    
    // Remove least valuable entries until we're under the limit
    const toRemove = state.cache.size - Math.floor(state.maxCacheSize * 0.8); // Remove 20% buffer
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      state.cache.delete(entries[i][0]);
    }
  };

  const compressResult = (result) => {
    // Simple compression: remove extra whitespace and compress repetitive content
    if (typeof result === 'string') {
      return result
        .replace(/\s+/g, ' ')
        .trim();
    } else if (result && typeof result === 'object') {
      const compressed = { ...result };
      if (compressed.response) {
        compressed.response = compressed.response.replace(/\s+/g, ' ').trim();
      }
      if (compressed.reasoning) {
        compressed.reasoning = compressed.reasoning.replace(/\s+/g, ' ').trim();
      }
      return compressed;
    }
    return result;
  };

  const decompressResult = (compressedResult) => {
    // For simple compression, we just return as-is since we only removed whitespace
    return compressedResult;
  };

  return {
    // Core functionality
    initialize,
    generateAnalysis,
    generateMultipleAnalyses,
    generateSummary,
    cleanup,

    // Status and configuration
    getStatus,
    isReady: () => state.isReady,
    getActiveBackend: () => state.activeBackend,
    getConfig: () => ({ ...state.config }),

    // Event handlers
    onReady,
    onError,
    onProgress,

    // Advanced features
    clearCache: () => state.cache.clear(),
    getMetrics: () => ({ ...state.metrics }),
    
    // Backend information
    getSupportedBackends: () => Object.keys(LLM_BACKENDS),
    getBackendInfo: (backendName) => LLM_BACKENDS[backendName] || null
  };
};

// WebLLM Backend (Browser-native with WebGPU)
const createWebLLMBackend = () => {
  let webllm = null;
  let engine = null;

  const checkAvailability = async () => {
    const runtime = detectRuntime();
    const features = checkFeatures();

    if (!runtime.isBrowser) {
      console.log('⚠️ WebLLM requires browser environment');
      return false;
    }

    // Check for WebGPU support
    if (!features.webgpu) {
      console.log('⚠️ WebLLM requires WebGPU support');
      return false;
    }

    try {
      // Try to dynamically import WebLLM
      webllm = await import('https://esm.run/@mlc-ai/web-llm');
      return true;
    } catch (error) {
      console.log('⚠️ WebLLM not available:', error.message);
      return false;
    }
  };

  const initialize = async (config) => {
    if (!webllm) {
      throw new Error('WebLLM not loaded');
    }

    console.log('🔄 Initializing WebLLM engine...');
    
    engine = new webllm.MLCEngine();
    await engine.reload(config.model, {
      temperature: config.temperature,
      top_p: config.topP,
    });

    console.log('✅ WebLLM engine ready');
  };

  const generate = async ({ prompt, text, systemPrompt, temperature, maxTokens }) => {
    if (!engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}\n\nText to analyze: "${text}"\n\nAnalysis:`
      : `${prompt}\n\nText to analyze: "${text}"\n\nAnalysis:`;

    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: fullPrompt }],
      temperature,
      max_tokens: maxTokens
    });

    return response.choices[0]?.message?.content || 'No response generated';
  };

  const cleanup = async () => {
    if (engine) {
      // WebLLM cleanup if available
      engine = null;
    }
    webllm = null;
  };

  return {
    checkAvailability,
    initialize,
    generate,
    cleanup
  };
};

// Transformers.js Backend
const createTransformersJSBackend = () => {
  let transformers = null;
  let pipeline = null;

  const checkAvailability = async () => {
    try {
      transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      return true;
    } catch (error) {
      console.log('⚠️ @xenova/transformers not available:', error.message);
      return false;
    }
  };

  const initialize = async (config) => {
    if (!transformers) {
      throw new Error('Transformers.js not loaded');
    }

    console.log('🔄 Initializing Transformers.js pipeline...');
    
    // Use text-generation pipeline with a small model
    pipeline = await transformers.pipeline('text-generation', 'Xenova/gpt2', {
      device: 'webgpu', // Use WebGPU if available, fallback to CPU
    });

    console.log('✅ Transformers.js pipeline ready');
  };

  const generate = async ({ prompt, text, systemPrompt, temperature, maxTokens }) => {
    if (!pipeline) {
      throw new Error('Transformers.js pipeline not initialized');
    }

    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}\n\nText: "${text}"\n\nAnalysis:`
      : `${prompt}\n\nText: "${text}"\n\nAnalysis:`;

    const result = await pipeline(fullPrompt, {
      max_new_tokens: maxTokens || 50,
      temperature: temperature || 0.7,
      do_sample: true,
    });

    // Extract generated text (remove input prompt)
    const generated = result[0].generated_text;
    const analysis = generated.substring(fullPrompt.length).trim();
    
    return analysis || 'No analysis generated';
  };

  const cleanup = async () => {
    pipeline = null;
    transformers = null;
  };

  return {
    checkAvailability,
    initialize,
    generate,
    cleanup
  };
};

// TensorFlow.js Backend  
const createTensorFlowJSBackend = () => {
  let tf = null;
  let model = null;
  let tokenizer = null;

  const checkAvailability = async () => {
    try {
      tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');
      return true;
    } catch (error) {
      console.log('⚠️ TensorFlow.js not available:', error.message);
      return false;
    }
  };

  const initialize = async (config) => {
    if (!tf) {
      throw new Error('TensorFlow.js not loaded');
    }

    console.log('🔄 Initializing TensorFlow.js model...');
    
    // For now, we'll create a simple rule-based analyzer
    // In the future, this could load actual TF.js models
    console.log('✅ TensorFlow.js backend ready (rule-based)');
  };

  const generate = async ({ prompt, text, systemPrompt, temperature, maxTokens }) => {
    // Simple rule-based analysis as placeholder
    // This would be replaced with actual TF.js model inference
    
    const lowerText = text.toLowerCase();
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('sentiment')) {
      // Simple sentiment analysis
      const positive = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'like'];
      const negative = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'horrible'];
      
      const positiveCount = positive.reduce((count, word) => 
        count + (lowerText.split(word).length - 1), 0);
      const negativeCount = negative.reduce((count, word) => 
        count + (lowerText.split(word).length - 1), 0);
      
      if (positiveCount > negativeCount) {
        return 'positive, optimistic, favorable, upbeat, encouraging';
      } else if (negativeCount > positiveCount) {
        return 'negative, critical, unfavorable, pessimistic, concerning';
      } else {
        return 'neutral, balanced, measured, moderate, impartial';
      }
    }

    if (lowerPrompt.includes('controversial')) {
      // Simple controversial topic detection
      const controversial = ['politics', 'religion', 'money', 'controversial', 'debate', 'argue'];
      const hasControversial = controversial.some(word => lowerText.includes(word));
      
      if (hasControversial) {
        return 'Topic appears controversial. Consider multiple perspectives and seek common ground.';
      } else {
        return 'No obviously controversial statements detected.';
      }
    }

    // Generic analysis
    return `Analysis of "${text.substring(0, 30)}...": Text contains ${text.split(' ').length} words.`;
  };

  const cleanup = async () => {
    model = null;
    tokenizer = null;
    tf = null;
  };

  return {
    checkAvailability,
    initialize,
    generate,
    cleanup
  };
};

// Mock Backend for development and testing
const createMockBackend = () => {
  const checkAvailability = async () => {
    return true; // Always available
  };

  const initialize = async (config) => {
    console.log('🔄 Initializing mock LLM backend...');
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('✅ Mock LLM backend ready');
  };

  const generate = async ({ prompt, text, systemPrompt }) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const lowerPrompt = prompt.toLowerCase();
    const textLength = text.split(' ').length;

    // Generate contextual mock responses based on prompt type
    if (lowerPrompt.includes('sentiment')) {
      const sentiments = ['positive, upbeat, optimistic', 'negative, critical, pessimistic', 'neutral, balanced, measured'];
      return sentiments[Math.floor(Math.random() * sentiments.length)];
    }

    if (lowerPrompt.includes('controversial')) {
      const responses = [
        'No controversial content detected.',
        'Statement may be debatable. Consider alternative viewpoints.',
        'Topic touches on sensitive areas. Approach with nuance.'
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    if (lowerPrompt.includes('emotion')) {
      const emotions = ['calm, focused', 'excited, energetic', 'thoughtful, contemplative', 'confident, assertive'];
      return emotions[Math.floor(Math.random() * emotions.length)];
    }

    // Generic mock response
    return `Mock analysis: Text has ${textLength} words. ${prompt.substring(0, 20)}...`;
  };

  const cleanup = async () => {
    // No cleanup needed for mock
  };

  return {
    checkAvailability,
    initialize,
    generate,
    cleanup
  };
};

// Export default factory
export { createLLMClient };