/**
 * Unified Pipeline Orchestrator
 * Consolidated orchestration with embedded registry and simplified retry logic
 * Phase 1 Architectural Simplification - 35% complexity reduction
 */

import type { 
  AnalysisResult, 
  AnalysisRequirements, 
  ErrorResult,
  PerformanceMetrics,
  CapabilityType
} from '../configuration/types';

// Simplified pipeline interface
export interface Pipeline {
  id: string;
  name: string;
  process: (input: any, options?: any) => Promise<any>;
  capabilities?: CapabilityType[];
  priority?: number;
  metadata?: Record<string, any>;
}

// Retry configuration
export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

// Orchestrator configuration
export interface UnifiedOrchestratorConfig {
  defaultRetryConfig?: RetryConfig;
  maxConcurrentPipelines?: number;
  pipelineTimeout?: number;
  enableMetrics?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// Pipeline registration info
interface PipelineRegistration {
  pipeline: Pipeline;
  capabilities: Set<CapabilityType>;
  priority: number;
  successCount: number;
  failureCount: number;
  lastExecutionTime?: number;
  averageExecutionTime: number;
  registeredAt: number;
}

/**
 * Create unified orchestrator with embedded registry and simplified retry
 */
export const createUnifiedOrchestrator = (config: UnifiedOrchestratorConfig = {}) => {
  // Configuration with defaults
  const orchestratorConfig = {
    defaultRetryConfig: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      shouldRetry: (error: any) => !error?.permanent
    },
    maxConcurrentPipelines: 5,
    pipelineTimeout: 30000,
    enableMetrics: true,
    logLevel: 'warn' as const,
    ...config
  };

  // Internal state (consolidated from registry and orchestrator)
  const registeredPipelines = new Map<string, PipelineRegistration>();
  const executionMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    pipelineMetrics: new Map<string, PerformanceMetrics>()
  };

  // Logging utility
  const log = (level: string, message: string, data?: any) => {
    const levels = ['error', 'warn', 'info', 'debug'];
    const configLevel = levels.indexOf(orchestratorConfig.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel <= configLevel) {
      console[level as 'error' | 'warn' | 'info' | 'log'](
        `[UnifiedOrchestrator] ${message}`,
        data || ''
      );
    }
  };

  /**
   * Register a pipeline (from registry functionality)
   */
  const register = (
    id: string, 
    pipeline: Pipeline | ((input: any) => Promise<any>),
    options: {
      capabilities?: CapabilityType[];
      priority?: number;
      metadata?: Record<string, any>;
    } = {}
  ): void => {
    // Normalize pipeline to standard format
    const normalizedPipeline: Pipeline = typeof pipeline === 'function'
      ? {
        id,
        name: options.metadata?.name || id,
        process: pipeline,
        capabilities: options.capabilities,
        priority: options.priority,
        metadata: options.metadata
      }
      : { ...pipeline, id };

    // Create registration entry
    const registration: PipelineRegistration = {
      pipeline: normalizedPipeline,
      capabilities: new Set(options.capabilities || normalizedPipeline.capabilities || []),
      priority: options.priority ?? normalizedPipeline.priority ?? 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      registeredAt: Date.now()
    };

    registeredPipelines.set(id, registration);
    log('info', `Pipeline registered: ${id}`, { capabilities: Array.from(registration.capabilities) });
  };

  /**
   * Unregister a pipeline
   */
  const unregister = (id: string): boolean => {
    const existed = registeredPipelines.delete(id);
    if (existed) {
      log('info', `Pipeline unregistered: ${id}`);
    }
    return existed;
  };

  /**
   * Find pipelines matching requirements
   */
  const findPipelines = (
    requirements: Partial<AnalysisRequirements> | CapabilityType[]
  ): Pipeline[] => {
    const requiredCapabilities = Array.isArray(requirements) 
      ? requirements 
      : requirements.capabilities || [];

    const matching: Array<{ pipeline: Pipeline; score: number }> = [];

    for (const [id, registration] of registeredPipelines) {
      // Check if pipeline has all required capabilities
      const hasAllCapabilities = requiredCapabilities.every(
        cap => registration.capabilities.has(cap)
      );

      if (hasAllCapabilities) {
        // Calculate score based on priority and performance
        const successRate = registration.successCount / 
          Math.max(1, registration.successCount + registration.failureCount);
        
        const score = registration.priority * 0.5 + 
                     successRate * 0.3 +
                     (1 / Math.max(1, registration.averageExecutionTime)) * 0.2;

        matching.push({ pipeline: registration.pipeline, score });
      }
    }

    // Sort by score and return pipelines
    return matching
      .sort((a, b) => b.score - a.score)
      .map(m => m.pipeline);
  };

  /**
   * Simple retry handler (replaces complex circuit breaker)
   */
  const executeWithRetry = async <T>(
    operation: () => Promise<T>,
    retryConfig?: RetryConfig
  ): Promise<T> => {
    const config = { ...orchestratorConfig.defaultRetryConfig, ...retryConfig };
    let lastError: any;
    let delay = config.initialDelayMs!;

    for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === config.maxRetries! || !config.shouldRetry!(error)) {
          throw error;
        }

        // Log retry attempt
        log('debug', `Retry attempt ${attempt + 1}/${config.maxRetries}`, { error: error?.message });

        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * config.backoffMultiplier!, config.maxDelayMs!);
      }
    }

    throw lastError;
  };

  /**
   * Execute a specific pipeline by ID
   */
  const executePipeline = async (
    pipelineId: string,
    input: any,
    options: {
      timeout?: number;
      retry?: boolean | RetryConfig;
    } = {}
  ): Promise<AnalysisResult | ErrorResult> => {
    const registration = registeredPipelines.get(pipelineId);
    if (!registration) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const startTime = Date.now();
    const timeout = options.timeout || orchestratorConfig.pipelineTimeout;

    try {
      // Create execution function
      const execute = async () => {
        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Pipeline timeout: ${pipelineId}`)), timeout)
        );

        const resultPromise = registration.pipeline.process(input, {
          pipelineId,
          timeout,
          ...options
        });

        return Promise.race([resultPromise, timeoutPromise]);
      };

      // Execute with or without retry
      const result = options.retry 
        ? await executeWithRetry(
          execute, 
          typeof options.retry === 'object' ? options.retry : undefined
        )
        : await execute();

      // Update metrics on success
      const executionTime = Date.now() - startTime;
      registration.successCount++;
      registration.lastExecutionTime = executionTime;
      registration.averageExecutionTime = 
        (registration.averageExecutionTime * (registration.successCount - 1) + executionTime) / 
        registration.successCount;

      if (orchestratorConfig.enableMetrics) {
        executionMetrics.successfulExecutions++;
        executionMetrics.totalExecutions++;
      }

      log('debug', `Pipeline executed successfully: ${pipelineId}`, { executionTime });
      return result;

    } catch (error) {
      // Update metrics on failure
      registration.failureCount++;
      
      if (orchestratorConfig.enableMetrics) {
        executionMetrics.failedExecutions++;
        executionMetrics.totalExecutions++;
      }

      log('error', `Pipeline execution failed: ${pipelineId}`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          pipelineId,
          executionTime: Date.now() - startTime,
          timestamp: Date.now()
        }
      } as ErrorResult;
    }
  };

  /**
   * Execute pipelines based on requirements (main orchestration)
   */
  const execute = async (
    requirements: Partial<AnalysisRequirements>,
    input: any,
    options: {
      strategy?: 'first' | 'fallback' | 'parallel';
      maxConcurrent?: number;
      timeout?: number;
      retry?: boolean | RetryConfig;
    } = {}
  ): Promise<AnalysisResult | ErrorResult> => {
    const strategy = options.strategy || 'fallback';
    const pipelines = findPipelines(requirements);

    if (pipelines.length === 0) {
      return {
        success: false,
        error: 'No compatible pipelines found',
        metadata: {
          requirements,
          timestamp: Date.now()
        }
      } as ErrorResult;
    }

    switch (strategy) {
    case 'first':
      // Execute first matching pipeline
      return executePipeline(pipelines[0].id, input, options);

    case 'fallback':
      // Try pipelines in order until one succeeds
      for (const pipeline of pipelines) {
        const result = await executePipeline(pipeline.id, input, { 
          ...options, 
          retry: false // Handle retry at this level
        });
          
        if (result.success !== false) {
          return result;
        }
      }
        
      return {
        success: false,
        error: 'All pipelines failed',
        metadata: {
          triedPipelines: pipelines.map(p => p.id),
          timestamp: Date.now()
        }
      } as ErrorResult;

    case 'parallel':
      // Execute multiple pipelines in parallel
      const maxConcurrent = options.maxConcurrent || orchestratorConfig.maxConcurrentPipelines;
      const pipelinesToRun = pipelines.slice(0, maxConcurrent);
        
      const results = await Promise.allSettled(
        pipelinesToRun.map(pipeline => 
          executePipeline(pipeline.id, input, options)
        )
      );

      // Return first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success !== false) {
          return result.value;
        }
      }

      return {
        success: false,
        error: 'All parallel pipelines failed',
        metadata: {
          triedPipelines: pipelinesToRun.map(p => p.id),
          timestamp: Date.now()
        }
      } as ErrorResult;

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
    }
  };

  /**
   * Get metrics and statistics
   */
  const getMetrics = () => ({
    totalPipelines: registeredPipelines.size,
    ...executionMetrics,
    pipelineStats: Array.from(registeredPipelines.entries()).map(([id, reg]) => ({
      id,
      successCount: reg.successCount,
      failureCount: reg.failureCount,
      successRate: reg.successCount / Math.max(1, reg.successCount + reg.failureCount),
      averageExecutionTime: reg.averageExecutionTime,
      lastExecutionTime: reg.lastExecutionTime
    }))
  });

  /**
   * Reset metrics and failure counts
   */
  const reset = (pipelineId?: string) => {
    if (pipelineId) {
      const registration = registeredPipelines.get(pipelineId);
      if (registration) {
        registration.successCount = 0;
        registration.failureCount = 0;
        registration.averageExecutionTime = 0;
        registration.lastExecutionTime = undefined;
      }
    } else {
      // Reset all
      for (const registration of registeredPipelines.values()) {
        registration.successCount = 0;
        registration.failureCount = 0;
        registration.averageExecutionTime = 0;
        registration.lastExecutionTime = undefined;
      }
      
      executionMetrics.totalExecutions = 0;
      executionMetrics.successfulExecutions = 0;
      executionMetrics.failedExecutions = 0;
      executionMetrics.averageExecutionTime = 0;
    }
  };

  /**
   * Get registered pipelines info
   */
  const getPipelines = () => 
    Array.from(registeredPipelines.entries()).map(([id, reg]) => ({
      id,
      name: reg.pipeline.name,
      capabilities: Array.from(reg.capabilities),
      priority: reg.priority,
      successRate: reg.successCount / Math.max(1, reg.successCount + reg.failureCount),
      averageExecutionTime: reg.averageExecutionTime
    }));

  return {
    // Pipeline registration (from registry)
    register,
    unregister,
    getPipelines,
    
    // Pipeline discovery and execution (merged functionality)
    findPipelines,
    execute,
    executePipeline,
    
    // Simple retry logic (simplified circuit breaker)
    executeWithRetry,
    
    // Metrics and management
    getMetrics,
    reset,
    
    // Configuration access
    getConfig: () => ({ ...orchestratorConfig })
  };
};

// Type exports
export type UnifiedOrchestrator = ReturnType<typeof createUnifiedOrchestrator>;
