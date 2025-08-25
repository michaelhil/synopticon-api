/**
 * Base Distributor Interface
 * Common interface that all distribution mechanisms must implement
 */

/**
 * Create a base distributor with common functionality
 * @param {Object} config - Distributor configuration
 * @returns {Object} Base distributor interface
 */
export const createBaseDistributor = (config = {}) => {
  const state = {
    name: config.name || 'unknown',
    enabled: config.enabled !== false,
    stats: {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastActivity: null,
      startTime: Date.now()
    },
    health: {
      status: 'initializing',
      lastCheck: Date.now(),
      uptime: 0
    }
  };

  /**
   * Update distributor statistics
   */
  const updateStats = (type, increment = 1) => {
    state.stats[type] += increment;
    state.stats.lastActivity = Date.now();
  };

  /**
   * Update health status
   */
  const updateHealth = (status, details = {}) => {
    state.health.status = status;
    state.health.lastCheck = Date.now();
    state.health.uptime = Date.now() - state.stats.startTime;
    state.health = { ...state.health, ...details };
  };

  /**
   * Base distributor interface - all distributors must implement these methods
   */
  return {
    // Distributor identity
    name: state.name,
    enabled: state.enabled,

    // Core interface methods (must be overridden by implementations)
    send: async (event, data, options = {}) => {
      throw new Error(`send() method not implemented for distributor: ${state.name}`);
    },

    connect: async () => {
      throw new Error(`connect() method not implemented for distributor: ${state.name}`);
    },

    disconnect: async () => {
      updateHealth('disconnected');
      return true;
    },

    // Optional interface methods (can be overridden)
    subscribe: (pattern, callback) => {
      console.warn(`subscribe() not supported by distributor: ${state.name}`);
      return false;
    },

    unsubscribe: (pattern) => {
      console.warn(`unsubscribe() not supported by distributor: ${state.name}`);
      return false;
    },

    broadcast: async (event, data, options = {}) => {
      // Default implementation delegates to send
      return await this.send(event, data, { ...options, broadcast: true });
    },

    // Health and monitoring
    getHealth: () => ({
      name: state.name,
      status: state.health.status,
      uptime: state.health.uptime,
      lastCheck: state.health.lastCheck,
      enabled: state.enabled
    }),

    getStats: () => ({
      name: state.name,
      messagesSent: state.stats.messagesSent,
      messagesReceived: state.stats.messagesReceived,
      errors: state.stats.errors,
      lastActivity: state.stats.lastActivity,
      uptime: Date.now() - state.stats.startTime
    }),

    // Configuration
    updateConfig: (newConfig) => {
      Object.assign(config, newConfig);
      state.enabled = config.enabled !== false;
    },

    getConfig: () => ({ ...config }),

    // Cleanup
    cleanup: async () => {
      await this.disconnect();
      updateHealth('stopped');
      console.log(`🧹 Distributor ${state.name} cleaned up`);
    },

    // Internal utilities for implementations
    _updateStats: updateStats,
    _updateHealth: updateHealth,
    _getState: () => ({ ...state })
  };
};

/**
 * Distributor capability flags
 */
export const DistributorCapabilities = {
  SEND: 'send',
  RECEIVE: 'receive', 
  SUBSCRIBE: 'subscribe',
  BROADCAST: 'broadcast',
  PERSISTENT: 'persistent',
  REAL_TIME: 'real_time',
  HIGH_FREQUENCY: 'high_frequency',
  RELIABLE: 'reliable'
};

/**
 * Common distributor events
 */
export const DistributorEvents = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  ERROR: 'error',
  HEALTH_CHECK: 'health_check'
};