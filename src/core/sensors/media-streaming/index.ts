/**
 * Media Streaming Sensor Integration
 * Bridges media streaming with universal data types
 */

import type { FrameData } from '../../common/types';
import { createUniversalDistributor } from '../../common/distribution/universal-distributor';

export interface MediaStreamConfig {
  deviceId: string;
  quality: 'low' | 'medium' | 'high';
  enableAudio: boolean;
  enableVideo: boolean;
  maxBitrate?: number;
}

export interface StreamingStats {
  framesStreamed: number;
  bytesTransferred: number;
  avgFPS: number;
  activeConnections: number;
  quality: string;
}

// Initialize streaming statistics
const createStreamingStats = (quality: string): StreamingStats => ({
  framesStreamed: 0,
  bytesTransferred: 0,
  avgFPS: 0,
  activeConnections: 0,
  quality
});

// Handle frame distribution logic
const handleFrameDistribution = async (
  distributor: any,
  frameData: FrameData,
  config: MediaStreamConfig,
  stats: StreamingStats
): Promise<void> => {
  const result = await distributor.distributeFrameData(frameData, {
    compress: config.quality !== 'high',
    priority: 'normal'
  });

  stats.framesStreamed++;
  stats.bytesTransferred += result.bytesSent || 0;
  stats.activeConnections = result.clientsReached;
};

// Factory function for media streaming sensor
export const createMediaStreamingSensor = (config: MediaStreamConfig) => {
  const distributor = createUniversalDistributor({ maxClients: 50, compressionLevel: 6 });
  let isStreaming = false;
  const stats = createStreamingStats(config.quality);

  const startStream = async (): Promise<boolean> => {
    try {
      console.log(`Starting media stream for device: ${config.deviceId}`);
      isStreaming = true;
      return true;
    } catch (error) {
      console.error('Stream start failed:', error);
      return false;
    }
  };

  const stopStream = async (): Promise<void> => {
    isStreaming = false;
    console.log('Media stream stopped');
  };

  const distributeFrame = async (frameData: FrameData): Promise<void> => {
    if (!isStreaming) return;
    try {
      await handleFrameDistribution(distributor, frameData, config, stats);
    } catch (error) {
      console.error('Frame distribution failed:', error);
    }
  };

  const addClient = (clientId: string, dataTypes: ('frame' | 'telemetry' | 'correlated')[]) => {
    return distributor.addClient({ clientId, dataTypes, quality: config.quality });
  };

  const removeClient = (clientId: string) => distributor.removeClient(clientId);

  return {
    startStream, stopStream, distributeFrame, addClient, removeClient,
    isStreaming: () => isStreaming,
    getStats: () => ({ ...stats }),
    getConfig: () => ({ ...config }),
    getDistributor: () => distributor
  };
};
