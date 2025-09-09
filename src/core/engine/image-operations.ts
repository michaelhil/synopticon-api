/**
 * Core image processing operations
 */

// Type definitions
export interface ImageFormat {
  channels: number;
  bytesPerPixel: number;
}

export type ImageFormatType = 'RGB' | 'RGBA' | 'GRAYSCALE' | 'BGR';
export type InterpolationMethod = 'nearest' | 'bilinear' | 'bicubic' | 'canvas';

export interface ProcessedImageData {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  channels: number;
}

export interface ResourcePool {
  acquire: (type: string, width?: number, height?: number) => HTMLCanvasElement;
  release: (type: string, resource: HTMLCanvasElement) => void;
}

export interface ImageOperations {
  resizeImage: (imageData: ImageData, targetWidth: number, targetHeight: number, method?: InterpolationMethod) => ProcessedImageData;
  convertColorSpace: (imageData: ProcessedImageData | ImageData, fromFormat: ImageFormatType, toFormat: ImageFormatType) => ProcessedImageData;
  normalizePixels: (data: Uint8ClampedArray | Uint8Array) => Float32Array;
  denormalizePixels: (data: Float32Array) => Uint8ClampedArray;
}

export const IMAGE_FORMATS: Record<ImageFormatType, ImageFormat> = {
  RGB: { channels: 3, bytesPerPixel: 3 },
  RGBA: { channels: 4, bytesPerPixel: 4 },
  GRAYSCALE: { channels: 1, bytesPerPixel: 1 },
  BGR: { channels: 3, bytesPerPixel: 3 }
};

export const INTERPOLATION_METHODS: Record<string, InterpolationMethod> = {
  NEAREST: 'nearest',
  BILINEAR: 'bilinear',
  BICUBIC: 'bicubic',
  CANVAS: 'canvas'
};

export const createImageOperations = (resourcePool: ResourcePool): ImageOperations => {
  
  const resizeImage = (imageData: ImageData, targetWidth: number, targetHeight: number, method: InterpolationMethod = INTERPOLATION_METHODS.BILINEAR): ProcessedImageData => {
    const { data, width, height } = imageData;
    const channels = data.length / (width * height);
    
    // Get canvas from resource pool
    const canvas = resourcePool.acquire('Canvas', targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    
    try {
      // Create temporary canvas for source image
      const sourceCanvas = resourcePool.acquire('Canvas', width, height);
      const sourceCtx = sourceCanvas.getContext('2d')!;
      
      // Put image data on source canvas
      const sourceImageData = sourceCtx.createImageData(width, height);
      sourceImageData.data.set(data);
      sourceCtx.putImageData(sourceImageData, 0, 0);
      
      // Configure interpolation
      if (method === INTERPOLATION_METHODS.NEAREST) {
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = method === INTERPOLATION_METHODS.BICUBIC ? 'high' : 'medium';
      }
      
      // Resize
      ctx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
      
      // Get resized image data
      const resizedImageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      
      // Return to pool
      resourcePool.release('Canvas', sourceCanvas);
      resourcePool.release('Canvas', canvas);
      
      return {
        data: resizedImageData.data,
        width: targetWidth,
        height: targetHeight,
        channels
      };
      
    } catch (error) {
      // Ensure cleanup on error
      resourcePool.release('Canvas', canvas);
      throw error;
    }
  };

  const convertColorSpace = (imageData: ProcessedImageData | ImageData, fromFormat: ImageFormatType, toFormat: ImageFormatType): ProcessedImageData => {
    const { data, width, height } = imageData;
    const fromChannels = IMAGE_FORMATS[fromFormat]?.channels || 3;
    const toChannels = IMAGE_FORMATS[toFormat]?.channels || 3;
    
    const outputData = new Uint8Array(width * height * toChannels);
    
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * fromChannels;
      const dstIdx = i * toChannels;
      
      if (fromFormat === 'RGB' && toFormat === 'GRAYSCALE') {
        // RGB to Grayscale
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        outputData[dstIdx] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      } else if (fromFormat === 'RGBA' && toFormat === 'RGB') {
        // RGBA to RGB
        outputData[dstIdx] = data[srcIdx];
        outputData[dstIdx + 1] = data[srcIdx + 1];
        outputData[dstIdx + 2] = data[srcIdx + 2];
      } else if (fromFormat === 'RGB' && toFormat === 'BGR') {
        // RGB to BGR
        outputData[dstIdx] = data[srcIdx + 2];
        outputData[dstIdx + 1] = data[srcIdx + 1];
        outputData[dstIdx + 2] = data[srcIdx];
      } else {
        // Copy as-is for unsupported conversions
        for (let c = 0; c < Math.min(fromChannels, toChannels); c++) {
          outputData[dstIdx + c] = data[srcIdx + c];
        }
      }
    }
    
    return {
      data: outputData,
      width,
      height,
      channels: toChannels
    };
  };

  const normalizePixels = (data: Uint8ClampedArray | Uint8Array): Float32Array => {
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      normalized[i] = data[i] / 255.0;
    }
    return normalized;
  };

  const denormalizePixels = (data: Float32Array): Uint8ClampedArray => {
    const denormalized = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i++) {
      denormalized[i] = Math.round(Math.max(0, Math.min(255, data[i] * 255)));
    }
    return denormalized;
  };

  return {
    resizeImage,
    convertColorSpace,
    normalizePixels,
    denormalizePixels
  };
};