/**
 * Pipeline Composer - Main Factory
 * Unified interface for all composition patterns with Strategy pattern implementation
 */

import {
  CompositionPattern,
  ExecutionStrategy,
  ComposerConfig,
  CompositionConfig,
  ExecutionOptions,
  ExecutionResult,
  PipelineInfo,
  ComposerMetrics,
  ComposerState,
  BaseComposer,
  generateCacheKey,
  createEmptyMetrics,
  createDefaultComposerConfig
} from './base-composer.ts';

// Import all composer implementations
import {
  SequentialCompositionConfig,
  createSequentialComposition,
  executeSequential,
  validateSequentialComposition
} from './sequential-composer.ts';

import {
  ParallelCompositionConfig,
  createParallelComposition,
  executeParallel,
  validateParallelComposition
} from './parallel-composer.ts';

import {
  ConditionalCompositionConfig,
  createConditionalComposition,
  executeConditional,
  validateConditionalComposition
} from './conditional-composer.ts';

import {
  AdaptiveCompositionConfig,
  createAdaptiveComposition,
  executeAdaptive,
  validateAdaptiveComposition
} from './adaptive-composer.ts';

import {
  CascadingCompositionConfig,
  createCascadingComposition,
  executeCascading,
  validateCascadingComposition
} from './cascading-composer.ts';

// Type unions for all composition configs
export type AnyCompositionConfig = 
  | SequentialCompositionConfig
  | ParallelCompositionConfig
  | ConditionalCompositionConfig
  | AdaptiveCompositionConfig
  | CascadingCompositionConfig;

// Execution function type
type ExecutionFunction = (
  composition: AnyCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options?: ExecutionOptions
) => Promise<ExecutionResult>;

// Validation function type
type ValidationFunction = (composition: AnyCompositionConfig) => string[];

/**
 * Main Pipeline Composer Factory
 * Implements the Strategy pattern for different composition types
 */
export const createPipelineComposer = (config: Partial<ComposerConfig> = {}): BaseComposer => {
  const composerConfig = createDefaultComposerConfig(config);
  
  // Composer state
  const state: ComposerState = {
    registeredPipelines: new Map(),
    compositions: new Map(),
    executionCache: new Map(),
    monitor: null,
    metrics: createEmptyMetrics()
  };

  // Strategy map for execution functions
  const executionStrategies: Map<CompositionPattern, ExecutionFunction> = new Map([
    [CompositionPattern.SEQUENTIAL, executeSequential as ExecutionFunction],
    [CompositionPattern.PARALLEL, executeParallel as ExecutionFunction],
    [CompositionPattern.CONDITIONAL, executeConditional as ExecutionFunction],
    [CompositionPattern.ADAPTIVE, executeAdaptive as ExecutionFunction],
    [CompositionPattern.CASCADING, executeCascading as ExecutionFunction]
  ]);

  // Strategy map for validation functions
  const validationStrategies: Map<CompositionPattern, ValidationFunction> = new Map([
    [CompositionPattern.SEQUENTIAL, validateSequentialComposition as ValidationFunction],
    [CompositionPattern.PARALLEL, validateParallelComposition as ValidationFunction],
    [CompositionPattern.CONDITIONAL, validateConditionalComposition as ValidationFunction],
    [CompositionPattern.ADAPTIVE, validateAdaptiveComposition as ValidationFunction],
    [CompositionPattern.CASCADING, validateCascadingComposition as ValidationFunction]
  ]);

  // Pipeline execution function that handles individual pipeline steps
  const executePipelineStep = async (
    pipeline: PipelineInfo,
    input: any,
    options: any = {}
  ): Promise<any> => {
    const timeout = options.timeout || pipeline.metadata.timeout || composerConfig.defaultTimeout;
    
    // Create execution promise
    const executionPromise = pipeline.instance.process 
      ? pipeline.instance.process(input, { ...pipeline.options, ...options })
      : pipeline.instance(input, { ...pipeline.options, ...options });

    // Apply timeout if specified
    if (timeout > 0) {
      return Promise.race([
        executionPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Pipeline ${pipeline.id} timed out after ${timeout}ms`)), timeout)
        )
      ]);
    }

    return executionPromise;
  };

  // Cache management
  const getCachedResult = (cacheKey: string): ExecutionResult | null => {
    if (!composerConfig.enableCaching) return null;
    return state.executionCache.get(cacheKey) || null;
  };

  const setCachedResult = (cacheKey: string, result: ExecutionResult): void => {
    if (!composerConfig.enableCaching) return;
    
    // Implement LRU cache behavior
    if (state.executionCache.size >= composerConfig.cacheSize) {
      const firstKey = state.executionCache.keys().next().value;
      state.executionCache.delete(firstKey);
    }
    
    state.executionCache.set(cacheKey, {
      ...result,
      metadata: { ...result.metadata, fromCache: true }
    });
  };

  // Update metrics
  const updateMetrics = (result: ExecutionResult, fromCache: boolean = false): void => {
    if (!composerConfig.enableMetrics) return;
    
    state.metrics.compositionsExecuted++;
    state.metrics.totalExecutionTime += result.metadata.executionTime;
    
    if (fromCache) {
      state.metrics.cachedExecutions++;
    } else if (result.success) {
      state.metrics.successfulExecutions++;
    } else {
      state.metrics.failedExecutions++;
    }
  };

  // Return the composer interface
  return {
    /**
     * Register a pipeline with the composer
     */
    registerPipeline: (id: string, pipeline: any, options: any = {}): void => {
      if (!id || typeof id !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      
      if (!pipeline) {
        throw new Error('Pipeline instance is required');
      }

      const pipelineInfo: PipelineInfo = {
        id,
        instance: pipeline,
        options,
        metadata: {
          name: options.name || id,
          version: options.version || '1.0.0',
          dependencies: options.dependencies || [],
          timeout: options.timeout || composerConfig.defaultTimeout,
          retryCount: options.retryCount || 0,
          priority: options.priority || 0,
          ...options.metadata
        }
      };

      state.registeredPipelines.set(id, pipelineInfo);
    },

    /**
     * Create a composition configuration
     */
    createComposition: (config: CompositionConfig): CompositionConfig => {
      // Validate the composition
      const validationFunc = validationStrategies.get(config.pattern);
      if (validationFunc) {
        const errors = validationFunc(config as AnyCompositionConfig);
        if (errors.length > 0) {
          throw new Error(`Composition validation failed: ${errors.join(', ')}`);
        }
      }

      // Store the composition
      state.compositions.set(config.id, config);
      return config;
    },

    /**
     * Execute a composition
     */
    executeComposition: async (
      compositionId: string,
      input: any,
      options: ExecutionOptions = {}
    ): Promise<ExecutionResult> => {
      const startTime = performance.now();
      
      // Get composition
      const composition = state.compositions.get(compositionId);
      if (!composition) {
        throw new Error(`Composition ${compositionId} not found`);
      }

      // Check cache if enabled
      const cacheKey = generateCacheKey(compositionId, input, options);
      const cachedResult = getCachedResult(cacheKey);
      if (cachedResult) {
        updateMetrics(cachedResult, true);
        return cachedResult;
      }

      // Get execution strategy
      const executionFunc = executionStrategies.get(composition.pattern);
      if (!executionFunc) {
        throw new Error(`Execution strategy for pattern ${composition.pattern} not found`);
      }

      try {
        // Execute composition
        const result = await executionFunc(
          composition as AnyCompositionConfig,
          input,
          state.registeredPipelines,
          executePipelineStep,
          options
        );

        // Update execution time in metadata
        const totalExecutionTime = performance.now() - startTime;
        result.metadata.executionTime = totalExecutionTime;
        result.metadata.compositionId = compositionId;

        // Cache result if successful
        if (result.success) {
          setCachedResult(cacheKey, result);
        }

        // Update metrics
        updateMetrics(result);

        return result;

      } catch (error) {
        const errorResult: ExecutionResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            executionTime: performance.now() - startTime,
            pipelinesExecuted: 0,
            successfulPipelines: 0,
            failedPipelines: 0,
            fromCache: false,
            compositionId,
            executionPattern: composition.pattern
          }
        };

        updateMetrics(errorResult);
        return errorResult;
      }
    },

    /**
     * Get a composition by ID
     */
    getComposition: (id: string): CompositionConfig | undefined => {
      return state.compositions.get(id);
    },

    /**
     * Remove a composition
     */
    removeComposition: (id: string): boolean => {
      return state.compositions.delete(id);
    },

    /**
     * Get composer metrics
     */
    getMetrics: (): ComposerMetrics => {
      return { ...state.metrics };
    },

    /**
     * Clear execution cache
     */
    clearCache: (): void => {
      state.executionCache.clear();
    },

    /**
     * Cleanup resources
     */
    cleanup: async (): Promise<void> => {
      state.registeredPipelines.clear();
      state.compositions.clear();
      state.executionCache.clear();
      state.metrics = createEmptyMetrics();
      
      if (state.monitor) {
        if (typeof state.monitor.stop === 'function') {
          await state.monitor.stop();
        }
        state.monitor = null;
      }
    }
  };
};

// Re-export all the factory functions for convenience
export {
  // Sequential
  createSequentialComposition,
  
  // Parallel  
  createParallelComposition,
  
  // Conditional
  createConditionalComposition,
  
  // Adaptive
  createAdaptiveComposition,
  
  // Cascading
  createCascadingComposition,
  
  // Base types and enums
  CompositionPattern,
  ExecutionStrategy,
  
  // Type exports
  type ComposerConfig,
  type CompositionConfig,
  type ExecutionOptions,
  type ExecutionResult,
  type PipelineInfo,
  type ComposerMetrics,
  type BaseComposer,
  type AnyCompositionConfig
};

// Default export
