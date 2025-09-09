/**
 * Pipeline Composer Factory
 * Unified interface for 3 core composition patterns: Sequential, Parallel, Adaptive
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
} from './base-composer.js';

// Import only core composer implementations (3 strategies)
import {
  SequentialCompositionConfig,
  createSequentialComposition,
  executeSequential,
  validateSequentialComposition
} from './sequential-composer.js';

import {
  ParallelCompositionConfig,
  createParallelComposition,
  executeParallel,
  validateParallelComposition
} from './parallel-composer.js';

import {
  AdaptiveCompositionConfig,
  createAdaptiveComposition,
  executeAdaptive,
  validateAdaptiveComposition
} from './adaptive-composer.js';

// Core composition configuration types
export type CoreCompositionConfig = 
  | SequentialCompositionConfig
  | ParallelCompositionConfig
  | AdaptiveCompositionConfig;

// Execution function type
type ExecutionFunction = (
  composition: CoreCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options?: ExecutionOptions
) => Promise<ExecutionResult>;

// Validation function type
type ValidationFunction = (composition: CoreCompositionConfig) => string[];

/**
 * Create Pipeline Composer
 * Implements Strategy pattern for 3 core composition types
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
    [CompositionPattern.ADAPTIVE, executeAdaptive as ExecutionFunction]
  ]);

  // Strategy map for validation functions
  const validationStrategies: Map<CompositionPattern, ValidationFunction> = new Map([
    [CompositionPattern.SEQUENTIAL, validateSequentialComposition as ValidationFunction],
    [CompositionPattern.PARALLEL, validateParallelComposition as ValidationFunction],
    [CompositionPattern.ADAPTIVE, validateAdaptiveComposition as ValidationFunction]
  ]);

  // Enhanced pipeline execution with improved error handling
  const executePipelineStep = async (
    pipeline: PipelineInfo,
    input: any,
    options: any = {}
  ): Promise<any> => {
    const timeout = options.timeout || pipeline.metadata.timeout || composerConfig.defaultTimeout;
    
    try {
      // Create execution promise with enhanced context
      const executionPromise = pipeline.instance.process 
        ? pipeline.instance.process(input, { 
          ...pipeline.options, 
          ...options,
          pipelineId: pipeline.id,
          executionContext: options.executionContext || 'composer'
        })
        : pipeline.instance(input, { 
          ...pipeline.options, 
          ...options,
          pipelineId: pipeline.id
        });

      // Apply timeout with enhanced error context
      if (timeout > 0) {
        return Promise.race([
          executionPromise,
          new Promise((_, reject) => 
            setTimeout(() => 
              reject(new Error(`Pipeline ${pipeline.id} (${pipeline.metadata.name}) timed out after ${timeout}ms`)), 
            timeout
            )
          )
        ]);
      }

      return executionPromise;

    } catch (error) {
      // Enhanced error context for better debugging
      const enhancedError = new Error(
        `Pipeline execution failed: ${pipeline.id} (${pipeline.metadata.name}) - ${error.message}`
      );
      enhancedError.cause = error;
      throw enhancedError;
    }
  };

  // Optimized cache management with TTL support
  const getCachedResult = (cacheKey: string): ExecutionResult | null => {
    if (!composerConfig.enableCaching) return null;
    
    const cachedEntry = state.executionCache.get(cacheKey);
    if (!cachedEntry) return null;

    // Check TTL if configured
    if (composerConfig.cacheMaxAge && cachedEntry.metadata.cachedAt) {
      const age = Date.now() - cachedEntry.metadata.cachedAt;
      if (age > composerConfig.cacheMaxAge) {
        state.executionCache.delete(cacheKey);
        return null;
      }
    }

    return cachedEntry;
  };

  const setCachedResult = (cacheKey: string, result: ExecutionResult): void => {
    if (!composerConfig.enableCaching) return;
    
    // Implement LRU cache behavior
    if (state.executionCache.size >= composerConfig.cacheSize) {
      const firstKey = state.executionCache.keys().next().value;
      state.executionCache.delete(firstKey);
    }
    
    // Add cache timestamp for TTL
    const cachedResult: ExecutionResult = {
      ...result,
      metadata: { 
        ...result.metadata, 
        fromCache: true,
        cachedAt: Date.now()
      }
    };
    
    state.executionCache.set(cacheKey, cachedResult);
  };

  // Enhanced metrics tracking
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

    // Track pattern usage for analytics
    const pattern = result.metadata.executionPattern;
    if (pattern) {
      if (!state.metrics.patternUsage) {
        state.metrics.patternUsage = new Map();
      }
      const current = state.metrics.patternUsage.get(pattern) || 0;
      state.metrics.patternUsage.set(pattern, current + 1);
    }
  };

  // Return the composer interface
  return {
    /**
     * Register a pipeline with enhanced validation
     */
    registerPipeline: (id: string, pipeline: any, options: any = {}): void => {
      if (!id || typeof id !== 'string') {
        throw new Error('Pipeline ID must be a non-empty string');
      }
      
      if (!pipeline) {
        throw new Error('Pipeline instance is required');
      }

      // Enhanced pipeline validation
      if (typeof pipeline !== 'function' && !pipeline.process) {
        throw new Error(`Pipeline ${id} must be a function or have a 'process' method`);
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
          registeredAt: Date.now(),
          ...options.metadata
        }
      };

      state.registeredPipelines.set(id, pipelineInfo);
    },

    /**
     * Create a composition configuration with enhanced validation
     */
    createComposition: (config: CompositionConfig): CompositionConfig => {
      // Validate supported patterns only (3 core strategies)
      const supportedPatterns = [
        CompositionPattern.SEQUENTIAL,
        CompositionPattern.PARALLEL, 
        CompositionPattern.ADAPTIVE
      ];

      if (!supportedPatterns.includes(config.pattern)) {
        throw new Error(
          `Unsupported composition pattern: ${config.pattern}. ` +
          `Supported patterns: ${supportedPatterns.join(', '). ` +
          'Note: CONDITIONAL and CASCADING patterns are not supported.'
        );
      }

      // Enhanced composition validation
      const validationFunc = validationStrategies.get(config.pattern);
      if (validationFunc) {
        const errors = validationFunc(config as CoreCompositionConfig);
        if (errors.length > 0) {
          throw new Error(`Composition validation failed: ${errors.join(', ')`);
        }
      }

      // Store the composition with metadata
      const enhancedConfig = {
        ...config,
        metadata: {
          ...config.metadata,
          createdAt: Date.now(),
          composerVersion: '2.0.0'
        }
      };

      state.compositions.set(config.id, enhancedConfig);
      return enhancedConfig;
    },

    /**
     * Execute a composition with enhanced error handling and monitoring
     */
    executeComposition: async (
      compositionId: string,
      input: any,
      options: ExecutionOptions = {}
    ): Promise<ExecutionResult> => {
      const startTime = performance.now();
      const executionId = `${compositionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Get composition
        const composition = state.compositions.get(compositionId);
        if (!composition) {
          throw new Error(`Composition ${compositionId} not found`);
        }

        // Enhanced options with execution context
        const enhancedOptions = {
          ...options,
          executionId,
          startTime,
          executionContext: 'composer'
        };

        // Check cache if enabled
        const cacheKey = generateCacheKey(compositionId, input, enhancedOptions);
        const cachedResult = getCachedResult(cacheKey);
        if (cachedResult) {
          updateMetrics(cachedResult, true);
          return cachedResult;
        }

        // Get execution strategy
        const executionFunc = executionStrategies.get(composition.pattern);
        if (!executionFunc) {
          throw new Error(
            `Execution strategy for pattern ${composition.pattern} not found. ` +
            'This should not happen with supported strategies.'
          );
        }

        // Execute composition with enhanced context
        const result = await executionFunc(
          composition as CoreCompositionConfig,
          input,
          state.registeredPipelines,
          executePipelineStep,
          enhancedOptions
        );

        // Enhanced result metadata
        const totalExecutionTime = performance.now() - startTime;
        const enhancedResult: ExecutionResult = {
          ...result,
          metadata: {
            ...result.metadata,
            executionTime: totalExecutionTime,
            compositionId,
            executionId,
            composerVersion: '2.0.0',
            strategyCount: 3 // Number of available strategies
          }
        };

        // Cache result if successful
        if (result.success) {
          setCachedResult(cacheKey, enhancedResult);
        }

        // Update metrics
        updateMetrics(enhancedResult);

        return enhancedResult;

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
            executionId,
            composerVersion: '2.0.0',
            errorStack: error instanceof Error ? error.stack : undefined
          }
        };

        updateMetrics(errorResult);
        return errorResult;
      }
    },

    /**
     * Get composition by ID
     */
    getComposition: (id: string): CompositionConfig | undefined => {
      return state.compositions.get(id);
    },

    /**
     * List all compositions
     */
    listCompositions: (): CompositionConfig[] => {
      return Array.from(state.compositions.values());
    },

    /**
     * Remove a composition
     */
    removeComposition: (id: string): boolean => {
      return state.compositions.delete(id);
    },

    /**
     * Get enhanced metrics
     */
    getMetrics: (): ComposerMetrics => {
      return { 
        ...state.metrics,
        registeredPipelines: state.registeredPipelines.size,
        registeredCompositions: state.compositions.size,
        cacheSize: state.executionCache.size,
        supportedStrategies: ['sequential', 'parallel', 'adaptive']
      };
    },

    /**
     * Clear execution cache
     */
    clearCache: (): void => {
      state.executionCache.clear();
    },

    /**
     * Get composer status
     */
    getStatus: () => ({
      version: '2.0.0',
      strategiesSupported: 3,
      strategiesRemoved: ['conditional', 'cascading'],
      pipelinesRegistered: state.registeredPipelines.size,
      compositionsRegistered: state.compositions.size,
      cacheEnabled: composerConfig.enableCaching,
      metricsEnabled: composerConfig.enableMetrics
    }),

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

// Re-export factory functions (3 core strategies only)
export {
  // Core strategies
  createSequentialComposition,
  createParallelComposition,
  createAdaptiveComposition,
  
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
  type CoreCompositionConfig
};
