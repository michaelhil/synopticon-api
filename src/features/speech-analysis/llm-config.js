/**
 * LLM client configuration management
 */

// LLM backend definitions
export const LLM_BACKENDS = {
  webllm: {
    name: 'WebLLM (Browser)',
    description: 'Client-side LLM running in WebAssembly',
    availability: 'browser',
    modelSize: 'large',
    performance: 'high',
    privacy: 'excellent'
  },
  transformers_js: {
    name: 'Transformers.js',
    description: 'Hugging Face Transformers in JavaScript',
    availability: 'browser+node',
    modelSize: 'medium',
    performance: 'medium',
    privacy: 'excellent'
  },
  tfjs_models: {
    name: 'TensorFlow.js Models',
    description: 'Pre-trained TensorFlow.js models',
    availability: 'browser+node',
    modelSize: 'small-medium',
    performance: 'medium',
    privacy: 'excellent'
  },
  mock: {
    name: 'Mock Backend',
    description: 'Simulated responses for development',
    availability: 'universal',
    modelSize: 'none',
    performance: 'instant',
    privacy: 'perfect'
  }
};

// Default LLM configuration
export const createLLMConfig = (config = {}) => ({
  // Backend selection
  preferredBackend: config.preferredBackend || 'webllm',
  fallbackBackends: config.fallbackBackends || ['transformers_js', 'tfjs_models', 'mock'],
  
  // Model configuration
  model: config.model || 'Llama-2-7b-chat-hf-q4f16_1',
  temperature: config.temperature || 0.7,
  maxTokens: config.maxTokens || 150,
  contextLength: config.contextLength || 2048,
  
  // Performance settings
  maxConcurrentRequests: config.maxConcurrentRequests || 3,
  requestTimeout: config.requestTimeout || 30000,
  enableCache: config.enableCache !== false,
  cacheSize: config.cacheSize || 100,
  
  // Advanced settings
  enableStreaming: config.enableStreaming === true,
  enableQuantization: config.enableQuantization !== false,
  modelCacheEnabled: config.modelCacheEnabled !== false,
  compressionEnabled: config.compressionEnabled !== false,
  
  // Fallback behavior
  gracefulDegradation: config.gracefulDegradation !== false,
  maxRetries: config.maxRetries || 2,
  retryDelay: config.retryDelay || 1000,
  
  ...config
});

// Create LLM client state
export const createLLMState = (config) => ({
  runtime: null, // Will be set by detectRuntime()
  features: null, // Will be set by checkFeatures()
  config,
  activeBackend: null,
  loadedModel: null,
  isReady: false,
  requestQueue: [],
  isProcessing: false,
  cache: new Map(),
  
  // Performance metrics
  metrics: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    cacheHits: 0,
    backendSwitches: 0,
    totalProcessingTime: 0
  },
  
  // Event callbacks
  callbacks: {
    onReady: [],
    onError: [],
    onProgress: [],
    onBackendSwitch: []
  }
});