/**
 * WebSocket Module Index
 * Combines all WebSocket components into a unified interface
 */

import { createWebSocketSessionManager } from './session-manager.js';
import { createWebSocketMessageHandlers } from './message-handlers.ts';
import { createWebSocketFrameProcessor } from './frame-processor.js';

/**
 * Create unified WebSocket manager
 * @param {Object} dependencies - Required dependencies from server
 * @returns {Object} WebSocket manager instance
 */
export const createWebSocketManager = (dependencies) => {
  const {
    orchestrator,
    initializeEmotionPipeline,
    config = {}
  } = dependencies;

  // Create session manager
  const sessionManager = createWebSocketSessionManager({
    maxSessions: config.maxWebSocketSessions || 100,
    sessionTimeout: config.websocketTimeout || 300000,
    cleanupInterval: config.websocketCleanupInterval || 60000
  });

  // Create frame processor
  const frameProcessor = createWebSocketFrameProcessor({
    maxFrameSize: config.maxFrameSize || 10 * 1024 * 1024,
    enableCaching: config.enableFrameCache !== false,
    cacheSize: config.frameCacheSize || 50
  });

  // Create message handlers
  const messageHandlers = createWebSocketMessageHandlers({
    sessionManager,
    orchestrator,
    initializeEmotionPipeline,
    decodeFrame: frameProcessor.processFrame
  });

  /**
   * WebSocket event handlers for Bun.serve
   */
  const websocketHandlers = {
    /**
     * Handle WebSocket connection open
     * @param {WebSocket} ws - WebSocket connection
     */
    open: (ws) => {
      const session = messageHandlers.handleConnection(ws, {
        userAgent: ws.data?.headers?.['user-agent'],
        connectedAt: Date.now()
      });
      
      if (!session) {
        console.error('Failed to create WebSocket session');
        return;
      }
    },

    /**
     * Handle WebSocket message
     * @param {WebSocket} ws - WebSocket connection  
     * @param {string} message - Message data
     */
    message: async (ws, message) => {
      await messageHandlers.handleMessage(ws, message);
    },

    /**
     * Handle WebSocket connection close
     * @param {WebSocket} ws - WebSocket connection
     * @param {number} code - Close code
     * @param {string} reason - Close reason
     */
    close: (ws, code, reason) => {
      messageHandlers.handleDisconnection(ws, code, reason);
    },

    /**
     * Handle WebSocket error
     * @param {WebSocket} ws - WebSocket connection
     * @param {Error} error - Error object
     */
    error: (ws, error) => {
      console.error('WebSocket error:', error);
      const session = sessionManager.getSessionByWebSocket(ws);
      if (session) {
        sessionManager.incrementSessionError(session.id);
      }
    }
  };

  /**
   * Broadcast notification to all subscribed clients
   * @param {string} topic - Topic name
   * @param {Object} data - Notification data
   * @returns {number} Number of clients notified
   */
  const broadcast = (topic, data) => {
    return messageHandlers.broadcastNotification(topic, data);
  };

  /**
   * Get comprehensive WebSocket statistics
   * @returns {Object} Combined statistics
   */
  const getStatistics = () => {
    const sessionStats = sessionManager.getStatistics();
    const frameStats = frameProcessor.getStatistics();
    
    return {
      sessions: sessionStats,
      frameProcessing: frameStats,
      combined: {
        totalConnections: sessionStats.totalSessions,
        activeConnections: sessionStats.activeConnections,
        framesProcessed: frameStats.framesProcessed,
        averageFramesPerSession: frameStats.framesProcessed / Math.max(sessionStats.totalSessions, 1),
        errorRate: (sessionStats.totalErrors + frameStats.errors) / 
                  Math.max(frameStats.framesProcessed + sessionStats.totalMessages, 1),
        cacheEfficiency: frameStats.cacheHitRate || 0
      },
      timestamp: Date.now()
    };
  };

  /**
   * Health check for WebSocket system
   * @returns {Object} Health status
   */
  const getHealthStatus = () => {
    const stats = getStatistics();
    const isHealthy = stats.sessions.activeConnections < (config.maxWebSocketSessions || 100) * 0.9 &&
                     stats.combined.errorRate < 0.1;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      activeConnections: stats.sessions.activeConnections,
      maxConnections: config.maxWebSocketSessions || 100,
      errorRate: Math.round(stats.combined.errorRate * 100),
      uptime: stats.sessions.uptime,
      issues: isHealthy ? [] : [
        stats.sessions.activeConnections >= (config.maxWebSocketSessions || 100) * 0.9 ? 'High connection count' : null,
        stats.combined.errorRate >= 0.1 ? 'High error rate' : null
      ].filter(Boolean)
    };
  };

  /**
   * Cleanup all WebSocket components
   */
  const cleanup = () => {
    console.log('🧹 Cleaning up WebSocket manager...');
    
    sessionManager.cleanup();
    frameProcessor.cleanup();
    
    console.log('✅ WebSocket manager cleanup complete');
  };

  return {
    // Core handlers for Bun.serve integration
    websocketHandlers,
    
    // Management functions
    broadcast,
    getStatistics,
    getHealthStatus,
    cleanup,
    
    // Component access (for advanced usage)
    sessionManager,
    messageHandlers, 
    frameProcessor,
    
    // Convenience methods
    getActiveSessions: () => sessionManager.getSessions(),
    getActiveCount: () => sessionManager.getActiveCount()
  };
};