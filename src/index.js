/**
 * Synopticon API - Main Entry Point with Code Splitting
 * Open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * 
 * This version uses lazy loading for optimal performance:
 * - Core components are loaded immediately
 * - Pipeline modules are loaded on-demand
 * - Critical pipelines can be preloaded intelligently
 */

// Import and re-export core orchestrator (always loaded)
import { createOrchestrator } from './core/orchestration/orchestrator.ts';
export { createOrchestrator };

// Export lazy loading infrastructure (always loaded)
export { createLazyPipelineRegistry } from './core/pipeline/lazy-pipeline-registry.ts';
export { createLoadingStateManager, LoadingStates, ProgressStages } from './core/state/loading-state-manager.js';
export { createPipelinePreloader, PreloadingStrategies, UsageContexts } from './core/pipeline/pipeline-preloader.js';

// Export UI components for loading states
export * from './shared/utils/ui/loading-components.js';

// Modern lazy loading approach only

// Lazy pipeline factory - creates pipelines on demand
export const createPipelineFactory = async (type, config = {}) => {
  const registry = createLazyPipelineRegistry();
  const factory = await registry.loadPipeline(type);
  return factory(config);
};

// Convenience function to create orchestrator with lazy loading
export const createLazyOrchestrator = (config = {}) => {
  const orchestrator = createOrchestrator(config);
  const registry = createLazyPipelineRegistry(config.lazyLoading);
  const preloader = createPipelinePreloader(config.preloading);
  
  // Initialize preloader with registry
  preloader.initialize(registry);
  
  // Enhanced orchestrator with lazy loading capabilities
  return {
    ...orchestrator,
    
    // Lazy pipeline registration
    registerPipelineByType: async (type, pipelineConfig = {}) => {
      const factory = await registry.loadPipeline(type);
      const pipeline = factory(pipelineConfig);
      return orchestrator.registerPipeline(pipeline);
    },
    
    // Batch register pipelines with intelligent loading
    registerPipelinesLazy: async (pipelineTypes, configs = {}) => {
      const pipelines = [];
      
      for (const type of pipelineTypes) {
        try {
          const factory = await registry.loadPipeline(type);
          const pipeline = factory(configs[type] || {});
          pipelines.push(pipeline);
        } catch (error) {
          console.warn(`Failed to load pipeline ${type}:`, error);
        }
      }
      
      return orchestrator.registerPipelinesParallel(pipelines, configs);
    },
    
    // Preloading control
    preloadPipeline: (type, strategy) => preloader.preloadPipeline(type, strategy),
    scheduleIntelligentPreloading: () => preloader.scheduleIntelligentPreloading(),
    
    // Lazy loading utilities
    isPipelineLoaded: (type) => registry.isPipelineLoaded(type),
    getLoadingState: (type) => registry.getLoadingState(type),
    onLoadingStateChange: (listener) => registry.onLoadingStateChange(listener),
    
    // Registry and preloader access
    getRegistry: () => registry,
    getPreloader: () => preloader,
    
    // Metrics
    getLazyLoadingMetrics: () => ({
      registry: registry.getMetrics(),
      preloader: preloader.getStatistics()
    })
  };
};

// Quick-start factory for common scenarios
export const createQuickStartOrchestrator = async (requirements = {}) => {
  const orchestrator = createLazyOrchestrator();
  
  // Determine pipelines needed based on requirements
  const pipelineTypes = [];
  
  if (requirements.faceDetection !== false) {
    pipelineTypes.push('mediapipe-face');
  }
  
  if (requirements.emotionAnalysis) {
    pipelineTypes.push('emotion-analysis');
  }
  
  if (requirements.ageEstimation) {
    pipelineTypes.push('age-estimation');
  }
  
  if (requirements.eyeTracking) {
    pipelineTypes.push('eye-tracking');
  }
  
  if (requirements.advancedFaceAnalysis) {
    pipelineTypes.push('mediapipe-face-mesh', 'iris-tracking');
  }
  
  // Register pipelines with intelligent loading
  await orchestrator.registerPipelinesLazy(pipelineTypes);
  
  return orchestrator;
};

// Export core components
export { createPipeline } from './core/pipeline/pipeline.ts';
export { 
  StreamCapability as Capability, 
  createPerformanceProfile, 
  createFaceResult, 
  createAnalysisResult,
  createPose3DOF,
  createPose6DOF 
} from './core/configuration/types.ts';

// Export utilities
export { 
  detectRuntime, 
  checkFeatures, 
  createUniversalCanvas,
  loadMediaPipe,
  imageToMediaPipe,
  getRuntimeInfo
} from './shared/utils/runtime-detector.js';

// Export performance monitoring
export { 
  createPerformanceMonitor,
  getGlobalMonitor,
  measureAsync 
} from './core/performance/performance-monitor.js';

// Export API server
export { createFaceAnalysisServer } from './services/api/server.ts';

// Export speech analysis components
export { createSpeechAnalysisAPI, createSpeechRecognition, createLLMClient } from './features/speech-analysis/index.js';

// Version information
export const VERSION = '0.5.6'; // Clean import structure, MQTT builtin implementation
export const BUILD = 'knip-optimized';