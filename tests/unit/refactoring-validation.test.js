/**
 * Validation Tests for Recent Refactoring
 * Tests the new Pipeline Composition System and Resource Management Architecture
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

// Test Pipeline Composition System
describe('Pipeline Composition System', () => {
  describe('Composition Engine', () => {
    test('should create composition engine with all patterns', async () => {
      const { createPipelineCompositionEngine } = await import('../../src/core/pipeline/composition/composition-engine.js');
      const engine = createPipelineCompositionEngine();
      
      expect(engine).toBeDefined();
      expect(engine.composers).toBeDefined();
      expect(engine.execute).toBeInstanceOf(Function);
      expect(engine.createComposition).toBeInstanceOf(Function);
      expect(engine.getMetrics).toBeInstanceOf(Function);
    });

    test('should support all composition patterns', async () => {
      const { createPipelineCompositionEngine, CompositionPattern } = await import('../../src/core/pipeline/composition/composition-engine.js');
      const engine = createPipelineCompositionEngine();
      
      const patterns = Object.values(CompositionPattern);
      expect(patterns).toContain('sequential');
      expect(patterns).toContain('parallel');
      expect(patterns).toContain('conditional');
      expect(patterns).toContain('cascading');
      expect(patterns).toContain('adaptive');
    });
  });

  describe('Sequential Composer', () => {
    test('should create sequential composer', async () => {
      const { createSequentialComposer } = await import('../../src/core/pipeline/composition/composers/sequential-composer.js');
      const composer = createSequentialComposer();
      
      expect(composer).toBeDefined();
      expect(composer.pattern).toBe('sequential');
      expect(composer.execute).toBeInstanceOf(Function);
      expect(composer.createComposition).toBeInstanceOf(Function);
    });
  });

  describe('Parallel Composer', () => {
    test('should create parallel composer with concurrency control', async () => {
      const { createParallelComposer } = await import('../../src/core/pipeline/composition/composers/parallel-composer.js');
      const composer = createParallelComposer({ defaultMaxConcurrency: 3 });
      
      expect(composer).toBeDefined();
      expect(composer.pattern).toBe('parallel');
      expect(composer.execute).toBeInstanceOf(Function);
    });
  });

  describe('Composition Metrics', () => {
    test('should track composition metrics', async () => {
      const { createCompositionMetrics } = await import('../../src/core/pipeline/composition/metrics/composition-metrics.js');
      const metrics = createCompositionMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.recordExecution).toBeInstanceOf(Function);
      expect(metrics.getMetrics).toBeInstanceOf(Function);
      expect(metrics.getSummary).toBeInstanceOf(Function);
      
      // Test recording
      metrics.recordExecution('sequential', 100, true);
      const summary = metrics.getSummary();
      expect(summary.overall.totalExecutions).toBe(1);
      expect(summary.overall.successRate).toBe(1);
    });
  });

  describe('Composition Registry', () => {
    test('should register and retrieve compositions', async () => {
      const { createCompositionRegistry } = await import('../../src/core/pipeline/composition/registry/composition-registry.js');
      const registry = createCompositionRegistry();
      
      expect(registry).toBeDefined();
      expect(registry.register).toBeInstanceOf(Function);
      expect(registry.get).toBeInstanceOf(Function);
      expect(registry.search).toBeInstanceOf(Function);
      
      // Test registration
      const mockComposition = {
        id: 'test-comp',
        name: 'Test Composition',
        pattern: 'sequential',
        strategy: 'continue_on_error',
        pipelines: [],
        options: {}
      };
      
      registry.register(mockComposition);
      const retrieved = registry.get('test-comp');
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Test Composition');
    });
  });
});

// Test Resource Management Architecture
describe('Resource Management Architecture', () => {
  describe('Resource Manager', () => {
    test('should create centralized resource manager', async () => {
      const { createResourceManager } = await import('../../src/core/resources/resource-manager.js');
      const manager = createResourceManager();
      
      expect(manager).toBeDefined();
      expect(manager.resourcePool).toBeDefined();
      expect(manager.memory).toBeDefined();
      expect(manager.cache).toBeDefined();
      expect(manager.lifecycle).toBeDefined();
      expect(manager.registry).toBeDefined();
      expect(manager.metrics).toBeDefined();
    });

    test('should provide high-level resource operations', async () => {
      const { createResourceManager } = await import('../../src/core/resources/resource-manager.js');
      const manager = createResourceManager();
      
      expect(manager.allocateResource).toBeInstanceOf(Function);
      expect(manager.deallocateResource).toBeInstanceOf(Function);
      expect(manager.optimizeResources).toBeInstanceOf(Function);
      expect(manager.getSystemStatus).toBeInstanceOf(Function);
    });
  });

  describe('Memory Manager', () => {
    test('should manage memory allocations', async () => {
      const { createMemoryManager } = await import('../../src/core/resources/managers/memory-manager.js');
      const memory = createMemoryManager({
        maxMemoryUsage: 100 * 1024 * 1024,
        gcThreshold: 0.8,
        enableMemoryPressureHandling: true,
        enableLeakDetection: false
      });
      
      expect(memory).toBeDefined();
      expect(memory.allocate).toBeInstanceOf(Function);
      expect(memory.deallocate).toBeInstanceOf(Function);
      expect(memory.getStats).toBeInstanceOf(Function);
      
      // Test allocation
      const buffer = await memory.allocate(1024, { type: 'buffer' });
      expect(buffer).toBeDefined();
      
      const stats = memory.getStats();
      expect(stats.allocations).toBeGreaterThan(0);
      
      await memory.deallocate(buffer);
    });
  });

  describe('Cache Manager', () => {
    test('should provide LRU caching with compression', async () => {
      const { createCacheManager } = await import('../../src/core/resources/managers/cache-manager.js');
      const cache = createCacheManager({
        maxCacheSize: 10 * 1024 * 1024,
        defaultTtl: 5000,
        enableLRU: true,
        enableCompression: true
      });
      
      expect(cache).toBeDefined();
      expect(cache.set).toBeInstanceOf(Function);
      expect(cache.get).toBeInstanceOf(Function);
      expect(cache.has).toBeInstanceOf(Function);
      
      // Test cache operations
      await cache.set('test-key', { data: 'test-value' });
      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual({ data: 'test-value' });
      
      const stats = cache.getStats();
      expect(stats.entries).toBe(1);
    });
  });

  describe('Lifecycle Manager', () => {
    test('should track resource lifecycle', async () => {
      const { createLifecycleManager } = await import('../../src/core/resources/managers/lifecycle-manager.js');
      const lifecycle = createLifecycleManager({
        enableAutoCleanup: false,
        cleanupInterval: 30000,
        maxResourceAge: 600000,
        enableResourceTracking: true
      });
      
      expect(lifecycle).toBeDefined();
      expect(lifecycle.trackResource).toBeInstanceOf(Function);
      expect(lifecycle.untrackResource).toBeInstanceOf(Function);
      expect(lifecycle.getStats).toBeInstanceOf(Function);
      
      // Test resource tracking
      const mockResource = { id: 'test' };
      const id = lifecycle.trackResource(mockResource, 'test-type', { size: 100 });
      expect(id).toBeDefined();
      
      const stats = lifecycle.getStats();
      expect(stats.trackedResources).toBe(1);
      
      lifecycle.untrackResource(mockResource);
    });
  });

  describe('Resource Registry', () => {
    test('should register resource types and enable sharing', async () => {
      const { createResourceRegistry } = await import('../../src/core/resources/registry/resource-registry.js');
      const registry = createResourceRegistry({
        enableRegistry: true,
        maxRegistrySize: 1000,
        enableResourceSharing: true
      });
      
      expect(registry).toBeDefined();
      expect(registry.registerType).toBeInstanceOf(Function);
      expect(registry.register).toBeInstanceOf(Function);
      expect(registry.getSharedResource).toBeInstanceOf(Function);
      
      // Test type registration
      registry.registerType({
        name: 'test-resource',
        factory: async (spec) => ({ type: 'test', spec }),
        validator: (spec) => true,
        destroyer: async (resource) => {},
        comparator: (spec1, spec2) => spec1.id === spec2.id,
        metadata: {}
      });
      
      const types = registry.listTypes();
      expect(types).toContain('test-resource');
    });
  });

  describe('Resource Metrics', () => {
    test('should collect comprehensive metrics', async () => {
      const { createResourceMetrics } = await import('../../src/core/resources/metrics/resource-metrics.js');
      
      // Create mock managers
      const mockManagers = {
        resourcePool: {
          getMetrics: () => ({
            canvas: { active: 2, available: 8 },
            webgl: { active: 1, available: 4 },
            buffers: { active: 5, totalSize: 1024000 }
          })
        },
        memory: {
          getStats: () => ({
            used: 50000000,
            available: 50000000,
            pressure: 0.5,
            gcPressure: 0,
            allocations: 100,
            deallocations: 50,
            leaks: 0
          })
        },
        cache: {
          getStats: () => ({
            entries: 20,
            hitRate: 0.75,
            memoryUsage: 5000000,
            compressionRatio: 1.5,
            totalHits: 150,
            totalMisses: 50,
            evictions: 10
          })
        },
        lifecycle: {
          getStats: () => ({
            trackedResources: 30,
            cleanupsPending: 5,
            averageResourceAge: 30000,
            totalCleanups: 100,
            totalResourcesCreated: 500
          })
        },
        registry: {
          getStats: () => ({
            registeredTypes: 10,
            sharedResources: 15,
            totalAllocations: 200,
            sharingRatio: 0.3,
            memoryShared: 10000000
          })
        }
      };
      
      const metrics = createResourceMetrics(
        { enableMetrics: true, metricsInterval: 5000, enablePerformanceTracking: true, enableResourceProfiling: false },
        mockManagers
      );
      
      expect(metrics).toBeDefined();
      expect(metrics.takeSnapshot).toBeInstanceOf(Function);
      expect(metrics.getComprehensiveMetrics).toBeInstanceOf(Function);
      
      const snapshot = metrics.takeSnapshot();
      expect(snapshot.memory.pressure).toBe(0.5);
      expect(snapshot.cache.hitRate).toBe(0.75);
      expect(snapshot.lifecycle.trackedResources).toBe(30);
    });
  });
});

// Integration Tests
describe('Refactoring Integration', () => {
  test('should integrate pipeline composition with resource management', async () => {
    const { createPipelineCompositionEngine } = await import('../../src/core/pipeline/composition/composition-engine.js');
    const { createResourceManager } = await import('../../src/core/resources/resource-manager.js');
    
    const engine = createPipelineCompositionEngine();
    const resourceManager = createResourceManager();
    
    expect(engine).toBeDefined();
    expect(resourceManager).toBeDefined();
    
    // Both systems should work independently
    const engineMetrics = engine.getMetrics();
    const resourceStatus = resourceManager.getSystemStatus();
    
    expect(engineMetrics).toBeDefined();
    expect(resourceStatus).toBeDefined();
    expect(resourceStatus.overall).toBeDefined();
    expect(resourceStatus.overall.performanceScore).toBeGreaterThanOrEqual(0);
  });

  test('should maintain factory function patterns', () => {
    // All our new modules should use factory functions, not classes
    const modules = [
      '../../src/core/pipeline/composition/composition-engine.js',
      '../../src/core/resources/resource-manager.js'
    ];
    
    modules.forEach(async (modulePath) => {
      const module = await import(modulePath);
      // Check that exports are functions that create objects, not classes
      Object.values(module).forEach(exported => {
        if (typeof exported === 'function' && exported.name.startsWith('create')) {
          // It's a factory function
          expect(exported.prototype).toBeUndefined();
        }
      });
    });
  });
});