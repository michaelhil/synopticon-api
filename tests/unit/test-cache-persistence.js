/**
 * Cache Persistence and Recovery Mechanisms Test Suite
 * Tests how caching systems handle persistence, recovery, and failure scenarios
 */

import { createLazyPipelineRegistry } from '../../src/core/lazy-pipeline-registry.js';

const testCachePersistenceAndRecovery = async () => {
  console.log('💾 Testing cache persistence and recovery mechanisms...\n');
  
  const testResults = {
    memoryPersistence: { tests: 0, passed: 0, issues: [] },
    failureRecovery: { tests: 0, passed: 0, issues: [] },
    stateConsistency: { tests: 0, passed: 0, issues: [] },
    memoryLeaks: { tests: 0, passed: 0, issues: [] },
    overall: { totalTests: 0, totalPassed: 0, totalIssues: [] }
  };

  try {
    // =====================================================
    // TEST SUITE 1: MEMORY PERSISTENCE
    // =====================================================
    
    console.log('🧠 Test Suite 1: Memory Persistence...');
    
    // Test 1.1: Cache state preservation across operations
    console.log('  🧪 Test 1.1: Cache state preservation');
    testResults.memoryPersistence.tests++;
    
    const registry1 = createLazyPipelineRegistry({ 
      cacheSize: 5, 
      preloadCritical: false 
    });
    
    // Load several pipelines
    await registry1.loadPipeline('mediapipe-face');
    await registry1.loadPipeline('emotion-analysis');
    await registry1.loadPipeline('age-estimation');
    
    const beforeMetrics = registry1.getMetrics();
    console.log(`    📊 Before: ${beforeMetrics.loadedCount} cached, ${beforeMetrics.successfulLoads} successful loads`);
    
    // Perform additional operations
    await registry1.loadPipeline('mediapipe-face'); // Cache hit
    await registry1.loadPipeline('iris-tracking');  // New load
    
    const afterMetrics = registry1.getMetrics();
    console.log(`    📊 After: ${afterMetrics.loadedCount} cached, ${afterMetrics.successfulLoads} successful loads`);
    
    if (afterMetrics.loadedCount >= beforeMetrics.loadedCount && 
        afterMetrics.successfulLoads > beforeMetrics.successfulLoads) {
      console.log('    ✅ Cache state properly preserved across operations');
      testResults.memoryPersistence.passed++;
    } else {
      console.log('    ❌ Cache state not preserved correctly');
      testResults.memoryPersistence.issues.push('Cache state not preserved across operations');
    }
    
    // Test 1.2: Cache isolation between registry instances
    console.log('  🧪 Test 1.2: Cache isolation between instances');
    testResults.memoryPersistence.tests++;
    
    const registry2 = createLazyPipelineRegistry({ 
      cacheSize: 3, 
      preloadCritical: false 
    });
    
    const registry1Loaded = registry1.getLoadedPipelineTypes();
    const registry2Loaded = registry2.getLoadedPipelineTypes();
    
    console.log(`    📊 Registry1 loaded: [${registry1Loaded.join(', ')}]`);
    console.log(`    📊 Registry2 loaded: [${registry2Loaded.join(', ')}]`);
    
    if (registry2Loaded.length === 0 && registry1Loaded.length > 0) {
      console.log('    ✅ Cache isolation working correctly');
      testResults.memoryPersistence.passed++;
    } else {
      console.log('    ❌ Cache isolation failed - instances sharing state');
      testResults.memoryPersistence.issues.push('Cache instances not properly isolated');
    }
    
    // Test 1.3: Cache data integrity
    console.log('  🧪 Test 1.3: Cache data integrity validation');
    testResults.memoryPersistence.tests++;
    
    const originalFactory = await registry1.loadPipeline('mediapipe-face');
    const cachedFactory = await registry1.loadPipeline('mediapipe-face');
    
    // Verify same reference and function integrity
    const sameReference = originalFactory === cachedFactory;
    const isFunction = typeof cachedFactory === 'function';
    
    console.log(`    📊 Same reference: ${sameReference}, Is function: ${isFunction}`);
    
    if (sameReference && isFunction) {
      console.log('    ✅ Cache data integrity maintained');
      testResults.memoryPersistence.passed++;
    } else {
      console.log('    ❌ Cache data integrity compromised');
      testResults.memoryPersistence.issues.push('Cache data integrity issues detected');
    }
    
    console.log(`  📊 Memory Persistence: ${testResults.memoryPersistence.passed}/${testResults.memoryPersistence.tests} tests passed`);
    
    // =====================================================
    // TEST SUITE 2: FAILURE RECOVERY
    // =====================================================
    
    console.log('\n🛠️  Test Suite 2: Failure Recovery...');
    
    // Test 2.1: Recovery from failed loads
    console.log('  🧪 Test 2.1: Recovery from failed pipeline loads');
    testResults.failureRecovery.tests++;
    
    const recoveryRegistry = createLazyPipelineRegistry({ 
      cacheSize: 5, 
      preloadCritical: false,
      maxRetries: 2
    });
    
    // Try to load a non-existent pipeline (should fail)
    try {
      await recoveryRegistry.loadPipeline('non-existent-pipeline');
      console.log('    ❌ Expected failure for non-existent pipeline');
      testResults.failureRecovery.issues.push('Non-existent pipeline load should have failed');
    } catch (error) {
      console.log(`    ✅ Failed pipeline load handled correctly: ${error.message}`);
      
      // Verify registry can still load valid pipelines after failure
      try {
        await recoveryRegistry.loadPipeline('mediapipe-face');
        console.log('    ✅ Registry recovered successfully after failed load');
        testResults.failureRecovery.passed++;
      } catch (recoveryError) {
        console.log('    ❌ Registry did not recover after failed load');
        testResults.failureRecovery.issues.push('Registry did not recover after failed load');
      }
    }
    
    // Test 2.2: Cache consistency after partial failures
    console.log('  🧪 Test 2.2: Cache consistency after partial failures');
    testResults.failureRecovery.tests++;
    
    const partialRegistry = createLazyPipelineRegistry({ 
      cacheSize: 3, 
      preloadCritical: false 
    });
    
    // Load some successful pipelines
    await partialRegistry.loadPipeline('emotion-analysis');
    await partialRegistry.loadPipeline('age-estimation');
    
    const beforeFailureMetrics = partialRegistry.getMetrics();
    
    // Try to load invalid pipeline
    try {
      await partialRegistry.loadPipeline('invalid-pipeline');
    } catch (error) {
      // Expected failure
    }
    
    const afterFailureMetrics = partialRegistry.getMetrics();
    console.log(`    📊 Cache state after failure: ${afterFailureMetrics.loadedCount} loaded`);
    
    // Verify successful pipelines are still cached
    const emotionFactory1 = await partialRegistry.loadPipeline('emotion-analysis');
    const emotionFactory2 = await partialRegistry.loadPipeline('emotion-analysis');
    
    if (emotionFactory1 === emotionFactory2 && 
        afterFailureMetrics.loadedCount === beforeFailureMetrics.loadedCount) {
      console.log('    ✅ Cache consistency maintained after partial failures');
      testResults.failureRecovery.passed++;
    } else {
      console.log('    ❌ Cache consistency lost after partial failures');
      testResults.failureRecovery.issues.push('Cache consistency lost after partial failures');
    }
    
    // Test 2.3: Retry mechanism validation (testing validation vs retry behavior)
    console.log('  🧪 Test 2.3: Retry vs validation behavior');
    testResults.failureRecovery.tests++;
    
    const retryRegistry = createLazyPipelineRegistry({ 
      cacheSize: 3, 
      preloadCritical: false,
      maxRetries: 3,
      retryDelay: 100
    });
    
    const startTime = Date.now();
    
    try {
      await retryRegistry.loadPipeline('non-existent-retry-test');
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.log(`    📊 Total time: ${totalTime}ms`);
      console.log(`    📊 Error type: validation failure`);
      
      // Validation failures should NOT trigger retries - they should fail immediately
      // This is correct behavior - invalid pipeline types shouldn't be retried
      if (totalTime < 50 && error.message.includes('Unknown pipeline type')) {
        console.log('    ✅ Validation failures correctly bypass retry mechanism');
        testResults.failureRecovery.passed++;
      } else {
        console.log('    ⚠️  Unexpected behavior for validation failures');
        testResults.failureRecovery.issues.push('Validation failure behavior unexpected');
      }
    }
    
    console.log(`  📊 Failure Recovery: ${testResults.failureRecovery.passed}/${testResults.failureRecovery.tests} tests passed`);
    
    // =====================================================
    // TEST SUITE 3: STATE CONSISTENCY
    // =====================================================
    
    console.log('\n⚖️  Test Suite 3: State Consistency...');
    
    // Test 3.1: Metrics consistency
    console.log('  🧪 Test 3.1: Metrics consistency validation');
    testResults.stateConsistency.tests++;
    
    const metricsRegistry = createLazyPipelineRegistry({ 
      cacheSize: 4, 
      preloadCritical: false 
    });
    
    // Perform known operations and verify metrics
    await metricsRegistry.loadPipeline('mediapipe-face');     // Load 1
    await metricsRegistry.loadPipeline('emotion-analysis');  // Load 2
    await metricsRegistry.loadPipeline('mediapipe-face');     // Cache hit 1
    await metricsRegistry.loadPipeline('age-estimation');    // Load 3
    await metricsRegistry.loadPipeline('emotion-analysis');  // Cache hit 2
    
    const finalMetrics = metricsRegistry.getMetrics();
    console.log(`    📊 Total loads: ${finalMetrics.totalLoads} (expected: 5)`);
    console.log(`    📊 Cache hits: ${finalMetrics.cacheHits} (expected: 2)`);
    console.log(`    📊 Successful loads: ${finalMetrics.successfulLoads} (expected: 3)`);
    console.log(`    📊 Cache hit rate: ${finalMetrics.cacheHitRate.toFixed(1)}% (expected: 40%)`);
    
    const expectedHitRate = (2 / 5) * 100; // 2 cache hits out of 5 total loads
    const hitRateOK = Math.abs(finalMetrics.cacheHitRate - expectedHitRate) < 1;
    
    if (finalMetrics.totalLoads === 5 && 
        finalMetrics.cacheHits === 2 && 
        finalMetrics.successfulLoads === 3 && 
        hitRateOK) {
      console.log('    ✅ Metrics consistency validated');
      testResults.stateConsistency.passed++;
    } else {
      console.log('    ❌ Metrics inconsistency detected');
      testResults.stateConsistency.issues.push('Metrics not consistent with expected values');
    }
    
    // Test 3.2: Cache state after clearing operations
    console.log('  🧪 Test 3.2: Cache state after clearing operations');
    testResults.stateConsistency.tests++;
    
    const clearRegistry = createLazyPipelineRegistry({ 
      cacheSize: 3, 
      preloadCritical: false 
    });
    
    // Load pipelines
    await clearRegistry.loadPipeline('mediapipe-face');
    await clearRegistry.loadPipeline('emotion-analysis');
    
    const beforeClear = clearRegistry.getMetrics();
    
    // Clear cache
    clearRegistry.clearCache();
    
    const afterClear = clearRegistry.getMetrics();
    
    // Load again (should be fresh load with proper metrics reset)
    await clearRegistry.loadPipeline('mediapipe-face');
    
    const afterReload = clearRegistry.getMetrics();
    
    console.log(`    📊 Before clear: ${beforeClear.loadedCount} cached`);
    console.log(`    📊 After clear: ${afterClear.loadedCount} cached`);
    console.log(`    📊 After reload: ${afterReload.loadedCount} cached`);
    console.log(`    📊 After reload metrics: ${afterReload.totalLoads} loads, ${afterReload.cacheHits} hits`);
    
    // After clearing and reloading, we should have 1 cached item and metrics should show fresh state
    if (afterClear.loadedCount === 0 && 
        afterReload.loadedCount === 1 && 
        afterReload.totalLoads === 1 && 
        afterReload.cacheHits === 0) { // Should be fresh load, no cache hits after clear
      console.log('    ✅ Cache state consistent after clearing');
      testResults.stateConsistency.passed++;
    } else {
      console.log('    ❌ Cache state inconsistent after clearing');
      testResults.stateConsistency.issues.push('Cache state inconsistent after clearing operations');
    }
    
    // Test 3.3: State consistency during high load
    console.log('  🧪 Test 3.3: State consistency during high load');
    testResults.stateConsistency.tests++;
    
    const highLoadRegistry = createLazyPipelineRegistry({ 
      cacheSize: 2, 
      preloadCritical: false 
    });
    
    // Pre-load the two pipeline types to ensure they're cached
    await highLoadRegistry.loadPipeline('mediapipe-face');
    await highLoadRegistry.loadPipeline('emotion-analysis');
    
    const preLoadMetrics = highLoadRegistry.getMetrics();
    console.log(`    📊 Pre-load state: ${preLoadMetrics.loadedCount} cached, ${preLoadMetrics.totalLoads} loads`);
    
    const loadPromises = [];
    
    // Create high concurrent load on already-cached pipelines
    for (let i = 0; i < 48; i++) { // 48 more requests (2 initial + 48 = 50 total)
      const pipelineType = i % 2 === 0 ? 'mediapipe-face' : 'emotion-analysis';
      loadPromises.push(highLoadRegistry.loadPipeline(pipelineType));
    }
    
    const results = await Promise.allSettled(loadPromises);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    const highLoadMetrics = highLoadRegistry.getMetrics();
    console.log(`    📊 High load results: ${successful.length}/48 concurrent successful`);
    console.log(`    📊 Final cache size: ${highLoadMetrics.loadedCount}`);
    console.log(`    📊 Total loads: ${highLoadMetrics.totalLoads}, Cache hits: ${highLoadMetrics.cacheHits}`);
    console.log(`    📊 Cache hit rate: ${highLoadMetrics.cacheHitRate.toFixed(1)}%`);
    
    // All 48 concurrent loads should be cache hits since pipelines were pre-loaded
    const expectedTotalLoads = 50; // 2 initial + 48 concurrent
    const expectedCacheHits = 48;  // 48 concurrent should be cache hits
    const expectedConcurrentHitRate = (expectedCacheHits / expectedTotalLoads) * 100; // 96%
    
    if (successful.length === 48 && 
        highLoadMetrics.loadedCount === 2 && 
        highLoadMetrics.cacheHitRate >= 90) { // Should be ~96% hit rate
      console.log('    ✅ State consistency maintained during high load');
      testResults.stateConsistency.passed++;
    } else {
      console.log('    ❌ State consistency issues during high load');
      testResults.stateConsistency.issues.push('State consistency issues during high concurrent load');
    }
    
    console.log(`  📊 State Consistency: ${testResults.stateConsistency.passed}/${testResults.stateConsistency.tests} tests passed`);
    
    // =====================================================
    // TEST SUITE 4: MEMORY LEAK DETECTION
    // =====================================================
    
    console.log('\n🔍 Test Suite 4: Memory Leak Detection...');
    
    // Test 4.1: Cache cleanup validation
    console.log('  🧪 Test 4.1: Cache cleanup validation');
    testResults.memoryLeaks.tests++;
    
    const cleanupRegistry = createLazyPipelineRegistry({ 
      cacheSize: 2, 
      preloadCritical: false 
    });
    
    // Load many pipelines to trigger evictions
    const availableTypes = cleanupRegistry.getAvailablePipelineTypes();
    
    for (const type of availableTypes) {
      await cleanupRegistry.loadPipeline(type);
    }
    
    const cleanupMetrics = cleanupRegistry.getMetrics();
    console.log(`    📊 Cache size after loading ${availableTypes.length} types: ${cleanupMetrics.loadedCount}`);
    
    if (cleanupMetrics.loadedCount === 2) {
      console.log('    ✅ Cache cleanup working - size limit enforced');
      testResults.memoryLeaks.passed++;
    } else {
      console.log('    ❌ Cache cleanup failed - memory leak potential');
      testResults.memoryLeaks.issues.push('Cache not properly cleaning up old entries');
    }
    
    // Test 4.2: Reference cleanup after cache clear
    console.log('  🧪 Test 4.2: Reference cleanup after cache clear');
    testResults.memoryLeaks.tests++;
    
    const refRegistry = createLazyPipelineRegistry({ 
      cacheSize: 5, 
      preloadCritical: false 
    });
    
    // Load and cache some pipelines
    await refRegistry.loadPipeline('mediapipe-face');
    await refRegistry.loadPipeline('emotion-analysis');
    
    const beforeClearCount = refRegistry.getLoadedPipelineTypes().length;
    
    // Clear cache
    refRegistry.clearCache();
    
    const afterClearCount = refRegistry.getLoadedPipelineTypes().length;
    const clearedMetrics = refRegistry.getMetrics();
    
    console.log(`    📊 Before clear: ${beforeClearCount} types`);
    console.log(`    📊 After clear: ${afterClearCount} types`);
    console.log(`    📊 Metrics after clear: ${clearedMetrics.loadedCount} loaded`);
    
    if (afterClearCount === 0 && clearedMetrics.loadedCount === 0) {
      console.log('    ✅ Reference cleanup working correctly');
      testResults.memoryLeaks.passed++;
    } else {
      console.log('    ❌ Reference cleanup incomplete - potential memory leak');
      testResults.memoryLeaks.issues.push('References not properly cleaned up after cache clear');
    }
    
    console.log(`  📊 Memory Leak Detection: ${testResults.memoryLeaks.passed}/${testResults.memoryLeaks.tests} tests passed`);
    
    // =====================================================
    // RESULTS COMPILATION
    // =====================================================
    
    const categories = ['memoryPersistence', 'failureRecovery', 'stateConsistency', 'memoryLeaks'];
    let totalTests = 0, totalPassed = 0, totalIssues = [];
    
    categories.forEach(category => {
      const result = testResults[category];
      totalTests += result.tests;
      totalPassed += result.passed;
      totalIssues = totalIssues.concat(result.issues);
    });
    
    testResults.overall = { totalTests, totalPassed, totalIssues };
    
    console.log('\n🎯 CACHE PERSISTENCE & RECOVERY SUMMARY');
    console.log('=' * 55);
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Tests Passed: ${totalPassed}`);
    console.log(`❌ Issues Found: ${totalIssues.length}`);
    console.log(`🏆 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n📋 CATEGORY BREAKDOWN:');
    categories.forEach(category => {
      const result = testResults[category];
      const rate = ((result.passed / result.tests) * 100).toFixed(1);
      console.log(`  ${category}: ${result.passed}/${result.tests} (${rate}%)`);
    });
    
    if (totalIssues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      totalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    const overallSuccess = totalIssues.length === 0;
    console.log(`\n🏆 Overall Status: ${overallSuccess ? 'ALL PERSISTENCE TESTS PASSED' : 'PERSISTENCE ISSUES FOUND'}`);
    
    return {
      success: overallSuccess,
      results: testResults,
      summary: {
        totalTests,
        totalPassed,
        totalIssues: totalIssues.length,
        successRate: (totalPassed / totalTests) * 100
      }
    };
    
  } catch (error) {
    console.error('❌ Cache persistence test failed:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      results: testResults
    };
  }
};

// Run cache persistence and recovery testing
testCachePersistenceAndRecovery().then(result => {
  if (result.success) {
    console.log('\n🎉 Cache persistence and recovery tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n🔧 Cache persistence tests found issues that need attention');
    process.exit(1);
  }
});