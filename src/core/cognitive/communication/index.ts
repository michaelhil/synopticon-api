/**
 * Bidirectional Communication Manager
 * Modular communication system with separated concerns
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../shared/utils/logger.js';
import { createPriorityQueue } from './priority-queue.js';
import { createConversationManager } from './conversation-manager.js';
import { createHumanInterfaceChannel } from './human-interface-channel.js';
import type { 
  CommunicationConfig, 
  Message, 
  Priority,
  DialogueContext,
  AIResponse 
} from './types.js';

const logger = createLogger({ level: 2 });

export * from './types.js';
export { createPriorityQueue } from './priority-queue.js';
export { createConversationManager } from './conversation-manager.js';
export { createHumanInterfaceChannel } from './human-interface-channel.js';

export interface CommunicationManager {
  // Queue management
  enqueueMessage: (message: Message, priority?: Priority) => void;
  processNextMessage: () => Promise<void>;
  
  // Human interface
  connectHuman: (sessionId: string, ws: any) => void;
  disconnectHuman: (sessionId: string) => void;
  sendToHuman: (sessionId: string, message: Message) => boolean;
  broadcastToHumans: (message: Message) => number;
  
  // Conversation management
  addConversationTurn: (sessionId: string, role: string, content: string) => void;
  getConversationContext: (sessionId: string, maxTurns?: number) => any[];
  
  // AI integration
  processAIRequest: (message: string, context: DialogueContext) => Promise<AIResponse>;
  
  // System management
  getStats: () => Record<string, any>;
  cleanup: () => void;
  destroy: () => void;
  
  // Event handling
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
}

/**
 * Create the main communication manager
 */
export const createBidirectionalCommunicationManager = (
  config: CommunicationConfig = {}
): CommunicationManager => {
  const emitter = new EventEmitter();
  
  // Initialize sub-managers
  const messageQueue = createPriorityQueue();
  const conversationManager = createConversationManager({
    maxTurns: config.maxConversationTurns,
    maxAge: config.maxConversationAge,
    cleanupInterval: config.cleanupInterval
  });
  const humanInterface = createHumanInterfaceChannel({
    maxSessions: 100,
    sessionTimeout: 3600000,
    enableHeartbeat: true,
    heartbeatInterval: 30000
  });
  
  // State
  let isProcessing = false;
  const stats = {
    messagesProcessed: 0,
    messagesFailed: 0,
    aiRequests: 0,
    aiResponses: 0,
    startTime: Date.now()
  };
  
  // Forward events from sub-managers
  humanInterface.on('connected', (data: any) => {
    emitter.emit('human-connected', data);
    logger.info('Human operator connected', data);
  });
  
  humanInterface.on('disconnected', (data: any) => {
    emitter.emit('human-disconnected', data);
    logger.info('Human operator disconnected', data);
  });
  
  humanInterface.on('error', (data: any) => {
    emitter.emit('human-interface-error', data);
    logger.error('Human interface error', data);
  });
  
  /**
   * Enqueue a message for processing
   */
  const enqueueMessage = (message: Message, priority: Priority = 'normal'): void => {
    messageQueue.enqueue(message, priority);
    emitter.emit('message-enqueued', { message, priority, queueSize: messageQueue.size() });
    
    // Trigger processing if not already running
    if (!isProcessing) {
      processNextMessage().catch(error => {
        logger.error('Message processing error:', error);
      });
    }
  };
  
  /**
   * Process the next message in the queue
   */
  const processNextMessage = async (): Promise<void> => {
    if (isProcessing || messageQueue.isEmpty()) {
      return;
    }
    
    isProcessing = true;
    
    try {
      while (!messageQueue.isEmpty()) {
        const message = messageQueue.dequeue();
        if (!message) break;
        
        await processMessage(message);
        stats.messagesProcessed++;
      }
    } catch (error) {
      stats.messagesFailed++;
      logger.error('Error processing message:', error);
      emitter.emit('processing-error', error);
    } finally {
      isProcessing = false;
    }
  };
  
  /**
   * Process a single message
   */
  const processMessage = async (message: Message): Promise<void> => {
    emitter.emit('message-processing', message);
    
    try {
      switch (message.type) {
        case 'human-input':
          await handleHumanInput(message);
          break;
        case 'ai-request':
          await handleAIRequest(message);
          break;
        case 'system-event':
          await handleSystemEvent(message);
          break;
        default:
          logger.warn('Unknown message type:', message.type);
      }
      
      emitter.emit('message-processed', message);
    } catch (error) {
      logger.error('Error processing message:', error);
      emitter.emit('message-error', { message, error });
      throw error;
    }
  };
  
  /**
   * Handle human input messages
   */
  const handleHumanInput = async (message: Message): Promise<void> => {
    const { sessionId, content } = message;
    
    if (sessionId && content) {
      // Record in conversation history
      conversationManager.addTurn(sessionId, 'human', content, {
        timestamp: message.timestamp,
        ...message.metadata
      });
      
      // Process and potentially forward to AI
      if (message.requiresAI) {
        const context: DialogueContext = {
          sessionId,
          history: conversationManager.getContext(sessionId, 10)
        };
        
        const aiResponse = await processAIRequest(content, context);
        
        // Send response back to human
        humanInterface.send(sessionId, {
          type: 'ai-response',
          content: aiResponse.content,
          metadata: aiResponse.metadata
        });
      }
    }
  };
  
  /**
   * Handle AI request messages
   */
  const handleAIRequest = async (message: Message): Promise<void> => {
    const { content, context } = message;
    
    if (content) {
      const response = await processAIRequest(content, context || {});
      
      if (message.sessionId) {
        // Send response to specific session
        humanInterface.send(message.sessionId, {
          type: 'ai-response',
          content: response.content,
          metadata: response.metadata
        });
      } else {
        // Broadcast to all
        humanInterface.broadcast({
          type: 'ai-response',
          content: response.content,
          metadata: response.metadata
        });
      }
    }
  };
  
  /**
   * Handle system event messages
   */
  const handleSystemEvent = async (message: Message): Promise<void> => {
    const { event, data } = message;
    
    // Emit for external handlers
    emitter.emit(`system-${event}`, data);
    
    // Handle specific system events
    switch (event) {
      case 'alert':
        humanInterface.notify({
          type: 'system-alert',
          message: data.message || 'System alert',
          priority: data.priority || 'normal'
        });
        break;
      case 'status-update':
        humanInterface.broadcast({
          type: 'status',
          content: data
        });
        break;
    }
  };
  
  /**
   * Process AI request
   */
  const processAIRequest = async (message: string, context: DialogueContext): Promise<AIResponse> => {
    stats.aiRequests++;
    
    try {
      // Placeholder for actual AI integration
      // This would connect to your LLM service
      const response: AIResponse = {
        content: `AI response to: ${message}`,
        confidence: 0.85,
        metadata: {
          model: config.aiConfig?.model || 'default',
          processingTime: Date.now()
        }
      };
      
      stats.aiResponses++;
      
      // Record AI response in conversation
      if (context.sessionId) {
        conversationManager.addTurn(context.sessionId, 'ai', response.content, response.metadata);
      }
      
      return response;
    } catch (error) {
      logger.error('AI request failed:', error);
      throw error;
    }
  };
  
  /**
   * Get combined statistics
   */
  const getStats = (): Record<string, any> => {
    const uptime = Date.now() - stats.startTime;
    
    return {
      ...stats,
      uptime,
      queueSize: messageQueue.size(),
      queueSizes: messageQueue.getQueueSizes(),
      conversations: conversationManager.getStats(),
      humanInterface: humanInterface.getStats(),
      messagesPerMinute: stats.messagesProcessed / (uptime / 60000)
    };
  };
  
  /**
   * Cleanup old data
   */
  const cleanup = (): void => {
    conversationManager.cleanup();
    logger.info('Communication manager cleanup completed');
  };
  
  /**
   * Destroy the manager
   */
  const destroy = (): void => {
    conversationManager.destroy();
    humanInterface.destroy();
    messageQueue.clear();
    emitter.removeAllListeners();
    logger.info('Communication manager destroyed');
  };
  
  // Start periodic cleanup
  const cleanupInterval = setInterval(() => cleanup(), config.cleanupInterval || 3600000);
  
  // Cleanup on destroy
  emitter.on('destroy', () => {
    clearInterval(cleanupInterval);
  });
  
  return {
    // Queue management
    enqueueMessage,
    processNextMessage,
    
    // Human interface
    connectHuman: humanInterface.connect,
    disconnectHuman: humanInterface.disconnect,
    sendToHuman: humanInterface.send,
    broadcastToHumans: humanInterface.broadcast,
    
    // Conversation management
    addConversationTurn: conversationManager.addTurn,
    getConversationContext: conversationManager.getContext,
    
    // AI integration
    processAIRequest,
    
    // System management
    getStats,
    cleanup,
    destroy,
    
    // Event handling
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
  };
};