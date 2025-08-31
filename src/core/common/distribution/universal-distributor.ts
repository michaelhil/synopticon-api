/**
 * Universal distributor for all Synopticon data types
 * Handles frames, telemetry, and correlated data with appropriate optimizations
 */

import type { 
  UniversalData, 
  FrameData, 
  TelemetryFrame, 
  CorrelatedFrame 
} from '../types';

// Distribution options for different data types
export interface DistributionOptions {
  compress?: boolean;
  priority?: 'low' | 'normal' | 'high';
  reliability?: 'best-effort' | 'guaranteed';
  timeout?: number;
  metadata?: Record<string, unknown>;
}

// Distribution result
export interface DistributionResult {
  success: boolean;
  duration: number;
  bytesSent?: number;
  error?: string;
  clientsReached: number;
}

// Client subscription interface
export interface ClientSubscription {
  clientId: string;
  dataTypes: ('frame' | 'telemetry' | 'correlated')[];
  filters?: Record<string, unknown>;
  quality?: 'low' | 'medium' | 'high';
  maxFrequency?: number;
}

// Factory function for universal distributor
export const createUniversalDistributor = (config: {
  maxClients?: number;
  bufferSize?: number;
  compressionLevel?: number;
}) => {
  const settings = {
    maxClients: 100,
    bufferSize: 1000,
    compressionLevel: 6,
    ...config
  };

  const clients = new Map<string, ClientSubscription>();
  const distributors = new Map<string, unknown>(); // Transport-specific distributors
  let stats = {
    totalSent: 0,
    totalBytes: 0,
    errors: 0,
    clientCount: 0
  };

  const addClient = (subscription: ClientSubscription): boolean => {
    if (clients.size >= settings.maxClients) {
      return false;
    }
    
    clients.set(subscription.clientId, subscription);
    stats.clientCount = clients.size;
    return true;
  };

  const removeClient = (clientId: string): boolean => {
    const removed = clients.delete(clientId);
    if (removed) {
      stats.clientCount = clients.size;
    }
    return removed;
  };

  const distributeFrameData = async (
    data: FrameData,
    options: DistributionOptions = {}
  ): Promise<DistributionResult> => {
    const startTime = Date.now();
    let clientsReached = 0;
    let totalBytes = 0;

    // Get clients interested in frame data
    const interestedClients = Array.from(clients.values())
      .filter(client => client.dataTypes.includes('frame'));

    // Apply compression if needed
    const payload = options.compress 
      ? await compressFrameData(data)
      : serializeFrameData(data);
    
    totalBytes = payload.length;

    // Distribute to each client
    for (const client of interestedClients) {
      try {
        await sendToClient(client.clientId, payload, options);
        clientsReached++;
      } catch (error) {
        stats.errors++;
      }
    }

    stats.totalSent++;
    stats.totalBytes += totalBytes;

    return {
      success: clientsReached > 0,
      duration: Date.now() - startTime,
      bytesSent: totalBytes,
      clientsReached
    };
  };

  const distributeTelemetryData = async (
    data: TelemetryFrame,
    options: DistributionOptions = {}
  ): Promise<DistributionResult> => {
    const startTime = Date.now();
    let clientsReached = 0;

    // Get clients interested in telemetry
    const interestedClients = Array.from(clients.values())
      .filter(client => client.dataTypes.includes('telemetry'));

    // Telemetry is typically smaller, JSON is sufficient
    const payload = JSON.stringify({
      ...data,
      timestamp: data.timestamp.toString()
    });
    const totalBytes = payload.length;

    for (const client of interestedClients) {
      try {
        await sendToClient(client.clientId, payload, options);
        clientsReached++;
      } catch (error) {
        stats.errors++;
      }
    }

    stats.totalSent++;
    stats.totalBytes += totalBytes;

    return {
      success: clientsReached > 0,
      duration: Date.now() - startTime,
      bytesSent: totalBytes,
      clientsReached
    };
  };

  const distributeCorrelatedData = async (
    data: CorrelatedFrame,
    options: DistributionOptions = {}
  ): Promise<DistributionResult> => {
    const startTime = Date.now();
    let clientsReached = 0;

    // Get clients interested in correlated data
    const interestedClients = Array.from(clients.values())
      .filter(client => client.dataTypes.includes('correlated'));

    // Correlated data may be large, use compression
    const payload = options.compress !== false
      ? await compressJsonData(data)
      : JSON.stringify(data);
    
    const totalBytes = payload.length;

    for (const client of interestedClients) {
      try {
        await sendToClient(client.clientId, payload, options);
        clientsReached++;
      } catch (error) {
        stats.errors++;
      }
    }

    stats.totalSent++;
    stats.totalBytes += totalBytes;

    return {
      success: clientsReached > 0,
      duration: Date.now() - startTime,
      bytesSent: totalBytes,
      clientsReached
    };
  };

  // Universal distribution method
  const distribute = async (
    data: UniversalData,
    options: DistributionOptions = {}
  ): Promise<DistributionResult> => {
    switch (data.sourceType) {
      case 'sensor':
        return distributeFrameData(data as FrameData, options);
      case 'telemetry':
        return distributeTelemetryData(data as TelemetryFrame, options);
      default:
        // Correlated data
        return distributeCorrelatedData(data as CorrelatedFrame, options);
    }
  };

  const getStats = () => ({ ...stats });
  
  const getClientCount = () => clients.size;
  
  const cleanup = async () => {
    clients.clear();
    distributors.clear();
    stats = { totalSent: 0, totalBytes: 0, errors: 0, clientCount: 0 };
  };

  return {
    addClient,
    removeClient,
    distribute,
    distributeFrameData,
    distributeTelemetryData,
    distributeCorrelatedData,
    getStats,
    getClientCount,
    cleanup
  };
};

// Helper functions
const serializeFrameData = (data: FrameData): Uint8Array => {
  // Simple serialization - in production would use more efficient format
  const json = JSON.stringify({
    ...data,
    timestamp: data.timestamp.toString(),
    data: Array.from(data.data)
  });
  return new TextEncoder().encode(json);
};

const compressFrameData = async (data: FrameData): Promise<Uint8Array> => {
  // Placeholder for compression - would use efficient image compression
  return serializeFrameData(data);
};

const compressJsonData = async (data: unknown): Promise<string> => {
  // Handle BigInt serialization for JSON
  return JSON.stringify(data, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
};

const sendToClient = async (
  clientId: string,
  data: string | Uint8Array,
  options: DistributionOptions
): Promise<void> => {
  // Placeholder for actual transport implementation
  // Would delegate to WebSocket, HTTP, MQTT distributors
  await new Promise(resolve => setTimeout(resolve, 1));
};