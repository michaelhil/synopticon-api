/**
 * Core Barrel Export
 * Centralized exports for all core functionality including new standardized systems
 */

// Core pipeline components
export { createPipeline } from './pipeline.js';
export { createOrchestrator } from './orchestrator.js';
export { createFaceAnalysisEngine } from './face-analysis-engine.js';

// NEW: Unified configuration system
export { 
  createPipelineConfig, 
  getDefaultConfig, 
  updateConfig, 
  areConfigsCompatible,
  getConfigSchema,
  SUPPORTED_PIPELINE_TYPES 
} from './pipeline-config.js';

// NEW: MediaPipe commons
export { 
  MEDIAPIPE_LANDMARKS,
  IRIS_LANDMARKS, 
  CANONICAL_FACE_MODEL_3D,
  DEFAULT_CAMERA_MATRIX,
  createMediaPipeBase,
  checkMediaPipeAvailability,
  extractKeyPoints,
  calculateEyeAspectRatio,
  extractIrisLandmarks,
  normalizeLandmarks,
  calculateFaceBoundingBox,
  createMediaPipeProcessor,
  createMediaPipeLoader
} from './mediapipe-commons.js';

// NEW: Resource pooling system
export { 
  createResourcePool, 
  getGlobalResourcePool, 
  setGlobalResourcePool 
} from './resource-pool.js';

// NEW: Shared image processing
export { 
  createImageProcessor, 
  IMAGE_FORMATS, 
  INTERPOLATION_METHODS 
} from './image-processor.js';

// NEW: Performance monitoring
export { 
  createPipelineMonitor, 
  MetricTypes, 
  PerformanceThresholds 
} from './pipeline-monitor.js';

// NEW: Standardized result types
export { 
  createBaseResult,
  createFaceResult as createStandardizedFaceResult,
  createEmotionResult as createStandardizedEmotionResult,
  createAgeResult as createStandardizedAgeResult,
  createGenderResult as createStandardizedGenderResult,
  createPoseResult,
  createEyeResult as createStandardizedEyeResult,
  createLandmarkResult,
  createAnalysisResult as createStandardizedAnalysisResult,
  createErrorResult,
  validateResult,
  mergeResults,
  convertResult,
  ResultStatus,
  ConfidenceLevel,
  getConfidenceLevel
} from './pipeline-results.js';

// NEW: Pipeline composition system
export { 
  createPipelineComposer, 
  CompositionPattern, 
  ExecutionStrategy 
} from './pipeline-composer.js';

// Legacy type definitions and factories (maintained for compatibility)
export { 
  Capability, 
  createPerformanceProfile, 
  createFaceResult, 
  createAnalysisResult,
  createPose3DOF,
  createPose6DOF,
  createEyeResult,
  createEmotionResult,
  createAgeResult,
  createGenderResult,
  createSpeechAnalysisResult,
  createSpeechEvent
} from './types.js';

// Legacy performance and monitoring (maintained for compatibility)
export { 
  createPerformanceMonitor,
  getGlobalMonitor,
  measureAsync 
} from './performance-monitor.js';

// Performance metrics collection
export {
  createPerformanceMetricsCollector,
  getGlobalMetricsCollector,
  measurePerformance
} from './performance-metrics.js';

// Memory optimization
export { 
  createOptimizedMemoryPool,
  createCircularBuffer,
  createMemoryOptimizer,
  createMemoryOptimizedStream
} from './memory-optimization.js';

// Event system
export { createPipelineEvents } from './pipeline-events.js';