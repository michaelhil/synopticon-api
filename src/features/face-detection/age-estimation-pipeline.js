/**
 * Age Estimation Pipeline - Compatibility Layer
 * Provides backward compatibility while using the new modular TypeScript implementation
 */

import createAgeEstimationPipeline, {
  AgeUtils,
  type BaseAgeDetector,
  type AgeDetectorConfiguration,
  type AgeResult,
  type GenderResult,
  createDefaultAgeConfiguration,
  DEFAULT_AGE_RANGES
} from './age-estimation/index.ts';

// Export the main factory function
export { createAgeEstimationPipeline };

// Export utilities
export { AgeUtils };

// Export types for TypeScript consumers
export type {
  BaseAgeDetector,
  AgeDetectorConfiguration,
  AgeResult,
  GenderResult
};

// Export configuration utilities
export {
  createDefaultAgeConfiguration,
  DEFAULT_AGE_RANGES
};

// Default export for backward compatibility
