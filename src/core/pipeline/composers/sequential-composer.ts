/**
 * Sequential Pipeline Composer
 * Executes pipelines one after another, optionally passing results between steps
 */

import { 
  CompositionPattern, 
  ExecutionStrategy, 
  CompositionConfig, 
  ExecutionOptions, 
  ExecutionResult,
  PipelineInfo,
  executeWithTimeout
} from './base-composer.ts';

export interface SequentialCompositionOptions {
  passResults?: boolean;
  executionStrategy?: ExecutionStrategy;
  timeout?: number;
  retryCount?: number;
  continueOnError?: boolean;
}

export interface SequentialCompositionConfig extends CompositionConfig {
  pattern: CompositionPattern.SEQUENTIAL;
  pipelines: Array<{
    id: string;
    options?: any;
    condition?: (input: any, previousResults: any[]) => boolean;
  }>;
  options: SequentialCompositionOptions;
}

/**
 * Creates a sequential pipeline composition
 */
export const createSequentialComposition = (
  compositionId: string,
  pipelineSequence: Array<{ id: string; options?: any }>,
  options: SequentialCompositionOptions = {}
): SequentialCompositionConfig => {
  return {
    id: compositionId,
    pattern: CompositionPattern.SEQUENTIAL,
    strategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
    pipelines: pipelineSequence,
    options: {
      passResults: options.passResults !== false,
      executionStrategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
      timeout: options.timeout || 30000,
      retryCount: options.retryCount || 0,
      continueOnError: options.continueOnError !== false,
      ...options
    }
  };
};

/**
 * Executes a sequential composition
 */
export const executeSequential = async (
  composition: SequentialCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> => {
  const startTime = performance.now();
  const results: any[] = [];
  let currentInput = input;
  let totalProcessingTime = 0;
  let successfulPipelines = 0;
  let failedPipelines = 0;

  for (let i = 0; i < composition.pipelines.length; i++) {
    const stepConfig = composition.pipelines[i];
    const pipeline = registeredPipelines.get(stepConfig.id);
    
    if (!pipeline) {
      const error = new Error(`Pipeline ${stepConfig.id} not found`);
      
      if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
        throw error;
      }
      
      results.push({
        success: false,
        error: error.message,
        pipelineId: stepConfig.id,
        stepIndex: i
      });
      failedPipelines++;
      continue;
    }

    // Check conditional execution
    if (stepConfig.condition && !stepConfig.condition(currentInput, results)) {
      results.push({
        success: true,
        skipped: true,
        reason: 'Condition not met',
        pipelineId: stepConfig.id,
        stepIndex: i
      });
      continue;
    }

    try {
      const stepStartTime = performance.now();
      const stepTimeout = options.timeout || composition.options.timeout || 5000;
      
      // Execute pipeline step with timeout
      const stepPromise = executePipelineStep(pipeline, currentInput, {
        ...stepConfig.options,
        ...options
      });
      
      const stepResult = await executeWithTimeout(stepPromise, stepTimeout);
      const stepProcessingTime = performance.now() - stepStartTime;
      
      totalProcessingTime += stepProcessingTime;
      successfulPipelines++;
      
      results.push({
        success: true,
        data: stepResult,
        pipelineId: stepConfig.id,
        stepIndex: i,
        processingTime: stepProcessingTime
      });

      // Pass results to next pipeline if enabled
      if (composition.options.passResults) {
        currentInput = stepResult;
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        pipelineId: stepConfig.id,
        stepIndex: i,
        context: { stepIndex: i, pipelineId: stepConfig.id }
      };

      results.push(errorResult);
      failedPipelines++;

      // Handle retry logic
      if (composition.options.retryCount && composition.options.retryCount > 0) {
        // TODO: Implement retry logic
      }

      if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
        throw error;
      }
    }
  }

  const executionTime = performance.now() - startTime;
  const allSuccessful = results.every(r => r.success && !r.skipped);
  const hasPartialSuccess = results.some(r => r.success);

  return {
    success: allSuccessful,
    data: composition.options.passResults ? currentInput : results,
    error: !hasPartialSuccess ? 'All pipelines failed' : undefined,
    metadata: {
      executionTime,
      pipelinesExecuted: composition.pipelines.length,
      successfulPipelines,
      failedPipelines,
      fromCache: false,
      compositionId: composition.id,
      executionPattern: CompositionPattern.SEQUENTIAL,
      stepsCompleted: results.filter(r => !r.skipped).length,
      totalSteps: composition.pipelines.length,
      results
    }
  };
};

/**
 * Validates a sequential composition configuration
 */
export const validateSequentialComposition = (composition: SequentialCompositionConfig): string[] => {
  const errors: string[] = [];
  
  if (!composition.id) {
    errors.push('Composition ID is required');
  }
  
  if (!composition.pipelines || composition.pipelines.length === 0) {
    errors.push('At least one pipeline is required');
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