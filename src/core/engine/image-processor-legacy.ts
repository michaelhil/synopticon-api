/**
 * Legacy Image Processor (preserved for backwards compatibility)
 * 
 * This is the original monolithic image processor.
 * New code should use the modular version in ./image-processing/
 */

export { createImageProcessor, IMAGE_FORMATS, INTERPOLATION_METHODS } from './image-processing/index.js';
export type { 
  ImageProcessor, 
  ImageProcessorConfig, 
  BoundingBox, 
  PreprocessOptions, 
  ExtractionOptions, 
  ProcessedImageData, 
  ProcessingMetrics 
} from './image-processing/types.js';