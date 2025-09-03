/**
 * Tobii 5 Eye Tracker Integration Module
 * Main entry point for Tobii 5 support in Synopticon
 * Integrates with existing eye tracking architecture
 */

export { createTobii5Device } from './device.js';
export { createTobii5Discovery } from './discovery.js';
export { createRemoteTobiiClient } from './remote-client.js';

// Device factory function for integration with eye tracking system
export const tobii5DeviceFactory = {
  type: 'tobii-5',
  name: 'Tobii Eye Tracker 5',
  description: 'High-performance eye and head tracking via remote Tobii bridge',
  
  createDevice: (config) => import('./device.js').then(({ createTobii5Device }) => 
    createTobii5Device(config)
  ),
  
  createDiscovery: (config) => import('./discovery.js').then(({ createTobii5Discovery }) => 
    createTobii5Discovery(config)
  ),
  
  capabilities: [
    'gaze-tracking',
    'head-tracking', 
    'presence-detection',
    'remote-connection',
    'auto-discovery',
    'recording',
    'calibration'
  ],
  
  requirements: {
    platform: ['darwin', 'win32', 'linux'],
    connection: 'network',
    bridge: 'tobii-bridge-server'
  }
};