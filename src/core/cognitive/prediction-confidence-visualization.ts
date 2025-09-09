/**
 * @fileoverview Prediction Confidence Visualization System
 * 
 * Main entry point providing backward compatibility while delegating
 * to the new modular TypeScript implementation.
 * 
 * @version 2.0.0 
 * @author Synopticon Development Team
 */

// Re-export everything from the modular implementation
export {
  createPredictionConfidenceVisualization,
  ConfidenceVisualizationUtils,
  createLazyPipelineLoaders // For legacy compatibility
} from './prediction-confidence-visualization/index.js';

// Re-export all types
export type * from './prediction-confidence-visualization/types.js';

// Legacy compatibility - maintain old interface
export const createPredictionConfidenceVisualizationLegacy = createPredictionConfidenceVisualization;