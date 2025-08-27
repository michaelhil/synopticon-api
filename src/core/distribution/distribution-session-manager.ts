/**
 * Distribution Session Manager
 * Provides dynamic distributor control and session-based configuration
 */

import { createDistributionManager, DistributionManager, DistributionResponse } from './distribution-manager.ts';
import { createLogger } from '../../shared/utils/logger.ts';
import { createHttpDistributor, HttpDistributor } from './distributors/http-distributor.ts';
import { createWebSocketDistributor, WebSocketDistributor } from './distributors/websocket-distributor.ts';
import { createMqttDistributor, MqttDistributor } from './distributors/mqtt-distributor-builtin.ts';
import { createUdpDistributor, UdpDistributor } from './distributors/udp-distributor.ts';
import { createSseDistributor, SseDistributor } from './distributors/sse-distributor.ts';
import { BaseDistributor, SendOptions } from './base-distributor.ts';

const logger = createLogger({ level: 2 });

// Type definitions for the session manager

export interface DistributorFactory {
  (config: any): BaseDistributor;
}

export interface DistributorData {
  instance: BaseDistributor;
  name: string;
  config: Record<string, any>;
}

export interface SessionConfig {
  enabledDistributors?: string[];
  distributors?: Record<string, any>;
  eventRouting?: Record<string, string[]>;
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
  [key: string]: any;
}

export interface Session {
  id: string;
  createdAt: number;
  config: SessionConfig;
  distributionManager: DistributionManager;
  activeDistributors: Map<string, DistributorData>;
  enabledTypes: Set<string>;
  eventRouting: Map<string, string[]>;
  status: 'initializing' | 'active' | 'closing' | 'closed';
}

export interface SessionStatus {
  sessionId: string;
  status: string;
  createdAt: number;
  uptime: number;
  activeDistributors: string[];
  eventRoutes: Array<[string, string[]]>;
  health: any;
  stats: any;
}

export interface SessionSummary {
  sessionId: string;
  status: string;
  createdAt: number;
  activeDistributors: string[];
  eventRoutes: number;
}

export interface DistributionSessionManager {
  // Configuration management
  registerDistributorConfig: (type: string, defaultConfig: any) => boolean;
  
  // Session lifecycle
  createSession: (sessionId: string, sessionConfig?: SessionConfig) => Promise<Session>;
  getSession: (sessionId: string) => Session | undefined;
  closeSession: (sessionId: string) => Promise<boolean>;
  listSessions: () => SessionSummary[];
  
  // Dynamic distributor control
  enableDistributor: (sessionId: string, type: string, config?: any) => Promise<BaseDistributor>;
  disableDistributor: (sessionId: string, type: string) => Promise<boolean>;
  reconfigureDistributor: (sessionId: string, type: string, newConfig: any) => Promise<BaseDistributor>;
  
  // Event routing
  updateEventRouting: (sessionId: string, eventRouting: Record<string, string[]>) => void;
  
  // Distribution
  distribute: (sessionId: string, event: string, data: any, options?: { targets?: string[]; } & SendOptions) => Promise<DistributionResponse>;
  routeEvent: (sessionId: string, event: string, data: any, options?: SendOptions) => Promise<DistributionResponse>;
  
  // Monitoring
  getSessionStatus: (sessionId: string) => Promise<SessionStatus>;
  
  // Cleanup
  cleanup: () => Promise<void>;
  
  // Utilities
  getAvailableDistributorTypes: () => string[];
  getGlobalConfig: () => SessionConfig;
}

/**
 * Distributor factory registry
 */
const DISTRIBUTOR_FACTORIES: Record<string, DistributorFactory> = {
  http: createHttpDistributor,
  websocket: createWebSocketDistributor,
  mqtt: createMqttDistributor,
  udp: createUdpDistributor,
  sse: createSseDistributor
};

/**
 * Create a distribution session manager for dynamic control
 */
export const createDistributionSessionManager = (globalConfig: SessionConfig = {}): DistributionSessionManager => {
  const state = {
    sessions: new Map<string, Session>(), // sessionId -> session data
    globalConfig: {
      enableHealthCheck: true,
      healthCheckInterval: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...globalConfig
    },
    activeDistributorTypes: new Set<string>(), // Track which types are available
    distributorConfigs: new Map<string, any>() // type -> default config
  };

  /**
   * Register a default configuration for a distributor type
   */
  const registerDistributorConfig = (type: string, defaultConfig: any): boolean => {
    if (!DISTRIBUTOR_FACTORIES[type]) {
      throw new Error(`Unknown distributor type: ${type}`);
    }
    
    state.distributorConfigs.set(type, defaultConfig);
    state.activeDistributorTypes.add(type);
    
    logger.info(`📋 Registered default config for ${type} distributor`);
    return true;
  };

  /**
   * Create a new distribution session
   */
  const createSession = async (sessionId: string, sessionConfig: SessionConfig = {}): Promise<Session> => {
    if (state.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    logger.info(`🆕 Creating distribution session: ${sessionId}`);

    const session: Session = {
      id: sessionId,
      createdAt: Date.now(),
      config: { ...state.globalConfig, ...sessionConfig },
      distributionManager: createDistributionManager({
        enableHealthCheck: sessionConfig.enableHealthCheck ?? state.globalConfig.enableHealthCheck,
        healthCheckInterval: sessionConfig.healthCheckInterval ?? state.globalConfig.healthCheckInterval,
        retryAttempts: sessionConfig.retryAttempts ?? state.globalConfig.retryAttempts,
        retryDelay: sessionConfig.retryDelay ?? state.globalConfig.retryDelay
      }),
      activeDistributors: new Map(), // name -> distributor instance
      enabledTypes: new Set(sessionConfig.enabledDistributors || []),
      eventRouting: new Map(),
      status: 'initializing'
    };

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

    logger.info(`✅ Session ${sessionId} created with ${session.activeDistributors.size} active distributors`);
    return session;
  };

  /**
   * Initialize distributors for a session
   */
  const initializeSessionDistributors = async (session: Session, distributorConfigs: Record<string, any>): Promise<void> => {
    const initPromises: Promise<any>[] = [];

    for (const [type, config] of Object.entries(distributorConfigs)) {
      if (!DISTRIBUTOR_FACTORIES[type]) {
        logger.warn(`⚠️ Unknown distributor type: ${type}, skipping`);
        continue;
      }

      // Skip if not in enabled types (if specified)
      if (session.enabledTypes.size > 0 && !session.enabledTypes.has(type)) {
        logger.info(`⏭️ Distributor ${type} not enabled for session ${session.id}, skipping`);
        continue;
      }

      initPromises.push(initializeDistributor(session, type, config));
    }

    const results = await Promise.allSettled(initPromises);
    
    // Log initialization results
    results.forEach((result, index) => {
      const type = Object.keys(distributorConfigs)[index];
      if (result.status === 'fulfilled') {
        logger.info(`✅ ${type} distributor initialized for session ${session.id}`);
      } else {
        const reason = result.reason;
        const errorMessage = reason instanceof Error ? reason.message : String(reason);
        logger.error(`❌ Failed to initialize ${type} distributor: ${errorMessage}`);
      }
    });
  };

  /**
   * Initialize a single distributor
   */
  const initializeDistributor = async (session: Session, type: string, config: any): Promise<BaseDistributor> => {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize ${type} distributor: ${errorMessage}`);
      throw error;
    }
  };

  /**
   * Get an active session
   */
  const getSession = (sessionId: string): Session | undefined => {
    return state.sessions.get(sessionId);
  };

  /**
   * Enable a distributor type for an existing session
   */
  const enableDistributor = async (sessionId: string, type: string, config: any = {}): Promise<BaseDistributor> => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.activeDistributors.has(type)) {
      logger.warn(`⚠️ Distributor ${type} already active in session ${sessionId}`);
      return session.activeDistributors.get(type)!.instance;
    }

    logger.info(`🔌 Enabling ${type} distributor for session ${sessionId}`);
    
    await initializeDistributor(session, type, config);
    session.enabledTypes.add(type);
    
    return session.activeDistributors.get(type)!.instance;
  };

  /**
   * Disable a distributor type for an existing session
   */
  const disableDistributor = async (sessionId: string, type: string): Promise<boolean> => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const distributorData = session.activeDistributors.get(type);
    if (!distributorData) {
      logger.warn(`⚠️ Distributor ${type} not active in session ${sessionId}`);
      return false;
    }

    logger.info(`🔌 Disabling ${type} distributor for session ${sessionId}`);

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to disable ${type} distributor: ${errorMessage}`);
      return false;
    }
  };

  /**
   * Reconfigure a distributor (disable + enable with new config)
   */
  const reconfigureDistributor = async (sessionId: string, type: string, newConfig: any): Promise<BaseDistributor> => {
    logger.info(`🔄 Reconfiguring ${type} distributor for session ${sessionId}`);
    
    await disableDistributor(sessionId, type);
    return enableDistributor(sessionId, type, newConfig);
  };

  /**
   * Update event routing for a session
   */
  const updateEventRouting = (sessionId: string, eventRouting: Record<string, string[]>): void => {
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
        logger.warn(`⚠️ No active distributors found for event ${event}`);
      }
    }

    logger.info(`📍 Updated event routing for session ${sessionId}: ${session.eventRouting.size} routes`);
  };

  /**
   * Distribute data through a session
   */
  const distribute = async (
    sessionId: string, 
    event: string, 
    data: any, 
    options: { targets?: string[]; } & SendOptions = {}
  ): Promise<DistributionResponse> => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.distributionManager.distribute(event, data, options.targets || ['all'], options);
  };

  /**
   * Route event through a session
   */
  const routeEvent = async (sessionId: string, event: string, data: any, options: SendOptions = {}): Promise<DistributionResponse> => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.distributionManager.routeEvent(event, data, options);
  };

  /**
   * Get session status and health
   */
  const getSessionStatus = async (sessionId: string): Promise<SessionStatus> => {
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
  const listSessions = (): SessionSummary[] => {
    return Array.from(state.sessions.keys()).map(sessionId => {
      const session = state.sessions.get(sessionId)!;
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
  const closeSession = async (sessionId: string): Promise<boolean> => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      logger.warn(`⚠️ Session ${sessionId} not found`);
      return false;
    }

    logger.info(`🗑️ Closing distribution session: ${sessionId}`);

    try {
      session.status = 'closing';

      // Cleanup all distributors
      for (const [type, distributorData] of session.activeDistributors) {
        try {
          if (distributorData.instance.cleanup) {
            await distributorData.instance.cleanup();
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error cleaning up ${type} distributor: ${errorMessage}`);
        }
      }

      // Cleanup distribution manager
      await session.distributionManager.cleanup();

      // Remove session
      session.status = 'closed';
      state.sessions.delete(sessionId);

      logger.info(`✅ Session ${sessionId} closed successfully`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to close session ${sessionId}: ${errorMessage}`);
      return false;
    }
  };

  /**
   * Cleanup all sessions
   */
  const cleanup = async (): Promise<void> => {
    logger.info(`🧹 Cleaning up all distribution sessions...`);
    
    const sessionIds = Array.from(state.sessions.keys());
    const cleanupPromises = sessionIds.map(sessionId => closeSession(sessionId));
    
    await Promise.allSettled(cleanupPromises);
    
    logger.info(`✅ All distribution sessions cleaned up`);
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
    getAvailableDistributorTypes: (): string[] => Array.from(state.activeDistributorTypes),
    getGlobalConfig: (): SessionConfig => ({ ...state.globalConfig })
  };
};

