/**
 * Parallel Pipeline Initialization System
 * Handles dependency resolution and parallel initialization of multiple pipelines
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../utils/error-handler.js';

// Pipeline dependency definitions
const PIPELINE_DEPENDENCIES = {
  // MediaPipe pipelines share common dependencies
  'mediapipe-face-mesh': ['mediapipe-commons'],
  'mediapipe-face': ['mediapipe-commons'], 
  'iris-tracking': ['mediapipe-commons'],
  
  // Age/Emotion analysis can depend on face detection
  'age-estimation': ['face-detection'],
  'emotion-analysis': ['face-detection'],
  
  // Eye tracking has hardware dependencies
  'eye-tracking': ['device-discovery'],
  
  // Speech analysis is independent
  'speech-analysis': []
};

/**
 * Creates a parallel pipeline initializer
 * @param {Object} config - Configuration options
 * @returns {Object} - Parallel initializer instance
 */
export const createParallelInitializer = (config = {}) => {
  const state = {
    config: {
      maxConcurrency: config.maxConcurrency || 3,
      timeoutMs: config.timeoutMs || 30000,
      retryAttempts: config.retryAttempts || 2,
      enableDependencyResolution: config.enableDependencyResolution !== false,
      ...config
    },
    initializing: new Set(),
    initialized: new Set(),
    failed: new Set(),
    dependencyGraph: new Map(),
    semaphore: null
  };

  // Create semaphore for concurrency control
  const createSemaphore = (maxConcurrent) => {
    let current = 0;
    const queue = [];

    const acquire = () => {
      return new Promise((resolve) => {
        if (current < maxConcurrent) {
          current++;
          resolve();
        } else {
          queue.push(resolve);
        }
      });
    };

    const release = () => {
      current--;
      if (queue.length > 0) {
        const next = queue.shift();
        current++;
        next();
      }
    };

    return { acquire, release };
  };

  state.semaphore = createSemaphore(state.config.maxConcurrency);

  /**
   * Build dependency graph for pipelines
   * @param {Array} pipelines - List of pipeline instances
   * @returns {Map} - Dependency graph
   */
  const buildDependencyGraph = (pipelines) => {
    const graph = new Map();
    const pipelineMap = new Map(pipelines.map(p => [p.name, p]));

    for (const pipeline of pipelines) {
      const dependencies = PIPELINE_DEPENDENCIES[pipeline.name] || [];
      const resolvedDependencies = [];

      for (const depName of dependencies) {
        // Find pipelines that provide this dependency
        const dependencyProviders = pipelines.filter(p => 
          p.name === depName || 
          p.capabilities?.includes?.(depName) ||
          p.name.includes(depName)
        );

        if (dependencyProviders.length > 0) {
          resolvedDependencies.push(dependencyProviders[0].name);
        } else {
          // Log missing dependency but don't fail
          handleError(
            `Dependency ${depName} not found for pipeline ${pipeline.name}`,
            ErrorCategory.INITIALIZATION,
            ErrorSeverity.WARNING,
            { pipelineName: pipeline.name, dependency: depName }
          );
        }
      }

      graph.set(pipeline.name, {
        pipeline,
        dependencies: resolvedDependencies,
        dependents: []
      });
    }

    // Build reverse dependencies (dependents)
    for (const [pipelineName, node] of graph.entries()) {
      for (const depName of node.dependencies) {
        const depNode = graph.get(depName);
        if (depNode) {
          depNode.dependents.push(pipelineName);
        }
      }
    }

    return graph;
  };

  /**
   * Get pipelines that can be initialized (no pending dependencies)
   * @param {Map} graph - Dependency graph
   * @param {Set} initialized - Set of initialized pipelines
   * @param {Set} initializing - Set of currently initializing pipelines
   * @returns {Array} - Pipelines ready for initialization
   */
  const getReadyPipelines = (graph, initialized, initializing) => {
    const ready = [];

    for (const [pipelineName, node] of graph.entries()) {
      if (initialized.has(pipelineName) || initializing.has(pipelineName)) {
        continue; // Skip already processed pipelines
      }

      // Check if all dependencies are initialized
      const dependenciesReady = node.dependencies.every(depName => 
        initialized.has(depName)
      );

      if (dependenciesReady) {
        ready.push(node.pipeline);
      }
    }

    return ready;
  };

  /**
   * Initialize a single pipeline with timeout and retry logic
   * @param {Object} pipeline - Pipeline instance
   * @param {Object} pipelineConfig - Configuration for this pipeline
   * @returns {Promise<boolean>} - Success status
   */
  const initializeSinglePipeline = async (pipeline, pipelineConfig = {}) => {
    await state.semaphore.acquire();
    
    try {
      const startTime = Date.now();
      
      handleError(
        `Initializing pipeline: ${pipeline.name}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { pipelineName: pipeline.name }
      );

      // Wrap initialization with timeout
      const initPromise = pipeline.initialize(pipelineConfig);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Initialization timeout for ${pipeline.name}`));
        }, state.config.timeoutMs);
      });

      await Promise.race([initPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      
      handleError(
        `Pipeline ${pipeline.name} initialized successfully in ${duration}ms`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { pipelineName: pipeline.name, duration }
      );

      return true;
    } catch (error) {
      handleError(
        `Pipeline ${pipeline.name} initialization failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR,
        { pipelineName: pipeline.name, error: error.message }
      );
      throw error;
    } finally {
      state.semaphore.release();
    }
  };

  /**
   * Initialize pipelines with retry logic
   * @param {Object} pipeline - Pipeline instance  
   * @param {Object} pipelineConfig - Configuration for this pipeline
   * @returns {Promise<boolean>} - Success status
   */
  const initializeWithRetry = async (pipeline, pipelineConfig) => {
    let lastError;
    
    for (let attempt = 1; attempt <= state.config.retryAttempts; attempt++) {
      try {
        await initializeSinglePipeline(pipeline, pipelineConfig);
        return true;
      } catch (error) {
        lastError = error;
        
        if (attempt < state.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          handleError(
            `Pipeline ${pipeline.name} initialization attempt ${attempt} failed, retrying in ${delay}ms`,
            ErrorCategory.INITIALIZATION,
            ErrorSeverity.WARNING,
            { pipelineName: pipeline.name, attempt, delay }
          );
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  };

  /**
   * Initialize multiple pipelines in parallel with dependency resolution
   * @param {Array} pipelines - List of pipeline instances
   * @param {Object} pipelineConfigs - Configuration object keyed by pipeline name
   * @returns {Promise<Object>} - Initialization results
   */
  const initializeParallel = async (pipelines, pipelineConfigs = {}) => {
    const startTime = Date.now();
    const results = {
      successful: [],
      failed: [],
      totalTime: 0,
      parallelEfficiency: 0
    };

    if (pipelines.length === 0) {
      return results;
    }

    try {
      // Build dependency graph if enabled
      let dependencyGraph = null;
      if (state.config.enableDependencyResolution) {
        dependencyGraph = buildDependencyGraph(pipelines);
        handleError(
          `Built dependency graph for ${pipelines.length} pipelines`,
          ErrorCategory.INITIALIZATION,
          ErrorSeverity.INFO,
          { pipelineCount: pipelines.length }
        );
      }

      // Initialize tracking sets
      const initialized = new Set();
      const initializing = new Set();
      const failed = new Set();
      const initPromises = new Map();

      // Process pipelines in dependency order if graph is available
      if (dependencyGraph) {
        while (initialized.size + failed.size < pipelines.length) {
          const readyPipelines = getReadyPipelines(dependencyGraph, initialized, initializing);
          
          if (readyPipelines.length === 0) {
            // Check if there are still pipelines initializing
            if (initializing.size === 0) {
              // Circular dependency or missing dependencies
              const remaining = pipelines.filter(p => 
                !initialized.has(p.name) && !failed.has(p.name)
              );
              
              handleError(
                `Circular dependency or missing dependencies detected for pipelines: ${remaining.map(p => p.name).join(', ')}`,
                ErrorCategory.INITIALIZATION,
                ErrorSeverity.ERROR,
                { remainingPipelines: remaining.map(p => p.name) }
              );
              break;
            }
            
            // Wait for at least one pipeline to finish
            await Promise.race(Array.from(initPromises.values()));
            continue;
          }

          // Start initialization for ready pipelines
          for (const pipeline of readyPipelines) {
            initializing.add(pipeline.name);
            
            const initPromise = initializeWithRetry(
              pipeline, 
              pipelineConfigs[pipeline.name] || {}
            )
            .then(() => {
              initialized.add(pipeline.name);
              initializing.delete(pipeline.name);
              results.successful.push(pipeline.name);
              initPromises.delete(pipeline.name);
            })
            .catch((error) => {
              failed.add(pipeline.name);
              initializing.delete(pipeline.name);
              results.failed.push({ name: pipeline.name, error: error.message });
              initPromises.delete(pipeline.name);
            });
            
            initPromises.set(pipeline.name, initPromise);
          }
        }

        // Wait for any remaining initializations
        if (initPromises.size > 0) {
          await Promise.allSettled(Array.from(initPromises.values()));
        }
      } else {
        // Parallel initialization without dependency resolution
        const initPromises = pipelines.map(async (pipeline) => {
          try {
            await initializeWithRetry(pipeline, pipelineConfigs[pipeline.name] || {});
            results.successful.push(pipeline.name);
          } catch (error) {
            results.failed.push({ name: pipeline.name, error: error.message });
          }
        });

        await Promise.allSettled(initPromises);
      }

      const totalTime = Date.now() - startTime;
      results.totalTime = totalTime;

      // Calculate parallel efficiency (theoretical sequential time vs actual parallel time)
      const averageInitTime = totalTime / Math.max(pipelines.length, 1);
      const theoreticalSequentialTime = averageInitTime * pipelines.length;
      results.parallelEfficiency = theoreticalSequentialTime / totalTime;

      handleError(
        `Parallel initialization completed: ${results.successful.length} successful, ${results.failed.length} failed in ${totalTime}ms (${results.parallelEfficiency.toFixed(2)}x efficiency)`,
        ErrorCategory.INITIALIZATION,
        results.failed.length > 0 ? ErrorSeverity.WARNING : ErrorSeverity.INFO,
        { results }
      );

    } catch (error) {
      handleError(
        `Parallel initialization system error: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR,
        { error: error.message }
      );
      throw error;
    }

    return results;
  };

  return {
    initializeParallel,
    buildDependencyGraph,
    getReadyPipelines,
    initializeSinglePipeline,
    getDependencies: (pipelineName) => PIPELINE_DEPENDENCIES[pipelineName] || [],
    getConfig: () => ({ ...state.config }),
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
      if (updates.maxConcurrency) {
        state.semaphore = createSemaphore(updates.maxConcurrency);
      }
    }
  };
};