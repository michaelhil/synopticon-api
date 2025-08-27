/**
 * Lifecycle Manager
 * Manages resource lifecycle, tracking, and automated cleanup
 */

import type { ResourcePool } from '../../performance/resource-pool.js';
import type { createMemoryManager } from './memory-manager.js';
import type { createCacheManager } from './cache-manager.js';

export interface LifecycleManagerConfig {
  enableAutoCleanup: boolean;
  cleanupInterval: number;
  maxResourceAge: number;
  enableResourceTracking: boolean;
}

export interface TrackedResource {
  id: string;
  resource: any;
  type: string;
  spec: any;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size?: number;
  cleanupCallbacks: Array<() => Promise<void>>;
  metadata: Record<string, any>;
}

export interface LifecycleStats {
  trackedResources: number;
  cleanupsPending: number;
  averageResourceAge: number;
  totalCleanups: number;
  totalResourcesCreated: number;
}

/**
 * Creates lifecycle manager
 */
export const createLifecycleManager = (
  config: LifecycleManagerConfig,
  dependencies: {
    memory?: ReturnType<typeof createMemoryManager>;
    cache?: ReturnType<typeof createCacheManager>;
  } = {}
) => {
  const state = {
    trackedResources: new Map<any, TrackedResource>(),
    resourcesByType: new Map<string, Set<any>>(),
    cleanupQueue: [] as TrackedResource[],
    cleanupTimer: null as NodeJS.Timeout | null,
    resourceCounter: 0,
    
    managers: {
      memory: dependencies.memory || null,
      cache: dependencies.cache || null,
      resourcePool: null as ResourcePool | null
    },
    
    metrics: {
      totalCleanups: 0,
      totalResourcesCreated: 0,
      cleanupsByType: new Map<string, number>(),
      averageCleanupTime: 0
    }
  };

  // Set manager references
  const setManagers = (managers: {
    memory?: ReturnType<typeof createMemoryManager>;
    cache?: ReturnType<typeof createCacheManager>;
    resourcePool?: ResourcePool;
  }): void => {
    Object.assign(state.managers, managers);
  };

  // Generate unique resource ID
  const generateResourceId = (type: string): string => {
    return `${type}_${Date.now()}_${++state.resourceCounter}`;
  };

  // Track a resource
  const trackResource = (
    resource: any,
    type: string,
    spec: any,
    options: {
      size?: number;
      metadata?: Record<string, any>;
      cleanupCallback?: () => Promise<void>;
    } = {}
  ): string => {
    if (!config.enableResourceTracking) {
      return '';
    }

    const id = generateResourceId(type);
    const now = Date.now();

    const tracked: TrackedResource = {
      id,
      resource,
      type,
      spec,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      size: options.size,
      cleanupCallbacks: options.cleanupCallback ? [options.cleanupCallback] : [],
      metadata: options.metadata || {}
    };

    // Store tracking info
    state.trackedResources.set(resource, tracked);

    // Update type index
    if (!state.resourcesByType.has(type)) {
      state.resourcesByType.set(type, new Set());
    }
    state.resourcesByType.get(type)!.add(resource);

    state.metrics.totalResourcesCreated++;

    return id;
  };

  // Update resource access
  const accessResource = (resource: any): void => {
    const tracked = state.trackedResources.get(resource);
    if (tracked) {
      tracked.lastAccessed = Date.now();
      tracked.accessCount++;
    }
  };

  // Add cleanup callback to resource
  const addCleanupCallback = (resource: any, callback: () => Promise<void>): void => {
    const tracked = state.trackedResources.get(resource);
    if (tracked) {
      tracked.cleanupCallbacks.push(callback);
    }
  };

  // Remove cleanup callback
  const removeCleanupCallback = (resource: any, callback: () => Promise<void>): void => {
    const tracked = state.trackedResources.get(resource);
    if (tracked) {
      const index = tracked.cleanupCallbacks.indexOf(callback);
      if (index > -1) {
        tracked.cleanupCallbacks.splice(index, 1);
      }
    }
  };

  // Untrack a resource
  const untrackResource = (resource: any): boolean => {
    const tracked = state.trackedResources.get(resource);
    if (!tracked) return false;

    // Remove from main tracking
    state.trackedResources.delete(resource);

    // Remove from type index
    const typeSet = state.resourcesByType.get(tracked.type);
    if (typeSet) {
      typeSet.delete(resource);
      if (typeSet.size === 0) {
        state.resourcesByType.delete(tracked.type);
      }
    }

    // Remove from cleanup queue if present
    const queueIndex = state.cleanupQueue.findIndex(r => r.resource === resource);
    if (queueIndex > -1) {
      state.cleanupQueue.splice(queueIndex, 1);
    }

    return true;
  };

  // Get resource info
  const getResourceInfo = (resource: any): TrackedResource | null => {
    return state.trackedResources.get(resource) || null;
  };

  // Find resources ready for cleanup
  const findResourcesForCleanup = (): TrackedResource[] => {
    const now = Date.now();
    const candidates: TrackedResource[] = [];

    for (const tracked of state.trackedResources.values()) {
      const age = now - tracked.createdAt;
      const timeSinceAccess = now - tracked.lastAccessed;

      // Check if resource is old enough for cleanup
      if (age > config.maxResourceAge || timeSinceAccess > config.maxResourceAge / 2) {
        candidates.push(tracked);
      }
    }

    // Sort by age (oldest first)
    candidates.sort((a, b) => a.createdAt - b.createdAt);

    return candidates;
  };

  // Perform resource cleanup
  const cleanupResource = async (tracked: TrackedResource): Promise<boolean> => {
    const startTime = Date.now();

    try {
      // Execute cleanup callbacks
      for (const callback of tracked.cleanupCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.warn(`Cleanup callback failed for resource ${tracked.id}:`, error);
        }
      }

      // Type-specific cleanup
      switch (tracked.type) {
        case 'canvas':
          if (state.managers.resourcePool) {
            state.managers.resourcePool.returnCanvas(tracked.resource);
          }
          break;
        case 'webgl':
          if (state.managers.resourcePool) {
            state.managers.resourcePool.returnWebGLContext(tracked.resource);
          }
          break;
        case 'buffer':
          if (state.managers.resourcePool) {
            if (tracked.resource instanceof Uint8Array) {
              state.managers.resourcePool.returnImageBuffer(tracked.resource);
            } else {
              state.managers.resourcePool.returnTypedArray(tracked.resource);
            }
          }
          break;
        case 'memory':
          if (state.managers.memory) {
            await state.managers.memory.deallocate(tracked.resource);
          }
          break;
        case 'cache':
          if (state.managers.cache) {
            await state.managers.cache.deallocate(tracked.resource);
          }
          break;
      }

      // Remove from tracking
      untrackResource(tracked.resource);

      // Update metrics
      state.metrics.totalCleanups++;
      const cleanupCount = state.metrics.cleanupsByType.get(tracked.type) || 0;
      state.metrics.cleanupsByType.set(tracked.type, cleanupCount + 1);

      const cleanupTime = Date.now() - startTime;
      state.metrics.averageCleanupTime = 
        (state.metrics.averageCleanupTime * (state.metrics.totalCleanups - 1) + cleanupTime) / state.metrics.totalCleanups;

      return true;

    } catch (error) {
      console.error(`Failed to cleanup resource ${tracked.id}:`, error);
      return false;
    }
  };

  // Perform batch cleanup
  const performCleanup = async (maxCleanups: number = 10): Promise<number> => {
    const candidates = findResourcesForCleanup();
    const toCleanup = candidates.slice(0, maxCleanups);
    
    let cleanedCount = 0;
    
    for (const tracked of toCleanup) {
      const success = await cleanupResource(tracked);
      if (success) {
        cleanedCount++;
      }
    }

    return cleanedCount;
  };

  // Perform full cleanup of all tracked resources
  const performFullCleanup = async (): Promise<void> => {
    const allResources = Array.from(state.trackedResources.values());
    
    for (const tracked of allResources) {
      await cleanupResource(tracked);
    }

    // Clear any remaining state
    state.trackedResources.clear();
    state.resourcesByType.clear();
    state.cleanupQueue.length = 0;
  };

  // Auto-cleanup timer function
  const performAutoCleanup = async (): Promise<void> => {
    try {
      const cleaned = await performCleanup();
      if (cleaned > 0) {
        console.log(`Auto-cleanup processed ${cleaned} resources`);
      }
    } catch (error) {
      console.error('Auto-cleanup error:', error);
    }
  };

  // Start automatic cleanup
  const startAutoCleanup = (): void => {
    if (!config.enableAutoCleanup || state.cleanupTimer) {
      return;
    }

    state.cleanupTimer = setInterval(performAutoCleanup, config.cleanupInterval);
  };

  // Stop automatic cleanup
  const stopAutoCleanup = (): void => {
    if (state.cleanupTimer) {
      clearInterval(state.cleanupTimer);
      state.cleanupTimer = null;
    }
  };

  // Get resources by type
  const getResourcesByType = (type: string): any[] => {
    const typeSet = state.resourcesByType.get(type);
    return typeSet ? Array.from(typeSet) : [];
  };

  // Get all tracked resources
  const getAllTrackedResources = (): TrackedResource[] => {
    return Array.from(state.trackedResources.values());
  };

  // Get lifecycle statistics
  const getStats = (): LifecycleStats => {
    const now = Date.now();
    let totalAge = 0;
    let resourceCount = 0;

    for (const tracked of state.trackedResources.values()) {
      totalAge += (now - tracked.createdAt);
      resourceCount++;
    }

    const averageResourceAge = resourceCount > 0 ? totalAge / resourceCount : 0;
    const cleanupsPending = findResourcesForCleanup().length;

    return {
      trackedResources: state.trackedResources.size,
      cleanupsPending,
      averageResourceAge,
      totalCleanups: state.metrics.totalCleanups,
      totalResourcesCreated: state.metrics.totalResourcesCreated
    };
  };

  // Get detailed resource report
  const getResourceReport = () => ({
    byType: Object.fromEntries(
      Array.from(state.resourcesByType.entries()).map(([type, resources]) => [
        type,
        {
          count: resources.size,
          totalSize: Array.from(resources).reduce((sum, resource) => {
            const tracked = state.trackedResources.get(resource);
            return sum + (tracked?.size || 0);
          }, 0)
        }
      ])
    ),
    oldestResources: Array.from(state.trackedResources.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        type: r.type,
        age: Date.now() - r.createdAt,
        accessCount: r.accessCount
      })),
    mostAccessedResources: Array.from(state.trackedResources.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        type: r.type,
        accessCount: r.accessCount,
        age: Date.now() - r.createdAt
      }))
  });

  // Export lifecycle data
  const exportData = () => ({
    resources: Array.from(state.trackedResources.values()).map(r => ({
      ...r,
      resource: undefined, // Don't serialize the actual resource
      cleanupCallbacks: [] // Don't serialize callbacks
    })),
    metrics: { ...state.metrics },
    config: { ...config }
  });

  // Import lifecycle data
  const importData = (data: any): void => {
    if (data.resources) {
      // Note: Can't fully restore resources since the actual resource objects aren't serialized
      // This would mainly be used for metrics/config restoration
    }

    if (data.metrics) {
      Object.assign(state.metrics, data.metrics);
    }
  };

  return {
    setManagers,
    trackResource,
    untrackResource,
    accessResource,
    addCleanupCallback,
    removeCleanupCallback,
    getResourceInfo,
    getResourcesByType,
    getAllTrackedResources,
    performCleanup,
    performFullCleanup,
    startAutoCleanup,
    stopAutoCleanup,
    getStats,
    getResourceReport,
    exportData,
    importData
  };
};