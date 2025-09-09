/**
 * Human Interface Channel
 * Manages WebSocket connections and communication with human operators
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../shared/utils/logger.js';
import type { Session, Message, Alert, HumanInterfaceChannel } from './types.js';

const logger = createLogger({ level: 2 });

export interface HumanInterfaceConfig {
  maxSessions?: number;
  sessionTimeout?: number;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
}

/**
 * Create a human interface communication channel
 */
export const createHumanInterfaceChannel = (config: HumanInterfaceConfig = {}): HumanInterfaceChannel => {
  const emitter = new EventEmitter();
  const sessions = new Map<string, Session>();
  const maxSessions = config.maxSessions || 100;
  const sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
  
  let heartbeatTimer: NodeJS.Timeout | null = null;
  
  // Start heartbeat if enabled
  if (config.enableHeartbeat && config.heartbeatInterval) {
    heartbeatTimer = setInterval(() => sendHeartbeat(), config.heartbeatInterval);
  }
  
  const connect = (sessionId: string, ws: any): void => {
    // Check max sessions limit
    if (sessions.size >= maxSessions) {
      logger.warn(`Max sessions limit reached (${maxSessions}), rejecting connection`);
      ws.close(1008, 'Max sessions limit reached');
      return;
    }
    
    sessions.set(sessionId, {
      id: sessionId,
      websocket: ws,
      connected: Date.now(),
      lastMessage: null
    });
    
    // Setup WebSocket event handlers
    ws.on('close', () => disconnect(sessionId));
    ws.on('error', (error: Error) => handleWebSocketError(sessionId, error));
    
    emitter.emit('connected', { sessionId });
    logger.info(`Human interface connected: ${sessionId}`);
  };
  
  const disconnect = (sessionId: string): void => {
    const session = sessions.get(sessionId);
    if (session) {
      sessions.delete(sessionId);
      emitter.emit('disconnected', { sessionId });
      logger.info(`Human interface disconnected: ${sessionId}`);
    }
  };
  
  const send = (sessionId: string, message: Message): boolean => {
    const session = sessions.get(sessionId);
    if (!session || !session.websocket) {
      logger.warn(`Cannot send to disconnected session: ${sessionId}`);
      return false;
    }
    
    try {
      const payload = JSON.stringify({
        type: 'advisory',
        ...message,
        timestamp: message.timestamp || Date.now()
      });
      
      if (session.websocket.readyState === 1) { // WebSocket.OPEN
        session.websocket.send(payload);
        session.lastMessage = Date.now();
        emitter.emit('message-sent', { sessionId, message });
        return true;
      } else {
        logger.warn(`WebSocket not ready for session: ${sessionId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to send message to ${sessionId}:`, error);
      handleWebSocketError(sessionId, error as Error);
      return false;
    }
  };
  
  const broadcast = (message: Message, filter: (session: Session) => boolean = () => true): number => {
    let sent = 0;
    const errors: string[] = [];
    
    for (const [sessionId, session] of sessions.entries()) {
      if (filter(session)) {
        if (send(sessionId, message)) {
          sent++;
        } else {
          errors.push(sessionId);
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn(`Broadcast failed for ${errors.length} sessions`);
    }
    
    emitter.emit('broadcast', { message, sent, failed: errors.length });
    return sent;
  };
  
  const notify = (alert: Alert): number => {
    const alertMessage: Message = {
      type: 'alert',
      content: alert.message,
      priority: alert.priority || 'normal',
      alertId: alert.id,
      metadata: alert.metadata
    };
    
    return broadcast(alertMessage, (session) => {
      // Can add filtering logic here (e.g., by alert priority or session role)
      return true;
    });
  };
  
  const sendHeartbeat = (): void => {
    const now = Date.now();
    const staleSessionIds: string[] = [];
    
    for (const [sessionId, session] of sessions.entries()) {
      // Check for stale sessions
      if (session.lastMessage && now - session.lastMessage > sessionTimeout) {
        staleSessionIds.push(sessionId);
      } else {
        // Send heartbeat ping
        send(sessionId, { type: 'heartbeat', timestamp: now });
      }
    }
    
    // Disconnect stale sessions
    staleSessionIds.forEach(id => {
      logger.info(`Disconnecting stale session: ${id}`);
      disconnect(id);
    });
  };
  
  const handleWebSocketError = (sessionId: string, error: Error): void => {
    logger.error(`WebSocket error for session ${sessionId}:`, error);
    emitter.emit('error', { sessionId, error });
    
    // Disconnect on critical errors
    if (error.message.includes('ECONNRESET') || error.message.includes('EPIPE')) {
      disconnect(sessionId);
    }
  };
  
  const getSession = (id: string): Session | undefined => {
    return sessions.get(id);
  };
  
  const getSessions = (): Session[] => {
    return Array.from(sessions.values());
  };
  
  const getStats = (): Record<string, any> => {
    const now = Date.now();
    const sessionsArray = Array.from(sessions.values());
    
    return {
      totalSessions: sessions.size,
      activeSessions: sessionsArray.filter(s => 
        s.lastMessage && now - s.lastMessage < 60000).length, // Active in last minute
      averageConnectionTime: sessionsArray.length > 0
        ? sessionsArray.reduce((sum, s) => sum + (now - s.connected), 0) / sessionsArray.length
        : 0,
      maxSessionsLimit: maxSessions
    };
  };
  
  const destroy = (): void => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    
    // Close all connections
    for (const [sessionId, session] of sessions.entries()) {
      if (session.websocket) {
        session.websocket.close(1000, 'Channel shutting down');
      }
    }
    
    sessions.clear();
    emitter.removeAllListeners();
  };
  
  return {
    connect,
    disconnect,
    send,
    broadcast,
    notify,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    getSession,
    getSessions,
    getStats,
    destroy
  };
};