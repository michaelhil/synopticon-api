/**
 * Resource Pool Configuration
 * Configuration management and validation for the resource pooling system
 * TypeScript implementation with comprehensive type safety
 */

export interface ResourcePoolConfig {
  maxCanvasElements: number;
  maxWebGLContexts: number;
  maxImageBuffers: number;
  maxTypedArrays: number;
  enableGarbageCollection: boolean;
  gcInterval: number;
  enableMetrics: boolean;
  [key: string]: any;
}

export interface ResourcePoolMetrics {
  canvasCreated: number;
  canvasReused: number;
  contextsCreated: number;
  contextsReused: number;
  buffersCreated: number;
  buffersReused: number;
  totalAllocations: number;
  totalDeallocations: number;
  memoryPressure: number;
}

export interface ResourcePoolState {
  config: ResourcePoolConfig;
  canvasPool: HTMLCanvasElement[];
  webglContextPool: Map<string, any[]>;
  imageBufferPool: Map<string, Uint8Array[]>;
  typedArrayPool: Map<string, any[]>;
  metricsData: ResourcePoolMetrics;
  isCleanupScheduled: boolean;
  gcTimer: NodeJS.Timeout | null;
}

export const createResourcePoolConfig = (config: Partial<ResourcePoolConfig> = {}): ResourcePoolConfig => ({
  maxCanvasElements: config.maxCanvasElements || 10,
  maxWebGLContexts: config.maxWebGLContexts || 5,
  maxImageBuffers: config.maxImageBuffers || 20,
  maxTypedArrays: config.maxTypedArrays || 50,
  enableGarbageCollection: config.enableGarbageCollection !== false,
  gcInterval: config.gcInterval || 30000, // 30 seconds
  enableMetrics: config.enableMetrics !== false,
  ...config
});

export const createResourcePoolState = (config: ResourcePoolConfig): ResourcePoolState => ({
  config,
  canvasPool: [],
  webglContextPool: new Map(), // Key: context type, Value: array of contexts
  imageBufferPool: new Map(),  // Key: size, Value: array of buffers
  typedArrayPool: new Map(),   // Key: type_size, Value: array of arrays
  metricsData: {
    canvasCreated: 0,
    canvasReused: 0,
    contextsCreated: 0,
    contextsReused: 0,
    buffersCreated: 0,
    buffersReused: 0,
    totalAllocations: 0,
    totalDeallocations: 0,
    memoryPressure: 0
  },
  isCleanupScheduled: false,
  gcTimer: null
});
