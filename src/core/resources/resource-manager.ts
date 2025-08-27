/**
 * Centralized Resource Management Architecture
 * Unified system for managing all resources across the application
 */

import { createResourcePool, type ResourcePool } from '../performance/resource-pool.js';
import { createMemoryManager } from './managers/memory-manager.js';
import { createCacheManager } from './managers/cache-manager.js';
import { createLifecycleManager } from './managers/lifecycle-manager.js';
import { createResourceMetrics } from './metrics/resource-metrics.js';
import { createResourceRegistry } from './registry/resource-registry.js';

export interface ResourceManagerConfig {
  // Resource Pool Configuration
  resourcePool?: {
    maxCanvasInstances?: number;
    maxWebGLContexts?: number;
    maxBufferSize?: number;
    enableGarbageCollection?: boolean;
  };
  
  // Memory Management
  memory?: {
    maxMemoryUsage?: number;
    gcThreshold?: number;
    enableMemoryPressureHandling?: boolean;
    enableLeakDetection?: boolean;
  };
  
  // Caching System
  cache?: {
    maxCacheSize?: number;
    defaultTtl?: number;
    enableLRU?: boolean;
    enableCompression?: boolean;
  };
  
  // Lifecycle Management
  lifecycle?: {
    enableAutoCleanup?: boolean;
    cleanupInterval?: number;
    maxResourceAge?: number;
    enableResourceTracking?: boolean;
  };
  
  // Metrics and Monitoring
  metrics?: {
    enableMetrics?: boolean;
    metricsInterval?: number;
    enablePerformanceTracking?: boolean;
    enableResourceProfiling?: boolean;
  };
  
  // Registry Configuration
  registry?: {
    enableRegistry?: boolean;
    maxRegistrySize?: number;
    enableResourceSharing?: boolean;
  };
}

export interface ResourceManager {
  // Resource Pool Access
  readonly resourcePool: ResourcePool;
  
  // Memory Management
  readonly memory: ReturnType<typeof createMemoryManager>;
  
  // Cache Management
  readonly cache: ReturnType<typeof createCacheManager>;
  
  // Lifecycle Management
  readonly lifecycle: ReturnType<typeof createLifecycleManager>;
  
  // Registry Access
  readonly registry: ReturnType<typeof createResourceRegistry>;
  
  // Metrics Access
  readonly metrics: ReturnType<typeof createResourceMetrics>;
  
  // High-level resource operations
  allocateResource: <T>(type: string, spec: any) => Promise<T>;
  deallocateResource: (resource: any) => Promise<void>;
  optimizeResources: () => Promise<void>;
  
  // System-wide operations
  getSystemStatus: () => ResourceSystemStatus;
  performFullCleanup: () => Promise<void>;
  exportResourceState: () => any;
  importResourceState: (state: any) => Promise<void>;
}

export interface ResourceSystemStatus {
  memory: {
    used: number;
    available: number;
    pressure: number;
    gcPressure: number;
  };
  cache: {
    entries: number;
    hitRate: number;
    memoryUsage: number;
    compressionRatio: number;
  };
  resourcePool: {
    canvas: { active: number; available: number; };
    webgl: { active: number; available: number; };
    buffers: { active: number; totalSize: number; };
  };
  lifecycle: {
    trackedResources: number;
    cleanupsPending: number;
    averageResourceAge: number;
  };
  registry: {
    registeredTypes: number;
    sharedResources: number;
    totalAllocations: number;
  };
  overall: {
    healthy: boolean;
    performanceScore: number;
    recommendedActions: string[];
  };
}

/**
 * Creates centralized resource manager
 */
export const createResourceManager = (config: ResourceManagerConfig = {}): ResourceManager => {
  const managerConfig = {
    resourcePool: {
      maxCanvasInstances: 20,
      maxWebGLContexts: 5,
      maxBufferSize: 100 * 1024 * 1024, // 100MB
      enableGarbageCollection: true,
      ...config.resourcePool
    },
    memory: {
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      gcThreshold: 0.8,
      enableMemoryPressureHandling: true,
      enableLeakDetection: true,
      ...config.memory
    },
    cache: {
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      defaultTtl: 300000, // 5 minutes
      enableLRU: true,
      enableCompression: true,
      ...config.cache
    },
    lifecycle: {
      enableAutoCleanup: true,
      cleanupInterval: 30000, // 30 seconds
      maxResourceAge: 600000, // 10 minutes
      enableResourceTracking: true,
      ...config.lifecycle
    },
    metrics: {
      enableMetrics: true,
      metricsInterval: 5000, // 5 seconds
      enablePerformanceTracking: true,
      enableResourceProfiling: false,
      ...config.metrics
    },
    registry: {
      enableRegistry: true,
      maxRegistrySize: 10000,
      enableResourceSharing: true,
      ...config.registry
    }
  };

  // Initialize core managers
  const resourcePool = createResourcePool(managerConfig.resourcePool);
  const memory = createMemoryManager(managerConfig.memory);
  const cache = createCacheManager(managerConfig.cache);
  const lifecycle = createLifecycleManager(managerConfig.lifecycle, { memory, cache });
  const registry = createResourceRegistry(managerConfig.registry);
  const metrics = createResourceMetrics(managerConfig.metrics, {
    resourcePool,
    memory,
    cache,
    lifecycle,
    registry
  });

  // Cross-manager integration
  memory.setResourcePool(resourcePool);
  cache.setMemoryManager(memory);
  lifecycle.setManagers({ memory, cache, resourcePool });

  // High-level resource allocation
  const allocateResource = async <T>(type: string, spec: any): Promise<T> => {
    // Check if resource can be shared from registry
    if (managerConfig.registry.enableResourceSharing) {
      const shared = await registry.getSharedResource<T>(type, spec);
      if (shared) {
        lifecycle.trackResource(shared, type, spec);
        return shared;
      }
    }

    // Allocate new resource based on type
    let resource: T;

    switch (type) {
      case 'canvas':
        resource = resourcePool.getCanvas(spec.width, spec.height) as T;
        break;
      case 'webgl':
        resource = resourcePool.getWebGLContext(spec.type, spec.attributes) as T;
        break;
      case 'buffer':
        if (spec.imageBuffer) {
          resource = resourcePool.getImageBuffer(spec.width, spec.height, spec.channels) as T;
        } else {
          resource = resourcePool.getTypedArray(spec.type, spec.size) as T;
        }
        break;
      case 'memory':
        resource = await memory.allocate<T>(spec.size, spec.options);
        break;
      case 'cache':
        resource = await cache.allocate<T>(spec.key, spec.value, spec.options) as T;
        break;
      default:
        throw new Error(`Unknown resource type: ${type}`);
    }

    // Register and track the resource
    registry.register(type, resource, spec);
    lifecycle.trackResource(resource, type, spec);

    return resource;
  };

  // High-level resource deallocation
  const deallocateResource = async (resource: any): Promise<void> => {
    // Determine resource type and deallocate appropriately
    const resourceInfo = lifecycle.getResourceInfo(resource);
    
    if (!resourceInfo) {
      console.warn('Attempting to deallocate untracked resource');
      return;
    }

    switch (resourceInfo.type) {
      case 'canvas':
        resourcePool.returnCanvas(resource);
        break;
      case 'webgl':
        resourcePool.returnWebGLContext(resource);
        break;
      case 'buffer':
        if (resource instanceof Uint8Array) {
          resourcePool.returnImageBuffer(resource);
        } else {
          resourcePool.returnTypedArray(resource);
        }
        break;
      case 'memory':
        await memory.deallocate(resource);
        break;
      case 'cache':
        await cache.deallocate(resource);
        break;
    }

    // Unregister and stop tracking
    registry.unregister(resource);
    lifecycle.untrackResource(resource);
  };

  // System-wide resource optimization
  const optimizeResources = async (): Promise<void> => {
    // Memory optimization
    await memory.optimize();
    
    // Cache optimization
    await cache.optimize();
    
    // Resource pool optimization
    resourcePool.performGarbageCollection();
    
    // Lifecycle cleanup
    await lifecycle.performCleanup();
    
    // Registry cleanup
    await registry.cleanup();
    
    // Update metrics after optimization
    await metrics.recordOptimization();
  };

  // Get comprehensive system status
  const getSystemStatus = (): ResourceSystemStatus => {
    const memoryStats = memory.getStats();
    const cacheStats = cache.getStats();
    const poolStats = resourcePool.getMetrics();
    const lifecycleStats = lifecycle.getStats();
    const registryStats = registry.getStats();

    // Calculate overall health score
    const memoryHealth = 1 - memoryStats.pressure;
    const cacheHealth = Math.min(1, cacheStats.hitRate);
    const poolHealth = poolStats.utilization < 0.9 ? 1 : 0.5;
    const lifecycleHealth = lifecycleStats.cleanupsPending < 100 ? 1 : 0.7;
    
    const performanceScore = (memoryHealth + cacheHealth + poolHealth + lifecycleHealth) / 4;
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (memoryStats.pressure > 0.8) recommendations.push('High memory pressure - consider cleanup');
    if (cacheStats.hitRate < 0.5) recommendations.push('Low cache hit rate - review caching strategy');
    if (poolStats.utilization > 0.9) recommendations.push('Resource pool near capacity - increase limits');
    if (lifecycleStats.cleanupsPending > 50) recommendations.push('Many pending cleanups - increase cleanup frequency');

    return {
      memory: {
        used: memoryStats.used,
        available: memoryStats.available,
        pressure: memoryStats.pressure,
        gcPressure: memoryStats.gcPressure
      },
      cache: {
        entries: cacheStats.entries,
        hitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage,
        compressionRatio: cacheStats.compressionRatio
      },
      resourcePool: {
        canvas: { 
          active: poolStats.canvas?.active || 0, 
          available: poolStats.canvas?.available || 0 
        },
        webgl: { 
          active: poolStats.webgl?.active || 0, 
          available: poolStats.webgl?.available || 0 
        },
        buffers: { 
          active: poolStats.buffers?.active || 0, 
          totalSize: poolStats.buffers?.totalSize || 0 
        }
      },
      lifecycle: {
        trackedResources: lifecycleStats.trackedResources,
        cleanupsPending: lifecycleStats.cleanupsPending,
        averageResourceAge: lifecycleStats.averageResourceAge
      },
      registry: {
        registeredTypes: registryStats.registeredTypes,
        sharedResources: registryStats.sharedResources,
        totalAllocations: registryStats.totalAllocations
      },
      overall: {
        healthy: performanceScore > 0.7,
        performanceScore,
        recommendedActions: recommendations
      }
    };
  };

  // Full system cleanup
  const performFullCleanup = async (): Promise<void> => {
    await lifecycle.performFullCleanup();
    await cache.clear();
    await memory.forceGC();
    resourcePool.cleanup();
    registry.clear();
    
    // Reinitialize if needed
    if (managerConfig.lifecycle.enableAutoCleanup) {
      lifecycle.startAutoCleanup();
    }
  };

  // Export system state
  const exportResourceState = () => ({
    timestamp: Date.now(),
    config: managerConfig,
    status: getSystemStatus(),
    metrics: metrics.getComprehensiveMetrics(),
    registryData: registry.exportData(),
    lifecycleData: lifecycle.exportData()
  });

  // Import system state
  const importResourceState = async (state: any): Promise<void> => {
    if (state.registryData) {
      await registry.importData(state.registryData);
    }
    
    if (state.lifecycleData) {
      await lifecycle.importData(state.lifecycleData);
    }
    
    // Update metrics with imported state
    metrics.recordStateImport(state);
  };

  // Start background services
  if (managerConfig.lifecycle.enableAutoCleanup) {
    lifecycle.startAutoCleanup();
  }
  
  if (managerConfig.metrics.enableMetrics) {
    metrics.startMetricsCollection();
  }

  return {
    // Core managers
    resourcePool,
    memory,
    cache,
    lifecycle,
    registry,
    metrics,
    
    // High-level operations
    allocateResource,
    deallocateResource,
    optimizeResources,
    
    // System operations
    getSystemStatus,
    performFullCleanup,
    exportResourceState,
    importResourceState
  };
};

// Global resource manager instance
let globalResourceManager: ResourceManager | null = null;

/**
 * Gets the global resource manager instance
 */
export const getGlobalResourceManager = (): ResourceManager => {
  if (!globalResourceManager) {
    globalResourceManager = createResourceManager();
  }
  return globalResourceManager;
};

/**
 * Sets a custom global resource manager
 */
export const setGlobalResourceManager = (manager: ResourceManager): void => {
  if (globalResourceManager) {
    globalResourceManager.performFullCleanup();
  }
  globalResourceManager = manager;
};

// Export for convenience
