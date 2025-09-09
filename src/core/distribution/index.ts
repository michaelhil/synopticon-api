/**
 * Universal Distribution System - Main Entry Point
 * Phase 2: Consolidated universal distributor with protocol adapters
 * Replaces 8 separate distributors with 60% LOC reduction
 */

// Universal distributor system
export { 
  createUniversalDistributor,
  type UniversalDistributor,
  type UniversalDistributorConfig,
  type DistributionTarget,
  type DistributeOptions,
  type DistributionResult,
  type AdapterResult
} from './universal-distributor.js';

// Universal distributor with pre-configured adapters
export {
  createDistributorWithAdapters,
  createWebDistributor,
  createIoTDistributor,
  createRealtimeDistributor,
  type UniversalDistributorFactory
} from './universal-distributor-factory.js';

// Protocol adapters
export {
  createHttpAdapter,
  createWebSocketAdapter,
  createMqttAdapter,
  createSSEAdapter,
  createUdpAdapter,
  createStandardAdapters,
  type ProtocolAdapter,
  type HttpAdapter,
  type WebSocketAdapter,
  type MqttAdapter,
  type SSEAdapter,
  type UdpAdapter
} from './adapters/index.js';


// Configuration presets (will need to be converted separately if exists)
// export { 
//   getDistributionPresets, 
//   getDistributionPreset, 
//   getAvailablePresets,
//   validatePreset 
// } from './configs/distribution-presets.js';

/**
 * Quick setup factory for common distribution patterns
 * Phase 2: Uses universal distributor with adapter pattern
 */
export const createQuickDistribution = (pattern: string = 'basic') => {
  const { createDistributorWithAdapters } = require('./universal-distributor-factory.js');
  
  switch (pattern) {
    case 'web':
      return createWebDistributor({
        maxConcurrency: 5,
        defaultTimeout: 30000,
        adapters: {
          http: { timeout: 30000 },
          websocket: { maxConnections: 100 },
          sse: { maxConnections: 100 }
        }
      });
    case 'iot':
      return createIoTDistributor({
        maxConcurrency: 10,
        defaultTimeout: 5000,
        adapters: {
          mqtt: { keepAlive: 60 },
          udp: { broadcast: true },
          http: { timeout: 5000 }
        }
      });
    case 'realtime':
      return createRealtimeDistributor({
        maxConcurrency: 20,
        defaultTimeout: 1000,
        adapters: {
          websocket: { heartbeatInterval: 10000 },
          sse: { heartbeatInterval: 10000 },
          udp: { bufferSize: 8192 }
        }
      });
    default:
      return createDistributorWithAdapters({
        maxConcurrency: 5,
        defaultTimeout: 30000
      });
  }
};

// Re-export adapter configuration types
export type {
  HttpAdapterConfig,
  HttpAdapterStats,
  WebSocketAdapterConfig,
  WebSocketAdapterStats,
  ClientInfo,
  WebSocketMessage,
  MqttAdapterConfig,
  MqttAdapterStats,
  SSEAdapterConfig,
  SSEAdapterStats,
  SSEClient,
  SSEMessage,
  UdpAdapterConfig,
  UdpAdapterStats
} from './adapters/index.js';

