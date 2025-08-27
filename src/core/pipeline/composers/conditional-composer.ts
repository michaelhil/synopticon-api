/**
 * Conditional Pipeline Composer
 * Executes pipelines based on conditions and branching logic
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

export interface ConditionalStep {
  id: string;
  condition: (input: any, context: any) => boolean | Promise<boolean>;
  options?: any;
  fallback?: ConditionalStep[];
}

export interface ConditionalCompositionOptions {
  executionStrategy?: ExecutionStrategy;
  timeout?: number;
  enableFallback?: boolean;
  defaultPipelines?: string[]; // Pipelines to run if no conditions match
  maxDepth?: number; // Maximum nesting depth for conditional steps
}

export interface ConditionalCompositionConfig extends CompositionConfig {
  pattern: CompositionPattern.CONDITIONAL;
  pipelines: ConditionalStep[];
  options: ConditionalCompositionOptions;
}

/**
 * Creates a conditional pipeline composition
 */
export const createConditionalComposition = (
  compositionId: string,
  conditionalSteps: ConditionalStep[],
  options: ConditionalCompositionOptions = {}
): ConditionalCompositionConfig => {
  return {
    id: compositionId,
    pattern: CompositionPattern.CONDITIONAL,
    strategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
    pipelines: conditionalSteps,
    options: {
      executionStrategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
      timeout: options.timeout || 30000,
      enableFallback: options.enableFallback !== false,
      defaultPipelines: options.defaultPipelines || [],
      maxDepth: options.maxDepth || 10,
      ...options
    }
  };
};

/**
 * Executes a conditional composition
 */
export const executeConditional = async (
  composition: ConditionalCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> => {
  const startTime = performance.now();
  const results: any[] = [];
  let executedSteps = 0;
  let successfulPipelines = 0;
  let failedPipelines = 0;

  // Execute conditional steps
  for (const step of composition.pipelines) {
    const stepResults = await executeConditionalStep(
      step,
      input,
      { composition, options, depth: 0 },
      registeredPipelines,
      executePipelineStep
    );
    
    results.push(...stepResults.results);
    executedSteps += stepResults.executedSteps;
    successfulPipelines += stepResults.successfulSteps;
    failedPipelines += stepResults.failedSteps;
  }

  // Execute default pipelines if no conditions were met
  if (executedSteps === 0 && composition.options.defaultPipelines!.length > 0) {
    for (const pipelineId of composition.options.defaultPipelines!) {
      const pipeline = registeredPipelines.get(pipelineId);
      
      if (!pipeline) {
        results.push({
          success: false,
          error: `Default pipeline ${pipelineId} not found`,
          pipelineId,
          isDefault: true
        });
        failedPipelines++;
        continue;
      }

      try {
        const stepStartTime = performance.now();
        const stepResult = await executePipelineStep(pipeline, input, options);
        const stepProcessingTime = performance.now() - stepStartTime;
        
        results.push({
          success: true,
          data: stepResult,
          pipelineId,
          isDefault: true,
          processingTime: stepProcessingTime
        });
        successfulPipelines++;
        executedSteps++;
        
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          pipelineId,
          isDefault: true
        });
        failedPipelines++;
      }
    }
  }

  const executionTime = performance.now() - startTime;
  const hasSuccessfulExecution = successfulPipelines > 0;

  return {
    success: hasSuccessfulExecution,
    data: results,
    error: !hasSuccessfulExecution ? 'No conditions were met and no successful executions' : undefined,
    metadata: {
      executionTime,
      pipelinesExecuted: executedSteps,
      successfulPipelines,
      failedPipelines,
      fromCache: false,
      compositionId: composition.id,
      executionPattern: CompositionPattern.CONDITIONAL,
      conditionsEvaluated: composition.pipelines.length,
      defaultPipelinesUsed: executedSteps === 0 ? composition.options.defaultPipelines!.length : 0,
      results
    }
  };
};

/**
 * Executes a single conditional step recursively
 */
const executeConditionalStep = async (
  step: ConditionalStep,
  input: any,
  context: { composition: ConditionalCompositionConfig; options: ExecutionOptions; depth: number },
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>
): Promise<{ results: any[]; executedSteps: number; successfulSteps: number; failedSteps: number }> => {
  const results: any[] = [];
  let executedSteps = 0;
  let successfulSteps = 0;
  let failedSteps = 0;

  // Check maximum depth to prevent infinite recursion
  if (context.depth >= context.composition.options.maxDepth!) {
    results.push({
      success: false,
      error: 'Maximum conditional depth exceeded',
      pipelineId: step.id,
      depth: context.depth
    });
    return { results, executedSteps, successfulSteps, failedSteps: 1 };
  }

  try {
    // Evaluate condition
    const conditionMet = await step.condition(input, { 
      ...context, 
      results: results.slice() 
    });

    if (conditionMet) {
      // Execute the pipeline
      const pipeline = registeredPipelines.get(step.id);
      
      if (!pipeline) {
        results.push({
          success: false,
          error: `Pipeline ${step.id} not found`,
          pipelineId: step.id,
          conditionMet: true
        });
        failedSteps++;
      } else {
        try {
          const stepStartTime = performance.now();
          const stepResult = await executePipelineStep(pipeline, input, {
            ...step.options,
            ...context.options
          });
          const stepProcessingTime = performance.now() - stepStartTime;
          
          results.push({
            success: true,
            data: stepResult,
            pipelineId: step.id,
            conditionMet: true,
            processingTime: stepProcessingTime
          });
          successfulSteps++;
          executedSteps++;
          
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            pipelineId: step.id,
            conditionMet: true
          });
          failedSteps++;
        }
      }
    } else {
      // Condition not met, try fallback steps if available
      if (step.fallback && step.fallback.length > 0 && context.composition.options.enableFallback) {
        for (const fallbackStep of step.fallback) {
          const fallbackResults = await executeConditionalStep(
            fallbackStep,
            input,
            { ...context, depth: context.depth + 1 },
            registeredPipelines,
            executePipelineStep
          );
          
          results.push(...fallbackResults.results);
          executedSteps += fallbackResults.executedSteps;
          successfulSteps += fallbackResults.successfulSteps;
          failedSteps += fallbackResults.failedSteps;
        }
      } else {
        results.push({
          success: false,
          skipped: true,
          reason: 'Condition not met',
          pipelineId: step.id,
          conditionMet: false
        });
      }
    }

  } catch (error) {
    results.push({
      success: false,
      error: `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      pipelineId: step.id,
      conditionEvaluationError: true
    });
    failedSteps++;
  }

  return { results, executedSteps, successfulSteps, failedSteps };
};

/**
 * Validates a conditional composition configuration
 */
export const validateConditionalComposition = (composition: ConditionalCompositionConfig): string[] => {
  const errors: string[] = [];
  
  if (!composition.id) {
    errors.push('Composition ID is required');
  }
  
  if (!composition.pipelines || composition.pipelines.length === 0) {
    errors.push('At least one conditional step is required');
  }
  
  if (composition.options.maxDepth && composition.options.maxDepth < 1) {
    errors.push('maxDepth must be at least 1');
  }
  
  if (composition.pipelines) {
    composition.pipelines.forEach((step, index) => {
      if (!step.id) {
        errors.push(`Conditional step at index ${index} is missing an ID`);
      }
      if (!step.condition || typeof step.condition !== 'function') {
        errors.push(`Conditional step at index ${index} is missing a condition function`);
      }
    });
  }
  
  return errors;
};