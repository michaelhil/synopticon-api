/**
 * Media Streaming Routes Module
 * Handles device discovery, stream management, and coordinator operations
 */

import { parseRequestURL } from '../../../shared/utils/url-utils.js';

export const createMediaRoutes = ({ 
  getMediaStreamingAPI, 
  getMultiDeviceCoordinator,
  memoryOptimizer,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse 
}) => {
  const routes = [];

  // Device Management Routes
  routes.push(['GET', '^/api/media/devices$', async (request) => {
    try {
      const mediaAPI = await getMediaStreamingAPI();
      const discovery = mediaAPI.getDeviceDiscovery();
      
      const urlParams = parseRequestURL(request.url).searchParams || new Map();
      const refresh = urlParams.get('refresh') === 'true';
      const capabilities = urlParams.get('capabilities') !== 'false';
      const registerDevices = urlParams.get('register') !== 'false';
      
      console.log(`🔍 Enhanced device discovery requested (refresh: ${refresh}, capabilities: ${capabilities}, register: ${registerDevices})`);
      
      const result = await discovery.process({
        forceRefresh: refresh,
        includeCapabilities: capabilities
      });

      
      
      if (result.status === 'success') {
        // Register devices with coordinator if requested
        let registrationResults = [];
        if (registerDevices && result.data.devices) {
          const coordinator = await getMultiDeviceCoordinator();
          for (const device of result.data.devices) {
            try {
              // Skip if device already registered
              if (!coordinator.getDevice(device.id)) {
                const regResult = await coordinator.addDevice(device);
                registrationResults.push({
                  deviceId: device.id,
                  registered: regResult.success,
                  message: regResult.success ? 'Registered' : regResult.error
                });
              }
            } catch (error) {
              registrationResults.push({
                deviceId: device.id,
                registered: false,
                error: error.message
              });
            }
          }
        }

        return createJSONResponse({
          success: true,
          devices: result.data.devices,
          networkInfo: result.data.networkInfo,
          statistics: result.data.statistics,
          registrationResults,
          timestamp: result.timestamp
        }, 200);
      } else {
        return createErrorResponse(result.error.message, 500);
      }
    } catch (error) {
      console.error('Device discovery failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Get specific device details
  routes.push(['GET', '^/api/media/devices/([^/]+)$', async (request, params) => {
    try {
      const deviceId = params[0];
      const mediaAPI = await getMediaStreamingAPI();
      const discovery = mediaAPI.getDeviceDiscovery();
      
      const result = await discovery.process({});
      
      
      if (result.status === 'success') {
        const device = result.data.devices.find(d => d.id === deviceId);
        if (device) {
          return createJSONResponse({
            success: true,
            device
          }, 200);
        } else {
          return createErrorResponse('Device not found', 404);
        }
      } else {
        return createErrorResponse(result.error.message, 500);
      }
    } catch (error) {
      console.error('Device lookup failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Create new stream
  routes.push(['POST', '^/api/media/streams$', async (request) => {
    try {
      const body = await request.json();
      const { deviceId, quality = 'medium', autoStart = false } = body;

      if (!deviceId) {
        
        return createErrorResponse('deviceId is required', 400);
      }

      const mediaAPI = await getMediaStreamingAPI();
      const activeStreams = mediaAPI.getActiveStreams();
      
      if (activeStreams.includes(deviceId)) {
        
        return createErrorResponse('Stream already exists for this device', 409);
      }

      // Get device info first
      const discovery = mediaAPI.getDeviceDiscovery();
      const discoveryResult = await discovery.process({});
      
      if (discoveryResult.status !== 'success') {
        
        return createErrorResponse('Failed to discover devices', 500);
      }

      const device = discoveryResult.data.devices.find(d => d.id === deviceId);
      if (!device) {
        
        return createErrorResponse('Device not found', 404);
      }

      // Ensure device is registered with coordinator
      const coordinator = await getMultiDeviceCoordinator();
      if (!coordinator.getDevice(deviceId)) {
        await coordinator.addDevice(device);
        console.log(`📱 Auto-registered device with coordinator: ${device.label}`);
      }

      // Create stream using coordinator
      let streamResult = { success: true, isStreaming: false };
      if (autoStart) {
        streamResult = await coordinator.startStream(deviceId, { quality });
      }

      
      return createJSONResponse({
        success: true,
        streamId: deviceId,
        device: device.label,
        quality: quality,
        isStreaming: streamResult.success && autoStart,
        coordinator: true,
        streamResult: autoStart ? streamResult : undefined,
        message: 'Stream created successfully with multi-device coordinator'
      }, 200);

    } catch (error) {
      console.error('Failed to create stream:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Get all active streams
  routes.push(['GET', '^/api/media/streams$', async (request) => {
    try {
      const mediaAPI = await getMediaStreamingAPI();
      const coordinator = await getMultiDeviceCoordinator();
      
      // Get detailed stream information from coordinator
      const coordinatorStatus = coordinator.getCoordinatorStatus();
      const activeStreams = coordinator.getActiveStreams();
      const devices = coordinator.getDevices();
      
      // Build detailed stream information
      const streamDetails = [];
      for (const deviceId of activeStreams) {
        const device = devices.find(d => d.id === deviceId);
        const pipeline = coordinator.getPipeline(deviceId);
        
        if (device && pipeline) {
          streamDetails.push({
            streamId: deviceId,
            device: device.label,
            deviceType: device.type,
            quality: pipeline.getCurrentQuality(),
            isStreaming: pipeline.isStreaming(),
            stats: pipeline.getStats(),
            qualityMetrics: pipeline.getQualityMetrics()
          });
        }
      }

      
      return createJSONResponse({
        success: true,
        streams: streamDetails,
        totalStreams: streamDetails.length,
        activeStreams: streamDetails.filter(s => s.isStreaming).length,
        coordinator: {
          status: coordinatorStatus,
          totalDevices: devices.length,
          managedStreams: activeStreams.length
        },
        timestamp: Date.now()
      }, 200);

    } catch (error) {
      console.error('Failed to get streams:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // System health check
  routes.push(['GET', '^/api/media/health$', async (request) => {
    try {
      const mediaAPI = await getMediaStreamingAPI();
      const coordinator = await getMultiDeviceCoordinator();
      
      
      return createJSONResponse({
        success: true,
        status: 'healthy',
        components: {
          mediaAPI: mediaAPI.isInitialized(),
          coordinator: coordinator.getCoordinatorStatus().isActive,
          activeStreams: coordinator.getActiveStreams().length,
          registeredDevices: coordinator.getDevices().length
        },
        timestamp: Date.now()
      }, 200);

    } catch (error) {
      console.error('Health check failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Batch stream operations
  routes.push(['POST', '^/api/media/streams/batch$', async (request) => {
    try {
      const body = await request.json();
      const { action, deviceIds, quality = 'medium' } = body;

      if (!action || !deviceIds || !Array.isArray(deviceIds)) {
        
        return createErrorResponse('action and deviceIds array are required', 400);
      }

      const coordinator = await getMultiDeviceCoordinator();
      let results = [];

      switch (action) {
        case 'start':
          results = await coordinator.startMultipleStreams(deviceIds, { quality });
          break;
        case 'stop':
          results = await coordinator.stopMultipleStreams(deviceIds);
          break;
        case 'change_quality':
          results = await coordinator.changeQualityForMultiple(deviceIds, quality);
          break;
        default:
          
          return createErrorResponse('Invalid action. Use: start, stop, change_quality', 400);
      }

      
      return createJSONResponse({
        success: true,
        action,
        results,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        timestamp: Date.now()
      }, 200);

    } catch (error) {
      console.error('Batch stream operation failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Coordinator status
  routes.push(['GET', '^/api/media/coordinator/status$', async (request) => {
    try {
      const coordinator = await getMultiDeviceCoordinator();
      const status = coordinator.getCoordinatorStatus();
      const devices = coordinator.getDevices();
      const activeStreams = coordinator.getActiveStreams();

      
      return createJSONResponse({
        success: true,
        coordinator: status,
        devices: devices.length,
        activeStreams: activeStreams.length,
        deviceList: devices.map(d => ({
          id: d.id,
          label: d.label,
          type: d.type,
          isStreaming: activeStreams.includes(d.id)
        })),
        timestamp: Date.now()
      }, 200);

    } catch (error) {
      console.error('Coordinator status failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Global quality control
  routes.push(['PUT', '^/api/media/coordinator/quality$', async (request) => {
    try {
      const body = await request.json();
      const { quality, deviceIds } = body;

      if (!quality) {
        
        return createErrorResponse('quality is required', 400);
      }

      const coordinator = await getMultiDeviceCoordinator();
      let result;

      if (deviceIds && Array.isArray(deviceIds)) {
        // Change quality for specific devices
        result = await coordinator.changeQualityForMultiple(deviceIds, quality);
      } else {
        // Change quality for all active streams
        result = await coordinator.setGlobalQuality(quality);
      }

      
      return createJSONResponse({
        success: true,
        quality,
        affected: Array.isArray(result) ? result.length : 1,
        results: result,
        timestamp: Date.now()
      }, 200);

    } catch (error) {
      console.error('Quality control failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Load balancing rebalance
  routes.push(['POST', '^/api/media/coordinator/rebalance$', async (request) => {
    try {
      const coordinator = await getMultiDeviceCoordinator();
      const result = await coordinator.rebalanceStreams();

      
      return createJSONResponse({
        success: true,
        rebalanced: result.success,
        changes: result.changes || [],
        message: 'Load balancing rebalance completed',
        timestamp: Date.now()
      }, 200);

    } catch (error) {
      console.error('Rebalance failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Enhanced health check with network stats
  routes.push(['GET', '^/api/media/health/enhanced$', async (request) => {
    try {
      const mediaAPI = await getMediaStreamingAPI();
      const coordinator = await getMultiDeviceCoordinator();
      
      const coordinatorStatus = coordinator.getCoordinatorStatus();
      const networkStats = coordinator.getNetworkStats();

      
      return createJSONResponse({
        success: true,
        health: {
          overall: 'healthy',
          mediaAPI: mediaAPI.isInitialized(),
          coordinator: coordinatorStatus,
          network: networkStats,
          uptime: Date.now() - coordinatorStatus.lastUpdate,
          timestamp: Date.now()
        }
      }, 200);

    } catch (error) {
      console.error('Enhanced health check failed:', error);
      
      return createErrorResponse(error.message, 500);
    }
  }]);

  // Memory optimization stats
  routes.push(['GET', '^/api/media/memory/stats$', async (request) => {
    try {
      
      const memoryStats = memoryOptimizer.getMemoryStats();
      const poolingStats = memoryOptimizer.getPoolingStats();
      
      return createJSONResponse({
        success: true,
        memory: {
          heapUsed: Math.round(memoryStats.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryStats.heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(memoryStats.external / 1024 / 1024) + ' MB',
          rss: Math.round(memoryStats.rss / 1024 / 1024) + ' MB',
          pressure: Math.round((memoryStats.heapUsed / memoryStats.heapTotal) * 100) + '%'
        },
        pooling: poolingStats,
        monitoring: memoryOptimizer.isMonitoring(),
        timestamp: Date.now()
      }, 200);
      
    } catch (error) {
      console.error('Memory stats failed:', error);
      
      return createErrorResponse('Memory stats failed: ' + error.message, 500);
    }
  }]);

  return routes;
};