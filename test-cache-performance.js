/**
 * Cache Performance and Correctness Test Suite
 * Focused testing of cache implementations for performance and reliability
 */

import { createLazyPipelineRegistry } from './src/core/lazy-pipeline-registry.js';

const testCachePerformanceAndCorrectness = async () => {
  console.log('⚡ Testing cache implementations for correctness and performance...\n');
  
  const testResults = {
    pipelineRegistryCache: {
      correctness: { tests: 0, passed: 0, issues: [] },
      performance: { tests: 0, passed: 0, issues: [] },
      stress: { tests: 0, passed: 0, issues: [] }
    },
    overallResults: { totalTests: 0, totalPassed: 0, totalIssues: [] }
  };
  
  try {
    // =====================================================
    // PIPELINE REGISTRY CACHE COMPREHENSIVE TESTING
    // =====================================================
    
    console.log('🔧 Pipeline Registry Cache - Comprehensive Testing');
    
    // Test 1: Cache Correctness Tests
    console.log('\n📋 Test Suite 1: Cache Correctness...');
    
    const registry = createLazyPipelineRegistry({
      cacheSize: 5,
      preloadCritical: false
    });
    
    // Test 1.1: Basic cache hit/miss functionality
    console.log('  🧪 Test 1.1: Basic cache hit/miss behavior');
    testResults.pipelineRegistryCache.correctness.tests++;
    
    const loadStart1 = Date.now();
    const pipeline1 = await registry.loadPipeline('mediapipe-face');
    const loadTime1 = Date.now() - loadStart1;
    
    const loadStart2 = Date.now();
    const pipeline2 = await registry.loadPipeline('mediapipe-face');
    const loadTime2 = Date.now() - loadStart2;
    
    if (pipeline1 === pipeline2 && loadTime2 <= loadTime1) {
      console.log(`    ✅ Cache hit working (${loadTime1}ms -> ${loadTime2}ms)`);
      testResults.pipelineRegistryCache.correctness.passed++;
    } else {
      console.log(`    ❌ Cache hit not working properly`);
      testResults.pipelineRegistryCache.correctness.issues.push('Cache not returning same instances or not faster');
    }
    
    // Test 1.2: Cache isolation (different keys)
    console.log('  🧪 Test 1.2: Cache isolation between different pipelines');
    testResults.pipelineRegistryCache.correctness.tests++;
    
    const emotion1 = await registry.loadPipeline('emotion-analysis');
    const emotion2 = await registry.loadPipeline('emotion-analysis');
    const face3 = await registry.loadPipeline('mediapipe-face');
    
    if (emotion1 === emotion2 && face3 === pipeline1 && emotion1 !== face3) {
      console.log('    ✅ Cache isolation working correctly');
      testResults.pipelineRegistryCache.correctness.passed++;
    } else {
      console.log('    ❌ Cache isolation not working');
      testResults.pipelineRegistryCache.correctness.issues.push('Cache not properly isolating different pipeline types');
    }
    
    // Test 1.3: Cache metrics accuracy
    console.log('  🧪 Test 1.3: Cache metrics accuracy');
    testResults.pipelineRegistryCache.correctness.tests++;
    
    const metrics1 = registry.getMetrics();
    const totalLoads = metrics1.totalLoads;
    const cacheHits = metrics1.cacheHits;
    
    // Load one more to test metrics update
    await registry.loadPipeline('mediapipe-face');
    const metrics2 = registry.getMetrics();
    
    if (metrics2.totalLoads === totalLoads + 1 && metrics2.cacheHits === cacheHits + 1) {
      console.log('    ✅ Cache metrics updating correctly');
      testResults.pipelineRegistryCache.correctness.passed++;
    } else {
      console.log(`    ❌ Cache metrics not accurate: loads ${metrics2.totalLoads} vs expected ${totalLoads + 1}`);
      testResults.pipelineRegistryCache.correctness.issues.push('Cache metrics not tracking correctly');
    }
    
    // Test 2: Cache Performance Tests
    console.log('\n⚡ Test Suite 2: Cache Performance...');
    
    // Test 2.1: Cache speed improvement
    console.log('  🧪 Test 2.1: Cache performance improvement');
    testResults.pipelineRegistryCache.performance.tests++;
    
    registry.clearCache();
    
    // Measure cold load
    const coldStart = Date.now();
    await registry.loadPipeline('age-estimation');
    const coldTime = Date.now() - coldStart;
    
    // Measure warm load
    const warmStart = Date.now();
    await registry.loadPipeline('age-estimation');
    const warmTime = Date.now() - warmStart;
    
    const speedup = coldTime / Math.max(warmTime, 0.1);
    console.log(`    📊 Cold: ${coldTime}ms, Warm: ${warmTime}ms, Speedup: ${speedup.toFixed(1)}x`);
    
    if (speedup >= 2.0) {  // At least 2x speedup expected
      console.log('    ✅ Cache provides significant performance improvement');
      testResults.pipelineRegistryCache.performance.passed++;
    } else {
      console.log('    ⚠️  Cache speedup lower than expected');
      testResults.pipelineRegistryCache.performance.issues.push(`Cache speedup only ${speedup.toFixed(1)}x (expected >= 2x)`);
    }
    
    // Test 2.2: Bulk loading performance
    console.log('  🧪 Test 2.2: Bulk loading performance with cache');
    testResults.pipelineRegistryCache.performance.tests++;
    
    registry.clearCache();
    const availableTypes = registry.getAvailablePipelineTypes();
    
    // First bulk load (cold)
    const bulkColdStart = Date.now();
    const coldPromises = availableTypes.map(type => registry.loadPipeline(type));
    await Promise.all(coldPromises);
    const bulkColdTime = Date.now() - bulkColdStart;
    
    // Second bulk load (warm - should be much faster)
    const bulkWarmStart = Date.now();
    const warmPromises = availableTypes.map(type => registry.loadPipeline(type));
    await Promise.all(warmPromises);
    const bulkWarmTime = Date.now() - bulkWarmStart;
    
    const bulkSpeedup = bulkColdTime / Math.max(bulkWarmTime, 0.1);
    console.log(`    📊 Bulk Cold: ${bulkColdTime}ms, Bulk Warm: ${bulkWarmTime}ms, Speedup: ${bulkSpeedup.toFixed(1)}x`);
    
    if (bulkSpeedup >= 5.0) {  // Should be very fast for bulk cache hits
      console.log('    ✅ Bulk cache performance excellent');
      testResults.pipelineRegistryCache.performance.passed++;
    } else {
      console.log('    ⚠️  Bulk cache performance suboptimal');
      testResults.pipelineRegistryCache.performance.issues.push(`Bulk cache speedup only ${bulkSpeedup.toFixed(1)}x (expected >= 5x)`);
    }
    
    // Test 3: Cache Stress Tests
    console.log('\n🏋️ Test Suite 3: Cache Stress Testing...');
    
    // Test 3.1: High-frequency access
    console.log('  🧪 Test 3.1: High-frequency cache access');
    testResults.pipelineRegistryCache.stress.tests++;
    
    const highFreqStart = Date.now();
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      await registry.loadPipeline('mediapipe-face');
    }
    
    const highFreqTime = Date.now() - highFreqStart;
    const avgPerAccess = highFreqTime / iterations;
    
    console.log(`    📊 ${iterations} cache hits in ${highFreqTime}ms (${avgPerAccess.toFixed(2)}ms avg)`);
    
    if (avgPerAccess < 5) {  // Should be very fast for cache hits
      console.log('    ✅ High-frequency cache access performant');
      testResults.pipelineRegistryCache.stress.passed++;
    } else {
      console.log('    ⚠️  High-frequency cache access slow');
      testResults.pipelineRegistryCache.stress.issues.push(`Average cache access time ${avgPerAccess.toFixed(2)}ms (expected < 5ms)`);
    }
    
    // Test 3.2: Cache size limit enforcement under stress
    console.log('  🧪 Test 3.2: Cache size limit enforcement under stress');
    testResults.pipelineRegistryCache.stress.tests++;
    
    const stressRegistry = createLazyPipelineRegistry({
      cacheSize: 2,  // Very small cache
      preloadCritical: false
    });
    
    const stressTypes = stressRegistry.getAvailablePipelineTypes();
    
    // Load more pipelines than cache size multiple times
    for (let round = 0; round < 3; round++) {
      for (const type of stressTypes) {
        await stressRegistry.loadPipeline(type);
      }
    }
    
    const stressMetrics = stressRegistry.getMetrics();
    console.log(`    📊 Final cache size: ${stressMetrics.loadedCount}, Limit: 2`);
    
    if (stressMetrics.loadedCount <= 2) {
      console.log('    ✅ Cache size limit enforced under stress');
      testResults.pipelineRegistryCache.stress.passed++;
    } else {
      console.log('    ❌ Cache size limit violated under stress');
      testResults.pipelineRegistryCache.stress.issues.push(`Cache size ${stressMetrics.loadedCount} exceeded limit of 2 under stress`);
    }
    
    // Test 3.3: Concurrent access stress test
    console.log('  🧪 Test 3.3: Concurrent cache access stress test');
    testResults.pipelineRegistryCache.stress.tests++;
    
    const concurrentRegistry = createLazyPipelineRegistry({
      cacheSize: 10,
      preloadCritical: false
    });
    
    const concurrentStart = Date.now();
    const concurrentCount = 50;
    const concurrentPipeline = 'mediapipe-face';
    
    // Launch many concurrent requests
    const concurrentPromises = Array.from({ length: concurrentCount }, () => 
      concurrentRegistry.loadPipeline(concurrentPipeline)
    );
    
    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    
    const successful = concurrentResults.filter(r => r.status === 'fulfilled');
    const firstFactory = successful[0]?.value;
    const allSame = successful.every(r => r.value === firstFactory);
    
    console.log(`    📊 ${successful.length}/${concurrentCount} concurrent requests in ${concurrentTime}ms`);
    console.log(`    📊 All same factory: ${allSame}`);
    
    if (successful.length === concurrentCount && allSame) {
      console.log('    ✅ Concurrent cache access working correctly');
      testResults.pipelineRegistryCache.stress.passed++;
    } else {
      console.log('    ❌ Concurrent cache access issues');
      testResults.pipelineRegistryCache.stress.issues.push(`Concurrent cache access: ${successful.length}/${concurrentCount} successful, consistent: ${allSame}`);
    }
    
    // =====================================================
    // RESULTS COMPILATION
    // =====================================================
    
    // Calculate totals
    const allCategories = ['correctness', 'performance', 'stress'];
    let totalTests = 0, totalPassed = 0, totalIssues = [];
    
    allCategories.forEach(category => {
      const categoryResult = testResults.pipelineRegistryCache[category];
      totalTests += categoryResult.tests;
      totalPassed += categoryResult.passed;
      totalIssues = totalIssues.concat(categoryResult.issues);
    });
    
    testResults.overallResults = { totalTests, totalPassed, totalIssues };
    
    // Print detailed results
    console.log('\n🎯 CACHE PERFORMANCE & CORRECTNESS SUMMARY');
    console.log('=' * 55);
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Tests Passed: ${totalPassed}`);
    console.log(`❌ Issues Found: ${totalIssues.length}`);
    console.log(`🏆 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n📋 DETAILED BREAKDOWN:');
    allCategories.forEach(category => {
      const result = testResults.pipelineRegistryCache[category];
      const rate = result.tests > 0 ? ((result.passed / result.tests) * 100).toFixed(1) : '0';
      console.log(`  ${category}: ${result.passed}/${result.tests} (${rate}%)`);
    });
    
    if (totalIssues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      totalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    // Performance Summary
    const finalMetrics = registry.getMetrics();
    console.log('\n📈 FINAL CACHE METRICS:');
    console.log(`- Total loads: ${finalMetrics.totalLoads}`);
    console.log(`- Cache hits: ${finalMetrics.cacheHits}`);
    console.log(`- Cache hit rate: ${finalMetrics.cacheHitRate.toFixed(1)}%`);
    console.log(`- Success rate: ${finalMetrics.successRate.toFixed(1)}%`);
    console.log(`- Average load time: ${finalMetrics.averageLoadTime.toFixed(1)}ms`);
    
    const overallSuccess = totalIssues.length === 0;
    console.log(`\n🏆 Overall Status: ${overallSuccess ? 'ALL CACHE TESTS PASSED' : 'CACHE ISSUES FOUND'}`);
    
    return {
      success: overallSuccess,
      results: testResults,
      summary: {
        totalTests,
        totalPassed,
        totalIssues: totalIssues.length,
        successRate: (totalPassed / totalTests) * 100,
        finalMetrics
      }
    };
    
  } catch (error) {
    console.error('❌ Cache performance test failed:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      results: testResults
    };
  }
};

// Run the comprehensive cache performance test
testCachePerformanceAndCorrectness().then(result => {
  if (result.success) {
    console.log('\n🎉 Cache performance and correctness tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n🔧 Cache performance tests found issues that need attention');
    process.exit(1);
  }
});