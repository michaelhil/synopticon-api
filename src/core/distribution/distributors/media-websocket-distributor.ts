/**
 * Media WebSocket Distributor
 * Enhanced WebSocket distributor for efficient audio/video streaming
 * Following functional programming patterns with factory functions
 */

import { createWebSocketDistributor, WebSocketDistributor } from './websocket-distributor.ts';
import { createBaseDistributor, DistributorCapabilities } from '../base-distributor.ts';
import { createLogger } from '../../../shared/utils/logger.ts';

const logger = createLogger({ level: 2 });

// Stream configuration interface
export interface StreamConfig {
  type?: 'video' | 'audio' | 'mixed';
  quality?: 'ultra' | 'high' | 'medium' | 'low';
  [key: string]: any;
}

// Stream information interface
export interface StreamInfo {
  id: string;
  type: 'video' | 'audio' | 'mixed';
  quality: 'ultra' | 'high' | 'medium' | 'low';
  subscribers: ClientSubscription[];
  startTime: number;
  frameCount: number;
  config: StreamConfig;
}

// Client subscription interface
export interface ClientSubscription {
  id: string;
  ws: any;
  connected: boolean;
  subscribedAt: number;
  [key: string]: any;
}

// Media message header interface
export interface MediaMessageHeader {
  type: string;
  streamId: string;
  timestamp: number;
  sequence: number;
  compression: string;
}

// Media message payload interface
export interface MediaMessagePayload {
  data?: ArrayBuffer | Uint8Array;
  format?: string;
  width?: number;
  height?: number;
  frameType?: string;
  quality?: string;
}

// Complete media message interface
export interface MediaMessage {
  header: MediaMessageHeader;
  payload: MediaMessagePayload;
}

// Frame metadata interface
export interface FrameMetadata {
  format?: string;
  width?: number;
  height?: number;
  frameType?: string;
  quality?: string;
}

// Subscription options interface
export interface SubscriptionOptions {
  quality?: string;
  [key: string]: any;
}

// Quality profile interface
export interface QualityProfile {
  maxBitrate: string;
  priority: number;
}

// Streaming stats interface
export interface StreamingStats {
  framesSent: number;
  bytesStreamed: number;
  droppedFrames: number;
  activeConnections: number;
  activeStreams: number;
  totalSubscribers: number;
  averageFrameSize: number;
  dropRate: number;
}

// Stream info summary interface
export interface StreamInfoSummary {
  streamId: string;
  type: string;
  quality: string;
  subscriberCount: number;
  frameCount: number;
  uptime: number;
}

// Media WebSocket distributor configuration interface
export interface MediaWebSocketDistributorConfig {
  name?: string;
  port?: number;
  host?: string;
  binaryType?: string;
  compression?: boolean;
  maxPayload?: number;
  heartbeatInterval?: number;
  enabled?: boolean;
}

// Enhanced media WebSocket distributor interface
export interface MediaWebSocketDistributor extends WebSocketDistributor {
  // Media streaming methods
  sendMediaFrame: (streamId: string, frameData: ArrayBuffer | Uint8Array, metadata?: FrameMetadata) => Promise<any>;
  startStream: (streamId: string, streamConfig?: StreamConfig) => Promise<any>;
  stopStream: (streamId: string) => Promise<any>;
  subscribeToStream: (clientInfo: any, streamId: string, subscriptionOptions?: SubscriptionOptions) => any;
  unsubscribeFromStream: (clientId: string, streamId: string) => any;
  
  // Stream management
  getActiveStreams: () => StreamInfoSummary[];
  getStreamingStats: () => StreamingStats;
  
  // Message handling
  handleClientMessage: (ws: any, message: string | ArrayBuffer) => void;
  
  // Encoding utilities
  encodeMediaMessage: (message: MediaMessage) => ArrayBuffer | string;
  decodeMediaMessage: (binaryData: ArrayBuffer | string) => MediaMessage | null;
  
  // Configuration
  getQualityProfiles: () => Record<string, QualityProfile>;
  updateQualityProfile: (profile: string, settings: Partial<QualityProfile>) => void;
  
  // Enhanced capabilities
  capabilities: string[];
  protocol: 'media-websocket';
}

/**
 * Create media-optimized WebSocket distributor
 */
export const createMediaWebSocketDistributor = (config: MediaWebSocketDistributorConfig = {}): MediaWebSocketDistributor => {
  const baseDistributor = createWebSocketDistributor({
    ...config,
    compression: config.compression !== false,
    maxPayload: config.maxPayload || 2 * 1024 * 1024, // 2MB for video frames
    heartbeatInterval: config.heartbeatInterval || 30000
  });

  const state = {
    activeStreams: new Map<string, StreamInfo>(),
    clients: new Set<any>(),
    sequenceNumbers: new Map<string, number>(),
    frameQueues: new Map<string, any[]>(),
    qualityProfiles: {
      ultra: { maxBitrate: '8M', priority: 4 },
      high: { maxBitrate: '4M', priority: 3 },
      medium: { maxBitrate: '1.5M', priority: 2 },
      low: { maxBitrate: '500k', priority: 1 }
    } as Record<string, QualityProfile>,
    stats: {
      framesSent: 0,
      bytesStreamed: 0,
      droppedFrames: 0,
      activeConnections: 0
    }
  };

  // Generate next sequence number for a stream
  const getNextSequence = (streamId: string): number => {
    const current = state.sequenceNumbers.get(streamId) || 0;
    const next = current + 1;
    state.sequenceNumbers.set(streamId, next);
    return next;
  };

  // Encode media message for binary transmission
  const encodeMediaMessage = (message: MediaMessage): ArrayBuffer | string => {
    try {
      // Create a structured binary message
      const headerJson = JSON.stringify(message.header);
      const headerBuffer = new TextEncoder().encode(headerJson);
      const headerLength = headerBuffer.length;
      
      // Calculate total size
      const payloadSize = message.payload.data ? message.payload.data.byteLength : 0;
      const totalSize = 4 + 4 + headerLength + payloadSize; // header length + payload length + header + payload
      
      // Create binary message
      const binaryMessage = new ArrayBuffer(totalSize);
      const view = new DataView(binaryMessage);
      let offset = 0;
      
      // Write header length
      view.setUint32(offset, headerLength, true);
      offset += 4;
      
      // Write payload length
      view.setUint32(offset, payloadSize, true);
      offset += 4;
      
      // Write header
      new Uint8Array(binaryMessage, offset, headerLength).set(new Uint8Array(headerBuffer));
      offset += headerLength;
      
      // Write payload data if present
      if (message.payload.data && payloadSize > 0) {
        new Uint8Array(binaryMessage, offset).set(new Uint8Array(message.payload.data));
      }
      
      return binaryMessage;
    } catch (error) {
      console.error('Failed to encode media message:', error);
      // Fallback to JSON encoding
      return JSON.stringify(message);
    }
  };

  // Decode binary media message
  const decodeMediaMessage = (binaryData: ArrayBuffer | string): MediaMessage | null => {
    try {
      if (typeof binaryData === 'string') {
        return JSON.parse(binaryData);
      }
      
      const view = new DataView(binaryData);
      let offset = 0;
      
      // Read header length
      const headerLength = view.getUint32(offset, true);
      offset += 4;
      
      // Read payload length
      const payloadLength = view.getUint32(offset, true);
      offset += 4;
      
      // Read header JSON
      const headerBuffer = new Uint8Array(binaryData, offset, headerLength);
      const headerJson = new TextDecoder().decode(headerBuffer);
      const header = JSON.parse(headerJson);
      offset += headerLength;
      
      // Read payload data
      const payload: MediaMessagePayload = {};
      if (payloadLength > 0) {
        payload.data = binaryData.slice(offset, offset + payloadLength);
      }
      
      return { header, payload };
    } catch (error) {
      console.error('Failed to decode media message:', error);
      return null;
    }
  };

  // Send media frame to clients
  const sendMediaFrame = async (streamId: string, frameData: ArrayBuffer | Uint8Array, metadata: FrameMetadata = {}): Promise<any> => {
    const startTime = Date.now();
    
    try {
      if (!state.activeStreams.has(streamId)) {
        throw new Error(`Stream ${streamId} not active`);
      }

      const message: MediaMessage = {
        header: {
          type: 'STREAM_DATA',
          streamId,
          timestamp: Date.now(),
          sequence: getNextSequence(streamId),
          compression: config.compression ? 'lz4' : 'none'
        },
        payload: {
          data: frameData,
          format: metadata.format || 'rgba',
          width: metadata.width,
          height: metadata.height,
          frameType: metadata.frameType || 'data',
          quality: metadata.quality || 'medium'
        }
      };

      // Encode for efficient transmission
      const binaryMessage = encodeMediaMessage(message);
      
      // Get subscribed clients for this stream
      const streamInfo = state.activeStreams.get(streamId)!;
      const subscribedClients = streamInfo.subscribers || [];
      
      let sentCount = 0;
      let errorCount = 0;

      // Send to each subscribed client
      for (const clientInfo of subscribedClients) {
        if (clientInfo.connected && clientInfo.ws.readyState === 1) { // WebSocket.OPEN
          try {
            clientInfo.ws.send(binaryMessage);
            sentCount++;
          } catch (error) {
            console.warn(`Failed to send frame to client ${clientInfo.id}:`, error);
            errorCount++;
          }
        }
      }

      // Update statistics
      const frameSize = binaryMessage instanceof ArrayBuffer ? binaryMessage.byteLength : binaryMessage.length;
      state.stats.framesSent++;
      state.stats.bytesStreamed += frameSize;
      
      if (errorCount > 0) {
        state.stats.droppedFrames += errorCount;
      }

      // Update stream frame count
      streamInfo.frameCount++;

      const duration = Date.now() - startTime;
      
      return {
        success: sentCount > 0,
        streamId,
        frameSize,
        sentToClients: sentCount,
        errors: errorCount,
        duration
      };

    } catch (error) {
      console.error(`Failed to send media frame for stream ${streamId}:`, error);
      throw error;
    }
  };

  // Start media stream
  const startStream = async (streamId: string, streamConfig: StreamConfig = {}): Promise<any> => {
    try {
      if (state.activeStreams.has(streamId)) {
        throw new Error(`Stream ${streamId} already active`);
      }

      const streamInfo: StreamInfo = {
        id: streamId,
        type: streamConfig.type || 'video',
        quality: streamConfig.quality || 'medium',
        subscribers: [],
        startTime: Date.now(),
        frameCount: 0,
        config: streamConfig
      };

      state.activeStreams.set(streamId, streamInfo);
      state.sequenceNumbers.set(streamId, 0);

      console.log(`🎬 Started media stream: ${streamId} (${streamInfo.type}, ${streamInfo.quality})`);

      // Broadcast stream availability to clients
      const announcement = {
        type: 'STREAM_STARTED',
        streamId,
        streamInfo: {
          type: streamInfo.type,
          quality: streamInfo.quality,
          config: streamInfo.config
        }
      };

      await baseDistributor.broadcast('stream_announcement', announcement);

      return {
        success: true,
        streamId,
        streamInfo
      };

    } catch (error) {
      console.error(`Failed to start stream ${streamId}:`, error);
      throw error;
    }
  };

  // Stop media stream
  const stopStream = async (streamId: string): Promise<any> => {
    try {
      if (!state.activeStreams.has(streamId)) {
        return { success: true, message: 'Stream not active' };
      }

      const streamInfo = state.activeStreams.get(streamId)!;
      const duration = Date.now() - streamInfo.startTime;

      // Clean up
      state.activeStreams.delete(streamId);
      state.sequenceNumbers.delete(streamId);

      console.log(`🛑 Stopped media stream: ${streamId} (${duration}ms duration)`);

      // Notify clients
      const announcement = {
        type: 'STREAM_STOPPED',
        streamId,
        stats: {
          duration,
          frameCount: streamInfo.frameCount
        }
      };

      await baseDistributor.broadcast('stream_announcement', announcement);

      return {
        success: true,
        streamId,
        duration,
        frameCount: streamInfo.frameCount
      };

    } catch (error) {
      console.error(`Failed to stop stream ${streamId}:`, error);
      throw error;
    }
  };

  // Subscribe client to stream
  const subscribeToStream = (clientInfo: any, streamId: string, subscriptionOptions: SubscriptionOptions = {}): any => {
    try {
      const streamInfo = state.activeStreams.get(streamId);
      if (!streamInfo) {
        throw new Error(`Stream ${streamId} not found`);
      }

      // Check if client already subscribed
      const existingIndex = streamInfo.subscribers.findIndex(sub => sub.id === clientInfo.id);
      if (existingIndex !== -1) {
        // Update existing subscription
        streamInfo.subscribers[existingIndex] = {
          ...streamInfo.subscribers[existingIndex],
          ...subscriptionOptions
        };
      } else {
        // Add new subscription
        streamInfo.subscribers.push({
          ...clientInfo,
          subscribedAt: Date.now(),
          ...subscriptionOptions
        });
      }

      console.log(`📡 Client ${clientInfo.id} subscribed to stream ${streamId}`);

      return {
        success: true,
        streamId,
        clientId: clientInfo.id,
        subscriberCount: streamInfo.subscribers.length
      };

    } catch (error) {
      console.error(`Failed to subscribe client to stream:`, error);
      throw error;
    }
  };

  // Unsubscribe client from stream
  const unsubscribeFromStream = (clientId: string, streamId: string): any => {
    try {
      const streamInfo = state.activeStreams.get(streamId);
      if (!streamInfo) {
        return { success: true, message: 'Stream not found' };
      }

      const index = streamInfo.subscribers.findIndex(sub => sub.id === clientId);
      if (index !== -1) {
        streamInfo.subscribers.splice(index, 1);
        console.log(`📡 Client ${clientId} unsubscribed from stream ${streamId}`);
      }

      return {
        success: true,
        streamId,
        clientId,
        subscriberCount: streamInfo.subscribers.length
      };

    } catch (error) {
      console.error(`Failed to unsubscribe client from stream:`, error);
      throw error;
    }
  };

  // Get streaming statistics
  const getStreamingStats = (): StreamingStats => ({
    ...state.stats,
    activeStreams: state.activeStreams.size,
    totalSubscribers: Array.from(state.activeStreams.values())
      .reduce((sum, stream) => sum + stream.subscribers.length, 0),
    averageFrameSize: state.stats.framesSent > 0 ? 
      state.stats.bytesStreamed / state.stats.framesSent : 0,
    dropRate: state.stats.framesSent > 0 ? 
      (state.stats.droppedFrames / state.stats.framesSent) * 100 : 0
  });

  // Get active streams info
  const getActiveStreams = (): StreamInfoSummary[] => {
    return Array.from(state.activeStreams.entries()).map(([streamId, info]) => ({
      streamId,
      type: info.type,
      quality: info.quality,
      subscriberCount: info.subscribers.length,
      frameCount: info.frameCount,
      uptime: Date.now() - info.startTime
    }));
  };

  // Enhanced message handler for media streaming
  const handleClientMessage = (ws: any, message: string | ArrayBuffer): void => {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : decodeMediaMessage(message);
      if (!data) return;

      const { type } = data as any;

      switch (type) {
        case 'SUBSCRIBE_STREAM':
          const clientInfo = Array.from(baseDistributor.getClients()).find(c => c.ws === ws);
          if (clientInfo) {
            subscribeToStream(clientInfo, (data as any).streamId, (data as any).options);
            ws.send(JSON.stringify({
              type: 'SUBSCRIPTION_SUCCESS',
              streamId: (data as any).streamId
            }));
          }
          break;

        case 'UNSUBSCRIBE_STREAM':
          const client = Array.from(baseDistributor.getClients()).find(c => c.ws === ws);
          if (client) {
            unsubscribeFromStream(client.id, (data as any).streamId);
            ws.send(JSON.stringify({
              type: 'UNSUBSCRIPTION_SUCCESS',
              streamId: (data as any).streamId
            }));
          }
          break;

        case 'REQUEST_STREAMS':
          ws.send(JSON.stringify({
            type: 'STREAMS_LIST',
            streams: getActiveStreams()
          }));
          break;

        case 'QUALITY_CHANGE':
          // Handle quality change requests
          const streamInfo = state.activeStreams.get((data as any).streamId);
          if (streamInfo) {
            streamInfo.quality = (data as any).quality;
            ws.send(JSON.stringify({
              type: 'QUALITY_CHANGED',
              streamId: (data as any).streamId,
              quality: (data as any).quality
            }));
          }
          break;

        default:
          // Forward to base distributor
          if ((baseDistributor as any).handleClientMessage) {
            (baseDistributor as any).handleClientMessage(ws, message);
          }
      }

    } catch (error) {
      console.error('Error handling media client message:', error);
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  // Return enhanced distributor
  const mediaDistributor: MediaWebSocketDistributor = {
    ...baseDistributor,
    
    // Override and extend base methods
    capabilities: [
      ...baseDistributor.getCapabilities(),
      'media_streaming',
      'adaptive_quality'
    ],

    // Media streaming methods
    sendMediaFrame,
    startStream,
    stopStream,
    subscribeToStream,
    unsubscribeFromStream,
    
    // Stream management
    getActiveStreams,
    getStreamingStats,
    
    // Message handling
    handleClientMessage,
    
    // Encoding utilities
    encodeMediaMessage,
    decodeMediaMessage,
    
    // Configuration
    getQualityProfiles: (): Record<string, QualityProfile> => ({ ...state.qualityProfiles }),
    updateQualityProfile: (profile: string, settings: Partial<QualityProfile>): void => {
      state.qualityProfiles[profile] = { ...state.qualityProfiles[profile], ...settings };
    },
    
    // Protocol identifier
    protocol: 'media-websocket'
  };

  return mediaDistributor;
};

