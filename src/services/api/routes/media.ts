/**
 * Media Streaming Routes Module
 * Handles device discovery, stream management, and coordinator operations
 * TypeScript implementation with comprehensive type safety
 */

import { parseRequestURL } from '../../../shared/utils/url-utils.js';
import type { 
  MediaDependencies, 
  Routes, 
  DeviceInfo,
  CreateStreamRequest,
  StreamResponse,
  DiscoveryResult,
  DeviceRegistrationResult 
} from '../types/media-types.js';

export const createMediaRoutes = ({
  getMediaStreamingAPI,
  getMultiDeviceCoordinator,
  memoryOptimizer,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse
}: MediaDependencies): Routes => {
  const routes: Routes = [];

  // Device Management Routes
  routes.push(['GET', '^/api/media/devices$', async (request: Request) => {
    try {
      const mediaAPI = await getMediaStreamingAPI();
      const discovery = mediaAPI.getDeviceDiscovery();
      
      const urlParams = parseRequestURL(request.url).searchParams || new Map();
      const refresh = urlParams.get('refresh') === 'true';
      const capabilities = urlParams.get('capabilities') !== 'false';
      const registerDevices = urlParams.get('register') !== 'false';
      
      console.log(`🔍 Enhanced device discovery requested (refresh: ${refresh}, capabilities: ${capabilities}, register: ${registerDevices})`);
      
      const result: DiscoveryResult = await discovery.process({
        forceRefresh: refresh,
        includeCapabilities: capabilities
      });
      
      if (result.status === 'success' && result.data) {
        // Register devices with coordinator if requested
        const registrationResults: DeviceRegistrationResult[] = [];
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
                  error: regResult.success ? undefined : regResult.error
                });
              } else {
                registrationResults.push({
                  deviceId: device.id,
                  registered: true
                });
              }
            } catch (error) {
              registrationResults.push({
                deviceId: device.id,
                registered: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
        
        return createJSONResponse({
          devices: result.data.devices,
          networkInfo: result.data.networkInfo,
          statistics: result.data.statistics,
          registrationResults: registrationResults.length > 0 ? registrationResults : undefined,
          timestamp: result.timestamp
        });
      } else {
        return createErrorResponse(result.error?.message || 'Discovery failed', 500);
      }
    } catch (error) {
      console.error('Device discovery failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Get specific device info
  routes.push(['GET', '^/api/media/devices/([^/]+)$', async (request: Request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const deviceId = pathParts[pathParts.length - 1];
      
      if (!deviceId) {
        return createErrorResponse('Device ID is required', 400);
      }

      const mediaAPI = await getMediaStreamingAPI();
      const discovery = mediaAPI.getDeviceDiscovery();
      const result: DiscoveryResult = await discovery.process({});
      
      if (result.status === 'success' && result.data) {
        const device = result.data.devices.find((d: DeviceInfo) => d.id === deviceId);
        if (device) {
          return createJSONResponse({
            device,
            timestamp: result.timestamp
          });
        } else {
          return createErrorResponse('Device not found', 404);
        }
      } else {
        return createErrorResponse(result.error?.message || 'Discovery failed', 500);
      }
    } catch (error) {
      console.error('Device lookup failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Create new stream
  routes.push(['POST', '^/api/media/streams$', async (request: Request) => {
    try {
      const body = await request.json() as CreateStreamRequest;
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
      const discoveryResult: DiscoveryResult = await discovery.process({});
      
      if (discoveryResult.status !== 'success' || !discoveryResult.data) {
        return createErrorResponse('Failed to discover devices', 500);
      }

      const device = discoveryResult.data.devices.find((d: DeviceInfo) => d.id === deviceId);
      if (!device) {
        return createErrorResponse('Device not found', 404);
      }

      // Ensure device is registered with coordinator
      const coordinator = await getMultiDeviceCoordinator();
      if (!coordinator.getDevice(deviceId)) {
        await coordinator.addDevice(device);
        console.log(`📱 Auto-registered device with coordinator: ${device.label}`);
      }

      // Create stream
      const streamResult = await mediaAPI.createStream({
        deviceId,
        quality,
        autoStart
      });

      if (streamResult.success) {
        const response: StreamResponse = {
          success: true,
          stream: {
            id: streamResult.streamId,
            deviceId,
            quality,
            status: autoStart ? 'starting' : 'stopped',
            endpoints: streamResult.endpoints,
            metadata: streamResult.metadata
          },
          device: device.label,
          message: `Stream ${autoStart ? 'created and started' : 'created'} successfully`
        };
        
        return createJSONResponse(response, 201);
      } else {
        return createErrorResponse(streamResult.error || 'Failed to create stream', 500);
      }
    } catch (error) {
      console.error('Stream creation failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Get all active streams
  routes.push(['GET', '^/api/media/streams$', async (request: Request) => {
    try {
      const mediaAPI = await getMediaStreamingAPI();
      const streams = await mediaAPI.getAllStreams();
      
      return createJSONResponse({
        streams,
        count: streams.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to get streams:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Get specific stream
  routes.push(['GET', '^/api/media/streams/([^/]+)$', async (request: Request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const streamId = pathParts[pathParts.length - 1];
      
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }

      const mediaAPI = await getMediaStreamingAPI();
      const stream = await mediaAPI.getStream(streamId);
      
      if (stream) {
        return createJSONResponse({
          stream,
          timestamp: Date.now()
        });
      } else {
        return createErrorResponse('Stream not found', 404);
      }
    } catch (error) {
      console.error('Failed to get stream:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Start stream
  routes.push(['POST', '^/api/media/streams/([^/]+)/start$', async (request: Request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const streamId = pathParts[pathParts.indexOf('streams') + 1];
      
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }

      const mediaAPI = await getMediaStreamingAPI();
      const result = await mediaAPI.startStream(streamId);
      
      if (result.success) {
        return createJSONResponse({
          success: true,
          streamId,
          message: 'Stream started successfully',
          endpoints: result.endpoints
        });
      } else {
        return createErrorResponse(result.error || 'Failed to start stream', 500);
      }
    } catch (error) {
      console.error('Failed to start stream:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Stop stream
  routes.push(['POST', '^/api/media/streams/([^/]+)/stop$', async (request: Request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const streamId = pathParts[pathParts.indexOf('streams') + 1];
      
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }

      const mediaAPI = await getMediaStreamingAPI();
      const result = await mediaAPI.stopStream(streamId);
      
      if (result.success) {
        return createJSONResponse({
          success: true,
          streamId,
          message: 'Stream stopped successfully'
        });
      } else {
        return createErrorResponse(result.error || 'Failed to stop stream', 500);
      }
    } catch (error) {
      console.error('Failed to stop stream:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  // Delete stream
  routes.push(['DELETE', '^/api/media/streams/([^/]+)$', async (request: Request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const streamId = pathParts[pathParts.length - 1];
      
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }

      const mediaAPI = await getMediaStreamingAPI();
      const result = await mediaAPI.deleteStream(streamId);
      
      if (result.success) {
        return createJSONResponse({
          success: true,
          streamId,
          message: 'Stream deleted successfully'
        });
      } else {
        return createErrorResponse(result.error || 'Failed to delete stream', 404);
      }
    } catch (error) {
      console.error('Failed to delete stream:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(message, 500);
    }
  }]);

  return routes;
};