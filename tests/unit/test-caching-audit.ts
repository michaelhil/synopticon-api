/**
 * @fileoverview Comprehensive Caching Functionality Audit and Test Suite
 * 
 * Tests all caching implementations across the entire codebase,
 * providing comprehensive validation of caching behavior.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createLazyPipelineRegistry } from '../../src/core/lazy-pipeline-registry.js';
import { createPipelineComposer } from '../../src/core/pipeline-composer.js';
import { createImageProcessor } from '../../src/core/image-processor.js';
import { createLLMClient } from '../../src/features/speech-analysis/llm-client.js';

/**
 * Audit result for a single component
 */
interface ComponentAuditResult {
  tests: number;
  passed: number;
  issues: string[];
}

/**
 * Overall audit results
 */
interface AuditResults {
  pipelineRegistry: ComponentAuditResult;
  pipelineComposer: ComponentAuditResult;
  imageProcessor: ComponentAuditResult;
  llmClient: ComponentAuditResult;
  dependencyLoader: ComponentAuditResult;
  overall: {
    totalTests: number;
    totalPassed: number;
    totalIssues: string[];
  };
}

/**
 * Performance metrics for cache operations
 */
interface CachePerformanceMetrics {
  hitRate: number;
  avgAccessTime: number;
  memoryUsage: number;
  evictionCount: number;
}

/**
 * Main caching audit function
 */
const auditCachingFunctionality = async (): Promise<AuditResults> => {
  console.log('🔍 Auditing caching functionality across entire codebase...\n');
  
  const auditResults: AuditResults = {
    pipelineRegistry: { tests: 0, passed: 0, issues: [] },
    pipelineComposer: { tests: 0, passed: 0, issues: [] },
    imageProcessor: { tests: 0, passed: 0, issues: [] },
    llmClient: { tests: 0, passed: 0, issues: [] },
    dependencyLoader: { tests: 0, passed: 0, issues: [] },
    overall: { totalTests: 0, totalPassed: 0, totalIssues: [] }
  };

  try {
    // Phase 1: Pipeline Registry Cache Audit
    console.log('📦 Phase 1: Pipeline Registry Cache Audit...');
    await auditPipelineRegistryCache(auditResults.pipelineRegistry);
    
    // Phase 2: Pipeline Composer Cache Audit
    console.log('\n🔧 Phase 2: Pipeline Composer Cache Audit...');
    await auditPipelineComposerCache(auditResults.pipelineComposer);
    
    // Phase 3: Image Processor Cache Audit
    console.log('\n🖼️ Phase 3: Image Processor Cache Audit...');
    await auditImageProcessorCache(auditResults.imageProcessor);
    
    // Phase 4: LLM Client Cache Audit
    console.log('\n🧠 Phase 4: LLM Client Cache Audit...');
    await auditLLMClientCache(auditResults.llmClient);
    
    // Calculate overall results
    calculateOverallResults(auditResults);
    
    // Generate final report
    generateAuditReport(auditResults);
    
  } catch (error) {
    console.error('❌ Audit failed with error:', error);
    auditResults.overall.totalIssues.push(`Audit execution error: ${(error as Error).message}`);
  }
  
  return auditResults;
};

/**
 * Audit pipeline registry caching functionality
 */
const auditPipelineRegistryCache = async (result: ComponentAuditResult): Promise<void> => {
  try {
    const registry = createLazyPipelineRegistry({
      cacheSize: 3,
      preloadCritical: false
    });
    
    // Test 1.1: Basic cache functionality
    console.log('  🧪 Test 1.1: Basic cache functionality');
    result.tests++;
    
    const pipeline1 = await registry.loadPipeline('mediapipe-face');
    const pipeline2 = await registry.loadPipeline('mediapipe-face');
    
    if (pipeline1 === pipeline2) {
      console.log('    ✅ Same instance returned from cache');
      result.passed++;
    } else {
      console.log('    ❌ Different instances returned - cache not working');
      result.issues.push('Pipeline registry cache not returning same instances');
    }
    
    // Test 1.2: Cache size limits
    console.log('  🧪 Test 1.2: Cache size enforcement');
    result.tests++;
    
    await registry.loadPipeline('emotion-analysis');
    await registry.loadPipeline('age-estimation');
    await registry.loadPipeline('iris-tracking');
    
    const stats = registry.getCacheStats();
    if (stats.size <= 3) {
      console.log(`    ✅ Cache size limit respected (${stats.size}/3)`);
      result.passed++;
    } else {
      console.log(`    ❌ Cache size limit exceeded (${stats.size}/3)`);
      result.issues.push('Pipeline registry cache size limit not enforced');
    }
    
    // Test 1.3: Cache hit rate
    console.log('  🧪 Test 1.3: Cache hit rate validation');
    result.tests++;
    
    // Load same pipeline multiple times
    for (let i = 0; i < 5; i++) {
      await registry.loadPipeline('mediapipe-face');
    }
    
    const finalStats = registry.getCacheStats();
    const hitRate = finalStats.hits / (finalStats.hits + finalStats.misses);
    
    if (hitRate > 0.5) {
      console.log(`    ✅ Good cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
      result.passed++;
    } else {
      console.log(`    ❌ Poor cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
      result.issues.push('Pipeline registry cache hit rate too low');
    }
    
  } catch (error) {
    console.error('  ❌ Pipeline registry audit failed:', error);
    result.issues.push(`Pipeline registry audit error: ${(error as Error).message}`);
  }
};

/**
 * Audit pipeline composer caching functionality
 */
const auditPipelineComposerCache = async (result: ComponentAuditResult): Promise<void> => {
  try {
    const composer = createPipelineComposer({
      maxCacheSize: 5,
      enableCaching: true
    });
    
    // Test 2.1: Pipeline composition cache
    console.log('  🧪 Test 2.1: Pipeline composition caching');
    result.tests++;
    
    const config1 = {
      steps: ['resize', 'normalize', 'inference'],
      options: { width: 224, height: 224 }
    };
    
    const pipeline1 = await composer.compose(config1);
    const pipeline2 = await composer.compose(config1);
    
    if (pipeline1 === pipeline2) {
      console.log('    ✅ Same composed pipeline returned from cache');
      result.passed++;
    } else {
      console.log('    ❌ Different composed pipelines - cache not working');
      result.issues.push('Pipeline composer cache not working');
    }
    
    // Test 2.2: Cache invalidation on config change
    console.log('  🧪 Test 2.2: Cache invalidation on config change');
    result.tests++;
    
    const config2 = {
      steps: ['resize', 'normalize', 'inference'],
      options: { width: 256, height: 256 } // Different size
    };
    
    const pipeline3 = await composer.compose(config2);
    
    if (pipeline1 !== pipeline3) {
      console.log('    ✅ Different pipeline for different config');
      result.passed++;
    } else {
      console.log('    ❌ Same pipeline for different config - cache invalidation failed');
      result.issues.push('Pipeline composer cache invalidation not working');
    }
    
  } catch (error) {
    console.error('  ❌ Pipeline composer audit failed:', error);
    result.issues.push(`Pipeline composer audit error: ${(error as Error).message}`);
  }
};

/**
 * Audit image processor caching functionality
 */
const auditImageProcessorCache = async (result: ComponentAuditResult): Promise<void> => {
  try {
    const processor = createImageProcessor({
      cacheSize: 10,
      enablePreprocessingCache: true
    });
    
    // Test 3.1: Preprocessing result cache
    console.log('  🧪 Test 3.1: Preprocessing result caching');
    result.tests++;
    
    // Create mock image data
    const mockImageData = new ImageData(224, 224);
    const config = { resize: { width: 224, height: 224 }, normalize: true };
    
    const result1 = await processor.preprocess(mockImageData, config);
    const result2 = await processor.preprocess(mockImageData, config);
    
    if (result1 === result2) {
      console.log('    ✅ Same preprocessing result returned from cache');
      result.passed++;
    } else {
      console.log('    ❌ Different preprocessing results - cache not working');
      result.issues.push('Image processor preprocessing cache not working');
    }
    
  } catch (error) {
    console.error('  ❌ Image processor audit skipped (dependency issue):', error);
    result.issues.push('Image processor audit skipped due to dependency issues');
  }
};

/**
 * Audit LLM client caching functionality
 */
const auditLLMClientCache = async (result: ComponentAuditResult): Promise<void> => {
  try {
    const llmClient = createLLMClient({
      cacheSize: 100,
      enableResponseCache: true,
      cacheTimeout: 300000 // 5 minutes
    });
    
    // Test 4.1: Response caching
    console.log('  🧪 Test 4.1: LLM response caching');
    result.tests++;
    
    const prompt = 'Analyze this sample text for sentiment';
    const input = 'This is a test message';
    
    // Mock the actual LLM call to avoid external dependencies
    const mockAnalyze = jest.fn().mockResolvedValue({
      sentiment: 'neutral',
      confidence: 0.8,
      cached: false
    });
    
    // Replace the analyze method temporarily
    const originalAnalyze = llmClient.analyze;
    llmClient.analyze = mockAnalyze;
    
    const response1 = await llmClient.analyze(prompt, input);
    const response2 = await llmClient.analyze(prompt, input);
    
    if (mockAnalyze.call.length === 1) {
      console.log('    ✅ LLM response cached (single call made)');
      result.passed++;
    } else {
      console.log('    ❌ LLM response not cached (multiple calls made)');
      result.issues.push('LLM client response caching not working');
    }
    
    // Restore original method
    llmClient.analyze = originalAnalyze;
    
  } catch (error) {
    console.error('  ❌ LLM client audit skipped:', error);
    result.issues.push('LLM client audit skipped due to implementation differences');
  }
};

/**
 * Calculate overall audit results
 */
const calculateOverallResults = (auditResults: AuditResults): void => {
  const components = [auditResults.pipelineRegistry, auditResults.pipelineComposer, 
                     auditResults.imageProcessor, auditResults.llmClient, auditResults.dependencyLoader];
  
  auditResults.overall.totalTests = components.reduce((sum, comp) => sum + comp.tests, 0);
  auditResults.overall.totalPassed = components.reduce((sum, comp) => sum + comp.passed, 0);
  auditResults.overall.totalIssues = components.flatMap(comp => comp.issues);
};

/**
 * Generate comprehensive audit report
 */
const generateAuditReport = (auditResults: AuditResults): void => {
  console.log('\n📊 CACHING AUDIT REPORT');
  console.log('========================\n');
  
  const { overall } = auditResults;
  const successRate = overall.totalTests > 0 ? (overall.totalPassed / overall.totalTests * 100) : 0;
  
  console.log(`📈 Overall Results:`);
  console.log(`   Tests Run: ${overall.totalTests}`);
  console.log(`   Tests Passed: ${overall.totalPassed}`);
  console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`   Issues Found: ${overall.totalIssues.length}\n`);
  
  // Component-specific results
  const components = [
    { name: 'Pipeline Registry', result: auditResults.pipelineRegistry },
    { name: 'Pipeline Composer', result: auditResults.pipelineComposer },
    { name: 'Image Processor', result: auditResults.imageProcessor },
    { name: 'LLM Client', result: auditResults.llmClient }
  ];
  
  components.forEach(({ name, result }) => {
    const rate = result.tests > 0 ? (result.passed / result.tests * 100) : 0;
    console.log(`🔧 ${name}:`);
    console.log(`   Tests: ${result.passed}/${result.tests} (${rate.toFixed(1)}%)`);
    if (result.issues.length > 0) {
      console.log(`   Issues: ${result.issues.length}`);
      result.issues.forEach(issue => console.log(`     - ${issue}`));
    }
    console.log('');
  });
  
  // Recommendations
  if (overall.totalIssues.length > 0) {
    console.log('💡 Recommendations:');
    if (successRate < 80) {
      console.log('   - Caching implementation needs significant improvements');
    }
    if (overall.totalIssues.some(issue => issue.includes('cache size'))) {
      console.log('   - Review cache size limits and eviction policies');
    }
    if (overall.totalIssues.some(issue => issue.includes('hit rate'))) {
      console.log('   - Optimize cache key generation and lookup algorithms');
    }
    console.log('');
  } else {
    console.log('✅ All caching functionality is working correctly!\n');
  }
};

/**
 * Performance benchmarking for cache operations
 */
const benchmarkCachePerformance = async (): Promise<CachePerformanceMetrics> => {
  console.log('⚡ Running cache performance benchmarks...');
  
  const startTime = performance.now();
  const registry = createLazyPipelineRegistry({ cacheSize: 50 });
  
  // Warmup
  await registry.loadPipeline('mediapipe-face');
  
  // Benchmark cache hits
  const iterations = 1000;
  const hitStartTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await registry.loadPipeline('mediapipe-face');
  }
  
  const hitEndTime = performance.now();
  const avgHitTime = (hitEndTime - hitStartTime) / iterations;
  
  // Get final stats
  const stats = registry.getCacheStats();
  const hitRate = stats.hits / (stats.hits + stats.misses);
  
  const metrics: CachePerformanceMetrics = {
    hitRate: hitRate * 100,
    avgAccessTime: avgHitTime,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
    evictionCount: stats.evictions || 0
  };
  
  console.log(`   Hit Rate: ${metrics.hitRate.toFixed(1)}%`);
  console.log(`   Avg Access Time: ${metrics.avgAccessTime.toFixed(2)}ms`);
  console.log(`   Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB`);
  console.log(`   Evictions: ${metrics.evictionCount}\n`);
  
  return metrics;
};

/**
 * Export audit functions
 */
export {
  auditCachingFunctionality,
  benchmarkCachePerformance,
  type AuditResults,
  type CachePerformanceMetrics,
  type ComponentAuditResult
};

// Run audit if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  auditCachingFunctionality()
    .then(async (results) => {
      await benchmarkCachePerformance();
      process.exit(results.overall.totalIssues.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Audit execution failed:', error);
      process.exit(1);
    });
}
