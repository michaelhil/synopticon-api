/**
 * Shared Image Processing Utilities
 * Provides optimized image processing functions used across all pipelines
 * Eliminates duplicate image processing code and improves performance
 */

import { getGlobalResourcePool } from '../performance/resource-pool.js';
import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';
import { createImageOperations, IMAGE_FORMATS, INTERPOLATION_METHODS } from './image-operations.js';
import { createProcessingCache } from './image-processing-cache.js';

/**
 * Creates an optimized image processor with shared utilities
 * @param {Object} config - Processor configuration
 * @returns {Object} - Image processor instance
 */
export const createImageProcessor = (config = {}) => {
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
  const state = {
    metrics: {
      processedFrames: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
  };
  
  // Wrapper functions that integrate caching and metrics
  const processWithCache = async (operation, params, processFn) => {
    const startTime = performance.now();
    
    // Try cache first
    const cached = cache.getCached(operation, params);
    if (cached) {
      cache.recordProcessingTime(startTime, performance.now());
      return cached;
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
  
  const resize = async (imageData, targetWidth, targetHeight, method) => {
    return processWithCache(
      'resize', 
      { width: targetWidth, height: targetHeight, method },
      () => operations.resizeImage(imageData, targetWidth, targetHeight, method || processorConfig.defaultInterpolation)
    );
  };
  
  const convert = async (imageData, fromFormat, toFormat) => {
    return processWithCache(
      'convert',
      { fromFormat, toFormat },
      () => operations.convertColorSpace(imageData, fromFormat, toFormat)
    );
  };
  
  const crop = async (imageData, x, y, width, height) => {
    return processWithCache(
      'crop',
      { x, y, width, height },
      () => operations.cropImage(imageData, x, y, width, height)
    );
  };
  
  const filter = async (imageData, filterType, intensity) => {
    return processWithCache(
      'filter',
      { filterType, intensity },
      () => operations.applyFilter(imageData, filterType, intensity)
    );
  };
  
  /**
   * Preprocesses image data for pipeline consumption
   * @param {ImageData|HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} input - Input image
   * @param {Object} options - Processing options
   * @returns {ImageData} - Processed image data
   */
  const preprocessImage = (input, options = {}) => {
    const startTime = performance.now();
    
    try {
      const opts = {
        targetSize: options.targetSize || [224, 224],
        format: options.format || 'RGBA',
        normalize: options.normalize !== false,
        interpolation: options.interpolation || processorConfig.defaultInterpolation,
        centerCrop: options.centerCrop !== false,
        ...options
      };
      
      // Generate cache key if caching enabled
      let cacheKey = null;
      if (processorConfig.enableCaching && input.src) {
        cacheKey = `preprocess_${input.src}_${JSON.stringify(opts)}`;
        const cached = state.cache.get(cacheKey);
        if (cached) {
          state.metrics.cacheHits++;
          updateMetrics(startTime);
          return cached;
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
      if (opts.format !== 'RGBA') {
        imageData = convertImageFormat(imageData, opts.format);
      }
      
      // Normalize pixel values if requested
      if (opts.normalize) {
        imageData = normalizeImage(imageData);
      }
      
      // Cache result if enabled
      if (cacheKey && processorConfig.enableCaching) {
        if (state.cache.size >= processorConfig.cacheSize) {
          // Remove oldest entry
          const firstKey = state.cache.keys().next().value;
          state.cache.delete(firstKey);
        }
        state.cache.set(cacheKey, imageData);
        state.metrics.cacheMisses++;
      }
      
      updateMetrics(startTime);
      return imageData;
      
    } catch (error) {
      handleError(
        `Image preprocessing failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { options }
      );
      throw error;
    }
  };
  
  /**
   * Extracts face region from image data
   * @param {ImageData} imageData - Source image data
   * @param {Object} boundingBox - Face bounding box {x, y, width, height}
   * @param {Object} options - Extraction options
   * @returns {ImageData} - Extracted face region
   */
  const extractFaceRegion = (imageData, boundingBox, options = {}) => {
    try {
      const opts = {
        padding: options.padding || 0.1, // 10% padding around face
        minSize: options.minSize || [64, 64],
        maxSize: options.maxSize || [512, 512],
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
      
      // Create temporary canvas with original image
      const sourceCanvas = resourcePool.getCanvas(imageData.width, imageData.height);
      const sourceCtx = sourceCanvas.getContext('2d');
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
        `Face region extraction failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { boundingBox, options }
      );
      throw error;
    }
  };
  
  /**
   * Resizes image data to target dimensions
   * @param {ImageData} imageData - Source image data
   * @param {number} targetWidth - Target width
   * @param {number} targetHeight - Target height
   * @param {string} interpolation - Interpolation method
   * @returns {ImageData} - Resized image data
   */
  const resizeImage = (imageData, targetWidth, targetHeight, interpolation = INTERPOLATION_METHODS.BILINEAR) => {
    try {
      const canvas = resourcePool.getCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      
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
        `Image resizing failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { sourceSize: [imageData.width, imageData.height], targetSize: [targetWidth, targetHeight] }
      );
      throw error;
    }
  };
  
  /**
   * Center crops image to target dimensions
   * @param {ImageData} imageData - Source image data
   * @param {number} targetWidth - Target width
   * @param {number} targetHeight - Target height
   * @returns {ImageData} - Cropped image data
   */
  const centerCropImage = (imageData, targetWidth, targetHeight) => {
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
      
      // Create source canvas
      const sourceCanvas = resourcePool.getCanvas(sourceWidth, sourceHeight);
      const sourceCtx = sourceCanvas.getContext('2d');
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
        `Image center cropping failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { sourceSize: [imageData.width, imageData.height], targetSize: [targetWidth, targetHeight] }
      );
      throw error;
    }
  };
  
  /**
   * Converts image format (RGBA -> RGB, etc.)
   * @param {ImageData} imageData - Source image data
   * @param {string} targetFormat - Target format
   * @returns {ImageData|Uint8Array} - Converted image data
   */
  const convertImageFormat = (imageData, targetFormat) => {
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
        `Image format conversion failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { targetFormat }
      );
      throw error;
    }
  };
  
  /**
   * Normalizes image pixel values to 0-1 range
   * @param {ImageData|Object} imageData - Image data
   * @returns {Object} - Normalized image data
   */
  const normalizeImage = (imageData) => {
    try {
      const {data} = imageData;
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
        `Image normalization failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR
      );
      throw error;
    }
  };
  
  /**
   * Extracts ImageData from various input types
   * @param {ImageData|HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} input - Input source
   * @returns {ImageData} - Extracted image data
   */
  const extractImageData = (input) => {
    try {
      if (input instanceof ImageData) {
        return input;
      }
      
      let canvas, ctx;
      
      if (input instanceof HTMLCanvasElement) {
        canvas = input;
        ctx = canvas.getContext('2d');
      } else {
        // Create canvas for other input types
        canvas = resourcePool.getCanvas(input.width || input.videoWidth, input.height || input.videoHeight);
        ctx = canvas.getContext('2d');
        ctx.drawImage(input, 0, 0);
      }
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Return canvas to pool if we created it
      if (!(input instanceof HTMLCanvasElement)) {
        resourcePool.returnCanvas(canvas);
      }
      
      return imageData;
      
    } catch (error) {
      handleError(
        `Failed to extract image data: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { inputType: input.constructor.name }
      );
      throw error;
    }
  };
  
  /**
   * Normalizes bounding box coordinates
   * @param {Object} bbox - Bounding box
   * @param {number} imageWidth - Image width
   * @param {number} imageHeight - Image height
   * @returns {Object} - Normalized bounding box
   */
  const normalizeBoundingBox = (bbox, imageWidth, imageHeight) => {
    return {
      x: Math.max(0, Math.floor(bbox.x * imageWidth)),
      y: Math.max(0, Math.floor(bbox.y * imageHeight)),
      width: Math.min(imageWidth, Math.ceil(bbox.width * imageWidth)),
      height: Math.min(imageHeight, Math.ceil(bbox.height * imageHeight))
    };
  };
  
  /**
   * Adds padding to bounding box
   * @param {Object} bbox - Bounding box
   * @param {number} padding - Padding factor (0-1)
   * @param {number} imageWidth - Image width
   * @param {number} imageHeight - Image height
   * @returns {Object} - Padded bounding box
   */
  const addPaddingToBbox = (bbox, padding, imageWidth, imageHeight) => {
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
   * @param {number} startTime - Processing start time
   */
  const updateMetrics = (startTime) => {
    if (!processorConfig.enableMetrics) return;
    
    const processingTime = performance.now() - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = state.metrics.totalProcessingTime / state.metrics.processedFrames;
  };
  
  /**
   * Gets processing metrics
   * @returns {Object} - Metrics data
   */
  const getMetrics = () => {
    if (!processorConfig.enableMetrics) {
      return { enabled: false };
    }
    
    return {
      ...state.metrics,
      cacheEfficiency: state.metrics.cacheHits / (state.metrics.cacheHits + state.metrics.cacheMisses),
      cacheSize: state.cache.size,
      enabled: true
    };
  };
  
  /**
   * Clears processing cache and resets metrics
   */
  const cleanup = () => {
    cache.clear();
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

// Export default processor factory for convenience
