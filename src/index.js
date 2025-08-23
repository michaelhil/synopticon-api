/**
 * Synopticon API - Main Entry Point
 * Open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 */

// Import and re-export core orchestrator
import { createOrchestrator } from './core/orchestrator.js';
export { createOrchestrator };

// Export hybrid pipelines (primary interfaces)
export { createBlazeFacePipeline } from './pipelines/blazeface-pipeline-hybrid.js';
export { createMediaPipeFaceMeshPipeline } from './pipelines/mediapipe-pipeline-hybrid.js';
export { createEmotionAnalysisPipeline } from './pipelines/emotion-analysis-pipeline-hybrid.js';
export { createIrisTrackingPipeline } from './pipelines/iris-tracking-pipeline-hybrid.js';
export { createAgeEstimationPipeline } from './pipelines/age-estimation-pipeline-hybrid.js';
export { createSpeechAnalysisPipeline } from './pipelines/speech-analysis-pipeline-hybrid.js';

// Export other pipelines
export { createEyeTrackingPipeline } from './pipelines/eye-tracking-pipeline.js';

// Export core components
export { createPipeline } from './core/pipeline.js';
export { 
  Capability, 
  createPerformanceProfile, 
  createFaceResult, 
  createAnalysisResult,
  createPose3DOF,
  createPose6DOF 
} from './core/types.js';

// Export utilities
export { 
  detectRuntime, 
  checkFeatures, 
  loadTensorFlow,
  createUniversalCanvas 
} from './utils/runtime-detector.js';

// Export performance monitoring
export { 
  createPerformanceMonitor,
  getGlobalMonitor,
  measureAsync 
} from './core/performance-monitor.js';

// Export API server
export { createFaceAnalysisServer } from './api/minimal-server.js';

// Export speech analysis components
export { createSpeechAnalysisAPI, createSpeechRecognition, createLLMClient } from './speech-analysis/index.js';

// Legacy engine for backward compatibility
import { createFaceAnalysisEngine } from './core/face-analysis-engine.js';
export { createFaceAnalysisEngine };

// Version information
export const VERSION = '0.3.0-beta.3'; // Security hardening, performance monitoring, hybrid migration complete
export const BUILD = 'hybrid-universal';

// Default export for backward compatibility
export default createFaceAnalysisEngine;