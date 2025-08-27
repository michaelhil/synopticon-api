/**
 * Multi-Distribution System - Main Entry Point
 * Modular distribution architecture for multiple communication protocols
 */

// Core distribution components
export { createDistributionManager, type DistributionManager } from './distribution-manager.ts';
export { createDistributionConfigManager, type DistributionConfigManager } from './distribution-config-manager.ts';
export { createBaseDistributor, type BaseDistributor, DistributorCapabilities } from './base-distributor.ts';

// Protocol-specific distributors
export { createHttpDistributor, type HttpDistributor } from './distributors/http-distributor.ts';
export { createWebSocketDistributor, type WebSocketDistributor } from './distributors/websocket-distributor.ts';
export { createMqttDistributor, type MqttDistributor } from './distributors/mqtt-distributor-builtin.ts';
export { createUdpDistributor, type UdpDistributor } from './distributors/udp-distributor.ts';
export { createSseDistributor, type SseDistributor } from './distributors/sse-distributor.ts';

// Enhanced/Specialized distributors
export { createMediaWebSocketDistributor, type MediaWebSocketDistributor } from './distributors/media-websocket-distributor.ts';

// Bun-optimized distributors
export { 
  createHttpDistributor as createHttpDistributorBun, 
  type BunHttpDistributor 
} from './distributors/http-distributor-bun.ts';
export { 
  createWebSocketDistributor as createWebSocketDistributorBun, 
  type BunWebSocketDistributor 
} from './distributors/websocket-distributor-bun.ts';

// Configuration presets (will need to be converted separately if exists)
// export { 
//   getDistributionPresets, 
//   getDistributionPreset, 
//   getAvailablePresets,
//   validatePreset 
// } from './configs/distribution-presets.ts';

/**
 * Quick setup factory for common distribution patterns
 */
export const createQuickDistribution = (pattern: string = 'basic') => {
  // For now, create a basic distribution manager
  // TODO: Implement distribution presets when converted
  console.warn('Distribution presets not yet converted to TypeScript. Using basic configuration.');
  
  const { createDistributionManager } = require('./distribution-manager.ts');
  return createDistributionManager({
    enableHealthCheck: true,
    healthCheckInterval: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  });
};

// Re-export key interfaces for external use
export type {
  // Configuration interfaces
  DistributionManagerConfig,
  DistributionResponse,
  DistributionResult,
  HealthCheckResult
} from './distribution-manager.ts';

export type {
  // Base distributor interfaces
  DistributorCapabilities,
  DistributorEvents,
  DistributorHealth,
  DistributorStats,
  SendOptions,
  EventCallback
} from './base-distributor.ts';

export type {
  // HTTP distributor interfaces
  HttpDistributorConfig,
  HttpSendResult,
  HttpBroadcastResult
} from './distributors/http-distributor.ts';

export type {
  // WebSocket distributor interfaces
  WebSocketDistributorConfig,
  WebSocketSendResult,
  ClientInfo,
  WebSocketHealth
} from './distributors/websocket-distributor.ts';

export type {
  // MQTT distributor interfaces
  MqttDistributorConfig,
  MqttSendResult,
  MqttBroadcastResult,
  MqttHealth
} from './distributors/mqtt-distributor-builtin.ts';

export type {
  // UDP distributor interfaces
  UdpDistributorConfig,
  UdpSendResult,
  UdpTarget,
  UdpHealth
} from './distributors/udp-distributor.ts';

export type {
  // SSE distributor interfaces
  SseDistributorConfig,
  SseSendResult,
  SseClientInfo,
  SseHealth
} from './distributors/sse-distributor.ts';

export type {
  // Media WebSocket distributor interfaces
  MediaWebSocketDistributorConfig,
  StreamConfig,
  StreamInfo,
  MediaMessage,
  FrameMetadata,
  StreamingStats
} from './distributors/media-websocket-distributor.ts';