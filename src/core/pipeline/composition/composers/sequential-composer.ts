/**
 * Sequential Pipeline Composer
 * Executes pipelines one after another with result passing
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';
import type { 
  CompositionPatternType, 
  ExecutionStrategyType, 
  BaseComposition, 
  CompositionResult,
  CompositionEngineConfig 
} from '../composition-engine.js';

export interface SequentialPipeline {
  id: string;
  name?: string;
  pipeline: any; // Pipeline instance
  options?: any;
  inputTransformer?: (input: any, previousResults: any[]) => any;
  outputTransformer?: (output: any, allResults: any[]) => any;
  condition?: (input: any, previousResults: any[]) => boolean;
  timeout?: number;
  retryCount?: number;
}

export interface SequentialComposition extends BaseComposition {
  pattern: 'sequential';
  pipelines: SequentialPipeline[];
  options: {
    strategy?: ExecutionStrategyType;
    timeout?: number;
    passPreviousResults?: boolean;
    aggregateResults?: boolean;
    enableShortCircuit?: boolean;
    resultPropagation?: 'all' | 'last' | 'successful_only';
  };
}

export interface SequentialComposerConfig extends CompositionEngineConfig {
  defaultRetryCount?: number;
  defaultTimeout?: number;
  enableResultCaching?: boolean;
}

/**
 * Creates sequential pipeline composer
 */
export const createSequentialComposer = (config: SequentialComposerConfig = {}) => {
  const composerConfig = {
    defaultRetryCount: config.defaultRetryCount || 0,
    defaultTimeout: config.defaultTimeout || 30000,
    enableResultCaching: config.enableResultCaching || false,
    ...config
  };

  const state = {
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgPipelinesPerComposition: 0,
      shortCircuitActivations: 0,
      retryAttempts: 0
    },
    activeExecutions: new Map<string, any>()
  };

  // Execute a single pipeline with retries and timeout
  const executePipeline = async (
    pipelineConfig: SequentialPipeline,
    input: any,
    previousResults: any[],
    executionId: string
  ): Promise<any> => {
    const { id, pipeline, options = {}, timeout, retryCount = composerConfig.defaultRetryCount } = pipelineConfig;
    const pipelineTimeout = timeout || composerConfig.defaultTimeout;

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
          transformedInput = pipelineConfig.inputTransformer(input, previousResults);
        }

        // Check condition if present
        if (pipelineConfig.condition && !pipelineConfig.condition(transformedInput, previousResults)) {
          return { skipped: true, reason: 'condition_failed', pipelineId: id };
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
          transformedResult = pipelineConfig.outputTransformer(result, [...previousResults, result]);
        }

        return {
          success: true,
          pipelineId: id,
          result: transformedResult,
          executionTime: Date.now(), // Will be calculated properly by caller
          attempt
        };

      } catch (error) {
        lastError = error;
        state.metrics.retryAttempts++;

        // If not the last attempt, wait before retrying
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw handleError(
      `Pipeline ${id} failed after ${retryCount + 1} attempts: ${lastError?.message}`,
      ErrorCategory.PIPELINE_EXECUTION,
      ErrorSeverity.ERROR
    );
  };

  // Execute sequential composition
  const execute = async (composition: SequentialComposition): Promise<CompositionResult> => {
    const startTime = Date.now();
    const executionId = `seq_${composition.id}_${startTime}`;
    
    try {
      // Validate composition
      if (!composition.pipelines || composition.pipelines.length === 0) {
        throw new Error('Sequential composition must have at least one pipeline');
      }

      // Register active execution
      state.activeExecutions.set(executionId, {
        startTime,
        cancelled: false,
        currentPipeline: 0,
        totalPipelines: composition.pipelines.length
      });

      const results: any[] = [];
      const errors: Array<{ pipelineId: string; error: Error; }> = [];
      let input = (composition.options as any).initialInput || {};

      // Execute pipelines sequentially
      for (let i = 0; i < composition.pipelines.length; i++) {
        const pipelineConfig = composition.pipelines[i];
        
        // Update execution status
        const execution = state.activeExecutions.get(executionId);
        if (execution) {
          execution.currentPipeline = i;
        }

        try {
          const pipelineStartTime = Date.now();
          
          // Prepare input for pipeline
          const pipelineInput = composition.options.passPreviousResults 
            ? { input, previousResults: results }
            : input;

          const result = await executePipeline(
            pipelineConfig,
            pipelineInput,
            results,
            executionId
          );

          // Handle result
          if (result.skipped) {
            results.push(result);
            continue;
          }

          const pipelineExecutionTime = Date.now() - pipelineStartTime;
          const finalResult = {
            ...result,
            executionTime: pipelineExecutionTime
          };

          results.push(finalResult);

          // Update input for next pipeline
          if (composition.options.passPreviousResults) {
            input = finalResult.result;
          }

          // Check for short circuit condition
          if (composition.options.enableShortCircuit && 
              finalResult.result?.shortCircuit) {
            state.metrics.shortCircuitActivations++;
            break;
          }

        } catch (error) {
          const pipelineError = {
            pipelineId: pipelineConfig.id,
            error: error as Error
          };

          errors.push(pipelineError);

          // Apply execution strategy
          const strategy = composition.strategy || composition.options.strategy || 'fail_fast';
          
          if (strategy === 'fail_fast') {
            throw error;
          } else if (strategy === 'continue_on_error') {
            // Add error result and continue
            results.push({
              success: false,
              pipelineId: pipelineConfig.id,
              error: error.message,
              executionTime: 0
            });
          }
        }
      }

      // Process results based on result propagation strategy
      let finalResults = results;
      const propagation = composition.options.resultPropagation || 'all';
      
      switch (propagation) {
        case 'last':
          finalResults = results.length > 0 ? [results[results.length - 1]] : [];
          break;
        case 'successful_only':
          finalResults = results.filter(r => r.success !== false && !r.skipped);
          break;
        case 'all':
        default:
          // Keep all results
          break;
      }

      // Aggregate results if requested
      if (composition.options.aggregateResults && finalResults.length > 1) {
        const aggregatedResult = {
          success: true,
          pipelineId: 'aggregated',
          result: finalResults.map(r => r.result),
          executionTime: finalResults.reduce((sum, r) => sum + (r.executionTime || 0), 0),
          pipelineCount: finalResults.length
        };
        finalResults = [aggregatedResult];
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0;

      // Update metrics
      updateMetrics(success, executionTime, composition.pipelines.length);

      return {
        compositionId: composition.id,
        pattern: 'sequential',
        success,
        results: finalResults,
        errors,
        executionTime,
        timestamp: startTime,
        metadata: {
          pipelinesExecuted: results.length,
          pipelinesSkipped: results.filter(r => r.skipped).length,
          shortCircuitActivated: results.some(r => r.result?.shortCircuit) || false
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      updateMetrics(false, executionTime, composition.pipelines.length);
      
      throw handleError(
        `Sequential composition ${composition.id} failed: ${error.message}`,
        ErrorCategory.PIPELINE_EXECUTION,
        ErrorSeverity.ERROR
      );
    } finally {
      // Cleanup active execution
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
  const updateMetrics = (success: boolean, executionTime: number, pipelineCount: number): void => {
    state.metrics.totalExecutions++;
    
    if (success) {
      state.metrics.successfulExecutions++;
    } else {
      state.metrics.failedExecutions++;
    }

    // Update average execution time
    const totalExecutions = state.metrics.totalExecutions;
    state.metrics.avgExecutionTime = 
      (state.metrics.avgExecutionTime * (totalExecutions - 1) + executionTime) / totalExecutions;

    // Update average pipelines per composition
    state.metrics.avgPipelinesPerComposition = 
      (state.metrics.avgPipelinesPerComposition * (totalExecutions - 1) + pipelineCount) / totalExecutions;
  };

  // Create composition from configuration
  const createComposition = (config: {
    id: string;
    name?: string;
    pipelines: SequentialPipeline[];
    options?: SequentialComposition['options'];
  }): SequentialComposition => {
    return {
      id: config.id,
      name: config.name || config.id,
      pattern: 'sequential',
      strategy: 'continue_on_error',
      pipelines: config.pipelines,
      options: {
        strategy: 'continue_on_error',
        timeout: composerConfig.defaultTimeout,
        passPreviousResults: true,
        aggregateResults: false,
        enableShortCircuit: false,
        resultPropagation: 'all',
        ...config.options
      }
    };
  };

  // Cancel active execution
  const cancel = async (executionId: string): Promise<boolean> => {
    const execution = state.activeExecutions.get(executionId);
    if (execution) {
      execution.cancelled = true;
      return true;
    }
    return false;
  };

  // Get composer metrics
  const getMetrics = () => ({
    ...state.metrics,
    activeExecutions: state.activeExecutions.size,
    successRate: state.metrics.totalExecutions > 0
      ? state.metrics.successfulExecutions / state.metrics.totalExecutions
      : 0
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    // Cancel all active executions
    for (const [executionId] of state.activeExecutions) {
      await cancel(executionId);
    }
    
    state.activeExecutions.clear();
    
    // Reset metrics
    state.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgPipelinesPerComposition: 0,
      shortCircuitActivations: 0,
      retryAttempts: 0
    };
  };

  return {
    execute,
    createComposition,
    cancel,
    getMetrics,
    cleanup,
    
    // Pattern identification
    pattern: 'sequential' as const
  };
};