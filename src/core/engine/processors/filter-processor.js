/**
 * Image Filter Processing Module
 * Handles image filtering operations like blur, sharpen, edge detection
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js';

export const createFilterProcessor = (_resourcePool) => {
  // Common convolution kernels
  const KERNELS = {
    BLUR: [
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9]
    ],
    GAUSSIAN_BLUR: [
      [1/16, 2/16, 1/16],
      [2/16, 4/16, 2/16],
      [1/16, 2/16, 1/16]
    ],
    SHARPEN: [
      [ 0, -1,  0],
      [-1,  5, -1],
      [ 0, -1,  0]
    ],
    EDGE_DETECTION: [
      [-1, -1, -1],
      [-1,  8, -1],
      [-1, -1, -1]
    ],
    EMBOSS: [
      [-2, -1,  0],
      [-1,  1,  1],
      [ 0,  1,  2]
    ]
  };

  /**
   * Apply convolution filter to image
   */
  const applyConvolution = (imageData, kernel, factor = 1, bias = 0) => {
    try {
      const { data, width, height } = imageData;
      const outputData = new Uint8ClampedArray(data.length);
      const kernelSize = kernel.length;
      const half = Math.floor(kernelSize / 2);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = (y * width + x) * 4;
          
          // Apply kernel to RGB channels
          for (let channel = 0; channel < 3; channel++) {
            let sum = 0;
            
            for (let ky = 0; ky < kernelSize; ky++) {
              for (let kx = 0; kx < kernelSize; kx++) {
                const py = y + ky - half;
                const px = x + kx - half;
                
                // Handle edge cases by clamping
                const clampedY = Math.max(0, Math.min(height - 1, py));
                const clampedX = Math.max(0, Math.min(width - 1, px));
                const sourceIndex = (clampedY * width + clampedX) * 4 + channel;
                
                sum += data[sourceIndex] * kernel[ky][kx];
              }
            }
            
            outputData[pixelIndex + channel] = Math.max(0, Math.min(255, sum * factor + bias));
          }
          
          // Copy alpha channel unchanged
          outputData[pixelIndex + 3] = data[pixelIndex + 3];
        }
      }
      
      return new ImageData(outputData, width, height);
      
    } catch (error) {
      handleError(
        `Convolution filter failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { kernelSize: kernel.length }
      );
      throw error;
    }
  };

  /**
   * Apply Gaussian blur with variable radius
   */
  const gaussianBlur = (imageData, radius = 1) => {
    try {
      // Generate Gaussian kernel
      const size = Math.max(3, Math.ceil(radius * 2) * 2 + 1);
      const kernel = generateGaussianKernel(size, radius);
      
      return applyConvolution(imageData, kernel);
      
    } catch (error) {
      handleError(
        `Gaussian blur failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { radius }
      );
      throw error;
    }
  };

  /**
   * Generate Gaussian kernel for blur operations
   */
  const generateGaussianKernel = (size, sigma) => {
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const distanceSquared = Math.pow(x - center, 2) + Math.pow(y - center, 2);
        const value = Math.exp(-distanceSquared / (2 * sigma * sigma));
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

  /**
   * Apply predefined filter by name
   */
  const applyFilter = (imageData, filterType, intensity = 1.0) => {
    try {
      const kernel = KERNELS[filterType.toUpperCase()];
      if (!kernel) {
        throw new Error(`Unknown filter type: ${filterType}`);
      }
      
      // Scale kernel intensity
      const scaledKernel = kernel.map(row => 
        row.map(value => value * intensity)
      );
      
      return applyConvolution(imageData, scaledKernel);
      
    } catch (error) {
      handleError(
        `Filter application failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { filterType, intensity }
      );
      throw error;
    }
  };

  /**
   * Apply median filter for noise reduction
   */
  const medianFilter = (imageData, radius = 1) => {
    try {
      const { data, width, height } = imageData;
      const outputData = new Uint8ClampedArray(data.length);
      const _windowSize = radius * 2 + 1;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = (y * width + x) * 4;
          
          // Apply median filter to RGB channels
          for (let channel = 0; channel < 3; channel++) {
            const values = [];
            
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const py = Math.max(0, Math.min(height - 1, y + dy));
                const px = Math.max(0, Math.min(width - 1, x + dx));
                const sourceIndex = (py * width + px) * 4 + channel;
                values.push(data[sourceIndex]);
              }
            }
            
            values.sort((a, b) => a - b);
            const medianIndex = Math.floor(values.length / 2);
            outputData[pixelIndex + channel] = values[medianIndex];
          }
          
          // Copy alpha channel unchanged
          outputData[pixelIndex + 3] = data[pixelIndex + 3];
        }
      }
      
      return new ImageData(outputData, width, height);
      
    } catch (error) {
      handleError(
        `Median filter failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { radius }
      );
      throw error;
    }
  };

  /**
   * Apply unsharp mask for image sharpening
   */
  const unsharpMask = (imageData, amount = 1.0, radius = 1.0, threshold = 0) => {
    try {
      // Create blurred version
      const blurred = gaussianBlur(imageData, radius);
      
      const { data, width, height } = imageData;
      const blurredData = blurred.data;
      const outputData = new Uint8ClampedArray(data.length);
      
      for (let i = 0; i < data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          const original = data[i + channel];
          const blur = blurredData[i + channel];
          const difference = original - blur;
          
          // Apply threshold
          if (Math.abs(difference) >= threshold) {
            const sharpened = original + difference * amount;
            outputData[i + channel] = Math.max(0, Math.min(255, sharpened));
          } else {
            outputData[i + channel] = original;
          }
        }
        
        // Copy alpha channel
        outputData[i + 3] = data[i + 3];
      }
      
      return new ImageData(outputData, width, height);
      
    } catch (error) {
      handleError(
        `Unsharp mask failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { amount, radius, threshold }
      );
      throw error;
    }
  };

  /**
   * Apply bilateral filter for edge-preserving smoothing
   */
  const bilateralFilter = (imageData, spatialSigma = 5, colorSigma = 50) => {
    try {
      const { data, width, height } = imageData;
      const outputData = new Uint8ClampedArray(data.length);
      const radius = Math.ceil(spatialSigma * 3);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = (y * width + x) * 4;
          
          for (let channel = 0; channel < 3; channel++) {
            const centerValue = data[pixelIndex + channel];
            let weightedSum = 0;
            let normalization = 0;
            
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const py = Math.max(0, Math.min(height - 1, y + dy));
                const px = Math.max(0, Math.min(width - 1, x + dx));
                const neighborIndex = (py * width + px) * 4 + channel;
                const neighborValue = data[neighborIndex];
                
                // Spatial weight
                const spatialDistance = Math.sqrt(dx * dx + dy * dy);
                const spatialWeight = Math.exp(-(spatialDistance * spatialDistance) / (2 * spatialSigma * spatialSigma));
                
                // Color weight
                const colorDistance = Math.abs(centerValue - neighborValue);
                const colorWeight = Math.exp(-(colorDistance * colorDistance) / (2 * colorSigma * colorSigma));
                
                const totalWeight = spatialWeight * colorWeight;
                weightedSum += neighborValue * totalWeight;
                normalization += totalWeight;
              }
            }
            
            outputData[pixelIndex + channel] = Math.round(weightedSum / normalization);
          }
          
          // Copy alpha channel
          outputData[pixelIndex + 3] = data[pixelIndex + 3];
        }
      }
      
      return new ImageData(outputData, width, height);
      
    } catch (error) {
      handleError(
        `Bilateral filter failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { spatialSigma, colorSigma }
      );
      throw error;
    }
  };

  return {
    applyFilter,
    applyConvolution,
    gaussianBlur,
    medianFilter,
    unsharpMask,
    bilateralFilter,
    
    // Export available filter types
    getAvailableFilters: () => Object.keys(KERNELS),
    
    // Export kernels for advanced use
    getKernel: (filterType) => KERNELS[filterType.toUpperCase()]
  };
};