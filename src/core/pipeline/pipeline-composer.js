/**
 * Pipeline Composition Utilities - Compatibility Layer
 * Provides backward compatibility while using the new modular TypeScript implementation
 */

import createPipelineComposer, {
  CompositionPattern,
  ExecutionStrategy,
  createSequentialComposition,
  createParallelComposition,
  createConditionalComposition,
  createAdaptiveComposition,
  createCascadingComposition
} from './composers/index.ts';

// Export all the factory functions and constants for backward compatibility
export {
  CompositionPattern,
  ExecutionStrategy,
  createSequentialComposition,
  createParallelComposition,
  createConditionalComposition,
  createAdaptiveComposition,
  createCascadingComposition
};

// Export the main factory function
export { createPipelineComposer };

// Default export for backward compatibility
