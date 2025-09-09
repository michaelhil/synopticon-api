/**
 * MQTT Protocol Adapter
 * Consolidation of mqtt-distributor-builtin.ts
 * Zero external dependencies, built-in MQTT client
 */

import { ProtocolAdapter, AdapterResult } from '../universal-distributor.js';
import { createLogger } from '../../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface MqttAdapterConfig {
  host?: string;
  port?: number;
  clientId?: string;
  username?: string;
  password?: string;
  keepAlive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  topicPrefix?: string;
}

export interface MqttAdapterStats {
  messagesPublished: number;
  messagesReceived: number;
  bytesTransmitted: number;
  connectionAttempts: number;
  successfulConnections: number;
  lastPublishTime: number | null;
  connected: boolean;
}

// Simple MQTT message structure for built-in client
interface MqttMessage {
  topic: string;
  payload: Buffer;
  qos: 0 | 1 | 2;
  retain: boolean;
}

// MQTT Adapter Factory (ADR 004/005 compliant)
export const createMqttAdapter = (config: MqttAdapterConfig = {}): ProtocolAdapter => {
  const state = {
    connection: null as any,
    connected: false,
    stats: {
      messagesPublished: 0,
      messagesReceived: 0,
      bytesTransmitted: 0,
      connectionAttempts: 0,
      successfulConnections: 0,
      lastPublishTime: null as number | null,
      connected: false,
    },
    config: {
      host: 'localhost',
      port: 1883,
      clientId: `synopticon_${Date.now()}`,
      keepAlive: 60,
      connectTimeout: 30000,
      reconnectPeriod: 1000,
      qos: 0 as 0 | 1 | 2,
      retain: false,
      topicPrefix: 'synopticon',
      ...config,
    },
  };

  // Create MQTT connection using built-in TCP
  const connect = async (): Promise<boolean> => {
    if (state.connected && state.connection) {
      return true;
    }

    try {
      state.stats = {
        ...state.stats,
        connectionAttempts: state.stats.connectionAttempts + 1,
      };

      // Use Bun's native TCP socket for MQTT connection
      const connection = await Bun.connect({
        hostname: state.config.host,
        port: state.config.port,
        socket: {
          data: handleIncomingData,
          open: handleConnectionOpen,
          close: handleConnectionClose,
          error: handleConnectionError,
        },
      });

      state.connection = connection;
      
      // Send MQTT CONNECT packet
      await sendConnectPacket();
      
      return true;
    } catch (error) {
      logger.error(`MQTT connection failed: ${error}`);
      return false;
    }
  };

  // Handle incoming MQTT data
  const handleIncomingData = (socket: any, data: Buffer): void => {
    try {
      // Parse MQTT packet (simplified implementation)
      const packet = parseMqttPacket(data);
      
      if (packet.type === 'CONNACK') {
        state.connected = true;
        state.stats = {
          ...state.stats,
          connected: true,
          successfulConnections: state.stats.successfulConnections + 1,
        };
        logger.info('MQTT connection established');
      }
      
      state.stats = {
        ...state.stats,
        messagesReceived: state.stats.messagesReceived + 1,
      };
    } catch (error) {
      logger.warn(`MQTT packet parsing error: ${error}`);
    }
  };

  // Handle connection events
  const handleConnectionOpen = (): void => {
    logger.debug('MQTT TCP connection opened');
  };

  const handleConnectionClose = (): void => {
    state.connected = false;
    state.connection = null;
    state.stats = { ...state.stats, connected: false };
    logger.debug('MQTT connection closed');
  };

  const handleConnectionError = (error: any): void => {
    logger.error(`MQTT connection error: ${error}`);
    state.connected = false;
    state.stats = { ...state.stats, connected: false };
  };

  // Send MQTT CONNECT packet
  const sendConnectPacket = async (): Promise<void> => {
    const connectPacket = buildConnectPacket();
    await state.connection.write(connectPacket);
  };

  // Build MQTT CONNECT packet (simplified)
  const buildConnectPacket = (): Buffer => {
    const clientId = state.config.clientId || '';
    const protocolName = 'MQTT';
    const protocolVersion = 4; // MQTT 3.1.1
    
    // Calculate packet length
    let variableHeader = Buffer.alloc(10);
    variableHeader.writeUInt16BE(protocolName.length, 0);
    variableHeader.write(protocolName, 2);
    variableHeader.writeUInt8(protocolVersion, 6);
    variableHeader.writeUInt8(0x02, 7); // Connect flags (clean session)
    variableHeader.writeUInt16BE(state.config.keepAlive, 8);
    
    let payload = Buffer.alloc(2 + clientId.length);
    payload.writeUInt16BE(clientId.length, 0);
    payload.write(clientId, 2);
    
    // Add username/password if provided
    if (state.config.username) {
      variableHeader[7] |= 0x80; // Username flag
      const usernameBuffer = Buffer.alloc(2 + state.config.username.length);
      usernameBuffer.writeUInt16BE(state.config.username.length, 0);
      usernameBuffer.write(state.config.username, 2);
      payload = Buffer.concat([payload, usernameBuffer]);
      
      if (state.config.password) {
        variableHeader[7] |= 0x40; // Password flag
        const passwordBuffer = Buffer.alloc(2 + state.config.password.length);
        passwordBuffer.writeUInt16BE(state.config.password.length, 0);
        passwordBuffer.write(state.config.password, 2);
        payload = Buffer.concat([payload, passwordBuffer]);
      }
    }
    
    const remainingLength = variableHeader.length + payload.length;
    const fixedHeader = Buffer.alloc(2);
    fixedHeader.writeUInt8(0x10, 0); // CONNECT packet type
    fixedHeader.writeUInt8(remainingLength, 1);
    
    return Buffer.concat([fixedHeader, variableHeader, payload]);
  };

  // Simple MQTT packet parser
  const parseMqttPacket = (data: Buffer): { type: string; payload?: any } => {
    if (data.length < 2) {
      throw new Error('Invalid MQTT packet');
    }
    
    const messageType = (data[0] >> 4) & 0x0F;
    
    switch (messageType) {
      case 2:
        return { type: 'CONNACK' };
      case 3:
        return { type: 'PUBLISH', payload: data.slice(4) };
      case 4:
        return { type: 'PUBACK' };
      default:
        return { type: 'UNKNOWN' };
    }
  };

  // Core send function (publish message)
  const send = async (data: any, targetConfig: any): Promise<AdapterResult> => {
    const startTime = Date.now();
    
    try {
      // Ensure connection
      if (!await connect()) {
        return {
          success: false,
          protocol: 'mqtt',
          error: 'Failed to connect to MQTT broker',
          code: 'CONNECTION_FAILED',
          timing: { startTime, endTime: Date.now(), duration: Date.now() - startTime },
        };
      }

      // Prepare message
      const topic = targetConfig.topic || `${state.config.topicPrefix}/data`;
      const qos = targetConfig.qos ?? state.config.qos;
      const retain = targetConfig.retain ?? state.config.retain;
      
      // Serialize data
      const payload = typeof data === 'string' 
        ? Buffer.from(data, 'utf-8')
        : Buffer.from(JSON.stringify(data), 'utf-8');
      
      const message: MqttMessage = { topic, payload, qos, retain };
      
      // Build PUBLISH packet
      const publishPacket = buildPublishPacket(message);
      
      // Send packet
      await state.connection.write(publishPacket);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Update stats
      state.stats = {
        ...state.stats,
        messagesPublished: state.stats.messagesPublished + 1,
        bytesTransmitted: state.stats.bytesTransmitted + payload.length,
        lastPublishTime: endTime,
      };

      return {
        success: true,
        protocol: 'mqtt',
        data: {
          topic,
          payloadSize: payload.length,
          qos,
          retain,
        },
        timing: { startTime, endTime, duration },
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown MQTT error';
      
      return {
        success: false,
        protocol: 'mqtt',
        error: errorMessage,
        code: 'PUBLISH_FAILED',
        timing: { startTime, endTime, duration: endTime - startTime },
      };
    }
  };

  // Build MQTT PUBLISH packet
  const buildPublishPacket = (message: MqttMessage): Buffer => {
    const topicBuffer = Buffer.from(message.topic, 'utf-8');
    
    // Variable header: topic length + topic + packet identifier (if QoS > 0)
    let variableHeader = Buffer.alloc(2 + topicBuffer.length + (message.qos > 0 ? 2 : 0));
    let offset = 0;
    
    // Topic length and topic
    variableHeader.writeUInt16BE(topicBuffer.length, offset);
    offset += 2;
    topicBuffer.copy(variableHeader, offset);
    offset += topicBuffer.length;
    
    // Packet identifier for QoS > 0
    if (message.qos > 0) {
      variableHeader.writeUInt16BE(1, offset); // Simple packet ID
    }
    
    // Fixed header
    const remainingLength = variableHeader.length + message.payload.length;
    const fixedHeader = Buffer.alloc(2);
    
    let flags = 0x30; // PUBLISH packet type
    if (message.retain) flags |= 0x01;
    if (message.qos === 1) flags |= 0x02;
    if (message.qos === 2) flags |= 0x04;
    
    fixedHeader.writeUInt8(flags, 0);
    fixedHeader.writeUInt8(remainingLength, 1);
    
    return Buffer.concat([fixedHeader, variableHeader, message.payload]);
  };

  // Health check function
  const healthCheck = async (): Promise<boolean> => {
    try {
      if (!state.connected) {
        return await connect();
      }
      return true;
    } catch (error) {
      logger.debug(`MQTT adapter health check failed: ${error}`);
      return false;
    }
  };

  // Configuration update
  const configure = (newConfig: any): void => {
    state.config = { ...state.config, ...newConfig };
    logger.debug('MQTT adapter configuration updated');
    
    // Reconnect if connection parameters changed
    if (state.connected && (newConfig.host || newConfig.port)) {
      disconnect();
    }
  };

  // Disconnect from MQTT broker
  const disconnect = async (): Promise<void> => {
    if (state.connection) {
      try {
        // Send DISCONNECT packet
        const disconnectPacket = Buffer.from([0xE0, 0x00]);
        await state.connection.write(disconnectPacket);
        state.connection.end();
      } catch (error) {
        logger.warn(`Error during MQTT disconnect: ${error}`);
      }
      
      state.connection = null;
      state.connected = false;
      state.stats = { ...state.stats, connected: false };
    }
  };

  // Get current statistics
  const getStats = (): MqttAdapterStats => ({ ...state.stats });

  // Return adapter instance
  return {
    protocol: 'mqtt',
    capabilities: ['pub-sub', 'topics', 'qos', 'retained-messages'],
    send,
    healthCheck,
    configure,
    
    // Additional MQTT-specific methods
    getStats,
    disconnect,
    getConfig: () => ({ ...state.config }),
  };
};

export type MqttAdapter = ReturnType<typeof createMqttAdapter>;