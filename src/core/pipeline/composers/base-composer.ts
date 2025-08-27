/**
 * Base Composer Interface and Utilities
 * Common functionality shared across all composition patterns
 */

// Composition patterns enum
export enum CompositionPattern {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel', 
  CONDITIONAL = 'conditional',
  CASCADING = 'cascading',
  ADAPTIVE = 'adaptive'
}

// Execution strategies enum
export enum ExecutionStrategy {
  FAIL_FAST = 'fail_fast',
  CONTINUE_ON_ERROR = 'continue',
  BEST_EFFORT = 'best_effort',
  RETRY_ON_FAILURE = 'retry'
}

// Base interfaces
export interface ComposerConfig {
  maxConcurrentPipelines?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  defaultExecutionStrategy?: ExecutionStrategy;
  enableCaching?: boolean;
  cacheSize?: number;
  [key: string]: any;
}

export interface PipelineInfo {
  id: string;
  instance: any;
  options: any;
  metadata: {
    name?: string;
    version?: string;
    dependencies?: string[];
    timeout?: number;
    retryCount?: number;
    priority?: number;
  };
}

export interface CompositionConfig {
  id: string;
  pattern: CompositionPattern;
  strategy: ExecutionStrategy;
  options: any;
  pipelines: any;
  metadata?: any;
}

export interface ExecutionOptions {
  timeout?: number;
  strategy?: ExecutionStrategy;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: any;
  metadata: {
    executionTime: number;
    pipelinesExecuted: number;
    successfulPipelines: number;
    failedPipelines: number;
    fromCache: boolean;
    [key: string]: any;
  };
}

export interface ComposerMetrics {
  compositionsExecuted: number;
  totalExecutionTime: number;
  successfulExecutions: number;
  failedExecutions: number;
  cachedExecutions: number;
}

export interface ComposerState {
  registeredPipelines: Map<string, PipelineInfo>;
  compositions: Map<string, CompositionConfig>;
  executionCache: Map<string, any>;
  monitor: any;
  metrics: ComposerMetrics;
}

// Base composer interface that all specific composers implement
export interface BaseComposer {
  // Registration
  registerPipeline: (id: string, pipeline: any, options?: any) => void;
  
  // Composition creation  
  createComposition: (config: CompositionConfig) => CompositionConfig;
  
  // Execution
  executeComposition: (compositionId: string, input: any, options?: ExecutionOptions) => Promise<ExecutionResult>;
  
  // Management
  getComposition: (id: string) => CompositionConfig | undefined;
  removeComposition: (id: string) => boolean;
  getMetrics: () => ComposerMetrics;
  clearCache: () => void;
  cleanup: () => Promise<void>;
}

// Utility functions
export const generateCacheKey = (compositionId: string, input: any, options: ExecutionOptions = {}): string => {
  const inputHash = hashObject(input);
  const optionsHash = hashObject(options);
  return `${compositionId}:${inputHash}:${optionsHash}`;
};

export const hashObject = (obj: any): string => {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

export const executeWithTimeout = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
    )
  ]);
};

export const createEmptyMetrics = (): ComposerMetrics => ({
  compositionsExecuted: 0,
  totalExecutionTime: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  cachedExecutions: 0
});

export const createDefaultComposerConfig = (config: Partial<ComposerConfig> = {}): Required<ComposerConfig> => ({
  maxConcurrentPipelines: 4,
  defaultTimeout: 5000,
  enableMetrics: true,
  defaultExecutionStrategy: ExecutionStrategy.CONTINUE_ON_ERROR,
  enableCaching: true,
  cacheSize: 100,
  ...config
});