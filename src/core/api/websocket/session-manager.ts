/**
 * WebSocket Session Manager - TypeScript Implementation
 * Handles WebSocket session lifecycle and state management
 */

import { createAnalysisRequirements } from '../../../core/configuration/types.js';

export interface WebSocketSessionConfig {
  maxSessions?: number;
  sessionTimeout?: number;
  cleanupInterval?: number;
}

export interface WebSocketSessionMetadata {
  userAgent?: string;
  origin?: string;
  [key: string]: any;
}

export interface WebSocketSession {
  id: string;
  ws: any; // WebSocket type
  metadata: WebSocketSessionMetadata;
  requirements: any;
  createdAt: number;
  lastActivity: number;
  isProcessing: boolean;
  frameCount: number;
  messageCount: number;
  errors: number;
  status: 'active' | 'inactive' | 'error';
}

export interface WebSocketSessionStatistics {
  activeConnections: number;
  totalSessions: number;
  averageSessionAge: number;
  totalMessages: number;
  totalFrames: number;
  totalErrors: number;
  processingRate: number;
  uptime: number;
  timestamp: number;
}

export interface WebSocketSessionManager {
  createSession: (ws: any, metadata?: WebSocketSessionMetadata) => WebSocketSession | null;
  removeSession: (sessionId: string) => boolean;
  getSessionByWebSocket: (ws: any) => WebSocketSession | null;
  getSessionById: (sessionId: string) => WebSocketSession | null;
  updateSessionActivity: (sessionId: string) => void;
  setSessionProcessing: (sessionId: string, processing: boolean) => void;
  incrementSessionError: (sessionId: string) => void;
  broadcast: (message: any, filter?: (session: WebSocketSession) => boolean) => number;
  getStatistics: () => WebSocketSessionStatistics;
  cleanup: () => void;
  getSessions: () => WebSocketSession[];
  getActiveCount: () => number;
}

/**
 * Create WebSocket session manager
 */
export const createWebSocketSessionManager = (config: WebSocketSessionConfig = {}): WebSocketSessionManager => {
  const state = {
    sessions: new Map<string, WebSocketSession>(),
    activeConnections: 0,
    totalSessions: 0,
    config: {
      maxSessions: config.maxSessions || 100,
      sessionTimeout: config.sessionTimeout || 300000, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      ...config
    }
  };

  // Cleanup inactive sessions periodically
  const cleanupTimer = setInterval(() => {
    cleanupInactiveSessions();
  }, state.config.cleanupInterval);

  /**
   * Generate secure session ID
   */
  const generateSessionId = (prefix = 'ws'): string => {
    const timestamp = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(8));
    const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0').join(''));
    return `${prefix}_${timestamp}_${randomHex}`;
  };

  /**
   * Create new WebSocket session
   */
  const createSession = (ws: any, metadata: WebSocketSessionMetadata = {}): WebSocketSession | null => {
    // Check session limits
    if (state.sessions.size >= state.config.maxSessions) {
      console.warn('⚠️ Maximum WebSocket sessions reached, rejecting new connection');
      ws.close(1013, 'Server overloaded');
      return null;
    }

    const sessionId = generateSessionId();
    const session: WebSocketSession = {
      id: sessionId,
      ws,
      metadata,
      requirements: createAnalysisRequirements(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isProcessing: false,
      frameCount: 0,
      messageCount: 0,
      errors: 0,
      status: 'active'
    };

    state.sessions.set(sessionId, session);
    state.activeConnections++;
    state.totalSessions++;

    console.log(`🔌 WebSocket session created: ${sessionId} (${state.activeConnections} active)`);

    // Send welcome message
    try {
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        capabilities: ['frame_analysis', 'emotion_detection', 'media_streaming'],
        serverVersion: '2.0.0',
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to send welcome message:', error);
      removeSession(sessionId);
      return null;
    }

    return session;
  };

  /**
   * Remove WebSocket session
   */
  const removeSession = (sessionId: string): boolean => {
    const session = state.sessions.get(sessionId);
    if (!session) return false;

    state.sessions.delete(sessionId);
    state.activeConnections--;

    console.log(`🔌 WebSocket session removed: ${sessionId} (${state.activeConnections} active)`);
    return true;
  };

  /**
   * Get session by WebSocket connection
   */
  const getSessionByWebSocket = (ws: any): WebSocketSession | null => {
    for (const session of state.sessions.values()) {
      if (session.ws === ws) {
        return session;
      }
    }
    return null;
  };

  /**
   * Get session by ID
   */
  const getSessionById = (sessionId: string): WebSocketSession | null => {
    return state.sessions.get(sessionId) || null;
  };

  /**
   * Update session activity timestamp
   */
  const updateSessionActivity = (sessionId: string): void => {
    const session = state.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.messageCount++;
    }
  };

  /**
   * Mark session as processing
   */
  const setSessionProcessing = (sessionId: string, processing: boolean): void => {
    const session = state.sessions.get(sessionId);
    if (session) {
      session.isProcessing = processing;
    }
  };

  /**
   * Increment session error count
   */
  const incrementSessionError = (sessionId: string): void => {
    const session = state.sessions.get(sessionId);
    if (session) {
      session.errors++;
      
      // Auto-disconnect sessions with too many errors
      if (session.errors >= 10) {
        console.warn(`🚨 Session ${sessionId} exceeded error limit, disconnecting`);
        session.ws.close(1011, 'Too many errors');
        removeSession(sessionId);
      }
    }
  };

  /**
   * Clean up inactive sessions
   */
  const cleanupInactiveSessions = (): void => {
    const now = Date.now();
    const timeout = state.config.sessionTimeout;
    let cleanedUp = 0;

    for (const [sessionId, session] of state.sessions.entries()) {
      if (now - session.lastActivity > timeout) {
        console.log(`🧹 Cleaning up inactive session: ${sessionId}`);
        session.ws.close(1000, 'Session timeout');
        removeSession(sessionId);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      console.log(`🧹 Cleaned up ${cleanedUp} inactive WebSocket sessions`);
    }
  };

  /**
   * Broadcast message to all active sessions
   */
  const broadcast = (message: any, filter?: (session: WebSocketSession) => boolean): number => {
    const messageStr = JSON.stringify(message);
    let sent = 0;

    for (const session of state.sessions.values()) {
      if (session.status === 'active' && (!filter || filter(session))) {
        try {
          session.ws.send(messageStr);
          sent++;
        } catch (error) {
          console.error(`Failed to send broadcast to ${session.id}:`, error);
          removeSession(session.id);
        }
      }
    }

    console.log(`📡 Broadcasted message to ${sent} sessions`);
    return sent;
  };

  /**
   * Get session statistics
   */
  const getStatistics = (): WebSocketSessionStatistics => {
    const sessions = Array.from(state.sessions.values());
    
    return {
      activeConnections: state.activeConnections,
      totalSessions: state.totalSessions,
      averageSessionAge: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (Date.now() - s.createdAt), 0) / sessions.length / 1000)
        : 0,
      totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalFrames: sessions.reduce((sum, s) => sum + s.frameCount, 0),
      totalErrors: sessions.reduce((sum, s) => sum + s.errors, 0),
      processingRate: sessions.filter(s => s.isProcessing).length / Math.max(sessions.length, 1),
      uptime: Math.round((Date.now() - (sessions[0]?.createdAt || Date.now())) / 1000),
      timestamp: Date.now()
    };
  };

  /**
   * Close all sessions and cleanup
   */
  const cleanup = (): void => {
    console.log('🧹 Cleaning up WebSocket session manager...');
    
    // Clear cleanup timer
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
    
    // Close all active sessions
    for (const [sessionId, session] of state.sessions.entries()) {
      try {
        session.ws.close(1001, 'Server shutting down');
      } catch (error) {
        console.warn(`Error closing session ${sessionId}:`, error);
      }
    }
    
    state.sessions.clear();
    state.activeConnections = 0;
    
    console.log('✅ WebSocket session manager cleanup complete');
  };

  return {
    // Session lifecycle
    createSession,
    removeSession,
    getSessionByWebSocket,
    getSessionById,
    
    // Session management
    updateSessionActivity,
    setSessionProcessing,
    incrementSessionError,
    
    // Utilities
    broadcast,
    getStatistics,
    cleanup,
    
    // State access
    getSessions: (): WebSocketSession[] => Array.from(state.sessions.values()),
    getActiveCount: (): number => state.activeConnections
  };
};