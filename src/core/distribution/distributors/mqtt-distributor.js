/**
 * MQTT Distributor
 * Handles distribution via MQTT messaging protocol
 */

import { createBaseDistributor, DistributorCapabilities } from '../base-distributor.js';

/**
 * Create MQTT distributor for IoT and pub-sub messaging
 * @param {Object} config - MQTT distributor configuration
 * @returns {Object} MQTT distributor instance
 */
export const createMqttDistributor = (config = {}) => {
  const baseDistributor = createBaseDistributor({
    name: 'mqtt',
    ...config
  });

  const state = {
    client: null,
    config: {
      broker: config.broker || 'mqtt://localhost:1883',
      clientId: config.clientId || `synopticon-${Date.now()}`,
      username: config.username,
      password: config.password,
      keepalive: config.keepalive || 60,
      connectTimeout: config.connectTimeout || 30000,
      reconnectPeriod: config.reconnectPeriod || 1000,
      qos: config.qos !== undefined ? config.qos : 1,
      retain: config.retain !== undefined ? config.retain : false,
      topics: {
        prefix: 'synopticon',
        faces: 'synopticon/faces',
        emotions: 'synopticon/emotions',
        health: 'synopticon/health',
        alerts: 'synopticon/alerts',
        ...config.topics
      },
      ...config
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.RECEIVE,
      DistributorCapabilities.SUBSCRIBE,
      DistributorCapabilities.BROADCAST,
      DistributorCapabilities.RELIABLE
    ],
    subscriptions: new Map(), // topic -> callback
    isConnected: false
  };

  /**
   * Create MQTT client
   */
  const createClient = async () => {
    try {
      // Dynamic import for MQTT client (works in both Node.js and Bun)
      let mqtt;
      try {
        mqtt = await import('mqtt');
      } catch (error) {
        console.warn('MQTT package not available. Install with: bun add mqtt');
        throw new Error('MQTT package not installed');
      }

      const client = mqtt.connect(state.config.broker, {
        clientId: state.config.clientId,
        username: state.config.username,
        password: state.config.password,
        keepalive: state.config.keepalive,
        connectTimeout: state.config.connectTimeout,
        reconnectPeriod: state.config.reconnectPeriod,
        clean: true
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MQTT connection timeout'));
        }, state.config.connectTimeout);

        client.on('connect', () => {
          clearTimeout(timeout);
          state.isConnected = true;
          console.log(`🔗 MQTT distributor connected to ${state.config.broker}`);
          
          baseDistributor._updateHealth('healthy', {
            connected: true,
            broker: state.config.broker,
            clientId: state.config.clientId
          });
          
          resolve(client);
        });

        client.on('error', (error) => {
          clearTimeout(timeout);
          state.isConnected = false;
          console.error('MQTT connection error:', error);
          
          baseDistributor._updateHealth('error', {
            connected: false,
            lastError: error.message
          });
          
          reject(error);
        });

        client.on('close', () => {
          state.isConnected = false;
          console.log('🔌 MQTT connection closed');
          
          baseDistributor._updateHealth('disconnected', {
            connected: false
          });
        });

        client.on('reconnect', () => {
          console.log('🔄 MQTT reconnecting...');
        });

        client.on('message', (topic, message, packet) => {
          handleMessage(topic, message, packet);
        });
      });
    } catch (error) {
      console.error('Failed to create MQTT client:', error);
      throw error;
    }
  };

  /**
   * Handle incoming MQTT messages
   */
  const handleMessage = (topic, message, packet) => {
    try {
      const data = JSON.parse(message.toString());
      const callback = state.subscriptions.get(topic);
      
      if (callback) {
        callback(data, { topic, packet });
      }
      
      baseDistributor._updateStats('messagesReceived');
    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  };

  /**
   * Get topic for event type
   */
  const getTopicForEvent = (event) => {
    // Check for specific topic mapping
    if (state.config.topics[event]) {
      return state.config.topics[event];
    }
    
    // Use prefix with event name
    return `${state.config.topics.prefix}/${event}`;
  };

  /**
   * Send data via MQTT
   */
  const send = async (event, data, options = {}) => {
    if (!state.client || !state.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const startTime = Date.now();
    const topic = options.topic || getTopicForEvent(event);
    const qos = options.qos !== undefined ? options.qos : state.config.qos;
    const retain = options.retain !== undefined ? options.retain : state.config.retain;

    const payload = JSON.stringify({
      event,
      data,
      timestamp: Date.now(),
      metadata: {
        source: 'synopticon-api',
        distributor: 'mqtt',
        clientId: state.config.clientId,
        ...options.metadata
      }
    });

    return new Promise((resolve, reject) => {
      state.client.publish(topic, payload, { qos, retain }, (error) => {
        const duration = Date.now() - startTime;
        
        if (error) {
          baseDistributor._updateStats('errors');
          baseDistributor._updateHealth('error', { lastError: error.message });
          reject(new Error(`MQTT publish failed: ${error.message}`));
        } else {
          baseDistributor._updateStats('messagesSent');
          baseDistributor._updateHealth('healthy', { lastSuccessfulSend: Date.now() });
          
          resolve({
            success: true,
            event,
            topic,
            duration,
            qos,
            retain
          });
        }
      });
    });
  };

  /**
   * Connect to MQTT broker
   */
  const connect = async () => {
    try {
      state.client = await createClient();
      return true;
    } catch (error) {
      console.error('Failed to connect to MQTT broker:', error);
      return false;
    }
  };

  /**
   * Disconnect from MQTT broker
   */
  const disconnect = async () => {
    if (state.client) {
      return new Promise((resolve) => {
        state.client.end(false, () => {
          state.isConnected = false;
          console.log('🛑 MQTT client disconnected');
          baseDistributor._updateHealth('disconnected');
          resolve(true);
        });
      });
    }
    return true;
  };

  /**
   * Subscribe to MQTT topic
   */
  const subscribe = (topic, callback, options = {}) => {
    if (!state.client || !state.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const qos = options.qos !== undefined ? options.qos : state.config.qos;

    return new Promise((resolve, reject) => {
      state.client.subscribe(topic, { qos }, (error, granted) => {
        if (error) {
          reject(error);
        } else {
          state.subscriptions.set(topic, callback);
          console.log(`📡 Subscribed to MQTT topic: ${topic}`);
          resolve(granted);
        }
      });
    });
  };

  /**
   * Unsubscribe from MQTT topic
   */
  const unsubscribe = (topic) => {
    if (!state.client || !state.isConnected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      state.client.unsubscribe(topic, (error) => {
        if (error) {
          reject(error);
        } else {
          state.subscriptions.delete(topic);
          console.log(`📡 Unsubscribed from MQTT topic: ${topic}`);
          resolve();
        }
      });
    });
  };

  /**
   * Broadcast to multiple topics
   */
  const broadcast = async (event, data, options = {}) => {
    const topics = options.topics || Object.values(state.config.topics);
    const results = [];

    for (const topic of topics) {
      try {
        const result = await send(event, data, { ...options, topic });
        results.push({ topic, ...result });
      } catch (error) {
        results.push({
          topic,
          success: false,
          error: error.message
        });
      }
    }

    return {
      broadcast: true,
      event,
      results,
      summary: {
        total: topics.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  };

  /**
   * Get MQTT-specific health information
   */
  const getHealth = () => {
    const baseHealth = baseDistributor.getHealth();
    
    return {
      ...baseHealth,
      protocol: 'mqtt',
      broker: state.config.broker,
      clientId: state.config.clientId,
      connected: state.isConnected,
      topics: Object.keys(state.config.topics),
      subscriptions: Array.from(state.subscriptions.keys()),
      capabilities: state.capabilities
    };
  };

  /**
   * Cleanup MQTT resources
   */
  const cleanup = async () => {
    // Unsubscribe from all topics
    const unsubscribePromises = Array.from(state.subscriptions.keys())
      .map(topic => unsubscribe(topic).catch(console.error));
    
    await Promise.allSettled(unsubscribePromises);
    
    // Disconnect from broker
    await disconnect();
    
    state.subscriptions.clear();
  };

  // Return enhanced distributor with MQTT-specific methods
  return {
    ...baseDistributor,
    
    // Override base methods
    send,
    connect,
    disconnect,
    broadcast,
    getHealth,
    cleanup,
    
    // MQTT-specific methods
    subscribe,
    unsubscribe,
    publish: send, // Alias for MQTT terminology
    getCapabilities: () => [...state.capabilities],
    getTopics: () => ({ ...state.config.topics }),
    setTopic: (event, topic) => {
      state.config.topics[event] = topic;
    },
    
    // Configuration
    getBroker: () => state.config.broker,
    getClientId: () => state.config.clientId,
    isConnected: () => state.isConnected,
    
    // Protocol identifier
    protocol: 'mqtt'
  };
};

export default createMqttDistributor;