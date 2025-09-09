/**
 * Device discovery and management routes for media streaming API - TypeScript Implementation
 */

import { createMediaStreamingPipeline } from '../../../features/media-streaming/media-streaming-pipeline.js';

export interface DeviceRoutesState {
  deviceDiscoveryPipeline: any;
}

export interface DeviceRoutesApp {
  get: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
  post: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
}

export const setupDeviceRoutes = (app: DeviceRoutesApp, state: DeviceRoutesState): void => {
  // Get all available devices
  app.get('/api/media/devices', async (req: any, res: any): Promise<void> => {
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
    } catch (error: any) {
      console.error('Device discovery failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get specific device details
  app.get('/api/media/devices/:deviceId', async (req: any, res: any): Promise<void> => {
    try {
      const { deviceId } = req.params;
      
      // Get all devices first
      const result = await state.deviceDiscoveryPipeline.process({
        forceRefresh: false,
        includeCapabilities: true
      });

      if (result.status === 'success') {
        const device = result.data.devices.find((d: any) => d.id === deviceId);
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
    } catch (error: any) {
      console.error('Device lookup failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Test device functionality
  app.post('/api/media/devices/:deviceId/test', async (req: any, res: any): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { duration = 5000 } = req.body;

      // Get device info
      const discoveryResult = await state.deviceDiscoveryPipeline.process({});
      if (discoveryResult.status !== 'success') {
        throw new Error('Failed to discover devices');
      }

      const device = discoveryResult.data.devices.find((d: any) => d.id === deviceId);
      if (!device) {
        res.status(404).json({
          success: false,
          error: 'Device not found'
        });
        return;
      }

      // Create streaming pipeline for device testing
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
            duration,
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

    } catch (error: any) {
      console.error('Device test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};