/**
 * Image Crop Processing Module
 * Handles image cropping and extraction operations
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js'

// Type definitions
export interface ResourcePool {
  getCanvas: (width: number, height: number) => HTMLCanvasElement;
  returnCanvas: (canvas: HTMLCanvasElement) => void;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropRegion extends BoundingBox {
  id?: string;
}

export interface ROI extends BoundingBox {
  label?: string;
  confidence?: number;
}

export interface CropResult {
  id: string;
  imageData: ImageData | null;
  bounds: BoundingBox;
  success: boolean;
  error?: string;
}

export interface ROIResult {
  imageData: ImageData;
  metadata: {
    originalBounds: BoundingBox;
    label: string;
    confidence: number;
    extractedAt: number;
    originalSize: {
      width: number;
      height: number;
    };
  };
}

export interface CropProcessor {
  cropImage: (imageData: ImageData, x: number, y: number, width: number, height: number) => ImageData;
  centerCropImage: (imageData: ImageData, targetWidth: number, targetHeight: number) => ImageData;
  aspectRatioCrop: (imageData: ImageData, targetAspectRatio: number) => ImageData;
  cropWithPadding: (imageData: ImageData, x: number, y: number, width: number, height: number, paddingColor?: number[]) => ImageData;
  multiCrop: (imageData: ImageData, regions: CropRegion[]) => CropResult[];
  extractROI: (imageData: ImageData, roi: ROI) => ROIResult;
  normalizeBoundingBox: (bbox: BoundingBox, imageWidth: number, imageHeight: number) => BoundingBox;
}

export const createCropProcessor = (resourcePool: ResourcePool): CropProcessor => {
  /**
   * Basic crop operation
   */
  const cropImage = (imageData: ImageData, x: number, y: number, width: number, height: number): ImageData => {
    try {
      if (!imageData || !imageData.data) {
        throw new Error('Invalid image data provided');
      }
      
      const sourceWidth = imageData.width;
      const sourceHeight = imageData.height;
      
      // Validate crop bounds
      if (x < 0 || y < 0 || x + width > sourceWidth || y + height > sourceHeight) {
        throw new Error('Crop bounds exceed image dimensions');
      }
      
      if (width <= 0 || height <= 0) {
        throw new Error('Crop dimensions must be positive');
      }
      
      const canvas = resourcePool.getCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      
      // Create source canvas
      const sourceCanvas = resourcePool.getCanvas(sourceWidth, sourceHeight);
      const sourceCtx = sourceCanvas.getContext('2d')!;
      sourceCtx.putImageData(imageData, 0, 0);
      
      // Draw cropped region
      ctx.drawImage(
        sourceCanvas,
        x, y, width, height,
        0, 0, width, height
      );
      
      const croppedData = ctx.getImageData(0, 0, width, height);
      
      // Clean up resources
      resourcePool.returnCanvas(canvas);
      resourcePool.returnCanvas(sourceCanvas);
      
      return croppedData;
      
    } catch (error) {
      handleError(
        `Image crop failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { 
          sourceSize: [imageData?.width, imageData?.height], 
          cropBounds: [x, y, width, height] 
        }
      );
      throw error;
    }
  };

  /**
   * Center crop to specific dimensions
   */
  const centerCropImage = (imageData: ImageData, targetWidth: number, targetHeight: number): ImageData => {
    try {
      const sourceWidth = imageData.width;
      const sourceHeight = imageData.height;
      
      // Calculate crop area
      const cropWidth = Math.min(sourceWidth, targetWidth);
      const cropHeight = Math.min(sourceHeight, targetHeight);
      const cropX = Math.floor((sourceWidth - cropWidth) / 2);
      const cropY = Math.floor((sourceHeight - cropHeight) / 2);
      
      return cropImage(imageData, cropX, cropY, cropWidth, cropHeight);
      
    } catch (error) {
      handleError(
        `Image center cropping failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { 
          sourceSize: [imageData?.width, imageData?.height], 
          targetSize: [targetWidth, targetHeight] 
        }
      );
      throw error;
    }
  };

  /**
   * Smart crop to maintain aspect ratio
   */
  const aspectRatioCrop = (imageData: ImageData, targetAspectRatio: number): ImageData => {
    try {
      const sourceWidth = imageData.width;
      const sourceHeight = imageData.height;
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
      
      return cropImage(imageData, cropX, cropY, cropWidth, cropHeight);
      
    } catch (error) {
      handleError(
        `Aspect ratio crop failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { targetAspectRatio }
      );
      throw error;
    }
  };

  /**
   * Crop with padding if needed
   */
  const cropWithPadding = (imageData: ImageData, x: number, y: number, width: number, height: number, paddingColor: number[] = [0, 0, 0, 255]): ImageData => {
    try {
      const sourceWidth = imageData.width;
      const sourceHeight = imageData.height;
      
      // Calculate intersection with source image
      const sourceX = Math.max(0, x);
      const sourceY = Math.max(0, y);
      const sourceEndX = Math.min(sourceWidth, x + width);
      const sourceEndY = Math.min(sourceHeight, y + height);
      
      const intersectWidth = Math.max(0, sourceEndX - sourceX);
      const intersectHeight = Math.max(0, sourceEndY - sourceY);
      
      // Create output canvas
      const canvas = resourcePool.getCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      
      // Fill with padding color
      ctx.fillStyle = `rgba(${paddingColor[0]}, ${paddingColor[1]}, ${paddingColor[2]}, ${paddingColor[3]/255})`;
      ctx.fillRect(0, 0, width, height);
      
      if (intersectWidth > 0 && intersectHeight > 0) {
        // Create source canvas
        const sourceCanvas = resourcePool.getCanvas(sourceWidth, sourceHeight);
        const sourceCtx = sourceCanvas.getContext('2d')!;
        sourceCtx.putImageData(imageData, 0, 0);
        
        // Draw intersecting region
        const destX = sourceX - x;
        const destY = sourceY - y;
        
        ctx.drawImage(
          sourceCanvas,
          sourceX, sourceY, intersectWidth, intersectHeight,
          destX, destY, intersectWidth, intersectHeight
        );
        
        resourcePool.returnCanvas(sourceCanvas);
      }
      
      const result = ctx.getImageData(0, 0, width, height);
      resourcePool.returnCanvas(canvas);
      
      return result;
      
    } catch (error) {
      handleError(
        `Padded crop failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { cropBounds: [x, y, width, height] }
      );
      throw error;
    }
  };

  /**
   * Multi-region crop (extract multiple regions at once)
   */
  const multiCrop = (imageData: ImageData, regions: CropRegion[]): CropResult[] => {
    try {
      if (!Array.isArray(regions) || regions.length === 0) {
        throw new Error('Regions must be a non-empty array');
      }
      
      return regions.map((region, index) => {
        const { x, y, width, height, id } = region;
        
        try {
          const cropped = cropImage(imageData, x, y, width, height);
          return {
            id: id || `region_${index}`,
            imageData: cropped,
            bounds: { x, y, width, height },
            success: true
          };
        } catch (error) {
          return {
            id: id || `region_${index}`,
            imageData: null,
            bounds: { x, y, width, height },
            success: false,
            error: (error as Error).message
          };
        }
      });
      
    } catch (error) {
      handleError(
        `Multi-crop failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { regionCount: regions?.length }
      );
      throw error;
    }
  };

  /**
   * Extract region of interest (ROI) with metadata
   */
  const extractROI = (imageData: ImageData, roi: ROI): ROIResult => {
    try {
      const { x, y, width, height, label, confidence } = roi;
      const cropped = cropImage(imageData, x, y, width, height);
      
      return {
        imageData: cropped,
        metadata: {
          originalBounds: { x, y, width, height },
          label: label || 'unknown',
          confidence: confidence || 1.0,
          extractedAt: Date.now(),
          originalSize: {
            width: imageData.width,
            height: imageData.height
          }
        }
      };
      
    } catch (error) {
      handleError(
        `ROI extraction failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { roi }
      );
      throw error;
    }
  };

  /**
   * Normalize bounding box coordinates
   */
  const normalizeBoundingBox = (bbox: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox => {
    try {
      let { x, y, width, height } = bbox;
      
      // Handle relative coordinates (0-1 range)
      if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
        x = Math.round(x * imageWidth);
        y = Math.round(y * imageHeight);
        width = Math.round(width * imageWidth);
        height = Math.round(height * imageHeight);
      }
      
      // Clamp to image bounds
      x = Math.max(0, Math.min(imageWidth - 1, x));
      y = Math.max(0, Math.min(imageHeight - 1, y));
      width = Math.max(1, Math.min(imageWidth - x, width));
      height = Math.max(1, Math.min(imageHeight - y, height));
      
      return { x, y, width, height };
      
    } catch (error) {
      handleError(
        `Bounding box normalization failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { bbox, imageSize: [imageWidth, imageHeight] }
      );
      throw error;
    }
  };

  return {
    cropImage,
    centerCropImage,
    aspectRatioCrop,
    cropWithPadding,
    multiCrop,
    extractROI,
    normalizeBoundingBox
  };
};