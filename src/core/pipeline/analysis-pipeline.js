/**
 * Core Analysis Pipeline - Composable processing pipeline
 * Uses functional composition pattern for chaining analysis modules
 */

import { createModuleRegistry } from '../integration/module-interface.js';

export const createAnalysisPipeline = (config = {}) => {
  const state = {
    modules: [],
    registry: createModuleRegistry(),
    isInitialized: false,
    config: {
      enablePerformanceMonitoring: true,
      maxConcurrentProcessing: 1,
      errorHandling: 'throw', // 'throw' | 'skip' | 'fallback'
      ...config
    },
    stats: {
      totalProcessed: 0,
      totalErrors: 0,
      averagePipelineTime: 0,
      lastProcessingTime: 0
    }
  };

  const addModule = (moduleConfig) => {
    const { category, algorithm, config: moduleSpecificConfig = {}, optional = false } = moduleConfig;
    
    if (!category || !algorithm) {
      throw new Error('Module config must specify category and algorithm');
    }

    state.modules.push({
      category,
      algorithm,
      config: moduleSpecificConfig,
      optional,
      instance: null
    });

    return pipeline;
  };

  const removeModule = (category, algorithm = null) => {
    const initialLength = state.modules.length;
    
    if (algorithm) {
      state.modules = state.modules.filter(m => 
        !(m.category === category && m.algorithm === algorithm)
      );
    } else {
      state.modules = state.modules.filter(m => m.category !== category);
    }

    return state.modules.length !== initialLength;
  };

  const initialize = async () => {
    try {
      // Initialize all modules
      for (const moduleConfig of state.modules) {
        try {
          const moduleInstance = await state.registry.load(
            moduleConfig.category,
            moduleConfig.algorithm,
            moduleConfig.config
          );
          moduleConfig.instance = moduleInstance;
          console.log(`✅ Loaded ${moduleConfig.category}:${moduleConfig.algorithm}`);
        } catch (error) {
          if (moduleConfig.optional) {
            console.warn(`⚠️ Optional module ${moduleConfig.category}:${moduleConfig.algorithm} failed to load:`, error.message);
            moduleConfig.instance = null;
          } else {
            throw new Error(`Required module ${moduleConfig.category}:${moduleConfig.algorithm} failed to load: ${error.message}`);
          }
        }
      }

      state.isInitialized = true;
      console.log(`🚀 Pipeline initialized with ${state.modules.filter(m => m.instance).length} modules`);
      
      return {
        totalModules: state.modules.length,
        loadedModules: state.modules.filter(m => m.instance).length,
        failedOptionalModules: state.modules.filter(m => !m.instance && m.optional).length
      };
    } catch (error) {
      state.isInitialized = false;
      throw error;
    }
  };

  const process = async (input, context = {}) => {
    if (!state.isInitialized) {
      throw new Error('Pipeline not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    const results = { input, stages: [], metadata: { processingTime: 0, errors: [] } };
    let currentData = input;

    try {
      // Process through each module in sequence
      for (const moduleConfig of state.modules) {
        if (!moduleConfig.instance) {
          // Skip unavailable optional modules
          if (moduleConfig.optional) {
            continue;
          } else {
            throw new Error(`Required module ${moduleConfig.category}:${moduleConfig.algorithm} is not available`);
          }
        }

        const stageStartTime = performance.now();
        
        try {
          const stageResult = await moduleConfig.instance.process(currentData, {
            ...context,
            pipelineStage: moduleConfig.category,
            previousResults: results.stages
          });

          const stageTime = performance.now() - stageStartTime;

          results.stages.push({
            category: moduleConfig.category,
            algorithm: moduleConfig.algorithm,
            result: stageResult,
            processingTime: stageTime,
            success: true
          });

          // Update current data for next stage
          if (stageResult && typeof stageResult === 'object') {
            currentData = { ...currentData, [`${moduleConfig.category}Result`]: stageResult };
          }

        } catch (stageError) {
          const stageTime = performance.now() - stageStartTime;
          
          results.stages.push({
            category: moduleConfig.category,
            algorithm: moduleConfig.algorithm,
            error: stageError.message,
            processingTime: stageTime,
            success: false
          });

          results.metadata.errors.push({
            stage: moduleConfig.category,
            algorithm: moduleConfig.algorithm,
            error: stageError.message
          });

          // Handle error based on configuration
          if (state.config.errorHandling === 'throw') {
            throw stageError;
          } else if (state.config.errorHandling === 'skip') {
            console.warn(`Skipping failed stage ${moduleConfig.category}:${moduleConfig.algorithm}:`, stageError.message);
            continue;
          }
          // 'fallback' mode continues with original data
        }
      }

      const totalTime = performance.now() - startTime;
      results.metadata.processingTime = totalTime;

      // Update pipeline statistics
      updatePipelineStats(totalTime, results.metadata.errors.length > 0);

      return results;

    } catch (error) {
      const totalTime = performance.now() - startTime;
      results.metadata.processingTime = totalTime;
      results.metadata.errors.push({ stage: 'pipeline', error: error.message });
      
      updatePipelineStats(totalTime, true);
      throw error;
    }
  };

  const updatePipelineStats = (processingTime, hasError) => {
    state.stats.totalProcessed++;
    state.stats.lastProcessingTime = processingTime;
    
    if (hasError) {
      state.stats.totalErrors++;
    }

    // Update rolling average
    const weight = 0.1; // Exponential moving average
    if (state.stats.averagePipelineTime === 0) {
      state.stats.averagePipelineTime = processingTime;
    } else {
      state.stats.averagePipelineTime = 
        (1 - weight) * state.stats.averagePipelineTime + weight * processingTime;
    }
  };

  const getModuleInfo = () => {
    return state.modules.map(m => ({
      category: m.category,
      algorithm: m.algorithm,
      optional: m.optional,
      loaded: !!m.instance,
      metadata: m.instance ? m.instance.getMetadata() : null,
      performance: m.instance ? m.instance.getPerformanceMetrics() : null
    }));
  };

  const getStats = () => ({
    ...state.stats,
    errorRate: state.stats.totalProcessed > 0 ? state.stats.totalErrors / state.stats.totalProcessed : 0
  });

  const cleanup = () => {
    for (const moduleConfig of state.modules) {
      if (moduleConfig.instance) {
        moduleConfig.instance.cleanup();
        moduleConfig.instance = null;
      }
    }
    state.registry.clear();
    state.isInitialized = false;
  };

  const registerModule = (category, algorithm, moduleFactory) => {
    state.registry.register(category, algorithm, moduleFactory);
  };

  const getAvailableModules = (category = null) => {
    return state.registry.getAvailable(category);
  };

  // Pipeline interface
  const pipeline = {
    addModule,
    removeModule,
    initialize,
    process,
    cleanup,
    registerModule,
    getAvailableModules,
    getModuleInfo,
    getStats,
    isReady: () => state.isInitialized
  };

  return pipeline;
};

// Helper function to create common pipeline configurations
export const createPipelineConfigurations = () => ({
  // Fast processing pipeline - speed optimized
  fast: {
    modules: [
      { category: 'detection', algorithm: 'mediapipe-face', config: { maxFaces: 1 } }
    ],
    config: {
      enablePerformanceMonitoring: true,
      errorHandling: 'skip'
    }
  },

  // Accurate processing pipeline - accuracy optimized
  accurate: {
    modules: [
      { category: 'detection', algorithm: 'mtcnn', config: { minFaceSize: 20 } },
      { category: 'landmarks', algorithm: 'mediapipe', optional: true }
    ],
    config: {
      enablePerformanceMonitoring: true,
      errorHandling: 'throw'
    }
  },

  // Full analysis pipeline - all features
  full: {
    modules: [
      { category: 'detection', algorithm: 'mediapipe-face', config: { maxFaces: 5 } },
      { category: 'landmarks', algorithm: 'mediapipe', optional: true },
      { category: 'emotion', algorithm: 'ferplus', optional: true },
      { category: 'age', algorithm: 'agenet', optional: true }
    ],
    config: {
      enablePerformanceMonitoring: true,
      errorHandling: 'skip'
    }
  },

  // API optimized pipeline - balanced performance
  api: {
    modules: [
      { category: 'detection', algorithm: 'mediapipe-face', config: { maxFaces: 3 } },
      { category: 'landmarks', algorithm: 'mediapipe', optional: true }
    ],
    config: {
      enablePerformanceMonitoring: true,
      errorHandling: 'skip',
      maxConcurrentProcessing: 5
    }
  }
});