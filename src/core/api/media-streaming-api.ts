/**
 * Media Streaming API - TypeScript Implementation
 * RESTful API for device discovery and stream control
 * WebSocket endpoints for real-time streaming
 */

import { createDeviceDiscoveryPipeline } from '../../features/media-streaming/device-discovery-pipeline.js';
import { createMediaStreamingPipeline } from '../../features/media-streaming/media-streaming-pipeline.js';
import { createUniversalDistributor } from '../../core/distribution/universal-distributor.js';
import { createWebSocketAdapter } from '../../core/distribution/adapters/websocket-adapter.js';
import { createUnifiedOrchestrator } from '../../core/orchestration/unified-orchestrator.js';
import { createDistributionSessionManager } from '../../core/distribution/distribution-session-manager.js';

// Import route modules
import { setupDeviceRoutes } from './routes/device-routes.js';
import { setupStreamRoutes } from './routes/stream-routes.js';
import { setupSystemRoutes } from './routes/system-routes.js';

// Media streaming API configuration interface
export interface MediaStreamingApiConfig {
  discoveryInterval?: number;
  websocketPort?: number;
  httpHost?: string;
  httpPort?: number;
  websocketHost?: string;
  maxConcurrentPipelines?: number;
  enableMetrics?: boolean;
}

// Media streaming API state interface
interface MediaStreamingApiState {
  orchestrator: any | null;
  distributionManager: any | null;
  deviceDiscoveryPipeline: any | null;
  activeStreams: Map<string, any>;
  connectedDevices: Map<string, any>;
  isInitialized: boolean;
}

// Media streaming API interface
export interface MediaStreamingApi {
  initialize: () => Promise<boolean>;
  cleanup: () => Promise<void>;
  setupDeviceRoutes: (app: any) => void;
  setupStreamRoutes: (app: any) => void;
  setupSystemRoutes: (app: any) => void;
  setupWebSocketRoutes: (server: any) => void;
  isInitialized: () => boolean;
  getActiveStreams: () => string[];
  getOrchestrator: () => any;
  getDistributionManager: () => any;
  getDeviceDiscovery: () => any;
}

/**
 * Create media streaming API system
 * @param config - Configuration options
 * @returns API system with routes and handlers
 */
export const createMediaStreamingAPI = (config: MediaStreamingApiConfig = {}): MediaStreamingApi => {
  const state: MediaStreamingApiState = {
    orchestrator: null,
    distributionManager: null,
    deviceDiscoveryPipeline: null,
    activeStreams: new Map(),
    connectedDevices: new Map(),
    isInitialized: false
  };

  // Initialize the media streaming system
  const initialize = async (): Promise<boolean> => {
    if (state.isInitialized) return true;

    console.log('🚀 Initializing Media Streaming API...');

    try {
      // Create unified orchestrator (Phase 1 consolidation)
      state.orchestrator = createUnifiedOrchestrator({
        maxConcurrentPipelines: config.maxConcurrentPipelines || 10,
        enableMetrics: config.enableMetrics !== false,
        defaultRetryConfig: {
          maxRetries: 3,
          initialDelayMs: 100,
          backoffMultiplier: 2
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

      await state.orchestrator.register('device-discovery', state.deviceDiscoveryPipeline, {
        capabilities: ['device-discovery', 'streaming'],
        priority: 1
      });

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
  const setupDeviceRoutesLocal = (app: any): void => setupDeviceRoutes(app, state);

  // Stream management endpoints
  const setupStreamRoutesLocal = (app: any): void => setupStreamRoutes(app, state);

  // System status and health endpoints
  const setupSystemRoutesLocal = (app: any): void => setupSystemRoutes(app, state);

  // WebSocket setup for real-time streaming
  const setupWebSocketRoutes = (server: any): void => {
    // This will be handled by the media WebSocket distributor
    // through the distribution session manager
    console.log('📡 WebSocket streaming available on configured port');
  };

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    console.log('🧹 Cleaning up Media Streaming API...');
    
    // Stop all active streams
    for (const [streamId, pipeline] of state.activeStreams) {
      try {
        if (pipeline.isStreaming && pipeline.isStreaming()) {
          await pipeline.process({ action: 'STOP_STREAM' });
        }
        if (pipeline.cleanup) {
          await pipeline.cleanup();
        }
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
    isInitialized: (): boolean => state.isInitialized,
    getActiveStreams: (): string[] => Array.from(state.activeStreams.keys()),
    
    // Access to internal components
    getOrchestrator: () => state.orchestrator,
    getDistributionManager: () => state.distributionManager,
    getDeviceDiscovery: () => state.deviceDiscoveryPipeline
  };
};