/**
 * Parallel Pipeline Composer
 * Executes pipelines concurrently with advanced synchronization and load balancing
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';
import type { 
  CompositionPatternType, 
  ExecutionStrategyType, 
  BaseComposition, 
  CompositionResult,
  CompositionEngineConfig 
} from '../composition-engine.js';

export interface ParallelPipeline {
  id: string;
  name?: string;
  pipeline: any;
  options?: any;
  priority?: number; // 1-10, higher = more important
  weight?: number; // Resource allocation weight
  timeout?: number;
  retryCount?: number;
  dependencies?: string[]; // Pipeline IDs that must complete first
  condition?: (input: any, context: ParallelContext) => boolean;
  inputTransformer?: (input: any, context: ParallelContext) => any;
  outputTransformer?: (output: any, context: ParallelContext) => any;
}

export interface ParallelContext {
  completedPipelines: Map<string, any>;
  failedPipelines: Map<string, Error>;
  executionStartTime: number;
  totalPipelines: number;
  maxConcurrency: number;
  currentlyRunning: Set<string>;
}

export interface ParallelComposition extends BaseComposition {
  pattern: 'parallel';
  pipelines: ParallelPipeline[];
  options: {
    strategy?: ExecutionStrategyType;
    maxConcurrency?: number;
    timeout?: number;
    loadBalancing?: 'round_robin' | 'priority' | 'weighted' | 'least_loaded';
    synchronization?: 'wait_all' | 'wait_any' | 'wait_majority' | 'wait_priority';
    resultOrdering?: 'completion_order' | 'original_order' | 'priority_order';
    resourceAllocation?: 'fair' | 'priority_based' | 'weighted';
    enableEarlyTermination?: boolean;
    terminationCondition?: (results: any[], context: ParallelContext) => boolean;
  };
}

export interface ParallelComposerConfig extends CompositionEngineConfig {
  defaultMaxConcurrency?: number;
  enableResourceMonitoring?: boolean;
  enableLoadBalancing?: boolean;
}

/**
 * Creates parallel pipeline composer
 */
export const createParallelComposer = (config: ParallelComposerConfig = {}) => {
  const composerConfig = {
    defaultMaxConcurrency: config.defaultMaxConcurrency || 5,
    enableResourceMonitoring: config.enableResourceMonitoring !== false,
    enableLoadBalancing: config.enableLoadBalancing !== false,
    ...config
  };

  const state = {
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgConcurrency: 0,
      maxConcurrencyReached: 0,
      earlyTerminations: 0,
      dependencyWaitTime: 0
    },
    activeExecutions: new Map<string, any>(),
    resourceUsage: {
      cpuUtilization: 0,
      memoryUsage: 0,
      activeThreads: 0
    }
  };

  // Load balancer implementation
  const createLoadBalancer = (strategy: string) => {
    let roundRobinIndex = 0;

    return {
      selectNext: (availablePipelines: ParallelPipeline[], context: ParallelContext) => {
        switch (strategy) {
          case 'round_robin':
            const selected = availablePipelines[roundRobinIndex % availablePipelines.length];
            roundRobinIndex++;
            return selected;

          case 'priority':
            return availablePipelines.sort((a, b) => (b.priority || 5) - (a.priority || 5))[0];

          case 'weighted':
            const totalWeight = availablePipelines.reduce((sum, p) => sum + (p.weight || 1), 0);
            const random = Math.random() * totalWeight;
            let currentWeight = 0;
            for (const pipeline of availablePipelines) {
              currentWeight += pipeline.weight || 1;
              if (random <= currentWeight) {
                return pipeline;
              }
            }
            return availablePipelines[0];

          case 'least_loaded':
            // Simple implementation based on current running count
            return availablePipelines[0]; // Would implement proper load tracking

          default:
            return availablePipelines[0];
        }
      }
    };
  };

  // Check if pipeline dependencies are satisfied
  const checkDependencies = (pipeline: ParallelPipeline, context: ParallelContext): boolean => {
    if (!pipeline.dependencies || pipeline.dependencies.length === 0) {
      return true;
    }

    return pipeline.dependencies.every(depId => 
      context.completedPipelines.has(depId)
    );
  };

  // Execute a single pipeline
  const executePipeline = async (
    pipelineConfig: ParallelPipeline,
    input: any,
    context: ParallelContext,
    executionId: string
  ): Promise<any> => {
    const { id, pipeline, options = {}, timeout, retryCount = 0 } = pipelineConfig;
    const pipelineTimeout = timeout || 30000;

    // Wait for dependencies
    const dependencyStartTime = Date.now();
    while (!checkDependencies(pipelineConfig, context)) {
      const execution = state.activeExecutions.get(executionId);
      if (execution?.cancelled) {
        throw new Error('Execution cancelled while waiting for dependencies');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const dependencyWaitTime = Date.now() - dependencyStartTime;
    state.metrics.dependencyWaitTime += dependencyWaitTime;

    // Mark as running
    context.currentlyRunning.add(id);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Apply input transformer if present
        let transformedInput = input;
        if (pipelineConfig.inputTransformer) {
          transformedInput = pipelineConfig.inputTransformer(input, context);
        }

        // Check condition if present
        if (pipelineConfig.condition && !pipelineConfig.condition(transformedInput, context)) {
          return { skipped: true, reason: 'condition_failed', pipelineId: id };
        }

        // Execute with timeout
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

        return {
          success: true,
          pipelineId: id,
          result: transformedResult,
          priority: pipelineConfig.priority || 5,
          attempt,
          dependencyWaitTime
        };

      } catch (error) {
        lastError = error;
        
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error(`Pipeline ${id} failed`);
  };

  // Execute parallel composition
  const execute = async (composition: ParallelComposition): Promise<CompositionResult> => {
    const startTime = Date.now();
    const executionId = `par_${composition.id}_${startTime}`;

    try {
      if (!composition.pipelines || composition.pipelines.length === 0) {
        throw new Error('Parallel composition must have at least one pipeline');
      }

      const maxConcurrency = Math.min(
        composition.options.maxConcurrency || composerConfig.defaultMaxConcurrency,
        composition.pipelines.length
      );

      // Create execution context
      const context: ParallelContext = {
        completedPipelines: new Map(),
        failedPipelines: new Map(),
        executionStartTime: startTime,
        totalPipelines: composition.pipelines.length,
        maxConcurrency,
        currentlyRunning: new Set()
      };

      // Register active execution
      state.activeExecutions.set(executionId, {
        startTime,
        cancelled: false,
        context
      });

      const results: any[] = [];
      const errors: Array<{ pipelineId: string; error: Error; }> = [];
      const loadBalancer = createLoadBalancer(composition.options.loadBalancing || 'round_robin');
      
      // Create execution promises with concurrency control
      const pendingPipelines = [...composition.pipelines];
      const runningPromises = new Map<string, Promise<any>>();
      let completedCount = 0;

      // Helper to start next pipeline
      const startNextPipeline = () => {
        if (pendingPipelines.length === 0 || runningPromises.size >= maxConcurrency) {
          return;
        }

        // Find pipelines ready to run (dependencies satisfied)
        const readyPipelines = pendingPipelines.filter(p => checkDependencies(p, context));
        if (readyPipelines.length === 0) {
          return;
        }

        // Select pipeline using load balancer
        const selectedPipeline = loadBalancer.selectNext(readyPipelines, context);
        const pipelineIndex = pendingPipelines.indexOf(selectedPipeline);
        pendingPipelines.splice(pipelineIndex, 1);

        // Start pipeline execution
        const pipelinePromise = executePipeline(
          selectedPipeline,
          (composition.options as any).initialInput || {},
          context,
          executionId
        ).then(result => {
          // Handle successful completion
          context.completedPipelines.set(selectedPipeline.id, result);
          context.currentlyRunning.delete(selectedPipeline.id);
          results.push(result);
          completedCount++;
          return result;
        }).catch(error => {
          // Handle pipeline failure
          context.failedPipelines.set(selectedPipeline.id, error);
          context.currentlyRunning.delete(selectedPipeline.id);
          errors.push({ pipelineId: selectedPipeline.id, error });
          completedCount++;
          
          const strategy = composition.strategy || composition.options.strategy || 'continue_on_error';
          if (strategy === 'fail_fast') {
            throw error;
          }
          return null;
        }).finally(() => {
          // Remove from running promises and start next
          runningPromises.delete(selectedPipeline.id);
          startNextPipeline();
        });

        runningPromises.set(selectedPipeline.id, pipelinePromise);
      };

      // Start initial pipelines up to concurrency limit
      for (let i = 0; i < Math.min(maxConcurrency, composition.pipelines.length); i++) {
        startNextPipeline();
      }

      // Wait for completion based on synchronization strategy
      const syncStrategy = composition.options.synchronization || 'wait_all';
      
      while (true) {
        // Check termination conditions
        const execution = state.activeExecutions.get(executionId);
        if (execution?.cancelled) {
          throw new Error('Execution cancelled');
        }

        // Check early termination condition
        if (composition.options.enableEarlyTermination && 
            composition.options.terminationCondition &&
            composition.options.terminationCondition(results, context)) {
          state.metrics.earlyTerminations++;
          break;
        }

        // Check synchronization conditions
        let shouldContinue = true;
        
        switch (syncStrategy) {
          case 'wait_all':
            shouldContinue = completedCount < composition.pipelines.length;
            break;
          case 'wait_any':
            shouldContinue = results.length === 0 && errors.length === 0;
            break;
          case 'wait_majority':
            const majority = Math.ceil(composition.pipelines.length / 2);
            shouldContinue = (results.length + errors.length) < majority;
            break;
          case 'wait_priority':
            const priorityPipelines = composition.pipelines.filter(p => (p.priority || 5) >= 8);
            const completedPriority = results.filter(r => r.priority >= 8).length;
            shouldContinue = completedPriority < priorityPipelines.length;
            break;
        }

        if (!shouldContinue || (pendingPipelines.length === 0 && runningPromises.size === 0)) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Cancel remaining running pipelines if early termination
      if (runningPromises.size > 0) {
        // Wait for remaining or cancel based on strategy
        try {
          await Promise.allSettled(Array.from(runningPromises.values()));
        } catch {
          // Ignore errors from cancelled pipelines
        }
      }

      // Order results based on result ordering strategy
      let finalResults = results;
      const ordering = composition.options.resultOrdering || 'completion_order';
      
      switch (ordering) {
        case 'original_order':
          finalResults = composition.pipelines
            .map(p => results.find(r => r.pipelineId === p.id))
            .filter(Boolean);
          break;
        case 'priority_order':
          finalResults = results.sort((a, b) => (b.priority || 5) - (a.priority || 5));
          break;
        case 'completion_order':
        default:
          // Keep completion order
          break;
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0 || composition.options.strategy === 'continue_on_error';
      const avgConcurrency = results.length > 0 ? results.length / Math.max(1, executionTime / 1000) : 0;

      // Update metrics
      updateMetrics(success, executionTime, avgConcurrency, maxConcurrency);

      return {
        compositionId: composition.id,
        pattern: 'parallel',
        success,
        results: finalResults,
        errors,
        executionTime,
        timestamp: startTime,
        metadata: {
          maxConcurrency,
          actualConcurrency: Math.min(maxConcurrency, composition.pipelines.length),
          synchronizationStrategy: syncStrategy,
          loadBalancingStrategy: composition.options.loadBalancing || 'round_robin',
          earlyTermination: composition.options.enableEarlyTermination && 
                           completedCount < composition.pipelines.length
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      updateMetrics(false, executionTime, 0, 0);
      
      throw handleError(
        `Parallel composition ${composition.id} failed: ${error.message}`,
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
  const updateMetrics = (
    success: boolean, 
    executionTime: number, 
    avgConcurrency: number, 
    maxConcurrency: number
  ): void => {
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

    state.metrics.avgConcurrency = 
      (state.metrics.avgConcurrency * (totalExecutions - 1) + avgConcurrency) / totalExecutions;

    state.metrics.maxConcurrencyReached = Math.max(state.metrics.maxConcurrencyReached, maxConcurrency);
  };

  // Create composition from configuration
  const createComposition = (config: {
    id: string;
    name?: string;
    pipelines: ParallelPipeline[];
    options?: ParallelComposition['options'];
  }): ParallelComposition => {
    return {
      id: config.id,
      name: config.name || config.id,
      pattern: 'parallel',
      strategy: 'continue_on_error',
      pipelines: config.pipelines,
      options: {
        strategy: 'continue_on_error',
        maxConcurrency: composerConfig.defaultMaxConcurrency,
        timeout: 60000,
        loadBalancing: 'round_robin',
        synchronization: 'wait_all',
        resultOrdering: 'completion_order',
        resourceAllocation: 'fair',
        enableEarlyTermination: false,
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
    resourceUsage: state.resourceUsage
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    // Cancel all active executions
    for (const [executionId, execution] of state.activeExecutions) {
      execution.cancelled = true;
    }
    
    state.activeExecutions.clear();
    
    // Reset metrics
    state.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      avgConcurrency: 0,
      maxConcurrencyReached: 0,
      earlyTerminations: 0,
      dependencyWaitTime: 0
    };
  };

  return {
    execute,
    createComposition,
    getMetrics,
    cleanup,
    
    // Pattern identification
    pattern: 'parallel' as const
  };
};