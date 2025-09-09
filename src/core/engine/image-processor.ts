/**
 * Shared Image Processing Utilities
 * Provides optimized image processing functions used across all pipelines
 * Eliminates duplicate image processing code and improves performance
 */

import { getGlobalResourcePool } from '../performance/resource-pool.js';
import type { ResourcePool } from '../performance/resource-pool.js';
import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js';
import { IMAGE_FORMATS, INTERPOLATION_METHODS, createImageOperations } from './image-operations.js';
import type { ImageOperations } from './image-operations.js';
import { createProcessingCache } from './image-processing-cache.js';
import type { ProcessingCache, CacheMetrics } from './image-processing-cache.js';

export interface ImageProcessorConfig {
  resourcePool?: ResourcePool;
  defaultInterpolation?: string;
  enableCaching?: boolean;
  cacheSize?: number;
  enableMetrics?: boolean;
  [key: string]: unknown;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreprocessOptions {
  targetSize?: [number, number];
  format?: string;
  normalize?: boolean;
  interpolation?: string;
  centerCrop?: boolean;
  [key: string]: unknown;
}

export interface ExtractionOptions {
  padding?: number;
  minSize?: [number, number];
  maxSize?: [number, number];
  maintainAspectRatio?: boolean;
  targetSize?: [number, number];
  [key: string]: unknown;
}

export interface ProcessedImageData {
  data: Uint8Array | Float32Array | Uint8ClampedArray;
  width: number;
  height: number;
  format?: string;
  normalized?: boolean;
  [key: string]: unknown;
}

export interface ProcessingMetrics {
  processedFrames: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  cacheEfficiency?: number;
  cacheSize?: number;
  enabled: boolean;
}

export interface ImageProcessor {
  preprocessImage: (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    options?: PreprocessOptions
  ) => ProcessedImageData;
  extractFaceRegion: (
    imageData: ImageData,
    boundingBox: BoundingBox,
    options?: ExtractionOptions
  ) => ImageData;
  resizeImage: (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    interpolation?: string
  ) => ImageData;
  centerCropImage: (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ) => ImageData;
  convertImageFormat: (
    imageData: ImageData,
    targetFormat: string
  ) => ProcessedImageData | ImageData;
  normalizeImage: (
    imageData: ImageData | ProcessedImageData
  ) => ProcessedImageData;
  extractImageData: (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
  ) => ImageData;
  normalizeBoundingBox: (
    bbox: BoundingBox,
    imageWidth: number,
    imageHeight: number
  ) => BoundingBox;
  addPaddingToBbox: (
    bbox: BoundingBox,
    padding: number,
    imageWidth: number,
    imageHeight: number
  ) => BoundingBox;
  getMetrics: () => ProcessingMetrics;
  cleanup: () => void;
  IMAGE_FORMATS: typeof IMAGE_FORMATS;
  INTERPOLATION_METHODS: typeof INTERPOLATION_METHODS;
}

interface ProcessorState {
  metrics: {
    processedFrames: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    cacheHits: number;
    cacheMisses: number;
  };
  cache?: Map<string, unknown>;
}

type ProcessFunction<T> = () => Promise<T>;

/**
 * Creates an optimized image processor with shared utilities
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
  
  // Wrapper functions that integrate caching and metrics
  const processWithCache = async <T>(
    operation: string, 
    params: Record<string, unknown>, 
    processFn: ProcessFunction<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    // Try cache first
    const cached = cache.getCached(operation, params);
    if (cached) {
      cache.recordProcessingTime(startTime, performance.now());
      return cached as T;
    }
    
    // Process and cache result
    try {
      const result = await processFn();
      cache.setCached(operation, params, result);
      cache.recordProcessingTime(startTime, performance.now());
      return result;
    } catch (error) {
      cache.recordProcessingTime(startTime, performance.now());
      throw error;
    }
  };
  
  const _resize = async (imageData: ImageData, targetWidth: number, targetHeight: number, method?: string): Promise<ImageData> => {
    return processWithCache(
      'resize', 
      { width: targetWidth, height: targetHeight, method },
      () => Promise.resolve(operations.resizeImage(imageData, targetWidth, targetHeight, method || processorConfig.defaultInterpolation))
    );
  };
  
  const _convert = async (imageData: ImageData, fromFormat: string, toFormat: string): Promise<ProcessedImageData | ImageData> => {
    return processWithCache(
      'convert',
      { fromFormat, toFormat },
      () => Promise.resolve(operations.convertColorSpace(imageData, fromFormat, toFormat))
    );
  };
  
  const _crop = async (imageData: ImageData, x: number, y: number, width: number, height: number): Promise<ImageData> => {
    return processWithCache(
      'crop',
      { x, y, width, height },
      () => Promise.resolve(operations.cropImage(imageData, x, y, width, height))
    );
  };
  
  const _filter = async (imageData: ImageData, filterType: string, intensity: number): Promise<ImageData> => {
    return processWithCache(
      'filter',
      { filterType, intensity },
      () => Promise.resolve(operations.applyFilter(imageData, filterType, intensity))
    );
  };
  
  /**
   * Preprocesses image data for pipeline consumption
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
      let imageData = extractImageData(input);
      
      // Resize image if needed
      if (opts.targetSize && 
          (imageData.width !== opts.targetSize[0] || imageData.height !== opts.targetSize[1])) {
        imageData = resizeImage(imageData, opts.targetSize[0], opts.targetSize[1], opts.interpolation);
      }
      
      // Center crop if enabled and aspect ratios don't match
      if (opts.centerCrop) {
        imageData = centerCropImage(imageData, opts.targetSize[0], opts.targetSize[1]);
      }
      
      // Convert format if needed
      let processedData: ProcessedImageData | ImageData = imageData;
      if (opts.format !== 'RGBA') {
        processedData = convertImageFormat(imageData, opts.format);
      }
      
      // Normalize pixel values if requested
      if (opts.normalize) {
        processedData = normalizeImage(processedData);
      }
      
      // Cache result if enabled
      if (cacheKey && processorConfig.enableCaching && state.cache) {
        if (state.cache.size >= processorConfig.cacheSize) {
          // Remove oldest entry
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
      handleError(
        `Image preprocessing failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { options }
      );
      throw error;
    }
  };
  
  /**
   * Extracts face region from image data
   */
  const extractFaceRegion = (
    imageData: ImageData, 
    boundingBox: BoundingBox, 
    options: ExtractionOptions = {}
  ): ImageData => {
    try {
      const opts = {
        padding: options.padding || 0.1, // 10% padding around face
        minSize: options.minSize || [64, 64] as [number, number],
        maxSize: options.maxSize || [512, 512] as [number, number],
        maintainAspectRatio: options.maintainAspectRatio !== false,
        ...options
      };
      
      // Normalize bounding box coordinates
      const bbox = normalizeBoundingBox(boundingBox, imageData.width, imageData.height);
      
      // Apply padding
      const paddedBbox = addPaddingToBbox(bbox, opts.padding, imageData.width, imageData.height);
      
      // Extract region using canvas
      const canvas = resourcePool.getCanvas(paddedBbox.width, paddedBbox.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Create temporary canvas with original image
      const sourceCanvas = resourcePool.getCanvas(imageData.width, imageData.height);
      const sourceCtx = sourceCanvas.getContext('2d');
      if (!sourceCtx) {
        throw new Error('Failed to get source canvas context');
      }
      sourceCtx.putImageData(imageData, 0, 0);
      
      // Draw face region
      ctx.drawImage(
        sourceCanvas,
        paddedBbox.x, paddedBbox.y, paddedBbox.width, paddedBbox.height,
        0, 0, paddedBbox.width, paddedBbox.height
      );
      
      const faceData = ctx.getImageData(0, 0, paddedBbox.width, paddedBbox.height);
      
      // Clean up resources
      resourcePool.returnCanvas(canvas);
      resourcePool.returnCanvas(sourceCanvas);
      
      // Resize to target size if specified
      if (opts.targetSize) {
        return resizeImage(faceData, opts.targetSize[0], opts.targetSize[1]);
      }
      
      return faceData;
      
    } catch (error) {
      handleError(
        `Face region extraction failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { boundingBox, options }
      );
      throw error;
    }
  };
  
  /**
   * Resizes image data to target dimensions
   */
  const resizeImage = (
    imageData: ImageData, 
    targetWidth: number, 
    targetHeight: number, 
    interpolation: string = INTERPOLATION_METHODS.BILINEAR
  ): ImageData => {
    try {
      const canvas = resourcePool.getCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Set interpolation quality
      switch (interpolation) {
        case INTERPOLATION_METHODS.NEAREST:
          ctx.imageSmoothingEnabled = false;
          break;
        case INTERPOLATION_METHODS.BILINEAR:
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          break;
        case INTERPOLATION_METHODS.BICUBIC:
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          break;
      }
      
      // Create source canvas
      const sourceCanvas = resourcePool.getCanvas(imageData.width, imageData.height);
      const sourceCtx = sourceCanvas.getContext('2d');
      if (!sourceCtx) {
        throw new Error('Failed to get source canvas context');
      }
      sourceCtx.putImageData(imageData, 0, 0);
      
      // Draw resized image
      ctx.drawImage(sourceCanvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);
      
      const resizedData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      
      // Clean up resources
      resourcePool.returnCanvas(canvas);
      resourcePool.returnCanvas(sourceCanvas);
      
      return resizedData;
      
    } catch (error) {
      handleError(
        `Image resizing failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { sourceSize: [imageData.width, imageData.height], targetSize: [targetWidth, targetHeight] }
      );
      throw error;
    }
  };
  
  /**
   * Center crops image to target dimensions
   */
  const centerCropImage = (
    imageData: ImageData, 
    targetWidth: number, 
    targetHeight: number
  ): ImageData => {
    try {
      const sourceWidth = imageData.width;
      const sourceHeight = imageData.height;
      
      // Calculate crop area
      const cropWidth = Math.min(sourceWidth, targetWidth);
      const cropHeight = Math.min(sourceHeight, targetHeight);
      const cropX = Math.floor((sourceWidth - cropWidth) / 2);
      const cropY = Math.floor((sourceHeight - cropHeight) / 2);
      
      const canvas = resourcePool.getCanvas(cropWidth, cropHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Create source canvas
      const sourceCanvas = resourcePool.getCanvas(sourceWidth, sourceHeight);
      const sourceCtx = sourceCanvas.getContext('2d');
      if (!sourceCtx) {
        throw new Error('Failed to get source canvas context');
      }
      sourceCtx.putImageData(imageData, 0, 0);
      
      // Draw cropped region
      ctx.drawImage(
        sourceCanvas,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      
      const croppedData = ctx.getImageData(0, 0, cropWidth, cropHeight);
      
      // Clean up resources
      resourcePool.returnCanvas(canvas);
      resourcePool.returnCanvas(sourceCanvas);
      
      return croppedData;
      
    } catch (error) {
      handleError(
        `Image center cropping failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { sourceSize: [imageData.width, imageData.height], targetSize: [targetWidth, targetHeight] }
      );
      throw error;
    }
  };
  
  /**
   * Converts image format (RGBA -> RGB, etc.)
   */
  const convertImageFormat = (
    imageData: ImageData, 
    targetFormat: string
  ): ProcessedImageData | ImageData => {
    try {
      const targetFormatInfo = IMAGE_FORMATS[targetFormat];
      
      if (!targetFormatInfo) {
        throw new Error(`Unsupported target format: ${targetFormat}`);
      }
      
      const sourceData = imageData.data;
      const pixelCount = imageData.width * imageData.height;
      const targetBuffer = resourcePool.getImageBuffer(
        imageData.width, 
        imageData.height, 
        targetFormatInfo.channels
      );
      
      switch (targetFormat) {
        case 'RGB':
          for (let i = 0; i < pixelCount; i++) {
            const sourceIdx = i * 4;
            const targetIdx = i * 3;
            targetBuffer[targetIdx] = sourceData[sourceIdx];     // R
            targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
            targetBuffer[targetIdx + 2] = sourceData[sourceIdx + 2]; // B
          }
          break;
            
        case 'BGR':
          for (let i = 0; i < pixelCount; i++) {
            const sourceIdx = i * 4;
            const targetIdx = i * 3;
            targetBuffer[targetIdx] = sourceData[sourceIdx + 2]; // B
            targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
            targetBuffer[targetIdx + 2] = sourceData[sourceIdx];     // R
          }
          break;
            
        case 'GRAYSCALE':
          for (let i = 0; i < pixelCount; i++) {
            const sourceIdx = i * 4;
            const gray = Math.round(
              0.299 * sourceData[sourceIdx] +     // R
                0.587 * sourceData[sourceIdx + 1] + // G
                0.114 * sourceData[sourceIdx + 2]   // B
            );
            targetBuffer[i] = gray;
          }
          break;
            
        case 'RGBA':
        default:
          return imageData;
      }
      
      return {
        data: targetBuffer,
        width: imageData.width,
        height: imageData.height,
        format: targetFormat
      };
      
    } catch (error) {
      handleError(
        `Image format conversion failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { targetFormat }
      );
      throw error;
    }
  };
  
  /**
   * Normalizes image pixel values to 0-1 range
   */
  const normalizeImage = (imageData: ImageData | ProcessedImageData): ProcessedImageData => {
    try {
      const { data } = imageData;
      const normalizedData = new Float32Array(data.length);
      
      for (let i = 0; i < data.length; i++) {
        normalizedData[i] = data[i] / 255.0;
      }
      
      return {
        ...imageData,
        data: normalizedData,
        normalized: true
      };
      
    } catch (error) {
      handleError(
        `Image normalization failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR
      );
      throw error;
    }
  };
  
  /**
   * Extracts ImageData from various input types
   */
  const extractImageData = (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
  ): ImageData => {
    try {
      if (input instanceof ImageData) {
        return input;
      }
      
      let canvas: HTMLCanvasElement;
      let ctx: CanvasRenderingContext2D | null;
      
      if (input instanceof HTMLCanvasElement) {
        canvas = input;
        ctx = canvas.getContext('2d');
      } else {
        // Create canvas for other input types
        const width = 'width' in input ? input.width : (input as HTMLVideoElement).videoWidth;
        const height = 'height' in input ? input.height : (input as HTMLVideoElement).videoHeight;
        canvas = resourcePool.getCanvas(width, height);
        ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(input, 0, 0);
        }
      }
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Return canvas to pool if we created it
      if (!(input instanceof HTMLCanvasElement)) {
        resourcePool.returnCanvas(canvas);
      }
      
      return imageData;
      
    } catch (error) {
      handleError(
        `Failed to extract image data: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { inputType: input.constructor.name }
      );
      throw error;
    }
  };
  
  /**
   * Normalizes bounding box coordinates
   */
  const normalizeBoundingBox = (
    bbox: BoundingBox, 
    imageWidth: number, 
    imageHeight: number
  ): BoundingBox => {
    return {
      x: Math.max(0, Math.floor(bbox.x * imageWidth)),
      y: Math.max(0, Math.floor(bbox.y * imageHeight)),
      width: Math.min(imageWidth, Math.ceil(bbox.width * imageWidth)),
      height: Math.min(imageHeight, Math.ceil(bbox.height * imageHeight))
    };
  };
  
  /**
   * Adds padding to bounding box
   */
  const addPaddingToBbox = (
    bbox: BoundingBox, 
    padding: number, 
    imageWidth: number, 
    imageHeight: number
  ): BoundingBox => {
    const padX = Math.floor(bbox.width * padding);
    const padY = Math.floor(bbox.height * padding);
    
    return {
      x: Math.max(0, bbox.x - padX),
      y: Math.max(0, bbox.y - padY),
      width: Math.min(imageWidth - Math.max(0, bbox.x - padX), bbox.width + 2 * padX),
      height: Math.min(imageHeight - Math.max(0, bbox.y - padY), bbox.height + 2 * padY)
    };
  };
  
  /**
   * Updates processing metrics
   */
  const updateMetrics = (startTime: number): void => {
    if (!processorConfig.enableMetrics) return;
    
    const processingTime = performance.now() - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = state.metrics.totalProcessingTime / state.metrics.processedFrames;
  };
  
  /**
   * Gets processing metrics
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
   * Clears processing cache and resets metrics
   */
  const cleanup = (): void => {
    cache.clearCache();
    state.cache?.clear();
  };
  
  return {
    // Core processing functions
    preprocessImage,
    extractFaceRegion,
    resizeImage,
    centerCropImage,
    convertImageFormat,
    normalizeImage,
    extractImageData,
    
    // Utility functions
    normalizeBoundingBox,
    addPaddingToBbox,
    
    // Management functions
    getMetrics,
    cleanup,
    
    // Constants
    IMAGE_FORMATS,
    INTERPOLATION_METHODS
  };
};

// Export format constants for external use
export { IMAGE_FORMATS, INTERPOLATION_METHODS };