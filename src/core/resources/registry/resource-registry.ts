/**
 * Resource Registry
 * Central registry for resource sharing, type management, and allocation tracking
 */

export interface ResourceRegistryConfig {
  enableRegistry: boolean;
  maxRegistrySize: number;
  enableResourceSharing: boolean;
}

export interface ResourceRegistration {
  id: string;
  type: string;
  resource: any;
  spec: any;
  sharedCount: number;
  createdAt: number;
  lastAccessed: number;
  metadata: Record<string, any>;
}

export interface ResourceType {
  name: string;
  factory: (spec: any) => Promise<any>;
  validator: (spec: any) => boolean;
  destroyer: (resource: any) => Promise<void>;
  comparator: (spec1: any, spec2: any) => boolean; // For resource sharing
  metadata: Record<string, any>;
}

export interface RegistryStats {
  registeredTypes: number;
  sharedResources: number;
  totalAllocations: number;
  sharingRatio: number;
  memoryShared: number;
}

/**
 * Creates resource registry
 */
export const createResourceRegistry = (config: ResourceRegistryConfig) => {
  const state = {
    registrations: new Map<any, ResourceRegistration>(),
    resourceTypes: new Map<string, ResourceType>(),
    sharedResources: new Map<string, any>(), // spec hash -> resource
    registrationCounter: 0,
    
    metrics: {
      totalAllocations: 0,
      sharedAllocations: 0,
      totalRegistrations: 0,
      memoryShared: 0
    }
  };

  // Generate spec hash for resource sharing
  const generateSpecHash = (type: string, spec: any): string => {
    const specString = JSON.stringify({ type, ...spec });
    // Simple hash function (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < specString.length; i++) {
      const char = specString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  };

  // Register a resource type
  const registerType = (resourceType: ResourceType): void => {
    state.resourceTypes.set(resourceType.name, resourceType);
  };

  // Get resource type
  const getType = (typeName: string): ResourceType | null => {
    return state.resourceTypes.get(typeName) || null;
  };

  // Register a resource instance
  const register = (type: string, resource: any, spec: any): string => {
    if (!config.enableRegistry) return '';

    const id = `reg_${type}_${++state.registrationCounter}`;
    const now = Date.now();

    const registration: ResourceRegistration = {
      id,
      type,
      resource,
      spec,
      sharedCount: 0,
      createdAt: now,
      lastAccessed: now,
      metadata: {}
    };

    state.registrations.set(resource, registration);
    state.metrics.totalRegistrations++;

    return id;
  };

  // Unregister a resource
  const unregister = (resource: any): boolean => {
    const registration = state.registrations.get(resource);
    if (!registration) return false;

    // Remove from shared resources if it's shared
    const specHash = generateSpecHash(registration.type, registration.spec);
    if (state.sharedResources.get(specHash) === resource) {
      state.sharedResources.delete(specHash);
    }

    state.registrations.delete(resource);
    return true;
  };

  // Get shared resource or create new one
  const getSharedResource = async <T>(type: string, spec: any): Promise<T | null> => {
    if (!config.enableResourceSharing) return null;

    const resourceType = state.resourceTypes.get(type);
    if (!resourceType) return null;

    const specHash = generateSpecHash(type, spec);
    const existingResource = state.sharedResources.get(specHash);

    if (existingResource) {
      // Update sharing metrics
      const registration = state.registrations.get(existingResource);
      if (registration) {
        registration.sharedCount++;
        registration.lastAccessed = Date.now();
        state.metrics.sharedAllocations++;
      }
      return existingResource as T;
    }

    // Check if we can find a compatible existing resource
    for (const [hash, resource] of state.sharedResources) {
      const registration = state.registrations.get(resource);
      if (registration && registration.type === type) {
        // Use comparator to check if resources are compatible
        if (resourceType.comparator(spec, registration.spec)) {
          registration.sharedCount++;
          registration.lastAccessed = Date.now();
          state.metrics.sharedAllocations++;
          
          // Store this resource for future requests with same spec
          state.sharedResources.set(specHash, resource);
          return resource as T;
        }
      }
    }

    // Create new resource if factory is available
    if (resourceType.factory && resourceType.validator(spec)) {
      try {
        const newResource = await resourceType.factory(spec);
        state.sharedResources.set(specHash, newResource);
        
        // Register the new resource
        register(type, newResource, spec);
        
        state.metrics.totalAllocations++;
        return newResource as T;
      } catch (error) {
        console.error(`Failed to create shared resource of type ${type}:`, error);
        return null;
      }
    }

    return null;
  };

  // Release shared resource reference
  const releaseSharedResource = (resource: any): void => {
    const registration = state.registrations.get(resource);
    if (registration && registration.sharedCount > 0) {
      registration.sharedCount--;
      
      // If no more references, consider removing from shared pool
      if (registration.sharedCount === 0) {
        const specHash = generateSpecHash(registration.type, registration.spec);
        state.sharedResources.delete(specHash);
      }
    }
  };

  // Find resources by type
  const findByType = (type: string): any[] => {
    const resources: any[] = [];
    
    for (const [resource, registration] of state.registrations) {
      if (registration.type === type) {
        resources.push(resource);
      }
    }
    
    return resources;
  };

  // Find resources by specification
  const findBySpec = (type: string, spec: any): any[] => {
    const resourceType = state.resourceTypes.get(type);
    if (!resourceType) return [];

    const resources: any[] = [];
    
    for (const [resource, registration] of state.registrations) {
      if (registration.type === type && resourceType.comparator(spec, registration.spec)) {
        resources.push(resource);
      }
    }
    
    return resources;
  };

  // Get resource registration info
  const getRegistration = (resource: any): ResourceRegistration | null => {
    return state.registrations.get(resource) || null;
  };

  // Update resource metadata
  const updateMetadata = (resource: any, metadata: Record<string, any>): boolean => {
    const registration = state.registrations.get(resource);
    if (!registration) return false;

    Object.assign(registration.metadata, metadata);
    registration.lastAccessed = Date.now();
    return true;
  };

  // Cleanup unused shared resources
  const cleanupSharedResources = async (): Promise<number> => {
    let cleanedCount = 0;
    const now = Date.now();
    const maxAge = 600000; // 10 minutes

    for (const [specHash, resource] of state.sharedResources) {
      const registration = state.registrations.get(resource);
      
      if (registration && 
          registration.sharedCount === 0 && 
          (now - registration.lastAccessed) > maxAge) {
        
        // Destroy the resource if destroyer is available
        const resourceType = state.resourceTypes.get(registration.type);
        if (resourceType?.destroyer) {
          try {
            await resourceType.destroyer(resource);
          } catch (error) {
            console.warn('Failed to destroy shared resource:', error);
          }
        }
        
        // Remove from shared pool and registrations
        state.sharedResources.delete(specHash);
        state.registrations.delete(resource);
        cleanedCount++;
      }
    }

    return cleanedCount;
  };

  // Get registry statistics
  const getStats = (): RegistryStats => {
    const {totalAllocations} = state.metrics;
    const {sharedAllocations} = state.metrics;
    const sharingRatio = totalAllocations > 0 ? sharedAllocations / totalAllocations : 0;

    // Calculate estimated memory shared
    let memoryShared = 0;
    for (const registration of state.registrations.values()) {
      if (registration.sharedCount > 1) {
        const estimatedSize = JSON.stringify(registration.spec).length * 100; // Rough estimate
        memoryShared += estimatedSize * (registration.sharedCount - 1);
      }
    }

    return {
      registeredTypes: state.resourceTypes.size,
      sharedResources: state.sharedResources.size,
      totalAllocations,
      sharingRatio,
      memoryShared
    };
  };

  // List all registered types
  const listTypes = (): string[] => {
    return Array.from(state.resourceTypes.keys());
  };

  // Get detailed resource report
  const getResourceReport = () => ({
    byType: Object.fromEntries(
      Array.from(state.resourceTypes.keys()).map(type => [
        type,
        {
          instances: findByType(type).length,
          sharedInstances: Array.from(state.registrations.values())
            .filter(r => r.type === type && r.sharedCount > 0).length,
          totalSharing: Array.from(state.registrations.values())
            .filter(r => r.type === type)
            .reduce((sum, r) => sum + r.sharedCount, 0)
        }
      ])
    ),
    mostSharedResources: Array.from(state.registrations.values())
      .sort((a, b) => b.sharedCount - a.sharedCount)
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        type: r.type,
        sharedCount: r.sharedCount,
        age: Date.now() - r.createdAt
      })),
    oldestResources: Array.from(state.registrations.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        type: r.type,
        age: Date.now() - r.createdAt,
        sharedCount: r.sharedCount
      }))
  });

  // Export registry data
  const exportData = () => ({
    types: Array.from(state.resourceTypes.entries()),
    registrations: Array.from(state.registrations.values()).map(r => ({
      ...r,
      resource: undefined // Don't serialize actual resources
    })),
    metrics: { ...state.metrics },
    config: { ...config }
  });

  // Import registry data
  const importData = (data: any): void => {
    if (data.types) {
      for (const [name, type] of data.types) {
        state.resourceTypes.set(name, type);
      }
    }

    if (data.metrics) {
      Object.assign(state.metrics, data.metrics);
    }

    // Note: Can't restore actual resource registrations since resources aren't serialized
  };

  // Clear all registrations
  const clear = (): void => {
    state.registrations.clear();
    state.sharedResources.clear();
    state.registrationCounter = 0;
  };

  // Full cleanup
  const cleanup = async (): Promise<void> => {
    // Cleanup shared resources
    await cleanupSharedResources();
    
    // Destroy remaining resources
    for (const [resource, registration] of state.registrations) {
      const resourceType = state.resourceTypes.get(registration.type);
      if (resourceType?.destroyer) {
        try {
          await resourceType.destroyer(resource);
        } catch (error) {
          console.warn('Failed to destroy resource during cleanup:', error);
        }
      }
    }
    
    clear();
  };

  return {
    registerType,
    getType,
    register,
    unregister,
    getSharedResource,
    releaseSharedResource,
    findByType,
    findBySpec,
    getRegistration,
    updateMetadata,
    cleanupSharedResources,
    getStats,
    listTypes,
    getResourceReport,
    exportData,
    importData,
    clear,
    cleanup
  };
};
