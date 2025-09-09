/**
 * Universal Distributor Factory with Integrated Adapters
 * Convenience factory that sets up distributor with common adapters
 * Follows ADR 004/005 functional programming patterns
 */

import { createUniversalDistributor, UniversalDistributorConfig } from './universal-distributor.js';
import { 
  createHttpAdapter,
  createWebSocketAdapter,
  createMqttAdapter,
  createSSEAdapter,
  createUdpAdapter
} from './adapters/index.js';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface UniversalDistributorFactoryConfig extends UniversalDistributorConfig {
  adapters?: {
    http?: any;
    websocket?: any;
    mqtt?: any;
    sse?: any;
    udp?: any;
  };
  enabledProtocols?: string[];
}

// Factory function to create distributor with adapters (ADR 004/005 compliant)
export const createDistributorWithAdapters = (config: UniversalDistributorFactoryConfig = {}) => {
  // Create universal distributor
  const distributor = createUniversalDistributor(config);
  
  // Register enabled adapters
  const enabledProtocols = config.enabledProtocols || ['http', 'websocket', 'mqtt', 'sse', 'udp'];
  const adapterConfigs = config.adapters || {};
  
  // HTTP Adapter
  if (enabledProtocols.includes('http') && adapterConfigs.http !== false) {
    try {
      const httpAdapter = createHttpAdapter(adapterConfigs.http || {});
      distributor.registerProtocol('http', httpAdapter);
      logger.info('HTTP adapter registered');
    } catch (error) {
      logger.warn(`Failed to register HTTP adapter: ${error}`);
    }
  }
  
  // WebSocket Adapter
  if (enabledProtocols.includes('websocket') && adapterConfigs.websocket !== false) {
    try {
      const wsAdapter = createWebSocketAdapter(adapterConfigs.websocket || {});
      distributor.registerProtocol('websocket', wsAdapter);
      logger.info('WebSocket adapter registered');
    } catch (error) {
      logger.warn(`Failed to register WebSocket adapter: ${error}`);
    }
  }
  
  // MQTT Adapter
  if (enabledProtocols.includes('mqtt') && adapterConfigs.mqtt !== false) {
    try {
      const mqttAdapter = createMqttAdapter(adapterConfigs.mqtt || {});
      distributor.registerProtocol('mqtt', mqttAdapter);
      logger.info('MQTT adapter registered');
    } catch (error) {
      logger.warn(`Failed to register MQTT adapter: ${error}`);
    }
  }
  
  // SSE Adapter
  if (enabledProtocols.includes('sse') && adapterConfigs.sse !== false) {
    try {
      const sseAdapter = createSSEAdapter(adapterConfigs.sse || {});
      distributor.registerProtocol('sse', sseAdapter);
      logger.info('SSE adapter registered');
    } catch (error) {
      logger.warn(`Failed to register SSE adapter: ${error}`);
    }
  }
  
  // UDP Adapter
  if (enabledProtocols.includes('udp') && adapterConfigs.udp !== false) {
    try {
      const udpAdapter = createUdpAdapter(adapterConfigs.udp || {});
      distributor.registerProtocol('udp', udpAdapter);
      logger.info('UDP adapter registered');
    } catch (error) {
      logger.warn(`Failed to register UDP adapter: ${error}`);
    }
  }
  
  logger.info(`Universal distributor created with ${distributor.getRegisteredProtocols().length} adapters`);
  
  return distributor;
};

// Convenience factory for common configurations
export const createWebDistributor = (config: any = {}) => createDistributorWithAdapters({
  ...config,
  enabledProtocols: ['http', 'websocket', 'sse'],
});

export const createIoTDistributor = (config: any = {}) => createDistributorWithAdapters({
  ...config,
  enabledProtocols: ['mqtt', 'udp', 'http'],
});

export const createRealtimeDistributor = (config: any = {}) => createDistributorWithAdapters({
  ...config,
  enabledProtocols: ['websocket', 'sse', 'udp'],
});

// Type exports
export type UniversalDistributorFactory = ReturnType<typeof createDistributorWithAdapters>;