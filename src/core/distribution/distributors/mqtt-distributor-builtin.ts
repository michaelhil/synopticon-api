/**
 * MQTT Distributor with Built-in Implementation
 * Handles distribution via MQTT messaging protocol using zero-dependency client
 */

import { 
  createBaseDistributor, 
  DistributorCapabilities, 
  DistributorEvents
} from '../base-distributor.js';
import { createLogger } from '../../../shared/utils/logger.ts';
import { createMqttClient } from '../mqtt/mqtt-client.js';
import type { MqttClient } from '../mqtt/mqtt-client.js';
import type { MqttMessage } from '../mqtt/mqtt-types.js';

// Base distributor types
export interface SendOptions {
  topic?: string;
  qos?: number;
  retain?: boolean;
  timeout?: number;
}

export type EventCallback = (data: any) => void;

const logger = createLogger({ level: 2 });

/**
 * MQTT-specific configuration interface
 */
export interface MqttDistributorConfig {
  name?: string;
  broker?: string;
  clientId?: string;
  username?: string;
  password?: string;
  keepalive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  topics?: Record<string, string>;
  enabled?: boolean;
  host?: string;
  port?: number;
}

/**
 * MQTT send result interface
 */
export interface MqttSendResult {
  success: boolean;
  event: string;
  topic: string;
  duration: number;
  qos: number;
  retain: boolean;
}

/**
 * MQTT broadcast result interface
 */
export interface MqttBroadcastResult {
  broadcast: boolean;
  event: string;
  results: Array<MqttSendResult & { topic: string; error?: string; }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * MQTT health information interface
 */
export interface MqttHealth {
  name: string;
  status: string;
  uptime: number;
  lastCheck: number;
  enabled: boolean;
  broker: string;
  connected: boolean;
  reconnectCount: number;
  lastMessage: number;
  subscriptions: number;
  messagesSent: number;
  messagesReceived: number;
}

/**
 * Creates MQTT distributor with built-in client
 */
export const createMqttDistributor = (config: MqttDistributorConfig = {}) => {
  // Configuration with defaults
  const distributorConfig = {
    name: config.name || 'mqtt-distributor',
    broker: config.broker || 'mqtt://localhost:1883',
    host: config.host || 'localhost',
    port: config.port || 1883,
    clientId: config.clientId || `synopticon_${Date.now()}`,
    username: config.username,
    password: config.password,
    keepalive: config.keepalive || 60,
    connectTimeout: config.connectTimeout || 5000,
    reconnectPeriod: config.reconnectPeriod || 5000,
    qos: config.qos || 0,
    retain: config.retain || false,
    enabled: config.enabled !== false,
    topics: config.topics || {
      events: 'synopticon/events',
      data: 'synopticon/data',
      commands: 'synopticon/commands'
    }
  };

  // State management
  const state = {
    config: distributorConfig,
    client: null as MqttClient | null,
    connected: false,
    connecting: false,
    startTime: Date.now(),
    reconnectCount: 0,
    lastMessage: 0,
    subscriptions: 0,
    messagesSent: 0,
    messagesReceived: 0,
    eventCallbacks: new Map<string, Set<EventCallback>>()
  };

  /**
   * Create MQTT client
   */
  const createClient = async (): Promise<MqttClient> => {
    try {
      const client = createMqttClient({
        host: distributorConfig.host,
        port: distributorConfig.port,
        clientId: distributorConfig.clientId,
        username: distributorConfig.username,
        password: distributorConfig.password,
        keepAlive: distributorConfig.keepalive,
        reconnectInterval: distributorConfig.reconnectPeriod
      });

      // Set up event handlers
      client.on('connect', () => {
        state.connected = true;
        state.connecting = false;
        logger.log(`MQTT connected to ${distributorConfig.host}:${distributorConfig.port}`);
        
        // Emit connect event to callbacks
        emitEvent('connect', { distributor: distributorConfig.name });
      });

      client.on('disconnect', () => {
        state.connected = false;
        logger.log('MQTT disconnected');
        
        emitEvent('disconnect', { distributor: distributorConfig.name });
      });

      client.on('error', (error: Error) => {
        logger.error('MQTT error:', error);
        
        emitEvent('error', { 
          distributor: distributorConfig.name, 
          error: error.message 
        });
      });

      client.on('message', (message: MqttMessage) => {
        state.messagesReceived++;
        state.lastMessage = Date.now();
        
        const messageData = {
          distributor: distributorConfig.name,
          topic: message.topic,
          payload: new TextDecoder().decode(message.payload),
          qos: message.qos,
          retain: message.retain
        };
        
        emitEvent('message', messageData);
      });

      return client;

    } catch (error) {
      logger.error('Failed to create MQTT client:', error);
      throw error;
    }
  };

  /**
   * Emit event to registered callbacks
   */
  const emitEvent = (event: string, data: any): void => {
    const callbacks = state.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  };

  /**
   * Initialize the distributor
   */
  const initialize = async (): Promise<boolean> => {
    if (!state.config.enabled) {
      logger.log('MQTT distributor disabled');
      return false;
    }

    try {
      logger.log(`Initializing MQTT distributor: ${state.config.name}`);
      
      state.client = await createClient();
      state.connecting = true;
      
      await state.client.connect();
      
      logger.log('MQTT distributor initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize MQTT distributor:', error);
      return false;
    }
  };

  /**
   * Send event to specific topic
   */
  const send = async (event: string, data: any, options: SendOptions = {}): Promise<MqttSendResult> => {
    const startTime = Date.now();
    
    if (!state.client || !state.connected) {
      throw new Error('MQTT not connected');
    }

    try {
      const topic = options.topic || state.config.topics.events || `synopticon/${event}`;
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      const qos = options.qos !== undefined ? options.qos as (0 | 1 | 2) : state.config.qos;
      const retain = options.retain !== undefined ? options.retain : state.config.retain;

      await state.client.publish(topic, payload, { qos, retain });

      state.messagesSent++;
      state.lastMessage = Date.now();

      return {
        success: true,
        event,
        topic,
        duration: Date.now() - startTime,
        qos,
        retain
      };

    } catch (error) {
      logger.error(`Failed to send MQTT message for event ${event}:`, error);
      
      return {
        success: false,
        event,
        topic: options.topic || 'unknown',
        duration: Date.now() - startTime,
        qos: state.config.qos,
        retain: state.config.retain
      };
    }
  };

  /**
   * Broadcast event to multiple topics
   */
  const broadcast = async (event: string, data: any, options: SendOptions = {}): Promise<MqttBroadcastResult> => {
    const topics = Object.values(state.config.topics);
    const results: Array<MqttSendResult & { topic: string; error?: string; }> = [];

    for (const topic of topics) {
      try {
        const result = await send(event, data, { ...options, topic });
        results.push({ ...result, topic });
      } catch (error) {
        results.push({
          success: false,
          event,
          topic,
          duration: 0,
          qos: state.config.qos,
          retain: state.config.retain,
          error: error.message
        });
      }
    }

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    return {
      broadcast: true,
      event,
      results,
      summary
    };
  };

  /**
   * Subscribe to events
   */
  const subscribe = async (eventName: string, callback: EventCallback): Promise<boolean> => {
    try {
      if (!state.eventCallbacks.has(eventName)) {
        state.eventCallbacks.set(eventName, new Set());
      }
      state.eventCallbacks.get(eventName)!.add(callback);

      // Subscribe to MQTT topic if client is available
      if (state.client && state.connected) {
        const topic = state.config.topics.events || `synopticon/${eventName}`;
        
        await state.client.subscribe(topic, (message: MqttMessage) => {
          try {
            const payload = new TextDecoder().decode(message.payload);
            let data;
            try {
              data = JSON.parse(payload);
            } catch {
              data = payload;
            }
            
            callback({
              distributor: state.config.name,
              event: eventName,
              data,
              timestamp: Date.now()
            });
          } catch (error) {
            logger.error(`Error processing subscription message for ${eventName}:`, error);
          }
        });

        state.subscriptions++;
      }

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to ${eventName}:`, error);
      return false;
    }
  };

  /**
   * Unsubscribe from events
   */
  const unsubscribe = async (eventName: string, callback?: EventCallback): Promise<boolean> => {
    try {
      const callbacks = state.eventCallbacks.get(eventName);
      
      if (callback && callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          state.eventCallbacks.delete(eventName);
        }
      } else {
        state.eventCallbacks.delete(eventName);
      }

      // Unsubscribe from MQTT topic if no more callbacks
      if (state.client && state.connected && (!callbacks || callbacks.size === 0)) {
        const topic = state.config.topics.events || `synopticon/${eventName}`;
        await state.client.unsubscribe(topic);
        state.subscriptions = Math.max(0, state.subscriptions - 1);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to unsubscribe from ${eventName}:`, error);
      return false;
    }
  };

  /**
   * Get health information
   */
  const getHealth = (): MqttHealth => ({
    name: state.config.name,
    status: state.connected ? 'connected' : state.connecting ? 'connecting' : 'disconnected',
    uptime: Date.now() - state.startTime,
    lastCheck: Date.now(),
    enabled: state.config.enabled,
    broker: `${state.config.host}:${state.config.port}`,
    connected: state.connected,
    reconnectCount: state.reconnectCount,
    lastMessage: state.lastMessage,
    subscriptions: state.subscriptions,
    messagesSent: state.messagesSent,
    messagesReceived: state.messagesReceived
  });

  /**
   * Cleanup resources
   */
  const cleanup = async (): Promise<void> => {
    try {
      if (state.client && state.connected) {
        await state.client.disconnect();
      }
      
      state.eventCallbacks.clear();
      state.connected = false;
      state.client = null;
      
      logger.log('MQTT distributor cleaned up');
    } catch (error) {
      logger.error('Error during MQTT cleanup:', error);
    }
  };

  // Create base distributor
  const baseDistributor = createBaseDistributor({
    name: distributorConfig.name,
    enabled: distributorConfig.enabled
  });

  // Set initial health status based on enabled state
  if (!distributorConfig.enabled) {
    baseDistributor._updateHealth('disconnected');
  }

  return {
    ...baseDistributor,
    
    // Override base methods with MQTT implementations
    send,
    broadcast,
    subscribe,
    unsubscribe,
    getHealth,
    cleanup,
    connect: initialize,
    
    // MQTT-specific methods
    getClient: () => state.client,
    isConnected: () => state.connected,
    getConfig: () => ({ ...state.config })
  };
};

export type MqttDistributor = ReturnType<typeof createMqttDistributor>;