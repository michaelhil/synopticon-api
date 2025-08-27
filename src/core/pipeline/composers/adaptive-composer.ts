/**
 * Adaptive Pipeline Composer
 * Dynamically selects and executes pipelines based on input characteristics and performance metrics
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

export interface AdaptiveRule {
  id: string;
  condition: (input: any, context: AdaptiveContext) => boolean | Promise<boolean>;
  pipelineIds: string[];
  priority: number;
  weight?: number;
  metadata?: Record<string, any>;
}

export interface AdaptiveContext {
  inputSize?: number;
  inputType?: string;
  availableMemory?: number;
  cpuLoad?: number;
  networkBandwidth?: number;
  previousResults?: any[];
  executionHistory?: ExecutionMetrics[];
  preferences?: Record<string, any>;
}

export interface ExecutionMetrics {
  pipelineId: string;
  executionTime: number;
  memoryUsage: number;
  successRate: number;
  errorRate: number;
  lastExecution: number;
  averageProcessingTime: number;
}

export interface AdaptiveCompositionOptions {
  maxRulesEvaluated?: number;
  enableLearning?: boolean;
  fallbackStrategy?: 'best_performing' | 'least_resource_intensive' | 'most_reliable';
  performanceWeights?: {
    executionTime: number;
    memoryUsage: number;
    successRate: number;
    reliability: number;
  };
  adaptationThreshold?: number;
  executionStrategy?: ExecutionStrategy;
  timeout?: number;
}

export interface AdaptiveCompositionConfig extends CompositionConfig {
  pattern: CompositionPattern.ADAPTIVE;
  pipelines: AdaptiveRule[];
  options: AdaptiveCompositionOptions;
  learningData?: Map<string, ExecutionMetrics>;
}

/**
 * Creates an adaptive pipeline composition
 */
export const createAdaptiveComposition = (
  compositionId: string,
  adaptiveRules: AdaptiveRule[],
  options: AdaptiveCompositionOptions = {}
): AdaptiveCompositionConfig => {
  return {
    id: compositionId,
    pattern: CompositionPattern.ADAPTIVE,
    strategy: options.executionStrategy || ExecutionStrategy.BEST_EFFORT,
    pipelines: adaptiveRules.sort((a, b) => b.priority - a.priority),
    options: {
      maxRulesEvaluated: options.maxRulesEvaluated || 10,
      enableLearning: options.enableLearning !== false,
      fallbackStrategy: options.fallbackStrategy || 'best_performing',
      performanceWeights: {
        executionTime: 0.3,
        memoryUsage: 0.2,
        successRate: 0.4,
        reliability: 0.1,
        ...options.performanceWeights
      },
      adaptationThreshold: options.adaptationThreshold || 0.1,
      executionStrategy: options.executionStrategy || ExecutionStrategy.BEST_EFFORT,
      timeout: options.timeout || 30000,
      ...options
    },
    learningData: new Map()
  };
};

/**
 * Executes an adaptive composition
 */
export const executeAdaptive = async (
  composition: AdaptiveCompositionConfig,
  input: any,
  registeredPipelines: Map<string, PipelineInfo>,
  executePipelineStep: (pipeline: PipelineInfo, input: any, options: any) => Promise<any>,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> => {
  const startTime = performance.now();
  const context = await buildAdaptiveContext(input, composition, options);
  const selectedRules: AdaptiveRule[] = [];
  const results: any[] = [];
  let successfulPipelines = 0;
  let failedPipelines = 0;

  try {
    // Evaluate rules and select pipelines
    for (const rule of composition.pipelines) {
      if (selectedRules.length >= composition.options.maxRulesEvaluated!) {
        break;
      }

      try {
        const conditionMet = await rule.condition(input, context);
        
        if (conditionMet) {
          selectedRules.push(rule);
          
          // If we have a high-priority rule, we might skip evaluation of lower priority ones
          if (rule.priority > 8 && selectedRules.length === 1) {
            break;
          }
        }
      } catch (error) {
        results.push({
          success: false,
          error: `Rule evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
          ruleId: rule.id,
          ruleEvaluationError: true
        });
      }
    }

    // If no rules matched, apply fallback strategy
    if (selectedRules.length === 0) {
      const fallbackPipelines = await getFallbackPipelines(composition, registeredPipelines);
      if (fallbackPipelines.length > 0) {
        selectedRules.push({
          id: 'fallback',
          condition: () => true,
          pipelineIds: fallbackPipelines.map(p => p.id),
          priority: 0,
          metadata: { isFallback: true }
        });
      }
    }

    // Execute selected pipelines with performance monitoring
    for (const rule of selectedRules) {
      for (const pipelineId of rule.pipelineIds) {
        const pipeline = registeredPipelines.get(pipelineId);
        
        if (!pipeline) {
          results.push({
            success: false,
            error: `Pipeline ${pipelineId} not found`,
            pipelineId,
            ruleId: rule.id
          });
          failedPipelines++;
          continue;
        }

        const pipelineStartTime = performance.now();
        const memoryBefore = getMemoryUsage();

        try {
          const stepResult = await executeWithTimeout(
            executePipelineStep(pipeline, input, options),
            composition.options.timeout!
          );
          
          const executionTime = performance.now() - pipelineStartTime;
          const memoryAfter = getMemoryUsage();
          const memoryUsed = memoryAfter - memoryBefore;

          results.push({
            success: true,
            data: stepResult,
            pipelineId,
            ruleId: rule.id,
            processingTime: executionTime,
            memoryUsage: memoryUsed,
            isAdaptive: true
          });

          successfulPipelines++;

          // Update learning data if enabled
          if (composition.options.enableLearning) {
            await updateLearningData(composition, pipelineId, {
              executionTime,
              memoryUsage: memoryUsed,
              success: true
            });
          }

        } catch (error) {
          const executionTime = performance.now() - pipelineStartTime;
          
          results.push({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            pipelineId,
            ruleId: rule.id,
            processingTime: executionTime,
            isAdaptive: true
          });

          failedPipelines++;

          // Update learning data for failures too
          if (composition.options.enableLearning) {
            await updateLearningData(composition, pipelineId, {
              executionTime,
              memoryUsage: 0,
              success: false
            });
          }

          if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
            throw error;
          }
        }
      }
    }

  } catch (error) {
    if (composition.options.executionStrategy === ExecutionStrategy.FAIL_FAST) {
      throw error;
    }
  }

  const executionTime = performance.now() - startTime;
  const hasSuccessfulExecution = successfulPipelines > 0;

  return {
    success: hasSuccessfulExecution,
    data: results.reduce((acc, result) => {
      if (result.success && result.pipelineId) {
        acc[result.pipelineId] = result.data;
      }
      return acc;
    }, {} as Record<string, any>),
    error: !hasSuccessfulExecution ? 'No pipelines were successfully executed' : undefined,
    metadata: {
      executionTime,
      pipelinesExecuted: selectedRules.reduce((sum, rule) => sum + rule.pipelineIds.length, 0),
      successfulPipelines,
      failedPipelines,
      fromCache: false,
      compositionId: composition.id,
      executionPattern: CompositionPattern.ADAPTIVE,
      rulesEvaluated: composition.pipelines.length,
      rulesMatched: selectedRules.length,
      adaptiveContext: context,
      selectedRules: selectedRules.map(rule => ({
        id: rule.id,
        priority: rule.priority,
        pipelineCount: rule.pipelineIds.length
      })),
      results
    }
  };
};

/**
 * Builds the adaptive context for rule evaluation
 */
const buildAdaptiveContext = async (
  input: any, 
  composition: AdaptiveCompositionConfig, 
  options: ExecutionOptions
): Promise<AdaptiveContext> => {
  const context: AdaptiveContext = {
    inputSize: getInputSize(input),
    inputType: getInputType(input),
    availableMemory: getAvailableMemory(),
    cpuLoad: await getCpuLoad(),
    networkBandwidth: await getNetworkBandwidth(),
    previousResults: [],
    executionHistory: Array.from(composition.learningData?.values() || []),
    preferences: options.metadata?.preferences || {}
  };

  return context;
};

/**
 * Gets fallback pipelines based on the configured strategy
 */
const getFallbackPipelines = async (
  composition: AdaptiveCompositionConfig,
  registeredPipelines: Map<string, PipelineInfo>
): Promise<PipelineInfo[]> => {
  const availablePipelines = Array.from(registeredPipelines.values());
  const learningData = composition.learningData!;

  switch (composition.options.fallbackStrategy) {
    case 'best_performing':
      return availablePipelines
        .sort((a, b) => {
          const aMetrics = learningData.get(a.id);
          const bMetrics = learningData.get(b.id);
          if (!aMetrics && !bMetrics) return 0;
          if (!aMetrics) return 1;
          if (!bMetrics) return -1;
          return bMetrics.successRate - aMetrics.successRate;
        })
        .slice(0, 3);

    case 'least_resource_intensive':
      return availablePipelines
        .sort((a, b) => {
          const aMetrics = learningData.get(a.id);
          const bMetrics = learningData.get(b.id);
          if (!aMetrics && !bMetrics) return 0;
          if (!aMetrics) return 1;
          if (!bMetrics) return -1;
          return aMetrics.memoryUsage - bMetrics.memoryUsage;
        })
        .slice(0, 2);

    case 'most_reliable':
      return availablePipelines
        .sort((a, b) => {
          const aMetrics = learningData.get(a.id);
          const bMetrics = learningData.get(b.id);
          if (!aMetrics && !bMetrics) return 0;
          if (!aMetrics) return 1;
          if (!bMetrics) return -1;
          return bMetrics.errorRate - aMetrics.errorRate;
        })
        .slice(0, 2);

    default:
      return availablePipelines.slice(0, 1);
  }
};

/**
 * Updates learning data for adaptive optimization
 */
const updateLearningData = async (
  composition: AdaptiveCompositionConfig,
  pipelineId: string,
  metrics: { executionTime: number; memoryUsage: number; success: boolean }
): Promise<void> => {
  if (!composition.learningData) {
    composition.learningData = new Map();
  }

  const existing = composition.learningData.get(pipelineId) || {
    pipelineId,
    executionTime: 0,
    memoryUsage: 0,
    successRate: 0,
    errorRate: 0,
    lastExecution: 0,
    averageProcessingTime: 0
  };

  // Update with exponential moving average
  const alpha = 0.1; // Learning rate
  existing.averageProcessingTime = existing.averageProcessingTime * (1 - alpha) + metrics.executionTime * alpha;
  existing.memoryUsage = existing.memoryUsage * (1 - alpha) + metrics.memoryUsage * alpha;
  existing.lastExecution = Date.now();

  if (metrics.success) {
    existing.successRate = existing.successRate * (1 - alpha) + 1 * alpha;
    existing.errorRate = existing.errorRate * (1 - alpha);
  } else {
    existing.successRate = existing.successRate * (1 - alpha);
    existing.errorRate = existing.errorRate * (1 - alpha) + 1 * alpha;
  }

  composition.learningData.set(pipelineId, existing);
};

// Utility functions for system metrics
const getInputSize = (input: any): number => {
  try {
    return JSON.stringify(input).length;
  } catch {
    return 0;
  }
};

const getInputType = (input: any): string => {
  if (input && typeof input === 'object') {
    if (Array.isArray(input)) return 'array';
    if (input.constructor?.name) return input.constructor.name.toLowerCase();
    return 'object';
  }
  return typeof input;
};

const getMemoryUsage = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
};

const getAvailableMemory = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return usage.heapTotal - usage.heapUsed;
  }
  return 0;
};

const getCpuLoad = async (): Promise<number> => {
  // Simplified CPU load estimation
  const start = process.hrtime.bigint();
  await new Promise(resolve => setTimeout(resolve, 10));
  const end = process.hrtime.bigint();
  const elapsed = Number(end - start) / 1000000; // Convert to milliseconds
  return Math.min(elapsed / 10, 1.0); // Normalize to 0-1 range
};

const getNetworkBandwidth = async (): Promise<number> => {
  // Placeholder for network bandwidth detection
  // In a real implementation, this would measure actual network performance
  return 100; // MB/s
};

/**
 * Validates an adaptive composition configuration
 */
export const validateAdaptiveComposition = (composition: AdaptiveCompositionConfig): string[] => {
  const errors: string[] = [];
  
  if (!composition.id) {
    errors.push('Composition ID is required');
  }
  
  if (!composition.pipelines || composition.pipelines.length === 0) {
    errors.push('At least one adaptive rule is required');
  }
  
  if (composition.options.maxRulesEvaluated && composition.options.maxRulesEvaluated < 1) {
    errors.push('maxRulesEvaluated must be at least 1');
  }
  
  if (composition.options.adaptationThreshold && 
      (composition.options.adaptationThreshold < 0 || composition.options.adaptationThreshold > 1)) {
    errors.push('adaptationThreshold must be between 0 and 1');
  }
  
  if (composition.pipelines) {
    composition.pipelines.forEach((rule, index) => {
      if (!rule.id) {
        errors.push(`Adaptive rule at index ${index} is missing an ID`);
      }
      if (!rule.condition || typeof rule.condition !== 'function') {
        errors.push(`Adaptive rule at index ${index} is missing a condition function`);
      }
      if (!rule.pipelineIds || rule.pipelineIds.length === 0) {
        errors.push(`Adaptive rule at index ${index} must specify at least one pipeline ID`);
      }
      if (typeof rule.priority !== 'number') {
        errors.push(`Adaptive rule at index ${index} must have a numeric priority`);
      }
    });
  }
  
  return errors;
};