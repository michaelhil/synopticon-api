/**
 * Memory Manager
 * Centralized memory allocation, deallocation, and optimization
 */

import type { ResourcePool } from '../../performance/resource-pool.js'

export interface MemoryManagerConfig {
  maxMemoryUsage: number;
  gcThreshold: number;
  enableMemoryPressureHandling: boolean;
  enableLeakDetection: boolean;
}

export interface MemoryStats {
  used: number;
  available: number;
  pressure: number;
  gcPressure: number;
  allocations: number;
  deallocations: number;
  leaks: number;
}

export interface MemoryAllocation {
  id: string;
  size: number;
  timestamp: number;
  type: string;
  stackTrace?: string;
}

/**
 * Creates memory manager
 */
export const createMemoryManager = (config: MemoryManagerConfig) => {
  const state = {
    allocations: new Map<any, MemoryAllocation>(),
    totalAllocated: 0,
    allocationCounter: 0,
    deallocations: 0,
    resourcePool: null as ResourcePool | null,
    
    metrics: {
      peakMemoryUsage: 0,
      gcEvents: 0,
      memoryPressureEvents: 0,
      leakDetections: 0,
      optimizationRuns: 0
    }
  };

  // Set resource pool reference
  const setResourcePool = (pool: ResourcePool): void => {
    state.resourcePool = pool;
  };

  // Get current memory usage (approximation)
  const getCurrentMemoryUsage = (): number => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return state.totalAllocated; // Fallback to tracked allocations
  };

  // Calculate memory pressure
  const calculateMemoryPressure = (): number => {
    const used = getCurrentMemoryUsage();
    const pressure = used / config.maxMemoryUsage;
    return Math.min(1, Math.max(0, pressure));
  };

  // Check for memory leaks
  const detectLeaks = (): MemoryAllocation[] => {
    if (!config.enableLeakDetection) return [];
    
    const now = Date.now();
    const leakThreshold = 300000; // 5 minutes
    const leaks: MemoryAllocation[] = [];
    
    for (const allocation of state.allocations.values()) {
      if (now - allocation.timestamp > leakThreshold) {
        leaks.push(allocation);
      }
    }
    
    if (leaks.length > 0) {
      state.metrics.leakDetections++;
    }
    
    return leaks;
  };

  // Force garbage collection
  const forceGC = async (): Promise<void> => {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
      state.metrics.gcEvents++;
    } else if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
      state.metrics.gcEvents++;
    }
    
    // Small delay to allow GC to complete
    await new Promise(resolve => setTimeout(resolve, 10));
  };

  // Handle memory pressure
  const handleMemoryPressure = async (): Promise<void> => {
    if (!config.enableMemoryPressureHandling) return;
    
    state.metrics.memoryPressureEvents++;
    
    // Force garbage collection
    await forceGC();
    
    // Clear resource pool if available
    if (state.resourcePool) {
      state.resourcePool.performGarbageCollection();
    }
    
    // Clear old allocations (potential memory leaks)
    const leaks = detectLeaks();
    for (const leak of leaks.slice(0, 10)) { // Clear first 10 leaks
      state.allocations.delete(leak);
    }
  };

  // Allocate memory resource
  const allocate = async <T>(size: number, options: any = {}): Promise<T> => {
    // Check memory pressure before allocation
    const pressure = calculateMemoryPressure();
    
    if (pressure > config.gcThreshold) {
      await handleMemoryPressure();
    }
    
    if (pressure > 0.95) {
      throw new Error('Memory pressure too high - allocation denied');
    }
    
    // Create allocation based on type
    let resource: any;
    const allocationType = options.type || 'generic';
    
    switch (allocationType) {
    case 'buffer':
      resource = new ArrayBuffer(size);
      break;
    case 'uint8array':
      resource = new Uint8Array(size);
      break;
    case 'float32array':
      resource = new Float32Array(size / 4);
      break;
    case 'object':
      resource = {};
      break;
    default:
      resource = { size, type: allocationType };
      break;
    }
    
    // Track allocation
    const allocation: MemoryAllocation = {
      id: `mem_${++state.allocationCounter}`,
      size,
      timestamp: Date.now(),
      type: allocationType,
      stackTrace: config.enableLeakDetection ? new Error().stack : undefined
    };
    
    state.allocations.set(resource, allocation);
    state.totalAllocated += size;
    
    // Update peak usage
    const currentUsage = getCurrentMemoryUsage();
    if (currentUsage > state.metrics.peakMemoryUsage) {
      state.metrics.peakMemoryUsage = currentUsage;
    }
    
    return resource as T;
  };

  // Deallocate memory resource
  const deallocate = async (resource: any): Promise<void> => {
    const allocation = state.allocations.get(resource);
    
    if (allocation) {
      state.allocations.delete(resource);
      state.totalAllocated -= allocation.size;
      state.deallocations++;
    }
    
    // Clear resource references
    if (resource && typeof resource === 'object') {
      if (resource.constructor === Object) {
        // Clear object properties
        for (const key in resource) {
          delete resource[key];
        }
      }
    }
  };

  // Optimize memory usage
  const optimize = async (): Promise<void> => {
    state.metrics.optimizationRuns++;
    
    // Detect and report leaks
    const leaks = detectLeaks();
    if (leaks.length > 0) {
      console.warn(`Detected ${leaks.length} potential memory leaks`);
    }
    
    // Force garbage collection
    await forceGC();
    
    // Clean up tracked allocations that might be GC'd
    const initialSize = state.allocations.size;
    const keysToDelete = [];
    
    for (const [resource, allocation] of state.allocations) {
      // Check if resource is still referenced (simplified check)
      if (!resource || (typeof resource === 'object' && Object.keys(resource).length === 0)) {
        keysToDelete.push(resource);
      }
    }
    
    keysToDelete.forEach(key => state.allocations.delete(key));
    
    const cleaned = initialSize - state.allocations.size;
    if (cleaned > 0) {
      console.log(`Memory optimization cleaned up ${cleaned} unreferenced allocations`);
    }
  };

  // Get memory statistics
  const getStats = (): MemoryStats => {
    const currentUsage = getCurrentMemoryUsage();
    const pressure = calculateMemoryPressure();
    
    return {
      used: currentUsage,
      available: config.maxMemoryUsage - currentUsage,
      pressure,
      gcPressure: pressure > config.gcThreshold ? 1 : 0,
      allocations: state.allocationCounter,
      deallocations: state.deallocations,
      leaks: detectLeaks().length
    };
  };

  // Get detailed allocation info
  const getAllocationInfo = (): MemoryAllocation[] => {
    return Array.from(state.allocations.values());
  };

  // Monitor memory usage
  const startMemoryMonitoring = (interval: number = 5000): NodeJS.Timeout => {
    return setInterval(async () => {
      const pressure = calculateMemoryPressure();
      
      if (pressure > config.gcThreshold) {
        await handleMemoryPressure();
      }
      
      // Log memory status periodically
      if (pressure > 0.8) {
        const stats = getStats();
        console.warn('High memory usage:', {
          used: `${(stats.used / 1024 / 1024).toFixed(2)}MB`,
          pressure: `${(pressure * 100).toFixed(1)}%`,
          allocations: state.allocations.size
        });
      }
    }, interval);
  };

  // Cleanup all resources
  const cleanup = async (): Promise<void> => {
    // Deallocate all tracked resources
    const allocations = Array.from(state.allocations.keys());
    for (const resource of allocations) {
      await deallocate(resource);
    }
    
    // Force final garbage collection
    await forceGC();
    
    // Reset state
    state.totalAllocated = 0;
    state.allocationCounter = 0;
    state.deallocations = 0;
  };

  return {
    setResourcePool,
    allocate,
    deallocate,
    optimize,
    forceGC,
    getStats,
    getAllocationInfo,
    detectLeaks,
    startMemoryMonitoring,
    cleanup
  };
};
