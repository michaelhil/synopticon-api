/**
 * Cognitive Distribution Adapter
 * Integrates cognitive advisory system with the real-time distribution system
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Message types for cognitive system distribution
 */
export const COGNITIVE_MESSAGE_TYPES = {
  STATE_UPDATE: 'cognitive-state-update',
  PERFORMANCE_ANALYSIS: 'cognitive-performance-analysis',
  ADVISORY_RESPONSE: 'cognitive-advisory-response',
  EMERGENCY_ALERT: 'cognitive-emergency-alert',
  FUSION_RESULT: 'cognitive-fusion-result',
  SYSTEM_STATUS: 'cognitive-system-status',
  HUMAN_STATE: 'cognitive-human-state',
  ENVIRONMENTAL_DATA: 'cognitive-environmental-data',
  PREDICTION_UPDATE: 'cognitive-prediction-update'
};

/**
 * Create cognitive distribution adapter
 */
export const createCognitiveDistributionAdapter = (cognitiveSystem, distributionSystem) => {
  const subscriptions = new Map();
  const clients = new Set();
  
  /**
   * Subscribe to cognitive system events and distribute them
   */
  const initializeEventDistribution = () => {
    // State manager events
    const stateChangeHandler = (event) => {
      const message = {
        type: COGNITIVE_MESSAGE_TYPES.STATE_UPDATE,
        timestamp: Date.now(),
        data: {
          path: event.path,
          oldValue: event.oldValue,
          newValue: event.newValue,
          metadata: event.metadata
        }
      };
      
      distributeMessage(message);
    };
    
    cognitiveSystem.stateManager.on('stateChange', stateChangeHandler);
    subscriptions.set('stateChange', stateChangeHandler);
    
    // Fusion engine events
    const fusionCompleteHandler = (event) => {
      const message = {
        type: COGNITIVE_MESSAGE_TYPES.FUSION_RESULT,
        timestamp: Date.now(),
        data: {
          fusionType: event.type,
          result: event.result
        }
      };
      
      distributeMessage(message);
    };
    
    cognitiveSystem.fusionEngine.on('fusionCompleted', fusionCompleteHandler);
    subscriptions.set('fusionCompleted', fusionCompleteHandler);
    
    // Pipeline system events
    const taskCompleteHandler = (event) => {
      if (event.task.type === 'performance-analysis') {
        const message = {
          type: COGNITIVE_MESSAGE_TYPES.PERFORMANCE_ANALYSIS,
          timestamp: Date.now(),
          data: {
            task: event.task,
            result: event.result,
            metrics: event.metrics
          }
        };
        
        distributeMessage(message);
      }
    };
    
    cognitiveSystem.pipelineSystem.on('taskCompleted', taskCompleteHandler);
    subscriptions.set('taskCompleted', taskCompleteHandler);
    
    // Context orchestrator events
    const responseCompleteHandler = (response) => {
      let messageType = COGNITIVE_MESSAGE_TYPES.ADVISORY_RESPONSE;
      
      // Determine message type based on response route
      if (response.route === 'emergency-response') {
        messageType = COGNITIVE_MESSAGE_TYPES.EMERGENCY_ALERT;
      }
      
      const message = {
        type: messageType,
        timestamp: Date.now(),
        data: response
      };
      
      distributeMessage(message);
    };
    
    cognitiveSystem.contextOrchestrator.on('responseCompleted', responseCompleteHandler);
    subscriptions.set('responseCompleted', responseCompleteHandler);
    
    // Communication manager events
    const humanInputHandler = (event) => {
      const message = {
        type: COGNITIVE_MESSAGE_TYPES.HUMAN_STATE,
        timestamp: Date.now(),
        data: event
      };
      
      distributeMessage(message, 'human-interface');
    };
    
    cognitiveSystem.communicationManager.on('humanInput', humanInputHandler);
    subscriptions.set('humanInput', humanInputHandler);
    
    logger.info('✅ Cognitive event distribution initialized');
  };
  
  /**
   * Distribute message through distribution system
   */
  const distributeMessage = async (message, channel = 'cognitive') => {
    try {
      // Add cognitive system identifier
      message.source = 'cognitive-advisory-system';
      message.id = `cog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Send to distribution system
      if (distributionSystem && typeof distributionSystem.distribute === 'function') {
        await distributionSystem.distribute(channel, message);
      } else {
        // Fallback: send to all connected clients directly
        clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(message));
          }
        });
      }
      
      logger.debug(`Distributed cognitive message: ${message.type}`);
    } catch (error) {
      logger.error('Failed to distribute cognitive message:', error);
    }
  };
  
  /**
   * Register a client for cognitive updates
   */
  const registerClient = (client, subscriptionTypes = Object.values(COGNITIVE_MESSAGE_TYPES)) => {
    clients.add(client);
    
    // Store client subscription preferences
    client.cognitiveSubscriptions = new Set(subscriptionTypes);
    
    // Handle client disconnect
    const cleanup = () => {
      clients.delete(client);
      logger.debug('Client disconnected from cognitive distribution');
    };
    
    client.addEventListener('close', cleanup);
    client.addEventListener('error', cleanup);
    
    // Send initial system status
    const statusMessage = {
      type: COGNITIVE_MESSAGE_TYPES.SYSTEM_STATUS,
      timestamp: Date.now(),
      source: 'cognitive-advisory-system',
      id: `cog-status-${Date.now()}`,
      data: cognitiveSystem.contextOrchestrator.getSystemStatus()
    };
    
    if (client.readyState === 1) {
      client.send(JSON.stringify(statusMessage));
    }
    
    logger.debug(`Client registered for cognitive updates: ${subscriptionTypes.length} types`);
    
    return cleanup;
  };
  
  /**
   * Send periodic system status updates
   */
  const startStatusBroadcast = (intervalMs = 30000) => {
    const statusInterval = setInterval(() => {
      const statusMessage = {
        type: COGNITIVE_MESSAGE_TYPES.SYSTEM_STATUS,
        timestamp: Date.now(),
        source: 'cognitive-advisory-system',
        id: `cog-status-${Date.now()}`,
        data: {
          status: cognitiveSystem.contextOrchestrator.getSystemStatus(),
          metrics: {
            pipeline: cognitiveSystem.pipelineSystem.getMetrics(),
            fusion: cognitiveSystem.fusionEngine.getDataQuality(),
            llm: cognitiveSystem.llmIntegration.getMetrics()
          }
        }
      };
      
      distributeMessage(statusMessage);
    }, intervalMs);
    
    return () => clearInterval(statusInterval);
  };
  
  /**
   * Handle incoming messages from distribution clients
   */
  const handleIncomingMessage = async (message, client) => {
    try {
      const { type, data } = message;
      
      switch (type) {
        case 'cognitive-query':
          const response = await cognitiveSystem.contextOrchestrator.handleUserQuery(
            data.query, 
            data.context
          );
          
          const responseMessage = {
            type: COGNITIVE_MESSAGE_TYPES.ADVISORY_RESPONSE,
            timestamp: Date.now(),
            source: 'cognitive-advisory-system',
            id: `cog-response-${Date.now()}`,
            requestId: message.id,
            data: response
          };
          
          if (client && client.readyState === 1) {
            client.send(JSON.stringify(responseMessage));
          } else {
            distributeMessage(responseMessage);
          }
          break;
          
        case 'cognitive-state-update':
          if (data.category && data.type && data.values) {
            const quality = cognitiveSystem.fusionEngine.ingestData(
              data.category, 
              data.type, 
              data.values
            );
            
            const statePath = `${data.category}.${data.type}`;
            cognitiveSystem.stateManager.updateState(statePath, data.values);
          }
          break;
          
        case 'cognitive-emergency':
          await cognitiveSystem.contextOrchestrator.handleEmergency(data);
          break;
          
        default:
          logger.warn(`Unknown cognitive message type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to handle incoming cognitive message:', error);
    }
  };
  
  /**
   * Get real-time system metrics for distribution
   */
  const getRealtimeMetrics = () => {
    return {
      timestamp: Date.now(),
      connectedClients: clients.size,
      systemStatus: cognitiveSystem.contextOrchestrator.getSystemStatus(),
      pipeline: cognitiveSystem.pipelineSystem.getMetrics(),
      fusion: cognitiveSystem.fusionEngine.getDataQuality(),
      llm: cognitiveSystem.llmIntegration.getMetrics(),
      communication: cognitiveSystem.communicationManager.getStatus()
    };
  };
  
  /**
   * Create cognitive-specific distribution channels
   */
  const createCognitiveChannels = () => {
    const channels = {
      'cognitive': 'General cognitive system updates',
      'cognitive-emergency': 'Emergency alerts and critical notifications',
      'cognitive-performance': 'Performance analysis and monitoring',
      'cognitive-advisory': 'AI advisory responses and recommendations',
      'cognitive-state': 'Human and system state updates',
      'cognitive-fusion': 'Multi-modal data fusion results',
      'cognitive-predictions': 'Predictive analysis and forecasting'
    };
    
    return channels;
  };
  
  // Initialize event distribution
  initializeEventDistribution();
  
  return {
    distributeMessage,
    registerClient,
    handleIncomingMessage,
    getRealtimeMetrics,
    createCognitiveChannels,
    startStatusBroadcast,
    messageTypes: COGNITIVE_MESSAGE_TYPES,
    cleanup: () => {
      // Cleanup all subscriptions
      subscriptions.forEach((handler, eventName) => {
        // Remove event listeners based on the component
        if (eventName === 'stateChange') {
          cognitiveSystem.stateManager.off('stateChange', handler);
        } else if (eventName === 'fusionCompleted') {
          cognitiveSystem.fusionEngine.off('fusionCompleted', handler);
        } else if (eventName === 'taskCompleted') {
          cognitiveSystem.pipelineSystem.off('taskCompleted', handler);
        } else if (eventName === 'responseCompleted') {
          cognitiveSystem.contextOrchestrator.off('responseCompleted', handler);
        } else if (eventName === 'humanInput') {
          cognitiveSystem.communicationManager.off('humanInput', handler);
        }
      });
      
      subscriptions.clear();
      clients.clear();
      logger.info('🧹 Cognitive distribution adapter cleaned up');
    }
  };
};