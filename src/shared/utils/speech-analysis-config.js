/**
 * Configuration management for speech analysis pipeline
 */

export const createSpeechAnalysisConfig = (config = {}) => ({
  // Speech recognition configuration
  language: config.language || 'en-US',
  continuous: config.continuous !== false,
  interimResults: config.interimResults !== false,
  
  // Analysis configuration
  prompts: config.prompts || [
    'Analyse sentiment, show as 5 keywords, nothing else.',
    'Identify most controversial statement and respond with a counterargument.',
    'Extract key themes and topics mentioned.',
    'Assess emotional tone and intensity level.'
  ],
  systemPrompt: config.systemPrompt || 
    'You are a helpful AI assistant analyzing speech from conversations. Always consider both the provided conversation context AND the current speech segment in your analysis. Keep all responses to 25 words or less.',
  
  // LLM backend preferences (JavaScript-only, no Python)
  preferredBackend: config.preferredBackend || 'webllm',
  fallbackBackends: config.fallbackBackends || ['transformers_js', 'tfjs_models', 'mock'],
  
  // Context management
  contextStrategy: config.contextStrategy || 'hybrid',
  maxChunks: config.maxChunks || 10,
  summaryThreshold: config.summaryThreshold || 20,
  
  // Processing options
  autoStart: config.autoStart === true,
  autoAnalyze: config.autoAnalyze !== false,
  enableSync: config.enableSync !== false,
  
  // Performance settings
  maxConcurrency: config.maxConcurrency || 2,
  requestTimeout: config.requestTimeout || 30000,
  
  // Fallback mode
  useFallback: config.useFallback === true,
  mockMode: config.mockMode === true,
  
  // Additional options
  ...config
});