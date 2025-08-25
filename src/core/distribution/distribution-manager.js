/**
 * Distribution Manager
 * Central coordinator for all distribution mechanisms
 */

import { DistributorEvents } from './base-distributor.js';

/**
 * Create a distribution manager to coordinate multiple distributors
 * @param {Object} config - Manager configuration
 * @returns {Object} Distribution manager instance
 */
export const createDistributionManager = (config = {}) => {
  const state = {
    distributors: new Map(),
    eventRoutes: new Map(),
    stats: {
      totalMessages: 0,
      totalErrors: 0,
      startTime: Date.now()
    },
    config: {
      enableHealthCheck: true,
      healthCheckInterval: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    }
  };

  let healthCheckInterval = null;

  /**
   * Register a distributor with the manager
   */
  const registerDistributor = (name, distributor) => {
    if (!distributor || typeof distributor !== 'object') {
      throw new Error(`Invalid distributor provided for: ${name}`);
    }

    if (!distributor.send || typeof distributor.send !== 'function') {
      throw new Error(`Distributor ${name} must implement send() method`);
    }

    state.distributors.set(name, distributor);
    console.log(`📡 Registered distributor: ${name}`);
    
    // Initialize distributor if it has a connect method
    if (distributor.connect && typeof distributor.connect === 'function') {
      distributor.connect().catch(error => {
        console.error(`Failed to connect distributor ${name}:`, error);
      });
    }
  };

  /**
   * Unregister a distributor
   */
  const unregisterDistributor = (name) => {
    const distributor = state.distributors.get(name);
    if (distributor) {
      if (distributor.cleanup) {
        distributor.cleanup().catch(console.error);
      }
      state.distributors.delete(name);
      console.log(`📡 Unregistered distributor: ${name}`);
      return true;
    }
    return false;
  };

  /**
   * Send data through specific distributors or all
   */
  const distribute = async (event, data, targets = ['all'], options = {}) => {
    const results = [];
    const distributorsToUse = new Map();

    // Determine which distributors to use
    if (targets.includes('all')) {
      for (const [name, distributor] of state.distributors) {
        if (distributor.enabled !== false) {
          distributorsToUse.set(name, distributor);
        }
      }
    } else {
      for (const target of targets) {
        const distributor = state.distributors.get(target);
        if (distributor && distributor.enabled !== false) {
          distributorsToUse.set(target, distributor);
        } else if (distributor && distributor.enabled === false) {
          console.warn(`Distributor ${target} is disabled`);
        } else {
          console.warn(`Unknown distributor: ${target}`);
        }
      }
    }

    // Send through each distributor
    const sendPromises = Array.from(distributorsToUse.entries()).map(async ([name, distributor]) => {
      const startTime = Date.now();
      
      try {
        const result = await retryOperation(
          () => distributor.send(event, data, options[name] || {}),
          state.config.retryAttempts,
          state.config.retryDelay
        );
        
        const duration = Date.now() - startTime;
        state.stats.totalMessages++;
        
        return {
          distributor: name,
          status: 'success',
          result,
          duration
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        state.stats.totalErrors++;
        
        console.error(`Distribution failed for ${name}:`, error.message);
        
        return {
          distributor: name,
          status: 'error',
          error: error.message,
          duration
        };
      }
    });

    const distributionResults = await Promise.allSettled(sendPromises);
    
    // Process results
    distributionResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          distributor: 'unknown',
          status: 'error',
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    return {
      event,
      timestamp: Date.now(),
      results,
      summary: {
        total: distributorsToUse.size,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    };
  };

  /**
   * Broadcast to all available distributors that support broadcasting
   */
  const broadcast = async (event, data, options = {}) => {
    const broadcastCapable = [];
    
    for (const [name, distributor] of state.distributors) {
      if (distributor.enabled !== false && distributor.broadcast) {
        broadcastCapable.push(name);
      }
    }
    
    if (broadcastCapable.length === 0) {
      console.warn('No distributors available for broadcasting');
      return distribute(event, data, ['all'], options);
    }
    
    return distribute(event, data, broadcastCapable, options);
  };

  /**
   * Set up event routing rules
   */
  const setEventRouting = (event, distributors, options = {}) => {
    state.eventRoutes.set(event, { distributors, options });
    console.log(`📍 Set routing for ${event} -> [${distributors.join(', ')}]`);
  };

  /**
   * Distribute based on pre-configured routing
   */
  const routeEvent = async (event, data, overrideOptions = {}) => {
    const route = state.eventRoutes.get(event);
    
    if (!route) {
      console.warn(`No routing configured for event: ${event}`);
      return distribute(event, data, ['all'], overrideOptions);
    }
    
    const options = { ...route.options, ...overrideOptions };
    return distribute(event, data, route.distributors, options);
  };

  /**
   * Health check for all distributors
   */
  const performHealthCheck = async () => {
    const healthResults = [];
    
    for (const [name, distributor] of state.distributors) {
      try {
        const health = distributor.getHealth ? distributor.getHealth() : { 
          name, 
          status: 'unknown' 
        };
        healthResults.push(health);
      } catch (error) {
        healthResults.push({
          name,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      timestamp: Date.now(),
      distributors: healthResults,
      summary: {
        total: healthResults.length,
        healthy: healthResults.filter(h => h.status === 'healthy').length,
        unhealthy: healthResults.filter(h => h.status !== 'healthy').length
      }
    };
  };

  /**
   * Start periodic health checking
   */
  const startHealthCheck = () => {
    if (!state.config.enableHealthCheck || healthCheckInterval) {
      return;
    }
    
    healthCheckInterval = setInterval(async () => {
      const health = await performHealthCheck();
      if (health.summary.unhealthy > 0) {
        console.warn(`⚠️ ${health.summary.unhealthy}/${health.summary.total} distributors unhealthy`);
      }
    }, state.config.healthCheckInterval);
    
    console.log('❤️ Started distributor health monitoring');
  };

  /**
   * Stop health checking
   */
  const stopHealthCheck = () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
      console.log('❤️ Stopped distributor health monitoring');
    }
  };

  /**
   * Get comprehensive statistics
   */
  const getStats = () => ({
    distributors: {
      total: state.distributors.size,
      registered: Array.from(state.distributors.keys())
    },
    eventRoutes: {
      total: state.eventRoutes.size,
      routes: Array.from(state.eventRoutes.entries()).map(([event, route]) => ({
        event,
        distributors: route.distributors
      }))
    },
    performance: {
      totalMessages: state.stats.totalMessages,
      totalErrors: state.stats.totalErrors,
      successRate: state.stats.totalMessages > 0 ? 
        ((state.stats.totalMessages - state.stats.totalErrors) / state.stats.totalMessages * 100).toFixed(1) + '%' : '0%',
      uptime: Date.now() - state.stats.startTime
    }
  });

  /**
   * Cleanup all distributors
   */
  const cleanup = async () => {
    console.log('🧹 Cleaning up distribution manager...');
    
    stopHealthCheck();
    
    const cleanupPromises = Array.from(state.distributors.values()).map(distributor => {
      return distributor.cleanup ? distributor.cleanup() : Promise.resolve();
    });
    
    await Promise.allSettled(cleanupPromises);
    
    state.distributors.clear();
    state.eventRoutes.clear();
    
    console.log('✅ Distribution manager cleanup complete');
  };

  // Helper function for retry logic
  const retryOperation = async (operation, maxAttempts, delay) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw lastError;
  };

  // Start health monitoring if enabled
  if (state.config.enableHealthCheck) {
    startHealthCheck();
  }

  return {
    // Distributor management
    registerDistributor,
    unregisterDistributor,
    getDistributors: () => Array.from(state.distributors.keys()),
    
    // Distribution methods
    distribute,
    broadcast,
    
    // Event routing
    setEventRouting,
    routeEvent,
    
    // Health and monitoring
    performHealthCheck,
    startHealthCheck,
    stopHealthCheck,
    getStats,
    
    // Configuration
    updateConfig: (updates) => {
      Object.assign(state.config, updates);
    },
    getConfig: () => ({ ...state.config }),
    
    // Cleanup
    cleanup
  };
};

export default createDistributionManager;