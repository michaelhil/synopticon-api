/**
 * WebSocket Message Handlers
 * Processes different types of WebSocket messages
 */

import { createMediaStreamHandler } from './media-stream-handler.ts';

/**
 * Create WebSocket message handler system
 * @param {Object} dependencies - Required dependencies
 * @returns {Object} Message handler instance
 */
export const createWebSocketMessageHandlers = (dependencies) => {
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
   * @param {Object} session - WebSocket session
   * @param {Object} data - Message data
   */
  const handleFrameAnalysis = async (session, data) => {
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
      const frameData = decodeFrame(data.frame || data.image);
      
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
        error: error.message,
        errorCode: 'FRAME_ANALYSIS_ERROR',
        timestamp: Date.now()
      }));
    }
  };

  /**
   * Process configuration message
   * @param {Object} session - WebSocket session
   * @param {Object} data - Message data
   */
  const handleConfiguration = async (session, data) => {
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
        error: error.message,
        errorCode: 'CONFIGURATION_ERROR',
        timestamp: Date.now()
      }));
    }
  };

  /**
   * Process ping message (keepalive)
   * @param {Object} session - WebSocket session
   * @param {Object} data - Message data
   */
  const handlePing = (session, data) => {
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
   * @param {Object} session - WebSocket session
   * @param {Object} data - Message data
   */
  const handleStatusRequest = (session, data) => {
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
   * @param {Object} session - WebSocket session
   * @param {Object} data - Message data
   */
  const handleSubscription = (session, data) => {
    sessionManager.updateSessionActivity(session.id);
    
    if (!session.metadata.subscriptions) {
      session.metadata.subscriptions = new Set();
    }
    
    const { action, topics } = data;
    const topicsArray = Array.isArray(topics) ? topics : [topics];
    
    if (action === 'subscribe') {
      topicsArray.forEach(topic => session.metadata.subscriptions.add(topic));
    } else if (action === 'unsubscribe') {
      topicsArray.forEach(topic => session.metadata.subscriptions.delete(topic));
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
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} message - Raw message string
   */
  const handleMessage = async (ws, message) => {
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
      const data = JSON.parse(message);
      
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
          
        default:
          throw new Error(`Unknown message type: ${data.type}`);
      }
      
    } catch (error) {
      console.error('Message handling error:', error);
      sessionManager.incrementSessionError(session.id);
      
      try {
        session.ws.send(JSON.stringify({
          type: 'error',
          sessionId: session.id,
          error: error.message,
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
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} metadata - Optional connection metadata
   */
  const handleConnection = (ws, metadata = {}) => {
    const session = sessionManager.createSession(ws, metadata);
    mediaStreamHandler.addSession(ws, session.id);
    return session;
  };

  /**
   * Handle WebSocket connection close
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  const handleDisconnection = (ws, code, reason) => {
    const session = sessionManager.getSessionByWebSocket(ws);
    if (session) {
      console.log(`🔌 WebSocket disconnected: ${session.id} (${code}: ${reason})`);
      mediaStreamHandler.removeSession(session.id);
      sessionManager.removeSession(session.id);
    }
  };

  /**
   * Broadcast system notification to subscribed clients
   * @param {string} topic - Topic name
   * @param {Object} data - Notification data
   */
  const broadcastNotification = (topic, data) => {
    const message = {
      type: 'notification',
      topic,
      data,
      timestamp: Date.now()
    };

    const filter = (session) => {
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
      subscription: handleSubscription
    }
  };
};