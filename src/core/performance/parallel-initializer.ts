/**
 * Parallel Pipeline Initialization System - TypeScript Native
 * Handles dependency resolution and parallel initialization of multiple pipelines
 * Strict type safety for all initialization operations
 */

import type { Pipeline } from '../pipeline/pipeline';

// Pipeline dependency definitions
const PIPELINE_DEPENDENCIES: Record<string, ReadonlyArray<string>> = {
  // MediaPipe pipelines share common dependencies
  'mediapipe-face-mesh': ['mediapipe-commons'],
  'mediapipe-face': ['mediapipe-commons'], 
  'iris-tracking': ['mediapipe-commons'],
  
  // Age/Emotion analysis can depend on face detection
  'age-estimation': ['face-detection'],
  'emotion-analysis': ['face-detection'],
  
  // Eye tracking has hardware dependencies
  'eye-tracking': ['device-discovery'],
  
  // Speech analysis is independent
  'speech-analysis': []
} as const;

// Configuration interface
export interface ParallelInitializerConfig {
  readonly maxConcurrency?: number;
  readonly timeoutMs?: number;
  readonly retryAttempts?: number;
  readonly enableDependencyResolution?: boolean;
}

// Initialization result interfaces
export interface InitializationResult {
  readonly successful: ReadonlyArray<string>;
  readonly failed: ReadonlyArray<FailedInitialization>;
  readonly totalTime: number;
  readonly parallelEfficiency: number;
}

export interface FailedInitialization {
  readonly name: string;
  readonly error: string;
}

// Dependency graph interfaces
interface DependencyNode {
  readonly pipeline: Pipeline;
  readonly dependencies: ReadonlyArray<string>;
  readonly dependents: string[];
}

type DependencyGraph = ReadonlyMap<string, DependencyNode>;

// Semaphore interface
interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
}

// Internal state interface
interface InitializerState {
  readonly config: Required<ParallelInitializerConfig>;
  readonly semaphore: Semaphore;
}

/**
 * Creates a parallel pipeline initializer
 */
export const createParallelInitializer = (config: ParallelInitializerConfig = {}) => {
  const state: InitializerState = {
    config: {
      maxConcurrency: config.maxConcurrency ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
      retryAttempts: config.retryAttempts ?? 2,
      enableDependencyResolution: config.enableDependencyResolution ?? true
    },
    semaphore: createSemaphore(config.maxConcurrency ?? 3)
  };

  /**
   * Create semaphore for concurrency control
   */
  function createSemaphore(maxConcurrent: number): Semaphore {
    let current = 0;
    const queue: Array<() => void> = [];

    const acquire = (): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (current < maxConcurrent) {
          current++;
          resolve();
        } else {
          queue.push(resolve);
        }
      });
    };

    const release = (): void => {
      current--;
      if (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          current++;
          next();
        }
      }
    };

    return { acquire, release };
  }

  /**
   * Build dependency graph for pipelines
   */
  const buildDependencyGraph = (pipelines: ReadonlyArray<Pipeline>): DependencyGraph => {
    const graph = new Map<string, DependencyNode>();
    const pipelineMap = new Map(pipelines.map(p => [p.name, p]));

    for (const pipeline of pipelines) {
      const dependencies = PIPELINE_DEPENDENCIES[pipeline.name] || [];
      const resolvedDependencies: string[] = [];

      for (const depName of dependencies) {
        // Find pipelines that provide this dependency
        const dependencyProviders = pipelines.filter(p => 
          p.name === depName || 
          p.capabilities.includes(depName as any) ||
          p.name.includes(depName)
        );

        if (dependencyProviders.length > 0) {
          resolvedDependencies.push(dependencyProviders[0].name);
        } else {
          // Log missing dependency but don't fail
          console.warn(`Dependency ${depName} not found for pipeline ${pipeline.name}`);
        }
      }

      graph.set(pipeline.name, {
        pipeline,
        dependencies: resolvedDependencies,
        dependents: []
      });
    }

    // Build reverse dependencies (dependents)
    for (const [pipelineName, node] of Array.from(graph.entries())) {
      for (const depName of node.dependencies) {
        const depNode = graph.get(depName);
        if (depNode) {
          depNode.dependents.push(pipelineName);
        }
      }
    }

    return graph;
  };

  /**
   * Get pipelines that can be initialized (no pending dependencies)
   */
  const getReadyPipelines = (
    graph: DependencyGraph, 
    initialized: ReadonlySet<string>, 
    initializing: ReadonlySet<string>
  ): ReadonlyArray<Pipeline> => {
    const ready: Pipeline[] = [];

    for (const [pipelineName, node] of Array.from(graph.entries())) {
      if (initialized.has(pipelineName) || initializing.has(pipelineName)) {
        continue; // Skip already processed pipelines
      }

      // Check if all dependencies are initialized
      const dependenciesReady = node.dependencies.every(depName => 
        initialized.has(depName)
      );

      if (dependenciesReady) {
        ready.push(node.pipeline);
      }
    }

    return ready;
  };

  /**
   * Initialize a single pipeline with timeout and retry logic
   */
  const initializeSinglePipeline = async (
    pipeline: Pipeline, 
    pipelineConfig: Record<string, unknown> = {}
  ): Promise<boolean> => {
    await state.semaphore.acquire();
    
    try {
      const startTime = Date.now();
      
      console.log(`Initializing pipeline: ${pipeline.name}`);

      // Wrap initialization with timeout
      const initPromise = pipeline.initialize(pipelineConfig);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Initialization timeout for ${pipeline.name}`));
        }, state.config.timeoutMs);
      });

      await Promise.race([initPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log(`Pipeline ${pipeline.name} initialized successfully in ${duration}ms`);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Pipeline ${pipeline.name} initialization failed: ${message}`);
      throw error;
    } finally {
      state.semaphore.release();
    }
  };

  /**
   * Initialize pipelines with retry logic
   */
  const initializeWithRetry = async (
    pipeline: Pipeline, 
    pipelineConfig: Record<string, unknown>
  ): Promise<boolean> => {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= state.config.retryAttempts; attempt++) {
      try {
        await initializeSinglePipeline(pipeline, pipelineConfig);
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < state.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.warn(
            `Pipeline ${pipeline.name} initialization attempt ${attempt} failed, retrying in ${delay}ms`
          );
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError ?? new Error('Initialization failed with unknown error');
  };

  /**
   * Initialize multiple pipelines in parallel with dependency resolution
   */
  const initializeAll = async (
    pipelines: ReadonlyArray<Pipeline>
  ): Promise<ReadonlyArray<{ pipeline: Pipeline; success: boolean; error?: string }>> => {
    const results: Array<{ pipeline: Pipeline; success: boolean; error?: string }> = [];
    
    for (const pipeline of pipelines) {
      try {
        await initializeSinglePipeline(pipeline);
        results.push({ pipeline, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ pipeline, success: false, error: errorMessage });
      }
    }
    
    return results;
  };

  /**
   * Initialize multiple pipelines in parallel with dependency resolution
   */
  const initializeParallel = async (
    pipelines: ReadonlyArray<Pipeline>, 
    pipelineConfigs: Record<string, Record<string, unknown>> = {}
  ): Promise<InitializationResult> => {
    const startTime = Date.now();
    const results: {
      successful: string[];
      failed: FailedInitialization[];
      totalTime: number;
      parallelEfficiency: number;
    } = {
      successful: [],
      failed: [],
      totalTime: 0,
      parallelEfficiency: 0
    };

    if (pipelines.length === 0) {
      return results;
    }

    try {
      // Build dependency graph if enabled
      let dependencyGraph: DependencyGraph | null = null;
      if (state.config.enableDependencyResolution) {
        dependencyGraph = buildDependencyGraph(pipelines);
        console.log(`Built dependency graph for ${pipelines.length} pipelines`);
      }

      // Initialize tracking sets
      const initialized = new Set<string>();
      const initializing = new Set<string>();
      const failed = new Set<string>();
      const initPromises = new Map<string, Promise<void>>();

      // Process pipelines in dependency order if graph is available
      if (dependencyGraph) {
        while (initialized.size + failed.size < pipelines.length) {
          const readyPipelines = getReadyPipelines(dependencyGraph, initialized, initializing);
          
          if (readyPipelines.length === 0) {
            // Check if there are still pipelines initializing
            if (initializing.size === 0) {
              // Circular dependency or missing dependencies
              const remaining = pipelines.filter(p => 
                !initialized.has(p.name) && !failed.has(p.name)
              );
              
              console.error(
                `Circular dependency or missing dependencies detected for pipelines: ${remaining.map(p => p.name).join(', ')`
              );
              break;
            }
            
            // Wait for at least one pipeline to finish
            await Promise.race(Array.from(initPromises.values()));
            continue;
          }

          // Start initialization for ready pipelines
          for (const pipeline of readyPipelines) {
            initializing.add(pipeline.name);
            
            const initPromise = initializeWithRetry(
              pipeline, 
              pipelineConfigs[pipeline.name] || {}
            )
              .then(() => {
                initialized.add(pipeline.name);
                initializing.delete(pipeline.name);
                results.successful.push(pipeline.name);
                initPromises.delete(pipeline.name);
              })
              .catch((error: Error) => {
                failed.add(pipeline.name);
                initializing.delete(pipeline.name);
                results.failed.push({ name: pipeline.name, error: error.message });
                initPromises.delete(pipeline.name);
              });
            
            initPromises.set(pipeline.name, initPromise);
          }
        }

        // Wait for any remaining initializations
        if (initPromises.size > 0) {
          await Promise.allSettled(Array.from(initPromises.values()));
        }
      } else {
        // Parallel initialization without dependency resolution
        const initPromises = pipelines.map(async (pipeline) => {
          try {
            await initializeWithRetry(pipeline, pipelineConfigs[pipeline.name] || {});
            results.successful.push(pipeline.name);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.failed.push({ name: pipeline.name, error: errorMessage });
          }
        });

        await Promise.allSettled(initPromises);
      }

      const totalTime = Date.now() - startTime;
      results.totalTime = totalTime;

      // Calculate parallel efficiency (theoretical sequential time vs actual parallel time)
      const averageInitTime = totalTime / Math.max(pipelines.length, 1);
      const theoreticalSequentialTime = averageInitTime * pipelines.length;
      results.parallelEfficiency = theoreticalSequentialTime / totalTime;

      const logLevel = results.failed.length > 0 ? 'warn' : 'log';
      console[logLevel](
        `Parallel initialization completed: ${results.successful.length} successful, ${results.failed.length} failed in ${totalTime}ms (${results.parallelEfficiency.toFixed(2)}x efficiency)`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Parallel initialization system error: ${errorMessage}`);
      throw error;
    }

    return results;
  };

  const updateConfig = (updates: Partial<ParallelInitializerConfig>): void => {
    Object.assign(state.config, updates);
    if (updates.maxConcurrency !== undefined) {
      (state as any).semaphore = createSemaphore(updates.maxConcurrency);
    }
  };

  return {
    initializeAll,
    initializeParallel,
    buildDependencyGraph,
    getReadyPipelines,
    initializeSinglePipeline,
    getDependencies: (pipelineName: string): ReadonlyArray<string> => 
      PIPELINE_DEPENDENCIES[pipelineName] || [],
    getConfig: (): Required<ParallelInitializerConfig> => ({ ...state.config }),
    updateConfig
  } as const;
};

// Type exports (already declared above)
