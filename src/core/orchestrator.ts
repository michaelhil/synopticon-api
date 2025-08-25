/**
 * Pipeline orchestrator for managing multiple face analysis pipelines - TypeScript Native
 * Handles dynamic pipeline selection, fallback strategies, and circuit breaking
 * Strict type safety for all pipeline operations
 */

import { createAnalysisResult, createErrorResult } from './types';
import { findCompatiblePipelines, scorePipeline } from './pipeline';
import { createParallelInitializer } from './parallel-initializer';
import type { 
  AnalysisResult, 
  AnalysisRequirements, 
  PipelineConfig, 
  ErrorResult,
  PerformanceMetrics,
  CapabilityType
} from './types';

// Import Pipeline interface from the canonical source
import type { Pipeline, PipelineConfig as BasePipelineConfig } from './pipeline';

// Circuit breaker state
interface CircuitBreakerState {
  readonly failures: Map<string, number>;
  readonly lastFailure: Map<string, number>;
  readonly successCount: Map<string, number>;
  readonly failureThreshold: number;
  readonly successThreshold: number;
  readonly timeoutMs: number;
}

// Circuit breaker interface
export interface CircuitBreaker {
  recordFailure(pipelineId: string): void;
  recordSuccess(pipelineId: string): void;
  isCircuitOpen(pipelineId: string): boolean;
  getCircuitState(pipelineId: string): 'closed' | 'open' | 'half-open';
  executeWithBreaker<T>(pipelineId: string, operation: () => Promise<T>): Promise<T>;
  reset(pipelineId?: string): void;
  getStats(): Record<string, {
    failures: number;
    successes: number;
    state: 'closed' | 'open' | 'half-open';
    lastFailure?: number;
  }>;
}

// Orchestrator configuration
export interface OrchestratorConfig {
  readonly strategies?: ReturnType<typeof import('./strategies.js').createStrategyRegistry>;
  readonly defaultStrategy?: string;
  readonly circuitBreaker?: {
    readonly failureThreshold?: number;
    readonly successThreshold?: number;
    readonly timeoutMs?: number;
  };
  readonly performance?: {
    readonly maxConcurrentPipelines?: number;
    readonly timeoutMs?: number;
    readonly retryAttempts?: number;
    readonly enableProfiling?: boolean;
  };
  readonly fallback?: {
    readonly enabled?: boolean;
    readonly maxFallbacks?: number;
    readonly skipFailedPipelines?: boolean;
  };
}

// Orchestrator state
interface OrchestratorState {
  readonly pipelines: Map<string, Pipeline>;
  readonly strategies: ReturnType<typeof import('./strategies.js').createStrategyRegistry>;
  readonly circuitBreaker: CircuitBreaker;
  readonly parallelInitializer: ReturnType<typeof createParallelInitializer>;
  readonly defaultRequirements: AnalysisRequirements;
  readonly metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgProcessingTime: number;
    lastProcessingTimes: ReadonlyArray<number>;
  };
  readonly config: Required<OrchestratorConfig>;
}

/**
 * Circuit breaker for pipeline failure handling
 */
export const createCircuitBreaker = (config: OrchestratorConfig['circuitBreaker'] = {}): CircuitBreaker => {
  const state: CircuitBreakerState = {
    failures: new Map(),
    lastFailure: new Map(),
    successCount: new Map(),
    failureThreshold: config?.failureThreshold ?? 5,
    successThreshold: config?.successThreshold ?? 3,
    timeoutMs: config?.timeoutMs ?? 30000 // 30 second cooldown
  };

  const recordFailure = (pipelineId: string): void => {
    const currentFailures = state.failures.get(pipelineId) ?? 0;
    state.failures.set(pipelineId, currentFailures + 1);
    state.lastFailure.set(pipelineId, Date.now());
    state.successCount.set(pipelineId, 0); // Reset success count on failure
  };

  const recordSuccess = (pipelineId: string): void => {
    const currentSuccesses = state.successCount.get(pipelineId) ?? 0;
    state.successCount.set(pipelineId, currentSuccesses + 1);
    
    // Reset failures if we've had enough successes
    if (currentSuccesses >= state.successThreshold) {
      state.failures.set(pipelineId, 0);
      state.lastFailure.delete(pipelineId);
    }
  };

  const getCircuitState = (pipelineId: string): 'closed' | 'open' | 'half-open' => {
    const failures = state.failures.get(pipelineId) ?? 0;
    const lastFailure = state.lastFailure.get(pipelineId) ?? 0;
    const timeSinceFailure = Date.now() - lastFailure;
    
    if (failures < state.failureThreshold) {
      return 'closed'; // Normal operation
    }
    
    if (timeSinceFailure < state.timeoutMs) {
      return 'open'; // Circuit is open, blocking requests
    }
    
    return 'half-open'; // Testing if service has recovered
  };

  const isCircuitOpen = (pipelineId: string): boolean => {
    return getCircuitState(pipelineId) === 'open';
  };

  const executeWithBreaker = async <T>(pipelineId: string, operation: () => Promise<T>): Promise<T> => {
    const circuitState = getCircuitState(pipelineId);
    
    if (circuitState === 'open') {
      throw new Error(`Circuit breaker open for pipeline: ${pipelineId}`);
    }

    try {
      const result = await operation();
      recordSuccess(pipelineId);
      return result;
    } catch (error) {
      recordFailure(pipelineId);
      throw error;
    }
  };

  const reset = (pipelineId?: string): void => {
    if (pipelineId) {
      state.failures.delete(pipelineId);
      state.lastFailure.delete(pipelineId);
      state.successCount.delete(pipelineId);
    } else {
      state.failures.clear();
      state.lastFailure.clear();
      state.successCount.clear();
    }
  };

  const getStats = (): Record<string, {
    failures: number;
    successes: number;
    state: 'closed' | 'open' | 'half-open';
    lastFailure?: number;
  }> => {
    const stats: Record<string, any> = {};
    
    const allPipelineIds = new Set([
      ...Array.from(state.failures.keys()),
      ...Array.from(state.successCount.keys()),
      ...Array.from(state.lastFailure.keys())
    ]);
    
    allPipelineIds.forEach(pipelineId => {
      stats[pipelineId] = {
        failures: state.failures.get(pipelineId) ?? 0,
        successes: state.successCount.get(pipelineId) ?? 0,
        state: getCircuitState(pipelineId),
        lastFailure: state.lastFailure.get(pipelineId)
      };
    });
    
    return stats;
  };

  return {
    recordFailure,
    recordSuccess,
    isCircuitOpen,
    getCircuitState,
    executeWithBreaker,
    reset,
    getStats
  };
};

/**
 * Creates the main pipeline orchestrator
 */
export const createOrchestrator = (userConfig: OrchestratorConfig = {}) => {
  // Default configuration
  const defaultConfig: Required<OrchestratorConfig> = {
    strategies: userConfig.strategies ?? (() => {
      throw new Error('Strategies registry is required');
    })(),
    defaultStrategy: userConfig.defaultStrategy ?? 'balanced',
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 3,
      timeoutMs: 30000,
      ...userConfig.circuitBreaker
    },
    performance: {
      maxConcurrentPipelines: 3,
      timeoutMs: 10000,
      retryAttempts: 2,
      enableProfiling: false,
      ...userConfig.performance
    },
    fallback: {
      enabled: true,
      maxFallbacks: 2,
      skipFailedPipelines: true,
      ...userConfig.fallback
    }
  };

  // Initialize state
  const state: OrchestratorState = {
    pipelines: new Map(),
    strategies: defaultConfig.strategies,
    circuitBreaker: createCircuitBreaker(defaultConfig.circuitBreaker),
    parallelInitializer: createParallelInitializer({
      maxConcurrency: defaultConfig.performance.maxConcurrentPipelines,
      timeoutMs: defaultConfig.performance.timeoutMs
    }),
    defaultRequirements: {
      capabilities: ['face_detection'],
      strategy: 'balanced',
      quality: {
        minConfidence: 0.5,
        maxLatency: 1000,
        requiredFPS: 30,
        realtime: true
      }
    },
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgProcessingTime: 0,
      lastProcessingTimes: []
    },
    config: defaultConfig
  };

  // Pipeline management
  const registerPipeline = async (pipeline: Pipeline): Promise<void> => {
    if (state.pipelines.has(pipeline.name)) {
      console.warn(`Pipeline ${pipeline.name} already registered, replacing...`);
    }
    
    try {
      // Initialize pipeline if not already done
      if (!pipeline.isInitialized) {
        await pipeline.initialize();
      }
      
      state.pipelines.set(pipeline.name, pipeline);
      console.log(`✅ Pipeline ${pipeline.name} registered successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to register pipeline ${pipeline.name}:`, message);
      throw new Error(`Pipeline registration failed: ${message}`);
    }
  };

  const unregisterPipeline = async (name: string): Promise<boolean> => {
    const pipeline = state.pipelines.get(name);
    if (!pipeline) {
      return false;
    }
    
    try {
      await pipeline.cleanup();
      state.pipelines.delete(name);
      state.circuitBreaker.reset(name);
      console.log(`✅ Pipeline ${name} unregistered successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Error unregistering pipeline ${name}:`, error);
      return false;
    }
  };

  // Pipeline selection and scoring
  const selectOptimalPipelines = (requirements: AnalysisRequirements = state.defaultRequirements): ReadonlyArray<Pipeline> => {
    const available = Array.from(state.pipelines.values());
    const compatible = findCompatiblePipelines(available, requirements);
    
    if (compatible.length === 0) {
      throw new Error(`No pipelines available for capabilities: ${requirements.capabilities.join(', ')}`);
    }

    // Filter out pipelines with open circuits
    const workingPipelines = compatible.filter(pipeline => 
      !state.circuitBreaker.isCircuitOpen(pipeline.name)
    );
    
    if (workingPipelines.length === 0) {
      if (state.config.fallback.enabled) {
        console.warn('All compatible pipelines have open circuits, using fallback strategy');
        return compatible.slice(0, 1); // Use first available as emergency fallback
      } else {
        throw new Error('All compatible pipelines are currently unavailable');
      }
    }

    // Score and rank pipelines
    const scored = workingPipelines
      .map(pipeline => ({
        pipeline,
        score: scorePipeline(pipeline, requirements)
      }))
      .sort((a, b) => b.score - a.score);

    // Apply strategy-specific selection
    const strategy = state.strategies.getStrategy(state.config.defaultStrategy);
    if (strategy?.selectPipelines) {
      const selectedNames = strategy.selectPipelines(workingPipelines, requirements);
      return selectedNames.map(name => workingPipelines.find(p => p.name === name)).filter(Boolean) as ReadonlyArray<Pipeline>;
    }

    // Default: return top-scored pipelines
    const maxPipelines = Math.min(
      Math.max(1, scored.length), // Ensure at least 1 if available
      state.config.performance.maxConcurrentPipelines || 3
    );
    return scored.slice(0, maxPipelines).map(s => s.pipeline);
  };

  // Analysis execution with error handling and retries
  const analyze = async (input: unknown, requirements: AnalysisRequirements = state.defaultRequirements): Promise<AnalysisResult> => {
    const startTime = Date.now();
    state.metrics.totalRequests++;

    try {
      const selectedPipelines = selectOptimalPipelines(requirements);
      
      if (selectedPipelines.length === 0) {
        throw new Error('No suitable pipelines available');
      }

      // Execute primary pipeline with circuit breaker
      const primaryPipeline = selectedPipelines[0];
      let result: AnalysisResult;
      
      try {
        result = await state.circuitBreaker.executeWithBreaker(
          primaryPipeline.name,
          () => primaryPipeline.process(input)
        );
      } catch (error) {
        // Try fallback pipelines if enabled
        if (state.config.fallback.enabled && selectedPipelines.length > 1) {
          console.warn(`Primary pipeline ${primaryPipeline.name} failed, trying fallback...`);
          
          const maxFallbacks = state.config.fallback.maxFallbacks || 2;
          for (let i = 1; i < Math.min(selectedPipelines.length, maxFallbacks + 1); i++) {
            const fallbackPipeline = selectedPipelines[i];
            
            try {
              result = await state.circuitBreaker.executeWithBreaker(
                fallbackPipeline.name,
                () => fallbackPipeline.process(input)
              );
              console.log(`✅ Fallback pipeline ${fallbackPipeline.name} succeeded`);
              break;
            } catch (fallbackError) {
              console.warn(`Fallback pipeline ${fallbackPipeline.name} also failed:`, fallbackError);
              
              if (i === Math.min(selectedPipelines.length, maxFallbacks + 1) - 1) {
                throw error; // Re-throw original error if all fallbacks failed
              }
            }
          }
        } else {
          throw error;
        }
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      updateMetrics(processingTime, true);

      return result!;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      updateMetrics(processingTime, false);
      
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error('❌ Orchestrator analysis failed:', errorMessage);
      
      return createAnalysisResult({
        status: 'failed' as const,
        error: createErrorResult(errorMessage, 'orchestrator')
      });
    }
  };

  // Metrics tracking
  const updateMetrics = (processingTime: number, success: boolean): void => {
    if (success) {
      state.metrics.successfulRequests++;
    } else {
      state.metrics.failedRequests++;
    }

    // Update average processing time (rolling window)
    const maxSamples = 100;
    const newTimes = [...state.metrics.lastProcessingTimes, processingTime];
    if (newTimes.length > maxSamples) {
      newTimes.shift();
    }
    
    state.metrics.lastProcessingTimes = newTimes;
    state.metrics.avgProcessingTime = newTimes.reduce((sum, time) => sum + time, 0) / newTimes.length;
  };

  // Status and monitoring
  const getStatus = () => ({
    pipelines: {
      total: state.pipelines.size,
      healthy: Array.from(state.pipelines.values()).filter(p => p.getStatus().healthy).length,
      initialized: Array.from(state.pipelines.values()).filter(p => p.isInitialized).length
    },
    circuitBreaker: state.circuitBreaker.getStats(),
    metrics: { ...state.metrics },
    config: state.config
  });

  const getRegisteredPipelines = (): ReadonlyArray<Pipeline> => {
    return Array.from(state.pipelines.values());
  };

  const getPipeline = (name: string): Pipeline | undefined => {
    return state.pipelines.get(name);
  };

  // Cleanup
  const cleanup = async (): Promise<void> => {
    console.log('🧹 Cleaning up orchestrator...');
    
    const cleanupPromises = Array.from(state.pipelines.values()).map(async (pipeline) => {
      try {
        await pipeline.cleanup();
      } catch (error) {
        console.error(`Error cleaning up pipeline ${pipeline.name}:`, error);
      }
    });
    
    await Promise.allSettled(cleanupPromises);
    
    state.pipelines.clear();
    state.circuitBreaker.reset();
    
    console.log('✅ Orchestrator cleanup complete');
  };

  // Parallel initialization support
  const initializeAll = async (pipelines: ReadonlyArray<Pipeline>): Promise<ReadonlyArray<{ pipeline: Pipeline; success: boolean; error?: string }>> => {
    return state.parallelInitializer.initializeAll(pipelines);
  };

  return {
    // Pipeline management
    registerPipeline,
    unregisterPipeline,
    initializeAll,
    
    // Analysis
    analyze,
    selectOptimalPipelines,
    
    // Status and monitoring
    getStatus,
    getRegisteredPipelines,
    getPipeline,
    getMetrics: () => ({ ...state.metrics }),
    
    // Configuration
    updateDefaultRequirements: (requirements: AnalysisRequirements) => {
      Object.assign(state.defaultRequirements, requirements);
    },
    
    getConfig: () => ({ ...state.config }),
    
    // Circuit breaker management
    resetCircuitBreaker: (pipelineId?: string) => state.circuitBreaker.reset(pipelineId),
    getCircuitBreakerStats: () => state.circuitBreaker.getStats(),
    
    // Cleanup
    cleanup
  };
};

// Type exports
export type Orchestrator = ReturnType<typeof createOrchestrator>;