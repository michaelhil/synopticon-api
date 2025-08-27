/**
 * Speech Analysis Module - Compatibility Layer
 * Provides backward compatibility while using the new modular TypeScript implementation
 */

import createSpeechAnalysisAPI, {
  validatePrompts,
  suggestPrompts,
  analyzeContext,
  CONTEXT_STRATEGIES,
  createSpeechRecognitionResult,
  createSpeechAnalysisResult,
  createConversationContext,
  createLLMConfig,
  createSpeechPipelineStatus,
  createSpeechEvent
} from './core/index.ts';

// Import remaining core factory functions for backward compatibility
import { createSpeechRecognition } from './speech-recognition.js';
import { createLLMClient } from './llm-client.js';
import { DEFAULT_STREAM_CONFIG } from './streaming.js';

// Export all utility functions and factories
export {
  // Utilities
  validatePrompts,
  suggestPrompts,
  analyzeContext,
  CONTEXT_STRATEGIES,
  DEFAULT_STREAM_CONFIG
};

// Export core factory functions
export {
  createSpeechRecognition,
  createLLMClient
};

// Export factory functions from types
export {
  createSpeechRecognitionResult,
  createSpeechAnalysisResult,
  createConversationContext,
  createLLMConfig,
  createSpeechPipelineStatus,
  createSpeechEvent
};

// Main API factory is imported and exported above

// Default API instance factory (backward compatibility)
export const createSpeechAnalysis = (config = {}) => {
  return createSpeechAnalysisAPI(config);
};

// Default export
