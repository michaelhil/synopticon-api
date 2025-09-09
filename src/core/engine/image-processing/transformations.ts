/**
 * Image Transformations
 * Core image transformation operations
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js';
import { IMAGE_FORMATS, INTERPOLATION_METHODS } from '../image-operations.js';
import type { 
  ImageTransformations, 
  ProcessedImageData, 
  ProcessingContext 
} from './types.js';

/**
 * Create image transformations module
 */
export const createImageTransformations = (context: ProcessingContext): ImageTransformations => {
  const { resourcePool, config } = context;
  
  /**
   * Resize image to target dimensions
   */
  const resize = (
    imageData: ImageData, 
    targetWidth: number, 
    targetHeight: number, 
    interpolation: string = config.defaultInterpolation || INTERPOLATION_METHODS.BILINEAR
  ): ImageData => {
    try {
      const canvas = resourcePool.getCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Set interpolation quality
      setInterpolationQuality(ctx, interpolation);
      
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
   * Center crop image to target dimensions
   */
  const crop = (
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
   * Convert image format (RGBA -> RGB, etc.)
   */
  const convert = (
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
          convertToRGB(sourceData, targetBuffer, pixelCount);
          break;
          
        case 'BGR':
          convertToBGR(sourceData, targetBuffer, pixelCount);
          break;
          
        case 'GRAYSCALE':
          convertToGrayscale(sourceData, targetBuffer, pixelCount);
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
   * Normalize image pixel values to 0-1 range
   */
  const normalize = (imageData: ImageData | ProcessedImageData): ProcessedImageData => {
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
  
  return {
    resize,
    crop,
    convert,
    normalize
  };
};

/**
 * Set canvas interpolation quality
 */
function setInterpolationQuality(ctx: CanvasRenderingContext2D, interpolation: string): void {
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
}

/**
 * Convert RGBA to RGB
 */
function convertToRGB(sourceData: Uint8ClampedArray, targetBuffer: Uint8Array, pixelCount: number): void {
  for (let i = 0; i < pixelCount; i++) {
    const sourceIdx = i * 4;
    const targetIdx = i * 3;
    targetBuffer[targetIdx] = sourceData[sourceIdx];     // R
    targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
    targetBuffer[targetIdx + 2] = sourceData[sourceIdx + 2]; // B
  }
}

/**
 * Convert RGBA to BGR
 */
function convertToBGR(sourceData: Uint8ClampedArray, targetBuffer: Uint8Array, pixelCount: number): void {
  for (let i = 0; i < pixelCount; i++) {
    const sourceIdx = i * 4;
    const targetIdx = i * 3;
    targetBuffer[targetIdx] = sourceData[sourceIdx + 2]; // B
    targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
    targetBuffer[targetIdx + 2] = sourceData[sourceIdx];     // R
  }
}

/**
 * Convert RGBA to Grayscale
 */
function convertToGrayscale(sourceData: Uint8ClampedArray, targetBuffer: Uint8Array, pixelCount: number): void {
  for (let i = 0; i < pixelCount; i++) {
    const sourceIdx = i * 4;
    const gray = Math.round(
      0.299 * sourceData[sourceIdx] +     // R
        0.587 * sourceData[sourceIdx + 1] + // G
        0.114 * sourceData[sourceIdx + 2]   // B
    );
    targetBuffer[i] = gray;
  }
}