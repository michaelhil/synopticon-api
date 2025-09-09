/**
 * Image Processing Utilities
 * Helper functions for image processing operations
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js';
import type { BoundingBox, ImageUtils, ProcessingContext } from './types.js';

/**
 * Create image utilities module
 */
export const createImageUtils = (context: ProcessingContext): ImageUtils => {
  const { resourcePool } = context;
  
  /**
   * Extract ImageData from various input types
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
        const width = getElementWidth(input);
        const height = getElementHeight(input);
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
   * Normalize bounding box coordinates to pixel values
   */
  const normalizeBoundingBox = (
    bbox: BoundingBox, 
    imageWidth: number, 
    imageHeight: number
  ): BoundingBox => {
    // Handle both normalized (0-1) and pixel coordinates
    const x = bbox.x < 1 ? bbox.x * imageWidth : bbox.x;
    const y = bbox.y < 1 ? bbox.y * imageHeight : bbox.y;
    const width = bbox.width < 1 ? bbox.width * imageWidth : bbox.width;
    const height = bbox.height < 1 ? bbox.height * imageHeight : bbox.height;
    
    return {
      x: Math.max(0, Math.floor(x)),
      y: Math.max(0, Math.floor(y)),
      width: Math.min(imageWidth - Math.max(0, Math.floor(x)), Math.ceil(width)),
      height: Math.min(imageHeight - Math.max(0, Math.floor(y)), Math.ceil(height))
    };
  };
  
  /**
   * Add padding to bounding box
   */
  const addPaddingToBbox = (
    bbox: BoundingBox, 
    padding: number, 
    imageWidth: number, 
    imageHeight: number
  ): BoundingBox => {
    const padX = Math.floor(bbox.width * padding);
    const padY = Math.floor(bbox.height * padding);
    
    const paddedX = Math.max(0, bbox.x - padX);
    const paddedY = Math.max(0, bbox.y - padY);
    
    return {
      x: paddedX,
      y: paddedY,
      width: Math.min(imageWidth - paddedX, bbox.width + 2 * padX),
      height: Math.min(imageHeight - paddedY, bbox.height + 2 * padY)
    };
  };
  
  return {
    extractImageData,
    normalizeBoundingBox,
    addPaddingToBbox
  };
};

/**
 * Get element width handling different input types
 */
function getElementWidth(element: HTMLImageElement | HTMLVideoElement): number {
  if ('width' in element) {
    return element.width;
  }
  return (element as HTMLVideoElement).videoWidth;
}

/**
 * Get element height handling different input types
 */
function getElementHeight(element: HTMLImageElement | HTMLVideoElement): number {
  if ('height' in element) {
    return element.height;
  }
  return (element as HTMLVideoElement).videoHeight;
}

/**
 * Validate bounding box
 */
export const validateBoundingBox = (bbox: BoundingBox): boolean => {
  return (
    typeof bbox.x === 'number' &&
    typeof bbox.y === 'number' &&
    typeof bbox.width === 'number' &&
    typeof bbox.height === 'number' &&
    bbox.width > 0 &&
    bbox.height > 0 &&
    bbox.x >= 0 &&
    bbox.y >= 0
  );
};

/**
 * Calculate bounding box area
 */
export const calculateBboxArea = (bbox: BoundingBox): number => {
  return bbox.width * bbox.height;
};

/**
 * Check if two bounding boxes intersect
 */
export const bboxesIntersect = (bbox1: BoundingBox, bbox2: BoundingBox): boolean => {
  return !(
    bbox1.x > bbox2.x + bbox2.width ||
    bbox2.x > bbox1.x + bbox1.width ||
    bbox1.y > bbox2.y + bbox2.height ||
    bbox2.y > bbox1.y + bbox1.height
  );
};

/**
 * Calculate intersection over union (IoU) of two bounding boxes
 */
export const calculateIoU = (bbox1: BoundingBox, bbox2: BoundingBox): number => {
  if (!bboxesIntersect(bbox1, bbox2)) {
    return 0;
  }
  
  const intersectionX = Math.max(bbox1.x, bbox2.x);
  const intersectionY = Math.max(bbox1.y, bbox2.y);
  const intersectionWidth = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width) - intersectionX;
  const intersectionHeight = Math.min(bbox1.y + bbox1.height, bbox2.y + bbox2.height) - intersectionY;
  
  const intersectionArea = intersectionWidth * intersectionHeight;
  const bbox1Area = calculateBboxArea(bbox1);
  const bbox2Area = calculateBboxArea(bbox2);
  const unionArea = bbox1Area + bbox2Area - intersectionArea;
  
  return intersectionArea / unionArea;
};