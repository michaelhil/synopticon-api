/**
 * Core pipeline interface and factory for face analysis systems - TypeScript Native
 * Following functional programming patterns with standardized lifecycle
 * Strict type safety for all pipeline operations
 */

import type {
  HealthStatus,
  PerformanceMetrics,
  AnalysisResult,
  AnalysisRequirements,
  ErrorResult,
  PerformanceProfile,
  CapabilityType
} from '../configuration/types';

import {
  createHealthStatus,
  createPerformanceMetrics,
  createAnalysisResult,
  createErrorResult
} from '../configuration/types';

// Pipeline configuration interface
export interface PipelineConfig {
  readonly name: string;
  readonly capabilities: ReadonlyArray<CapabilityType>;
  readonly performance: PerformanceProfile;
  readonly initialize?: (config?: Record<string, unknown>) => Promise<void>;
  readonly process: (frame: unknown) => Promise<AnalysisResult>;
  readonly cleanup?: () => Promise<void>;
  readonly version?: string;
  readonly description?: string;
}

// Pipeline state interface
interface PipelineState {
  readonly name: string;
  readonly capabilities: ReadonlyArray<CapabilityType>;
  readonly performance: PerformanceProfile;
  initialized: boolean;
  healthy: boolean;
  lastProcessTime: number;
  processedFrames: number;
  errorCount: number;
  successCount: number;
}

// Core pipeline interface - matches orchestrator expectations
export interface Pipeline {
  readonly name: string;
  readonly version: string;
  readonly capabilities: ReadonlyArray<CapabilityType>;
  readonly config: PipelineConfig;
  readonly isInitialized: boolean;
  
  // Core methods
  initialize(config?: Record<string, unknown>): Promise<boolean>;
  process(input: unknown, options?: Record<string, unknown>): Promise<AnalysisResult>;
  cleanup(): Promise<void>;
  
  // Status and metrics
  getStatus(): {
    readonly initialized: boolean;
    readonly healthy: boolean;
    readonly lastUsed: number;
    readonly processingCount: number;
  };
  
  getMetrics(): PerformanceMetrics;
  
  // Core functionality
  isCapable(requiredCapabilities: ReadonlyArray<CapabilityType>): boolean;
  supportsRealtime(): boolean;
  isHealthy(): boolean;
}

/**
 * Standard pipeline interface factory
 */
export const createPipeline = (config: PipelineConfig): Pipeline => {
  // Validate configuration
  validatePipelineConfig(config);
  
  const state: PipelineState = {
    name: config.name,
    capabilities: config.capabilities,
    performance: config.performance,
    initialized: false,
    healthy: true,
    lastProcessTime: 0,
    processedFrames: 0,
    errorCount: 0,
    successCount: 0
  };

  // Core lifecycle methods
  const initialize = async (pipelineConfig?: Record<string, unknown>): Promise<boolean> => {
    try {
      if (config.initialize) {
        await config.initialize(pipelineConfig);
      }
      state.initialized = true;
      state.healthy = true;
      return true;
    } catch (error) {
      state.healthy = false;
      state.errorCount++;
      throw error;
    }
  };

  const process = async (frame: unknown, options?: Record<string, unknown>): Promise<AnalysisResult> => {
    if (!state.initialized) {
      throw new Error(`Pipeline ${state.name} not initialized`);
    }

    const startTime = performance.now();
    
    try {
      const result = await config.process(frame);
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      state.lastProcessTime = processingTime;
      state.processedFrames++;
      state.successCount++;
      
      // Ensure result follows the AnalysisResult discriminated union structure
      if ('status' in result && 'data' in result) {
        return result as AnalysisResult;
      }
      
      return createAnalysisResult({
        status: 'success' as const,
        data: result,
        id: `${state.name}_${Date.now()}`,
        source: state.name,
        processingTime,
        timestamp: Date.now()
      });
    } catch (error) {
      state.errorCount++;
      state.healthy = state.errorCount / (state.errorCount + state.successCount) < 0.1;
      
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      return createAnalysisResult({
        status: 'failed' as const,
        error: createErrorResult(errorMessage, state.name),
        id: `${state.name}_${Date.now()}`,
        source: state.name,
        processingTime: performance.now() - startTime,
        timestamp: Date.now()
      });
    }
  };

  const cleanup = async (): Promise<void> => {
    try {
      if (config.cleanup) {
        await config.cleanup();
      }
      state.initialized = false;
    } catch (error) {
      console.warn(`Cleanup failed for pipeline ${state.name}:`, error);
      throw error;
    }
  };

  const getHealthStatus = (): HealthStatus => createHealthStatus({
    status: state.healthy ? 'healthy' : 'degraded',
    lastCheck: Date.now(),
    errorCount: state.errorCount,
    successRate: state.successCount / (state.successCount + state.errorCount) || 0,
    averageLatency: state.lastProcessTime,
    isCircuitOpen: !state.healthy
  });

  const getPerformanceMetrics = (): PerformanceMetrics => createPerformanceMetrics({
    processedFrames: state.processedFrames,
    averageProcessingTime: state.lastProcessTime,
    currentFPS: state.lastProcessTime > 0 ? 1000 / state.lastProcessTime : 0,
    timestamp: Date.now()
  });

  // Pipeline validation
  const isCapable = (requiredCapabilities: ReadonlyArray<CapabilityType>): boolean => 
    requiredCapabilities.every(cap => state.capabilities.includes(cap));

  const supportsRealtime = (): boolean => 
    state.performance.fps >= 30 && parseInt(state.performance.latency) <= 100;

  const getStatus = () => ({
    initialized: state.initialized,
    healthy: state.healthy,
    lastUsed: Date.now(),
    processingCount: state.processedFrames
  });

  const getMetrics = (): PerformanceMetrics => getPerformanceMetrics();

  return {
    // Core interface
    name: state.name,
    version: config.version ?? '1.0.0',
    capabilities: [...state.capabilities],
    config,
    
    // Status properties
    get isInitialized(): boolean {
      return state.initialized;
    },
    
    // Lifecycle methods
    initialize,
    process,
    cleanup,
    
    // Status and metrics
    getStatus,
    getMetrics,
    
    
    // Capability queries
    isCapable,
    supportsRealtime,
    
    // State queries
    isHealthy: (): boolean => state.healthy
  };
};

/**
 * Pipeline validation utilities
 */
export const validatePipelineConfig = (config: Partial<PipelineConfig>): void => {
  const required: Array<keyof PipelineConfig> = ['name', 'capabilities', 'performance', 'process'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Pipeline config missing required fields: ${missing.join(', ')`);
  }
  
  if (typeof config.process !== 'function') {
    throw new Error('Pipeline config.process must be a function');
  }
  
  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    throw new Error('Pipeline config.capabilities must be a non-empty array');
  }
};

/**
 * Pipeline capability matching utilities
 */
export const findCompatiblePipelines = (
  pipelines: ReadonlyArray<Pipeline>, 
  requirements: AnalysisRequirements
): ReadonlyArray<Pipeline> => {
  return pipelines.filter(pipeline => 
    pipeline.isCapable(requirements.capabilities) &&
    (!requirements.quality?.realtime || pipeline.supportsRealtime()) &&
    pipeline.isHealthy()
  );
};

/**
 * Pipeline scoring for selection optimization
 */
export const scorePipeline = (
  pipeline: Pipeline, 
  requirements: AnalysisRequirements
): number => {
  let score = 0;
  
  // Capability completeness (higher is better)
  const capabilityRatio = requirements.capabilities.length / pipeline.capabilities.length;
  score += capabilityRatio * 100;
  
  // Performance score based on strategy
  const strategy = requirements.strategy ?? 'balanced';
  switch (strategy) {
  case 'performance_first':
    score += pipeline.config.performance.fps || 0;
    score -= parseInt(pipeline.config.performance.latency) || 0;
    break;
  case 'accuracy_first':
    // Higher accuracy pipelines get bonus (based on model size as proxy)
    const {modelSize} = pipeline.config.performance;
    score += (modelSize === 'large' || modelSize === 'extra_large') ? 50 : 0;
    break;
  case 'battery_optimized':
    score += (pipeline.config.performance.batteryImpact === 'low') ? 100 : 0;
    score += (pipeline.config.performance.cpuUsage === 'low') ? 50 : 0;
    break;
  case 'balanced':
  default:
    // Balanced scoring
    score += (pipeline.config.performance.fps || 0) * 0.5;
    score -= (parseInt(pipeline.config.performance.latency) || 0) * 0.3;
    score += (pipeline.config.performance.batteryImpact === 'low') ? 25 : 0;
    break;
  }
  
  // Health penalty
  const healthStatus = pipeline.getHealthStatus();
  score *= healthStatus.successRate;
  
  return score;
};

// Type exports (already declared above)
