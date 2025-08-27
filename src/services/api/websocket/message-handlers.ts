/**
 * WebSocket Message Handlers - TypeScript
 * Processes different types of WebSocket messages with MediaPipe integration
 */

import { createMediaStreamHandler } from './media-stream-handler.ts';

// Type definitions for MediaPipe integration
export interface MediaPipeAnalysisMessage {
  type: 'mediapipe_analysis';
  sessionId: string;
  streamId: string;
  timestamp: number;
  landmarks: FaceLandmarks;
  pose: HeadPose;
  emotions?: EmotionScores;
  confidence: number;
}

export interface MediaPipeConfigMessage {
  type: 'mediapipe_config';
  targetSession?: string;
  capabilities: MediaPipeCapability[];
  quality: AnalysisQuality;
  adaptiveProcessing: boolean;
}

export interface FaceLandmarks {
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>;
  boundingBox: { x: number; y: number; width: number; height: number };
  keyPoints: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    noseTip: { x: number; y: number };
    mouthCenter: { x: number; y: number };
  };
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
  confidence: number;
}

export interface EmotionScores {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
}

export type MediaPipeCapability = 
  | 'face_detection'
  | 'face_landmarks' 
  | 'pose_estimation_3dof'
  | 'emotion_analysis'
  | 'iris_tracking';

export type AnalysisQuality = 'low' | 'medium' | 'high' | 'ultra';

// Existing message types
interface FrameMessage {
  type: 'frame';
  frameId: string;
  frame?: string;
  image?: string;
}

interface ConfigureMessage {
  type: 'configure';
  requirements?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

interface PingMessage {
  type: 'ping';
  timestamp: number;
}

interface StatusMessage {
  type: 'status';
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  action: 'subscribe' | 'unsubscribe';
  topics: string | string[];
}

// WebRTC message types (existing)
interface WebRTCMessage {
  type: 'stream_frame' | 'webrtc_offer' | 'webrtc_answer' | 'webrtc_ice' | 'request_offer';
  deviceId?: string;
  timestamp?: number;
  data?: unknown;
  sdp?: unknown;
  candidate?: unknown;
  targetSession?: string;
}

// Union of all message types
export type WebSocketMessage = 
  | FrameMessage 
  | ConfigureMessage 
  | PingMessage 
  | StatusMessage 
  | SubscriptionMessage
  | WebRTCMessage
  | MediaPipeAnalysisMessage
  | MediaPipeConfigMessage;

// Session interface
interface WebSocketSession {
  id: string;
  ws: WebSocket;
  frameCount: number;
  messageCount: number;
  errors: number;
  createdAt: number;
  isProcessing: boolean;
  requirements?: Record<string, unknown>;
  metadata: {
    settings?: Record<string, unknown>;
    subscriptions?: Set<string>;
  };
}

// Dependencies interface
interface MessageHandlerDependencies {
  sessionManager: {
    getSessionByWebSocket(ws: WebSocket): WebSocketSession | null;
    createSession(ws: WebSocket, metadata?: Record<string, unknown>): WebSocketSession;
    removeSession(sessionId: string): void;
    updateSessionActivity(sessionId: string): void;
    incrementSessionError(sessionId: string): void;
    setSessionProcessing(sessionId: string, processing: boolean): void;
    getStatistics(): {
      uptime: number;
      activeConnections: number;
      totalSessions: number;
    };
    broadcast(message: unknown, filter?: (session: WebSocketSession) => boolean): number;
  };
  orchestrator: {
    getPipeline(name: string): {
      process(data: unknown): Promise<{ data?: unknown; [key: string]: unknown }>;
    } | null;
    getRegisteredPipelines(): Array<{
      name: string;
      type?: string;
      getStatus?(): string;
    }>;
  };
  initializeEmotionPipeline(): Promise<void>;
  decodeFrame(frame: string): unknown;
}

/**
 * Create WebSocket message handler system with MediaPipe support
 */
export const createWebSocketMessageHandlers = (dependencies: MessageHandlerDependencies) => {
  const {
    sessionManager,
    orchestrator,
    initializeEmotionPipeline,
    decodeFrame
  } = dependencies;
  
  // Create media streaming handler
  const mediaStreamHandler = createMediaStreamHandler();

  /**
   * Process frame analysis message
   */
  const handleFrameAnalysis = async (session: WebSocketSession, data: FrameMessage): Promise<void> => {
    try {
      session.frameCount++;
      sessionManager.updateSessionActivity(session.id);

      // Ensure emotion pipeline is loaded
      await initializeEmotionPipeline();
      
      const emotionPipeline = orchestrator.getPipeline('emotion-analysis');
      if (!emotionPipeline) {
        throw new Error('Emotion analysis pipeline not available');
      }

      // Decode frame data
      const frameData = decodeFrame(data.frame || data.image || '');
      
      // Process frame through pipeline
      const result = await emotionPipeline.process(frameData);
      
      // Send result back to client
      const response = {
        type: 'frame_result',
        sessionId: session.id,
        frameId: data.frameId,
        data: result.data || result,
        timestamp: Date.now()
      };

      session.ws.send(JSON.stringify(response));
      
    } catch (error) {
      console.error('Frame analysis error:', error);
      sessionManager.incrementSessionError(session.id);
      
      session.ws.send(JSON.stringify({
        type: 'error',
        sessionId: session.id,
        error: (error as Error).message,
        errorCode: 'FRAME_ANALYSIS_ERROR',
        timestamp: Date.now()
      }));
    }
  };

  /**
   * Process MediaPipe analysis data from client
   */
  const handleMediaPipeAnalysis = async (session: WebSocketSession, data: MediaPipeAnalysisMessage): Promise<void> => {
    try {
      sessionManager.updateSessionActivity(session.id);

      // Store analysis data for aggregation
      const analysisData = {
        sessionId: session.id,
        streamId: data.streamId,
        timestamp: data.timestamp,
        landmarks: data.landmarks,
        pose: data.pose,
        emotions: data.emotions,
        confidence: data.confidence
      };

      // Broadcast to subscribers interested in MediaPipe data
      broadcastNotification('mediapipe_analysis', analysisData);
      
      // Send acknowledgment
      session.ws.send(JSON.stringify({
        type: 'mediapipe_analysis_ack',
        sessionId: session.id,
        streamId: data.streamId,
        timestamp: Date.now()
      }));
      
    } catch (error) {
      console.error('MediaPipe analysis handling error:', error);
      sessionManager.incrementSessionError(session.id);
      
      session.ws.send(JSON.stringify({
        type: 'error',
        sessionId: session.id,
        error: (error as Error).message,
        errorCode: 'MEDIAPIPE_ANALYSIS_ERROR',
        timestamp: Date.now()
      }));
    }
  };

  /**
   * Process MediaPipe configuration message
   */
  const handleMediaPipeConfig = async (session: WebSocketSession, data: MediaPipeConfigMessage): Promise<void> => {
    try {
      sessionManager.updateSessionActivity(session.id);

      // Store MediaPipe configuration in session metadata
      if (!session.metadata.settings) {
        session.metadata.settings = {};
      }
      
      session.metadata.settings.mediaPipeConfig = {
        capabilities: data.capabilities,
        quality: data.quality,
        adaptiveProcessing: data.adaptiveProcessing
      };

      // If targeting specific session, forward the config
      if (data.targetSession) {
        const targetSession = sessionManager.getSessionByWebSocket(
          // This would need to be implemented in sessionManager
          {} as WebSocket // Placeholder - need proper session lookup
        );
        
        if (targetSession) {
          targetSession.ws.send(JSON.stringify({
            type: 'mediapipe_config_update',
            sourceSession: session.id,
            capabilities: data.capabilities,
            quality: data.quality,
            adaptiveProcessing: data.adaptiveProcessing,
            timestamp: Date.now()
          }));
        }
      }

      // Send confirmation
      session.ws.send(JSON.stringify({
        type: 'mediapipe_config_ack',
        sessionId: session.id,
        config: session.metadata.settings.mediaPipeConfig,
        timestamp: Date.now()
      }));
      
    } catch (error) {
      console.error('MediaPipe configuration error:', error);
      sessionManager.incrementSessionError(session.id);
      
      session.ws.send(JSON.stringify({
        type: 'error',
        sessionId: session.id,
        error: (error as Error).message,
        errorCode: 'MEDIAPIPE_CONFIG_ERROR',
        timestamp: Date.now()
      }));
    }
  };

  /**
   * Process configuration message
   */
  const handleConfiguration = async (session: WebSocketSession, data: ConfigureMessage): Promise<void> => {
    try {
      sessionManager.updateSessionActivity(session.id);

      // Update session requirements
      session.requirements = { ...session.requirements, ...data.requirements };
      
      // Apply any session-specific configuration
      if (data.settings) {
        session.metadata.settings = { ...session.metadata.settings, ...data.settings };
      }

      session.ws.send(JSON.stringify({
        type: 'configured',
        sessionId: session.id,
        requirements: session.requirements,
        settings: session.metadata.settings,
        timestamp: Date.now()
      }));
      
    } catch (error) {
      console.error('Configuration error:', error);
      sessionManager.incrementSessionError(session.id);
      
      session.ws.send(JSON.stringify({
        type: 'error',
        sessionId: session.id,
        error: (error as Error).message,
        errorCode: 'CONFIGURATION_ERROR',
        timestamp: Date.now()
      }));
    }
  };

  /**
   * Process ping message (keepalive)
   */
  const handlePing = (session: WebSocketSession, data: PingMessage): void => {
    sessionManager.updateSessionActivity(session.id);
    
    session.ws.send(JSON.stringify({
      type: 'pong',
      sessionId: session.id,
      clientTimestamp: data.timestamp,
      serverTimestamp: Date.now()
    }));
  };

  /**
   * Process status request message
   */
  const handleStatusRequest = (session: WebSocketSession, data: StatusMessage): void => {
    sessionManager.updateSessionActivity(session.id);
    
    const stats = sessionManager.getStatistics();
    const pipelines = orchestrator.getRegisteredPipelines();
    
    session.ws.send(JSON.stringify({
      type: 'status',
      sessionId: session.id,
      server: {
        uptime: stats.uptime,
        activeConnections: stats.activeConnections,
        totalSessions: stats.totalSessions,
        pipelines: pipelines.map(p => ({
          name: p.name,
          type: p.type || 'unknown',
          status: p.getStatus ? p.getStatus() : 'active'
        }))
      },
      session: {
        id: session.id,
        frameCount: session.frameCount,
        messageCount: session.messageCount,
        errors: session.errors,
        age: Math.round((Date.now() - session.createdAt) / 1000)
      },
      timestamp: Date.now()
    }));
  };

  /**
   * Process subscription message (for real-time updates)
   */
  const handleSubscription = (session: WebSocketSession, data: SubscriptionMessage): void => {
    sessionManager.updateSessionActivity(session.id);
    
    if (!session.metadata.subscriptions) {
      session.metadata.subscriptions = new Set();
    }
    
    const { action, topics } = data;
    const topicsArray = Array.isArray(topics) ? topics : [topics];
    
    if (action === 'subscribe') {
      topicsArray.forEach(topic => session.metadata.subscriptions!.add(topic));
    } else if (action === 'unsubscribe') {
      topicsArray.forEach(topic => session.metadata.subscriptions!.delete(topic));
    }
    
    session.ws.send(JSON.stringify({
      type: 'subscription_result',
      sessionId: session.id,
      action,
      topics: Array.from(session.metadata.subscriptions),
      timestamp: Date.now()
    }));
  };

  /**
   * Main message router
   */
  const handleMessage = async (ws: WebSocket, message: string): Promise<void> => {
    const session = sessionManager.getSessionByWebSocket(ws);
    if (!session) {
      console.warn('⚠️ Received message from unknown WebSocket session');
      return;
    }

    // Prevent concurrent message processing per session
    if (session.isProcessing) {
      console.warn(`⚠️ Session ${session.id} is busy, dropping message`);
      return;
    }

    sessionManager.setSessionProcessing(session.id, true);

    try {
      const data: WebSocketMessage = JSON.parse(message);
      
      // Route message based on type
      switch (data.type) {
        case 'frame':
          await handleFrameAnalysis(session, data);
          break;
          
        case 'configure':
          await handleConfiguration(session, data);
          break;
          
        case 'ping':
          handlePing(session, data);
          break;
          
        case 'status':
          handleStatusRequest(session, data);
          break;
          
        case 'subscribe':
        case 'unsubscribe':
          handleSubscription(session, data);
          break;
          
        case 'stream_frame':
        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice':
        case 'request_offer':
          mediaStreamHandler.handleMessage(session.id, data);
          break;

        case 'mediapipe_analysis':
          await handleMediaPipeAnalysis(session, data);
          break;

        case 'mediapipe_config':
          await handleMediaPipeConfig(session, data);
          break;
          
        default:
          throw new Error(`Unknown message type: ${(data as any).type}`);
      }
      
    } catch (error) {
      console.error('Message handling error:', error);
      sessionManager.incrementSessionError(session.id);
      
      try {
        session.ws.send(JSON.stringify({
          type: 'error',
          sessionId: session.id,
          error: (error as Error).message,
          errorCode: 'MESSAGE_HANDLING_ERROR',
          timestamp: Date.now()
        }));
      } catch (sendError) {
        console.error('Failed to send error response:', sendError);
      }
    } finally {
      sessionManager.setSessionProcessing(session.id, false);
    }
  };

  /**
   * Handle WebSocket connection open
   */
  const handleConnection = (ws: WebSocket, metadata: Record<string, unknown> = {}): WebSocketSession => {
    const session = sessionManager.createSession(ws, metadata);
    mediaStreamHandler.addSession(ws, session.id);
    return session;
  };

  /**
   * Handle WebSocket connection close
   */
  const handleDisconnection = (ws: WebSocket, code: number, reason: string): void => {
    const session = sessionManager.getSessionByWebSocket(ws);
    if (session) {
      console.log(`🔌 WebSocket disconnected: ${session.id} (${code}: ${reason})`);
      mediaStreamHandler.removeSession(session.id);
      sessionManager.removeSession(session.id);
    }
  };

  /**
   * Broadcast system notification to subscribed clients
   */
  const broadcastNotification = (topic: string, data: unknown): number => {
    const message = {
      type: 'notification',
      topic,
      data,
      timestamp: Date.now()
    };

    const filter = (session: WebSocketSession) => {
      return session.metadata.subscriptions && session.metadata.subscriptions.has(topic);
    };

    return sessionManager.broadcast(message, filter);
  };

  return {
    handleMessage,
    handleConnection,
    handleDisconnection,
    broadcastNotification,
    
    // Individual handlers (for testing)
    handlers: {
      frame: handleFrameAnalysis,
      configure: handleConfiguration,
      ping: handlePing,
      status: handleStatusRequest,
      subscription: handleSubscription,
      mediaPipeAnalysis: handleMediaPipeAnalysis,
      mediaPipeConfig: handleMediaPipeConfig
    }
  };
};