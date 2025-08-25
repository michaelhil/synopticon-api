/**
 * Distribution Session Manager
 * Provides dynamic distributor control and session-based configuration
 */

import { createDistributionManager } from './distribution-manager.js';
import { createHttpDistributor } from './distributors/http-distributor.js';
import { createWebSocketDistributor } from './distributors/websocket-distributor.js';
import { createMqttDistributor } from './distributors/mqtt-distributor.js';
import { createUdpDistributor } from './distributors/udp-distributor.js';
import { createSseDistributor } from './distributors/sse-distributor.js';

/**
 * Distributor factory registry
 */
const DISTRIBUTOR_FACTORIES = {
  http: createHttpDistributor,
  websocket: createWebSocketDistributor,
  mqtt: createMqttDistributor,
  udp: createUdpDistributor,
  sse: createSseDistributor
};

/**
 * Create a distribution session manager for dynamic control
 * @param {Object} globalConfig - Global configuration defaults
 * @returns {Object} Session manager instance
 */
export const createDistributionSessionManager = (globalConfig = {}) => {
  const state = {
    sessions: new Map(), // sessionId -> session data
    globalConfig: {
      enableHealthCheck: true,
      healthCheckInterval: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...globalConfig
    },
    activeDistributorTypes: new Set(), // Track which types are available
    distributorConfigs: new Map() // type -> default config
  };

  /**
   * Register a default configuration for a distributor type
   */
  const registerDistributorConfig = (type, defaultConfig) => {
    if (!DISTRIBUTOR_FACTORIES[type]) {
      throw new Error(`Unknown distributor type: ${type}`);
    }
    
    state.distributorConfigs.set(type, defaultConfig);
    state.activeDistributorTypes.add(type);
    
    console.log(`📋 Registered default config for ${type} distributor`);
    return true;
  };

  /**
   * Create a new distribution session
   */
  const createSession = async (sessionId, sessionConfig = {}) => {
    if (state.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    console.log(`🆕 Creating distribution session: ${sessionId}`);

    const session = {
      id: sessionId,
      createdAt: Date.now(),
      config: { ...state.globalConfig, ...sessionConfig },
      distributionManager: null,
      activeDistributors: new Map(), // name -> distributor instance
      enabledTypes: new Set(sessionConfig.enabledDistributors || []),
      eventRouting: new Map(),
      status: 'initializing'
    };

    // Create distribution manager for this session
    session.distributionManager = createDistributionManager({
      enableHealthCheck: session.config.enableHealthCheck,
      healthCheckInterval: session.config.healthCheckInterval,
      retryAttempts: session.config.retryAttempts,
      retryDelay: session.config.retryDelay
    });

    // Initialize enabled distributors
    await initializeSessionDistributors(session, sessionConfig.distributors || {});

    // Set up event routing if provided
    if (sessionConfig.eventRouting) {
      for (const [event, distributors] of Object.entries(sessionConfig.eventRouting)) {
        session.distributionManager.setEventRouting(event, distributors);
        session.eventRouting.set(event, distributors);
      }
    }

    session.status = 'active';
    state.sessions.set(sessionId, session);

    console.log(`✅ Session ${sessionId} created with ${session.activeDistributors.size} active distributors`);
    return session;
  };

  /**
   * Initialize distributors for a session
   */
  const initializeSessionDistributors = async (session, distributorConfigs) => {
    const initPromises = [];

    for (const [type, config] of Object.entries(distributorConfigs)) {
      if (!DISTRIBUTOR_FACTORIES[type]) {
        console.warn(`⚠️ Unknown distributor type: ${type}, skipping`);
        continue;
      }

      // Skip if not in enabled types (if specified)
      if (session.enabledTypes.size > 0 && !session.enabledTypes.has(type)) {
        console.log(`⏭️ Distributor ${type} not enabled for session ${session.id}, skipping`);
        continue;
      }

      initPromises.push(initializeDistributor(session, type, config));
    }

    const results = await Promise.allSettled(initPromises);
    
    // Log initialization results
    results.forEach((result, index) => {
      const type = Object.keys(distributorConfigs)[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${type} distributor initialized for session ${session.id}`);
      } else {
        console.error(`❌ Failed to initialize ${type} distributor:`, result.reason?.message);
      }
    });
  };

  /**
   * Initialize a single distributor
   */
  const initializeDistributor = async (session, type, config) => {
    const factory = DISTRIBUTOR_FACTORIES[type];
    const defaultConfig = state.distributorConfigs.get(type) || {};
    const finalConfig = { ...defaultConfig, ...config };

    try {
      // Create distributor instance
      const distributor = factory(finalConfig);
      
      // Connect if it has a connect method
      if (distributor.connect && typeof distributor.connect === 'function') {
        const connected = await distributor.connect();
        if (!connected) {
          throw new Error(`Failed to connect ${type} distributor`);
        }
      }

      // Register with session's distribution manager
      const distributorName = `${type}_${session.id}`;
      session.distributionManager.registerDistributor(distributorName, distributor);
      session.activeDistributors.set(type, { 
        instance: distributor, 
        name: distributorName,
        config: finalConfig 
      });

      return distributor;
    } catch (error) {
      console.error(`Failed to initialize ${type} distributor:`, error.message);
      throw error;
    }
  };

  /**
   * Get an active session
   */
  const getSession = (sessionId) => {
    return state.sessions.get(sessionId);
  };

  /**
   * Enable a distributor type for an existing session
   */
  const enableDistributor = async (sessionId, type, config = {}) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.activeDistributors.has(type)) {
      console.log(`⚠️ Distributor ${type} already active in session ${sessionId}`);
      return session.activeDistributors.get(type).instance;
    }

    console.log(`🔌 Enabling ${type} distributor for session ${sessionId}`);
    
    await initializeDistributor(session, type, config);
    session.enabledTypes.add(type);
    
    return session.activeDistributors.get(type).instance;
  };

  /**
   * Disable a distributor type for an existing session
   */
  const disableDistributor = async (sessionId, type) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const distributorData = session.activeDistributors.get(type);
    if (!distributorData) {
      console.log(`⚠️ Distributor ${type} not active in session ${sessionId}`);
      return false;
    }

    console.log(`🔌 Disabling ${type} distributor for session ${sessionId}`);

    try {
      // Cleanup distributor
      if (distributorData.instance.cleanup) {
        await distributorData.instance.cleanup();
      }

      // Unregister from distribution manager
      session.distributionManager.unregisterDistributor(distributorData.name);
      
      // Remove from session
      session.activeDistributors.delete(type);
      session.enabledTypes.delete(type);

      return true;
    } catch (error) {
      console.error(`Failed to disable ${type} distributor:`, error.message);
      return false;
    }
  };

  /**
   * Reconfigure a distributor (disable + enable with new config)
   */
  const reconfigureDistributor = async (sessionId, type, newConfig) => {
    console.log(`🔄 Reconfiguring ${type} distributor for session ${sessionId}`);
    
    await disableDistributor(sessionId, type);
    return enableDistributor(sessionId, type, newConfig);
  };

  /**
   * Update event routing for a session
   */
  const updateEventRouting = (sessionId, eventRouting) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clear existing routing
    session.eventRouting.clear();

    // Set new routing
    for (const [event, distributors] of Object.entries(eventRouting)) {
      // Validate that all distributors are active
      const activeDistributorNames = Array.from(session.activeDistributors.values())
        .map(d => d.name);
      
      const validDistributors = distributors.filter(d => {
        // Check if it's a type name that maps to an active distributor
        const distributorData = session.activeDistributors.get(d);
        return distributorData || activeDistributorNames.includes(d);
      });

      if (validDistributors.length > 0) {
        session.distributionManager.setEventRouting(event, validDistributors);
        session.eventRouting.set(event, validDistributors);
      } else {
        console.warn(`⚠️ No active distributors found for event ${event}`);
      }
    }

    console.log(`📍 Updated event routing for session ${sessionId}: ${session.eventRouting.size} routes`);
  };

  /**
   * Distribute data through a session
   */
  const distribute = async (sessionId, event, data, options = {}) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.distributionManager.distribute(event, data, options.targets || ['all'], options);
  };

  /**
   * Route event through a session
   */
  const routeEvent = async (sessionId, event, data, options = {}) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.distributionManager.routeEvent(event, data, options);
  };

  /**
   * Get session status and health
   */
  const getSessionStatus = async (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const health = await session.distributionManager.performHealthCheck();
    const stats = session.distributionManager.getStats();

    return {
      sessionId,
      status: session.status,
      createdAt: session.createdAt,
      uptime: Date.now() - session.createdAt,
      activeDistributors: Array.from(session.activeDistributors.keys()),
      eventRoutes: Array.from(session.eventRouting.entries()),
      health,
      stats
    };
  };

  /**
   * List all active sessions
   */
  const listSessions = () => {
    return Array.from(state.sessions.keys()).map(sessionId => {
      const session = state.sessions.get(sessionId);
      return {
        sessionId,
        status: session.status,
        createdAt: session.createdAt,
        activeDistributors: Array.from(session.activeDistributors.keys()),
        eventRoutes: session.eventRouting.size
      };
    });
  };

  /**
   * Close a distribution session
   */
  const closeSession = async (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ Session ${sessionId} not found`);
      return false;
    }

    console.log(`🗑️ Closing distribution session: ${sessionId}`);

    try {
      // Cleanup all distributors
      for (const [type, distributorData] of session.activeDistributors) {
        try {
          if (distributorData.instance.cleanup) {
            await distributorData.instance.cleanup();
          }
        } catch (error) {
          console.error(`Error cleaning up ${type} distributor:`, error.message);
        }
      }

      // Cleanup distribution manager
      await session.distributionManager.cleanup();

      // Remove session
      state.sessions.delete(sessionId);

      console.log(`✅ Session ${sessionId} closed successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to close session ${sessionId}:`, error.message);
      return false;
    }
  };

  /**
   * Cleanup all sessions
   */
  const cleanup = async () => {
    console.log(`🧹 Cleaning up all distribution sessions...`);
    
    const sessionIds = Array.from(state.sessions.keys());
    const cleanupPromises = sessionIds.map(sessionId => closeSession(sessionId));
    
    await Promise.allSettled(cleanupPromises);
    
    console.log(`✅ All distribution sessions cleaned up`);
  };

  return {
    // Configuration management
    registerDistributorConfig,
    
    // Session lifecycle
    createSession,
    getSession,
    closeSession,
    listSessions,
    
    // Dynamic distributor control
    enableDistributor,
    disableDistributor,
    reconfigureDistributor,
    
    // Event routing
    updateEventRouting,
    
    // Distribution
    distribute,
    routeEvent,
    
    // Monitoring
    getSessionStatus,
    
    // Cleanup
    cleanup,
    
    // Utilities
    getAvailableDistributorTypes: () => Array.from(state.activeDistributorTypes),
    getGlobalConfig: () => ({ ...state.globalConfig })
  };
};

export default createDistributionSessionManager;