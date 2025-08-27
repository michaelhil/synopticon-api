/**
 * Stream management routes for media streaming API
 */

import { createMediaStreamingPipeline } from '../../../features/media-streaming/media-streaming-pipeline.js';

export const setupStreamRoutes = (app, state) => {
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