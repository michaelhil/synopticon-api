/**
 * Performance Benchmark Suite for Lazy Loading System
 * Measures loading performance, memory usage, and network efficiency
 */

import { performance } from 'perf_hooks';
import { createLazyPipelineRegistry } from '../../src/core/lazy-pipeline-registry.js';
import { createLoadingStateManager } from '../../src/core/loading-state-manager.js';
import { createPipelinePreloader, PreloadingStrategies } from '../../src/core/pipeline-preloader.js';
import { createLazyOrchestrator } from '../../src/index.js';

/**
 * Performance measurement utilities
 */
const measureAsync = async (name, fn) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;
  
  console.log(`📊 ${name}: ${duration.toFixed(2)}ms`);
  
  return {
    result,
    duration,
    name
  };
};

const measureMemory = (description) => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage();
    console.log(`🧠 ${description}:`);
    console.log(`   RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   External: ${(memory.external / 1024 / 1024).toFixed(2)} MB`);
    return memory;
  }
  return null;
};

/**
 * Benchmark lazy loading registry performance
 */
const benchmarkLazyRegistry = async () => {
  console.log('\n🧪 Benchmarking Lazy Pipeline Registry\n');
  
  const registry = createLazyPipelineRegistry({
    enableCache: true,
    cacheSize: 10,
    maxRetries: 1
  });

  // Test registry creation time
  const createTime = await measureAsync('Registry Creation', async () => {
    return createLazyPipelineRegistry();
  });

  // Test state manager integration
  const stateManager = createLoadingStateManager();
  let stateUpdates = [];
  
  registry.onLoadingStateChange((state) => {
    stateUpdates.push(state);
  });

  // Simulate pipeline load attempts
  const pipelineTypes = ['mediapipe-face', 'emotion-analysis', 'iris-tracking'];
  const loadResults = [];

  for (const pipelineType of pipelineTypes) {
    try {
      const loadResult = await measureAsync(`Load ${pipelineType}`, async () => {
        return registry.loadPipeline(pipelineType);
      });
      loadResults.push({
        type: pipelineType,
        duration: loadResult.duration,
        success: true
      });
    } catch (error) {
      loadResults.push({
        type: pipelineType,
        duration: 0,
        success: false,
        error: error.message
      });
    }
  }

  // Test cache performance
  const cacheHitTime = await measureAsync('Cache Hit Test', async () => {
    // Try to load the first pipeline again (should hit cache if it loaded successfully)
    if (loadResults[0]?.success) {
      return registry.loadPipeline(pipelineTypes[0]);
    }
    return null;
  });

  // Get metrics
  const metrics = registry.getMetrics();
  
  console.log('\n📈 Registry Performance Results:');
  console.log(`   Total Load Attempts: ${metrics.totalLoads}`);
  console.log(`   Unique Loads: ${metrics.uniqueLoads}`);
  console.log(`   Cache Hits: ${metrics.cacheHits}`);
  console.log(`   Load Failures: ${metrics.loadFailures}`);
  console.log(`   State Updates: ${stateUpdates.length}`);
  
  return {
    registryMetrics: metrics,
    loadResults,
    stateUpdates: stateUpdates.length,
    cacheHitDuration: cacheHitTime.duration
  };
};

/**
 * Benchmark preloading system performance
 */
const benchmarkPreloader = async () => {
  console.log('\n🧪 Benchmarking Pipeline Preloader\n');
  
  const preloader = createPipelinePreloader({
    strategy: PreloadingStrategies.INTELLIGENT,
    // Mock localStorage for testing
    storageAdapter: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  });

  // Test preloader creation
  const createTime = await measureAsync('Preloader Creation', async () => {
    return createPipelinePreloader();
  });

  // Test usage recording performance
  const usageRecordTime = await measureAsync('Usage Recording (100 entries)', async () => {
    for (let i = 0; i < 100; i++) {
      preloader.recordUsage('mediapipe-face', 'video_analysis');
      preloader.recordUsage('emotion-analysis', 'real_time');
    }
    return preloader.getStatistics();
  });

  // Test intelligent preloading decision making
  const decisionTime = await measureAsync('Preloading Decision Making', async () => {
    const decisions = [];
    const pipelines = ['mediapipe-face', 'emotion-analysis', 'iris-tracking', 'age-estimation'];
    
    for (const pipeline of pipelines) {
      decisions.push({
        pipeline,
        shouldPreload: preloader.shouldPreload(pipeline)
      });
    }
    
    return decisions;
  });

  const stats = preloader.getStatistics();
  
  console.log('\n📈 Preloader Performance Results:');
  console.log(`   Usage History Size: ${stats.usageHistory.length}`);
  console.log(`   Pattern Analysis Time: ${decisionTime.duration.toFixed(2)}ms`);
  console.log(`   Memory Efficiency: ${stats.memoryEfficient ? 'Good' : 'Needs optimization'}`);
  
  return {
    usageHistorySize: stats.usageHistory.length,
    decisionMakingDuration: decisionTime.duration,
    preloaderStats: stats
  };
};

/**
 * Benchmark complete orchestrator performance
 */
const benchmarkOrchestrator = async () => {
  console.log('\n🧪 Benchmarking Lazy Orchestrator\n');
  
  let orchestratorCreateTime;
  let orchestrator;
  
  try {
    const createResult = await measureAsync('Orchestrator Creation', async () => {
      return createLazyOrchestrator({
        lazyLoading: {
          enabled: true,
          cacheSize: 5
        }
      });
    });
    
    orchestrator = createResult.result;
    orchestratorCreateTime = createResult.duration;
  } catch (error) {
    console.log(`❌ Orchestrator creation failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }

  // Test pipeline registration performance
  const pipelineTypes = ['mediapipe-face', 'emotion-analysis'];
  const registrationResults = [];

  for (const pipelineType of pipelineTypes) {
    try {
      const registrationResult = await measureAsync(`Register ${pipelineType}`, async () => {
        return orchestrator.registerPipelineByType(pipelineType);
      });
      
      registrationResults.push({
        type: pipelineType,
        duration: registrationResult.duration,
        success: true
      });
    } catch (error) {
      registrationResults.push({
        type: pipelineType,
        duration: 0,
        success: false,
        error: error.message
      });
    }
  }

  // Test batch registration
  let batchRegistrationTime;
  try {
    const batchResult = await measureAsync('Batch Registration', async () => {
      return orchestrator.registerPipelinesLazy(['iris-tracking', 'age-estimation']);
    });
    batchRegistrationTime = batchResult.duration;
  } catch (error) {
    console.log(`⚠️ Batch registration failed: ${error.message}`);
    batchRegistrationTime = 0;
  }

  // Get lazy loading metrics
  const lazyMetrics = orchestrator.getLazyLoadingMetrics();
  
  console.log('\n📈 Orchestrator Performance Results:');
  console.log(`   Creation Time: ${orchestratorCreateTime.toFixed(2)}ms`);
  console.log(`   Individual Registrations: ${registrationResults.length}`);
  console.log(`   Batch Registration Time: ${batchRegistrationTime.toFixed(2)}ms`);
  console.log(`   Registry Cache Hits: ${lazyMetrics.registry?.cacheHits || 0}`);
  console.log(`   Preloader Usage Patterns: ${Object.keys(lazyMetrics.preloader?.usagePatterns || {}).length}`);
  
  return {
    creationDuration: orchestratorCreateTime,
    registrationResults,
    batchRegistrationDuration: batchRegistrationTime,
    lazyMetrics
  };
};

/**
 * Memory usage benchmark
 */
const benchmarkMemoryUsage = async () => {
  console.log('\n🧪 Memory Usage Analysis\n');
  
  const initialMemory = measureMemory('Initial Memory');
  
  // Create multiple registries to test memory scaling
  const registries = [];
  for (let i = 0; i < 10; i++) {
    registries.push(createLazyPipelineRegistry());
  }
  
  const afterRegistriesMemory = measureMemory('After Creating 10 Registries');
  
  // Create state managers
  const stateManagers = [];
  for (let i = 0; i < 10; i++) {
    stateManagers.push(createLoadingStateManager());
  }
  
  const afterStateManagersMemory = measureMemory('After Creating 10 State Managers');
  
  // Create preloaders
  const preloaders = [];
  for (let i = 0; i < 5; i++) {
    preloaders.push(createPipelinePreloader());
  }
  
  const finalMemory = measureMemory('After Creating 5 Preloaders');
  
  if (initialMemory && finalMemory) {
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    console.log(`\n📊 Memory Analysis:`);
    console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Per Registry: ${(memoryIncrease / 10 / 1024).toFixed(2)} KB`);
    
    return {
      initialHeap: initialMemory.heapUsed,
      finalHeap: finalMemory.heapUsed,
      memoryIncrease,
      averagePerComponent: memoryIncrease / 25 // Total components created
    };
  }
  
  return null;
};

/**
 * Main benchmark function
 */
const runBenchmarks = async () => {
  console.log('🚀 Starting Lazy Loading Performance Benchmarks\n');
  console.log('=' .repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    runtime: process.version || 'Unknown',
    platform: process.platform || 'Unknown'
  };
  
  try {
    // Run individual benchmarks
    results.registryPerformance = await benchmarkLazyRegistry();
    results.preloaderPerformance = await benchmarkPreloader();
    results.orchestratorPerformance = await benchmarkOrchestrator();
    results.memoryUsage = await benchmarkMemoryUsage();
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 Benchmark Summary');
    console.log('=' .repeat(60));
    
    if (results.registryPerformance) {
      console.log(`✅ Registry Cache Hit Rate: ${((results.registryPerformance.registryMetrics.cacheHits / Math.max(results.registryPerformance.registryMetrics.totalLoads, 1)) * 100).toFixed(1)}%`);
    }
    
    if (results.preloaderPerformance) {
      console.log(`✅ Preloader Decision Time: ${results.preloaderPerformance.decisionMakingDuration.toFixed(2)}ms`);
    }
    
    if (results.orchestratorPerformance) {
      console.log(`✅ Orchestrator Creation: ${results.orchestratorPerformance.creationDuration.toFixed(2)}ms`);
    }
    
    if (results.memoryUsage) {
      console.log(`✅ Memory Efficiency: ${(results.memoryUsage.memoryIncrease / 1024 / 1024).toFixed(2)} MB for 25 components`);
    }
    
  } catch (error) {
    console.error(`❌ Benchmark failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
};

// Export for use in tests
export {
  runBenchmarks,
  benchmarkLazyRegistry,
  benchmarkPreloader,
  benchmarkOrchestrator,
  benchmarkMemoryUsage,
  measureAsync,
  measureMemory
};

// Run benchmarks if called directly
if (import.meta.main) {
  runBenchmarks()
    .then(results => {
      console.log('\n✅ Benchmarks completed successfully');
    })
    .catch(error => {
      console.error('❌ Benchmarks failed:', error);
      process.exit(1);
    });
}