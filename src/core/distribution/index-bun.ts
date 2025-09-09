/**
 * Universal Distribution System - Bun Native Entry Point
 * Phase 2: Bun-optimized universal distributor system
 * Zero external dependencies for optimal performance
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

// Universal distributor system (Bun-native)
export {
  createUniversalDistributor,
  type UniversalDistributor,
  type UniversalDistributorConfig
} from './universal-distributor.js';

// Bun-optimized distributor factory
export {
  createDistributorWithAdapters,
  createWebDistributor,
  createIoTDistributor,
  createRealtimeDistributor
} from './universal-distributor-factory.js';

// All adapters are Bun-native
export {
  createHttpAdapter,
  createWebSocketAdapter,
  createMqttAdapter,
  createSSEAdapter,
  createUdpAdapter
} from './adapters/index.js';

export { createDistributionManager } from './distribution-manager.js';
export { createDistributionConfigManager } from './distribution-config-manager.js';

// Configuration presets (will need to be converted separately if exists)
// export { 
//   getDistributionPresets, 
//   getDistributionPreset, 
//   getAvailablePresets,
//   validatePreset 
// } from './configs/distribution-presets.js';

// Distributor factory interface
interface DistributorFactory {
  (): Promise<any>;
}

// Session configuration interface
interface SessionConfig {
  distributors?: Record<string, any>;
  eventRouting?: Record<string, string[]>;
  [key: string]: any;
}

// Session stats interface
interface SessionStats {
  messagesDistributed: number;
  distributionErrors: number;
  lastDistributionTime: number | null;
}

// Session interface
interface Session {
  id: string;
  status: 'initializing' | 'active' | 'ended';
  createdAt: number;
  config: any;
  distributors: Map<string, any>;
  activeDistributors: Set<string>;
  eventRouting: Map<string, string[]>;
  stats: SessionStats;
}

// Session status interface
interface SessionStatus {
  id: string;
  status: string;
  createdAt: number;
  distributorCount: number;
  activeDistributors: string[];
  stats: SessionStats;
  eventRouting: Record<string, string[]>;
}

/**
 * Universal distributor adapter registry
 * Phase 2: All adapters are Bun-native with zero dependencies
 */
export const UNIVERSAL_ADAPTER_FACTORIES: Record<string, DistributorFactory> = {
  http: () => import('./adapters/http-adapter.js').then(m => m.createHttpAdapter),
  websocket: () => import('./adapters/websocket-adapter.js').then(m => m.createWebSocketAdapter),
  mqtt: () => import('./adapters/mqtt-adapter.js').then(m => m.createMqttAdapter),
  sse: () => import('./adapters/sse-adapter.js').then(m => m.createSSEAdapter),
  udp: () => import('./adapters/udp-adapter.js').then(m => m.createUdpAdapter)
};

/**
 * Create Bun-native distribution session manager
 */
export const createBunDistributionSessionManager = (config: any = {}) => {
  const state = {
    sessions: new Map<string, Session>(),
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
  const createSession = async (sessionId: string, sessionConfig: SessionConfig): Promise<Session> => {
    if (state.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const session: Session = {
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
        console.log(`📍 Set routing for ${event} -> [${distributors.join(', ')]`);
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
  const initializeBunDistributors = async (session: Session, distributorConfigs: Record<string, any>): Promise<void> => {
    const initPromises = [];

    for (const [type, config] of Object.entries(distributorConfigs)) {
      if (!UNIVERSAL_ADAPTER_FACTORIES[type]) {
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
  const initializeBunDistributor = async (session: Session, type: string, config: any): Promise<any> => {
    try {
      // Get the factory function
      const factory = await UNIVERSAL_ADAPTER_FACTORIES[type]();
      
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to initialize ${type} distributor:`, errorMessage);
      session.stats.distributionErrors++;
      throw error;
    }
  };

  /**
   * Distribute data to all active distributors in a session
   */
  const distribute = async (sessionId: string, data: any): Promise<boolean> => {
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
          distributor.distribute(data).catch((error: Error) => {
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
  const endSession = async (sessionId: string): Promise<void> => {
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
  const getSessionStatus = (sessionId: string): SessionStatus | null => {
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
    getActiveSessions: (): string[] => Array.from(state.sessions.keys()),
    getAllSessions: (): (SessionStatus | null)[] => Array.from(state.sessions.values()).map(s => getSessionStatus(s.id))
  };
};

/**
 * Quick setup factory for common distribution patterns with Bun native
 * Phase 2: Uses universal distributor with full Bun optimization
 */
export const createQuickBunDistribution = (pattern: string = 'basic') => {
  const { createDistributorWithAdapters } = require('./universal-distributor-factory.js');
  
  switch (pattern) {
    case 'web':
      return createWebDistributor({
        maxConcurrency: 10, // Higher concurrency for Bun
        defaultTimeout: 30000,
        adapters: {
          http: { timeout: 30000 },
          websocket: { maxConnections: 200 }, // Higher limits for Bun
          sse: { maxConnections: 200 }
        }
      });
    case 'iot':
      return createIoTDistributor({
        maxConcurrency: 20, // Bun handles higher concurrency better
        defaultTimeout: 5000,
        adapters: {
          mqtt: { keepAlive: 60 },
          udp: { broadcast: true, bufferSize: 65536 },
          http: { timeout: 5000 }
        }
      });
    case 'realtime':
      return createRealtimeDistributor({
        maxConcurrency: 50, // Maximize Bun's performance
        defaultTimeout: 1000,
        adapters: {
          websocket: { heartbeatInterval: 5000, maxConnections: 500 },
          sse: { heartbeatInterval: 5000, maxConnections: 500 },
          udp: { bufferSize: 65536 }
        }
      });
    default:
      return createDistributorWithAdapters({
        maxConcurrency: 10,
        defaultTimeout: 30000,
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 100,
          backoffMultiplier: 2
        }
      });
  }
};
