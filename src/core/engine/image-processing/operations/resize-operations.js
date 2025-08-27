/**
 * Image Resize Operations
 * Optimized resize algorithms with multiple interpolation methods
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';

export const INTERPOLATION_METHODS = {
  NEAREST: 'nearest',
  BILINEAR: 'bilinear',
  BICUBIC: 'bicubic',
  LANCZOS: 'lanczos'
};

/**
 * Creates resize operations module
 */
export const createResizeOperations = (resourcePool, config = {}) => {
  const opConfig = {
    defaultMethod: config.defaultInterpolation || INTERPOLATION_METHODS.BILINEAR,
    enableGPUAcceleration: config.enableGPUAcceleration || false,
    preserveAspectRatio: config.preserveAspectRatio || false,
    ...config
  };

  const state = {
    metrics: {
      totalResizes: 0,
      avgProcessingTime: 0,
      methodUsage: {}
    }
  };

  // Initialize method usage tracking
  Object.values(INTERPOLATION_METHODS).forEach(method => {
    state.metrics.methodUsage[method] = 0;
  });

  const validateDimensions = (width, height, targetWidth, targetHeight) => {
    if (!width || !height || !targetWidth || !targetHeight) {
      throw new Error('Invalid dimensions provided');
    }
    
    if (width <= 0 || height <= 0 || targetWidth <= 0 || targetHeight <= 0) {
      throw new Error('Dimensions must be positive numbers');
    }
    
    if (targetWidth > 8192 || targetHeight > 8192) {
      throw new Error('Target dimensions exceed maximum supported size (8192x8192)');
    }
  };

  const calculateAspectRatio = (width, height, targetWidth, targetHeight) => {
    if (!opConfig.preserveAspectRatio) {
      return { width: targetWidth, height: targetHeight };
    }

    const aspectRatio = width / height;
    const targetAspectRatio = targetWidth / targetHeight;

    if (aspectRatio > targetAspectRatio) {
      // Image is wider than target
      return {
        width: targetWidth,
        height: Math.round(targetWidth / aspectRatio)
      };
    } else {
      // Image is taller than target
      return {
        width: Math.round(targetHeight * aspectRatio),
        height: targetHeight
      };
    }
  };

  // Nearest neighbor interpolation (fastest)
  const resizeNearest = (imageData, targetWidth, targetHeight) => {
    const { data, width, height } = imageData;
    const targetData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

    const xRatio = width / targetWidth;
    const yRatio = height / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);
        
        const srcIndex = (srcY * width + srcX) * 4;
        const destIndex = (y * targetWidth + x) * 4;
        
        targetData[destIndex] = data[srcIndex];         // R
        targetData[destIndex + 1] = data[srcIndex + 1]; // G
        targetData[destIndex + 2] = data[srcIndex + 2]; // B
        targetData[destIndex + 3] = data[srcIndex + 3]; // A
      }
    }

    return new ImageData(targetData, targetWidth, targetHeight);
  };

  // Bilinear interpolation (good quality/speed balance)
  const resizeBilinear = (imageData, targetWidth, targetHeight) => {
    const { data, width, height } = imageData;
    const targetData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

    const xRatio = (width - 1) / targetWidth;
    const yRatio = (height - 1) / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;
        
        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        const x2 = Math.min(x1 + 1, width - 1);
        const y2 = Math.min(y1 + 1, height - 1);
        
        const xWeight = srcX - x1;
        const yWeight = srcY - y1;
        
        const destIndex = (y * targetWidth + x) * 4;
        
        // Bilinear interpolation for each channel
        for (let c = 0; c < 4; c++) {
          const tl = data[(y1 * width + x1) * 4 + c]; // Top-left
          const tr = data[(y1 * width + x2) * 4 + c]; // Top-right
          const bl = data[(y2 * width + x1) * 4 + c]; // Bottom-left
          const br = data[(y2 * width + x2) * 4 + c]; // Bottom-right
          
          const top = tl * (1 - xWeight) + tr * xWeight;
          const bottom = bl * (1 - xWeight) + br * xWeight;
          const result = top * (1 - yWeight) + bottom * yWeight;
          
          targetData[destIndex + c] = Math.round(result);
        }
      }
    }

    return new ImageData(targetData, targetWidth, targetHeight);
  };

  // Bicubic interpolation (highest quality, slower)
  const resizeBicubic = (imageData, targetWidth, targetHeight) => {
    const { data, width, height } = imageData;
    const targetData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

    const xRatio = width / targetWidth;
    const yRatio = height / targetHeight;

    // Bicubic kernel function
    const bicubicKernel = (t) => {
      const a = -0.5;
      const absT = Math.abs(t);
      
      if (absT <= 1) {
        return (a + 2) * Math.pow(absT, 3) - (a + 3) * Math.pow(absT, 2) + 1;
      } else if (absT <= 2) {
        return a * Math.pow(absT, 3) - 5 * a * Math.pow(absT, 2) + 8 * a * absT - 4 * a;
      }
      return 0;
    };

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;
        
        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        
        const destIndex = (y * targetWidth + x) * 4;
        
        // Bicubic interpolation for each channel
        for (let c = 0; c < 4; c++) {
          let result = 0;
          let weightSum = 0;
          
          // Sample 4x4 neighborhood
          for (let dy = -1; dy <= 2; dy++) {
            for (let dx = -1; dx <= 2; dx++) {
              const sampleX = Math.max(0, Math.min(width - 1, x1 + dx));
              const sampleY = Math.max(0, Math.min(height - 1, y1 + dy));
              
              const weight = bicubicKernel(srcX - sampleX) * bicubicKernel(srcY - sampleY);
              const sample = data[(sampleY * width + sampleX) * 4 + c];
              
              result += weight * sample;
              weightSum += weight;
            }
          }
          
          targetData[destIndex + c] = Math.max(0, Math.min(255, Math.round(result / Math.max(weightSum, 1e-8))));
        }
      }
    }

    return new ImageData(targetData, targetWidth, targetHeight);
  };

  // Main resize function with method selection
  const resize = async (imageData, targetWidth, targetHeight, method = opConfig.defaultMethod) => {
    const startTime = performance.now();
    
    try {
      validateDimensions(imageData.width, imageData.height, targetWidth, targetHeight);
      
      // Adjust dimensions if preserving aspect ratio
      const adjustedDimensions = calculateAspectRatio(
        imageData.width, 
        imageData.height, 
        targetWidth, 
        targetHeight
      );
      
      const finalWidth = adjustedDimensions.width;
      const finalHeight = adjustedDimensions.height;
      
      // Skip processing if dimensions are the same
      if (imageData.width === finalWidth && imageData.height === finalHeight) {
        return imageData;
      }

      let result;
      
      // Select resize algorithm
      switch (method) {
        case INTERPOLATION_METHODS.NEAREST:
          result = resizeNearest(imageData, finalWidth, finalHeight);
          break;
        case INTERPOLATION_METHODS.BILINEAR:
          result = resizeBilinear(imageData, finalWidth, finalHeight);
          break;
        case INTERPOLATION_METHODS.BICUBIC:
          result = resizeBicubic(imageData, finalWidth, finalHeight);
          break;
        case INTERPOLATION_METHODS.LANCZOS:
          // Fallback to bicubic for now (Lanczos requires more complex implementation)
          result = resizeBicubic(imageData, finalWidth, finalHeight);
          break;
        default:
          throw new Error(`Unknown interpolation method: ${method}`);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      state.metrics.totalResizes++;
      state.metrics.avgProcessingTime = 
        (state.metrics.avgProcessingTime * (state.metrics.totalResizes - 1) + processingTime) / 
        state.metrics.totalResizes;
      state.metrics.methodUsage[method] = (state.metrics.methodUsage[method] || 0) + 1;
      
      return result;
      
    } catch (error) {
      throw handleError(
        `Resize operation failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  // Utility functions
  const getOptimalMethod = (sourceSize, targetSize, qualityPreference = 'balanced') => {
    const scaleFactor = Math.min(targetSize.width / sourceSize.width, targetSize.height / sourceSize.height);
    
    // Choose method based on scale factor and quality preference
    if (qualityPreference === 'speed') {
      return INTERPOLATION_METHODS.NEAREST;
    } else if (qualityPreference === 'quality') {
      return scaleFactor < 0.5 ? INTERPOLATION_METHODS.BICUBIC : INTERPOLATION_METHODS.BILINEAR;
    } else { // balanced
      return scaleFactor > 2 || scaleFactor < 0.5 ? INTERPOLATION_METHODS.BILINEAR : INTERPOLATION_METHODS.BILINEAR;
    }
  };

  const calculateOptimalDimensions = (sourceWidth, sourceHeight, maxWidth, maxHeight, preserveAspect = true) => {
    if (!preserveAspect) {
      return { width: maxWidth, height: maxHeight };
    }

    const aspectRatio = sourceWidth / sourceHeight;
    
    if (sourceWidth > sourceHeight) {
      return {
        width: Math.min(maxWidth, sourceWidth),
        height: Math.min(maxHeight, Math.round(Math.min(maxWidth, sourceWidth) / aspectRatio))
      };
    } else {
      return {
        width: Math.min(maxWidth, Math.round(Math.min(maxHeight, sourceHeight) * aspectRatio)),
        height: Math.min(maxHeight, sourceHeight)
      };
    }
  };

  const getMetrics = () => ({ ...state.metrics });

  const cleanup = async () => {
    // Reset metrics
    state.metrics = {
      totalResizes: 0,
      avgProcessingTime: 0,
      methodUsage: {}
    };
    
    Object.values(INTERPOLATION_METHODS).forEach(method => {
      state.metrics.methodUsage[method] = 0;
    });
  };

  return {
    resize,
    getOptimalMethod,
    calculateOptimalDimensions,
    getMetrics,
    cleanup,
    
    // Constants
    INTERPOLATION_METHODS,
    
    // Individual algorithm access (for advanced usage)
    algorithms: {
      nearest: resizeNearest,
      bilinear: resizeBilinear,
      bicubic: resizeBicubic
    }
  };
};