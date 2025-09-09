/**
 * @fileoverview Synopticon API - Main Entry Point with Code Splitting
 * 
 * Open-source platform for real-time multi-modal behavioral analysis and sensor synchronization.
 * This version uses lazy loading for optimal performance with comprehensive TypeScript support.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// Import and re-export core orchestrator (always loaded)
import { createOrchestrator } from './core/orchestration/orchestrator.js';
export { createOrchestrator };

// Export lazy loading infrastructure (always loaded)
export { createLazyPipelineRegistry } from './core/pipeline/lazy-pipeline-registry.js';
export { createLoadingStateManager, LoadingStates, ProgressStages } from './core/state/loading-state-manager.js';
export { createPipelinePreloader, PreloadingStrategies, UsageContexts } from './core/pipeline/pipeline-preloader.js';

// Export UI components for loading states
export * from './shared/utils/ui/loading-components.js';

/**
 * Pipeline factory configuration
 */
export interface PipelineFactoryConfig {
  [key: string]: unknown;
}

/**
 * Requirements for quick-start orchestrator
 */
export interface QuickStartRequirements {
  faceDetection?: boolean;
  emotionAnalysis?: boolean;
  ageEstimation?: boolean;
  eyeTracking?: boolean;
  advancedFaceAnalysis?: boolean;
}

/**
 * Lazy orchestrator configuration
 */
export interface LazyOrchestratorConfig {
  lazyLoading?: {
    enabled?: boolean;
    preloadCritical?: boolean;
    cacheTimeout?: number;
  };
  preloading?: {
    strategy?: 'aggressive' | 'conservative' | 'intelligent';
    maxConcurrent?: number;
    priorityThreshold?: number;
  };
}

/**
 * Enhanced orchestrator with lazy loading capabilities
 */
export interface LazyOrchestrator {
  // Standard orchestrator methods
  start: () => Promise<void>;
  stop: () => Promise<void>;
  registerPipeline: (pipeline: any) => Promise<string>;
  registerPipelinesParallel: (pipelines: any[], configs?: any) => Promise<string[]>;
  
  // Lazy loading specific methods
  registerPipelineByType: (type: string, pipelineConfig?: PipelineFactoryConfig) => Promise<string>;
  registerPipelinesLazy: (pipelineTypes: string[], configs?: Record<string, PipelineFactoryConfig>) => Promise<any[]>;
  
  // Preloading control
  preloadPipeline: (type: string, strategy?: string) => Promise<void>;
  scheduleIntelligentPreloading: () => Promise<void>;
  
  // Lazy loading utilities
  isPipelineLoaded: (type: string) => boolean;
  getLoadingState: (type: string) => string;
  onLoadingStateChange: (listener: (state: any) => void) => void;
  
  // Registry and preloader access
  getRegistry: () => any;
  getPreloader: () => any;
  
  // Metrics
  getLazyLoadingMetrics: () => {
    registry: any;
    preloader: any;
  };
}

/**
 * Lazy pipeline factory - creates pipelines on demand
 */
export const createPipelineFactory = async (type: string, config: PipelineFactoryConfig = {}): Promise<any> => {
  const registry = createLazyPipelineRegistry();
  const factory = await registry.loadPipeline(type);
  return factory(config);
};

/**
 * Convenience function to create orchestrator with lazy loading
 */
export const createLazyOrchestrator = (config: LazyOrchestratorConfig = {}): LazyOrchestrator => {
  const orchestrator = createOrchestrator(config);
  const registry = createLazyPipelineRegistry(config.lazyLoading);
  const preloader = createPipelinePreloader(config.preloading);
  
  // Initialize preloader with registry
  preloader.initialize(registry);
  
  // Enhanced orchestrator with lazy loading capabilities
  return {
    ...orchestrator,
    
    // Lazy pipeline registration
    registerPipelineByType: async (type: string, pipelineConfig: PipelineFactoryConfig = {}) => {
      const factory = await registry.loadPipeline(type);
      const pipeline = factory(pipelineConfig);
      return orchestrator.registerPipeline(pipeline);
    },
    
    // Batch register pipelines with intelligent loading
    registerPipelinesLazy: async (
      pipelineTypes: string[], 
      configs: Record<string, PipelineFactoryConfig> = {}
    ) => {
      const pipelines: any[] = [];
      
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
    preloadPipeline: (type: string, strategy?: string) => preloader.preloadPipeline(type, strategy),
    scheduleIntelligentPreloading: () => preloader.scheduleIntelligentPreloading(),
    
    // Lazy loading utilities
    isPipelineLoaded: (type: string) => registry.isPipelineLoaded(type),
    getLoadingState: (type: string) => registry.getLoadingState(type),
    onLoadingStateChange: (listener: (state: any) => void) => registry.onLoadingStateChange(listener),
    
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

/**
 * Quick-start factory for common scenarios
 */
export const createQuickStartOrchestrator = async (
  requirements: QuickStartRequirements = {}
): Promise<LazyOrchestrator> => {
  const orchestrator = createLazyOrchestrator();
  
  // Determine pipelines needed based on requirements
  const pipelineTypes: string[] = [];
  
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
export { createPipeline } from './core/pipeline/pipeline.js';
export { 
  StreamCapability as Capability, 
  createPerformanceProfile, 
  createFaceResult, 
  createAnalysisResult,
  createPose3DOF,
  createPose6DOF 
} from './core/configuration/types.js';

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
export { createFaceAnalysisServer } from './services/api/server.js';

// Export speech analysis components
export { createSpeechAnalysisAPI, createSpeechRecognition, createLLMClient } from './features/speech-analysis/index.js';

// Version information
export const VERSION = '1.0.0'; // Full TypeScript conversion with modular architecture
export const BUILD = 'typescript-modular';

/**
 * Main API constants
 */
export const API_INFO = {
  VERSION,
  BUILD,
  CAPABILITIES: [
    'face-detection',
    'emotion-analysis',
    'age-estimation',
    'eye-tracking',
    'iris-tracking',
    'speech-analysis',
    'performance-monitoring',
    'lazy-loading'
  ],
  TYPESCRIPT: true,
  MODULAR: true
} as const;

/**
 * Type exports for external use
 */
export type {
  PipelineFactoryConfig,
  QuickStartRequirements,
  LazyOrchestratorConfig,
  LazyOrchestrator
};
