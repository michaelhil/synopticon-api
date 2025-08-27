/**
 * Age Estimation Pipeline
 */

import createAgeEstimationPipeline, {
  AgeUtils,
  DEFAULT_AGE_RANGES,
  createDefaultAgeConfiguration
} from './age-estimation/index.ts';

// Export the main factory function
export { createAgeEstimationPipeline };

// Export utilities
export { AgeUtils };

// Types available from TypeScript import
// BaseAgeDetector, AgeDetectorConfiguration, AgeResult, GenderResult

// Export configuration utilities
export {
  createDefaultAgeConfiguration,
  DEFAULT_AGE_RANGES
};

// Default export
