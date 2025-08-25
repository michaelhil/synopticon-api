/**
 * Multi-Distribution System - Bun Native Entry Point
 * Modular distribution architecture using Bun native APIs
 * Zero external dependencies for optimal performance
 */

// Core distribution components (these should already be Bun-compatible)
export { createDistributionManager } from './distribution-manager.js';
export { createDistributionConfigManager } from './distribution-config-manager.js';
export { createBaseDistributor } from './base-distributor.js';

// Bun-native protocol-specific distributors
export { createHttpDistributor } from './distributors/http-distributor-bun.js';
export { createWebSocketDistributor } from './distributors/websocket-distributor-bun.js';

// Legacy distributors (still Node.js based - use with caution)
export { createMqttDistributor } from './distributors/mqtt-distributor.js';
export { createUdpDistributor } from './distributors/udp-distributor.js';

// Configuration presets
export { 
  getDistributionPresets, 
  getDistributionPreset, 
  getAvailablePresets,
  validatePreset 
} from './configs/distribution-presets.js';

/**
 * Bun-native distributor factory registry
 */
export const BUN_DISTRIBUTOR_FACTORIES = {
  http: () => import('./distributors/http-distributor-bun.js').then(m => m.createHttpDistributor),
  websocket: () => import('./distributors/websocket-distributor-bun.js').then(m => m.createWebSocketDistributor),
  // Legacy Node.js distributors (fallback)
  mqtt: () => import('./distributors/mqtt-distributor.js').then(m => m.createMqttDistributor),
  udp: () => import('./distributors/udp-distributor.js').then(m => m.createUdpDistributor),
};

/**
 * Create Bun-native distribution session manager
 */
export const createBunDistributionSessionManager = (config = {}) => {
  const state = {
    sessions: new Map(),
    globalConfig: {
      enableHealthCheck: true,
      healthCheckInterval: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    },
    distributorConfigs: new Map(),
    activeDistributorTypes: new Set(['http', 'websocket'])
  };

  /**
   * Create a new distribution session with Bun-native distributors
   */
  const createSession = async (sessionId, sessionConfig) => {
    if (state.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const session = {
      id: sessionId,
      status: 'initializing',
      createdAt: Date.now(),
      config: { ...state.globalConfig, ...sessionConfig },
      distributors: new Map(),
      activeDistributors: new Set(),
      eventRouting: new Map(),
      stats: {
        messagesDistributed: 0,
        distributionErrors: 0,
        lastDistributionTime: null
      }
    };

    console.log(`🆕 Creating distribution session: ${sessionId}`);

    // Initialize Bun-native distributors
    await initializeBunDistributors(session, sessionConfig.distributors || {});

    // Set up event routing
    if (sessionConfig.eventRouting) {
      for (const [event, distributors] of Object.entries(sessionConfig.eventRouting)) {
        session.eventRouting.set(event, distributors);
        console.log(`📍 Set routing for ${event} -> [${distributors.join(', ')}]`);
      }
    }

    session.status = 'active';
    state.sessions.set(sessionId, session);

    console.log(`✅ Session ${sessionId} created with ${session.activeDistributors.size} active distributors`);
    return session;
  };

  /**
   * Initialize Bun-native distributors for a session
   */
  const initializeBunDistributors = async (session, distributorConfigs) => {
    const initPromises = [];

    for (const [type, config] of Object.entries(distributorConfigs)) {
      if (!BUN_DISTRIBUTOR_FACTORIES[type]) {
        console.warn(`⚠️ Unknown Bun distributor type: ${type}, skipping`);
        continue;
      }

      initPromises.push(initializeBunDistributor(session, type, config));
    }

    await Promise.allSettled(initPromises);
  };

  /**
   * Initialize a single Bun-native distributor
   */
  const initializeBunDistributor = async (session, type, config) => {
    try {
      // Get the factory function
      const factory = await BUN_DISTRIBUTOR_FACTORIES[type]();
      
      // Create distributor instance with Bun-native implementation
      const distributorId = `${type}_${session.id}`;
      const distributor = factory({
        ...config,
        id: distributorId
      });

      // Initialize the distributor
      await distributor.initialize();

      // Store in session
      session.distributors.set(distributorId, distributor);
      session.activeDistributors.add(distributorId);

      console.log(`📡 Registered distributor: ${distributorId}`);
      console.log(`✅ ${type} distributor initialized for session ${session.id}`);
      
      return distributor;
    } catch (error) {
      console.error(`❌ Failed to initialize ${type} distributor:`, error.message);
      session.stats.distributionErrors++;
      throw error;
    }
  };

  /**
   * Distribute data to all active distributors in a session
   */
  const distribute = async (sessionId, data) => {
    const session = state.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error(`Session ${sessionId} not found or not active`);
    }

    const distributionPromises = [];
    const routingKey = data.type || data.source || 'default';
    
    // Get distributors for this routing key
    const targetDistributors = session.eventRouting.get(routingKey) || 
                              Array.from(session.activeDistributors);

    for (const distributorId of targetDistributors) {
      const distributor = session.distributors.get(distributorId);
      if (distributor && distributor.isHealthy()) {
        distributionPromises.push(
          distributor.distribute(data).catch(error => {
            console.error(`Distribution error for ${distributorId}:`, error);
            session.stats.distributionErrors++;
            return false;
          })
        );
      }
    }

    const results = await Promise.allSettled(distributionPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    session.stats.messagesDistributed++;
    session.stats.lastDistributionTime = Date.now();

    return successCount > 0;
  };

  /**
   * End a distribution session and cleanup all distributors
   */
  const endSession = async (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`🧹 Ending session: ${sessionId}`);

    // Cleanup all distributors
    const cleanupPromises = [];
    for (const distributor of session.distributors.values()) {
      if (distributor.cleanup) {
        cleanupPromises.push(distributor.cleanup());
      }
    }

    await Promise.allSettled(cleanupPromises);
    
    session.status = 'ended';
    state.sessions.delete(sessionId);

    console.log(`✅ Session ${sessionId} ended and cleaned up`);
  };

  /**
   * Get session status
   */
  const getSessionStatus = (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      distributorCount: session.distributors.size,
      activeDistributors: Array.from(session.activeDistributors),
      stats: { ...session.stats },
      eventRouting: Object.fromEntries(session.eventRouting)
    };
  };

  return {
    createSession,
    endSession,
    distribute,
    getSessionStatus,
    getActiveSessions: () => Array.from(state.sessions.keys()),
    getAllSessions: () => Array.from(state.sessions.values()).map(s => getSessionStatus(s.id))
  };
};

/**
 * Quick setup factory for common distribution patterns with Bun native
 */
export const createQuickBunDistribution = (pattern = 'basic') => {
  const config = getDistributionPreset(pattern);
  
  if (!config) {
    const available = getAvailablePresets();
    throw new Error(`Unknown distribution pattern: ${pattern}. Available: ${available.join(', ')}`);
  }
  
  // Use Bun-native session manager
  return createBunDistributionSessionManager(config);
};