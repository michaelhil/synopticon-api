/**
 * Conditional Pipeline Composer
 * Executes pipelines based on dynamic conditions and branching logic
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';
import type { 
  CompositionPatternType, 
  ExecutionStrategyType, 
  BaseComposition, 
  CompositionResult,
  CompositionEngineConfig 
} from '../composition-engine.js';

export interface ConditionalPipeline {
  id: string;
  name?: string;
  pipeline: any;
  options?: any;
  condition: (input: any, context: ConditionalContext) => boolean | Promise<boolean>;
  priority?: number;
  timeout?: number;
  retryCount?: number;
  fallback?: ConditionalPipeline;
  inputTransformer?: (input: any, context: ConditionalContext) => any;
  outputTransformer?: (output: any, context: ConditionalContext) => any;
}

export interface ConditionalBranch {
  id: string;
  name?: string;
  condition: (input: any, context: ConditionalContext) => boolean | Promise<boolean>;
  pipelines: ConditionalPipeline[];
  isDefault?: boolean;
  executionMode?: 'sequential' | 'parallel';
}

export interface ConditionalContext {
  evaluatedConditions: Map<string, boolean>;
  executedPipelines: Set<string>;
  branchHistory: string[];
  input: any;
  executionStartTime: number;
  evaluationTime: number;
}

export interface ConditionalComposition extends BaseComposition {
  pattern: 'conditional';
  branches: ConditionalBranch[];
  options: {
    strategy?: ExecutionStrategyType;
    timeout?: number;
    evaluationMode?: 'eager' | 'lazy';
    branchingStrategy?: 'first_match' | 'all_matches' | 'best_match';
    conditionCaching?: boolean;
    enableFallback?: boolean;
    parallelEvaluation?: boolean;
  };
}

export interface ConditionalComposerConfig extends CompositionEngineConfig {
  defaultEvaluationTimeout?: number;
  enableConditionOptimization?: boolean;
  conditionCacheSize?: number;
}

/**
 * Creates conditional pipeline composer
 */
export const createConditionalComposer = (config: ConditionalComposerConfig = {}) => {
  const composerConfig = {
    defaultEvaluationTimeout: config.defaultEvaluationTimeout || 5000,
    enableConditionOptimization: config.enableConditionOptimization !== false,
    conditionCacheSize: config.conditionCacheSize || 100,
    ...config
  };

  const state = {
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgEvaluationTime: 0,
      conditionEvaluations: 0,
      branchHits: new Map<string, number>(),
      fallbackActivations: 0
    },
    activeExecutions: new Map<string, any>(),
    conditionCache: new Map<string, { result: boolean; timestamp: number; }>()
  };

  // Evaluate condition with caching and timeout
  const evaluateCondition = async (
    condition: (input: any, context: ConditionalContext) => boolean | Promise<boolean>,
    conditionId: string,
    input: any,
    context: ConditionalContext
  ): Promise<boolean> => {
    const cacheKey = `${conditionId}_${JSON.stringify(input).slice(0, 100)}`;
    
    // Check cache if enabled
    if (composerConfig.enableConditionOptimization) {
      const cached = state.conditionCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 30000) { // 30s cache
        return cached.result;
      }
    }

    const evaluationStartTime = Date.now();
    
    try {
      // Evaluate with timeout
      const result = await executeWithTimeout(
        Promise.resolve(condition(input, context)),
        composerConfig.defaultEvaluationTimeout,
        `Condition ${conditionId} evaluation`
      );

      const evaluationTime = Date.now() - evaluationStartTime;
      context.evaluationTime += evaluationTime;
      state.metrics.conditionEvaluations++;

      // Cache result
      if (composerConfig.enableConditionOptimization) {
        if (state.conditionCache.size >= composerConfig.conditionCacheSize) {
          const oldestKey = state.conditionCache.keys().next().value;
          state.conditionCache.delete(oldestKey);
        }
        state.conditionCache.set(cacheKey, { result, timestamp: Date.now() });
      }

      context.evaluatedConditions.set(conditionId, result);
      return result;

    } catch (error) {
      throw handleError(
        `Condition evaluation failed for ${conditionId}: ${error.message}`,
        ErrorCategory.PIPELINE_EXECUTION,
        ErrorSeverity.ERROR
      );
    }
  };

  // Execute pipeline within branch
  const executePipeline = async (
    pipelineConfig: ConditionalPipeline,
    input: any,
    context: ConditionalContext,
    executionId: string
  ): Promise<any> => {
    const { id, pipeline, options = {}, timeout, retryCount = 0 } = pipelineConfig;
    const pipelineTimeout = timeout || 30000;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Check if execution was cancelled
        const execution = state.activeExecutions.get(executionId);
        if (execution?.cancelled) {
          throw new Error('Execution cancelled');
        }

        // Apply input transformer if present
        let transformedInput = input;
        if (pipelineConfig.inputTransformer) {
          transformedInput = pipelineConfig.inputTransformer(input, context);
        }

        // Execute pipeline with timeout
        const result = await executeWithTimeout(
          pipeline.process(transformedInput, options),
          pipelineTimeout,
          `Pipeline ${id} execution`
        );

        // Apply output transformer if present
        let transformedResult = result;
        if (pipelineConfig.outputTransformer) {
          transformedResult = pipelineConfig.outputTransformer(result, context);
        }

        context.executedPipelines.add(id);

        return {
          success: true,
          pipelineId: id,
          branchId: context.branchHistory[context.branchHistory.length - 1],
          result: transformedResult,
          priority: pipelineConfig.priority || 5,
          attempt
        };

      } catch (error) {
        lastError = error;
        
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Try fallback pipeline if available
    if (pipelineConfig.fallback) {
      state.metrics.fallbackActivations++;
      return await executePipeline(pipelineConfig.fallback, input, context, executionId);
    }

    throw lastError || new Error(`Pipeline ${id} failed`);
  };

  // Execute conditional composition
  const execute = async (composition: ConditionalComposition): Promise<CompositionResult> => {
    const startTime = Date.now();
    const executionId = `cond_${composition.id}_${startTime}`;

    try {
      if (!composition.branches || composition.branches.length === 0) {
        throw new Error('Conditional composition must have at least one branch');
      }

      // Create execution context
      const context: ConditionalContext = {
        evaluatedConditions: new Map(),
        executedPipelines: new Set(),
        branchHistory: [],
        input: (composition.options as any).initialInput || {},
        executionStartTime: startTime,
        evaluationTime: 0
      };

      // Register active execution
      state.activeExecutions.set(executionId, {
        startTime,
        cancelled: false,
        context
      });

      const results: any[] = [];
      const errors: Array<{ pipelineId: string; error: Error; }> = [];
      const branchingStrategy = composition.options.branchingStrategy || 'first_match';

      // Evaluate conditions and select branches
      const matchingBranches: ConditionalBranch[] = [];
      const evaluationPromises: Promise<void>[] = [];

      for (const branch of composition.branches) {
        const evaluationPromise = async () => {
          try {
            const conditionMet = await evaluateCondition(
              branch.condition,
              branch.id,
              context.input,
              context
            );

            if (conditionMet) {
              matchingBranches.push(branch);
              state.metrics.branchHits.set(branch.id, (state.metrics.branchHits.get(branch.id) || 0) + 1);
            }
          } catch (error) {
            errors.push({ pipelineId: branch.id, error });
          }
        };

        if (composition.options.parallelEvaluation) {
          evaluationPromises.push(evaluationPromise());
        } else {
          await evaluationPromise();
          
          // For first_match strategy, stop after first match
          if (branchingStrategy === 'first_match' && matchingBranches.length > 0) {
            break;
          }
        }
      }

      // Wait for parallel evaluations to complete
      if (composition.options.parallelEvaluation) {
        await Promise.allSettled(evaluationPromises);
      }

      // Handle no matching branches
      if (matchingBranches.length === 0) {
        // Look for default branch
        const defaultBranch = composition.branches.find(b => b.isDefault);
        if (defaultBranch) {
          matchingBranches.push(defaultBranch);
        } else if (composition.options.enableFallback) {
          // Return empty success result as fallback
          return {
            compositionId: composition.id,
            pattern: 'conditional',
            success: true,
            results: [],
            errors,
            executionTime: Date.now() - startTime,
            timestamp: startTime,
            metadata: {
              branchesEvaluated: composition.branches.length,
              branchesMatched: 0,
              evaluationTime: context.evaluationTime,
              fallbackActivated: true
            }
          };
        } else {
          throw new Error('No branches matched conditions and no default branch specified');
        }
      }

      // Execute selected branches based on strategy
      let branchesToExecute = matchingBranches;
      
      switch (branchingStrategy) {
        case 'first_match':
          branchesToExecute = [matchingBranches[0]];
          break;
        case 'best_match':
          // Sort by priority if available, otherwise use first
          branchesToExecute = [matchingBranches.sort((a, b) => {
            const aPriority = a.pipelines.reduce((max, p) => Math.max(max, p.priority || 5), 0);
            const bPriority = b.pipelines.reduce((max, p) => Math.max(max, p.priority || 5), 0);
            return bPriority - aPriority;
          })[0]];
          break;
        case 'all_matches':
        default:
          // Execute all matching branches
          break;
      }

      // Execute pipelines in selected branches
      for (const branch of branchesToExecute) {
        context.branchHistory.push(branch.id);

        if (branch.executionMode === 'parallel') {
          // Execute branch pipelines in parallel
          const branchPromises = branch.pipelines.map(pipeline =>
            executePipeline(pipeline, context.input, context, executionId)
              .catch(error => ({ error, pipelineId: pipeline.id }))
          );

          const branchResults = await Promise.allSettled(branchPromises);
          
          for (const result of branchResults) {
            if (result.status === 'fulfilled') {
              if (result.value.error) {
                errors.push({ pipelineId: result.value.pipelineId, error: result.value.error });
              } else {
                results.push(result.value);
              }
            }
          }

        } else {
          // Execute branch pipelines sequentially
          for (const pipeline of branch.pipelines) {
            try {
              const result = await executePipeline(pipeline, context.input, context, executionId);
              results.push(result);
            } catch (error) {
              errors.push({ pipelineId: pipeline.id, error });
              
              const strategy = composition.strategy || composition.options.strategy || 'continue_on_error';
              if (strategy === 'fail_fast') {
                throw error;
              }
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0;

      // Update metrics
      updateMetrics(success, executionTime, context.evaluationTime);

      return {
        compositionId: composition.id,
        pattern: 'conditional',
        success,
        results,
        errors,
        executionTime,
        timestamp: startTime,
        metadata: {
          branchesEvaluated: composition.branches.length,
          branchesMatched: matchingBranches.length,
          branchesExecuted: branchesToExecute.length,
          evaluationTime: context.evaluationTime,
          branchHistory: context.branchHistory,
          conditionsEvaluated: context.evaluatedConditions.size,
          pipelinesExecuted: context.executedPipelines.size
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      updateMetrics(false, executionTime, 0);
      
      throw handleError(
        `Conditional composition ${composition.id} failed: ${error.message}`,
        ErrorCategory.PIPELINE_EXECUTION,
        ErrorSeverity.ERROR
      );
    } finally {
      state.activeExecutions.delete(executionId);
    }
  };

  // Helper function for timeout execution
  const executeWithTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${timeoutMessage} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  };

  // Update execution metrics
  const updateMetrics = (success: boolean, executionTime: number, evaluationTime: number): void => {
    state.metrics.totalExecutions++;
    
    if (success) {
      state.metrics.successfulExecutions++;
    } else {
      state.metrics.failedExecutions++;
    }

    // Update averages
    const totalExecutions = state.metrics.totalExecutions;
    state.metrics.avgExecutionTime = 
      (state.metrics.avgExecutionTime * (totalExecutions - 1) + executionTime) / totalExecutions;

    state.metrics.avgEvaluationTime = 
      (state.metrics.avgEvaluationTime * (totalExecutions - 1) + evaluationTime) / totalExecutions;
  };

  // Create composition from configuration
  const createComposition = (config: {
    id: string;
    name?: string;
    branches: ConditionalBranch[];
    options?: ConditionalComposition['options'];
  }): ConditionalComposition => {
    return {
      id: config.id,
      name: config.name || config.id,
      pattern: 'conditional',
      strategy: 'continue_on_error',
      pipelines: config.branches.flatMap(b => b.pipelines),
      options: {
        strategy: 'continue_on_error',
        timeout: 60000,
        evaluationMode: 'eager',
        branchingStrategy: 'first_match',
        conditionCaching: composerConfig.enableConditionOptimization,
        enableFallback: true,
        parallelEvaluation: false,
        ...config.options
      },
      branches: config.branches
    };
  };

  // Get composer metrics
  const getMetrics = () => ({
    ...state.metrics,
    activeExecutions: state.activeExecutions.size,
    successRate: state.metrics.totalExecutions > 0
      ? state.metrics.successfulExecutions / state.metrics.totalExecutions
      : 0,
    avgEvaluationRatio: state.metrics.avgExecutionTime > 0
      ? state.metrics.avgEvaluationTime / state.metrics.avgExecutionTime
      : 0,
    branchUtilization: Object.fromEntries(state.metrics.branchHits),
    conditionCacheSize: state.conditionCache.size
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    // Cancel all active executions
    for (const [executionId, execution] of state.activeExecutions) {
      execution.cancelled = true;
    }
    
    state.activeExecutions.clear();
    state.conditionCache.clear();
    
    // Reset metrics
    state.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgEvaluationTime: 0,
      conditionEvaluations: 0,
      branchHits: new Map(),
      fallbackActivations: 0
    };
  };

  return {
    execute,
    createComposition,
    getMetrics,
    cleanup,
    
    // Pattern identification
    pattern: 'conditional' as const
  };
};