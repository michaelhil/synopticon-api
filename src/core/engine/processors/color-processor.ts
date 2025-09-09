/**
 * Image Color Processing Module
 * Handles color space conversions and format transformations
 */

import { IMAGE_FORMATS, ImageFormatType } from '../image-operations.js';
import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js';

// Type definitions for image data
export interface ProcessedImageData {
  data: Uint8ClampedArray | Float32Array;
  width: number;
  height: number;
  format?: ImageFormatType;
  normalized?: boolean;
}

export interface ResourcePool {
  getImageBuffer: (width: number, height: number, channels: number) => Uint8ClampedArray;
}

export interface ColorProcessor {
  convertColorSpace: (imageData: ImageData, fromFormat: ImageFormatType, toFormat: ImageFormatType) => ProcessedImageData;
  normalizeImage: (imageData: ImageData) => ProcessedImageData;
  denormalizeImage: (imageData: ProcessedImageData) => ProcessedImageData;
  gammaCorrection: (imageData: ImageData, gamma?: number) => ImageData;
  adjustBrightnessContrast: (imageData: ImageData, brightness?: number, contrast?: number) => ImageData;
  convertFromRGBA: (sourceData: Uint8ClampedArray, pixelCount: number, targetBuffer: Uint8ClampedArray, toFormat: ImageFormatType) => ProcessedImageData;
  convertToRGBA: (sourceData: Uint8ClampedArray, pixelCount: number, targetBuffer: Uint8ClampedArray, fromFormat: ImageFormatType, width: number, height: number) => ImageData;
}

export const createColorProcessor = (resourcePool: ResourcePool): ColorProcessor => {
  /**
   * Convert color space between different formats
   */
  const convertColorSpace = (imageData: ImageData, fromFormat: ImageFormatType, toFormat: ImageFormatType): ProcessedImageData => {
    try {
      if (fromFormat === toFormat) {
        return {
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
          format: fromFormat
        };
      }
      
      const fromFormatInfo = IMAGE_FORMATS[fromFormat];
      const toFormatInfo = IMAGE_FORMATS[toFormat];
      
      if (!fromFormatInfo || !toFormatInfo) {
        throw new Error(`Unsupported format conversion: ${fromFormat} -> ${toFormat}`);
      }
      
      const sourceData = imageData.data;
      const pixelCount = imageData.width * imageData.height;
      const targetBuffer = resourcePool.getImageBuffer(
        imageData.width, 
        imageData.height, 
        toFormatInfo.channels
      );
      
      // Handle specific conversions
      if (fromFormat === 'RGBA') {
        return convertFromRGBA(sourceData, pixelCount, targetBuffer, toFormat);
      } else if (toFormat === 'RGBA') {
        return convertToRGBA(sourceData, pixelCount, targetBuffer, fromFormat, imageData.width, imageData.height);
      } else {
        // Convert through RGBA as intermediate format
        const rgbaData = convertToRGBA(sourceData, pixelCount, new Uint8ClampedArray(pixelCount * 4), fromFormat, imageData.width, imageData.height);
        return convertFromRGBA(rgbaData.data, pixelCount, targetBuffer, toFormat);
      }
      
    } catch (error) {
      handleError(
        `Color space conversion failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { fromFormat, toFormat }
      );
      throw error;
    }
  };

  /**
   * Convert from RGBA to other formats
   */
  const convertFromRGBA = (sourceData: Uint8ClampedArray, pixelCount: number, targetBuffer: Uint8ClampedArray, toFormat: ImageFormatType): ProcessedImageData => {
    switch (toFormat) {
    case 'RGB':
      for (let i = 0; i < pixelCount; i++) {
        const sourceIdx = i * 4;
        const targetIdx = i * 3;
        targetBuffer[targetIdx] = sourceData[sourceIdx];         // R
        targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
        targetBuffer[targetIdx + 2] = sourceData[sourceIdx + 2]; // B
      }
      break;
        
    case 'BGR':
      for (let i = 0; i < pixelCount; i++) {
        const sourceIdx = i * 4;
        const targetIdx = i * 3;
        targetBuffer[targetIdx] = sourceData[sourceIdx + 2];     // B
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
        
    default:
      throw new Error(`Unsupported target format: ${toFormat}`);
    }
    
    const formatInfo = IMAGE_FORMATS[toFormat];
    const dimension = Math.sqrt(pixelCount);
    
    return {
      data: targetBuffer,
      width: dimension,
      height: dimension,
      format: toFormat
    };
  };

  /**
   * Convert from other formats to RGBA
   */
  const convertToRGBA = (sourceData: Uint8ClampedArray, pixelCount: number, targetBuffer: Uint8ClampedArray, fromFormat: ImageFormatType, width: number, height: number): ImageData => {
    switch (fromFormat) {
    case 'RGB':
      for (let i = 0; i < pixelCount; i++) {
        const sourceIdx = i * 3;
        const targetIdx = i * 4;
        targetBuffer[targetIdx] = sourceData[sourceIdx];         // R
        targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
        targetBuffer[targetIdx + 2] = sourceData[sourceIdx + 2]; // B
        targetBuffer[targetIdx + 3] = 255;                       // A
      }
      break;
        
    case 'BGR':
      for (let i = 0; i < pixelCount; i++) {
        const sourceIdx = i * 3;
        const targetIdx = i * 4;
        targetBuffer[targetIdx] = sourceData[sourceIdx + 2];     // R
        targetBuffer[targetIdx + 1] = sourceData[sourceIdx + 1]; // G
        targetBuffer[targetIdx + 2] = sourceData[sourceIdx];     // B
        targetBuffer[targetIdx + 3] = 255;                       // A
      }
      break;
        
    case 'GRAYSCALE':
      for (let i = 0; i < pixelCount; i++) {
        const targetIdx = i * 4;
        const grayValue = sourceData[i];
        targetBuffer[targetIdx] = grayValue;     // R
        targetBuffer[targetIdx + 1] = grayValue; // G
        targetBuffer[targetIdx + 2] = grayValue; // B
        targetBuffer[targetIdx + 3] = 255;       // A
      }
      break;
        
    default:
      throw new Error(`Unsupported source format: ${fromFormat}`);
    }
    
    return new ImageData(targetBuffer, width, height);
  };

  /**
   * Normalize image pixel values to 0-1 range
   */
  const normalizeImage = (imageData: ImageData): ProcessedImageData => {
    try {
      const { data } = imageData;
      const normalizedData = new Float32Array(data.length);
      
      for (let i = 0; i < data.length; i++) {
        normalizedData[i] = data[i] / 255.0;
      }
      
      return {
        data: normalizedData,
        width: imageData.width,
        height: imageData.height,
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
   * Denormalize image pixel values from 0-1 to 0-255 range
   */
  const denormalizeImage = (imageData: ProcessedImageData): ProcessedImageData => {
    try {
      const { data } = imageData;
      const denormalizedData = new Uint8ClampedArray(data.length);
      
      for (let i = 0; i < data.length; i++) {
        denormalizedData[i] = Math.round(Math.max(0, Math.min(255, (data[i] as number) * 255)));
      }
      
      return {
        ...imageData,
        data: denormalizedData,
        normalized: false
      };
      
    } catch (error) {
      handleError(
        `Image denormalization failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR
      );
      throw error;
    }
  };

  /**
   * Apply gamma correction
   */
  const gammaCorrection = (imageData: ImageData, gamma: number = 2.2): ImageData => {
    try {
      const { data } = imageData;
      const correctedData = new Uint8ClampedArray(data.length);
      const invGamma = 1.0 / gamma;
      
      // Pre-compute lookup table for efficiency
      const gammaTable = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        gammaTable[i] = Math.round(255 * Math.pow(i / 255, invGamma));
      }
      
      for (let i = 0; i < data.length; i += 4) {
        correctedData[i] = gammaTable[data[i]];         // R
        correctedData[i + 1] = gammaTable[data[i + 1]]; // G
        correctedData[i + 2] = gammaTable[data[i + 2]]; // B
        correctedData[i + 3] = data[i + 3];             // A (unchanged)
      }
      
      return new ImageData(correctedData, imageData.width, imageData.height);
      
    } catch (error) {
      handleError(
        `Gamma correction failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { gamma }
      );
      throw error;
    }
  };

  /**
   * Adjust brightness and contrast
   */
  const adjustBrightnessContrast = (imageData: ImageData, brightness: number = 0, contrast: number = 0): ImageData => {
    try {
      const { data } = imageData;
      const adjustedData = new Uint8ClampedArray(data.length);
      
      // Convert contrast from -100,100 range to multiplier
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      
      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness and contrast to RGB channels
        for (let j = 0; j < 3; j++) {
          let pixel = data[i + j];
          
          // Apply contrast
          pixel = contrastFactor * (pixel - 128) + 128;
          
          // Apply brightness
          pixel += brightness;
          
          // Clamp to valid range
          adjustedData[i + j] = Math.max(0, Math.min(255, pixel));
        }
        
        // Keep alpha unchanged
        adjustedData[i + 3] = data[i + 3];
      }
      
      return new ImageData(adjustedData, imageData.width, imageData.height);
      
    } catch (error) {
      handleError(
        `Brightness/contrast adjustment failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { brightness, contrast }
      );
      throw error;
    }
  };

  return {
    convertColorSpace,
    normalizeImage,
    denormalizeImage,
    gammaCorrection,
    adjustBrightnessContrast,
    
    // Export individual conversion functions
    convertFromRGBA,
    convertToRGBA
  };
};