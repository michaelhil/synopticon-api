/**
 * Multi-Distribution System - Main Entry Point
 * Modular distribution architecture for multiple communication protocols
 */

// Core distribution components
export { createDistributionManager } from './distribution-manager.js';
export { createDistributionSessionManager } from './distribution-session-manager.js';
export { createDistributionConfigManager } from './distribution-config-manager.js';
export { createBaseDistributor } from './base-distributor.js';

// Protocol-specific distributors
export { createHttpDistributor } from './distributors/http-distributor.js';
export { createWebSocketDistributor } from './distributors/websocket-distributor.js';
export { createMqttDistributor } from './distributors/mqtt-distributor.js';
export { createUdpDistributor } from './distributors/udp-distributor.js';
export { createSseDistributor } from './distributors/sse-distributor.js';

// Configuration presets
export { 
  getDistributionPresets, 
  getDistributionPreset, 
  getAvailablePresets,
  validatePreset 
} from './configs/distribution-presets.js';

/**
 * Quick setup factory for common distribution patterns
 */
export const createQuickDistribution = (pattern = 'basic') => {
  const config = getDistributionPreset(pattern);
  
  if (!config) {
    const available = getAvailablePresets();
    throw new Error(`Unknown distribution pattern: ${pattern}. Available: ${available.join(', ')}`);
  }
  
  return createDistributionManager(config);
};