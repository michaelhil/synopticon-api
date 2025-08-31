/**
 * Telemetry Streaming Infrastructure  
 * Real-time telemetry data streaming and buffering
 */

import type { TelemetryFrame } from '../../common/types';
import { createUniversalDistributor } from '../../common/distribution/universal-distributor';

export interface TelemetryStreamConfig {
  bufferSize: number;
  compressionEnabled: boolean;
  reliability: 'best-effort' | 'guaranteed';
  maxClients: number;
}

export interface StreamingMetrics {
  framesProcessed: number;
  bytesStreamed: number;
  activeClients: number;
  averageLatency: number;
  dataRate: number;
}

// Telemetry stream buffer for handling high-frequency data
const createTelemetryBuffer = (size: number) => {
  const buffer: TelemetryFrame[] = [];
  let writeIndex = 0;

  const add = (frame: TelemetryFrame) => {
    buffer[writeIndex % size] = frame;
    writeIndex++;
  };

  const getRecent = (count: number): TelemetryFrame[] => {
    const startIndex = Math.max(0, writeIndex - count);
    const result: TelemetryFrame[] = [];
    
    for (let i = startIndex; i < writeIndex; i++) {
      const frame = buffer[i % size];
      if (frame) result.push(frame);
    }
    
    return result;
  };

  const clear = () => {
    buffer.length = 0;
    writeIndex = 0;
  };

  return { add, getRecent, clear, size: () => Math.min(writeIndex, size) };
};

// Factory function for telemetry streaming service
export const createTelemetryStreamingService = (config: TelemetryStreamConfig) => {
  const distributor = createUniversalDistributor({
    maxClients: config.maxClients,
    compressionLevel: config.compressionEnabled ? 6 : 0
  });

  const buffer = createTelemetryBuffer(config.bufferSize);
  
  let metrics: StreamingMetrics = {
    framesProcessed: 0,
    bytesStreamed: 0,
    activeClients: 0,
    averageLatency: 0,
    dataRate: 0
  };

  let lastProcessTime = Date.now();

  const processFrame = async (frame: TelemetryFrame): Promise<void> => {
    const startTime = performance.now();
    
    // Add to buffer
    buffer.add(frame);
    
    // Distribute to clients
    const result = await distributor.distributeTelemetryData(frame, {
      compress: config.compressionEnabled,
      priority: 'high',
      reliability: config.reliability
    });

    // Update metrics
    metrics.framesProcessed++;
    metrics.bytesStreamed += result.bytesSent || 0;
    metrics.activeClients = result.clientsReached;
    
    const processingTime = performance.now() - startTime;
    metrics.averageLatency = (metrics.averageLatency * 0.9) + (processingTime * 0.1);
    
    const now = Date.now();
    const timeDelta = (now - lastProcessTime) / 1000;
    if (timeDelta > 0) {
      metrics.dataRate = (metrics.dataRate * 0.8) + ((result.bytesSent || 0) / timeDelta * 0.2);
    }
    lastProcessTime = now;
  };

  const addClient = (clientId: string) => {
    return distributor.addClient({
      clientId,
      dataTypes: ['telemetry'],
      quality: 'high'
    });
  };

  const removeClient = (clientId: string) => {
    return distributor.removeClient(clientId);
  };

  const getRecentFrames = (count: number = 10): TelemetryFrame[] => {
    return buffer.getRecent(count);
  };

  const getMetrics = (): StreamingMetrics => ({ ...metrics });

  const cleanup = async (): Promise<void> => {
    buffer.clear();
    await distributor.cleanup();
  };

  return {
    processFrame,
    addClient,
    removeClient,
    getRecentFrames,
    getMetrics,
    cleanup,
    getDistributor: () => distributor
  };
};