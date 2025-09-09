/**
 * Face Region Extraction
 * Specialized functions for extracting face regions from images
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../../shared/utils/error-handler.js';
import type { 
  BoundingBox, 
  ExtractionOptions, 
  FaceExtractor, 
  ProcessingContext 
} from './types.js';

/**
 * Create face extraction module
 */
export const createFaceExtractor = (context: ProcessingContext): FaceExtractor => {
  const { resourcePool } = context;
  
  /**
   * Extract face region from image data
   */
  const extractFaceRegion = (
    imageData: ImageData, 
    boundingBox: BoundingBox, 
    options: ExtractionOptions = {}
  ): ImageData => {
    try {
      const opts = validateAndNormalizeOptions(options);
      
      // Normalize bounding box coordinates
      const bbox = normalizeBoundingBox(boundingBox, imageData.width, imageData.height);
      
      // Validate bounding box
      if (!isValidBoundingBox(bbox, imageData.width, imageData.height)) {
        throw new Error('Invalid bounding box coordinates');
      }
      
      // Apply padding
      const paddedBbox = addPaddingToBbox(bbox, opts.padding, imageData.width, imageData.height);
      
      // Extract the face region
      const faceData = extractRegion(imageData, paddedBbox);
      
      // Resize to target size if specified
      if (opts.targetSize) {
        return resizeFaceRegion(faceData, opts.targetSize[0], opts.targetSize[1]);
      }
      
      return faceData;
      
    } catch (error) {
      handleError(
        `Face region extraction failed: ${(error as Error).message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { boundingBox, options }
      );
      throw error;
    }
  };
  
  /**
   * Extract a region from image data using canvas
   */
  const extractRegion = (imageData: ImageData, bbox: BoundingBox): ImageData => {
    const canvas = resourcePool.getCanvas(bbox.width, bbox.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Create temporary canvas with original image
    const sourceCanvas = resourcePool.getCanvas(imageData.width, imageData.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
      throw new Error('Failed to get source canvas context');
    }
    sourceCtx.putImageData(imageData, 0, 0);
    
    // Draw face region
    ctx.drawImage(
      sourceCanvas,
      bbox.x, bbox.y, bbox.width, bbox.height,
      0, 0, bbox.width, bbox.height
    );
    
    const extractedData = ctx.getImageData(0, 0, bbox.width, bbox.height);
    
    // Clean up resources
    resourcePool.returnCanvas(canvas);
    resourcePool.returnCanvas(sourceCanvas);
    
    return extractedData;
  };
  
  /**
   * Resize face region to target dimensions
   */
  const resizeFaceRegion = (faceData: ImageData, targetWidth: number, targetHeight: number): ImageData => {
    const canvas = resourcePool.getCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Use high-quality interpolation for face regions
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Create source canvas
    const sourceCanvas = resourcePool.getCanvas(faceData.width, faceData.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
      throw new Error('Failed to get source canvas context');
    }
    sourceCtx.putImageData(faceData, 0, 0);
    
    // Draw resized face
    ctx.drawImage(sourceCanvas, 0, 0, faceData.width, faceData.height, 0, 0, targetWidth, targetHeight);
    
    const resizedData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    
    // Clean up resources
    resourcePool.returnCanvas(canvas);
    resourcePool.returnCanvas(sourceCanvas);
    
    return resizedData;
  };
  
  return {
    extractFaceRegion
  };
};

/**
 * Validate and normalize extraction options
 */
function validateAndNormalizeOptions(options: ExtractionOptions): Required<ExtractionOptions> {
  return {
    padding: Math.max(0, Math.min(1, options.padding || 0.1)), // Clamp between 0 and 1
    minSize: options.minSize || [64, 64],
    maxSize: options.maxSize || [512, 512],
    maintainAspectRatio: options.maintainAspectRatio !== false,
    targetSize: options.targetSize || undefined
  };
}

/**
 * Normalize bounding box coordinates
 */
function normalizeBoundingBox(bbox: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
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
}

/**
 * Add padding to bounding box
 */
function addPaddingToBbox(
  bbox: BoundingBox, 
  padding: number, 
  imageWidth: number, 
  imageHeight: number
): BoundingBox {
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
}

/**
 * Validate bounding box coordinates
 */
function isValidBoundingBox(bbox: BoundingBox, imageWidth: number, imageHeight: number): boolean {
  return (
    bbox.x >= 0 &&
    bbox.y >= 0 &&
    bbox.width > 0 &&
    bbox.height > 0 &&
    bbox.x + bbox.width <= imageWidth &&
    bbox.y + bbox.height <= imageHeight
  );
}

/**
 * Calculate optimal face crop dimensions
 */
export const calculateOptimalCrop = (
  bbox: BoundingBox,
  targetSize: [number, number],
  imageWidth: number,
  imageHeight: number
): BoundingBox => {
  const [targetWidth, targetHeight] = targetSize;
  const targetAspectRatio = targetWidth / targetHeight;
  const bboxAspectRatio = bbox.width / bbox.height;
  
  let cropWidth: number;
  let cropHeight: number;
  
  if (bboxAspectRatio > targetAspectRatio) {
    // Face is wider, constrain by height
    cropHeight = bbox.height;
    cropWidth = cropHeight * targetAspectRatio;
  } else {
    // Face is taller, constrain by width
    cropWidth = bbox.width;
    cropHeight = cropWidth / targetAspectRatio;
  }
  
  // Center the crop on the face
  const cropX = Math.max(0, bbox.x + (bbox.width - cropWidth) / 2);
  const cropY = Math.max(0, bbox.y + (bbox.height - cropHeight) / 2);
  
  return {
    x: Math.min(cropX, imageWidth - cropWidth),
    y: Math.min(cropY, imageHeight - cropHeight),
    width: Math.min(cropWidth, imageWidth),
    height: Math.min(cropHeight, imageHeight)
  };
};