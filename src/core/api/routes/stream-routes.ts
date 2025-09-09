/**
 * Stream management routes for media streaming API - TypeScript Implementation
 */

import { createMediaStreamingPipeline } from '../../../features/media-streaming/media-streaming-pipeline.js';

export interface StreamRoutesState {
  activeStreams: Map<string, any>;
  deviceDiscoveryPipeline: any;
  orchestrator: any;
  distributionManager: any;
}

export interface StreamRoutesApp {
  get: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
  post: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
  put: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
  delete: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
}

export const setupStreamRoutes = (app: StreamRoutesApp, state: StreamRoutesState): void => {
  // Create new stream
  app.post('/api/media/streams', async (req: any, res: any): Promise<void> => {
    try {
      const { deviceId, quality = 'medium', autoStart = false } = req.body;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: 'deviceId is required'
        });
        return;
      }

      // Check if stream already exists
      if (state.activeStreams.has(deviceId)) {
        res.status(409).json({
          success: false,
          error: 'Stream already exists for this device'
        });
        return;
      }

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
          
          res.status(500).json({
            success: false,
            error: startResult.error.message
          });
          return;
        }
      }

      // Get session and start media stream in distribution system
      const session = state.distributionManager.getSession('media-streaming');
      if (session) {
        const mediaDistributor = session.activeDistributors.get('media-websocket');
        if (mediaDistributor) {
          await mediaDistributor.instance.startStream(deviceId, {
            type: device.type,
            quality
          });
        }
      }

      res.json({
        success: true,
        streamId: deviceId,
        device: device.label,
        quality,
        isStreaming: autoStart,
        message: 'Stream created successfully'
      });

    } catch (error: any) {
      console.error('Failed to create stream:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all active streams
  app.get('/api/media/streams', async (req: any, res: any): Promise<void> => {
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
        activeStreams: streams.filter((s: any) => s.isStreaming).length
      });

    } catch (error: any) {
      console.error('Failed to get streams:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Control specific stream
  app.put('/api/media/streams/:streamId', async (req: any, res: any): Promise<void> => {
    try {
      const { streamId } = req.params;
      const { action, quality, parameters = {} } = req.body;

      const pipeline = state.activeStreams.get(streamId);
      if (!pipeline) {
        res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
        return;
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
        res.status(400).json({
          success: false,
          error: 'Invalid action. Use: start, stop, change_quality'
        });
        return;
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

    } catch (error: any) {
      console.error('Stream control failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete stream
  app.delete('/api/media/streams/:streamId', async (req: any, res: any): Promise<void> => {
    try {
      const { streamId } = req.params;

      const pipeline = state.activeStreams.get(streamId);
      if (!pipeline) {
        res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
        return;
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

    } catch (error: any) {
      console.error('Failed to delete stream:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get stream statistics
  app.get('/api/media/streams/:streamId/stats', async (req: any, res: any): Promise<void> => {
    try {
      const { streamId } = req.params;

      const pipeline = state.activeStreams.get(streamId);
      if (!pipeline) {
        res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
        return;
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

    } catch (error: any) {
      console.error('Failed to get stream stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};