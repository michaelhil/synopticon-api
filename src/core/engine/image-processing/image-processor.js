/**
 * Main Image Processor Factory
 * Provides optimized image processing with pluggable operations and caching
 * Eliminates duplicate image processing code and improves performance
 */

import { getGlobalResourcePool } from '../../performance/resource-pool.js';
import { handleError, ErrorCategory, ErrorSeverity } from '../../../shared/utils/error-handler.js';
import { createResizeOperations } from './operations/resize-operations.js';
import { createColorOperations } from './operations/color-operations.js';
import { createFilterOperations } from './operations/filter-operations.js';
import { createCropOperations } from './operations/crop-operations.js';
import { createProcessingCache } from './cache/processing-cache.js';
import { createBatchProcessor } from './optimization/batch-processor.js';
import { createMemoryOptimizer } from './optimization/memory-optimizer.js';

/**
 * Creates an optimized image processor with modular operations
 * @param {Object} config - Processor configuration
 * @returns {Object} - Image processor instance
 */
export const createImageProcessor = (config = {}) => {
  const resourcePool = config.resourcePool || getGlobalResourcePool();
  const processorConfig = {
    defaultInterpolation: config.defaultInterpolation || 'bilinear',
    enableCaching: config.enableCaching !== false,
    cacheSize: config.cacheSize || 50,
    enableMetrics: config.enableMetrics !== false,
    enableBatching: config.enableBatching !== false,
    batchSize: config.batchSize || 10,
    enableMemoryOptimization: config.enableMemoryOptimization !== false,
    ...config
  };
  
  // Initialize modular components
  const cache = processorConfig.enableCaching ? createProcessingCache(processorConfig) : null;
  const batchProcessor = processorConfig.enableBatching ? createBatchProcessor(processorConfig) : null;
  const memoryOptimizer = processorConfig.enableMemoryOptimization ? createMemoryOptimizer(processorConfig) : null;
  
  // Create operation modules with shared resource pool
  const resizeOps = createResizeOperations(resourcePool, processorConfig);
  const colorOps = createColorOperations(resourcePool, processorConfig);
  const filterOps = createFilterOperations(resourcePool, processorConfig);
  const cropOps = createCropOperations(resourcePool, processorConfig);
  
  // Processing state and metrics
  const state = {
    metrics: {
      processedFrames: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchedOperations: 0,
      memoryOptimizations: 0
    }
  };
  
  // Enhanced wrapper for processing with caching, batching, and metrics
  const processWithEnhancements = async (operation, params, processFn) => {
    const startTime = performance.now();
    
    try {
      // Try cache first if enabled
      if (cache) {
        const cached = cache.getCached(operation, params);
        if (cached) {
          state.metrics.cacheHits++;
          updateMetrics(startTime);
          return cached;
        }
        state.metrics.cacheMisses++;
      }
      
      // Check if operation can be batched
      if (batchProcessor && batchProcessor.canBatch(operation, params)) {
        const result = await batchProcessor.addToBatch(operation, params, processFn);
        if (result) {
          state.metrics.batchedOperations++;
          updateMetrics(startTime);
          if (cache) cache.setCached(operation, params, result);
          return result;
        }
      }
      
      // Process individually
      const result = await processFn();
      
      // Cache result if enabled
      if (cache) {
        cache.setCached(operation, params, result);
      }
      
      // Memory optimization if enabled
      if (memoryOptimizer && memoryOptimizer.shouldOptimize()) {
        memoryOptimizer.optimizeMemory();
        state.metrics.memoryOptimizations++;
      }
      
      updateMetrics(startTime);
      return result;
      
    } catch (error) {
      updateMetrics(startTime);
      throw handleError(
        `Image processing failed for ${operation}: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };
  
  const updateMetrics = (startTime) => {
    const processingTime = performance.now() - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = state.metrics.totalProcessingTime / state.metrics.processedFrames;
  };
  
  // Main processing operations
  const resize = async (imageData, targetWidth, targetHeight, method) => {
    return processWithEnhancements(
      'resize', 
      { width: targetWidth, height: targetHeight, method: method || processorConfig.defaultInterpolation },
      () => resizeOps.resize(imageData, targetWidth, targetHeight, method)
    );
  };
  
  const convert = async (imageData, fromFormat, toFormat) => {
    return processWithEnhancements(
      'convert',
      { fromFormat, toFormat },
      () => colorOps.convertColorSpace(imageData, fromFormat, toFormat)
    );
  };
  
  const crop = async (imageData, x, y, width, height) => {
    return processWithEnhancements(
      'crop',
      { x, y, width, height },
      () => cropOps.crop(imageData, x, y, width, height)
    );
  };
  
  const applyFilter = async (imageData, filterType, params = {}) => {
    return processWithEnhancements(
      'filter',
      { filterType, ...params },
      () => filterOps.applyFilter(imageData, filterType, params)
    );
  };
  
  const normalize = async (imageData) => {
    return processWithEnhancements(
      'normalize',
      {},
      () => colorOps.normalize(imageData)
    );
  };
  
  const adjustBrightness = async (imageData, factor) => {
    return processWithEnhancements(
      'brightness',
      { factor },
      () => colorOps.adjustBrightness(imageData, factor)
    );
  };
  
  const adjustContrast = async (imageData, factor) => {
    return processWithEnhancements(
      'contrast',
      { factor },
      () => colorOps.adjustContrast(imageData, factor)
    );
  };
  
  // Batch processing interface
  const processBatch = async (operations) => {
    if (!batchProcessor) {
      // Process individually if batching disabled
      const results = [];
      for (const op of operations) {
        const result = await processOperation(op);
        results.push(result);
      }
      return results;
    }
    
    return await batchProcessor.processBatch(operations);
  };
  
  // Single operation processor for batch interface
  const processOperation = async (operation) => {
    const { type, imageData, params } = operation;
    
    switch (type) {
      case 'resize':
        return await resize(imageData, params.width, params.height, params.method);
      case 'convert':
        return await convert(imageData, params.fromFormat, params.toFormat);
      case 'crop':
        return await crop(imageData, params.x, params.y, params.width, params.height);
      case 'filter':
        return await applyFilter(imageData, params.filterType, params.filterParams);
      case 'normalize':
        return await normalize(imageData);
      case 'brightness':
        return await adjustBrightness(imageData, params.factor);
      case 'contrast':
        return await adjustContrast(imageData, params.factor);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  };
  
  // Metrics and diagnostics
  const getMetrics = () => {
    const metrics = { ...state.metrics };
    
    if (cache) {
      const cacheMetrics = cache.getMetrics();
      Object.assign(metrics, cacheMetrics);
    }
    
    if (batchProcessor) {
      const batchMetrics = batchProcessor.getMetrics();
      Object.assign(metrics, batchMetrics);
    }
    
    if (memoryOptimizer) {
      const memoryMetrics = memoryOptimizer.getMetrics();
      Object.assign(metrics, memoryMetrics);
    }
    
    return metrics;
  };
  
  const getStats = () => ({
    ...getMetrics(),
    cacheEnabled: !!cache,
    batchingEnabled: !!batchProcessor,
    memoryOptimizationEnabled: !!memoryOptimizer,
    config: processorConfig
  });
  
  // Resource cleanup
  const cleanup = async () => {
    if (cache?.cleanup) await cache.cleanup();
    if (batchProcessor?.cleanup) await batchProcessor.cleanup();
    if (memoryOptimizer?.cleanup) await memoryOptimizer.cleanup();
    if (resizeOps?.cleanup) await resizeOps.cleanup();
    if (colorOps?.cleanup) await colorOps.cleanup();
    if (filterOps?.cleanup) await filterOps.cleanup();
    if (cropOps?.cleanup) await cropOps.cleanup();
  };
  
  return {
    // Core operations
    resize,
    convert,
    crop,
    applyFilter,
    normalize,
    adjustBrightness,
    adjustContrast,
    
    // Batch processing
    processBatch,
    processOperation,
    
    // Utilities
    getMetrics,
    getStats,
    cleanup,
    
    // Component access for advanced usage
    operations: {
      resize: resizeOps,
      color: colorOps,
      filter: filterOps,
      crop: cropOps
    },
    
    cache,
    batchProcessor,
    memoryOptimizer
  };
};