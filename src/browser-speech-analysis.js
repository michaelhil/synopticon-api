/**
 * Browser-Only Speech Analysis Entry Point
 * Lightweight entry point for browser environments that avoids Node.js dependencies
 */

// Export only browser-compatible speech analysis components
export { createSpeechAnalysisPipeline } from './pipelines/speech-analysis-pipeline-hybrid.js';

// Export speech analysis components directly from their modules
export { createSpeechRecognition } from './speech-analysis/speech-recognition.js';
export { createLLMClient } from './speech-analysis/llm-client.js';

// Export core types needed for speech analysis
export { 
  createSpeechAnalysisResult,
  createSpeechEvent,
  createSpeechPipelineStatus,
  createLLMConfig,
  createAnalysisPromptResult
} from './core/types.js';

// Export runtime detection (browser-safe)
export { 
  detectRuntime, 
  checkFeatures
} from './utils/runtime-detector.js';

// Version information
export const VERSION = '0.5.1';
export const BUILD = 'browser-speech';