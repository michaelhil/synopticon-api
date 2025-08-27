/**
 * Image Filter Operations
 * Optimized image filters and convolution operations
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';

export const FILTER_TYPES = {
  BLUR: 'blur',
  GAUSSIAN_BLUR: 'gaussian_blur',
  SHARPEN: 'sharpen',
  EDGE_DETECT: 'edge_detect',
  EMBOSS: 'emboss',
  NOISE_REDUCTION: 'noise_reduction',
  UNSHARP_MASK: 'unsharp_mask'
};

/**
 * Creates filter operations module
 */
export const createFilterOperations = (resourcePool, config = {}) => {
  const opConfig = {
    defaultKernelSize: config.defaultKernelSize || 3,
    enableSeparableFilters: config.enableSeparableFilters !== false,
    maxKernelSize: config.maxKernelSize || 15,
    ...config
  };

  const state = {
    metrics: {
      totalFilters: 0,
      filterUsage: {},
      avgProcessingTime: 0,
      separableOptimizations: 0
    }
  };

  // Initialize filter usage tracking
  Object.values(FILTER_TYPES).forEach(filter => {
    state.metrics.filterUsage[filter] = 0;
  });

  // Predefined convolution kernels
  const kernels = {
    blur3x3: [
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9]
    ],
    
    sharpen3x3: [
      [ 0, -1,  0],
      [-1,  5, -1],
      [ 0, -1,  0]
    ],
    
    edgeDetect3x3: [
      [-1, -1, -1],
      [-1,  8, -1],
      [-1, -1, -1]
    ],
    
    emboss3x3: [
      [-2, -1,  0],
      [-1,  1,  1],
      [ 0,  1,  2]
    ],
    
    // Sobel operators for edge detection
    sobelX: [
      [-1,  0,  1],
      [-2,  0,  2],
      [-1,  0,  1]
    ],
    
    sobelY: [
      [-1, -2, -1],
      [ 0,  0,  0],
      [ 1,  2,  1]
    ]
  };

  // Generate Gaussian kernel
  const generateGaussianKernel = (size, sigma = null) => {
    if (size % 2 === 0) size++; // Ensure odd size
    if (!sigma) sigma = size / 6; // Default sigma
    
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[y][x] = value;
        sum += value;
      }
    }
    
    // Normalize kernel
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }
    
    return kernel;
  };

  // Generate 1D Gaussian kernel for separable filtering
  const generate1DGaussianKernel = (size, sigma = null) => {
    if (size % 2 === 0) size++; // Ensure odd size
    if (!sigma) sigma = size / 6;
    
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const dx = i - center;
      const value = Math.exp(-(dx * dx) / (2 * sigma * sigma));
      kernel[i] = value;
      sum += value;
    }
    
    // Normalize kernel
    return kernel.map(v => v / sum);
  };

  // Apply convolution with kernel
  const applyConvolution = (imageData, kernel) => {
    const { data, width, height } = imageData;
    const resultData = new Uint8ClampedArray(data.length);
    
    const kernelSize = kernel.length;
    const kernelRadius = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        // Apply kernel
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx - kernelRadius));
            const pixelY = Math.min(height - 1, Math.max(0, y + ky - kernelRadius));
            
            const pixelIndex = (pixelY * width + pixelX) * 4;
            const kernelValue = kernel[ky][kx];
            
            r += data[pixelIndex] * kernelValue;
            g += data[pixelIndex + 1] * kernelValue;
            b += data[pixelIndex + 2] * kernelValue;
          }
        }
        
        const resultIndex = (y * width + x) * 4;
        resultData[resultIndex] = Math.max(0, Math.min(255, Math.round(r)));
        resultData[resultIndex + 1] = Math.max(0, Math.min(255, Math.round(g)));
        resultData[resultIndex + 2] = Math.max(0, Math.min(255, Math.round(b)));
        resultData[resultIndex + 3] = data[resultIndex + 3]; // Preserve alpha
      }
    }
    
    return new ImageData(resultData, width, height);
  };

  // Apply separable convolution (more efficient for Gaussian blur)
  const applySeparableConvolution = (imageData, kernel1D) => {
    const { data, width, height } = imageData;
    
    // First pass: horizontal
    const tempData = new Uint8ClampedArray(data.length);
    const kernelRadius = Math.floor(kernel1D.length / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let k = 0; k < kernel1D.length; k++) {
          const pixelX = Math.min(width - 1, Math.max(0, x + k - kernelRadius));
          const pixelIndex = (y * width + pixelX) * 4;
          const kernelValue = kernel1D[k];
          
          r += data[pixelIndex] * kernelValue;
          g += data[pixelIndex + 1] * kernelValue;
          b += data[pixelIndex + 2] * kernelValue;
        }
        
        const resultIndex = (y * width + x) * 4;
        tempData[resultIndex] = Math.max(0, Math.min(255, Math.round(r)));
        tempData[resultIndex + 1] = Math.max(0, Math.min(255, Math.round(g)));
        tempData[resultIndex + 2] = Math.max(0, Math.min(255, Math.round(b)));
        tempData[resultIndex + 3] = data[resultIndex + 3];
      }
    }
    
    // Second pass: vertical
    const resultData = new Uint8ClampedArray(data.length);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let k = 0; k < kernel1D.length; k++) {
          const pixelY = Math.min(height - 1, Math.max(0, y + k - kernelRadius));
          const pixelIndex = (pixelY * width + x) * 4;
          const kernelValue = kernel1D[k];
          
          r += tempData[pixelIndex] * kernelValue;
          g += tempData[pixelIndex + 1] * kernelValue;
          b += tempData[pixelIndex + 2] * kernelValue;
        }
        
        const resultIndex = (y * width + x) * 4;
        resultData[resultIndex] = Math.max(0, Math.min(255, Math.round(r)));
        resultData[resultIndex + 1] = Math.max(0, Math.min(255, Math.round(g)));
        resultData[resultIndex + 2] = Math.max(0, Math.min(255, Math.round(b)));
        resultData[resultIndex + 3] = tempData[resultIndex + 3];
      }
    }
    
    state.metrics.separableOptimizations++;
    return new ImageData(resultData, width, height);
  };

  const applyFilter = async (imageData, filterType, params = {}) => {
    const startTime = performance.now();
    
    try {
      let result;
      
      switch (filterType) {
        case FILTER_TYPES.BLUR:
          result = applyConvolution(imageData, kernels.blur3x3);
          break;
          
        case FILTER_TYPES.GAUSSIAN_BLUR:
          const blurSize = params.size || 5;
          const blurSigma = params.sigma || null;
          
          if (opConfig.enableSeparableFilters) {
            const kernel1D = generate1DGaussianKernel(blurSize, blurSigma);
            result = applySeparableConvolution(imageData, kernel1D);
          } else {
            const kernel2D = generateGaussianKernel(blurSize, blurSigma);
            result = applyConvolution(imageData, kernel2D);
          }
          break;
          
        case FILTER_TYPES.SHARPEN:
          result = applyConvolution(imageData, kernels.sharpen3x3);
          break;
          
        case FILTER_TYPES.EDGE_DETECT:
          if (params.method === 'sobel') {
            // Apply both Sobel operators and combine
            const sobelX = applyConvolution(imageData, kernels.sobelX);
            const sobelY = applyConvolution(imageData, kernels.sobelY);
            result = combineSobelResults(sobelX, sobelY);
          } else {
            result = applyConvolution(imageData, kernels.edgeDetect3x3);
          }
          break;
          
        case FILTER_TYPES.EMBOSS:
          result = applyConvolution(imageData, kernels.emboss3x3);
          break;
          
        case FILTER_TYPES.NOISE_REDUCTION:
          result = applyMedianFilter(imageData, params.size || 3);
          break;
          
        case FILTER_TYPES.UNSHARP_MASK:
          result = applyUnsharpMask(imageData, params);
          break;
          
        default:
          throw new Error(`Unknown filter type: ${filterType}`);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      state.metrics.totalFilters++;
      state.metrics.filterUsage[filterType] = (state.metrics.filterUsage[filterType] || 0) + 1;
      state.metrics.avgProcessingTime = 
        (state.metrics.avgProcessingTime * (state.metrics.totalFilters - 1) + processingTime) / 
        state.metrics.totalFilters;
      
      return result;
      
    } catch (error) {
      throw handleError(
        `Filter operation failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  // Combine Sobel X and Y results
  const combineSobelResults = (sobelX, sobelY) => {
    const { data: dataX, width, height } = sobelX;
    const { data: dataY } = sobelY;
    const resultData = new Uint8ClampedArray(dataX.length);
    
    for (let i = 0; i < dataX.length; i += 4) {
      const gx = (dataX[i] + dataX[i + 1] + dataX[i + 2]) / 3;
      const gy = (dataY[i] + dataY[i + 1] + dataY[i + 2]) / 3;
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      
      const value = Math.max(0, Math.min(255, magnitude));
      resultData[i] = value;
      resultData[i + 1] = value;
      resultData[i + 2] = value;
      resultData[i + 3] = dataX[i + 3];
    }
    
    return new ImageData(resultData, width, height);
  };

  // Median filter for noise reduction
  const applyMedianFilter = (imageData, kernelSize) => {
    const { data, width, height } = imageData;
    const resultData = new Uint8ClampedArray(data.length);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rValues = [], gValues = [], bValues = [];
        
        // Collect neighborhood values
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx));
            const ny = Math.min(height - 1, Math.max(0, y + dy));
            const idx = (ny * width + nx) * 4;
            
            rValues.push(data[idx]);
            gValues.push(data[idx + 1]);
            bValues.push(data[idx + 2]);
          }
        }
        
        // Find median values
        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);
        
        const medianIndex = Math.floor(rValues.length / 2);
        const resultIndex = (y * width + x) * 4;
        
        resultData[resultIndex] = rValues[medianIndex];
        resultData[resultIndex + 1] = gValues[medianIndex];
        resultData[resultIndex + 2] = bValues[medianIndex];
        resultData[resultIndex + 3] = data[resultIndex + 3];
      }
    }
    
    return new ImageData(resultData, width, height);
  };

  // Unsharp mask filter
  const applyUnsharpMask = (imageData, params = {}) => {
    const amount = params.amount || 1.5;
    const radius = params.radius || 1;
    const threshold = params.threshold || 0;
    
    // Create blurred version
    const kernel1D = generate1DGaussianKernel(radius * 4 + 1, radius);
    const blurred = applySeparableConvolution(imageData, kernel1D);
    
    const { data: originalData, width, height } = imageData;
    const { data: blurredData } = blurred;
    const resultData = new Uint8ClampedArray(originalData.length);
    
    for (let i = 0; i < originalData.length; i += 4) {
      for (let c = 0; c < 3; c++) { // RGB channels
        const original = originalData[i + c];
        const blur = blurredData[i + c];
        const diff = original - blur;
        
        // Apply threshold
        if (Math.abs(diff) >= threshold) {
          const sharpened = original + amount * diff;
          resultData[i + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
        } else {
          resultData[i + c] = original;
        }
      }
      resultData[i + 3] = originalData[i + 3]; // Alpha
    }
    
    return new ImageData(resultData, width, height);
  };

  const getMetrics = () => ({ ...state.metrics });

  const cleanup = async () => {
    state.metrics = {
      totalFilters: 0,
      filterUsage: {},
      avgProcessingTime: 0,
      separableOptimizations: 0
    };
    
    Object.values(FILTER_TYPES).forEach(filter => {
      state.metrics.filterUsage[filter] = 0;
    });
  };

  return {
    applyFilter,
    getMetrics,
    cleanup,
    
    // Constants
    FILTER_TYPES,
    
    // Utility functions
    generateGaussianKernel,
    generate1DGaussianKernel,
    
    // Direct kernel access
    kernels
  };
};