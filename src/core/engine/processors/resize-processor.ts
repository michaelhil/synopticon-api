/**
 * Image Resize Processor
 * Handles image resizing operations with multiple interpolation methods
 */

import { INTERPOLATION_METHODS, InterpolationMethod } from '../image-operations.js';
import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js';

// Type definitions
export interface ResourcePool {
  getCanvas: (width: number, height: number) => HTMLCanvasElement;
  returnCanvas: (canvas: HTMLCanvasElement) => void;
}

export interface ResizeProcessor {
  resizeImage: (imageData: ImageData, targetWidth: number, targetHeight: number, method?: InterpolationMethod) => ImageData;
  resizeWithAspectRatio: (imageData: ImageData, maxWidth: number, maxHeight: number, method?: InterpolationMethod) => ImageData;
  centerCropAndResize: (imageData: ImageData, targetWidth: number, targetHeight: number, method?: InterpolationMethod) => ImageData;
  bilinearResize: (imageData: ImageData, targetWidth: number, targetHeight: number) => ImageData;
  nearestNeighborResize: (imageData: ImageData, targetWidth: number, targetHeight: number) => ImageData;
  canvasResize: (imageData: ImageData, targetWidth: number, targetHeight: number) => ImageData;
}

export const createResizeProcessor = (resourcePool: ResourcePool): ResizeProcessor => {
  /**
   * Resize image using bilinear interpolation
   */
  const bilinearResize = (imageData: ImageData, targetWidth: number, targetHeight: number): ImageData => {
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;
    const sourceData = imageData.data;
    
    const canvas = resourcePool.getCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    const targetImageData = ctx.createImageData(targetWidth, targetHeight);
    const targetData = targetImageData.data;
    
    const xRatio = sourceWidth / targetWidth;
    const yRatio = sourceHeight / targetHeight;
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sourceX = x * xRatio;
        const sourceY = y * yRatio;
        
        const x1 = Math.floor(sourceX);
        const y1 = Math.floor(sourceY);
        const x2 = Math.min(x1 + 1, sourceWidth - 1);
        const y2 = Math.min(y1 + 1, sourceHeight - 1);
        
        const dx = sourceX - x1;
        const dy = sourceY - y1;
        
        const targetIndex = (y * targetWidth + x) * 4;
        
        for (let channel = 0; channel < 4; channel++) {
          const topLeft = sourceData[(y1 * sourceWidth + x1) * 4 + channel];
          const topRight = sourceData[(y1 * sourceWidth + x2) * 4 + channel];
          const bottomLeft = sourceData[(y2 * sourceWidth + x1) * 4 + channel];
          const bottomRight = sourceData[(y2 * sourceWidth + x2) * 4 + channel];
          
          const top = topLeft * (1 - dx) + topRight * dx;
          const bottom = bottomLeft * (1 - dx) + bottomRight * dx;
          const final = top * (1 - dy) + bottom * dy;
          
          targetData[targetIndex + channel] = Math.round(final);
        }
      }
    }
    
    resourcePool.returnCanvas(canvas);
    return targetImageData;
  };

  /**
   * Resize image using nearest neighbor interpolation
   */
  const nearestNeighborResize = (imageData: ImageData, targetWidth: number, targetHeight: number): ImageData => {
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;
    const sourceData = imageData.data;
    
    const canvas = resourcePool.getCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    const targetImageData = ctx.createImageData(targetWidth, targetHeight);
    const targetData = targetImageData.data;
    
    const xRatio = sourceWidth / targetWidth;
    const yRatio = sourceHeight / targetHeight;
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sourceX = Math.round(x * xRatio);
        const sourceY = Math.round(y * yRatio);
        
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
        const targetIndex = (y * targetWidth + x) * 4;
        
        targetData[targetIndex] = sourceData[sourceIndex];         // R
        targetData[targetIndex + 1] = sourceData[sourceIndex + 1]; // G
        targetData[targetIndex + 2] = sourceData[sourceIndex + 2]; // B
        targetData[targetIndex + 3] = sourceData[sourceIndex + 3]; // A
      }
    }
    
    resourcePool.returnCanvas(canvas);
    return targetImageData;
  };

  /**
   * Resize image using canvas built-in interpolation (fastest)
   */
  const canvasResize = (imageData: ImageData, targetWidth: number, targetHeight: number): ImageData => {
    // Create source canvas
    const sourceCanvas = resourcePool.getCanvas(imageData.width, imageData.height);
    const sourceCtx = sourceCanvas.getContext('2d')!;
    sourceCtx.putImageData(imageData, 0, 0);
    
    // Create target canvas
    const targetCanvas = resourcePool.getCanvas(targetWidth, targetHeight);
    const targetCtx = targetCanvas.getContext('2d')!;
    
    // Use canvas scaling
    targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    const result = targetCtx.getImageData(0, 0, targetWidth, targetHeight);
    
    // Clean up
    resourcePool.returnCanvas(sourceCanvas);
    resourcePool.returnCanvas(targetCanvas);
    
    return result;
  };

  /**
   * Main resize function with method selection
   */
  const resizeImage = (imageData: ImageData, targetWidth: number, targetHeight: number, method: InterpolationMethod = INTERPOLATION_METHODS.BILINEAR): ImageData => {
    try {
      if (!imageData || !imageData.data) {
        throw new Error('Invalid image data provided');
      }
      
      if (targetWidth <= 0 || targetHeight <= 0) {
        throw new Error('Target dimensions must be positive');
      }
      
      // Skip resize if dimensions match
      if (imageData.width === targetWidth && imageData.height === targetHeight) {
        return imageData;
      }
      
      switch (method) {
      case INTERPOLATION_METHODS.NEAREST:
        return nearestNeighborResize(imageData, targetWidth, targetHeight);
        
      case INTERPOLATION_METHODS.BILINEAR:
        return bilinearResize(imageData, targetWidth, targetHeight);
        
      case INTERPOLATION_METHODS.CANVAS:
      default:
        return canvasResize(imageData, targetWidth, targetHeight);
      }
      
    } catch (error) {
      handleError(
        `Image resize failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { 
          sourceSize: [imageData?.width, imageData?.height], 
          targetSize: [targetWidth, targetHeight], 
          method 
        }
      );
      throw error;
    }
  };

  /**
   * Resize with aspect ratio preservation
   */
  const resizeWithAspectRatio = (imageData: ImageData, maxWidth: number, maxHeight: number, method?: InterpolationMethod): ImageData => {
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;
    const sourceAspectRatio = sourceWidth / sourceHeight;
    const targetAspectRatio = maxWidth / maxHeight;
    
    let targetWidth: number, targetHeight: number;
    
    if (sourceAspectRatio > targetAspectRatio) {
      // Width is the limiting factor
      targetWidth = maxWidth;
      targetHeight = Math.round(maxWidth / sourceAspectRatio);
    } else {
      // Height is the limiting factor
      targetHeight = maxHeight;
      targetWidth = Math.round(maxHeight * sourceAspectRatio);
    }
    
    return resizeImage(imageData, targetWidth, targetHeight, method);
  };

  /**
   * Center crop and resize
   */
  const centerCropAndResize = (imageData: ImageData, targetWidth: number, targetHeight: number, method?: InterpolationMethod): ImageData => {
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;
    
    // Calculate crop dimensions to match target aspect ratio
    const targetAspectRatio = targetWidth / targetHeight;
    const sourceAspectRatio = sourceWidth / sourceHeight;
    
    let cropWidth: number, cropHeight: number, cropX: number, cropY: number;
    
    if (sourceAspectRatio > targetAspectRatio) {
      // Source is wider - crop width
      cropHeight = sourceHeight;
      cropWidth = Math.round(sourceHeight * targetAspectRatio);
      cropX = Math.round((sourceWidth - cropWidth) / 2);
      cropY = 0;
    } else {
      // Source is taller - crop height
      cropWidth = sourceWidth;
      cropHeight = Math.round(sourceWidth / targetAspectRatio);
      cropX = 0;
      cropY = Math.round((sourceHeight - cropHeight) / 2);
    }
    
    // First crop, then resize
    const croppedData = cropImage(imageData, cropX, cropY, cropWidth, cropHeight);
    return resizeImage(croppedData, targetWidth, targetHeight, method);
  };

  /**
   * Simple crop function for center crop and resize
   */
  const cropImage = (imageData: ImageData, x: number, y: number, width: number, height: number): ImageData => {
    const canvas = resourcePool.getCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    
    const sourceCanvas = resourcePool.getCanvas(imageData.width, imageData.height);
    const sourceCtx = sourceCanvas.getContext('2d')!;
    sourceCtx.putImageData(imageData, 0, 0);
    
    ctx.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height);
    const result = ctx.getImageData(0, 0, width, height);
    
    resourcePool.returnCanvas(canvas);
    resourcePool.returnCanvas(sourceCanvas);
    
    return result;
  };

  return {
    resizeImage,
    resizeWithAspectRatio,
    centerCropAndResize,
    
    // Export individual methods for advanced use
    bilinearResize,
    nearestNeighborResize,
    canvasResize
  };
};