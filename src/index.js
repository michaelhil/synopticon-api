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

// Export other pipelines
export { createEyeTrackingPipeline } from './pipelines/eye-tracking-pipeline.js';
export { createIrisTrackingPipeline } from './pipelines/iris-tracking-pipeline.js';
export { createAgeEstimationPipeline } from './pipelines/age-estimation-pipeline.js';

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

// Export API server
export { createFaceAnalysisServer } from './api/minimal-server.js';

// Legacy engine for backward compatibility
import { createFaceAnalysisEngine } from './core/face-analysis-engine.js';
export { createFaceAnalysisEngine };

// Version information
export const VERSION = '0.1.0-beta.1'; // Initial beta release
export const BUILD = 'hybrid-universal';

// Default export for backward compatibility
export default createFaceAnalysisEngine;