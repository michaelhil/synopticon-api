/**
 * Pupil Labs Neon Eye Tracking Module
 * Professional eye tracking device integration
 */

export { createEyeTrackingPipeline } from './pipeline.js';
export { createEyeTrackerDevice } from './device.js';
export { createDeviceDiscovery, discoveryFactory } from './discovery.js';
export { createEyeTrackingStreaming, createEyeTrackingSystem } from './streaming.js';

// Re-export with more descriptive names
export { createEyeTrackingPipeline as createNeonEyeTrackingPipeline } from './pipeline.js';
export { createEyeTrackerDevice as createNeonDevice } from './device.js';
export { createDeviceDiscovery as createNeonDiscovery } from './discovery.js';
