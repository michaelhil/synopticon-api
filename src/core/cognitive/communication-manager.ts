/**
 * @fileoverview Bidirectional Communication Manager
 * 
 * Main entry point providing backward compatibility while delegating
 * to the new modular TypeScript communication system.
 * 
 * @version 2.0.0
 * @author Synopticon Development Team
 */

// Re-export everything from the modular implementation
export {
  createBidirectionalCommunicationManager,
  createPriorityQueue,
  createConversationManager,
  createHumanInterfaceChannel
} from './communication/index.js';

// Re-export all types
export type * from './communication/types.js';
export type { CommunicationManager } from './communication/index.js';

// Legacy compatibility - maintain old factory function name
export { createBidirectionalCommunicationManager as createCommunicationManager } from './communication/index.js';