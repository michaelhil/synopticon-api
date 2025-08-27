/**
 * WebSocket Media Streaming Handler
 * Handles real-time media frame transmission
 */

interface StreamFrame {
  type: 'stream_frame';
  deviceId: string;
  timestamp: number;
  data: string; // base64 encoded frame
}

interface StreamMessage {
  type: 'stream_started' | 'stream_stopped' | 'stream_data' | 'webrtc_offer' | 'webrtc_answer' | 'webrtc_ice' | 'request_offer';
  deviceId: string;
  timestamp: number;
  data?: any;
  targetSession?: string;
  sdp?: any;
  candidate?: any;
}

interface ClientSession {
  ws: WebSocket;
  id: string;
  lastSeen: number;
  isStreaming: boolean;
  deviceId?: string;
}

export const createMediaStreamHandler = () => {
  const sessions = new Map<string, ClientSession>();
  const activeStreams = new Map<string, Set<string>>(); // deviceId -> Set of sessionIds

  const addSession = (ws: WebSocket, sessionId: string) => {
    sessions.set(sessionId, {
      ws,
      id: sessionId,
      lastSeen: Date.now(),
      isStreaming: false
    });
    
    console.log(`📱 Session ${sessionId} connected`);
  };

  const removeSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (session?.deviceId) {
      stopStream(sessionId, session.deviceId);
    }
    
    sessions.delete(sessionId);
    console.log(`📱 Session ${sessionId} disconnected`);
  };

  const handleMessage = (sessionId: string, message: any) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.lastSeen = Date.now();

    switch (message.type) {
      case 'stream_frame':
        handleStreamFrame(sessionId, message as StreamFrame);
        break;
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice':
      case 'request_offer':
        handleWebRTCSignaling(sessionId, message);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  };

  const handleStreamFrame = (sessionId: string, frame: StreamFrame) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    // Update session state
    if (!session.isStreaming) {
      session.isStreaming = true;
      session.deviceId = frame.deviceId;
      startStream(sessionId, frame.deviceId);
    }

    // Broadcast frame to all other sessions
    broadcastFrame(sessionId, frame);
  };

  const startStream = (sessionId: string, deviceId: string) => {
    if (!activeStreams.has(deviceId)) {
      activeStreams.set(deviceId, new Set());
    }
    
    activeStreams.get(deviceId)!.add(sessionId);
    
    // Notify all sessions about new stream
    const message: StreamMessage = {
      type: 'stream_started',
      deviceId,
      timestamp: Date.now()
    };
    
    broadcast(message, sessionId);
    console.log(`📹 Stream started: ${deviceId} from session ${sessionId}`);
  };

  const stopStream = (sessionId: string, deviceId: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.isStreaming = false;
      session.deviceId = undefined;
    }

    if (activeStreams.has(deviceId)) {
      activeStreams.get(deviceId)!.delete(sessionId);
      
      if (activeStreams.get(deviceId)!.size === 0) {
        activeStreams.delete(deviceId);
        
        // Notify all sessions stream ended
        const message: StreamMessage = {
          type: 'stream_stopped',
          deviceId,
          timestamp: Date.now()
        };
        
        broadcast(message);
        console.log(`📹 Stream stopped: ${deviceId}`);
      }
    }
  };

  const broadcastFrame = (senderSessionId: string, frame: StreamFrame) => {
    const message: StreamMessage = {
      type: 'stream_data',
      deviceId: frame.deviceId,
      timestamp: frame.timestamp,
      data: frame.data
    };

    // Send to all sessions except sender
    sessions.forEach((session, sessionId) => {
      if (sessionId !== senderSessionId && session.ws.readyState === 1) {
        try {
          session.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send frame to session ${sessionId}:`, error);
          removeSession(sessionId);
        }
      }
    });
  };

  const handleWebRTCSignaling = (sessionId: string, message: any) => {
    if (message.targetSession) {
      const targetSession = sessions.get(message.targetSession);
      if (targetSession && targetSession.ws.readyState === 1) {
        try {
          targetSession.ws.send(JSON.stringify({
            ...message,
            sourceSession: sessionId
          }));
        } catch (error) {
          console.error(`Failed to relay WebRTC signaling:`, error);
        }
      }
    } else {
      // For broadcast messages, add sourceSession before broadcasting
      const messageWithSource = {
        ...message,
        sourceSession: sessionId
      };
      broadcast(messageWithSource, sessionId);
    }
  };

  const broadcast = (message: StreamMessage, excludeSessionId?: string) => {
    sessions.forEach((session, sessionId) => {
      if (sessionId !== excludeSessionId && session.ws.readyState === 1) {
        try {
          session.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to broadcast to session ${sessionId}:`, error);
          removeSession(sessionId);
        }
      }
    });
  };

  const cleanup = () => {
    const now = Date.now();
    const timeout = 60000; // 1 minute

    sessions.forEach((session, sessionId) => {
      if (now - session.lastSeen > timeout) {
        removeSession(sessionId);
      }
    });
  };

  // Cleanup inactive sessions every 30 seconds
  setInterval(cleanup, 30000);

  const getStats = () => ({
    totalSessions: sessions.size,
    activeStreams: activeStreams.size,
    streamingSessions: Array.from(sessions.values()).filter(s => s.isStreaming).length
  });

  return {
    addSession,
    removeSession,
    handleMessage,
    getStats
  };
};