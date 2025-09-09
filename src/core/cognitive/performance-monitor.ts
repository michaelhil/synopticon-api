/**
 * @fileoverview Performance Monitor System
 * 
 * Main entry point providing backward compatibility while delegating
 * to the new modular TypeScript performance monitoring system.
 * 
 * @version 2.0.0
 * @author Synopticon Development Team
 */

// Re-export everything from the modular implementation
export {
  createPerformanceMonitor,
  METRIC_TYPES,
  PERFORMANCE_THRESHOLDS
} from './performance-monitor/index.js';

// Re-export all types
export type * from './performance-monitor/types.js';

// Legacy compatibility - maintain old factory function name
export { createPerformanceMonitor as createCognitivePerformanceMonitor } from './performance-monitor/index.js';