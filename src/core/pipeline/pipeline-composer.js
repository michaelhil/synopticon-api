/**
 * Pipeline Composition Utilities
 * Provides advanced pipeline chaining, parallel processing, and conditional execution
 * Enables building complex analysis workflows from simple pipeline components
 */

import { createPipelineMonitor } from './pipeline-monitor.js';
import { createAnalysisResult, mergeResults, createErrorResult, ResultStatus } from './pipeline-results.js';
import { handleError, ErrorCategory, ErrorSeverity } from '../shared/utils/error-handler.js';

// Composition patterns
export const CompositionPattern = {
  SEQUENTIAL: 'sequential',   // Execute pipelines one after another
  PARALLEL: 'parallel',      // Execute pipelines simultaneously
  CONDITIONAL: 'conditional', // Execute based on conditions
  CASCADING: 'cascading',    // Pass results between pipelines
  ADAPTIVE: 'adaptive'       // Dynamically choose pipelines
};

// Execution strategies
export const ExecutionStrategy = {
  FAIL_FAST: 'fail_fast',           // Stop on first error
  CONTINUE_ON_ERROR: 'continue',    // Continue despite errors
  BEST_EFFORT: 'best_effort',       // Use partial results
  RETRY_ON_FAILURE: 'retry'         // Retry failed pipelines
};

/**
 * Creates a pipeline composition system
 * @param {Object} config - Composition configuration
 * @returns {Object} - Pipeline composer instance
 */
export const createPipelineComposer = (config = {}) => {
  const composerConfig = {
    maxConcurrentPipelines: config.maxConcurrentPipelines || 4,
    defaultTimeout: config.defaultTimeout || 5000,
    enableMetrics: config.enableMetrics !== false,
    defaultExecutionStrategy: config.defaultExecutionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
    enableCaching: config.enableCaching !== false,
    cacheSize: config.cacheSize || 100,
    ...config
  };

  const state = {
    registeredPipelines: new Map(),
    compositions: new Map(),
    executionCache: new Map(),
    monitor: null,
    metrics: {
      compositionsExecuted: 0,
      totalExecutionTime: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cachedExecutions: 0
    }
  };

  // Initialize monitoring if enabled
  if (composerConfig.enableMetrics) {
    state.monitor = createPipelineMonitor();
  }

  /**
   * Registers a pipeline for use in compositions
   * @param {string} id - Unique pipeline identifier
   * @param {Object} pipeline - Pipeline instance
   * @param {Object} options - Registration options
   */
  const registerPipeline = (id, pipeline, options = {}) => {
    if (state.registeredPipelines.has(id)) {
      handleError(
        `Pipeline ${id} is already registered`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.WARNING,
        { pipelineId: id }
      );
      return;
    }

    const pipelineInfo = {
      id,
      pipeline,
      name: options.name || id,
      capabilities: options.capabilities || [],
      priority: options.priority || 0,
      timeout: options.timeout || composerConfig.defaultTimeout,
      retryCount: options.retryCount || 0,
      dependencies: options.dependencies || [],
      outputs: options.outputs || [],
      registeredAt: Date.now()
    };

    state.registeredPipelines.set(id, pipelineInfo);

    // Register with monitor if available
    if (state.monitor) {
      state.monitor.registerPipeline(id, pipelineInfo.name, pipeline);
    }

    handleError(
      `Pipeline ${id} registered for composition`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { pipelineId: id, capabilities: pipelineInfo.capabilities }
    );
  };

  /**
   * Creates a sequential composition (chain of pipelines)
   * @param {string} compositionId - Unique composition identifier
   * @param {Array} pipelineSequence - Array of pipeline IDs or configs
   * @param {Object} options - Composition options
   */
  const createSequentialComposition = (compositionId, pipelineSequence, options = {}) => {
    const composition = {
      id: compositionId,
      type: CompositionPattern.SEQUENTIAL,
      pipelines: pipelineSequence.map(normalizeStepConfig),
      options: {
        executionStrategy: options.executionStrategy || composerConfig.defaultExecutionStrategy,
        timeout: options.timeout || composerConfig.defaultTimeout,
        enableCaching: options.enableCaching !== false,
        passResults: options.passResults !== false,
        ...options
      },
      createdAt: Date.now()
    };

    validateComposition(composition);
    state.compositions.set(compositionId, composition);

    handleError(
      `Sequential composition ${compositionId} created with ${pipelineSequence.length} steps`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { compositionId, stepCount: pipelineSequence.length }
    );
  };

  /**
   * Creates a parallel composition (simultaneous execution)
   * @param {string} compositionId - Unique composition identifier
   * @param {Array} pipelineGroups - Array of pipeline IDs or configs
   * @param {Object} options - Composition options
   */
  const createParallelComposition = (compositionId, pipelineGroups, options = {}) => {
    const composition = {
      id: compositionId,
      type: CompositionPattern.PARALLEL,
      pipelines: pipelineGroups.map(normalizeStepConfig),
      options: {
        executionStrategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
        timeout: options.timeout || composerConfig.defaultTimeout,
        maxConcurrent: options.maxConcurrent || composerConfig.maxConcurrentPipelines,
        mergeResults: options.mergeResults !== false,
        ...options
      },
      createdAt: Date.now()
    };

    validateComposition(composition);
    state.compositions.set(compositionId, composition);

    handleError(
      `Parallel composition ${compositionId} created with ${pipelineGroups.length} parallel groups`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { compositionId, groupCount: pipelineGroups.length }
    );
  };

  /**
   * Creates a conditional composition (dynamic execution based on conditions)
   * @param {string} compositionId - Unique composition identifier
   * @param {Array} conditionalSteps - Array of condition-pipeline pairs
   * @param {Object} options - Composition options
   */
  const createConditionalComposition = (compositionId, conditionalSteps, options = {}) => {
    const composition = {
      id: compositionId,
      type: CompositionPattern.CONDITIONAL,
      steps: conditionalSteps.map(step => ({
        condition: step.condition,
        pipelines: Array.isArray(step.pipelines) ? step.pipelines.map(normalizeStepConfig) : [normalizeStepConfig(step.pipelines)],
        options: step.options || {}
      })),
      options: {
        executionStrategy: options.executionStrategy || ExecutionStrategy.FAIL_FAST,
        defaultPipelines: options.defaultPipelines || [],
        evaluateAllConditions: options.evaluateAllConditions || false,
        ...options
      },
      createdAt: Date.now()
    };

    validateConditionalComposition(composition);
    state.compositions.set(compositionId, composition);

    handleError(
      `Conditional composition ${compositionId} created with ${conditionalSteps.length} conditional steps`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { compositionId, stepCount: conditionalSteps.length }
    );
  };

  /**
   * Creates an adaptive composition that selects pipelines based on input characteristics
   * @param {string} compositionId - Unique composition identifier
   * @param {Object} adaptiveConfig - Adaptive configuration
   * @param {Object} options - Composition options
   */
  const createAdaptiveComposition = (compositionId, adaptiveConfig, options = {}) => {
    const composition = {
      id: compositionId,
      type: CompositionPattern.ADAPTIVE,
      adaptiveConfig: {
        inputAnalyzer: adaptiveConfig.inputAnalyzer,
        pipelineSelector: adaptiveConfig.pipelineSelector,
        fallbackPipelines: adaptiveConfig.fallbackPipelines || [],
        adaptationStrategy: adaptiveConfig.adaptationStrategy || 'performance_based'
      },
      availablePipelines: adaptiveConfig.availablePipelines.map(normalizeStepConfig),
      options: {
        enableLearning: options.enableLearning !== false,
        performanceWeighting: options.performanceWeighting || 0.7,
        accuracyWeighting: options.accuracyWeighting || 0.3,
        ...options
      },
      createdAt: Date.now(),
      adaptationHistory: []
    };

    state.compositions.set(compositionId, composition);

    handleError(
      `Adaptive composition ${compositionId} created with ${adaptiveConfig.availablePipelines.length} available pipelines`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { compositionId, availableCount: adaptiveConfig.availablePipelines.length }
    );
  };

  /**
   * Executes a composition with given input
   * @param {string} compositionId - Composition identifier
   * @param {*} input - Input data for pipelines
   * @param {Object} executionOptions - Execution-specific options
   * @returns {Promise<Object>} - Execution result
   */
  const executeComposition = async (compositionId, input, executionOptions = {}) => {
    const startTime = performance.now();
    
    try {
      const composition = state.compositions.get(compositionId);
      if (!composition) {
        throw new Error(`Composition ${compositionId} not found`);
      }

      // Check cache if enabled
      if (composerConfig.enableCaching && composition.options.enableCaching) {
        const cacheKey = generateCacheKey(compositionId, input, executionOptions);
        const cachedResult = state.executionCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp) < 60000) { // 1 minute cache
          state.metrics.cachedExecutions++;
          return cachedResult.result;
        }
      }

      let result;

      // Execute based on composition type
      switch (composition.type) {
        case CompositionPattern.SEQUENTIAL:
          result = await executeSequential(composition, input, executionOptions);
          break;
        case CompositionPattern.PARALLEL:
          result = await executeParallel(composition, input, executionOptions);
          break;
        case CompositionPattern.CONDITIONAL:
          result = await executeConditional(composition, input, executionOptions);
          break;
        case CompositionPattern.ADAPTIVE:
          result = await executeAdaptive(composition, input, executionOptions);
          break;
        default:
          throw new Error(`Unsupported composition type: ${composition.type}`);
      }

      // Update metrics
      const executionTime = performance.now() - startTime;
      state.metrics.compositionsExecuted++;
      state.metrics.totalExecutionTime += executionTime;
      
      if (result.status === ResultStatus.SUCCESS) {
        state.metrics.successfulExecutions++;
      } else {
        state.metrics.failedExecutions++;
      }

      // Cache result if enabled
      if (composerConfig.enableCaching && composition.options.enableCaching) {
        const cacheKey = generateCacheKey(compositionId, input, executionOptions);
        state.executionCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });

        // Maintain cache size
        if (state.executionCache.size > composerConfig.cacheSize) {
          const firstKey = state.executionCache.keys().next().value;
          state.executionCache.delete(firstKey);
        }
      }

      return result;

    } catch (error) {
      state.metrics.failedExecutions++;
      
      handleError(
        `Composition execution failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { compositionId, error: error.message }
      );

      return createErrorResult({
        message: `Composition execution failed: ${error.message}`,
        source: 'pipeline-composer',
        processingTime: performance.now() - startTime,
        context: { compositionId }
      });
    }
  };

  /**
   * Executes a sequential composition
   * @param {Object} composition - Composition configuration
   * @param {*} input - Input data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  const executeSequential = async (composition, input, options) => {
    const results = [];
    let currentInput = input;
    let totalProcessingTime = 0;

    for (let i = 0; i < composition.pipelines.length; i++) {
      const stepConfig = composition.pipelines[i];
      const pipeline = state.registeredPipelines.get(stepConfig.id);
      
      if (!pipeline) {
        if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
          throw new Error(`Pipeline ${stepConfig.id} not found`);
        }
        continue;
      }

      try {
        const stepStartTime = performance.now();
        const stepResult = await executePipelineStep(pipeline, currentInput, stepConfig.options);
        const stepProcessingTime = performance.now() - stepStartTime;
        
        totalProcessingTime += stepProcessingTime;
        results.push(stepResult);

        // Pass results to next pipeline if enabled
        if (composition.options.passResults) {
          currentInput = stepResult;
        }

      } catch (error) {
        const errorResult = createErrorResult({
          message: `Step ${i + 1} failed: ${error.message}`,
          source: stepConfig.id,
          context: { stepIndex: i, pipelineId: stepConfig.id }
        });

        results.push(errorResult);

        if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
          throw error;
        }
      }
    }

    return createAnalysisResult({
      status: results.every(r => r.status === ResultStatus.SUCCESS) ? ResultStatus.SUCCESS : ResultStatus.PARTIAL,
      processingTime: totalProcessingTime,
      source: 'sequential-composition',
      pipelinesUsed: composition.pipelines.map(p => p.id),
      results: results,
      metadata: {
        compositionId: composition.id,
        executionPattern: CompositionPattern.SEQUENTIAL,
        stepsCompleted: results.length,
        totalSteps: composition.pipelines.length
      }
    });
  };

  /**
   * Executes a parallel composition
   * @param {Object} composition - Composition configuration
   * @param {*} input - Input data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  const executeParallel = async (composition, input, options) => {
    const startTime = performance.now();
    
    // Create execution promises with concurrency limit
    const executionPromises = [];
    const semaphore = createSemaphore(composition.options.maxConcurrent);
    
    for (const stepConfig of composition.pipelines) {
      const pipeline = state.registeredPipelines.get(stepConfig.id);
      
      if (!pipeline) {
        if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
          throw new Error(`Pipeline ${stepConfig.id} not found`);
        }
        continue;
      }

      const promise = semaphore.acquire().then(async (release) => {
        try {
          const result = await executePipelineStep(pipeline, input, stepConfig.options);
          return { success: true, result, pipelineId: stepConfig.id };
        } catch (error) {
          return { 
            success: false, 
            error: createErrorResult({
              message: error.message,
              source: stepConfig.id,
              context: { pipelineId: stepConfig.id }
            }), 
            pipelineId: stepConfig.id 
          };
        } finally {
          release();
        }
      });

      executionPromises.push(promise);
    }

    // Wait for all executions to complete
    const executionResults = await Promise.all(executionPromises);
    const totalProcessingTime = performance.now() - startTime;

    // Process results
    const successfulResults = executionResults.filter(r => r.success).map(r => r.result);
    const failedResults = executionResults.filter(r => !r.success).map(r => r.error);
    
    // Handle execution strategy
    if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST && failedResults.length > 0) {
      throw new Error(`Parallel execution failed: ${failedResults[0].error.message}`);
    }

    // Merge results if requested
    let finalResult;
    if (composition.options.mergeResults && successfulResults.length > 0) {
      finalResult = mergeResults([...successfulResults, ...failedResults]);
    } else {
      finalResult = createAnalysisResult({
        status: failedResults.length === 0 ? ResultStatus.SUCCESS : 
               successfulResults.length > 0 ? ResultStatus.PARTIAL : ResultStatus.FAILED,
        processingTime: totalProcessingTime,
        source: 'parallel-composition',
        pipelinesUsed: composition.pipelines.map(p => p.id),
        results: [...successfulResults, ...failedResults],
        metadata: {
          compositionId: composition.id,
          executionPattern: CompositionPattern.PARALLEL,
          successfulPipelines: successfulResults.length,
          failedPipelines: failedResults.length,
          totalPipelines: composition.pipelines.length
        }
      });
    }

    return finalResult;
  };

  /**
   * Executes a conditional composition
   * @param {Object} composition - Composition configuration
   * @param {*} input - Input data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  const executeConditional = async (composition, input, options) => {
    const results = [];
    let totalProcessingTime = 0;
    let executedSteps = 0;

    for (const step of composition.steps) {
      const conditionMet = await evaluateCondition(step.condition, input, results);
      
      if (conditionMet) {
        executedSteps++;
        
        // Execute pipelines for this condition
        for (const pipelineConfig of step.pipelines) {
          const pipeline = state.registeredPipelines.get(pipelineConfig.id);
          
          if (!pipeline) {
            if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
              throw new Error(`Pipeline ${pipelineConfig.id} not found`);
            }
            continue;
          }

          try {
            const stepStartTime = performance.now();
            const stepResult = await executePipelineStep(pipeline, input, pipelineConfig.options);
            totalProcessingTime += performance.now() - stepStartTime;
            
            results.push(stepResult);

          } catch (error) {
            const errorResult = createErrorResult({
              message: error.message,
              source: pipelineConfig.id,
              context: { pipelineId: pipelineConfig.id, condition: step.condition }
            });

            results.push(errorResult);

            if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
              throw error;
            }
          }
        }

        // Stop after first matching condition unless evaluateAllConditions is true
        if (!composition.options.evaluateAllConditions) {
          break;
        }
      }
    }

    // Execute default pipelines if no conditions were met
    if (executedSteps === 0 && composition.options.defaultPipelines.length > 0) {
      for (const pipelineId of composition.options.defaultPipelines) {
        const pipeline = state.registeredPipelines.get(pipelineId);
        if (pipeline) {
          try {
            const stepStartTime = performance.now();
            const stepResult = await executePipelineStep(pipeline, input, {});
            totalProcessingTime += performance.now() - stepStartTime;
            results.push(stepResult);
          } catch (error) {
            // Log but don't throw for default pipelines
            handleError(
              `Default pipeline ${pipelineId} failed: ${error.message}`,
              ErrorCategory.PROCESSING,
              ErrorSeverity.WARNING,
              { pipelineId }
            );
          }
        }
      }
    }

    return createAnalysisResult({
      status: results.length > 0 ? ResultStatus.SUCCESS : ResultStatus.FAILED,
      processingTime: totalProcessingTime,
      source: 'conditional-composition',
      results: results,
      metadata: {
        compositionId: composition.id,
        executionPattern: CompositionPattern.CONDITIONAL,
        conditionsEvaluated: composition.steps.length,
        conditionsMet: executedSteps,
        defaultPipelinesUsed: executedSteps === 0 ? composition.options.defaultPipelines.length : 0
      }
    });
  };

  /**
   * Executes an adaptive composition
   * @param {Object} composition - Composition configuration
   * @param {*} input - Input data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  const executeAdaptive = async (composition, input, options) => {
    const startTime = performance.now();
    
    try {
      // Analyze input to determine optimal pipeline selection
      const inputAnalysis = await composition.adaptiveConfig.inputAnalyzer(input);
      
      // Select best pipelines based on analysis and historical performance
      const selectedPipelines = await composition.adaptiveConfig.pipelineSelector(
        inputAnalysis,
        composition.availablePipelines,
        composition.adaptationHistory
      );

      // Execute selected pipelines
      const executionPromises = selectedPipelines.map(async (pipelineConfig) => {
        const pipeline = state.registeredPipelines.get(pipelineConfig.id);
        if (!pipeline) {
          throw new Error(`Selected pipeline ${pipelineConfig.id} not found`);
        }

        const pipelineStartTime = performance.now();
        const result = await executePipelineStep(pipeline, input, pipelineConfig.options);
        const pipelineTime = performance.now() - pipelineStartTime;

        return {
          pipelineId: pipelineConfig.id,
          result,
          processingTime: pipelineTime,
          selection: pipelineConfig.selectionReason
        };
      });

      const executionResults = await Promise.all(executionPromises);
      const totalProcessingTime = performance.now() - startTime;

      // Record adaptation history for learning
      if (composition.options.enableLearning) {
        composition.adaptationHistory.push({
          timestamp: Date.now(),
          inputAnalysis,
          selectedPipelines: selectedPipelines.map(p => p.id),
          results: executionResults.map(r => ({
            pipelineId: r.pipelineId,
            success: r.result.status === ResultStatus.SUCCESS,
            processingTime: r.processingTime,
            confidence: r.result.confidence
          }))
        });

        // Maintain history size (keep last 100 entries)
        if (composition.adaptationHistory.length > 100) {
          composition.adaptationHistory.shift();
        }
      }

      // Merge results from selected pipelines
      const pipelineResults = executionResults.map(r => r.result);
      const mergedResult = mergeResults(pipelineResults);

      return {
        ...mergedResult,
        source: 'adaptive-composition',
        processingTime: totalProcessingTime,
        metadata: {
          ...mergedResult.metadata,
          compositionId: composition.id,
          executionPattern: CompositionPattern.ADAPTIVE,
          selectedPipelines: selectedPipelines.map(p => p.id),
          selectionCriteria: inputAnalysis,
          adaptationStrategy: composition.adaptiveConfig.adaptationStrategy,
          pipelinePerformance: executionResults.map(r => ({
            pipeline: r.pipelineId,
            time: r.processingTime,
            selection: r.selection
          }))
        }
      };

    } catch (error) {
      // Fallback to default pipelines if adaptation fails
      if (composition.adaptiveConfig.fallbackPipelines.length > 0) {
        handleError(
          `Adaptive execution failed, using fallback: ${error.message}`,
          ErrorCategory.PROCESSING,
          ErrorSeverity.WARNING,
          { compositionId: composition.id }
        );

        const fallbackResults = [];
        for (const pipelineId of composition.adaptiveConfig.fallbackPipelines) {
          const pipeline = state.registeredPipelines.get(pipelineId);
          if (pipeline) {
            try {
              const result = await executePipelineStep(pipeline, input, {});
              fallbackResults.push(result);
            } catch (fallbackError) {
              // Continue with other fallbacks
            }
          }
        }

        if (fallbackResults.length > 0) {
          const mergedResult = mergeResults(fallbackResults);
          return {
            ...mergedResult,
            source: 'adaptive-composition-fallback',
            processingTime: performance.now() - startTime
          };
        }
      }

      throw error;
    }
  };

  /**
   * Normalizes step configuration
   * @param {string|Object} stepConfig - Step configuration
   * @returns {Object} - Normalized step config
   */
  const normalizeStepConfig = (stepConfig) => {
    if (typeof stepConfig === 'string') {
      return { id: stepConfig, options: {} };
    }
    return {
      id: stepConfig.id,
      options: stepConfig.options || {},
      timeout: stepConfig.timeout,
      retryCount: stepConfig.retryCount || 0
    };
  };

  /**
   * Validates composition configuration
   * @param {Object} composition - Composition to validate
   */
  const validateComposition = (composition) => {
    // Check if all referenced pipelines are registered
    const pipelineIds = composition.pipelines.map(p => p.id);
    const missingPipelines = pipelineIds.filter(id => !state.registeredPipelines.has(id));
    
    if (missingPipelines.length > 0) {
      throw new Error(`Missing pipelines: ${missingPipelines.join(', ')}`);
    }

    // Check for circular dependencies (simplified check)
    const dependencyMap = new Map();
    for (const pipelineId of pipelineIds) {
      const pipeline = state.registeredPipelines.get(pipelineId);
      dependencyMap.set(pipelineId, pipeline.dependencies || []);
    }

    // Implement cycle detection using depth-first search (DFS)
    const detectCycles = (dependencyMap) => {
      const visited = new Set();
      const recursionStack = new Set();
      const cycles = [];
      
      const hasCycleDFS = (node, path = []) => {
        if (recursionStack.has(node)) {
          // Found a cycle - extract the cycle path
          const cycleStart = path.indexOf(node);
          const cycle = path.slice(cycleStart).concat([node]);
          cycles.push(cycle);
          return true;
        }
        
        if (visited.has(node)) {
          return false;
        }
        
        visited.add(node);
        recursionStack.add(node);
        path.push(node);
        
        const dependencies = dependencyMap.get(node) || [];
        for (const dependency of dependencies) {
          if (hasCycleDFS(dependency, [...path])) {
            return true;
          }
        }
        
        recursionStack.delete(node);
        path.pop();
        return false;
      };
      
      // Check all nodes for cycles
      for (const [nodeId] of dependencyMap) {
        if (!visited.has(nodeId)) {
          hasCycleDFS(nodeId);
        }
      }
      
      if (cycles.length > 0) {
        throw new Error(`Pipeline dependency cycles detected: ${cycles.map(cycle => cycle.join(' -> ')).join(', ')}`);
      }
      
      return false;
    };
    
    detectCycles(dependencyMap);
  };

  /**
   * Validates conditional composition
   * @param {Object} composition - Conditional composition to validate
   */
  const validateConditionalComposition = (composition) => {
    for (const step of composition.steps) {
      if (typeof step.condition !== 'function' && typeof step.condition !== 'string') {
        throw new Error('Conditions must be functions or expression strings');
      }

      const pipelineIds = step.pipelines.map(p => p.id);
      const missingPipelines = pipelineIds.filter(id => !state.registeredPipelines.has(id));
      
      if (missingPipelines.length > 0) {
        throw new Error(`Missing pipelines in conditional step: ${missingPipelines.join(', ')}`);
      }
    }
  };

  /**
   * Executes a single pipeline step
   * @param {Object} pipelineInfo - Pipeline information
   * @param {*} input - Input data
   * @param {Object} options - Step options
   * @returns {Promise<Object>} - Step result
   */
  const executePipelineStep = async (pipelineInfo, input, options = {}) => {
    const timeout = options.timeout || pipelineInfo.timeout;
    const retryCount = options.retryCount || pipelineInfo.retryCount;
    
    let lastError;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await executeWithTimeout(
          pipelineInfo.pipeline.process(input),
          timeout
        );
        
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < retryCount) {
          handleError(
            `Pipeline ${pipelineInfo.id} attempt ${attempt + 1} failed, retrying: ${error.message}`,
            ErrorCategory.PROCESSING,
            ErrorSeverity.WARNING,
            { pipelineId: pipelineInfo.id, attempt: attempt + 1, maxAttempts: retryCount + 1 }
          );
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw lastError;
  };

  /**
   * Executes a promise with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} - Promise with timeout
   */
  const executeWithTimeout = (promise, timeout) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
      })
    ]);
  };

  // Safe condition evaluation - predefined conditions to prevent code injection
  const SAFE_CONDITIONS = {
    // Input validation conditions
    'input.faces.length > 0': (input) => input?.faces?.length > 0,
    'input.confidence > 0.5': (input) => input?.confidence > 0.5,
    'input.confidence > 0.8': (input) => input?.confidence > 0.8,
    'input.width > 640': (input) => input?.width > 640,
    'input.height > 480': (input) => input?.height > 480,
    
    // Result validation conditions
    'previousResults.length > 0': (input, previousResults) => previousResults?.length > 0,
    'previousResults.some(r => r.success)': (input, previousResults) => 
      previousResults?.some(r => r?.success === true),
    'previousResults.every(r => r.success)': (input, previousResults) => 
      previousResults?.every(r => r?.success === true),
      
    // Performance conditions
    'input.metadata.processingTime < 50': (input) => input?.metadata?.processingTime < 50,
    'input.metadata.confidence > 0.7': (input) => input?.metadata?.confidence > 0.7,
    
    // Pipeline status conditions
    'input.status === "success"': (input) => input?.status === 'success',
    'input.status === "error"': (input) => input?.status === 'error',
    'input.type === "face_detection"': (input) => input?.type === 'face_detection',
    'input.type === "emotion_analysis"': (input) => input?.type === 'emotion_analysis'
  };

  /**
   * Evaluates a condition for conditional execution using safe predefined conditions
   * @param {Function|string} condition - Condition to evaluate
   * @param {*} input - Input data
   * @param {Array} previousResults - Previous execution results
   * @returns {Promise<boolean>} - Whether condition is met
   */
  const evaluateCondition = async (condition, input, previousResults) => {
    try {
      if (typeof condition === 'function') {
        return await condition(input, previousResults);
      }
      
      if (typeof condition === 'string') {
        // Use safe predefined conditions to prevent code injection
        const safeCondition = SAFE_CONDITIONS[condition];
        if (safeCondition) {
          return safeCondition(input, previousResults);
        } else {
          handleError(
            `Unsupported condition: ${condition}. Use predefined safe conditions only.`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.WARNING,
            { condition, availableConditions: Object.keys(SAFE_CONDITIONS) }
          );
          return false;
        }
      }
      
      return false;
    } catch (error) {
      handleError(
        `Condition evaluation failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.WARNING,
        { condition: condition.toString() }
      );
      return false;
    }
  };

  /**
   * Creates a semaphore for controlling concurrency
   * @param {number} maxConcurrent - Maximum concurrent operations
   * @returns {Object} - Semaphore with acquire method
   */
  const createSemaphore = (maxConcurrent) => {
    let current = 0;
    const queue = [];

    return {
      acquire: () => {
        return new Promise((resolve) => {
          if (current < maxConcurrent) {
            current++;
            resolve(() => {
              current--;
              if (queue.length > 0) {
                const next = queue.shift();
                current++;
                next(() => {
                  current--;
                  if (queue.length > 0) {
                    // Continue processing queue
                    setImmediate(() => {
                      if (current < maxConcurrent && queue.length > 0) {
                        const nextNext = queue.shift();
                        current++;
                        nextNext(() => current--);
                      }
                    });
                  }
                });
              }
            });
          } else {
            queue.push(resolve);
          }
        });
      }
    };
  };

  /**
   * Generates cache key for execution results
   * @param {string} compositionId - Composition identifier
   * @param {*} input - Input data
   * @param {Object} options - Execution options
   * @returns {string} - Cache key
   */
  const generateCacheKey = (compositionId, input, options) => {
    const inputHash = JSON.stringify(input);
    const optionsHash = JSON.stringify(options);
    return `${compositionId}_${inputHash}_${optionsHash}`;
  };

  /**
   * Gets composition metrics and statistics
   * @returns {Object} - Metrics data
   */
  const getMetrics = () => {
    return {
      ...state.metrics,
      registeredPipelines: state.registeredPipelines.size,
      compositions: state.compositions.size,
      cacheSize: state.executionCache.size,
      averageExecutionTime: state.metrics.totalExecutionTime / Math.max(1, state.metrics.compositionsExecuted),
      successRate: state.metrics.successfulExecutions / Math.max(1, state.metrics.compositionsExecuted),
      cacheHitRate: state.metrics.cachedExecutions / Math.max(1, state.metrics.compositionsExecuted)
    };
  };

  /**
   * Clears all compositions and resets state
   */
  const reset = () => {
    state.compositions.clear();
    state.executionCache.clear();
    state.metrics = {
      compositionsExecuted: 0,
      totalExecutionTime: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cachedExecutions: 0
    };
  };

  return {
    // Registration
    registerPipeline,
    
    // Composition creation
    createSequentialComposition,
    createParallelComposition,
    createConditionalComposition,
    createAdaptiveComposition,
    
    // Execution
    executeComposition,
    
    // Management
    getMetrics,
    reset,
    
    // Configuration
    getConfig: () => ({ ...composerConfig }),
    
    // Constants
    CompositionPattern,
    ExecutionStrategy
  };
};

// Export default composer for global use
export default createPipelineComposer;