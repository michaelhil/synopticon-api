/**
 * Media Streaming API
 * RESTful API for device discovery and stream control
 * WebSocket endpoints for real-time streaming
 */

import { createDeviceDiscoveryPipeline } from '../../features/media-streaming/device-discovery-pipeline.js';
import { createMediaStreamingPipeline } from '../../features/media-streaming/media-streaming-pipeline.js';
import { createMediaWebSocketDistributor } from '../../core/distribution/distributors/media-websocket-distributor.js';
import { createOrchestrator } from '../../core/orchestration/orchestrator.js';
import { createStrategyRegistry } from '../../core/orchestration/strategies.js';
import { createDistributionSessionManager } from '../../core/distribution/distribution-session-manager.js';

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
  const setupDeviceRoutes = (app) => {
    // Get all available devices
    app.get('/api/media/devices', async (req, res) => {
      try {
        const { refresh = false, capabilities = true } = req.query;
        
        const result = await state.deviceDiscoveryPipeline.process({
          forceRefresh: refresh === 'true',
          includeCapabilities: capabilities === 'true'
        });

        if (result.status === 'success') {
          res.json({
            success: true,
            devices: result.data.devices,
            networkInfo: result.data.networkInfo,
            statistics: result.data.statistics,
            timestamp: result.timestamp
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error.message
          });
        }
      } catch (error) {
        console.error('Device discovery failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get specific device details
    app.get('/api/media/devices/:deviceId', async (req, res) => {
      try {
        const { deviceId } = req.params;
        
        // Get all devices first
        const result = await state.deviceDiscoveryPipeline.process({
          forceRefresh: false,
          includeCapabilities: true
        });

        if (result.status === 'success') {
          const device = result.data.devices.find(d => d.id === deviceId);
          if (device) {
            res.json({
              success: true,
              device
            });
          } else {
            res.status(404).json({
              success: false,
              error: 'Device not found'
            });
          }
        } else {
          res.status(500).json({
            success: false,
            error: result.error.message
          });
        }
      } catch (error) {
        console.error('Device lookup failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Test device functionality
    app.post('/api/media/devices/:deviceId/test', async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { duration = 5000 } = req.body;

        // Get device info
        const discoveryResult = await state.deviceDiscoveryPipeline.process({});
        if (discoveryResult.status !== 'success') {
          throw new Error('Failed to discover devices');
        }

        const device = discoveryResult.data.devices.find(d => d.id === deviceId);
        if (!device) {
          return res.status(404).json({
            success: false,
            error: 'Device not found'
          });
        }

        // Create temporary streaming pipeline for testing
        const testPipeline = createMediaStreamingPipeline(device, {
          defaultQuality: 'low',
          bufferSize: 10
        });

        await testPipeline.initialize();

        // Start streaming briefly to test
        const startResult = await testPipeline.process({
          action: 'START_STREAM'
        });

        if (startResult.status === 'success') {
          // Wait for specified duration
          await new Promise(resolve => setTimeout(resolve, Math.min(duration, 10000)));

          // Stop streaming
          await testPipeline.process({ action: 'STOP_STREAM' });
          
          // Get stats
          const stats = testPipeline.getStats();
          
          await testPipeline.cleanup();

          res.json({
            success: true,
            message: 'Device test completed successfully',
            testResults: {
              device: device.label,
              duration: duration,
              stats
            }
          });
        } else {
          await testPipeline.cleanup();
          res.status(400).json({
            success: false,
            error: startResult.error.message
          });
        }

      } catch (error) {
        console.error('Device test failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  };

  // Stream management endpoints
  const setupStreamRoutes = (app) => {
    // Create new stream
    app.post('/api/media/streams', async (req, res) => {
      try {
        const { deviceId, quality = 'medium', autoStart = false } = req.body;

        if (!deviceId) {
          return res.status(400).json({
            success: false,
            error: 'deviceId is required'
          });
        }

        // Check if stream already exists
        if (state.activeStreams.has(deviceId)) {
          return res.status(409).json({
            success: false,
            error: 'Stream already exists for this device'
          });
        }

        // Get device info
        const discoveryResult = await state.deviceDiscoveryPipeline.process({});
        if (discoveryResult.status !== 'success') {
          throw new Error('Failed to discover devices');
        }

        const device = discoveryResult.data.devices.find(d => d.id === deviceId);
        if (!device) {
          return res.status(404).json({
            success: false,
            error: 'Device not found'
          });
        }

        // Create streaming pipeline
        const streamPipeline = createMediaStreamingPipeline(device, {
          defaultQuality: quality,
          autoStart: false
        });

        await streamPipeline.initialize();
        await state.orchestrator.registerPipeline(streamPipeline);

        // Store the pipeline
        state.activeStreams.set(deviceId, streamPipeline);

        // Start streaming if requested
        if (autoStart) {
          const startResult = await streamPipeline.process({
            action: 'START_STREAM'
          });

          if (startResult.status !== 'success') {
            // Clean up on failure
            state.activeStreams.delete(deviceId);
            await streamPipeline.cleanup();
            
            return res.status(500).json({
              success: false,
              error: startResult.error.message
            });
          }
        }

        // Get session and start media stream in distribution system
        const session = state.distributionManager.getSession('media-streaming');
        if (session) {
          const mediaDistributor = session.activeDistributors.get('media-websocket');
          if (mediaDistributor) {
            await mediaDistributor.instance.startStream(deviceId, {
              type: device.type,
              quality: quality
            });
          }
        }

        res.json({
          success: true,
          streamId: deviceId,
          device: device.label,
          quality: quality,
          isStreaming: autoStart,
          message: 'Stream created successfully'
        });

      } catch (error) {
        console.error('Failed to create stream:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get all active streams
    app.get('/api/media/streams', async (req, res) => {
      try {
        const streams = Array.from(state.activeStreams.entries()).map(([deviceId, pipeline]) => {
          const status = pipeline.getStatus();
          return {
            streamId: deviceId,
            device: status.deviceLabel,
            deviceType: status.deviceType,
            quality: status.quality,
            isStreaming: status.isStreaming,
            stats: status.stats,
            bufferSize: status.bufferSize
          };
        });

        res.json({
          success: true,
          streams,
          totalStreams: streams.length,
          activeStreams: streams.filter(s => s.isStreaming).length
        });

      } catch (error) {
        console.error('Failed to get streams:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Control specific stream
    app.put('/api/media/streams/:streamId', async (req, res) => {
      try {
        const { streamId } = req.params;
        const { action, quality, parameters = {} } = req.body;

        const pipeline = state.activeStreams.get(streamId);
        if (!pipeline) {
          return res.status(404).json({
            success: false,
            error: 'Stream not found'
          });
        }

        let result;
        switch (action) {
          case 'start':
            result = await pipeline.process({ action: 'START_STREAM' });
            break;
          case 'stop':
            result = await pipeline.process({ action: 'STOP_STREAM' });
            break;
          case 'change_quality':
            result = await pipeline.process({ 
              action: 'CHANGE_QUALITY', 
              parameters: { quality: quality || 'medium' }
            });
            break;
          default:
            return res.status(400).json({
              success: false,
              error: 'Invalid action. Use: start, stop, change_quality'
            });
        }

        if (result.status === 'success') {
          res.json({
            success: true,
            streamId,
            action,
            result: result.data.result
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error.message
          });
        }

      } catch (error) {
        console.error('Stream control failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Delete stream
    app.delete('/api/media/streams/:streamId', async (req, res) => {
      try {
        const { streamId } = req.params;

        const pipeline = state.activeStreams.get(streamId);
        if (!pipeline) {
          return res.status(404).json({
            success: false,
            error: 'Stream not found'
          });
        }

        // Stop streaming if active
        if (pipeline.isStreaming()) {
          await pipeline.process({ action: 'STOP_STREAM' });
        }

        // Stop stream in distribution system
        const session = state.distributionManager.getSession('media-streaming');
        if (session) {
          const mediaDistributor = session.activeDistributors.get('media-websocket');
          if (mediaDistributor) {
            await mediaDistributor.instance.stopStream(streamId);
          }
        }

        // Clean up pipeline
        await state.orchestrator.unregisterPipeline(pipeline.name);
        await pipeline.cleanup();
        state.activeStreams.delete(streamId);

        res.json({
          success: true,
          message: 'Stream deleted successfully',
          streamId
        });

      } catch (error) {
        console.error('Failed to delete stream:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get stream statistics
    app.get('/api/media/streams/:streamId/stats', async (req, res) => {
      try {
        const { streamId } = req.params;

        const pipeline = state.activeStreams.get(streamId);
        if (!pipeline) {
          return res.status(404).json({
            success: false,
            error: 'Stream not found'
          });
        }

        const status = pipeline.getStatus();
        const stats = pipeline.getStats();

        res.json({
          success: true,
          streamId,
          status,
          stats,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('Failed to get stream stats:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  };

  // System status and health endpoints
  const setupSystemRoutes = (app) => {
    // Get system health
    app.get('/api/media/health', async (req, res) => {
      try {
        const orchestratorStatus = state.orchestrator.getStatus();
        const sessionStatus = await state.distributionManager.getSessionStatus('media-streaming');
        
        res.json({
          success: true,
          health: {
            overall: state.isInitialized ? 'healthy' : 'unhealthy',
            orchestrator: orchestratorStatus,
            distribution: sessionStatus,
            activeStreams: state.activeStreams.size,
            timestamp: Date.now()
          }
        });

      } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get system statistics
    app.get('/api/media/stats', async (req, res) => {
      try {
        const session = state.distributionManager.getSession('media-streaming');
        let distributionStats = null;
        
        if (session) {
          const mediaDistributor = session.activeDistributors.get('media-websocket');
          if (mediaDistributor) {
            distributionStats = mediaDistributor.instance.getStreamingStats();
          }
        }

        res.json({
          success: true,
          stats: {
            system: state.orchestrator.getMetrics(),
            distribution: distributionStats,
            activeStreams: state.activeStreams.size,
            pipelines: state.orchestrator.getRegisteredPipelines().length
          }
        });

      } catch (error) {
        console.error('Stats retrieval failed:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  };

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
    setupDeviceRoutes,
    setupStreamRoutes, 
    setupSystemRoutes,
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

export default createMediaStreamingAPI;