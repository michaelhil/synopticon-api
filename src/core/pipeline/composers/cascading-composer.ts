/**
 * Cascading Pipeline Composer
 * Executes pipelines in stages with advanced result passing and transformation
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

export interface CascadeStage {
  id: string;
  stageName: string;
  pipelines: Array<{
    id: string;
    options?: any;
    inputTransformer?: (input: any, context: CascadeContext) => any;
    outputTransformer?: (output: any, context: CascadeContext) => any;
    condition?: (input: any, context: CascadeContext) => boolean;
    dependencies?: string[]; // Pipeline IDs that must complete first
  }>;
  stageCondition?: (results: any[], context: CascadeContext) => boolean;
  parallelExecution?: boolean;
  continueOnError?: boolean;
  aggregator?: (results: any[], context: CascadeContext) => any;
}

export interface CascadeContext {
  stageResults: Map<string, any>;
  pipelineResults: Map<string, any>;
  globalContext: Record<string, any>;
  executionPath: string[];
  currentStage: number;
  totalStages: number;
  metadata?: Record<string, any>;
}

export interface CascadingCompositionOptions {
  executionStrategy?: ExecutionStrategy;
  timeout?: number;
  enableStageSkipping?: boolean;
  maxStages?: number;
  resultPropagation?: 'all' | 'successful_only' | 'latest' | 'aggregated';
  stageTimeout?: number;
  enableRollback?: boolean;
  rollbackStrategy?: 'full' | 'stage' | 'pipeline';
}

export interface CascadingCompositionConfig extends CompositionConfig {
  pattern: CompositionPattern.CASCADING;
  pipelines: CascadeStage[];
  options: CascadingCompositionOptions;
  rollbackHandlers?: Map<string, (context: CascadeContext) => Promise<void>>;
}

/**
 * Creates a cascading pipeline composition
 */
export const createCascadingComposition = (
  compositionId: string,
  cascadeStages: CascadeStage[],
  options: CascadingCompositionOptions = {}
): CascadingCompositionConfig => {
  return {
    id: compositionId,
    pattern: CompositionPattern.CASCADING,
    strategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
    pipelines: cascadeStages,
    options: {
      executionStrategy: options.executionStrategy || ExecutionStrategy.CONTINUE_ON_ERROR,
      timeout: options.timeout || 60000,
      enableStageSkipping: options.enableStageSkipping !== false,
      maxStages: options.maxStages || cascadeStages.length,
      resultPropagation: options.resultPropagation || 'successful_only',
      stageTimeout: options.stageTimeout || 30000,
      enableRollback: options.enableRollback || false,
      rollbackStrategy: options.rollbackStrategy || 'stage',
      ...options
    },
    rollbackHandlers: new Map()
  };
};

/**
 * Executes a cascading composition
 */
export const executeCascading = async (
  composition: CascadingCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> => {
  const startTime = performance.now();
  const context: CascadeContext = {
    stageResults: new Map(),
    pipelineResults: new Map(),
    globalContext: options.metadata || {},
    executionPath: [],
    currentStage: 0,
    totalStages: composition.pipelines.length
  };

  const allResults: any[] = [];
  let successfulPipelines = 0;
  let failedPipelines = 0;
  let stagesCompleted = 0;
  let lastSuccessfulStage = -1;

  try {
    // Execute stages in order
    for (let stageIndex = 0; stageIndex < composition.pipelines.length; stageIndex++) {
      if (stageIndex >= composition.options.maxStages!) {
        break;
      }

      context.currentStage = stageIndex;
      const stage = composition.pipelines[stageIndex];
      context.executionPath.push(`stage:${stage.id}`);

      // Check stage condition
      if (stage.stageCondition && !stage.stageCondition(allResults, context)) {
        if (composition.options.enableStageSkipping) {
          allResults.push({
            success: true,
            skipped: true,
            reason: 'Stage condition not met',
            stageId: stage.id,
            stageName: stage.stageName,
            stageIndex
          });
          continue;
        } else {
          allResults.push({
            success: false,
            error: 'Stage condition not met and stage skipping disabled',
            stageId: stage.id,
            stageName: stage.stageName,
            stageIndex
          });
          break;
        }
      }

      const stageStartTime = performance.now();
      const stageResults: any[] = [];

      try {
        // Execute pipelines in stage
        if (stage.parallelExecution) {
          // Parallel execution within stage
          const stagePromises = stage.pipelines.map(pipelineConfig => 
            executePipelineInStage(
              pipelineConfig, 
              input, 
              context, 
              stage, 
              registeredPipelines, 
              executePipelineStep, 
              options
            )
          );

          const stagePromiseResults = await Promise.allSettled(
            stagePromises.map(promise => 
              executeWithTimeout(promise, composition.options.stageTimeout!)
            )
          );

          stageResults.push(...stagePromiseResults.map((result, index) => 
            result.status === 'fulfilled' 
              ? result.value 
              : {
                success: false,
                error: result.reason?.message || 'Unknown error',
                pipelineId: stage.pipelines[index].id,
                stageId: stage.id
              }
          ));

        } else {
          // Sequential execution within stage
          for (const pipelineConfig of stage.pipelines) {
            const pipelineResult = await executePipelineInStage(
              pipelineConfig,
              input,
              context,
              stage,
              registeredPipelines,
              executePipelineStep,
              options
            );
            stageResults.push(pipelineResult);

            // Update context with results as we go for dependencies
            if (pipelineResult.success) {
              context.pipelineResults.set(pipelineConfig.id, pipelineResult.data);
            }

            if (!pipelineResult.success && !stage.continueOnError) {
              break;
            }
          }
        }

        const stageExecutionTime = performance.now() - stageStartTime;

        // Process stage results
        const successfulStageResults = stageResults.filter(r => r.success);
        const failedStageResults = stageResults.filter(r => !r.success);

        successfulPipelines += successfulStageResults.length;
        failedPipelines += failedStageResults.length;

        // Aggregate stage results if aggregator provided
        let stageOutput = stageResults;
        if (stage.aggregator && successfulStageResults.length > 0) {
          try {
            stageOutput = await stage.aggregator(successfulStageResults, context);
          } catch (error) {
            stageOutput = {
              success: false,
              error: `Stage aggregation failed: ${error instanceof Error ? error.message : String(error)}`,
              stageId: stage.id,
              originalResults: stageResults
            };
          }
        }

        // Store stage results
        context.stageResults.set(stage.id, stageOutput);
        allResults.push({
          success: successfulStageResults.length > 0,
          data: stageOutput,
          stageId: stage.id,
          stageName: stage.stageName,
          stageIndex,
          executionTime: stageExecutionTime,
          pipelineResults: stageResults,
          successfulPipelines: successfulStageResults.length,
          failedPipelines: failedStageResults.length,
          isCascadeStage: true
        });

        if (successfulStageResults.length > 0) {
          lastSuccessfulStage = stageIndex;
          stagesCompleted++;
        }

        // Update input for next stage based on propagation strategy
        input = updateInputForNextStage(input, stageResults, composition.options.resultPropagation!);

        // Check if we should continue after stage failure
        if (failedStageResults.length > 0 && 
            composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
          throw new Error(`Stage ${stage.stageName} failed with ${failedStageResults.length} failed pipelines`);
        }

      } catch (error) {
        allResults.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stageId: stage.id,
          stageName: stage.stageName,
          stageIndex,
          isCascadeStage: true
        });

        // Handle rollback if enabled
        if (composition.options.enableRollback) {
          await performRollback(composition, context, lastSuccessfulStage);
        }

        if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
          throw error;
        }
      }
    }

  } catch (error) {
    if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
      throw error;
    }
  }

  const executionTime = performance.now() - startTime;
  const hasSuccessfulExecution = stagesCompleted > 0;

  // Build final result based on propagation strategy
  const finalData = buildFinalResult(allResults, composition.options.resultPropagation!, context);

  return {
    success: hasSuccessfulExecution,
    data: finalData,
    error: !hasSuccessfulExecution ? 'No stages completed successfully' : undefined,
    metadata: {
      executionTime,
      pipelinesExecuted: successfulPipelines + failedPipelines,
      successfulPipelines,
      failedPipelines,
      fromCache: false,
      compositionId: composition.id,
      executionPattern: CompositionPattern.CASCADING,
      stagesCompleted,
      totalStages: composition.pipelines.length,
      lastSuccessfulStage,
      executionPath: context.executionPath,
      stageResults: Object.fromEntries(context.stageResults),
      results: allResults
    }
  };
};

/**
 * Executes a single pipeline within a cascade stage
 */
const executePipelineInStage = async (
  pipelineConfig: CascadeStage['pipelines'][0],
  input: any,
  context: CascadeContext,
  stage: CascadeStage,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options: ExecutionOptions
): Promise<any> => {
  const pipeline = registeredPipelines.get(pipelineConfig.id);
  
  if (!pipeline) {
    return {
      success: false,
      error: `Pipeline ${pipelineConfig.id} not found`,
      pipelineId: pipelineConfig.id,
      stageId: stage.id
    };
  }

  // Check dependencies
  if (pipelineConfig.dependencies) {
    for (const depId of pipelineConfig.dependencies) {
      if (!context.pipelineResults.has(depId)) {
        return {
          success: false,
          error: `Dependency ${depId} not satisfied`,
          pipelineId: pipelineConfig.id,
          stageId: stage.id,
          missingDependency: depId
        };
      }
    }
  }

  // Check pipeline condition
  if (pipelineConfig.condition && !pipelineConfig.condition(input, context)) {
    return {
      success: true,
      skipped: true,
      reason: 'Pipeline condition not met',
      pipelineId: pipelineConfig.id,
      stageId: stage.id
    };
  }

  const pipelineStartTime = performance.now();
  
  try {
    // Transform input if transformer provided
    let transformedInput = input;
    if (pipelineConfig.inputTransformer) {
      transformedInput = pipelineConfig.inputTransformer(input, context);
    }

    context.executionPath.push(`pipeline:${pipelineConfig.id}`);

    // Execute pipeline
    const result = await executePipelineStep(pipeline, transformedInput, {
      ...pipelineConfig.options,
      ...options
    });

    // Transform output if transformer provided
    let transformedOutput = result;
    if (pipelineConfig.outputTransformer) {
      transformedOutput = pipelineConfig.outputTransformer(result, context);
    }

    const pipelineExecutionTime = performance.now() - pipelineStartTime;

    return {
      success: true,
      data: transformedOutput,
      pipelineId: pipelineConfig.id,
      stageId: stage.id,
      processingTime: pipelineExecutionTime,
      isCascadePipeline: true
    };

  } catch (error) {
    const pipelineExecutionTime = performance.now() - pipelineStartTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      pipelineId: pipelineConfig.id,
      stageId: stage.id,
      processingTime: pipelineExecutionTime,
      isCascadePipeline: true
    };
  }
};

/**
 * Updates input for the next stage based on result propagation strategy
 */
const updateInputForNextStage = (
  originalInput: any,
  stageResults: any[],
  propagation: CascadingCompositionOptions['resultPropagation']
): any => {
  switch (propagation) {
  case 'all':
    return {
      original: originalInput,
      stageResults
    };

  case 'successful_only':
    return {
      original: originalInput,
      results: stageResults.filter(r => r.success).map(r => r.data)
    };

  case 'latest':
    const latestResult = stageResults[stageResults.length - 1];
    return latestResult?.success ? latestResult.data : originalInput;

  case 'aggregated':
    const successfulResults = stageResults.filter(r => r.success);
    if (successfulResults.length === 0) return originalInput;
    if (successfulResults.length === 1) return successfulResults[0].data;
    return successfulResults.map(r => r.data);

  default:
    return originalInput;
  }
};

/**
 * Builds the final result based on propagation strategy
 */
const buildFinalResult = (
  allResults: any[],
  propagation: CascadingCompositionOptions['resultPropagation'],
  context: CascadeContext
): any => {
  const successfulStages = allResults.filter(r => r.success && r.isCascadeStage);
  
  switch (propagation) {
  case 'all':
    return {
      stages: allResults,
      context: {
        stageResults: Object.fromEntries(context.stageResults),
        pipelineResults: Object.fromEntries(context.pipelineResults)
      }
    };

  case 'successful_only':
    return {
      stages: successfulStages.map(s => s.data),
      executionPath: context.executionPath
    };

  case 'latest':
    const latestSuccessful = successfulStages[successfulStages.length - 1];
    return latestSuccessful ? latestSuccessful.data : null;

  case 'aggregated':
    if (successfulStages.length === 0) return null;
    if (successfulStages.length === 1) return successfulStages[0].data;
    return successfulStages.map(s => s.data);

  default:
    return allResults;
  }
};

/**
 * Performs rollback operations based on rollback strategy
 */
const performRollback = async (
  composition: CascadingCompositionConfig,
  context: CascadeContext,
  lastSuccessfulStage: number
): Promise<void> => {
  if (!composition.rollbackHandlers || composition.rollbackHandlers.size === 0) {
    return;
  }

  try {
    switch (composition.options.rollbackStrategy) {
    case 'full':
      // Rollback all completed stages
      for (let i = lastSuccessfulStage; i >= 0; i--) {
        const stage = composition.pipelines[i];
        const rollbackHandler = composition.rollbackHandlers.get(stage.id);
        if (rollbackHandler) {
          await rollbackHandler(context);
        }
      }
      break;

    case 'stage':
      // Rollback only the last successful stage
      if (lastSuccessfulStage >= 0) {
        const stage = composition.pipelines[lastSuccessfulStage];
        const rollbackHandler = composition.rollbackHandlers.get(stage.id);
        if (rollbackHandler) {
          await rollbackHandler(context);
        }
      }
      break;

    case 'pipeline':
      // Rollback individual failed pipelines (implementation specific)
      break;
    }
  } catch (rollbackError) {
    // Log rollback errors but don't fail the entire operation
    console.warn('Rollback failed:', rollbackError);
  }
};

/**
 * Validates a cascading composition configuration
 */
export const validateCascadingComposition = (composition: CascadingCompositionConfig): string[] => {
  const errors: string[] = [];
  
  if (!composition.id) {
    errors.push('Composition ID is required');
  }
  
  if (!composition.pipelines || composition.pipelines.length === 0) {
    errors.push('At least one cascade stage is required');
  }
  
  if (composition.options.maxStages && composition.options.maxStages < 1) {
    errors.push('maxStages must be at least 1');
  }
  
  if (composition.pipelines) {
    composition.pipelines.forEach((stage, stageIndex) => {
      if (!stage.id) {
        errors.push(`Cascade stage at index ${stageIndex} is missing an ID`);
      }
      
      if (!stage.stageName) {
        errors.push(`Cascade stage at index ${stageIndex} is missing a stage name`);
      }
      
      if (!stage.pipelines || stage.pipelines.length === 0) {
        errors.push(`Cascade stage at index ${stageIndex} must have at least one pipeline`);
      }
      
      if (stage.pipelines) {
        stage.pipelines.forEach((pipeline, pipelineIndex) => {
          if (!pipeline.id) {
            errors.push(`Pipeline at stage ${stageIndex}, index ${pipelineIndex} is missing an ID`);
          }
        });
      }
    });
  }
  
  return errors;
};
