/**
 * Adaptive Pipeline Composer
 * Dynamically adjusts execution patterns based on runtime conditions and performance metrics
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';
import type { 
  CompositionPatternType, 
  ExecutionStrategyType, 
  BaseComposition, 
  CompositionResult,
  CompositionEngineConfig 
} from '../composition-engine.js';

export interface AdaptivePipeline {
  id: string;
  name?: string;
  pipeline: any;
  options?: any;
  priority?: number;
  weight?: number;
  adaptationRules?: AdaptationRule[];
  performanceProfile?: {
    expectedLatency?: number;
    expectedThroughput?: number;
    resourceRequirements?: Record<string, number>;
  };
  timeout?: number;
  retryCount?: number;
  inputTransformer?: (input: any, context: AdaptiveContext) => any;
  outputTransformer?: (output: any, context: AdaptiveContext) => any;
}

export interface AdaptationRule {
  id: string;
  trigger: {
    metric: 'latency' | 'throughput' | 'error_rate' | 'resource_usage' | 'custom';
    threshold: number;
    comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    window?: number; // Time window in ms for metric evaluation
  };
  action: {
    type: 'scale' | 'reorder' | 'switch_pattern' | 'adjust_concurrency' | 'custom';
    parameters: Record<string, any>;
  };
  cooldown?: number; // Minimum time between rule activations
  priority?: number;
}

export interface AdaptiveContext {
  currentPattern: CompositionPatternType;
  performanceMetrics: {
    avgLatency: number;
    throughput: number;
    errorRate: number;
    resourceUsage: Record<string, number>;
  };
  adaptationHistory: Array<{
    timestamp: number;
    rule: string;
    action: string;
    previousPattern: CompositionPatternType;
    newPattern: CompositionPatternType;
  }>;
  pipelineMetrics: Map<string, {
    executions: number;
    avgLatency: number;
    errorRate: number;
    lastExecution: number;
  }>;
  systemLoad: number;
  executionStartTime: number;
}

export interface AdaptiveComposition extends BaseComposition {
  pattern: 'adaptive';
  pipelines: AdaptivePipeline[];
  adaptationRules: AdaptationRule[];
  options: {
    strategy?: ExecutionStrategyType;
    timeout?: number;
    initialPattern?: CompositionPatternType;
    adaptationInterval?: number;
    learningEnabled?: boolean;
    fallbackPattern?: CompositionPatternType;
    maxAdaptations?: number;
    performanceWindow?: number;
  };
}

export interface AdaptiveComposerConfig extends CompositionEngineConfig {
  defaultAdaptationInterval?: number;
  maxAdaptationHistory?: number;
  enableMachineLearning?: boolean;
  performanceSamplingRate?: number;
}

/**
 * Creates adaptive pipeline composer
 */
export const createAdaptiveComposer = (config: AdaptiveComposerConfig = {}) => {
  const composerConfig = {
    defaultAdaptationInterval: config.defaultAdaptationInterval || 5000,
    maxAdaptationHistory: config.maxAdaptationHistory || 100,
    enableMachineLearning: config.enableMachineLearning || false,
    performanceSamplingRate: config.performanceSamplingRate || 1000,
    ...config
  };

  const state = {
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      adaptationCount: 0,
      patternSwitches: 0,
      learningIterations: 0,
      optimalPatternHits: 0,
      patternPerformance: new Map<CompositionPatternType, {
        executions: number;
        avgLatency: number;
        successRate: number;
      }>()
    },
    activeExecutions: new Map<string, any>(),
    ruleCooldowns: new Map<string, number>(),
    performanceHistory: [] as Array<{
      timestamp: number;
      pattern: CompositionPatternType;
      latency: number;
      throughput: number;
      errorRate: number;
    }>,
    learnedPatterns: new Map<string, CompositionPatternType>() // Condition hash -> optimal pattern
  };

  // Initialize pattern performance tracking
  const patterns: CompositionPatternType[] = ['sequential', 'parallel', 'conditional', 'cascading'];
  patterns.forEach(pattern => {
    state.metrics.patternPerformance.set(pattern, {
      executions: 0,
      avgLatency: 0,
      successRate: 0
    });
  });

  // Evaluate adaptation rules
  const evaluateAdaptationRules = (
    rules: AdaptationRule[],
    context: AdaptiveContext
  ): AdaptationRule[] => {
    const applicableRules: AdaptationRule[] = [];
    const now = Date.now();

    for (const rule of rules) {
      // Check cooldown
      const lastActivation = state.ruleCooldowns.get(rule.id) || 0;
      const cooldown = rule.cooldown || 10000; // Default 10s cooldown
      
      if (now - lastActivation < cooldown) {
        continue;
      }

      // Evaluate trigger condition
      let metricValue: number;
      
      switch (rule.trigger.metric) {
        case 'latency':
          metricValue = context.performanceMetrics.avgLatency;
          break;
        case 'throughput':
          metricValue = context.performanceMetrics.throughput;
          break;
        case 'error_rate':
          metricValue = context.performanceMetrics.errorRate;
          break;
        case 'resource_usage':
          metricValue = context.systemLoad;
          break;
        case 'custom':
          // Custom metrics would need to be implemented based on specific needs
          metricValue = 0;
          break;
        default:
          continue;
      }

      // Check threshold condition
      let conditionMet = false;
      const threshold = rule.trigger.threshold;

      switch (rule.trigger.comparison) {
        case 'gt':
          conditionMet = metricValue > threshold;
          break;
        case 'gte':
          conditionMet = metricValue >= threshold;
          break;
        case 'lt':
          conditionMet = metricValue < threshold;
          break;
        case 'lte':
          conditionMet = metricValue <= threshold;
          break;
        case 'eq':
          conditionMet = Math.abs(metricValue - threshold) < 0.01;
          break;
      }

      if (conditionMet) {
        applicableRules.push(rule);
      }
    }

    // Sort by priority
    return applicableRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  };

  // Apply adaptation action
  const applyAdaptation = (
    rule: AdaptationRule,
    context: AdaptiveContext,
    composition: AdaptiveComposition
  ): { newPattern?: CompositionPatternType; newConcurrency?: number; } => {
    const result: { newPattern?: CompositionPatternType; newConcurrency?: number; } = {};

    switch (rule.action.type) {
      case 'switch_pattern':
        const targetPattern = rule.action.parameters.pattern as CompositionPatternType;
        if (targetPattern !== context.currentPattern) {
          result.newPattern = targetPattern;
          context.adaptationHistory.push({
            timestamp: Date.now(),
            rule: rule.id,
            action: 'switch_pattern',
            previousPattern: context.currentPattern,
            newPattern: targetPattern
          });
          state.metrics.patternSwitches++;
        }
        break;

      case 'adjust_concurrency':
        const adjustment = rule.action.parameters.adjustment as number;
        const currentConcurrency = rule.action.parameters.currentConcurrency || 3;
        result.newConcurrency = Math.max(1, Math.min(10, currentConcurrency + adjustment));
        break;

      case 'reorder':
        // Reorder pipelines based on current performance
        const reorderCriteria = rule.action.parameters.criteria || 'performance';
        if (reorderCriteria === 'performance') {
          composition.pipelines.sort((a, b) => {
            const aMetrics = context.pipelineMetrics.get(a.id);
            const bMetrics = context.pipelineMetrics.get(b.id);
            const aScore = aMetrics ? (1 - aMetrics.errorRate) / aMetrics.avgLatency : 0;
            const bScore = bMetrics ? (1 - bMetrics.errorRate) / bMetrics.avgLatency : 0;
            return bScore - aScore;
          });
        }
        break;

      case 'scale':
        const scaleFactor = rule.action.parameters.factor || 1.5;
        result.newConcurrency = Math.ceil((rule.action.parameters.currentConcurrency || 3) * scaleFactor);
        break;

      case 'custom':
        // Custom actions would be implemented based on specific requirements
        break;
    }

    // Record rule activation
    state.ruleCooldowns.set(rule.id, Date.now());
    state.metrics.adaptationCount++;

    return result;
  };

  // Machine learning pattern suggestion
  const suggestOptimalPattern = (
    context: AdaptiveContext,
    composition: AdaptiveComposition
  ): CompositionPatternType => {
    if (!composerConfig.enableMachineLearning) {
      return context.currentPattern;
    }

    // Create condition hash based on current system state
    const conditionHash = `${Math.floor(context.systemLoad * 10)}_${Math.floor(context.performanceMetrics.throughput)}_${composition.pipelines.length}`;
    
    // Check if we've learned an optimal pattern for these conditions
    const learnedPattern = state.learnedPatterns.get(conditionHash);
    if (learnedPattern) {
      state.metrics.optimalPatternHits++;
      return learnedPattern;
    }

    // Find best performing pattern from history
    let bestPattern = context.currentPattern;
    let bestScore = 0;

    for (const [pattern, performance] of state.metrics.patternPerformance) {
      if (performance.executions === 0) continue;
      
      // Score based on latency and success rate
      const score = (performance.successRate * 1000) / Math.max(performance.avgLatency, 1);
      
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }

    // Learn this pattern for these conditions
    state.learnedPatterns.set(conditionHash, bestPattern);
    state.metrics.learningIterations++;

    return bestPattern;
  };

  // Execute with adaptive pattern switching
  const execute = async (composition: AdaptiveComposition): Promise<CompositionResult> => {
    const startTime = Date.now();
    const executionId = `adapt_${composition.id}_${startTime}`;

    try {
      if (!composition.pipelines || composition.pipelines.length === 0) {
        throw new Error('Adaptive composition must have at least one pipeline');
      }

      // Initialize adaptive context
      const context: AdaptiveContext = {
        currentPattern: composition.options.initialPattern || 'sequential',
        performanceMetrics: {
          avgLatency: 0,
          throughput: 0,
          errorRate: 0,
          resourceUsage: {}
        },
        adaptationHistory: [],
        pipelineMetrics: new Map(),
        systemLoad: 0.5, // Would be measured from actual system
        executionStartTime: startTime
      };

      // Register active execution
      state.activeExecutions.set(executionId, {
        startTime,
        cancelled: false,
        context,
        adaptationCount: 0
      });

      let currentPattern = context.currentPattern;
      let maxAdaptations = composition.options.maxAdaptations || 3;
      let adaptationCount = 0;
      
      const results: any[] = [];
      const errors: Array<{ pipelineId: string; error: Error; }> = [];

      // Main execution loop with adaptation
      while (adaptationCount <= maxAdaptations) {
        const iterationStartTime = Date.now();

        try {
          // Execute with current pattern (simplified - would use actual pattern composers)
          const iterationResults = await executeWithPattern(
            currentPattern,
            composition,
            context,
            executionId
          );

          results.push(...iterationResults.results);
          errors.push(...iterationResults.errors);

          // Update performance metrics
          const iterationTime = Date.now() - iterationStartTime;
          updatePerformanceMetrics(context, iterationTime, iterationResults.results.length, iterationResults.errors.length);

          // Evaluate adaptation rules
          const applicableRules = evaluateAdaptationRules(composition.adaptationRules, context);

          if (applicableRules.length === 0) {
            // No adaptations needed, execution complete
            break;
          }

          // Apply first applicable rule
          const adaptation = applyAdaptation(applicableRules[0], context, composition);
          
          if (adaptation.newPattern && adaptation.newPattern !== currentPattern) {
            currentPattern = adaptation.newPattern;
            context.currentPattern = currentPattern;
            adaptationCount++;
            
            // Continue execution with new pattern if more pipelines remain
            if (adaptationCount < maxAdaptations) {
              continue;
            }
          }

          break;

        } catch (error) {
          // Try fallback pattern if available
          const fallbackPattern = composition.options.fallbackPattern;
          if (fallbackPattern && fallbackPattern !== currentPattern && adaptationCount < maxAdaptations) {
            currentPattern = fallbackPattern;
            context.currentPattern = currentPattern;
            adaptationCount++;
            continue;
          }

          throw error;
        }
      }

      // Machine learning pattern optimization
      if (composerConfig.enableMachineLearning && results.length > 0) {
        const optimalPattern = suggestOptimalPattern(context, composition);
        if (optimalPattern !== context.currentPattern) {
          context.adaptationHistory.push({
            timestamp: Date.now(),
            rule: 'ml_optimization',
            action: 'pattern_suggestion',
            previousPattern: context.currentPattern,
            newPattern: optimalPattern
          });
        }
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0;

      // Update pattern performance
      updatePatternPerformance(context.currentPattern, executionTime, success);

      // Update overall metrics
      updateMetrics(success, executionTime, adaptationCount);

      // Record performance history
      state.performanceHistory.push({
        timestamp: startTime,
        pattern: context.currentPattern,
        latency: executionTime,
        throughput: results.length / Math.max(executionTime / 1000, 0.001),
        errorRate: errors.length / Math.max(results.length + errors.length, 1)
      });

      // Trim history if too long
      if (state.performanceHistory.length > composerConfig.maxAdaptationHistory) {
        state.performanceHistory.shift();
      }

      return {
        compositionId: composition.id,
        pattern: 'adaptive',
        success,
        results,
        errors,
        executionTime,
        timestamp: startTime,
        metadata: {
          adaptationCount,
          finalPattern: context.currentPattern,
          adaptationHistory: context.adaptationHistory,
          performanceMetrics: context.performanceMetrics,
          rulesEvaluated: composition.adaptationRules.length,
          pipelineMetrics: Object.fromEntries(context.pipelineMetrics)
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      updateMetrics(false, executionTime, 0);
      
      throw handleError(
        `Adaptive composition ${composition.id} failed: ${error.message}`,
        ErrorCategory.PIPELINE_EXECUTION,
        ErrorSeverity.ERROR
      );
    } finally {
      state.activeExecutions.delete(executionId);
    }
  };

  // Execute with specific pattern (simplified version)
  const executeWithPattern = async (
    pattern: CompositionPatternType,
    composition: AdaptiveComposition,
    context: AdaptiveContext,
    executionId: string
  ): Promise<{ results: any[]; errors: Array<{ pipelineId: string; error: Error; }> }> => {
    const results: any[] = [];
    const errors: Array<{ pipelineId: string; error: Error; }> = [];

    // This is a simplified implementation - in practice would use actual pattern composers
    switch (pattern) {
      case 'sequential':
        for (const pipeline of composition.pipelines) {
          try {
            const result = await executePipeline(pipeline, {}, context, executionId);
            results.push(result);
          } catch (error) {
            errors.push({ pipelineId: pipeline.id, error });
          }
        }
        break;

      case 'parallel':
        const promises = composition.pipelines.map(pipeline =>
          executePipeline(pipeline, {}, context, executionId)
            .catch(error => ({ error, pipelineId: pipeline.id }))
        );

        const settledResults = await Promise.allSettled(promises);
        
        for (const result of settledResults) {
          if (result.status === 'fulfilled') {
            if (result.value.error) {
              errors.push({ pipelineId: result.value.pipelineId, error: result.value.error });
            } else {
              results.push(result.value);
            }
          }
        }
        break;

      default:
        // For conditional and cascading, use sequential as fallback
        for (const pipeline of composition.pipelines) {
          try {
            const result = await executePipeline(pipeline, {}, context, executionId);
            results.push(result);
          } catch (error) {
            errors.push({ pipelineId: pipeline.id, error });
          }
        }
        break;
    }

    return { results, errors };
  };

  // Execute individual pipeline
  const executePipeline = async (
    pipelineConfig: AdaptivePipeline,
    input: any,
    context: AdaptiveContext,
    executionId: string
  ): Promise<any> => {
    const { id, pipeline, options = {}, timeout } = pipelineConfig;
    const pipelineTimeout = timeout || 30000;
    const pipelineStartTime = Date.now();

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

      const executionTime = Date.now() - pipelineStartTime;

      // Update pipeline metrics
      updatePipelineMetrics(id, executionTime, true, context);

      return {
        success: true,
        pipelineId: id,
        result: transformedResult,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - pipelineStartTime;
      updatePipelineMetrics(id, executionTime, false, context);
      throw error;
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

  // Update performance metrics
  const updatePerformanceMetrics = (
    context: AdaptiveContext,
    executionTime: number,
    successCount: number,
    errorCount: number
  ): void => {
    const totalOperations = successCount + errorCount;
    
    context.performanceMetrics.avgLatency = 
      (context.performanceMetrics.avgLatency + executionTime) / 2;
    
    context.performanceMetrics.throughput = 
      totalOperations / Math.max(executionTime / 1000, 0.001);
    
    context.performanceMetrics.errorRate = 
      errorCount / Math.max(totalOperations, 1);
  };

  // Update pipeline-specific metrics
  const updatePipelineMetrics = (
    pipelineId: string,
    executionTime: number,
    success: boolean,
    context: AdaptiveContext
  ): void => {
    let metrics = context.pipelineMetrics.get(pipelineId);
    
    if (!metrics) {
      metrics = { executions: 0, avgLatency: 0, errorRate: 0, lastExecution: 0 };
      context.pipelineMetrics.set(pipelineId, metrics);
    }

    metrics.executions++;
    metrics.avgLatency = 
      (metrics.avgLatency * (metrics.executions - 1) + executionTime) / metrics.executions;
    
    const errorCount = metrics.errorRate * (metrics.executions - 1) + (success ? 0 : 1);
    metrics.errorRate = errorCount / metrics.executions;
    
    metrics.lastExecution = Date.now();
  };

  // Update pattern performance
  const updatePatternPerformance = (
    pattern: CompositionPatternType,
    executionTime: number,
    success: boolean
  ): void => {
    let performance = state.metrics.patternPerformance.get(pattern);
    
    if (!performance) {
      performance = { executions: 0, avgLatency: 0, successRate: 0 };
      state.metrics.patternPerformance.set(pattern, performance);
    }

    performance.executions++;
    performance.avgLatency = 
      (performance.avgLatency * (performance.executions - 1) + executionTime) / performance.executions;
    
    const successCount = performance.successRate * (performance.executions - 1) + (success ? 1 : 0);
    performance.successRate = successCount / performance.executions;
  };

  // Update overall metrics
  const updateMetrics = (success: boolean, executionTime: number, adaptationCount: number): void => {
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

    state.metrics.adaptationCount += adaptationCount;
  };

  // Create composition from configuration
  const createComposition = (config: {
    id: string;
    name?: string;
    pipelines: AdaptivePipeline[];
    adaptationRules?: AdaptationRule[];
    options?: AdaptiveComposition['options'];
  }): AdaptiveComposition => {
    return {
      id: config.id,
      name: config.name || config.id,
      pattern: 'adaptive',
      strategy: 'continue_on_error',
      pipelines: config.pipelines,
      adaptationRules: config.adaptationRules || [],
      options: {
        strategy: 'continue_on_error',
        timeout: 60000,
        initialPattern: 'sequential',
        adaptationInterval: composerConfig.defaultAdaptationInterval,
        learningEnabled: composerConfig.enableMachineLearning,
        fallbackPattern: 'sequential',
        maxAdaptations: 3,
        performanceWindow: 30000,
        ...config.options
      }
    };
  };

  // Get composer metrics
  const getMetrics = () => ({
    ...state.metrics,
    activeExecutions: state.activeExecutions.size,
    successRate: state.metrics.totalExecutions > 0
      ? state.metrics.successfulExecutions / state.metrics.totalExecutions
      : 0,
    patternPerformance: Object.fromEntries(state.metrics.patternPerformance),
    adaptationRate: state.metrics.totalExecutions > 0
      ? state.metrics.adaptationCount / state.metrics.totalExecutions
      : 0,
    learningEfficiency: state.metrics.learningIterations > 0
      ? state.metrics.optimalPatternHits / state.metrics.learningIterations
      : 0,
    performanceHistorySize: state.performanceHistory.length,
    learnedPatternsCount: state.learnedPatterns.size
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    // Cancel all active executions
    for (const [executionId, execution] of state.activeExecutions) {
      execution.cancelled = true;
    }
    
    state.activeExecutions.clear();
    state.ruleCooldowns.clear();
    state.performanceHistory.length = 0;
    state.learnedPatterns.clear();
    
    // Reset metrics
    state.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      adaptationCount: 0,
      patternSwitches: 0,
      learningIterations: 0,
      optimalPatternHits: 0,
      patternPerformance: new Map()
    };

    // Reinitialize pattern performance
    const patterns: CompositionPatternType[] = ['sequential', 'parallel', 'conditional', 'cascading'];
    patterns.forEach(pattern => {
      state.metrics.patternPerformance.set(pattern, {
        executions: 0,
        avgLatency: 0,
        successRate: 0
      });
    });
  };

  return {
    execute,
    createComposition,
    getMetrics,
    cleanup,
    
    // Pattern identification
    pattern: 'adaptive' as const
  };
};