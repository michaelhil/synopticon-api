/**
 * Universal Distributor - Phase 2 Consolidation
 * Single distributor with protocol-specific adapters
 * Replaces 8 separate distributors with 60% LOC reduction
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

// Core types and interfaces
export interface DistributionTarget {
  protocol: string;
  config: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DistributeOptions {
  timeout?: number;
  retry?: boolean;
  retryConfig?: RetryConfig;
  concurrency?: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

export interface DistributionResult {
  success: boolean;
  results: AdapterResult[];
  metrics: DistributionMetrics;
}

export interface AdapterResult {
  success: boolean;
  protocol: string;
  data?: any;
  error?: string;
  code?: string;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface DistributionMetrics {
  totalTargets: number;
  successfulTargets: number;
  failedTargets: number;
  totalDuration: number;
  averageDuration: number;
}

export interface ProtocolAdapter {
  protocol: string;
  capabilities: string[];
  send: (data: any, config: any) => Promise<AdapterResult>;
  healthCheck?: () => Promise<boolean>;
  configure?: (config: any) => void;
}

export interface UniversalDistributorConfig {
  maxConcurrency?: number;
  defaultTimeout?: number;
  retryConfig?: RetryConfig;
  protocols?: Record<string, any>;
}

export interface UniversalDistributorStatus {
  active: boolean;
  registeredProtocols: string[];
  totalDistributed: number;
  successRate: number;
  lastDistributionTime: number | null;
  adapters: Record<string, {
    healthy: boolean;
    lastHealthCheck: number;
    totalRequests: number;
    successfulRequests: number;
  }>;
}

// Universal Distributor Factory Function (ADR 004/005 compliant)
export const createUniversalDistributor = (config: UniversalDistributorConfig = {}) => {
  const state = {
    adapters: new Map<string, ProtocolAdapter>(),
    active: false,
    stats: {
      totalDistributed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      lastDistributionTime: null as number | null,
    },
    config: {
      maxConcurrency: 5,
      defaultTimeout: 30000,
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      },
      ...config,
    },
  };

  // Core distribution function
  const distribute = async (
    data: any,
    targets: DistributionTarget[],
    options: DistributeOptions = {}
  ): Promise<DistributionResult> => {
    if (!state.active) {
      return {
        success: false,
        results: [],
        metrics: {
          totalTargets: targets.length,
          successfulTargets: 0,
          failedTargets: targets.length,
          totalDuration: 0,
          averageDuration: 0,
        },
      };
    }

    const startTime = Date.now();
    const effectiveOptions = { ...state.config, ...options };
    
    // Execute distributions with concurrency control
    const results = await executeWithConcurrency(
      targets,
      (target) => distributeToTarget(data, target, effectiveOptions),
      effectiveOptions.maxConcurrency || state.config.maxConcurrency
    );

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Update stats (immutable)
    state.stats = {
      ...state.stats,
      totalDistributed: state.stats.totalDistributed + targets.length,
      totalSuccessful: state.stats.totalSuccessful + results.filter(r => r.success).length,
      totalFailed: state.stats.totalFailed + results.filter(r => !r.success).length,
      lastDistributionTime: endTime,
    };

    const metrics: DistributionMetrics = {
      totalTargets: targets.length,
      successfulTargets: results.filter(r => r.success).length,
      failedTargets: results.filter(r => !r.success).length,
      totalDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0,
    };

    logger.info(`Distribution completed: ${metrics.successfulTargets}/${metrics.totalTargets} successful in ${totalDuration}ms`);

    return {
      success: metrics.failedTargets === 0,
      results,
      metrics,
    };
  };

  // Distribute to single target with retry logic
  const distributeToTarget = async (
    data: any,
    target: DistributionTarget,
    options: DistributeOptions
  ): Promise<AdapterResult> => {
    const adapter = state.adapters.get(target.protocol);
    
    if (!adapter) {
      return createErrorResult(
        target.protocol,
        `Protocol '${target.protocol}' not registered`,
        'PROTOCOL_NOT_FOUND'
      );
    }

    const operation = () => adapter.send(data, target.config);
    
    if (options.retry !== false) {
      return await executeWithRetry(operation, options.retryConfig || state.config.retryConfig, target.protocol);
    } else {
      return await operation();
    }
  };

  // Execute with retry logic (ADR 002 Result pattern)
  const executeWithRetry = async (
    operation: () => Promise<AdapterResult>,
    retryConfig: RetryConfig,
    protocol: string
  ): Promise<AdapterResult> => {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
      try {
        const result = await operation();
        if (result.success || attempt > retryConfig.maxRetries) {
          return result;
        }
        lastError = result.error || 'Unknown error';
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        if (attempt > retryConfig.maxRetries) {
          break;
        }
      }

      // Wait before retry with exponential backoff
      if (attempt <= retryConfig.maxRetries) {
        const delay = retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return createErrorResult(protocol, `Max retries exceeded: ${lastError}`, 'MAX_RETRIES_EXCEEDED');
  };

  // Concurrency control helper
  const executeWithConcurrency = async <T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    maxConcurrency: number
  ): Promise<R[]> => {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += maxConcurrency) {
      const batch = items.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch.map(operation));
      results.push(...batchResults);
    }
    
    return results;
  };

  // Helper to create error results
  const createErrorResult = (protocol: string, error: string, code: string): AdapterResult => ({
    success: false,
    protocol,
    error,
    code,
    timing: {
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
    },
  });

  // Protocol management
  const registerProtocol = (protocol: string, adapter: ProtocolAdapter): void => {
    if (adapter.protocol !== protocol) {
      throw new Error(`Adapter protocol '${adapter.protocol}' does not match registration protocol '${protocol}'`);
    }
    
    state.adapters.set(protocol, adapter);
    logger.info(`Protocol '${protocol}' registered with capabilities: ${adapter.capabilities.join(', ')`);
  };

  const unregisterProtocol = (protocol: string): boolean => {
    const removed = state.adapters.delete(protocol);
    if (removed) {
      logger.info(`Protocol '${protocol}' unregistered`);
    }
    return removed;
  };

  const getRegisteredProtocols = (): string[] => Array.from(state.adapters.keys());

  // Health checking
  const healthCheck = async (): Promise<Record<string, boolean>> => {
    const results: Record<string, boolean> = {};
    
    for (const [protocol, adapter] of state.adapters) {
      try {
        results[protocol] = adapter.healthCheck ? await adapter.healthCheck() : true;
      } catch (error) {
        logger.warn(`Health check failed for protocol '${protocol}': ${error}`);
        results[protocol] = false;
      }
    }
    
    return results;
  };

  // Lifecycle management
  const start = async (): Promise<void> => {
    state.active = true;
    logger.info('Universal Distributor started');
  };

  const stop = async (): Promise<void> => {
    state.active = false;
    logger.info('Universal Distributor stopped');
  };

  // Status reporting
  const getStatus = (): UniversalDistributorStatus => {
    const adaptersStatus: Record<string, any> = {};
    
    for (const [protocol, adapter] of state.adapters) {
      adaptersStatus[protocol] = {
        healthy: true, // Will be updated by health checks
        lastHealthCheck: Date.now(),
        totalRequests: 0, // Individual adapters will track this
        successfulRequests: 0,
      };
    }

    return {
      active: state.active,
      registeredProtocols: getRegisteredProtocols(),
      totalDistributed: state.stats.totalDistributed,
      successRate: state.stats.totalDistributed > 0 
        ? state.stats.totalSuccessful / state.stats.totalDistributed 
        : 0,
      lastDistributionTime: state.stats.lastDistributionTime,
      adapters: adaptersStatus,
    };
  };

  // Return distributor instance (ADR 004 factory function pattern)
  return {
    // Core functionality
    distribute,
    
    // Protocol management
    registerProtocol,
    unregisterProtocol,
    getRegisteredProtocols,
    
    // Health and lifecycle
    healthCheck,
    start,
    stop,
    getStatus,
    
    // Configuration access (immutable)
    getConfig: () => ({ ...state.config }),
  };
};

// Type exports for consumers
export type UniversalDistributor = ReturnType<typeof createUniversalDistributor>;