/**
 * Image Processing Type Definitions
 * Comprehensive TypeScript interfaces for image manipulation operations
 */

// Base image data types
export interface ImageData {
  data: Uint8Array;
  width: number;
  height: number;
  channels?: number;
}

// Image format definitions
export interface ImageFormat {
  channels: number;
  bytesPerPixel: number;
}

export type ImageFormatType = 'RGB' | 'RGBA' | 'GRAYSCALE' | 'BGR';

export const IMAGE_FORMATS: Record<ImageFormatType, ImageFormat> = {
  RGB: { channels: 3, bytesPerPixel: 3 },
  RGBA: { channels: 4, bytesPerPixel: 4 },
  GRAYSCALE: { channels: 1, bytesPerPixel: 1 },
  BGR: { channels: 3, bytesPerPixel: 3 }
};

// Interpolation methods
export type InterpolationMethod = 'nearest' | 'bilinear' | 'bicubic';

export const INTERPOLATION_METHODS: Record<string, InterpolationMethod> = {
  NEAREST: 'nearest',
  BILINEAR: 'bilinear',
  BICUBIC: 'bicubic'
};

// Filter types
export type FilterType = 'brightness' | 'contrast' | 'blur' | 'sharpen' | 'edge' | 'emboss';

// Processing options
export interface ResizeOptions {
  width: number;
  height: number;
  method?: InterpolationMethod;
}

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConvertOptions {
  from: ImageFormatType;
  to: ImageFormatType;
}

export interface FilterOptions {
  type: FilterType;
  intensity?: number;
}

export interface PreprocessingOptions {
  resize?: ResizeOptions;
  crop?: CropOptions;
  convert?: ConvertOptions;
  filter?: FilterOptions;
  normalize?: boolean;
}

// Batch processing options
export interface BatchProcessOptions extends PreprocessingOptions {
  maxConcurrent?: number;
  continueOnError?: boolean;
}

export interface BatchProcessResult {
  status: 'fulfilled' | 'rejected';
  value?: ImageData;
  reason?: { error: string; index: number };
}

// Processing metrics
export interface ProcessingMetrics {
  processedFrames: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  operationCounts: Record<string, number>;
}

// Cache statistics
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

// Resource pool statistics
export interface ResourcePoolStats {
  canvasCount?: number;
  contextCount?: number;
  totalAllocated?: number;
  totalReleased?: number;
}

// Combined statistics
export interface ProcessorStats {
  cache: CacheStats;
  resourcePool: ResourcePoolStats | null;
  processedFrames: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  operationCounts: Record<string, number>;
}

// Image input types
export type ImageInput = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData;

// Processor configuration
export interface ProcessorConfig {
  defaultInterpolation?: InterpolationMethod;
  enableCaching?: boolean;
  cacheSize?: number;
  enableMetrics?: boolean;
  resourcePool?: any;
}

// Specialized processor interfaces
export interface ResizeProcessor {
  resizeImage: (imageData: ImageData, width: number, height: number, method?: InterpolationMethod) => ImageData;
}

export interface ColorProcessor {
  convertColorSpace: (imageData: ImageData, from: ImageFormatType, to: ImageFormatType) => ImageData;
  normalizeImage: (imageData: ImageData) => ImageData;
}

export interface FilterProcessor {
  applyFilter: (imageData: ImageData, type: FilterType, intensity?: number) => ImageData;
}

export interface CropProcessor {
  cropImage: (imageData: ImageData, x: number, y: number, width: number, height: number) => ImageData;
}

// Processing cache interface
export interface ProcessingCache {
  getCached: (operation: string, params: any) => ImageData | null;
  setCached: (operation: string, params: any, result: ImageData) => void;
  clear: () => void;
  getStats: () => CacheStats;
  setMaxSize: (size: number) => void;
  recordProcessingTime: (startTime: number, endTime: number) => void;
}

// Image operations interface
export interface ImageOperations {
  resizeImage: (imageData: ImageData, targetWidth: number, targetHeight: number, method?: InterpolationMethod) => ImageData;
  convertColorSpace: (imageData: ImageData, fromFormat: ImageFormatType, toFormat: ImageFormatType) => ImageData;
  cropImage: (imageData: ImageData, x: number, y: number, width: number, height: number) => ImageData;
  applyFilter: (imageData: ImageData, filterType: FilterType, intensity?: number) => ImageData;
}

// Main image processor interface
export interface ImageProcessor {
  // Main processing functions
  preprocessImage: (input: ImageInput, options?: PreprocessingOptions) => Promise<ImageData>;
  batchProcess: (inputs: ImageInput[], options?: BatchProcessOptions) => Promise<BatchProcessResult[]>;
  extractImageData: (input: ImageInput) => ImageData;
  
  // Direct access to specialized processors
  resize: ResizeProcessor;
  color: ColorProcessor;
  filter: FilterProcessor;
  crop: CropProcessor;
  
  normalizeImage: (imageData: ImageData) => ImageData;
  
  // Utility functions
  getStats: () => ProcessorStats;
  reset: () => void;
  updateConfig: (newConfig: Partial<ProcessorConfig>) => void;
  
  // Constants
  IMAGE_FORMATS: typeof IMAGE_FORMATS;
  INTERPOLATION_METHODS: typeof INTERPOLATION_METHODS;
}

// Factory function type
export type ImageProcessorFactory = (config?: ProcessorConfig) => ImageProcessor;

// Processing context for specialized operations
export interface ProcessingContext {
  resourcePool: any;
  cache: ProcessingCache;
  metrics: ProcessingMetrics;
}

// Error types for image processing
export interface ProcessingError extends Error {
  category: 'PROCESSING' | 'VALIDATION' | 'RESOURCE' | 'CACHE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context?: any;
}

// Validation result for image processing
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Processing pipeline step
export interface ProcessingStep {
  operation: string;
  parameters: any;
  processor: string;
}

// Processing pipeline
export interface ProcessingPipeline {
  steps: ProcessingStep[];
  config: ProcessorConfig;
  execute: (input: ImageInput) => Promise<ImageData>;
  validate: () => ValidationResult;
}
