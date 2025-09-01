/**
 * Bidirectional Communication Manager
 * Handles multi-channel communication between human, AI, and simulator
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Priority queue for message handling
 */
const createPriorityQueue = () => {
  const queues = {
    critical: [],
    high: [],
    normal: [],
    low: []
  };
  
  const enqueue = (item, priority = 'normal') => {
    if (!queues[priority]) {
      priority = 'normal';
    }
    queues[priority].push(item);
  };
  
  const dequeue = () => {
    for (const priority of ['critical', 'high', 'normal', 'low']) {
      if (queues[priority].length > 0) {
        return queues[priority].shift();
      }
    }
    return null;
  };
  
  const peek = () => {
    for (const priority of ['critical', 'high', 'normal', 'low']) {
      if (queues[priority].length > 0) {
        return queues[priority][0];
      }
    }
    return null;
  };
  
  const size = () => {
    return Object.values(queues).reduce((sum, q) => sum + q.length, 0);
  };
  
  return { enqueue, dequeue, peek, size };
};

/**
 * Conversation context manager
 */
const createConversationManager = () => {
  const conversations = new Map();
  
  const getOrCreate = (sessionId) => {
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, {
        id: sessionId,
        turns: [],
        context: {},
        startTime: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      });
    }
    return conversations.get(sessionId);
  };
  
  const addTurn = (sessionId, role, content, metadata = {}) => {
    const conversation = getOrCreate(sessionId);
    conversation.turns.push({
      role,
      content,
      timestamp: Date.now(),
      metadata
    });
    conversation.lastActivity = Date.now();
    
    // Keep conversation history manageable
    if (conversation.turns.length > 100) {
      conversation.turns = conversation.turns.slice(-50);
    }
  };
  
  const getContext = (sessionId, maxTurns = 10) => {
    const conversation = conversations.get(sessionId);
    if (!conversation) return [];
    
    return conversation.turns.slice(-maxTurns);
  };
  
  const updateContext = (sessionId, key, value) => {
    const conversation = getOrCreate(sessionId);
    conversation.context[key] = value;
    conversation.lastActivity = Date.now();
  };
  
  const cleanup = (maxAge = 3600000) => {
    const now = Date.now();
    for (const [id, conv] of conversations.entries()) {
      if (now - conv.lastActivity > maxAge) {
        conversations.delete(id);
      }
    }
  };
  
  return { getOrCreate, addTurn, getContext, updateContext, cleanup };
};

/**
 * Human Interface Channel
 */
const createHumanInterfaceChannel = () => {
  const emitter = new EventEmitter();
  const sessions = new Map();
  
  const connect = (sessionId, ws) => {
    sessions.set(sessionId, {
      id: sessionId,
      websocket: ws,
      connected: Date.now(),
      lastMessage: null
    });
    
    emitter.emit('connected', { sessionId });
    logger.info(`Human interface connected: ${sessionId}`);
  };
  
  const disconnect = (sessionId) => {
    sessions.delete(sessionId);
    emitter.emit('disconnected', { sessionId });
    logger.info(`Human interface disconnected: ${sessionId}`);
  };
  
  const send = (sessionId, message) => {
    const session = sessions.get(sessionId);
    if (!session || !session.websocket) {
      logger.warn(`Cannot send to disconnected session: ${sessionId}`);
      return false;
    }
    
    try {
      const payload = JSON.stringify({
        type: 'advisory',
        ...message,
        timestamp: Date.now()
      });
      
      session.websocket.send(payload);
      session.lastMessage = Date.now();
      return true;
    } catch (error) {
      logger.error(`Failed to send message to ${sessionId}:`, error);
      return false;
    }
  };
  
  const broadcast = (message, filter = () => true) => {
    let sent = 0;
    for (const [sessionId, session] of sessions.entries()) {
      if (filter(session)) {
        if (send(sessionId, message)) {
          sent++;
        }
      }
    }
    return sent;
  };
  
  const notify = (alert) => {
    return broadcast({
      type: 'alert',
      alert,
      priority: alert.priority || 'normal'
    });
  };
  
  return {
    connect,
    disconnect,
    send,
    broadcast,
    notify,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    getSession: (id) => sessions.get(id),
    getSessions: () => Array.from(sessions.values())
  };
};

/**
 * Simulator Control Channel
 */
const createSimulatorControlChannel = () => {
  const emitter = new EventEmitter();
  const connections = new Map();
  
  const connect = (simulatorType, connection) => {
    connections.set(simulatorType, {
      type: simulatorType,
      connection,
      connected: Date.now(),
      lastCommand: null,
      stats: {
        commandsSent: 0,
        commandsSucceeded: 0,
        commandsFailed: 0
      }
    });
    
    emitter.emit('simulator-connected', { type: simulatorType });
    logger.info(`Simulator connected: ${simulatorType}`);
  };
  
  const disconnect = (simulatorType) => {
    connections.delete(simulatorType);
    emitter.emit('simulator-disconnected', { type: simulatorType });
    logger.info(`Simulator disconnected: ${simulatorType}`);
  };
  
  const send = async (command) => {
    const sim = connections.get(command.simulator);
    if (!sim) {
      throw new Error(`Simulator not connected: ${command.simulator}`);
    }
    
    sim.stats.commandsSent++;
    sim.lastCommand = Date.now();
    
    try {
      // Send command to simulator via API
      const response = await fetch('/api/telemetry/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: command.simulator,
          action: command.action,
          parameters: command.parameters,
          priority: command.priority || 'normal'
        })
      });
      
      const result = await response.json();
      
      if (result.result?.success) {
        sim.stats.commandsSucceeded++;
      } else {
        sim.stats.commandsFailed++;
      }
      
      emitter.emit('command-executed', {
        command,
        result,
        simulator: command.simulator
      });
      
      return result;
    } catch (error) {
      sim.stats.commandsFailed++;
      logger.error(`Simulator command failed:`, error);
      throw error;
    }
  };
  
  const adjustParameters = async (adjustments) => {
    const commands = [];
    
    for (const [parameter, value] of Object.entries(adjustments)) {
      commands.push({
        simulator: 'active', // Use currently active simulator
        action: `set-${parameter}`,
        parameters: { value }
      });
    }
    
    return Promise.all(commands.map(cmd => send(cmd)));
  };
  
  const getStatus = (simulatorType) => {
    return connections.get(simulatorType);
  };
  
  return {
    connect,
    disconnect,
    send,
    adjustParameters,
    getStatus,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    getConnections: () => Array.from(connections.values())
  };
};

/**
 * AI Dialogue Channel
 */
const createAIDialogueChannel = () => {
  const emitter = new EventEmitter();
  const context = new Map();
  
  const updateContext = (key, value) => {
    context.set(key, {
      value,
      updated: Date.now()
    });
    
    emitter.emit('context-updated', { key, value });
  };
  
  const getContext = (key) => {
    const entry = context.get(key);
    return entry ? entry.value : null;
  };
  
  const getAllContext = () => {
    const result = {};
    for (const [key, entry] of context.entries()) {
      result[key] = entry.value;
    }
    return result;
  };
  
  const clearContext = () => {
    context.clear();
    emitter.emit('context-cleared');
  };
  
  return {
    updateContext,
    getContext,
    getAllContext,
    clearContext,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
  };
};

/**
 * Intent parser for natural language understanding
 */
const parseIntent = (input) => {
  if (!input || typeof input !== 'string') {
    return { type: 'general', confidence: 0.1 };
  }
  const text = input.toLowerCase();
  
  // Command intents
  if (text.includes('set') || text.includes('change') || text.includes('adjust')) {
    return { type: 'command', confidence: 0.8 };
  }
  
  // Query intents
  if (text.includes('what') || text.includes('how') || text.includes('why') || 
      text.includes('when') || text.includes('where')) {
    return { type: 'query', confidence: 0.9 };
  }
  
  // Confirmation intents
  if (text.includes('yes') || text.includes('no') || text.includes('confirm') ||
      text.includes('cancel')) {
    return { type: 'confirmation', confidence: 0.95 };
  }
  
  // Help intents
  if (text.includes('help') || text.includes('assist') || text.includes('guide')) {
    return { type: 'help', confidence: 0.85 };
  }
  
  // Emergency intents
  if (text.includes('emergency') || text.includes('urgent') || text.includes('critical')) {
    return { type: 'emergency', confidence: 0.95 };
  }
  
  // Default
  return { type: 'general', confidence: 0.5 };
};

/**
 * Main Bidirectional Communication Manager
 */
export const createBidirectionalCommunicationManager = (config = {}) => {
  const channels = {
    human: createHumanInterfaceChannel(),
    simulator: createSimulatorControlChannel(),
    ai: createAIDialogueChannel()
  };
  
  const messageQueue = createPriorityQueue();
  const conversationManager = createConversationManager();
  const emitter = new EventEmitter();
  
  let processing = false;
  let stateManager = null;
  
  /**
   * Set state manager reference
   */
  const setStateManager = (manager) => {
    stateManager = manager;
  };
  
  /**
   * Handle human input
   */
  const handleHumanInput = async (sessionId, input, metadata = {}) => {
    logger.info(`Human input from ${sessionId}: ${input}`);
    
    // Parse intent
    const intent = parseIntent(input);
    
    // Add to conversation history
    conversationManager.addTurn(sessionId, 'human', input, { intent });
    
    // Update state
    if (stateManager) {
      stateManager.updateState('interaction.dialogue.lastUserInput', input);
      stateManager.updateState('interaction.dialogue.currentIntent', intent.type);
    }
    
    // Queue for processing
    messageQueue.enqueue({
      type: 'human-input',
      sessionId,
      input,
      intent,
      metadata,
      timestamp: Date.now()
    }, intent.type === 'emergency' ? 'critical' : 'normal');
    
    // Process queue
    processMessageQueue();
    
    // Return immediate acknowledgment
    return {
      acknowledged: true,
      intent: intent.type,
      confidence: intent.confidence,
      response: processedResponse
    };
  };
  
  /**
   * Send command to simulator
   */
  const sendSimulatorCommand = async (command) => {
    logger.info(`Sending simulator command: ${command.action}`);
    
    // Add to command history
    if (stateManager) {
      const history = stateManager.getState('interaction.commands.history') || [];
      history.push({
        command,
        timestamp: Date.now(),
        status: 'pending'
      });
      stateManager.updateState('interaction.commands.history', history.slice(-100));
      stateManager.updateState('interaction.commands.executing', command);
    }
    
    try {
      const result = await channels.simulator.send(command);
      
      // Update success rate
      if (stateManager) {
        const stats = {
          total: (stateManager.getState('interaction.commands.stats.total') || 0) + 1,
          success: (stateManager.getState('interaction.commands.stats.success') || 0) + 
                   (result.result?.success ? 1 : 0)
        };
        stateManager.updateState('interaction.commands.stats', stats);
        stateManager.updateState('interaction.commands.successRate', 
                                stats.success / stats.total);
        stateManager.updateState('interaction.commands.executing', null);
      }
      
      return result;
    } catch (error) {
      logger.error(`Command execution failed:`, error);
      
      if (stateManager) {
        stateManager.updateState('interaction.commands.executing', null);
      }
      
      throw error;
    }
  };
  
  /**
   * Broadcast alert to all channels
   */
  const broadcastAlert = (alert) => {
    logger.warn(`Broadcasting alert: ${alert.message}`);
    
    // Send to human interfaces
    channels.human.notify(alert);
    
    // Adjust simulator if needed
    if (alert.mitigations) {
      channels.simulator.adjustParameters(alert.mitigations);
    }
    
    // Update AI context
    channels.ai.updateContext('lastAlert', alert);
    
    // Update state
    if (stateManager) {
      const alerts = stateManager.getState('interaction.alerts.active') || [];
      alerts.push({
        ...alert,
        timestamp: Date.now(),
        acknowledged: false
      });
      stateManager.updateState('interaction.alerts.active', alerts);
      stateManager.updateState('interaction.alerts.priority', alert.priority);
    }
    
    return true;
  };
  
  /**
   * Process message queue
   */
  const processMessageQueue = async () => {
    if (processing || messageQueue.size() === 0) {
      return;
    }
    
    processing = true;
    
    try {
      while (messageQueue.size() > 0) {
        const message = messageQueue.dequeue();
        
        switch (message.type) {
          case 'human-input':
            await processHumanInput(message);
            break;
          
          case 'simulator-feedback':
            await processSimulatorFeedback(message);
            break;
          
          case 'ai-response':
            await processAIResponse(message);
            break;
          
          default:
            logger.warn(`Unknown message type: ${message.type}`);
        }
      }
    } catch (error) {
      logger.error(`Message processing error:`, error);
    } finally {
      processing = false;
    }
  };
  
  /**
   * Process human input message
   */
  const processHumanInput = async (message) => {
    const { sessionId, input, intent } = message;
    
    // Generate contextual response
    const conversationContext = conversationManager.getContext(sessionId);
    const systemContext = stateManager ? {
      human: stateManager.getState('human'),
      system: stateManager.getState('system'),
      environment: stateManager.getState('environment')
    } : {};
    
    // For now, create a simple response
    // This will be replaced with LLM integration in Phase 3
    let response = {
      type: 'response',
      content: `I understand you're asking about: "${input}". `,
      suggestions: []
    };
    
    switch (intent.type) {
      case 'emergency':
        response.content += 'Emergency acknowledged. Taking immediate action.';
        response.priority = 'critical';
        response.actions = ['stabilize-system', 'alert-supervisor'];
        break;
      
      case 'command':
        response.content += 'Command received. Processing your request.';
        response.actions = ['execute-command'];
        break;
      
      case 'query':
        response.content += 'Let me check that information for you.';
        response.actions = ['fetch-data'];
        break;
      
      case 'help':
        response.content += 'I can help you with system control, monitoring, and guidance.';
        response.suggestions = [
          'Show system status',
          'Check performance metrics',
          'Adjust automation level'
        ];
        break;
      
      default:
        response.content += 'How can I assist you further?';
    }
    
    // Add to conversation
    conversationManager.addTurn(sessionId, 'assistant', response.content, { intent: intent.type });
    
    // Send response to human
    channels.human.send(sessionId, response);
    
    // Update state
    if (stateManager) {
      stateManager.updateState('interaction.dialogue.lastSystemOutput', response.content);
      stateManager.updateState('interaction.dialogue.turn', 
        (stateManager.getState('interaction.dialogue.turn') || 0) + 1);
    }
    
    // Execute any actions
    if (response.actions) {
      for (const action of response.actions) {
        await executeAction(action, message);
      }
    }
  };
  
  /**
   * Process simulator feedback
   */
  const processSimulatorFeedback = async (message) => {
    logger.info(`Processing simulator feedback:`, message);
    
    // Update state based on feedback
    if (stateManager && message.data) {
      if (message.data.telemetry) {
        stateManager.updateState('system.vehicle', message.data.telemetry);
      }
      
      if (message.data.status) {
        stateManager.updateState('system.status', message.data.status);
      }
    }
    
    // Check for alerts
    if (message.data?.alerts) {
      for (const alert of message.data.alerts) {
        broadcastAlert(alert);
      }
    }
  };
  
  /**
   * Process AI response
   */
  const processAIResponse = async (message) => {
    logger.info(`Processing AI response:`, message);
    
    // Route to appropriate channel
    if (message.target === 'human' && message.sessionId) {
      channels.human.send(message.sessionId, message.content);
    }
    
    if (message.target === 'simulator' && message.command) {
      await sendSimulatorCommand(message.command);
    }
  };
  
  /**
   * Execute action
   */
  const executeAction = async (action, context) => {
    logger.info(`Executing action: ${action}`);
    
    switch (action) {
      case 'stabilize-system':
        await sendSimulatorCommand({
          simulator: 'active',
          action: 'engage-stability',
          parameters: { mode: 'auto' },
          priority: 'critical'
        });
        break;
      
      case 'alert-supervisor':
        broadcastAlert({
          level: 'critical',
          message: 'Emergency situation detected',
          priority: 'critical',
          requiresAck: true
        });
        break;
      
      case 'fetch-data':
        // Fetch relevant data based on context
        if (stateManager) {
          const data = stateManager.getSnapshot();
          channels.human.send(context.sessionId, {
            type: 'data',
            content: data
          });
        }
        break;
      
      default:
        logger.warn(`Unknown action: ${action}`);
    }
  };
  
  /**
   * Connect WebSocket for human interface
   */
  const connectHuman = (sessionId, ws) => {
    channels.human.connect(sessionId, ws);
    
    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'input':
            await handleHumanInput(sessionId, message.content, message.metadata);
            break;
          
          case 'acknowledge':
            acknowledgeAlert(sessionId, message.alertId);
            break;
          
          default:
            logger.warn(`Unknown message type from human: ${message.type}`);
        }
      } catch (error) {
        logger.error(`Error processing human message:`, error);
      }
    });
    
    ws.on('close', () => {
      channels.human.disconnect(sessionId);
    });
  };
  
  /**
   * Connect to simulator
   */
  const connectSimulator = (type, connection) => {
    channels.simulator.connect(type, connection);
  };
  
  /**
   * Acknowledge alert
   */
  const acknowledgeAlert = (sessionId, alertId) => {
    if (!stateManager) return;
    
    const alerts = stateManager.getState('interaction.alerts.active') || [];
    const alert = alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = sessionId;
      alert.acknowledgedAt = Date.now();
      
      stateManager.updateState('interaction.alerts.active', alerts);
      
      const acknowledged = stateManager.getState('interaction.alerts.acknowledged') || [];
      acknowledged.push(alert);
      stateManager.updateState('interaction.alerts.acknowledged', acknowledged.slice(-100));
    }
  };
  
  /**
   * Get system status
   */
  const getStatus = () => {
    return {
      channels: {
        human: {
          connected: channels.human.getSessions().length,
          sessions: channels.human.getSessions().map(s => s.id)
        },
        simulator: {
          connected: channels.simulator.getConnections().length,
          types: channels.simulator.getConnections().map(c => c.type)
        },
        ai: {
          contextSize: channels.ai.getAllContext().length
        }
      },
      queue: {
        size: messageQueue.size(),
        processing
      },
      conversations: {
        active: conversationManager.getOrCreate('test').turns.length
      }
    };
  };
  
  // Periodic cleanup
  setInterval(() => {
    conversationManager.cleanup();
  }, 60000);
  
  logger.info('✅ Bidirectional Communication Manager initialized');
  
  return {
    handleHumanInput,
    processHumanInput: handleHumanInput, // Alias for tests
    generateAIResponse: async (context) => {
      // Mock AI response for testing
      return {
        content: `Based on the current context, I recommend monitoring the situation closely.`,
        recommendations: ['monitor-closely', 'maintain-current-settings'],
        confidence: 0.85
      };
    },
    sendSimulatorCommand,
    broadcastAlert,
    connectHuman,
    connectSimulator,
    setStateManager,
    getStatus,
    channels,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
  };
};