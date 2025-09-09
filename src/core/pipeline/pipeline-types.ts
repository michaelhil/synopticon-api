/**
 * Pipeline System Type Definitions
 * TypeScript interfaces for lazy pipeline registry and related components
 */

// Pipeline factory function type
export type PipelineFactory<T = any> = (config?: any) => T;

// Pipeline module interface
export interface PipelineModule {
  [key: string]: PipelineFactory | any;
}

// Pipeline loader function type
export type PipelineLoader = () => Promise<PipelineModule>;

// Pipeline factory extractor function type
export type FactoryExtractor = (module: PipelineModule) => PipelineFactory;

// Pipeline types enum
export type PipelineType = 
  | 'mediapipe-face'
  | 'mediapipe-face-mesh'
  | 'emotion-analysis'
  | 'age-estimation'
  | 'iris-tracking'
  | 'eye-tracking'
  | 'webcam-eye-tracking'
  | 'neon-eye-tracking';

// Registry configuration interface
export interface LazyPipelineRegistryConfig {
  maxRetries: number;
  retryDelay: number;
  cacheSize: number;
  preloadCritical: boolean;
  enableMetrics: boolean;
  timeout: number;
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'failed';

// Loading state info interface
export interface LoadingStateInfo {
  type: PipelineType;
  state: LoadingState;
  timestamp: number | null;
  startTime?: number;
  loadTime?: number;
  attempt?: number;
  error?: string;
  success?: boolean;
}

// Failed load info interface
export interface FailedLoadInfo {
  error: Error;
  timestamp: number;
  attempts: number;
}

// Registry metrics interface
export interface PipelineRegistryMetrics {
  totalLoads: number;
  successfulLoads: number;
  failedLoads: number;
  cacheHits: number;
  cacheMisses: number;
  uniqueLoads: number;
  loadFailures: number;
  averageLoadTime: number;
  cacheHitRate: number;
  loadTimes: number[];
}

// Preload results interface
export interface PreloadResults {
  successful: PipelineType[];
  failed: Array<{ type: PipelineType; error: string }>;
  totalTime: number;
}

// Registry state interface
export interface RegistryState {
  config: LazyPipelineRegistryConfig;
  loadedPipelines: Map<PipelineType, PipelineFactory>;
  loadingPromises: Map<PipelineType, Promise<PipelineFactory>>;
  failedLoads: Map<PipelineType, FailedLoadInfo>;
  loadingStates: Map<PipelineType, LoadingStateInfo>;
  metrics: PipelineRegistryMetrics;
}

// Registry interface
export interface LazyPipelineRegistry {
  loadPipeline: (pipelineType: PipelineType) => Promise<PipelineFactory>;
  preloadCriticalPipelines: (criticalTypes?: PipelineType[]) => Promise<PreloadResults>;
  getLoadingState: (pipelineType: PipelineType) => LoadingStateInfo;
  isPipelineLoaded: (pipelineType: PipelineType) => boolean;
  clearCache: () => void;
  clearFailedLoads: () => void;
  getMetrics: () => PipelineRegistryMetrics;
  getAvailablePipelines: () => PipelineType[];
  getCachedPipelines: () => PipelineType[];
  getFailedPipelines: () => Array<{ type: PipelineType; info: FailedLoadInfo }>;
}
