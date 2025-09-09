/**
 * Lazy Pipeline Registry - TypeScript Implementation
 * Provides on-demand loading of pipeline modules with intelligent caching, 
 * retry logic, and comprehensive error handling.
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js'
import {
  type PipelineType,
  type PipelineLoader,
  type FactoryExtractor,
  type LazyPipelineRegistry,
  type LazyPipelineRegistryConfig,
  type RegistryState,
  type LoadingStateInfo,
  type PipelineRegistryMetrics,
  type PreloadResults,
  type PipelineFactory
} from './pipeline-types.js';

// Pipeline module mapping with lazy loading functions
const PIPELINE_LOADERS: Record<PipelineType, PipelineLoader> = {
  'mediapipe-face': () => import('../../features/face-detection/mediapipe-face-pipeline.js'),
  'mediapipe-face-mesh': () => import('../../features/face-detection/mediapipe-pipeline.js'),
  'emotion-analysis': () => import('../../features/emotion-analysis/emotion-analysis-pipeline.js'),
  'age-estimation': () => import('../../features/face-detection/age-estimation-pipeline.js'),
  'iris-tracking': () => import('../../features/eye-tracking/devices/webcam/pipeline.js'),
  'eye-tracking': () => import('../../features/eye-tracking/devices/neon/pipeline.js'),
  'webcam-eye-tracking': () => import('../../features/eye-tracking/devices/webcam/pipeline.js'),
  'neon-eye-tracking': () => import('../../features/eye-tracking/devices/neon/pipeline.js')
};

// Factory function extractors - maps pipeline type to export name
const FACTORY_EXTRACTORS: Record<PipelineType, FactoryExtractor> = {
  'mediapipe-face': (module) => module.createMediaPipeFacePipeline,
  'mediapipe-face-mesh': (module) => module.createMediaPipeFaceMeshPipeline,
  'emotion-analysis': (module) => module.createEmotionAnalysisPipeline,
  'age-estimation': (module) => module.createAgeEstimationPipeline,
  'iris-tracking': (module) => module.createIrisTrackingPipeline,
  'eye-tracking': (module) => module.createEyeTrackingPipeline,
  'webcam-eye-tracking': (module) => module.createIrisTrackingPipeline,
  'neon-eye-tracking': (module) => module.createEyeTrackingPipeline
};

// Critical pipelines that should be preloaded for optimal UX
const CRITICAL_PIPELINES: PipelineType[] = ['mediapipe-face'];

// Pipeline loading priorities (lower number = higher priority)
const LOADING_PRIORITIES: Record<PipelineType, number> = {
  'mediapipe-face': 1,
  'emotion-analysis': 2,
  'age-estimation': 3,
  'mediapipe-face-mesh': 4,
  'iris-tracking': 5,
  'eye-tracking': 6,
  'webcam-eye-tracking': 5,
  'neon-eye-tracking': 6
};

/**
 * Create lazy pipeline registry with advanced loading management
 */
export const createLazyPipelineRegistry = (config: Partial<LazyPipelineRegistryConfig> = {}): LazyPipelineRegistry => {
  // Validate configuration
  if (config.cacheSize !== undefined && config.cacheSize < 1) {
    throw new Error('Cache size must be positive');
  }
  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    throw new Error('Max retries must be non-negative');
  }

  const state: RegistryState = {
    config: {
      maxRetries: 3,
      retryDelay: 1000,
      cacheSize: 10,
      preloadCritical: true,
      enableMetrics: true,
      timeout: 30000,
      ...config
    },
    loadedPipelines: new Map(),
    loadingPromises: new Map(),
    failedLoads: new Map(),
    loadingStates: new Map(),
    metrics: {
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      uniqueLoads: 0,
      loadFailures: 0,
      averageLoadTime: 0,
      cacheHitRate: 0,
      loadTimes: []
    }
  };

  // Helper function to update loading state
  const updateLoadingState = (
    pipelineType: PipelineType,
    newState: LoadingStateInfo['state'],
    details: Partial<LoadingStateInfo> = {}
  ): void => {
    const existing = state.loadingStates.get(pipelineType);
    state.loadingStates.set(pipelineType, {
      type: pipelineType,
      state: newState,
      timestamp: Date.now(),
      ...existing,
      ...details
    });
  };

  /**
   * Load pipeline with retry logic and caching
   */
  const loadPipeline = async (pipelineType: PipelineType): Promise<PipelineFactory> => {
    // Validate pipeline type
    if (!PIPELINE_LOADERS[pipelineType]) {
      throw new Error(`Unknown pipeline type: ${pipelineType}`);
    }

    // Check cache first
    if (state.loadedPipelines.has(pipelineType)) {
      state.metrics.cacheHits++;
      handleError(
        `Pipeline ${pipelineType} loaded from cache`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.DEBUG,
        { pipelineType }
      );
      return state.loadedPipelines.get(pipelineType)!;
    }

    state.metrics.cacheMisses++;
    const startTime = Date.now();

    // Check if already loading (prevent duplicate requests)
    if (state.loadingPromises.has(pipelineType)) {
      handleError(
        `Pipeline ${pipelineType} already loading, returning existing promise`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { pipelineType }
      );
      return state.loadingPromises.get(pipelineType)!;
    }

    // Update metrics
    state.metrics.totalLoads++;
    updateLoadingState(pipelineType, 'loading', { startTime });

    // Create loading promise with retry logic
    const loadingPromise = (async (): Promise<PipelineFactory> => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= state.config.maxRetries; attempt++) {
        try {
          handleError(
            `Loading pipeline ${pipelineType} (attempt ${attempt}/${state.config.maxRetries})`,
            ErrorCategory.INITIALIZATION,
            ErrorSeverity.INFO,
            { pipelineType, attempt }
          );

          // Load the module
          const moduleLoader = PIPELINE_LOADERS[pipelineType];
          const module = await moduleLoader();
          
          // Extract factory function
          const factoryExtractor = FACTORY_EXTRACTORS[pipelineType];
          const pipelineFactory = factoryExtractor(module);
          
          if (typeof pipelineFactory !== 'function') {
            throw new Error(`Pipeline factory for ${pipelineType} is not a function`);
          }

          // Cache the factory with size management
          if (state.loadedPipelines.size >= state.config.cacheSize) {
            // Remove oldest entry to make space (LRU-like behavior)
            const firstKey = state.loadedPipelines.keys().next().value;
            if (firstKey) {
              state.loadedPipelines.delete(firstKey);
              handleError(
                `Cache evicted oldest pipeline: ${firstKey} (cache size: ${state.config.cacheSize})`,
                ErrorCategory.INITIALIZATION,
                ErrorSeverity.DEBUG,
                { evicted: firstKey, pipelineType }
              );
            }
          }
          
          state.loadedPipelines.set(pipelineType, pipelineFactory);
          state.loadingPromises.delete(pipelineType);
          state.failedLoads.delete(pipelineType);

          // Update metrics
          const loadTime = Date.now() - startTime;
          state.metrics.successfulLoads++;
          state.metrics.uniqueLoads++;
          state.metrics.loadTimes.push(loadTime);
          
          // Update average load time
          const totalTime = state.metrics.loadTimes.reduce((sum, time) => sum + time, 0);
          state.metrics.averageLoadTime = totalTime / state.metrics.loadTimes.length;

          updateLoadingState(pipelineType, 'loaded', { 
            loadTime,
            attempt,
            success: true 
          });

          handleError(
            `Pipeline ${pipelineType} loaded successfully in ${loadTime}ms (attempt ${attempt})`,
            ErrorCategory.INITIALIZATION,
            ErrorSeverity.INFO,
            { pipelineType, loadTime, attempt }
          );

          return pipelineFactory;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          handleError(
            `Pipeline ${pipelineType} loading failed (attempt ${attempt}): ${lastError.message}`,
            ErrorCategory.INITIALIZATION,
            attempt < state.config.maxRetries ? ErrorSeverity.WARNING : ErrorSeverity.ERROR,
            { pipelineType, attempt, error: lastError.message }
          );

          // Wait before retry (except on last attempt)
          if (attempt < state.config.maxRetries) {
            const delay = state.config.retryDelay * attempt; // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All attempts failed
      state.loadingPromises.delete(pipelineType);
      if (lastError) {
        state.failedLoads.set(pipelineType, {
          error: lastError,
          timestamp: Date.now(),
          attempts: state.config.maxRetries
        });
      }
      
      state.metrics.failedLoads++;
      state.metrics.loadFailures++;
      
      updateLoadingState(pipelineType, 'failed', { 
        error: lastError?.message,
        attempts: state.config.maxRetries,
        success: false 
      });

      throw new Error(`Failed to load pipeline ${pipelineType} after ${state.config.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
    })();

    // Store loading promise
    state.loadingPromises.set(pipelineType, loadingPromise);
    
    return loadingPromise;
  };

  /**
   * Preload critical pipelines in background
   */
  const preloadCriticalPipelines = async (criticalTypes: PipelineType[] = CRITICAL_PIPELINES): Promise<PreloadResults> => {
    if (!state.config.preloadCritical || criticalTypes.length === 0) {
      return { successful: [], failed: [], totalTime: 0 };
    }

    handleError(
      `Starting preload of ${criticalTypes.length} critical pipelines: ${criticalTypes.join(', ')`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { criticalTypes }
    );

    const results: PreloadResults = {
      successful: [],
      failed: [],
      totalTime: 0
    };

    const startTime = Date.now();
    
    // Sort by priority and load in order
    const sortedTypes = [...criticalTypes].sort((a, b) => 
      (LOADING_PRIORITIES[a] || 999) - (LOADING_PRIORITIES[b] || 999)
    );

    const preloadPromises = sortedTypes.map(async (type) => {
      try {
        await loadPipeline(type);
        results.successful.push(type);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ type, error: errorMessage });
        // Don't throw - continue with other preloads
      }
    });

    await Promise.allSettled(preloadPromises);
    
    results.totalTime = Date.now() - startTime;

    handleError(
      `Critical pipeline preload completed: ${results.successful.length} successful, ${results.failed.length} failed in ${results.totalTime}ms`,
      ErrorCategory.INITIALIZATION,
      results.failed.length > 0 ? ErrorSeverity.WARNING : ErrorSeverity.INFO,
      { results }
    );

    return results;
  };

  /**
   * Get loading state for a pipeline
   */
  const getLoadingState = (pipelineType: PipelineType): LoadingStateInfo => {
    return state.loadingStates.get(pipelineType) || {
      type: pipelineType,
      state: 'idle',
      timestamp: null
    };
  };

  /**
   * Check if pipeline is loaded
   */
  const isPipelineLoaded = (pipelineType: PipelineType): boolean => {
    return state.loadedPipelines.has(pipelineType);
  };

  /**
   * Clear pipeline cache
   */
  const clearCache = (): void => {
    state.loadedPipelines.clear();
    state.loadingPromises.clear();
    handleError(
      'Pipeline cache cleared',
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO
    );
  };

  /**
   * Clear failed loads
   */
  const clearFailedLoads = (): void => {
    state.failedLoads.clear();
    handleError(
      'Failed pipeline loads cleared',
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO
    );
  };

  /**
   * Get registry metrics
   */
  const getMetrics = (): PipelineRegistryMetrics => {
    // Update cache hit rate
    const totalRequests = state.metrics.cacheHits + state.metrics.cacheMisses;
    state.metrics.cacheHitRate = totalRequests > 0 ? 
      (state.metrics.cacheHits / totalRequests) * 100 : 0;

    return { ...state.metrics };
  };

  /**
   * Get available pipeline types
   */
  const getAvailablePipelines = (): PipelineType[] => {
    return Object.keys(PIPELINE_LOADERS) as PipelineType[];
  };

  /**
   * Get cached pipeline types
   */
  const getCachedPipelines = (): PipelineType[] => {
    return Array.from(state.loadedPipelines.keys());
  };

  /**
   * Get failed pipeline information
   */
  const getFailedPipelines = () => {
    return Array.from(state.failedLoads.entries()).map(([type, info]) => ({
      type,
      info
    }));
  };

  return {
    loadPipeline,
    preloadCriticalPipelines,
    getLoadingState,
    isPipelineLoaded,
    clearCache,
    clearFailedLoads,
    getMetrics,
    getAvailablePipelines,
    getCachedPipelines,
    getFailedPipelines
  };
};
