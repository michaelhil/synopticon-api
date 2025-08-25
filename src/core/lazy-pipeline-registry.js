/**
 * Lazy Pipeline Registry
 * 
 * Provides on-demand loading of pipeline modules with intelligent caching, 
 * retry logic, and comprehensive error handling. Optimized for performance
 * with metrics tracking and preloading capabilities.
 * 
 * Features:
 * - On-demand lazy loading with caching
 * - Automatic retry with exponential backoff
 * - Critical pipeline preloading
 * - Comprehensive metrics and statistics
 * - Priority-based loading strategies
 * - Configuration validation
 * - Cross-platform compatibility
 * 
 * Performance:
 * - Cache hits: ~0ms (instant)
 * - Average load time: varies by pipeline complexity
 * - Concurrent loading: supported with deduplication
 * - Memory efficient: configurable cache size limits
 * 
 * @example
 * ```javascript
 * import { createLazyPipelineRegistry } from './src/core/lazy-pipeline-registry.js';
 * 
 * const registry = createLazyPipelineRegistry({
 *   maxRetries: 3,
 *   cacheSize: 10,
 *   preloadCritical: true
 * });
 * 
 * // Load a pipeline (with automatic caching)
 * const factory = await registry.loadPipeline('mediapipe-face');
 * const pipeline = factory({ config: 'value' });
 * 
 * // Preload critical pipelines
 * await registry.preloadCriticalPipelines(['mediapipe-face']);
 * 
 * // Monitor performance
 * const metrics = registry.getMetrics();
 * console.log(`Cache hit rate: ${metrics.cacheHitRate}%`);
 * ```
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../shared/utils/error-handler.js';

// Pipeline module mapping with lazy loading functions
const PIPELINE_LOADERS = {
  'mediapipe-face': () => import('../features/face-detection/mediapipe-face-pipeline.js'),
  'mediapipe-face-mesh': () => import('../features/face-detection/mediapipe-pipeline.js'),
  'emotion-analysis': () => import('../features/emotion-analysis/emotion-analysis-pipeline.js'),
  'age-estimation': () => import('../features/face-detection/age-estimation-pipeline.js'),
  'iris-tracking': () => import('../features/eye-tracking/iris-tracking-pipeline.js'),
  'eye-tracking': () => import('../features/eye-tracking/eye-tracking-pipeline.js')
};

// Factory function extractors - maps pipeline type to export name
const FACTORY_EXTRACTORS = {
  'mediapipe-face': (module) => module.createMediaPipeFacePipeline,
  'mediapipe-face-mesh': (module) => module.createMediaPipeFaceMeshPipeline,
  'emotion-analysis': (module) => module.createEmotionAnalysisPipeline,
  'age-estimation': (module) => module.createAgeEstimationPipeline,
  'iris-tracking': (module) => module.createIrisTrackingPipeline,
  'eye-tracking': (module) => module.createEyeTrackingPipeline
};

// Critical pipelines that should be preloaded for optimal UX
const CRITICAL_PIPELINES = ['mediapipe-face'];

// Pipeline loading priorities (lower number = higher priority)
const LOADING_PRIORITIES = {
  'mediapipe-face': 1,
  'emotion-analysis': 2,
  'age-estimation': 3,
  'mediapipe-face-mesh': 4,
  'iris-tracking': 5,
  'eye-tracking': 6
};

/**
 * Create lazy pipeline registry with advanced loading management
 * @param {Object} config - Registry configuration
 * @returns {Object} - Registry instance
 */
export const createLazyPipelineRegistry = (config = {}) => {
  // Validate configuration
  if (config.cacheSize !== undefined && config.cacheSize < 1) {
    throw new Error('Cache size must be positive');
  }
  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    throw new Error('Max retries must be non-negative');
  }

  const state = {
    config: {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      cacheSize: config.cacheSize || 10,
      preloadCritical: config.preloadCritical !== false,
      enableMetrics: config.enableMetrics !== false,
      ...config
    },
    
    // Caching
    loadedPipelines: new Map(),
    loadingPromises: new Map(),
    failedLoads: new Map(),
    
    // Metrics
    metrics: {
      totalLoads: 0,
      uniqueLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      loadFailures: 0,
      cacheHits: 0,
      averageLoadTime: 0,
      loadTimes: []
    },
    
    // Loading state management
    loadingStates: new Map(),
    stateListeners: new Set()
  };

  /**
   * Update loading state and notify listeners
   * @param {string} pipelineType - Pipeline type
   * @param {string} newState - New loading state
   * @param {Object} metadata - Additional metadata
   */
  const updateLoadingState = (pipelineType, newState, metadata = {}) => {
    const stateData = {
      type: pipelineType,
      state: newState,
      timestamp: Date.now(),
      ...metadata
    };
    
    state.loadingStates.set(pipelineType, stateData);
    
    // Notify all listeners
    state.stateListeners.forEach(listener => {
      try {
        listener(stateData);
      } catch (error) {
        console.warn('Loading state listener error:', error);
      }
    });
  };

  /**
   * Load pipeline module with retry logic and error handling
   * @param {string} pipelineType - Type of pipeline to load
   * @returns {Promise<Function>} - Pipeline factory function
   */
  const loadPipeline = async (pipelineType) => {
    const startTime = Date.now();
    
    // Validate pipeline type (protect against prototype pollution)
    if (!PIPELINE_LOADERS.hasOwnProperty(pipelineType)) {
      const error = new Error(`Unknown pipeline type: ${pipelineType}. Available types: ${Object.keys(PIPELINE_LOADERS).join(', ')}`);
      handleError(
        error.message,
        ErrorCategory.VALIDATION,
        ErrorSeverity.ERROR,
        { pipelineType, availableTypes: Object.keys(PIPELINE_LOADERS) }
      );
      throw error;
    }

    // Return cached pipeline factory
    if (state.loadedPipelines.has(pipelineType)) {
      state.metrics.totalLoads++;
      state.metrics.cacheHits++;
      updateLoadingState(pipelineType, 'cached', { 
        loadTime: 0,
        cacheHit: true 
      });
      
      handleError(
        `Pipeline ${pipelineType} loaded from cache`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { pipelineType, cached: true }
      );
      
      return state.loadedPipelines.get(pipelineType);
    }

    // Return existing loading promise to avoid duplicate loads
    if (state.loadingPromises.has(pipelineType)) {
      handleError(
        `Pipeline ${pipelineType} already loading, returning existing promise`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { pipelineType }
      );
      return state.loadingPromises.get(pipelineType);
    }

    // Update metrics
    state.metrics.totalLoads++;
    updateLoadingState(pipelineType, 'loading', { startTime });

    // Create loading promise with retry logic
    const loadingPromise = (async () => {
      let lastError;
      
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
          lastError = error;
          
          handleError(
            `Pipeline ${pipelineType} loading failed (attempt ${attempt}): ${error.message}`,
            ErrorCategory.INITIALIZATION,
            attempt < state.config.maxRetries ? ErrorSeverity.WARNING : ErrorSeverity.ERROR,
            { pipelineType, attempt, error: error.message }
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
      state.failedLoads.set(pipelineType, {
        error: lastError,
        timestamp: Date.now(),
        attempts: state.config.maxRetries
      });
      
      state.metrics.failedLoads++;
      state.metrics.loadFailures++;
      
      updateLoadingState(pipelineType, 'failed', { 
        error: lastError.message,
        attempts: state.config.maxRetries,
        success: false 
      });

      throw new Error(`Failed to load pipeline ${pipelineType} after ${state.config.maxRetries} attempts: ${lastError.message}`);
    })();

    // Store loading promise
    state.loadingPromises.set(pipelineType, loadingPromise);
    
    return loadingPromise;
  };

  /**
   * Preload critical pipelines in background
   * @param {Array} criticalTypes - Pipeline types to preload
   * @returns {Promise<Object>} - Preload results
   */
  const preloadCriticalPipelines = async (criticalTypes = CRITICAL_PIPELINES) => {
    if (!state.config.preloadCritical || criticalTypes.length === 0) {
      return { successful: [], failed: [] };
    }

    handleError(
      `Starting preload of ${criticalTypes.length} critical pipelines: ${criticalTypes.join(', ')}`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { criticalTypes }
    );

    const results = {
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
        results.failed.push({ type, error: error.message });
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
   * @param {string} pipelineType - Pipeline type
   * @returns {Object} - Loading state information
   */
  const getLoadingState = (pipelineType) => {
    return state.loadingStates.get(pipelineType) || {
      type: pipelineType,
      state: 'idle',
      timestamp: null
    };
  };

  /**
   * Check if pipeline is loaded
   * @param {string} pipelineType - Pipeline type
   * @returns {boolean} - True if pipeline is loaded
   */
  const isPipelineLoaded = (pipelineType) => {
    return state.loadedPipelines.has(pipelineType);
  };

  /**
   * Get all loaded pipeline types
   * @returns {Array<string>} - List of loaded pipeline types
   */
  const getLoadedPipelineTypes = () => {
    return Array.from(state.loadedPipelines.keys());
  };

  /**
   * Clear pipeline cache (useful for testing or memory management)
   * @param {string} pipelineType - Specific pipeline to clear, or undefined for all
   */
  const clearCache = (pipelineType) => {
    if (pipelineType) {
      state.loadedPipelines.delete(pipelineType);
      state.loadingPromises.delete(pipelineType);
      state.failedLoads.delete(pipelineType);
      state.loadingStates.delete(pipelineType);
      
      handleError(
        `Cache cleared for pipeline: ${pipelineType}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { pipelineType }
      );
    } else {
      // Clear all caches
      state.loadedPipelines.clear();
      state.loadingPromises.clear();
      state.failedLoads.clear();
      state.loadingStates.clear();
      
      // Reset metrics
      state.metrics = {
        totalLoads: 0,
        successfulLoads: 0,
        failedLoads: 0,
        cacheHits: 0,
        averageLoadTime: 0,
        loadTimes: []
      };
      
      handleError(
        'All pipeline caches cleared',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO
      );
    }
  };

  /**
   * Subscribe to loading state changes
   * @param {Function} listener - State change listener
   * @returns {Function} - Unsubscribe function
   */
  const onLoadingStateChange = (listener) => {
    if (typeof listener !== 'function') {
      throw new Error('Loading state listener must be a function');
    }
    
    state.stateListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      state.stateListeners.delete(listener);
    };
  };

  /**
   * Get comprehensive metrics about pipeline loading
   * @returns {Object} - Loading metrics
   */
  const getMetrics = () => {
    return {
      ...state.metrics,
      loadedCount: state.loadedPipelines.size,
      loadingCount: state.loadingPromises.size,
      failedCount: state.failedLoads.size,
      successRate: state.metrics.totalLoads > 0 ? 
        (state.metrics.successfulLoads / state.metrics.totalLoads) * 100 : 0,
      cacheHitRate: state.metrics.totalLoads > 0 ?
        (state.metrics.cacheHits / state.metrics.totalLoads) * 100 : 0
    };
  };

  // Initialize by preloading critical pipelines if enabled
  if (state.config.preloadCritical) {
    // Don't await - let it happen in background
    preloadCriticalPipelines().catch(error => {
      handleError(
        `Critical pipeline preload failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.WARNING,
        { error: error.message }
      );
    });
  }

  return {
    // Core loading functionality
    loadPipeline,
    preloadCriticalPipelines,
    
    // State management
    getLoadingState,
    onLoadingStateChange,
    isPipelineLoaded,
    getLoadedPipelineTypes,
    
    // Metrics and debugging
    getMetrics,
    clearCache,
    
    // Configuration
    getConfig: () => ({ ...state.config }),
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
    },
    
    // Utilities
    getAvailablePipelineTypes: () => Object.keys(PIPELINE_LOADERS),
    getCriticalPipelineTypes: () => [...CRITICAL_PIPELINES],
    getPipelinePriority: (type) => LOADING_PRIORITIES[type] || 999
  };
};