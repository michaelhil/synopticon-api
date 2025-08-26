/**
 * WebSocket Session Manager
 * Handles WebSocket session lifecycle and state management
 */

import { createAnalysisRequirements } from '../../../core/configuration/types.js';

/**
 * Create WebSocket session manager
 * @param {Object} config - Configuration options
 * @returns {Object} Session manager instance
 */
export const createWebSocketSessionManager = (config = {}) => {
  const state = {
    sessions: new Map(),
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
   * @param {string} prefix - Optional prefix for session ID
   * @returns {string} Generated session ID
   */
  const generateSessionId = (prefix = 'ws') => {
    const timestamp = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(8));
    const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${timestamp}_${randomHex}`;
  };

  /**
   * Create new WebSocket session
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} metadata - Optional session metadata
   * @returns {Object} Created session object
   */
  const createSession = (ws, metadata = {}) => {
    // Check session limits
    if (state.sessions.size >= state.config.maxSessions) {
      console.warn('⚠️ Maximum WebSocket sessions reached, rejecting new connection');
      ws.close(1013, 'Server overloaded');
      return null;
    }

    const sessionId = generateSessionId();
    const session = {
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
   * @param {string} sessionId - Session ID to remove
   * @returns {boolean} Success status
   */
  const removeSession = (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) return false;

    state.sessions.delete(sessionId);
    state.activeConnections--;

    console.log(`🔌 WebSocket session removed: ${sessionId} (${state.activeConnections} active)`);
    return true;
  };

  /**
   * Get session by WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Object|null} Session object or null if not found
   */
  const getSessionByWebSocket = (ws) => {
    for (const session of state.sessions.values()) {
      if (session.ws === ws) {
        return session;
      }
    }
    return null;
  };

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session object or null if not found
   */
  const getSessionById = (sessionId) => {
    return state.sessions.get(sessionId) || null;
  };

  /**
   * Update session activity timestamp
   * @param {string} sessionId - Session ID
   */
  const updateSessionActivity = (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.messageCount++;
    }
  };

  /**
   * Mark session as processing
   * @param {string} sessionId - Session ID
   * @param {boolean} processing - Processing state
   */
  const setSessionProcessing = (sessionId, processing) => {
    const session = state.sessions.get(sessionId);
    if (session) {
      session.isProcessing = processing;
    }
  };

  /**
   * Increment session error count
   * @param {string} sessionId - Session ID
   */
  const incrementSessionError = (sessionId) => {
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
  const cleanupInactiveSessions = () => {
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
   * @param {Object} message - Message to broadcast
   * @param {Function} filter - Optional filter function for sessions
   */
  const broadcast = (message, filter = null) => {
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
   * @returns {Object} Session statistics
   */
  const getStatistics = () => {
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
  const cleanup = () => {
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
    getSessions: () => Array.from(state.sessions.values()),
    getActiveCount: () => state.activeConnections
  };
};