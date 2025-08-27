/**
 * Image Crop Operations
 * Optimized cropping with smart region detection and validation
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';

export const CROP_MODES = {
  EXACT: 'exact',           // Exact coordinates
  CENTER: 'center',         // Center crop to dimensions
  SMART: 'smart',           // Content-aware cropping
  FACE_FOCUS: 'face_focus', // Focus on detected faces
  EDGE_AWARE: 'edge_aware'  // Crop avoiding edges
};

/**
 * Creates crop operations module
 */
export const createCropOperations = (resourcePool, config = {}) => {
  const opConfig = {
    defaultMode: config.defaultMode || CROP_MODES.EXACT,
    enableSmartCrop: config.enableSmartCrop !== false,
    edgeThreshold: config.edgeThreshold || 50,
    minCropRatio: config.minCropRatio || 0.1,
    ...config
  };

  const state = {
    metrics: {
      totalCrops: 0,
      cropModeUsage: {},
      avgProcessingTime: 0,
      smartCropHits: 0
    }
  };

  // Initialize crop mode usage tracking
  Object.values(CROP_MODES).forEach(mode => {
    state.metrics.cropModeUsage[mode] = 0;
  });

  const validateCropParams = (imageWidth, imageHeight, x, y, width, height) => {
    if (x < 0 || y < 0) {
      throw new Error('Crop coordinates cannot be negative');
    }
    
    if (width <= 0 || height <= 0) {
      throw new Error('Crop dimensions must be positive');
    }
    
    if (x + width > imageWidth || y + height > imageHeight) {
      throw new Error('Crop area extends beyond image boundaries');
    }
    
    const cropRatio = (width * height) / (imageWidth * imageHeight);
    if (cropRatio < opConfig.minCropRatio) {
      throw new Error(`Crop area too small (${(cropRatio * 100).toFixed(1)}% of image)`);
    }
  };

  const crop = async (imageData, x, y, width, height, mode = opConfig.defaultMode) => {
    const startTime = performance.now();
    
    try {
      const { data: sourceData, width: imageWidth, height: imageHeight } = imageData;
      
      let finalX = x, finalY = y, finalWidth = width, finalHeight = height;
      
      // Apply crop mode transformations
      switch (mode) {
        case CROP_MODES.EXACT:
          // Use provided coordinates as-is
          break;
          
        case CROP_MODES.CENTER:
          // Center the crop area
          finalX = Math.floor((imageWidth - width) / 2);
          finalY = Math.floor((imageHeight - height) / 2);
          break;
          
        case CROP_MODES.SMART:
          if (opConfig.enableSmartCrop) {
            const smartRegion = findSmartCropRegion(imageData, width, height);
            finalX = smartRegion.x;
            finalY = smartRegion.y;
            finalWidth = smartRegion.width;
            finalHeight = smartRegion.height;
            state.metrics.smartCropHits++;
          }
          break;
          
        case CROP_MODES.FACE_FOCUS:
          // This would integrate with face detection
          // For now, fallback to center crop
          finalX = Math.floor((imageWidth - width) / 2);
          finalY = Math.floor((imageHeight - height) / 2);
          break;
          
        case CROP_MODES.EDGE_AWARE:
          const edgeAwareRegion = findEdgeAwareCropRegion(imageData, width, height);
          finalX = edgeAwareRegion.x;
          finalY = edgeAwareRegion.y;
          break;
          
        default:
          throw new Error(`Unknown crop mode: ${mode}`);
      }
      
      // Validate final crop parameters
      validateCropParams(imageWidth, imageHeight, finalX, finalY, finalWidth, finalHeight);
      
      // Perform the crop
      const croppedData = new Uint8ClampedArray(finalWidth * finalHeight * 4);
      
      for (let cy = 0; cy < finalHeight; cy++) {
        for (let cx = 0; cx < finalWidth; cx++) {
          const sourceX = finalX + cx;
          const sourceY = finalY + cy;
          
          const sourceIndex = (sourceY * imageWidth + sourceX) * 4;
          const destIndex = (cy * finalWidth + cx) * 4;
          
          // Copy RGBA values
          croppedData[destIndex] = sourceData[sourceIndex];         // R
          croppedData[destIndex + 1] = sourceData[sourceIndex + 1]; // G
          croppedData[destIndex + 2] = sourceData[sourceIndex + 2]; // B
          croppedData[destIndex + 3] = sourceData[sourceIndex + 3]; // A
        }
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      state.metrics.totalCrops++;
      state.metrics.cropModeUsage[mode] = (state.metrics.cropModeUsage[mode] || 0) + 1;
      state.metrics.avgProcessingTime = 
        (state.metrics.avgProcessingTime * (state.metrics.totalCrops - 1) + processingTime) / 
        state.metrics.totalCrops;
      
      return new ImageData(croppedData, finalWidth, finalHeight);
      
    } catch (error) {
      throw handleError(
        `Crop operation failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  // Smart crop: find the most interesting region
  const findSmartCropRegion = (imageData, targetWidth, targetHeight) => {
    const { data, width, height } = imageData;
    
    // Calculate interest scores for different regions
    const stepX = Math.max(1, Math.floor(width / 20));
    const stepY = Math.max(1, Math.floor(height / 20));
    
    let bestScore = -1;
    let bestRegion = { x: 0, y: 0, width: targetWidth, height: targetHeight };
    
    for (let y = 0; y <= height - targetHeight; y += stepY) {
      for (let x = 0; x <= width - targetWidth; x += stepX) {
        const score = calculateInterestScore(imageData, x, y, targetWidth, targetHeight);
        
        if (score > bestScore) {
          bestScore = score;
          bestRegion = { x, y, width: targetWidth, height: targetHeight };
        }
      }
    }
    
    return bestRegion;
  };

  // Calculate interest score for a region
  const calculateInterestScore = (imageData, x, y, width, height) => {
    const { data, width: imageWidth } = imageData;
    
    let varianceSum = 0;
    let edgeCount = 0;
    let brightnessPenalty = 0;
    
    // Sample points in the region
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 10));
    const samples = [];
    
    for (let sy = y; sy < y + height; sy += sampleStep) {
      for (let sx = x; sx < x + width; sx += sampleStep) {
        const idx = (sy * imageWidth + sx) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        samples.push(brightness);
        
        // Penalty for very bright or very dark regions
        if (brightness < 20 || brightness > 235) {
          brightnessPenalty += 10;
        }
        
        // Simple edge detection
        if (sx < x + width - sampleStep && sy < y + height - sampleStep) {
          const rightIdx = (sy * imageWidth + (sx + sampleStep)) * 4;
          const bottomIdx = ((sy + sampleStep) * imageWidth + sx) * 4;
          
          const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
          const bottomBrightness = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
          
          if (Math.abs(brightness - rightBrightness) > opConfig.edgeThreshold ||
              Math.abs(brightness - bottomBrightness) > opConfig.edgeThreshold) {
            edgeCount++;
          }
        }
      }
    }
    
    // Calculate variance (measure of detail)
    if (samples.length > 1) {
      const mean = samples.reduce((sum, s) => sum + s, 0) / samples.length;
      varianceSum = samples.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / samples.length;
    }
    
    // Combine metrics into interest score
    const varianceScore = Math.min(varianceSum / 100, 100); // Cap variance contribution
    const edgeScore = Math.min(edgeCount * 5, 100); // Edge density
    const penaltyScore = Math.min(brightnessPenalty, 50); // Brightness penalty
    
    return varianceScore + edgeScore - penaltyScore;
  };

  // Edge-aware crop: avoid cropping through strong edges
  const findEdgeAwareCropRegion = (imageData, targetWidth, targetHeight) => {
    const { data, width, height } = imageData;
    
    // Find regions with minimal edge crossings at boundaries
    let bestScore = Infinity;
    let bestRegion = { x: 0, y: 0 };
    
    const stepSize = Math.max(1, Math.floor(Math.min(width, height) / 50));
    
    for (let y = 0; y <= height - targetHeight; y += stepSize) {
      for (let x = 0; x <= width - targetWidth; x += stepSize) {
        const edgeScore = calculateBoundaryEdgeScore(imageData, x, y, targetWidth, targetHeight);
        
        if (edgeScore < bestScore) {
          bestScore = edgeScore;
          bestRegion = { x, y };
        }
      }
    }
    
    return bestRegion;
  };

  // Calculate edge crossings at crop boundaries
  const calculateBoundaryEdgeScore = (imageData, x, y, width, height) => {
    const { data, width: imageWidth } = imageData;
    
    let edgeScore = 0;
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 20));
    
    // Check top and bottom boundaries
    for (let sx = x; sx < x + width; sx += sampleStep) {
      // Top boundary
      if (y > 0) {
        const topIdx = ((y - 1) * imageWidth + sx) * 4;
        const insideIdx = (y * imageWidth + sx) * 4;
        const topBrightness = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
        const insideBrightness = (data[insideIdx] + data[insideIdx + 1] + data[insideIdx + 2]) / 3;
        edgeScore += Math.abs(topBrightness - insideBrightness);
      }
      
      // Bottom boundary
      if (y + height < imageWidth) {
        const bottomIdx = ((y + height) * imageWidth + sx) * 4;
        const insideIdx = ((y + height - 1) * imageWidth + sx) * 4;
        const bottomBrightness = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
        const insideBrightness = (data[insideIdx] + data[insideIdx + 1] + data[insideIdx + 2]) / 3;
        edgeScore += Math.abs(bottomBrightness - insideBrightness);
      }
    }
    
    // Check left and right boundaries
    for (let sy = y; sy < y + height; sy += sampleStep) {
      // Left boundary
      if (x > 0) {
        const leftIdx = (sy * imageWidth + (x - 1)) * 4;
        const insideIdx = (sy * imageWidth + x) * 4;
        const leftBrightness = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
        const insideBrightness = (data[insideIdx] + data[insideIdx + 1] + data[insideIdx + 2]) / 3;
        edgeScore += Math.abs(leftBrightness - insideBrightness);
      }
      
      // Right boundary
      if (x + width < imageWidth) {
        const rightIdx = (sy * imageWidth + (x + width)) * 4;
        const insideIdx = (sy * imageWidth + (x + width - 1)) * 4;
        const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
        const insideBrightness = (data[insideIdx] + data[insideIdx + 1] + data[insideIdx + 2]) / 3;
        edgeScore += Math.abs(rightBrightness - insideBrightness);
      }
    }
    
    return edgeScore;
  };

  // Utility function to auto-detect crop bounds
  const detectCropBounds = (imageData, threshold = 10) => {
    const { data, width, height } = imageData;
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasContent = false;
    
    // Scan for non-background content
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        // Consider pixel as content if it's not near white or black
        if (brightness > threshold && brightness < 255 - threshold) {
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    return hasContent ? {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    } : {
      x: 0,
      y: 0,
      width,
      height
    };
  };

  const getMetrics = () => ({ ...state.metrics });

  const cleanup = async () => {
    state.metrics = {
      totalCrops: 0,
      cropModeUsage: {},
      avgProcessingTime: 0,
      smartCropHits: 0
    };
    
    Object.values(CROP_MODES).forEach(mode => {
      state.metrics.cropModeUsage[mode] = 0;
    });
  };

  return {
    crop,
    detectCropBounds,
    getMetrics,
    cleanup,
    
    // Constants
    CROP_MODES,
    
    // Utility functions
    calculateInterestScore,
    findSmartCropRegion
  };
};