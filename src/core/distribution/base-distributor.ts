/**
 * Base Distributor Interface
 * Common interface that all distribution mechanisms must implement
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

// Distributor capability flags enum
export enum DistributorCapabilities {
  SEND = 'send',
  RECEIVE = 'receive', 
  SUBSCRIBE = 'subscribe',
  BROADCAST = 'broadcast',
  REAL_TIME = 'real_time',
  HIGH_FREQUENCY = 'high_frequency',
  RELIABLE = 'reliable'
}

// Common distributor events enum
export enum DistributorEvents {
  // Currently no events are being used
  // Add events here as they become necessary
}

// Distributor health status type
export type DistributorHealthStatus = 'initializing' | 'connected' | 'disconnected' | 'error' | 'stopped';

// Distributor configuration interface
export interface DistributorConfig {
  name?: string;
  enabled?: boolean;
  [key: string]: any;
}

// Send options interface
export interface SendOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  broadcast?: boolean;
  metadata?: Record<string, any>;
  [key: string]: any;
}

// Distributor statistics interface
export interface DistributorStats {
  name: string;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  lastActivity: number | null;
  uptime: number;
}

// Distributor health interface
export interface DistributorHealth {
  name: string;
  status: DistributorHealthStatus;
  uptime: number;
  lastCheck: number;
  enabled: boolean;
  [key: string]: any;
}

// Internal state interface
interface DistributorState {
  name: string;
  enabled: boolean;
  stats: {
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    lastActivity: number | null;
    startTime: number;
  };
  health: {
    status: DistributorHealthStatus;
    lastCheck: number;
    uptime: number;
    [key: string]: any;
  };
}

// Event callback type
export type EventCallback = (data: any, metadata?: Record<string, any>) => void;

// Base distributor interface
export interface BaseDistributor {
  // Identity
  name: string;
  enabled: boolean;

  // Core methods (must be implemented)
  send: (event: string, data: any, options?: SendOptions) => Promise<any>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;

  // Optional methods
  subscribe: (pattern: string | RegExp, callback: EventCallback) => boolean;
  unsubscribe: (pattern: string | RegExp) => boolean;
  broadcast: (event: string, data: any, options?: SendOptions) => Promise<any>;

  // Health and monitoring
  getHealth: () => DistributorHealth;
  getStats: () => DistributorStats;

  // Configuration
  updateConfig: (newConfig: Partial<DistributorConfig>) => void;
  getConfig: () => DistributorConfig;

  // Lifecycle
  cleanup: () => Promise<void>;

  // Internal utilities (for implementations)
  _updateStats: (type: keyof DistributorState['stats'], increment?: number) => void;
  _updateHealth: (status: DistributorHealthStatus, details?: Record<string, any>) => void;
  _getState: () => DistributorState;
}

/**
 * Create a base distributor with common functionality
 */
export const createBaseDistributor = (config: DistributorConfig = {}): BaseDistributor => {
  const state: DistributorState = {
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
  const updateStats = (type: keyof DistributorState['stats'], increment: number = 1): void => {
    if (type === 'lastActivity') {
      state.stats[type] = Date.now();
    } else if (type === 'startTime') {
      state.stats[type] = increment;
    } else {
      (state.stats[type] as number) += increment;
    }
    state.stats.lastActivity = Date.now();
  };

  /**
   * Update health status
   */
  const updateHealth = (status: DistributorHealthStatus, details: Record<string, any> = {}): void => {
    state.health.status = status;
    state.health.lastCheck = Date.now();
    state.health.uptime = Date.now() - state.stats.startTime;
    state.health = { ...state.health, ...details };
  };

  /**
   * Base distributor interface - all distributors must implement these methods
   */
  const distributor: BaseDistributor = {
    // Distributor identity
    name: state.name,
    enabled: state.enabled,

    // Core interface methods (must be overridden by implementations)
    send: async (event: string, data: any, options: SendOptions = {}): Promise<any> => {
      throw new Error(`send() method not implemented for distributor: ${state.name}`);
    },

    connect: async (): Promise<boolean> => {
      throw new Error(`connect() method not implemented for distributor: ${state.name}`);
    },

    disconnect: async (): Promise<boolean> => {
      updateHealth('disconnected');
      return true;
    },

    // Optional interface methods (can be overridden)
    subscribe: (pattern: string | RegExp, callback: EventCallback): boolean => {
      logger.warn(`subscribe() not supported by distributor: ${state.name}`);
      return false;
    },

    unsubscribe: (pattern: string | RegExp): boolean => {
      logger.warn(`unsubscribe() not supported by distributor: ${state.name}`);
      return false;
    },

    broadcast: async (event: string, data: any, options: SendOptions = {}): Promise<any> => {
      // Default implementation delegates to send
      return await distributor.send(event, data, { ...options, broadcast: true });
    },

    // Health and monitoring
    getHealth: (): DistributorHealth => ({
      name: state.name,
      status: state.health.status,
      uptime: state.health.uptime,
      lastCheck: state.health.lastCheck,
      enabled: state.enabled,
      ...state.health
    }),

    getStats: (): DistributorStats => ({
      name: state.name,
      messagesSent: state.stats.messagesSent,
      messagesReceived: state.stats.messagesReceived,
      errors: state.stats.errors,
      lastActivity: state.stats.lastActivity,
      uptime: Date.now() - state.stats.startTime
    }),

    // Configuration
    updateConfig: (newConfig: Partial<DistributorConfig>): void => {
      Object.assign(config, newConfig);
      state.enabled = config.enabled !== false;
    },

    getConfig: (): DistributorConfig => ({ ...config }),

    // Cleanup
    cleanup: async (): Promise<void> => {
      await distributor.disconnect();
      updateHealth('stopped');
      logger.info(`Distributor ${state.name} cleaned up`);
    },

    // Internal utilities for implementations
    _updateStats: updateStats,
    _updateHealth: updateHealth,
    _getState: (): DistributorState => ({ ...state })
  };

  return distributor;
};
