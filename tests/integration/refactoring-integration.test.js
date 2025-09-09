/**
 * Integration Tests for Refactored Systems
 * Tests real usage scenarios of the new composition and resource systems
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('Refactoring Integration Tests', () => {
  let engine, resourceManager;

  beforeEach(async () => {
    const { createPipelineCompositionEngine } = await import('../../src/core/pipeline/composition/composition-engine.js');
    const { createResourceManager } = await import('../../src/core/resources/resource-manager.js');
    
    engine = createPipelineCompositionEngine();
    resourceManager = createResourceManager({
      cache: { enableLRU: true, enableCompression: true }
    });
  });

  afterEach(async () => {
    if (engine) await engine.cleanup();
    if (resourceManager) await resourceManager.performFullCleanup();
  });

  test('should execute sequential composition', async () => {
    // Create mock pipelines
    const mockPipeline1 = {
      process: async (input) => ({ ...input, step1: 'completed' })
    };
    
    const mockPipeline2 = {
      process: async (input) => ({ ...input, step2: 'completed' })
    };

    // Create composition
    const composition = engine.createComposition('sequential', {
      id: 'test-seq',
      name: 'Test Sequential',
      pipelines: [
        { id: 'p1', pipeline: mockPipeline1 },
        { id: 'p2', pipeline: mockPipeline2 }
      ],
      options: {
        passPreviousResults: true
      }
    });

    // Execute
    const result = await engine.execute(composition);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.pattern).toBe('sequential');
    expect(result.results.length).toBeGreaterThan(0);
  });

  test('should execute parallel composition with concurrency', async () => {
    // Create mock pipelines that take different times
    const createMockPipeline = (delay, id) => ({
      process: async (input) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { id, processed: true, timestamp: Date.now() };
      }
    });

    const composition = engine.createComposition('parallel', {
      id: 'test-parallel',
      name: 'Test Parallel',
      pipelines: [
        { id: 'fast1', pipeline: createMockPipeline(10, 'fast1') },
        { id: 'fast2', pipeline: createMockPipeline(10, 'fast2') },
        { id: 'slow1', pipeline: createMockPipeline(50, 'slow1') }
      ],
      options: {
        maxConcurrency: 2,
        synchronization: 'wait_all'
      }
    });

    const startTime = Date.now();
    const result = await engine.execute(composition);
    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(result.pattern).toBe('parallel');
    expect(result.results.length).toBe(3);
    // Should take around 60ms (10ms for 2 concurrent, then 50ms for the slow one)
    // But be lenient with timing
    expect(duration).toBeLessThan(200);
  });

  test('should manage resources with caching', async () => {
    // Test cache operations
    const testData = { large: 'x'.repeat(1000) };
    
    // Store in cache
    await resourceManager.cache.set('test-key', testData, { ttl: 60000 });
    
    // Retrieve from cache
    const retrieved = await resourceManager.cache.get('test-key');
    expect(retrieved).toEqual(testData);
    
    // Check cache stats
    const cacheStats = resourceManager.cache.getStats();
    expect(cacheStats.entries).toBe(1);
    expect(cacheStats.hitRate).toBeGreaterThan(0);
    
    // Test LRU eviction by filling cache
    for (let i = 0; i < 100; i++) {
      await resourceManager.cache.set(`key-${i}`, { data: i }, { ttl: 5000 });
    }
    
    // Original should still be accessible due to access
    const stillCached = await resourceManager.cache.get('test-key');
    expect(stillCached).toEqual(testData);
  });

  test('should track resource lifecycle', async () => {
    // Allocate various resources
    const canvas = await resourceManager.allocateResource('canvas', {
      width: 640,
      height: 480
    });
    
    expect(canvas).toBeDefined();
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    
    // Check lifecycle tracking
    const lifecycleStats = resourceManager.lifecycle.getStats();
    expect(lifecycleStats.trackedResources).toBeGreaterThan(0);
    
    // Deallocate
    await resourceManager.deallocateResource(canvas);
  });

  test('should handle composition with resource allocation', async () => {
    // Create a pipeline that uses resources
    const resourcePipeline = {
      process: async (input) => {
        // Allocate a buffer
        const buffer = await resourceManager.allocateResource('buffer', {
          imageBuffer: true,
          width: 100,
          height: 100,
          channels: 4
        });
        
        expect(buffer).toBeDefined();
        expect(buffer.length).toBe(100 * 100 * 4);
        
        // Process (mock)
        const result = { processed: true, bufferSize: buffer.length };
        
        // Deallocate
        await resourceManager.deallocateResource(buffer);
        
        return result;
      }
    };

    const composition = engine.createComposition('sequential', {
      id: 'resource-test',
      name: 'Resource Test',
      pipelines: [
        { id: 'resource-pipeline', pipeline: resourcePipeline }
      ]
    });

    const result = await engine.execute(composition);
    expect(result.success).toBe(true);
    expect(result.results[0].result.bufferSize).toBe(40000);
  });

  test('should optimize resources', async () => {
    // Create some memory pressure
    for (let i = 0; i < 10; i++) {
      await resourceManager.cache.set(`pressure-${i}`, {
        data: new Array(1000).fill(i)
      });
    }
    
    const beforeStats = resourceManager.getSystemStatus();
    
    // Optimize
    await resourceManager.optimizeResources();
    
    const afterStats = resourceManager.getSystemStatus();
    
    // Should have performed some cleanup
    expect(afterStats).toBeDefined();
    expect(afterStats.overall.performanceScore).toBeGreaterThanOrEqual(0);
  });

  test('should handle adaptive composition (migrated from conditional)', async () => {
    const { createPipelineComposer } = await import('../../src/core/pipeline/composers/index.ts');
    const composer = createPipelineComposer();
    
    const truePipeline = {
      process: async (input) => ({ result: 'true branch' })
    };
    
    const falsePipeline = {
      process: async (input) => ({ result: 'false branch' })
    };
    
    // Register pipelines first
    composer.registerPipeline('true-pipeline', truePipeline);
    composer.registerPipeline('false-pipeline', falsePipeline);
    
    const composition = composer.createComposition({
      id: 'test-adaptive',
      pattern: 'adaptive',
      name: 'Test Adaptive Composition',
      pipelines: [
        {
          id: 'rule-1',
          condition: (input) => input.value > 5,
          pipelineIds: ['true-pipeline'],
          priority: 1.0
        },
        {
          id: 'rule-2', 
          condition: (input) => input.value <= 5,
          pipelineIds: ['false-pipeline'],
          priority: 0.8
        }
      ],
      options: {
        strategy: 'adaptive'
      }
    });
    
    const result = await composer.executeComposition('test-adaptive', { value: 10 });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  test('should export and track metrics', () => {
    const metrics = engine.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalCompositions).toBeGreaterThanOrEqual(0);
    
    const resourceMetrics = resourceManager.metrics.getComprehensiveMetrics();
    expect(resourceMetrics).toBeDefined();
    expect(resourceMetrics.current).toBeDefined();
  });
});