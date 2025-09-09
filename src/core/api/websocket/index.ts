/**
 * WebSocket Module Index - TypeScript Implementation
 * Combines all WebSocket components into a unified interface
 */

import { createWebSocketSessionManager } from './session-manager.js';
import { createWebSocketMessageHandlers } from './message-handlers.js';
import { createWebSocketFrameProcessor } from './frame-processor.js';

// WebSocket configuration interface
export interface WebSocketConfig {
  maxWebSocketSessions?: number;
  websocketTimeout?: number;
  websocketCleanupInterval?: number;
  maxFrameSize?: number;
  enableFrameCache?: boolean;
  frameCacheSize?: number;
}

// WebSocket manager dependencies interface
export interface WebSocketDependencies {
  orchestrator?: any;
  initializeEmotionPipeline?: () => Promise<void>;
  config?: WebSocketConfig;
}

// WebSocket statistics interface
export interface WebSocketStatistics {
  sessions: any;
  frameProcessing: any;
  combined: {
    totalConnections: number;
    activeConnections: number;
    framesProcessed: number;
    averageFramesPerSession: number;
    errorRate: number;
    cacheEfficiency: number;
  };
  timestamp: number;
}

// WebSocket health status interface
export interface WebSocketHealthStatus {
  status: 'healthy' | 'degraded';
  activeConnections: number;
  maxConnections: number;
  errorRate: number;
  uptime: number;
  issues: string[];
}

// WebSocket manager interface
export interface WebSocketManager {
  websocketHandlers: {
    open: (ws: any) => void;
    message: (ws: any, message: string) => Promise<void>;
    close: (ws: any, code: number, reason: string) => void;
    error: (ws: any, error: Error) => void;
  };
  broadcast: (topic: string, data: any) => number;
  getStatistics: () => WebSocketStatistics;
  getHealthStatus: () => WebSocketHealthStatus;
  cleanup: () => void;
  sessionManager: any;
  messageHandlers: any;
  frameProcessor: any;
  getActiveSessions: () => any[];
  getActiveCount: () => number;
}

/**
 * Create unified WebSocket manager
 * @param dependencies - Required dependencies from server
 * @returns WebSocket manager instance
 */
export const createWebSocketManager = (dependencies: WebSocketDependencies): WebSocketManager => {
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
     */
    open: (ws: any): void => {
      const session = messageHandlers.handleConnection(ws, {
        userAgent: ws.data?.headers?.['user-agent'],
        connectedAt: Date.now()
      });
      
      if (!session) {
        console.error('Failed to create WebSocket session');
      }
    },

    /**
     * Handle WebSocket message
     */
    message: async (ws: any, message: string): Promise<void> => {
      await messageHandlers.handleMessage(ws, message);
    },

    /**
     * Handle WebSocket connection close
     */
    close: (ws: any, code: number, reason: string): void => {
      messageHandlers.handleDisconnection(ws, code, reason);
    },

    /**
     * Handle WebSocket error
     */
    error: (ws: any, error: Error): void => {
      console.error('WebSocket error:', error);
      const session = sessionManager.getSessionByWebSocket(ws);
      if (session) {
        sessionManager.incrementSessionError(session.id);
      }
    }
  };

  /**
   * Broadcast notification to all subscribed clients
   * @param topic - Topic name
   * @param data - Notification data
   * @returns Number of clients notified
   */
  const broadcast = (topic: string, data: any): number => {
    return messageHandlers.broadcastNotification(topic, data);
  };

  /**
   * Get comprehensive WebSocket statistics
   * @returns Combined statistics
   */
  const getStatistics = (): WebSocketStatistics => {
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
   * @returns Health status
   */
  const getHealthStatus = (): WebSocketHealthStatus => {
    const stats = getStatistics();
    const maxConnections = config.maxWebSocketSessions || 100;
    const isHealthy = stats.sessions.activeConnections < maxConnections * 0.9 &&
                     stats.combined.errorRate < 0.1;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      activeConnections: stats.sessions.activeConnections,
      maxConnections,
      errorRate: Math.round(stats.combined.errorRate * 100),
      uptime: stats.sessions.uptime,
      issues: isHealthy ? [] : [
        stats.sessions.activeConnections >= maxConnections * 0.9 ? 'High connection count' : null,
        stats.combined.errorRate >= 0.1 ? 'High error rate' : null
      ].filter(Boolean) as string[]
    };
  };

  /**
   * Cleanup all WebSocket components
   */
  const cleanup = (): void => {
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