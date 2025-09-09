/**
 * Built-in MQTT Client Implementation
 * Zero-dependency MQTT client for Synopticon API
 */

import { createMqttConnection } from './mqtt-connection.js';
import { createMqttParser } from './mqtt-parser.js';
import { createMqttPacketBuilder } from './mqtt-packet-builder.js';
import { createMqttSubscriptionManager } from './mqtt-subscription-manager.js';
import type {
  MqttClientOptions,
  MqttMessage,
  MqttSubscription,
  MqttQoS,
  MqttClientState
} from './mqtt-types.js';

/**
 * Creates a zero-dependency MQTT client
 */
export const createMqttClient = (options: MqttClientOptions = {}) => {
  const config = {
    host: options.host || 'localhost',
    port: options.port || 1883,
    clientId: options.clientId || `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    keepAlive: options.keepAlive || 60,
    reconnectInterval: options.reconnectInterval || 5000,
    username: options.username,
    password: options.password,
    cleanSession: options.cleanSession !== false,
    ...options
  };

  const state: MqttClientState = {
    connected: false,
    connecting: false,
    messageId: 1,
    lastActivity: Date.now(),
    reconnectAttempts: 0
  };

  // Initialize components
  const connection = createMqttConnection(config);
  const parser = createMqttParser();
  const packetBuilder = createMqttPacketBuilder();
  const subscriptionManager = createMqttSubscriptionManager();

  // Event handlers
  const eventHandlers = new Map<string, Set<Function>>();

  /**
   * Emit an event to registered handlers
   */
  const emit = (event: string, ...args: any[]): void => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  };

  /**
   * Register event handler
   */
  const on = (event: string, handler: Function): void => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);
  };

  /**
   * Remove event handler
   */
  const off = (event: string, handler: Function): void => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventHandlers.delete(event);
      }
    }
  };

  /**
   * Connect to MQTT broker
   */
  const connect = async (): Promise<void> => {
    if (state.connected || state.connecting) {
      return;
    }

    state.connecting = true;
    emit('connecting');

    try {
      // Establish connection
      await connection.connect();

      // Send CONNECT packet
      const connectPacket = packetBuilder.buildConnect({
        clientId: config.clientId,
        username: config.username,
        password: config.password,
        keepAlive: config.keepAlive,
        cleanSession: config.cleanSession
      });

      await connection.send(connectPacket);

      // Wait for CONNACK
      const connackTimeout = setTimeout(() => {
        throw new Error('CONNACK timeout');
      }, 5000);

      // Set up packet handler
      connection.onData(data => handleIncomingData(data));

      state.connected = true;
      state.connecting = false;
      state.reconnectAttempts = 0;
      clearTimeout(connackTimeout);

      emit('connect');
      startKeepAlive();

    } catch (error) {
      state.connecting = false;
      emit('error', error);
      handleReconnect();
      throw error;
    }
  };

  /**
   * Handle incoming data from connection
   */
  const handleIncomingData = (data: Uint8Array): void => {
    try {
      const packets = parser.parse(data);
      
      packets.forEach(packet => {
        switch (packet.type) {
        case 'CONNACK':
          handleConnAck(packet);
          break;
        case 'PUBLISH':
          handlePublish(packet);
          break;
        case 'PUBACK':
          handlePubAck(packet);
          break;
        case 'SUBACK':
          handleSubAck(packet);
          break;
        case 'UNSUBACK':
          handleUnsubAck(packet);
          break;
        case 'PINGRESP':
          handlePingResp();
          break;
        default:
          emit('packet', packet);
        }
      });
    } catch (error) {
      emit('error', error);
    }
  };

  /**
   * Handle CONNACK packet
   */
  const handleConnAck = (packet: any): void => {
    if (packet.returnCode === 0) {
      state.connected = true;
      emit('connect');
    } else {
      emit('error', new Error(`Connection refused: ${packet.returnCode}`));
    }
  };

  /**
   * Handle PUBLISH packet
   */
  const handlePublish = (packet: any): void => {
    const message: MqttMessage = {
      topic: packet.topic,
      payload: packet.payload,
      qos: packet.qos,
      retain: packet.retain
    };

    // Send acknowledgment for QoS 1
    if (packet.qos === 1) {
      const puback = packetBuilder.buildPubAck(packet.messageId);
      connection.send(puback);
    }

    // Deliver to subscription handlers
    subscriptionManager.deliver(message);
    emit('message', message);
  };

  /**
   * Handle PUBACK packet
   */
  const handlePubAck = (packet: any): void => {
    emit('puback', packet.messageId);
  };

  /**
   * Handle SUBACK packet
   */
  const handleSubAck = (packet: any): void => {
    emit('suback', packet.messageId, packet.qos);
  };

  /**
   * Handle UNSUBACK packet
   */
  const handleUnsubAck = (packet: any): void => {
    emit('unsuback', packet.messageId);
  };

  /**
   * Handle PINGRESP packet
   */
  const handlePingResp = (): void => {
    state.lastActivity = Date.now();
  };

  /**
   * Start keep-alive mechanism
   */
  const startKeepAlive = (): void => {
    const interval = setInterval(() => {
      if (!state.connected) {
        clearInterval(interval);
        return;
      }

      const timeSinceActivity = Date.now() - state.lastActivity;
      if (timeSinceActivity >= config.keepAlive * 1000) {
        const pingReq = packetBuilder.buildPingReq();
        connection.send(pingReq);
      }
    }, config.keepAlive * 500); // Check at half keepAlive interval
  };

  /**
   * Handle reconnection
   */
  const handleReconnect = (): void => {
    if (state.reconnectAttempts >= 10) {
      emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    state.reconnectAttempts++;
    setTimeout(() => {
      connect().catch(error => {
        emit('reconnect-error', error);
      });
    }, config.reconnectInterval * state.reconnectAttempts);
  };

  /**
   * Publish a message
   */
  const publish = async (
    topic: string,
    payload: string | Uint8Array,
    options: { qos?: MqttQoS; retain?: boolean } = {}
  ): Promise<void> => {
    if (!state.connected) {
      throw new Error('Not connected');
    }

    const messageId = state.messageId++;
    const packet = packetBuilder.buildPublish({
      topic,
      payload: typeof payload === 'string' ? new TextEncoder().encode(payload) : payload,
      qos: options.qos || 0,
      retain: options.retain || false,
      messageId
    });

    await connection.send(packet);

    // Wait for PUBACK if QoS 1
    if (options.qos === 1) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          off('puback', handleAck);
          reject(new Error('PUBACK timeout'));
        }, 5000);

        const handleAck = (id: number) => {
          if (id === messageId) {
            clearTimeout(timeout);
            off('puback', handleAck);
            resolve();
          }
        };

        on('puback', handleAck);
      });
    }
  };

  /**
   * Subscribe to topics
   */
  const subscribe = async (
    topics: string | string[],
    handler: (message: MqttMessage) => void,
    qos: MqttQoS = 0
  ): Promise<MqttSubscription> => {
    if (!state.connected) {
      throw new Error('Not connected');
    }

    const topicList = Array.isArray(topics) ? topics : [topics];
    const messageId = state.messageId++;

    // Register subscription
    const subscription = subscriptionManager.add(topicList, handler, qos);

    // Send SUBSCRIBE packet
    const packet = packetBuilder.buildSubscribe({
      topics: topicList.map(topic => ({ topic, qos })),
      messageId
    });

    await connection.send(packet);

    // Wait for SUBACK
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        off('suback', handleAck);
        reject(new Error('SUBACK timeout'));
      }, 5000);

      const handleAck = (id: number) => {
        if (id === messageId) {
          clearTimeout(timeout);
          off('suback', handleAck);
          resolve(subscription);
        }
      };

      on('suback', handleAck);
    });
  };

  /**
   * Unsubscribe from topics
   */
  const unsubscribe = async (topics: string | string[]): Promise<void> => {
    if (!state.connected) {
      throw new Error('Not connected');
    }

    const topicList = Array.isArray(topics) ? topics : [topics];
    const messageId = state.messageId++;

    // Remove subscription
    subscriptionManager.remove(topicList);

    // Send UNSUBSCRIBE packet
    const packet = packetBuilder.buildUnsubscribe({
      topics: topicList,
      messageId
    });

    await connection.send(packet);

    // Wait for UNSUBACK
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        off('unsuback', handleAck);
        reject(new Error('UNSUBACK timeout'));
      }, 5000);

      const handleAck = (id: number) => {
        if (id === messageId) {
          clearTimeout(timeout);
          off('unsuback', handleAck);
          resolve();
        }
      };

      on('unsuback', handleAck);
    });
  };

  /**
   * Disconnect from broker
   */
  const disconnect = async (): Promise<void> => {
    if (!state.connected) {
      return;
    }

    const packet = packetBuilder.buildDisconnect();
    await connection.send(packet);
    
    state.connected = false;
    connection.close();
    subscriptionManager.clear();
    emit('disconnect');
  };

  /**
   * Get client state
   */
  const getState = (): MqttClientState => ({ ...state });

  /**
   * Check if connected
   */
  const isConnected = (): boolean => state.connected;

  return {
    connect,
    disconnect,
    publish,
    subscribe,
    unsubscribe,
    on,
    off,
    getState,
    isConnected
  };
};

export type MqttClient = ReturnType<typeof createMqttClient>;
