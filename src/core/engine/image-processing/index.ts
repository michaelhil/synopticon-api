/**
 * Modular Image Processing System
 * Composed from specialized processing modules
 */

import { getGlobalResourcePool } from '../../performance/resource-pool.js';
import { createProcessingCache } from '../image-processing-cache.js';
import { createImageOperations } from '../image-operations.js';
import { createImageTransformations } from './transformations.js';
import { createImageUtils } from './utils.js';
import { createFaceExtractor } from './face-extractor.js';
import { IMAGE_FORMATS, INTERPOLATION_METHODS } from '../image-operations.js';

import type { 
  ImageProcessor,
  ImageProcessorConfig,
  ProcessingMetrics,
  ProcessedImageData,
  BoundingBox,
  PreprocessOptions,
  ExtractionOptions,
  ProcessingContext,
  ProcessorState
} from './types.js';

export * from './types.js';
export { validateBoundingBox, calculateBboxArea, bboxesIntersect, calculateIoU } from './utils.js';
export { calculateOptimalCrop } from './face-extractor.js';

/**
 * Create the main image processor with modular components
 */
export const createImageProcessor = (config: ImageProcessorConfig = {}): ImageProcessor => {
  const resourcePool = config.resourcePool || getGlobalResourcePool();
  const processorConfig = {
    defaultInterpolation: config.defaultInterpolation || INTERPOLATION_METHODS.BILINEAR,
    enableCaching: config.enableCaching !== false,
    cacheSize: config.cacheSize || 50,
    enableMetrics: config.enableMetrics !== false,
    ...config
  };
  
  const cache = createProcessingCache(processorConfig);
  const operations = createImageOperations(resourcePool);
  
  // Processing state and metrics
  const state: ProcessorState = {
    metrics: {
      processedFrames: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
  };
  
  // Initialize cache if caching is enabled
  if (processorConfig.enableCaching) {
    state.cache = new Map();
  }
  
  // Create processing context
  const context: ProcessingContext = {
    resourcePool,
    cache,
    state,
    config: processorConfig as Required<ImageProcessorConfig>
  };
  
  // Create specialized modules
  const transformations = createImageTransformations(context);
  const utils = createImageUtils(context);
  const faceExtractor = createFaceExtractor(context);
  
  /**
   * Preprocess image for pipeline consumption
   */
  const preprocessImage = (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    options: PreprocessOptions = {}
  ): ProcessedImageData => {
    const startTime = performance.now();
    
    try {
      const opts = {
        targetSize: options.targetSize || [224, 224] as [number, number],
        format: options.format || 'RGBA',
        normalize: options.normalize !== false,
        interpolation: options.interpolation || processorConfig.defaultInterpolation,
        centerCrop: options.centerCrop !== false,
        ...options
      };
      
      // Generate cache key if caching enabled
      let cacheKey: string | null = null;
      if (processorConfig.enableCaching && 'src' in input && input.src) {
        cacheKey = `preprocess_${input.src}_${JSON.stringify(opts)}`;
        const cached = state.cache?.get(cacheKey);
        if (cached) {
          state.metrics.cacheHits++;
          updateMetrics(startTime);
          return cached as ProcessedImageData;
        }
      }
      
      // Extract image data from various input types
      let imageData = utils.extractImageData(input);
      
      // Resize image if needed
      if (opts.targetSize && 
          (imageData.width !== opts.targetSize[0] || imageData.height !== opts.targetSize[1])) {
        imageData = transformations.resize(imageData, opts.targetSize[0], opts.targetSize[1], opts.interpolation);
      }
      
      // Center crop if enabled
      if (opts.centerCrop) {
        imageData = transformations.crop(imageData, opts.targetSize[0], opts.targetSize[1]);
      }
      
      // Convert format if needed
      let processedData: ProcessedImageData | ImageData = imageData;
      if (opts.format !== 'RGBA') {
        processedData = transformations.convert(imageData, opts.format);
      }
      
      // Normalize pixel values if requested
      if (opts.normalize) {
        processedData = transformations.normalize(processedData);
      }
      
      // Cache result if enabled
      if (cacheKey && processorConfig.enableCaching && state.cache) {
        if (state.cache.size >= processorConfig.cacheSize) {
          // Remove oldest entry (simple LRU)
          const firstKey = state.cache.keys().next().value;
          if (firstKey) {
            state.cache.delete(firstKey);
          }
        }
        state.cache.set(cacheKey, processedData);
        state.metrics.cacheMisses++;
      }
      
      updateMetrics(startTime);
      return processedData as ProcessedImageData;
      
    } catch (error) {
      updateMetrics(startTime);
      throw error;
    }
  };
  
  /**
   * Update processing metrics
   */
  const updateMetrics = (startTime: number): void => {
    if (!processorConfig.enableMetrics) return;
    
    const processingTime = performance.now() - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = state.metrics.totalProcessingTime / state.metrics.processedFrames;
  };
  
  /**
   * Get processing metrics
   */
  const getMetrics = (): ProcessingMetrics => {
    if (!processorConfig.enableMetrics) {
      return { 
        processedFrames: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        enabled: false 
      };
    }
    
    return {
      ...state.metrics,
      cacheEfficiency: state.metrics.cacheHits / (state.metrics.cacheHits + state.metrics.cacheMisses) || 0,
      cacheSize: state.cache?.size || 0,
      enabled: true
    };
  };
  
  /**
   * Cleanup resources and cache
   */
  const cleanup = (): void => {
    cache.clearCache();
    state.cache?.clear();
    
    // Reset metrics
    state.metrics = {
      processedFrames: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  };
  
  return {
    // Main preprocessing
    preprocessImage,
    
    // Delegation to specialized modules
    extractFaceRegion: faceExtractor.extractFaceRegion,
    resizeImage: transformations.resize,
    centerCropImage: transformations.crop,
    convertImageFormat: transformations.convert,
    normalizeImage: transformations.normalize,
    extractImageData: utils.extractImageData,
    normalizeBoundingBox: utils.normalizeBoundingBox,
    addPaddingToBbox: utils.addPaddingToBbox,
    
    // Management functions
    getMetrics,
    cleanup,
    
    // Constants (maintained for backwards compatibility)
    IMAGE_FORMATS,
    INTERPOLATION_METHODS
  };
};

// Re-export constants for convenience
export { IMAGE_FORMATS, INTERPOLATION_METHODS };