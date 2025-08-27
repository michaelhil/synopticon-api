/**
 * Cascading Pipeline Composer
 * Executes pipelines in cascading layers with result propagation and adaptive scaling
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';
import type { 
  CompositionPatternType, 
  ExecutionStrategyType, 
  BaseComposition, 
  CompositionResult,
  CompositionEngineConfig 
} from '../composition-engine.js';

export interface CascadingPipeline {
  id: string;
  name?: string;
  pipeline: any;
  options?: any;
  layer: number;
  dependencies?: string[];
  triggers?: Array<{
    sourceLayer: number;
    condition: (results: any[]) => boolean;
    priority?: number;
  }>;
  scaling?: {
    minInstances?: number;
    maxInstances?: number;
    scaleCondition?: (load: number, results: any[]) => number;
  };
  timeout?: number;
  retryCount?: number;
  inputTransformer?: (input: any, previousLayers: Map<number, any[]>) => any;
  outputTransformer?: (output: any, allResults: any[]) => any;
}

export interface CascadingLayer {
  id: number;
  name?: string;
  pipelines: CascadingPipeline[];
  executionMode: 'sequential' | 'parallel' | 'adaptive';
  scalingPolicy?: 'fixed' | 'demand_based' | 'predictive';
  maxConcurrency?: number;
  bufferSize?: number;
}

export interface CascadingContext {
  layerResults: Map<number, any[]>;
  layerExecutionTimes: Map<number, number>;
  activePipelines: Map<string, { layer: number; startTime: number; }>;
  scalingDecisions: Map<number, number>; // layer -> instance count
  propagationChain: Array<{ layer: number; triggeredBy: number; }>;
  totalLayers: number;
  currentLayer: number;
}

export interface CascadingComposition extends BaseComposition {
  pattern: 'cascading';
  layers: CascadingLayer[];
  options: {
    strategy?: ExecutionStrategyType;
    timeout?: number;
    propagationMode?: 'immediate' | 'batched' | 'threshold_based';
    bufferManagement?: 'fifo' | 'lifo' | 'priority';
    adaptiveScaling?: boolean;
    layerSynchronization?: 'strict' | 'loose' | 'async';
    resultAggregation?: 'per_layer' | 'global' | 'selective';
  };
}

export interface CascadingComposerConfig extends CompositionEngineConfig {
  defaultLayerTimeout?: number;
  maxLayersDepth?: number;
  enablePredictiveScaling?: boolean;
  bufferOverflowStrategy?: 'drop_oldest' | 'drop_newest' | 'expand_buffer';
}

/**
 * Creates cascading pipeline composer
 */
export const createCascadingComposer = (config: CascadingComposerConfig = {}) => {
  const composerConfig = {
    defaultLayerTimeout: config.defaultLayerTimeout || 30000,
    maxLayersDepth: config.maxLayersDepth || 10,
    enablePredictiveScaling: config.enablePredictiveScaling !== false,
    bufferOverflowStrategy: config.bufferOverflowStrategy || 'drop_oldest',
    ...config
  };

  const state = {
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgLayersExecuted: 0,
      totalLayerExecutions: 0,
      scalingActivations: 0,
      bufferOverflows: 0,
      propagationTriggers: 0,
      layerMetrics: new Map<number, {
        executions: number;
        avgExecutionTime: number;
        successRate: number;
      }>()
    },
    activeExecutions: new Map<string, any>(),
    layerBuffers: new Map<number, any[]>(),
    scalingHistory: new Map<number, number[]>() // layer -> scaling decisions over time
  };

  // Adaptive scaling logic
  const calculateOptimalScale = (
    layer: CascadingLayer,
    currentLoad: number,
    historicalData: number[],
    context: CascadingContext
  ): number => {
    const pipeline = layer.pipelines[0]; // Use first pipeline for scaling reference
    const scaling = pipeline.scaling;
    
    if (!scaling || !composerConfig.enablePredictiveScaling) {
      return Math.min(layer.maxConcurrency || 3, Math.max(1, Math.ceil(currentLoad)));
    }

    const minInstances = scaling.minInstances || 1;
    const maxInstances = scaling.maxInstances || (layer.maxConcurrency || 5);

    // Use custom scaling condition if provided
    if (scaling.scaleCondition) {
      const layerResults = context.layerResults.get(layer.id) || [];
      return Math.min(maxInstances, Math.max(minInstances, 
        scaling.scaleCondition(currentLoad, layerResults)
      ));
    }

    // Predictive scaling based on historical data
    if (historicalData.length >= 3) {
      const trend = historicalData.slice(-3);
      const avgTrend = trend.reduce((a, b) => a + b, 0) / trend.length;
      const predictedLoad = Math.max(currentLoad, avgTrend * 1.2); // 20% buffer
      return Math.min(maxInstances, Math.max(minInstances, Math.ceil(predictedLoad)));
    }

    // Demand-based scaling
    return Math.min(maxInstances, Math.max(minInstances, Math.ceil(currentLoad * 1.1)));
  };

  // Check if layer should be triggered based on previous results
  const shouldTriggerLayer = (
    layer: CascadingLayer,
    context: CascadingContext
  ): { triggered: boolean; triggerInfo?: any } => {
    for (const pipeline of layer.pipelines) {
      if (!pipeline.triggers || pipeline.triggers.length === 0) {
        continue;
      }

      for (const trigger of pipeline.triggers) {
        const sourceResults = context.layerResults.get(trigger.sourceLayer) || [];
        
        if (sourceResults.length > 0 && trigger.condition(sourceResults)) {
          return {
            triggered: true,
            triggerInfo: {
              sourceLayer: trigger.sourceLayer,
              pipelineId: pipeline.id,
              priority: trigger.priority || 5
            }
          };
        }
      }
    }

    return { triggered: false };
  };

  // Execute pipeline within layer
  const executePipeline = async (
    pipelineConfig: CascadingPipeline,
    input: any,
    context: CascadingContext,
    executionId: string
  ): Promise<any> => {
    const { id, pipeline, options = {}, timeout, retryCount = 0 } = pipelineConfig;
    const pipelineTimeout = timeout || composerConfig.defaultLayerTimeout;

    // Mark pipeline as active
    context.activePipelines.set(id, {
      layer: pipelineConfig.layer,
      startTime: Date.now()
    });

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
          transformedInput = pipelineConfig.inputTransformer(input, context.layerResults);
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
          const allResults = Array.from(context.layerResults.values()).flat();
          transformedResult = pipelineConfig.outputTransformer(result, allResults);
        }

        // Remove from active pipelines
        context.activePipelines.delete(id);

        return {
          success: true,
          pipelineId: id,
          layer: pipelineConfig.layer,
          result: transformedResult,
          attempt,
          executionTime: Date.now() - context.activePipelines.get(id)?.startTime || 0
        };

      } catch (error) {
        lastError = error;
        
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    context.activePipelines.delete(id);
    throw lastError || new Error(`Pipeline ${id} failed`);
  };

  // Execute single layer
  const executeLayer = async (
    layer: CascadingLayer,
    input: any,
    context: CascadingContext,
    executionId: string
  ): Promise<any[]> => {
    const layerStartTime = Date.now();
    context.currentLayer = layer.id;

    // Initialize layer results if not exists
    if (!context.layerResults.has(layer.id)) {
      context.layerResults.set(layer.id, []);
    }

    // Get layer buffer
    let layerBuffer = state.layerBuffers.get(layer.id) || [];
    const bufferSize = layer.bufferSize || 100;

    // Calculate scaling for this layer
    const currentLoad = layerBuffer.length;
    const historicalScaling = state.scalingHistory.get(layer.id) || [];
    const optimalScale = calculateOptimalScale(layer, currentLoad, historicalScaling, context);
    
    // Record scaling decision
    context.scalingDecisions.set(layer.id, optimalScale);
    historicalScaling.push(optimalScale);
    if (historicalScaling.length > 10) {
      historicalScaling.shift();
    }
    state.scalingHistory.set(layer.id, historicalScaling);

    if (optimalScale !== (layer.pipelines.length || 1)) {
      state.metrics.scalingActivations++;
    }

    // Add input to buffer with overflow handling
    layerBuffer.push(input);
    if (layerBuffer.length > bufferSize) {
      state.metrics.bufferOverflows++;
      
      switch (composerConfig.bufferOverflowStrategy) {
        case 'drop_oldest':
          layerBuffer.shift();
          break;
        case 'drop_newest':
          layerBuffer.pop();
          break;
        case 'expand_buffer':
          // Keep growing (memory pressure risk)
          break;
      }
    }

    state.layerBuffers.set(layer.id, layerBuffer);

    const results: any[] = [];
    const layerResults = context.layerResults.get(layer.id) || [];

    switch (layer.executionMode) {
      case 'parallel': {
        // Execute all pipelines in parallel
        const pipelinePromises = layer.pipelines.slice(0, optimalScale).map(pipeline =>
          executePipeline(pipeline, input, context, executionId)
            .catch(error => ({ error, pipelineId: pipeline.id, layer: layer.id }))
        );

        const pipelineResults = await Promise.allSettled(pipelinePromises);
        
        for (const result of pipelineResults) {
          if (result.status === 'fulfilled' && !result.value.error) {
            results.push(result.value);
            layerResults.push(result.value);
          }
        }
        break;
      }

      case 'sequential': {
        // Execute pipelines one after another
        let pipelineInput = input;
        
        for (const pipeline of layer.pipelines.slice(0, optimalScale)) {
          try {
            const result = await executePipeline(pipeline, pipelineInput, context, executionId);
            results.push(result);
            layerResults.push(result);
            
            // Pass result to next pipeline
            pipelineInput = result.result;
          } catch (error) {
            const strategy = (state.activeExecutions.get(executionId) as any)?.strategy || 'continue_on_error';
            if (strategy === 'fail_fast') {
              throw error;
            }
          }
        }
        break;
      }

      case 'adaptive': {
        // Adaptive execution based on current conditions
        const isHighLoad = currentLoad > bufferSize * 0.7;
        const executionMode = isHighLoad ? 'parallel' : 'sequential';
        
        if (executionMode === 'parallel') {
          // Use parallel logic
          const pipelinePromises = layer.pipelines.slice(0, optimalScale).map(pipeline =>
            executePipeline(pipeline, input, context, executionId)
              .catch(error => ({ error, pipelineId: pipeline.id }))
          );

          const pipelineResults = await Promise.allSettled(pipelinePromises);
          
          for (const result of pipelineResults) {
            if (result.status === 'fulfilled' && !result.value.error) {
              results.push(result.value);
              layerResults.push(result.value);
            }
          }
        } else {
          // Use sequential logic
          let pipelineInput = input;
          
          for (const pipeline of layer.pipelines.slice(0, optimalScale)) {
            try {
              const result = await executePipeline(pipeline, pipelineInput, context, executionId);
              results.push(result);
              layerResults.push(result);
              pipelineInput = result.result;
            } catch (error) {
              // Continue with adaptive error handling
            }
          }
        }
        break;
      }
    }

    // Update layer results
    context.layerResults.set(layer.id, layerResults);
    
    // Update layer execution time
    const layerExecutionTime = Date.now() - layerStartTime;
    context.layerExecutionTimes.set(layer.id, layerExecutionTime);

    // Update layer metrics
    updateLayerMetrics(layer.id, layerExecutionTime, results.length > 0);

    return results;
  };

  // Execute cascading composition
  const execute = async (composition: CascadingComposition): Promise<CompositionResult> => {
    const startTime = Date.now();
    const executionId = `casc_${composition.id}_${startTime}`;

    try {
      if (!composition.layers || composition.layers.length === 0) {
        throw new Error('Cascading composition must have at least one layer');
      }

      if (composition.layers.length > composerConfig.maxLayersDepth) {
        throw new Error(`Layer depth ${composition.layers.length} exceeds maximum ${composerConfig.maxLayersDepth}`);
      }

      // Create execution context
      const context: CascadingContext = {
        layerResults: new Map(),
        layerExecutionTimes: new Map(),
        activePipelines: new Map(),
        scalingDecisions: new Map(),
        propagationChain: [],
        totalLayers: composition.layers.length,
        currentLayer: 0
      };

      // Register active execution
      state.activeExecutions.set(executionId, {
        startTime,
        cancelled: false,
        context,
        strategy: composition.strategy || composition.options.strategy
      });

      const allResults: any[] = [];
      const errors: Array<{ pipelineId: string; error: Error; }> = [];
      let input = (composition.options as any).initialInput || {};

      // Sort layers by id to ensure proper execution order
      const sortedLayers = [...composition.layers].sort((a, b) => a.id - b.id);

      // Execute layers in cascade
      for (const layer of sortedLayers) {
        try {
          // Check if layer should be triggered
          const triggerResult = shouldTriggerLayer(layer, context);
          
          if (!triggerResult.triggered && layer.id > 0) {
            // Skip layer if not triggered (except for layer 0 which always runs)
            continue;
          }

          if (triggerResult.triggered && triggerResult.triggerInfo) {
            state.metrics.propagationTriggers++;
            context.propagationChain.push({
              layer: layer.id,
              triggeredBy: triggerResult.triggerInfo.sourceLayer
            });
          }

          // Execute layer
          const layerResults = await executeLayer(layer, input, context, executionId);
          allResults.push(...layerResults);

          // Update input for next layer based on propagation mode
          const propagationMode = composition.options.propagationMode || 'immediate';
          
          switch (propagationMode) {
            case 'immediate':
              if (layerResults.length > 0) {
                input = layerResults[layerResults.length - 1].result;
              }
              break;
            case 'batched':
              input = { previousResults: layerResults, batchInput: input };
              break;
            case 'threshold_based':
              if (layerResults.length >= (layer.pipelines.length / 2)) {
                input = layerResults.map(r => r.result);
              }
              break;
          }

          // Check for early termination conditions
          const execution = state.activeExecutions.get(executionId);
          if (execution?.cancelled) {
            break;
          }

        } catch (error) {
          errors.push({ pipelineId: `layer_${layer.id}`, error });
          
          const strategy = composition.strategy || composition.options.strategy || 'continue_on_error';
          if (strategy === 'fail_fast') {
            throw error;
          }
        }
      }

      // Aggregate results based on strategy
      let finalResults = allResults;
      const aggregationMode = composition.options.resultAggregation || 'per_layer';
      
      switch (aggregationMode) {
        case 'global':
          finalResults = [{
            success: true,
            pipelineId: 'cascading_aggregate',
            result: allResults.map(r => r.result),
            layers: allResults.map(r => r.layer),
            totalLayers: context.totalLayers,
            executionTime: Date.now() - startTime
          }];
          break;
        case 'selective':
          // Keep only results from the last layer of each cascade branch
          const lastLayerResults = new Map<number, any>();
          allResults.forEach(result => {
            lastLayerResults.set(result.layer, result);
          });
          finalResults = Array.from(lastLayerResults.values());
          break;
        case 'per_layer':
        default:
          // Keep all results organized by layer
          break;
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0;

      // Update metrics
      updateMetrics(success, executionTime, context.totalLayers);

      return {
        compositionId: composition.id,
        pattern: 'cascading',
        success,
        results: finalResults,
        errors,
        executionTime,
        timestamp: startTime,
        metadata: {
          layersExecuted: context.layerResults.size,
          totalLayers: context.totalLayers,
          propagationTriggers: context.propagationChain.length,
          scalingDecisions: Object.fromEntries(context.scalingDecisions),
          layerExecutionTimes: Object.fromEntries(context.layerExecutionTimes),
          bufferUtilization: Object.fromEntries(
            Array.from(state.layerBuffers.entries()).map(([layer, buffer]) => 
              [layer, buffer.length]
            )
          )
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      updateMetrics(false, executionTime, 0);
      
      throw handleError(
        `Cascading composition ${composition.id} failed: ${error.message}`,
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
  const updateMetrics = (success: boolean, executionTime: number, layersExecuted: number): void => {
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

    state.metrics.avgLayersExecuted = 
      (state.metrics.avgLayersExecuted * (totalExecutions - 1) + layersExecuted) / totalExecutions;

    state.metrics.totalLayerExecutions += layersExecuted;
  };

  // Update layer-specific metrics
  const updateLayerMetrics = (layerId: number, executionTime: number, success: boolean): void => {
    let layerMetrics = state.metrics.layerMetrics.get(layerId);
    
    if (!layerMetrics) {
      layerMetrics = { executions: 0, avgExecutionTime: 0, successRate: 0 };
      state.metrics.layerMetrics.set(layerId, layerMetrics);
    }

    layerMetrics.executions++;
    layerMetrics.avgExecutionTime = 
      (layerMetrics.avgExecutionTime * (layerMetrics.executions - 1) + executionTime) / layerMetrics.executions;

    const successCount = layerMetrics.successRate * (layerMetrics.executions - 1) + (success ? 1 : 0);
    layerMetrics.successRate = successCount / layerMetrics.executions;
  };

  // Create composition from configuration
  const createComposition = (config: {
    id: string;
    name?: string;
    layers: CascadingLayer[];
    options?: CascadingComposition['options'];
  }): CascadingComposition => {
    return {
      id: config.id,
      name: config.name || config.id,
      pattern: 'cascading',
      strategy: 'continue_on_error',
      pipelines: config.layers.flatMap(l => l.pipelines),
      options: {
        strategy: 'continue_on_error',
        timeout: composerConfig.defaultLayerTimeout * config.layers.length,
        propagationMode: 'immediate',
        bufferManagement: 'fifo',
        adaptiveScaling: composerConfig.enablePredictiveScaling,
        layerSynchronization: 'loose',
        resultAggregation: 'per_layer',
        ...config.options
      },
      layers: config.layers
    };
  };

  // Get composer metrics
  const getMetrics = () => ({
    ...state.metrics,
    activeExecutions: state.activeExecutions.size,
    successRate: state.metrics.totalExecutions > 0
      ? state.metrics.successfulExecutions / state.metrics.totalExecutions
      : 0,
    layerMetrics: Object.fromEntries(state.metrics.layerMetrics),
    bufferStatus: Object.fromEntries(
      Array.from(state.layerBuffers.entries()).map(([layer, buffer]) => 
        [layer, { size: buffer.length }]
      )
    ),
    scalingHistory: Object.fromEntries(state.scalingHistory)
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    // Cancel all active executions
    for (const [executionId, execution] of state.activeExecutions) {
      execution.cancelled = true;
    }
    
    state.activeExecutions.clear();
    state.layerBuffers.clear();
    state.scalingHistory.clear();
    
    // Reset metrics
    state.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgLayersExecuted: 0,
      totalLayerExecutions: 0,
      scalingActivations: 0,
      bufferOverflows: 0,
      propagationTriggers: 0,
      layerMetrics: new Map()
    };
  };

  return {
    execute,
    createComposition,
    getMetrics,
    cleanup,
    
    // Pattern identification
    pattern: 'cascading' as const
  };
};