/**
 * Media Streaming API
 * RESTful API for device discovery and stream control
 * WebSocket endpoints for real-time streaming
 */

import { createDeviceDiscoveryPipeline } from '../../features/media-streaming/device-discovery-pipeline.js';
import { createMediaStreamingPipeline } from '../../features/media-streaming/media-streaming-pipeline.js';
import { createMediaWebSocketDistributor } from '../../core/distribution/distributors/media-websocket-distributor.ts';
import { createOrchestrator } from '../../core/orchestration/orchestrator.js';
import { createStrategyRegistry } from '../../core/orchestration/strategies.js';
import { createDistributionSessionManager } from '../../core/distribution/distribution-session-manager.ts';

// Import route modules
import { setupDeviceRoutes } from './routes/device-routes.js';
import { setupStreamRoutes } from './routes/stream-routes.js';
import { setupSystemRoutes } from './routes/system-routes.js';

/**
 * Create media streaming API system
 * @param {Object} config - Configuration options
 * @returns {Object} API system with routes and handlers
 */
export const createMediaStreamingAPI = (config = {}) => {
  const state = {
    orchestrator: null,
    distributionManager: null,
    deviceDiscoveryPipeline: null,
    activeStreams: new Map(), // streamId -> pipeline
    connectedDevices: new Map(), // deviceId -> device info
    isInitialized: false
  };

  // Initialize the media streaming system
  const initialize = async () => {
    if (state.isInitialized) return true;

    console.log('🚀 Initializing Media Streaming API...');

    try {
      // Create orchestrator for pipeline management
      const strategyRegistry = createStrategyRegistry();
      state.orchestrator = createOrchestrator({
        strategies: strategyRegistry,
        defaultStrategy: 'performance_first',
        performance: {
          maxConcurrentPipelines: 10,
          timeoutMs: 30000
        }
      });

      // Create distribution session manager
      state.distributionManager = createDistributionSessionManager({
        enableHealthCheck: true,
        healthCheckInterval: 30000
      });

      // WebSocket distribution handled by multi-device coordinator
      console.log('📝 WebSocket streaming handled by multi-device coordinator');

      // Create and register device discovery pipeline
      state.deviceDiscoveryPipeline = createDeviceDiscoveryPipeline({
        discoveryInterval: config.discoveryInterval || 10000,
        streamingPort: config.websocketPort || 8081
      });

      await state.orchestrator.registerPipeline(state.deviceDiscoveryPipeline);

      // Distribution sessions handled by multi-device coordinator
      console.log('📝 Complex distribution sessions handled by multi-device coordinator');

      state.isInitialized = true;
      console.log('✅ Media Streaming API initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize Media Streaming API:', error);
      throw error;
    }
  };

  // Device discovery and management endpoints
  const setupDeviceRoutesLocal = (app) => setupDeviceRoutes(app, state);

  // Stream management endpoints
  const setupStreamRoutesLocal = (app) => setupStreamRoutes(app, state);

  // System status and health endpoints
  const setupSystemRoutesLocal = (app) => setupSystemRoutes(app, state);

  // WebSocket setup for real-time streaming
  const setupWebSocketRoutes = (server) => {
    // This will be handled by the media WebSocket distributor
    // through the distribution session manager
    console.log('📡 WebSocket streaming available on configured port');
  };

  // Cleanup function
  const cleanup = async () => {
    console.log('🧹 Cleaning up Media Streaming API...');
    
    // Stop all active streams
    for (const [streamId, pipeline] of state.activeStreams) {
      try {
        if (pipeline.isStreaming()) {
          await pipeline.process({ action: 'STOP_STREAM' });
        }
        await pipeline.cleanup();
      } catch (error) {
        console.warn(`Error cleaning up stream ${streamId}:`, error);
      }
    }
    
    state.activeStreams.clear();
    
    // Cleanup orchestrator and distribution manager
    if (state.orchestrator) {
      await state.orchestrator.cleanup();
    }
    
    if (state.distributionManager) {
      await state.distributionManager.cleanup();
    }
    
    state.isInitialized = false;
    console.log('✅ Media Streaming API cleanup completed');
  };

  return {
    // Initialization
    initialize,
    cleanup,
    
    // Route setup functions
    setupDeviceRoutes: setupDeviceRoutesLocal,
    setupStreamRoutes: setupStreamRoutesLocal, 
    setupSystemRoutes: setupSystemRoutesLocal,
    setupWebSocketRoutes,
    
    // Status
    isInitialized: () => state.isInitialized,
    getActiveStreams: () => Array.from(state.activeStreams.keys()),
    
    // Access to internal components
    getOrchestrator: () => state.orchestrator,
    getDistributionManager: () => state.distributionManager,
    getDeviceDiscovery: () => state.deviceDiscoveryPipeline
  };
};

