/**
 * Universal Distribution Adapters - Centralized Exports
 * Provides all protocol adapters for the universal distributor
 */

// Core adapter interfaces
export type { ProtocolAdapter, AdapterResult } from '../universal-distributor.js';

// HTTP Adapter
export { createHttpAdapter } from './http-adapter.js';
export type { 
  HttpAdapter, 
  HttpAdapterConfig, 
  HttpAdapterStats 
} from './http-adapter.js';

// WebSocket Adapter  
export { createWebSocketAdapter } from './websocket-adapter.js';
export type { 
  WebSocketAdapter,
  WebSocketAdapterConfig,
  WebSocketAdapterStats,
  ClientInfo,
  WebSocketMessage
} from './websocket-adapter.js';

// MQTT Adapter
export { createMqttAdapter } from './mqtt-adapter.js';
export type {
  MqttAdapter,
  MqttAdapterConfig,
  MqttAdapterStats
} from './mqtt-adapter.js';

// SSE Adapter
export { createSSEAdapter } from './sse-adapter.js';
export type {
  SSEAdapter,
  SSEAdapterConfig,
  SSEAdapterStats,
  SSEClient,
  SSEMessage
} from './sse-adapter.js';

// UDP Adapter  
export { createUdpAdapter } from './udp-adapter.js';
export type {
  UdpAdapter,
  UdpAdapterConfig,
  UdpAdapterStats
} from './udp-adapter.js';

// Convenience factory for common adapter setups
export const createStandardAdapters = (config: {
  http?: any;
  websocket?: any; 
  mqtt?: any;
  sse?: any;
  udp?: any;
} = {}) => ({
  http: config.http ? createHttpAdapter(config.http) : null,
  websocket: config.websocket ? createWebSocketAdapter(config.websocket) : null,
  mqtt: config.mqtt ? createMqttAdapter(config.mqtt) : null,
  sse: config.sse ? createSSEAdapter(config.sse) : null,
  udp: config.udp ? createUdpAdapter(config.udp) : null,
});

// Protocol validation helper
export const validateProtocol = (protocol: string): boolean => {
  const supportedProtocols = ['http', 'websocket', 'mqtt', 'sse', 'udp'];
  return supportedProtocols.includes(protocol.toLowerCase());
};

// Adapter capabilities mapping
export const getAdapterCapabilities = (protocol: string): string[] => {
  const capabilityMap: Record<string, string[]> = {
    http: ['webhooks', 'rest-api', 'json-data', 'binary-data'],
    websocket: ['realtime', 'bidirectional', 'subscriptions', 'broadcast'],
    mqtt: ['pub-sub', 'topics', 'qos', 'retained-messages'],
    sse: ['server-sent-events', 'streaming', 'text-data'],
    udp: ['datagrams', 'broadcast', 'multicast', 'low-latency'],
  };
  
  return capabilityMap[protocol.toLowerCase()] || [];
};