/**
 * Parallel Pipeline Composer
 * Executes pipelines simultaneously with concurrency control
 */

import { 
  CompositionPattern, 
  ExecutionStrategy, 
  CompositionConfig, 
  ExecutionOptions, 
  ExecutionResult,
  PipelineInfo,
  executeWithTimeout
} from './base-composer.js';

export interface ParallelCompositionOptions {
  maxConcurrent?: number;
  executionStrategy?: ExecutionStrategy;
  timeout?: number;
  waitForAll?: boolean;
  failureThreshold?: number; // Percentage of failures before considering composition failed
}

export interface ParallelCompositionConfig extends CompositionConfig {
  pattern: CompositionPattern.PARALLEL;
  pipelines: Array<{
    id: string;
    options?: any;
    priority?: number;
    dependencies?: string[];
  }>;
  options: ParallelCompositionOptions;
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}

/**
 * Creates a parallel pipeline composition
 */
export const createParallelComposition = (
  compositionId: string,
  pipelineGroups: Array<{ id: string; options?: any; priority?: number }>,
  options: ParallelCompositionOptions = {}
): ParallelCompositionConfig => {
  return {
    id: compositionId,
    pattern: CompositionPattern.PARALLEL,
    strategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
    pipelines: pipelineGroups,
    options: {
      maxConcurrent: options.maxConcurrent || 4,
      executionStrategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
      timeout: options.timeout || 30000,
      waitForAll: options.waitForAll !== false,
      failureThreshold: options.failureThreshold || 0.5,
      ...options
    }
  };
};

/**
 * Executes a parallel composition
 */
export const executeParallel = async (
  composition: ParallelCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> => {
  const startTime = performance.now();
  const semaphore = new Semaphore(composition.options.maxConcurrent || 4);
  const results: Array<{ pipelineId: string; success: boolean; data?: any; error?: string; processingTime: number }> = [];
  
  // Sort pipelines by priority (higher priority first)
  const sortedPipelines = [...composition.pipelines].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  // Create execution promises with concurrency control
  const executionPromises = sortedPipelines.map(async (stepConfig) => {
    const pipeline = registeredPipelines.get(stepConfig.id);
    
    if (!pipeline) {
      const error = `Pipeline ${stepConfig.id} not found`;
      if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
        throw new Error(error);
      }
      return {
        pipelineId: stepConfig.id,
        success: false,
        error,
        processingTime: 0
      };
    }

    // Acquire semaphore permit
    await semaphore.acquire();
    
    try {
      const stepStartTime = performance.now();
      const stepTimeout = options.timeout || composition.options.timeout || 5000;
      
      const stepPromise = executePipelineStep(pipeline, input, {
        ...stepConfig.options,
        ...options
      });
      
      const stepResult = await executeWithTimeout(stepPromise, stepTimeout);
      const stepProcessingTime = performance.now() - stepStartTime;
      
      return {
        pipelineId: stepConfig.id,
        success: true,
        data: stepResult,
        processingTime: stepProcessingTime
      };
      
    } catch (error) {
      const stepProcessingTime = performance.now() - startTime;
      
      return {
        pipelineId: stepConfig.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: stepProcessingTime
      };
    } finally {
      semaphore.release();
    }
  });

  try {
    // Execute all pipelines
    if (composition.options.waitForAll) {
      // Wait for all pipelines to complete
      const allResults = await Promise.allSettled(executionPromises);
      results.push(...allResults.map((result, index) => 
        result.status === 'fulfilled' 
          ? result.value 
          : {
            pipelineId: sortedPipelines[index].id,
            success: false,
            error: result.reason?.message || 'Unknown error',
            processingTime: 0
          }
      ));
    } else {
      // Use race condition - return as soon as we have enough successful results
      const allResults = await Promise.allSettled(executionPromises);
      results.push(...allResults.map((result, index) => 
        result.status === 'fulfilled' 
          ? result.value 
          : {
            pipelineId: sortedPipelines[index].id,
            success: false,
            error: result.reason?.message || 'Unknown error',
            processingTime: 0
          }
      ));
    }

  } catch (error) {
    if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
      throw error;
    }
  }

  const executionTime = performance.now() - startTime;
  const successfulPipelines = results.filter(r => r.success).length;
  const failedPipelines = results.filter(r => !r.success).length;
  const successRate = successfulPipelines / results.length;
  
  // Check if composition succeeded based on failure threshold
  const compositionSucceeded = successRate >= (1 - composition.options.failureThreshold!);
  
  return {
    success: compositionSucceeded,
    data: results.reduce((acc, result) => {
      acc[result.pipelineId] = result.success ? result.data : null;
      return acc;
    }, {} as Record<string, any>),
    error: !compositionSucceeded ? `Only ${Math.round(successRate * 100)}% of pipelines succeeded` : undefined,
    metadata: {
      executionTime,
      pipelinesExecuted: composition.pipelines.length,
      successfulPipelines,
      failedPipelines,
      fromCache: false,
      compositionId: composition.id,
      executionPattern: CompositionPattern.PARALLEL,
      successRate,
      failureThreshold: composition.options.failureThreshold,
      maxConcurrent: composition.options.maxConcurrent,
      results
    }
  };
};

/**
 * Validates a parallel composition configuration
 */
export const validateParallelComposition = (composition: ParallelCompositionConfig): string[] => {
  const errors: string[] = [];
  
  if (!composition.id) {
    errors.push('Composition ID is required');
  }
  
  if (!composition.pipelines || composition.pipelines.length === 0) {
    errors.push('At least one pipeline is required');
  }
  
  if (composition.options.maxConcurrent && composition.options.maxConcurrent < 1) {
    errors.push('maxConcurrent must be at least 1');
  }
  
  if (composition.options.failureThreshold && 
      (composition.options.failureThreshold < 0 || composition.options.failureThreshold > 1)) {
    errors.push('failureThreshold must be between 0 and 1');
  }
  
  if (composition.pipelines) {
    composition.pipelines.forEach((pipeline, index) => {
      if (!pipeline.id) {
        errors.push(`Pipeline at index ${index} is missing an ID`);
      }
    });
  }
  
  return errors;
};
