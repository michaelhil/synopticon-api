/**
 * Resource Pool Configuration
 * Configuration management and validation for the resource pooling system
 */

export const createResourcePoolConfig = (config = {}) => ({
  maxCanvasElements: config.maxCanvasElements || 10,
  maxWebGLContexts: config.maxWebGLContexts || 5,
  maxImageBuffers: config.maxImageBuffers || 20,
  maxTypedArrays: config.maxTypedArrays || 50,
  enableGarbageCollection: config.enableGarbageCollection !== false,
  gcInterval: config.gcInterval || 30000, // 30 seconds
  enableMetrics: config.enableMetrics !== false,
  ...config
});

export const createResourcePoolState = (config) => ({
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