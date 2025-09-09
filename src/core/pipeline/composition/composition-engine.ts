/**
 * Unified Pipeline Composition Engine
 * Central orchestrator for all pipeline composition patterns and strategies
 */

import { 
  createPipelineComposer,
  CompositionPattern,
  ExecutionStrategy
} from '../composers/index.js';
import { createCompositionMetrics } from './metrics/composition-metrics.js';
import { createCompositionRegistry } from './registry/composition-registry.js';
import { createExecutionScheduler } from './scheduling/execution-scheduler.js';

// Re-export composition patterns
export { CompositionPattern };

export type CompositionPatternType = typeof CompositionPattern[keyof typeof CompositionPattern];

// Re-export execution strategies
export { ExecutionStrategy };

export type ExecutionStrategyType = typeof ExecutionStrategy[keyof typeof ExecutionStrategy];

// Base composition interfaces
export interface BaseComposition {
  id: string;
  name: string;
  pattern: CompositionPatternType;
  strategy: ExecutionStrategyType;
  pipelines: any[];
  options: any;
  metadata?: Record<string, any>;
}

export interface CompositionResult {
  compositionId: string;
  pattern: CompositionPatternType;
  success: boolean;
  results: any[];
  errors: Array<{ pipelineId: string; error: Error; }>;
  executionTime: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface CompositionEngineConfig {
  enableMetrics?: boolean;
  enableScheduling?: boolean;
  enableRegistry?: boolean;
  defaultTimeout?: number;
  maxConcurrentCompositions?: number;
  enableCompositionCaching?: boolean;
  logLevel?: number;
}

/**
 * Creates the unified pipeline composition engine
 */
export const createPipelineCompositionEngine = (config: CompositionEngineConfig = {}) => {
  const engineConfig = {
    enableMetrics: config.enableMetrics !== false,
    enableScheduling: config.enableScheduling !== false,
    enableRegistry: config.enableRegistry !== false,
    defaultTimeout: config.defaultTimeout || 60000,
    maxConcurrentCompositions: config.maxConcurrentCompositions || 10,
    enableCompositionCaching: config.enableCompositionCaching || false,
    logLevel: config.logLevel || 2,
    ...config
  };

  // Initialize composer (single instance managing all patterns)
  const composer = createPipelineComposer(engineConfig);
  
  // Create pattern-specific interfaces
  const composers = {
    [CompositionPattern.SEQUENTIAL]: composer,
    [CompositionPattern.PARALLEL]: composer,
    [CompositionPattern.ADAPTIVE]: composer
  };

  // Initialize supporting systems
  const metrics = engineConfig.enableMetrics ? createCompositionMetrics() : null;
  const registry = engineConfig.enableRegistry ? createCompositionRegistry() : null;
  const scheduler = engineConfig.enableScheduling ? createExecutionScheduler(engineConfig) : null;

  const state = {
    activeCompositions: new Map<string, any>(),
    compositionHistory: [],
    engineMetrics: {
      totalCompositions: 0,
      successfulCompositions: 0,
      failedCompositions: 0,
      avgExecutionTime: 0,
      patternUsage: {} as Record<CompositionPatternType, number>
    }
  };

  // Initialize pattern usage tracking
  Object.values(CompositionPattern).forEach(pattern => {
    state.engineMetrics.patternUsage[pattern] = 0;
  });

  // Execute a composition with the appropriate composer
  const execute = async (composition: BaseComposition): Promise<CompositionResult> => {
    const startTime = Date.now();
    const executionId = `exec_${composition.id}_${startTime}`;

    try {
      // Validate composition
      validateComposition(composition);

      // Register active composition
      state.activeCompositions.set(executionId, {
        composition,
        startTime,
        status: 'running'
      });

      // Get appropriate composer
      const composer = composers[composition.pattern];
      if (!composer) {
        throw new Error(`No composer found for pattern: ${composition.pattern}`);
      }

      // Execute composition using composer
      const result = await composer.executeComposition(composition.id, {}, {
        strategy: composition.strategy,
        ...composition.options
      });
      

      // Update metrics
      const executionTime = Date.now() - startTime;
      updateExecutionMetrics(composition.pattern, true, executionTime);

      // Convert composer result to composition engine format
      // Handle different result formats based on composition pattern
      let results = [];
      if (result.data) {
        if (composition.pattern === CompositionPattern.PARALLEL && result.metadata?.results) {
          // For parallel compositions, extract individual pipeline results
          results = result.metadata.results.map((pipelineResult: any) => pipelineResult.data);
        } else if (composition.pattern === CompositionPattern.SEQUENTIAL) {
          // For sequential compositions, extract the final pipeline result
          if (Array.isArray(result.data) && result.data.length > 0) {
            // Get the last pipeline result (final result in sequential execution)
            const finalResult = result.data[result.data.length - 1];
            results = [{ result: finalResult.data }];
          } else {
            results = [{ result: result.data }];
          }
        } else if (Array.isArray(result.data)) {
          results = result.data;
        } else {
          results = [result.data];
        }
      }

      const compositionResult: CompositionResult = {
        compositionId: composition.id,
        pattern: composition.pattern,
        success: result.success,
        results,
        errors: result.error ? [{ pipelineId: 'unknown', error: new Error(result.error) }] : [],
        executionTime,
        timestamp: Date.now(),
        metadata: result.metadata
      };

      // Record in history
      if (state.compositionHistory.length > 100) {
        state.compositionHistory.shift();
      }
      state.compositionHistory.push(compositionResult);

      return compositionResult;

    } catch (error) {
      // Update error metrics
      updateExecutionMetrics(composition.pattern, false, Date.now() - startTime);
      
      throw error;
    } finally {
      // Cleanup active composition
      state.activeCompositions.delete(executionId);
    }
  };

  // Validate composition configuration
  const validateComposition = (composition: BaseComposition): void => {
    if (!composition.id || !composition.pattern) {
      throw new Error('Composition must have id and pattern');
    }

    if (!Object.values(CompositionPattern).includes(composition.pattern)) {
      throw new Error(`Invalid composition pattern: ${composition.pattern}`);
    }

    if (!composition.pipelines || !Array.isArray(composition.pipelines)) {
      throw new Error('Composition must have pipelines array');
    }

    if (composition.pipelines.length === 0) {
      throw new Error('Composition must have at least one pipeline');
    }
  };

  // Update execution metrics
  const updateExecutionMetrics = (pattern: CompositionPatternType, success: boolean, executionTime: number): void => {
    state.engineMetrics.totalCompositions++;
    state.engineMetrics.patternUsage[pattern]++;

    if (success) {
      state.engineMetrics.successfulCompositions++;
    } else {
      state.engineMetrics.failedCompositions++;
    }

    // Update average execution time
    const totalExecutions = state.engineMetrics.totalCompositions;
    state.engineMetrics.avgExecutionTime = 
      (state.engineMetrics.avgExecutionTime * (totalExecutions - 1) + executionTime) / totalExecutions;
  };

  // Create composition from template
  const createComposition = (
    pattern: CompositionPatternType,
    compositionConfig: any
  ): BaseComposition => {
    const composer = composers[pattern];
    if (!composer) {
      throw new Error(`No composer found for pattern: ${pattern}`);
    }

    // Register pipelines from the composition config if they contain inline pipeline definitions
    if (compositionConfig.pipelines) {
      for (const pipelineSpec of compositionConfig.pipelines) {
        if (pipelineSpec.pipeline && pipelineSpec.id) {
          // Register inline pipeline
          composer.registerPipeline(pipelineSpec.id, pipelineSpec.pipeline);
        }
      }
    }

    // Convert composition to standard format
    let convertedConfig = { ...compositionConfig, pattern };
    
    // Handle pattern-specific conversions
    if (pattern === CompositionPattern.SEQUENTIAL) {
      convertedConfig.pipelines = compositionConfig.pipelines?.map((p: any) => 
        typeof p === 'string' ? { id: p } : { id: p.id || p }
      ) || [];
      // Ensure sequential composition has proper default options
      convertedConfig.options = {
        retryCount: 0,
        retryDelay: 1000,
        continueOnError: false,
        passPreviousResults: false,
        ...convertedConfig.options
      };
    } else if (pattern === CompositionPattern.PARALLEL) {
      convertedConfig.pipelines = compositionConfig.pipelines?.map((p: any) => 
        typeof p === 'string' ? { id: p } : { id: p.id || p }
      ) || [];
      // Ensure parallel composition has proper default options
      convertedConfig.options = {
        failureThreshold: 0.5,
        maxConcurrent: 5,
        waitForAll: true,
        ...convertedConfig.options
      };
    } else if (pattern === CompositionPattern.ADAPTIVE) {
      // Adaptive needs special handling - keep as is if already in proper format
      if (compositionConfig.pipelines && compositionConfig.pipelines[0]?.condition) {
        convertedConfig = compositionConfig; // Already in adaptive format
      }
    }

    // Create composition using composer
    const composition = composer.createComposition(convertedConfig);

    return composition;
  };

  // Schedule composition for execution
  const schedule = async (
    composition: BaseComposition,
    scheduleOptions: any = {}
  ): Promise<string> => {
    if (!scheduler) {
      throw new Error('Scheduling is disabled');
    }

    return await scheduler.schedule(composition, scheduleOptions);
  };

  // Register a reusable composition template
  const register = (composition: BaseComposition): void => {
    if (!registry) {
      throw new Error('Registry is disabled');
    }

    registry.register(composition);
  };

  // Get registered composition by ID
  const getComposition = (compositionId: string): BaseComposition | null => {
    if (!registry) {
      return null;
    }

    return registry.get(compositionId);
  };

  // Execute registered composition by ID
  const executeById = async (
    compositionId: string,
    overrides: any = {}
  ): Promise<CompositionResult> => {
    const composition = getComposition(compositionId);
    if (!composition) {
      throw new Error(`Composition not found: ${compositionId}`);
    }

    // Apply overrides
    const executionComposition = {
      ...composition,
      ...overrides,
      options: {
        ...composition.options,
        ...overrides.options
      }
    };

    return await execute(executionComposition);
  };

  // Get optimal composition pattern for given requirements
  const suggestPattern = (requirements: {
    pipelineCount?: number;
    needsConditionalLogic?: boolean;
    requiresAdaptation?: boolean;
    executionTime?: number;
    errorTolerance?: 'low' | 'medium' | 'high';
  }): CompositionPatternType => {
    const {
      pipelineCount = 1,
      needsConditionalLogic = false,
      requiresAdaptation = false,
      executionTime = 0,
      errorTolerance = 'medium'
    } = requirements;

    // Rule-based pattern suggestion (3 core patterns)
    if (requiresAdaptation || needsConditionalLogic) {
      return CompositionPattern.ADAPTIVE;
    }

    if (pipelineCount > 2 && errorTolerance === 'high') {
      return CompositionPattern.PARALLEL;
    }

    return CompositionPattern.SEQUENTIAL;
  };

  // Batch execution of multiple compositions
  const executeBatch = async (
    compositions: BaseComposition[],
    batchOptions: {
      parallel?: boolean;
      maxConcurrency?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<CompositionResult[]> => {
    const {
      parallel = false,
      maxConcurrency = engineConfig.maxConcurrentCompositions,
      continueOnError = true
    } = batchOptions;

    if (!parallel) {
      // Sequential execution
      const results = [];
      for (const composition of compositions) {
        try {
          const result = await execute(composition);
          results.push(result);
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          results.push({
            compositionId: composition.id,
            pattern: composition.pattern,
            success: false,
            results: [],
            errors: [{ pipelineId: 'composition', error }],
            executionTime: 0,
            timestamp: Date.now()
          });
        }
      }
      return results;
    }

    // Parallel execution with concurrency limit
    const executeWithLimit = async (composition: BaseComposition) => {
      try {
        return await execute(composition);
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        return {
          compositionId: composition.id,
          pattern: composition.pattern,
          success: false,
          results: [],
          errors: [{ pipelineId: 'composition', error }],
          executionTime: 0,
          timestamp: Date.now()
        };
      }
    };

    // Execute in batches to respect concurrency limit
    const results = [];
    for (let i = 0; i < compositions.length; i += maxConcurrency) {
      const batch = compositions.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch.map(executeWithLimit));
      results.push(...batchResults);
    }

    return results;
  };

  // Get engine metrics and statistics
  const getMetrics = () => ({
    ...state.engineMetrics,
    activeCompositions: state.activeCompositions.size,
    compositionHistory: state.compositionHistory.length,
    successRate: state.engineMetrics.totalCompositions > 0
      ? state.engineMetrics.successfulCompositions / state.engineMetrics.totalCompositions
      : 0,
    avgExecutionTimeByPattern: Object.fromEntries(
      Object.entries(state.engineMetrics.patternUsage).map(([pattern, count]) => [
        pattern,
        count > 0 ? state.engineMetrics.avgExecutionTime : 0
      ])
    )
  });

  // Get composition execution statistics
  const getStatistics = () => ({
    engine: getMetrics(),
    composers: Object.fromEntries(
      Object.entries(composers).map(([pattern, composer]) => [
        pattern,
        composer.getMetrics ? composer.getMetrics() : {}
      ])
    ),
    registry: registry?.getStats() || null,
    scheduler: scheduler?.getStats() || null,
    metrics: metrics?.getOverallMetrics() || null
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    // Cancel active compositions
    for (const [executionId, execution] of state.activeCompositions) {
      if (execution.cancel) {
        await execution.cancel();
      }
    }
    state.activeCompositions.clear();

    // Cleanup supporting systems
    if (scheduler) await scheduler.cleanup();
    if (registry) await registry.cleanup();
    if (metrics) await metrics.cleanup();

    // Cleanup composer
    if (composer && composer.cleanup) {
      await composer.cleanup();
    }

    // Reset state
    state.compositionHistory = [];
    state.engineMetrics = {
      totalCompositions: 0,
      successfulCompositions: 0,
      failedCompositions: 0,
      avgExecutionTime: 0,
      patternUsage: {} as Record<CompositionPatternType, number>
    };
  };

  return {
    // Core execution
    execute,
    executeById,
    executeBatch,
    schedule,

    // Composition management
    createComposition,
    register,
    getComposition,
    suggestPattern,

    // Monitoring and metrics
    getMetrics,
    getStatistics,

    // Component access
    composers,
    registry,
    scheduler,
    metrics,

    // Configuration
    getConfig: () => ({ ...engineConfig }),

    // Lifecycle
    cleanup
  };
};
