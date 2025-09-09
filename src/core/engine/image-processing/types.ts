/**
 * Image Processing Types and Interfaces
 */

import type { ResourcePool } from '../../performance/resource-pool.js';
import type { ProcessingCache } from '../image-processing-cache.js';

export interface ImageProcessorConfig {
  resourcePool?: ResourcePool;
  defaultInterpolation?: string;
  enableCaching?: boolean;
  cacheSize?: number;
  enableMetrics?: boolean;
  [key: string]: unknown;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreprocessOptions {
  targetSize?: [number, number];
  format?: string;
  normalize?: boolean;
  interpolation?: string;
  centerCrop?: boolean;
  [key: string]: unknown;
}

export interface ExtractionOptions {
  padding?: number;
  minSize?: [number, number];
  maxSize?: [number, number];
  maintainAspectRatio?: boolean;
  targetSize?: [number, number];
  [key: string]: unknown;
}

export interface ProcessedImageData {
  data: Uint8Array | Float32Array | Uint8ClampedArray;
  width: number;
  height: number;
  format?: string;
  normalized?: boolean;
  [key: string]: unknown;
}

export interface ProcessingMetrics {
  processedFrames: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  cacheEfficiency?: number;
  cacheSize?: number;
  enabled: boolean;
}

export interface ProcessorState {
  metrics: {
    processedFrames: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    cacheHits: number;
    cacheMisses: number;
  };
  cache?: Map<string, unknown>;
}

export interface ImageProcessor {
  preprocessImage: (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    options?: PreprocessOptions
  ) => ProcessedImageData;
  extractFaceRegion: (
    imageData: ImageData,
    boundingBox: BoundingBox,
    options?: ExtractionOptions
  ) => ImageData;
  resizeImage: (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    interpolation?: string
  ) => ImageData;
  centerCropImage: (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ) => ImageData;
  convertImageFormat: (
    imageData: ImageData,
    targetFormat: string
  ) => ProcessedImageData | ImageData;
  normalizeImage: (
    imageData: ImageData | ProcessedImageData
  ) => ProcessedImageData;
  extractImageData: (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
  ) => ImageData;
  normalizeBoundingBox: (
    bbox: BoundingBox,
    imageWidth: number,
    imageHeight: number
  ) => BoundingBox;
  addPaddingToBbox: (
    bbox: BoundingBox,
    padding: number,
    imageWidth: number,
    imageHeight: number
  ) => BoundingBox;
  getMetrics: () => ProcessingMetrics;
  cleanup: () => void;
}

export interface ImageTransformations {
  resize: (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    interpolation?: string
  ) => ImageData;
  crop: (
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ) => ImageData;
  convert: (
    imageData: ImageData,
    targetFormat: string
  ) => ProcessedImageData | ImageData;
  normalize: (
    imageData: ImageData | ProcessedImageData
  ) => ProcessedImageData;
}

export interface ImageUtils {
  extractImageData: (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
  ) => ImageData;
  normalizeBoundingBox: (
    bbox: BoundingBox,
    imageWidth: number,
    imageHeight: number
  ) => BoundingBox;
  addPaddingToBbox: (
    bbox: BoundingBox,
    padding: number,
    imageWidth: number,
    imageHeight: number
  ) => BoundingBox;
}

export interface FaceExtractor {
  extractFaceRegion: (
    imageData: ImageData,
    boundingBox: BoundingBox,
    options?: ExtractionOptions
  ) => ImageData;
}

export interface ImagePreprocessor {
  preprocessImage: (
    input: ImageData | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    options?: PreprocessOptions
  ) => ProcessedImageData;
}

export interface ProcessingContext {
  resourcePool: ResourcePool;
  cache: ProcessingCache;
  state: ProcessorState;
  config: Required<ImageProcessorConfig>;
}

export type ProcessFunction<T> = () => Promise<T>;