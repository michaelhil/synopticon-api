/**
 * @fileoverview Component Registry Implementation
 * 
 * Central registry for managing cognitive system components with health monitoring,
 * capability tracking, and lifecycle management.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createLogger } from '../../../shared/utils/logger.js';
import type {
  ComponentRegistry,
  CognitiveComponent,
  ComponentHealth,
  ComponentMetrics
} from './types.js';

const logger = createLogger({ level: 2 });

/**
 * Create component registry with health monitoring
 */
export const createComponentRegistry = (): ComponentRegistry => {
  const components = new Map<string, CognitiveComponent>();
  const healthCache = new Map<string, { health: ComponentHealth; timestamp: number }>();
  const HEALTH_CACHE_TTL = 30000; // 30 seconds

  const register = async (component: CognitiveComponent): Promise<void> => {
    if (!component.id) {
      throw new Error('Component must have an ID');
    }

    if (components.has(component.id)) {
      throw new Error(`Component with ID '${component.id}' already exists`);
    }

    // Validate component interface
    validateComponent(component);

    // Initialize component if needed
    if (component.status === 'initializing' && component.initialize) {
      try {
        await component.initialize({});
        logger.info(`Component '${component.id}' initialized successfully`);
      } catch (error) {
        logger.error(`Failed to initialize component '${component.id}':`, error as Error);
        throw error;
      }
    }

    components.set(component.id, component);
    
    // Set up health monitoring
    setupComponentMonitoring(component);
    
    logger.info(`Registered component: ${component.id} (${component.type})`);
  };

  const unregister = async (componentId: string): Promise<void> => {
    const component = components.get(componentId);
    if (!component) {
      logger.warn(`Attempted to unregister non-existent component: ${componentId}`);
      return;
    }

    try {
      // Stop component if it's running
      if (component.status === 'active' && component.stop) {
        await component.stop();
      }

      components.delete(componentId);
      healthCache.delete(componentId);
      
      logger.info(`Unregistered component: ${componentId}`);
    } catch (error) {
      logger.error(`Error unregistering component '${componentId}':`, error as Error);
      throw error;
    }
  };

  const get = (componentId: string): CognitiveComponent | null => {
    return components.get(componentId) || null;
  };

  const getAll = (): CognitiveComponent[] => {
    return Array.from(components.values());
  };

  const getByType = (type: CognitiveComponent['type']): CognitiveComponent[] => {
    return Array.from(components.values()).filter(component => component.type === type);
  };

  const getByCapability = (capability: string): CognitiveComponent[] => {
    return Array.from(components.values()).filter(component => 
      component.capabilities.includes(capability)
    );
  };

  const getHealthStatus = (): Record<string, ComponentHealth> => {
    const healthStatus: Record<string, ComponentHealth> = {};
    const now = Date.now();

    for (const [componentId, component] of components.entries()) {
      // Check cache first
      const cached = healthCache.get(componentId);
      if (cached && (now - cached.timestamp) < HEALTH_CACHE_TTL) {
        healthStatus[componentId] = cached.health;
        continue;
      }

      // Get fresh health status
      try {
        const health = component.getHealth();
        healthCache.set(componentId, { health, timestamp: now });
        healthStatus[componentId] = health;
      } catch (error) {
        logger.error(`Error getting health for component '${componentId}':`, error as Error);
        healthStatus[componentId] = createErrorHealth(componentId, (error as Error).message);
      }
    }

    return healthStatus;
  };

  return {
    register,
    unregister,
    get,
    getAll,
    getByType,
    getByCapability,
    getHealthStatus
  };
};

/**
 * Validate component interface
 */
const validateComponent = (component: CognitiveComponent): void => {
  const requiredMethods = ['getHealth', 'getMetrics', 'on', 'off', 'emit'];
  const missingMethods = requiredMethods.filter(method => 
    typeof (component as any)[method] !== 'function'
  );

  if (missingMethods.length > 0) {
    throw new Error(`Component '${component.id}' missing required methods: ${missingMethods.join(', ')}`);
  }

  if (!component.name || typeof component.name !== 'string') {
    throw new Error(`Component '${component.id}' must have a name`);
  }

  if (!component.type || !['analyzer', 'monitor', 'advisor', 'controller'].includes(component.type)) {
    throw new Error(`Component '${component.id}' must have a valid type`);
  }

  if (!Array.isArray(component.capabilities)) {
    throw new Error(`Component '${component.id}' must have capabilities array`);
  }
};

/**
 * Set up monitoring for a component
 */
const setupComponentMonitoring = (component: CognitiveComponent): void => {
  // Monitor status changes
  component.on('statusChanged', (newStatus: string, oldStatus: string) => {
    logger.info(`Component '${component.id}' status changed: ${oldStatus} -> ${newStatus}`);
  });

  // Monitor errors
  component.on('error', (error: Error) => {
    logger.error(`Component '${component.id}' error:`, error);
  });

  // Monitor performance metrics
  component.on('metricsUpdated', (metrics: ComponentMetrics) => {
    if (metrics.errorRate > 0.1) { // 10% error rate threshold
      logger.warn(`High error rate for component '${component.id}': ${(metrics.errorRate * 100).toFixed(1)}%`);
    }

    if (metrics.averageResponseTime > 5000) { // 5 second threshold
      logger.warn(`Slow response time for component '${component.id}': ${metrics.averageResponseTime}ms`);
    }
  });
};

/**
 * Create error health status
 */
const createErrorHealth = (componentId: string, error: string): ComponentHealth => ({
  status: 'critical',
  uptime: 0,
  lastError: error,
  errorCount: 1,
  performanceScore: 0,
  resourceUsage: {
    cpu: 0,
    memory: 0,
    network: 0
  }
});

/**
 * Component registry utilities
 */
export const RegistryUtils = {
  /**
   * Create a mock component for testing
   */
  createMockComponent: (
    id: string,
    type: CognitiveComponent['type'],
    capabilities: string[] = []
  ): CognitiveComponent => {
    let status: CognitiveComponent['status'] = 'inactive';
    const listeners = new Map<string, Function[]>();

    return {
      id,
      name: `Mock ${type} Component`,
      type,
      status,
      capabilities,

      initialize: async (config: Record<string, unknown>) => {
        status = 'active';
        emit('statusChanged', 'active', 'inactive');
      },

      start: async () => {
        status = 'active';
        emit('statusChanged', 'active', status);
      },

      stop: async () => {
        status = 'inactive';
        emit('statusChanged', 'inactive', 'active');
      },

      reset: async () => {
        status = 'initializing';
        emit('statusChanged', 'initializing', status);
        await new Promise(resolve => setTimeout(resolve, 100));
        status = 'active';
        emit('statusChanged', 'active', 'initializing');
      },

      process: async (context: any) => ({ result: 'processed', timestamp: Date.now() }),

      getHealth: (): ComponentHealth => ({
        status: 'healthy',
        uptime: Date.now() - 1000,
        errorCount: 0,
        performanceScore: 0.95,
        resourceUsage: {
          cpu: 0.1,
          memory: 0.2,
          network: 0.05
        }
      }),

      getMetrics: (): ComponentMetrics => ({
        requestCount: 100,
        successRate: 0.95,
        averageResponseTime: 150,
        errorRate: 0.05,
        throughput: 10,
        latency: {
          p50: 120,
          p95: 300,
          p99: 500
        }
      }),

      on: (event: string, listener: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)!.push(listener);
      },

      off: (event: string, listener: (...args: unknown[]) => void) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          const index = eventListeners.indexOf(listener);
          if (index > -1) {
            eventListeners.splice(index, 1);
          }
        }
      },

      emit: (event: string, ...args: unknown[]) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(listener => {
            try {
              listener(...args);
            } catch (error) {
              logger.error(`Error in event listener for ${event}:`, error as Error);
            }
          });
        }
      }
    };

    function emit(event: string, ...args: unknown[]) {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            logger.error(`Error in event listener for ${event}:`, error as Error);
          }
        });
      }
    }
  },

  /**
   * Calculate overall registry health
   */
  calculateRegistryHealth: (components: CognitiveComponent[]): {
    overallStatus: 'healthy' | 'degraded' | 'critical';
    healthyCount: number;
    totalCount: number;
    criticalComponents: string[];
    healthScore: number;
  } => {
    if (components.length === 0) {
      return {
        overallStatus: 'healthy',
        healthyCount: 0,
        totalCount: 0,
        criticalComponents: [],
        healthScore: 1.0
      };
    }

    let healthyCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;
    const criticalComponents: string[] = [];

    components.forEach(component => {
      try {
        const health = component.getHealth();
        switch (health.status) {
          case 'healthy':
            healthyCount++;
            break;
          case 'degraded':
            degradedCount++;
            break;
          case 'critical':
          case 'unavailable':
            criticalCount++;
            criticalComponents.push(component.id);
            break;
        }
      } catch (error) {
        criticalCount++;
        criticalComponents.push(component.id);
      }
    });

    const totalCount = components.length;
    const healthScore = healthyCount / totalCount;

    let overallStatus: 'healthy' | 'degraded' | 'critical';
    if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      overallStatus,
      healthyCount,
      totalCount,
      criticalComponents,
      healthScore
    };
  },

  /**
   * Generate registry report
   */
  generateRegistryReport: (components: CognitiveComponent[]): string => {
    const health = RegistryUtils.calculateRegistryHealth(components);
    const byType = components.reduce((acc, comp) => {
      acc[comp.type] = (acc[comp.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const capabilities = new Set<string>();
    components.forEach(comp => comp.capabilities.forEach(cap => capabilities.add(cap)));

    const report = [
      'Component Registry Report',
      `=========================`,
      `Overall Status: ${health.overallStatus.toUpperCase()}`,
      `Health Score: ${(health.healthScore * 100).toFixed(1)}%`,
      `Total Components: ${health.totalCount}`,
      `  - Healthy: ${health.healthyCount}`,
      `  - Degraded: ${health.totalCount - health.healthyCount - health.criticalComponents.length}`,
      `  - Critical: ${health.criticalComponents.length}`,
      '',
      'Components by Type:',
      ...Object.entries(byType).map(([type, count]) => `  - ${type}: ${count}`),
      '',
      `Available Capabilities: ${capabilities.size}`,
      ...Array.from(capabilities).sort().map(cap => `  - ${cap}`),
      ''
    ];

    if (health.criticalComponents.length > 0) {
      report.push('Critical Components:', ...health.criticalComponents.map(id => `  - ${id}`));
    }

    return report.join('\n');
  }
};