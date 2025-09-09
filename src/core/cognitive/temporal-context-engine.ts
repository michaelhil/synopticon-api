/**
 * @fileoverview Temporal Context Engine
 * 
 * Main entry point providing backward compatibility while delegating
 * to the new modular TypeScript temporal context system.
 * 
 * @version 2.0.0
 * @author Synopticon Development Team
 */

// Re-export everything from the modular implementation
export {
  createTemporalContextEngine,
  createCircadianModel,
  createFatigueModel,
  createTaskProgressionModel
} from './temporal-context/index.js';

// Re-export all types
export type * from './temporal-context/types.js';

// Legacy compatibility - maintain old factory function name
export { createTemporalContextEngine as createAdvancedTemporalContext } from './temporal-context/index.js';