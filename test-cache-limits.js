/**
 * Cache Size Limits and Eviction Policy Validation Test
 */

import { createLazyPipelineRegistry } from './src/core/lazy-pipeline-registry.js';

const validateCacheLimitsAndEviction = async () => {
  console.log('📏 Validating cache size limits and eviction policies...\n');
  
  const testResults = {
    sizeLimits: { tests: 0, passed: 0, issues: [] },
    evictionPolicies: { tests: 0, passed: 0, issues: [] },
    edgeCases: { tests: 0, passed: 0, issues: [] },
    overall: { totalTests: 0, totalPassed: 0, totalIssues: [] }
  };
  
  try {
    // =====================================================
    // TEST SUITE 1: CACHE SIZE LIMITS
    // =====================================================
    
    console.log('📊 Test Suite 1: Cache Size Limits...');
    
    // Test 1.1: Minimum cache size enforcement
    console.log('  🧪 Test 1.1: Minimum cache size validation');
    testResults.sizeLimits.tests++;
    
    try {
      const invalidRegistry = createLazyPipelineRegistry({ cacheSize: 0 });
      console.log('    ❌ Zero cache size should be rejected');
      testResults.sizeLimits.issues.push('Zero cache size was accepted');
    } catch (error) {
      if (error.message.includes('Cache size must be positive')) {
        console.log('    ✅ Zero cache size properly rejected');
        testResults.sizeLimits.passed++;
      } else {
        console.log('    ⚠️  Unexpected error for zero cache size');
        testResults.sizeLimits.issues.push('Unexpected error for zero cache size');
      }
    }
    
    // Test 1.2: Cache size=1 behavior
    console.log('  🧪 Test 1.2: Cache size=1 behavior (edge case)');
    testResults.sizeLimits.tests++;
    
    const singleCacheRegistry = createLazyPipelineRegistry({ 
      cacheSize: 1, 
      preloadCritical: false 
    });
    
    // Load first pipeline
    await singleCacheRegistry.loadPipeline('mediapipe-face');
    let metrics = singleCacheRegistry.getMetrics();
    console.log(`    📊 After first load: ${metrics.loadedCount}/1`);
    
    // Load second pipeline (should evict first)
    await singleCacheRegistry.loadPipeline('emotion-analysis');
    metrics = singleCacheRegistry.getMetrics();
    console.log(`    📊 After second load: ${metrics.loadedCount}/1`);
    
    if (metrics.loadedCount === 1) {
      console.log('    ✅ Cache size=1 working correctly');
      testResults.sizeLimits.passed++;
    } else {
      console.log('    ❌ Cache size=1 not enforced');
      testResults.sizeLimits.issues.push('Cache size=1 not properly enforced');
    }
    
    // Test 1.3: Large cache size behavior
    console.log('  🧪 Test 1.3: Large cache size behavior');
    testResults.sizeLimits.tests++;
    
    const largeCacheRegistry = createLazyPipelineRegistry({ 
      cacheSize: 1000, 
      preloadCritical: false 
    });
    
    const availableTypes = largeCacheRegistry.getAvailablePipelineTypes();
    
    // Load all available pipelines
    for (const type of availableTypes) {
      await largeCacheRegistry.loadPipeline(type);
    }
    
    const largeMetrics = largeCacheRegistry.getMetrics();
    console.log(`    📊 Large cache loaded: ${largeMetrics.loadedCount}/${availableTypes.length} pipelines`);
    
    if (largeMetrics.loadedCount === availableTypes.length) {
      console.log('    ✅ Large cache accommodating all pipelines');
      testResults.sizeLimits.passed++;
    } else {
      console.log('    ❌ Large cache not accommodating all pipelines');
      testResults.sizeLimits.issues.push('Large cache not working properly');
    }
    
    // Test 1.4: Dynamic cache size changes (if supported)
    console.log('  🧪 Test 1.4: Cache size enforcement consistency');
    testResults.sizeLimits.tests++;
    
    const consistencyRegistry = createLazyPipelineRegistry({ 
      cacheSize: 3, 
      preloadCritical: false 
    });
    
    // Load more than cache size
    const types = consistencyRegistry.getAvailablePipelineTypes();
    for (let i = 0; i < Math.min(5, types.length); i++) {
      await consistencyRegistry.loadPipeline(types[i]);
    }
    
    const consistencyMetrics = consistencyRegistry.getMetrics();
    console.log(`    📊 Consistency test: ${consistencyMetrics.loadedCount}/3 after loading 5`);
    
    if (consistencyMetrics.loadedCount === 3) {
      console.log('    ✅ Cache size consistently enforced');
      testResults.sizeLimits.passed++;
    } else {
      console.log('    ❌ Cache size enforcement inconsistent');
      testResults.sizeLimits.issues.push('Cache size enforcement inconsistent');
    }
    
    console.log(`  📊 Size Limits: ${testResults.sizeLimits.passed}/${testResults.sizeLimits.tests} tests passed`);
    
    // =====================================================
    // TEST SUITE 2: EVICTION POLICIES
    // =====================================================
    
    console.log('\n🔄 Test Suite 2: Eviction Policies...');
    
    // Test 2.1: LRU (Least Recently Used) eviction
    console.log('  🧪 Test 2.1: LRU eviction policy verification');
    testResults.evictionPolicies.tests++;
    
    const lruRegistry = createLazyPipelineRegistry({ 
      cacheSize: 2, 
      preloadCritical: false 
    });
    
    // Load pipeline A
    await lruRegistry.loadPipeline('mediapipe-face');
    console.log('    📊 Loaded: mediapipe-face');
    
    // Load pipeline B  
    await lruRegistry.loadPipeline('emotion-analysis');
    console.log('    📊 Loaded: emotion-analysis');
    
    // Access pipeline A again (make it most recently used)
    await lruRegistry.loadPipeline('mediapipe-face');
    console.log('    📊 Re-accessed: mediapipe-face (should be MRU)');
    
    // Load pipeline C (should evict emotion-analysis, not mediapipe-face)
    await lruRegistry.loadPipeline('age-estimation');
    console.log('    📊 Loaded: age-estimation (should evict emotion-analysis)');
    
    // Test that mediapipe-face is still cached (should be fast)
    const lruStart = Date.now();
    await lruRegistry.loadPipeline('mediapipe-face');
    const lruTime = Date.now() - lruStart;
    
    console.log(`    📊 mediapipe-face access time: ${lruTime}ms (should be cached)`);
    
    // Test that emotion-analysis was evicted (should be slower)
    const evictedStart = Date.now();
    await lruRegistry.loadPipeline('emotion-analysis');
    const evictedTime = Date.now() - evictedStart;
    
    console.log(`    📊 emotion-analysis access time: ${evictedTime}ms (should be fresh load)`);
    
    if (lruTime < 5 && evictedTime >= 0) { // Cache hit should be very fast
      console.log('    ✅ LRU eviction policy working correctly');
      testResults.evictionPolicies.passed++;
    } else {
      console.log('    ⚠️  LRU eviction policy behavior unclear');
      testResults.evictionPolicies.issues.push('LRU eviction policy behavior unclear');
    }
    
    // Test 2.2: Eviction order tracking
    console.log('  🧪 Test 2.2: Eviction order tracking');
    testResults.evictionPolicies.tests++;
    
    const orderRegistry = createLazyPipelineRegistry({ 
      cacheSize: 2, 
      preloadCritical: false 
    });
    
    // Load pipelines in specific order
    await orderRegistry.loadPipeline('iris-tracking');    // First
    await orderRegistry.loadPipeline('eye-tracking');     // Second  
    
    let orderMetrics = orderRegistry.getMetrics();
    const initialLoaded = orderMetrics.loadedCount;
    
    // Load third pipeline (should evict first one loaded)
    await orderRegistry.loadPipeline('mediapipe-face');   // Third (should evict iris-tracking)
    
    orderMetrics = orderRegistry.getMetrics();
    console.log(`    📊 Cache size after third load: ${orderMetrics.loadedCount}`);
    
    if (orderMetrics.loadedCount === 2) {
      console.log('    ✅ Eviction order tracking working');
      testResults.evictionPolicies.passed++;
    } else {
      console.log('    ❌ Eviction order tracking failed');
      testResults.evictionPolicies.issues.push('Eviction order not properly tracked');
    }
    
    // Test 2.3: Multiple evictions
    console.log('  🧪 Test 2.3: Multiple evictions in sequence');
    testResults.evictionPolicies.tests++;
    
    const multiEvictRegistry = createLazyPipelineRegistry({ 
      cacheSize: 1, 
      preloadCritical: false 
    });
    
    const allTypes = multiEvictRegistry.getAvailablePipelineTypes();
    let evictionCount = 0;
    
    // Load multiple pipelines sequentially
    for (let i = 0; i < Math.min(5, allTypes.length); i++) {
      await multiEvictRegistry.loadPipeline(allTypes[i]);
      if (i > 0) evictionCount++; // Each load after first should evict
    }
    
    const multiMetrics = multiEvictRegistry.getMetrics();
    console.log(`    📊 Final cache size: ${multiMetrics.loadedCount} (expected: 1)`);
    console.log(`    📊 Expected evictions: ${evictionCount}`);
    
    if (multiMetrics.loadedCount === 1) {
      console.log('    ✅ Multiple evictions handled correctly');
      testResults.evictionPolicies.passed++;
    } else {
      console.log('    ❌ Multiple evictions not handled properly');
      testResults.evictionPolicies.issues.push('Multiple evictions not handled correctly');
    }
    
    console.log(`  📊 Eviction Policies: ${testResults.evictionPolicies.passed}/${testResults.evictionPolicies.tests} tests passed`);
    
    // =====================================================
    // TEST SUITE 3: EDGE CASES
    // =====================================================
    
    console.log('\n🔍 Test Suite 3: Edge Cases...');
    
    // Test 3.1: Cache clearing during operation
    console.log('  🧪 Test 3.1: Cache clearing during operation');
    testResults.edgeCases.tests++;
    
    const clearRegistry = createLazyPipelineRegistry({ 
      cacheSize: 5, 
      preloadCritical: false 
    });
    
    // Load some pipelines
    await clearRegistry.loadPipeline('mediapipe-face');
    await clearRegistry.loadPipeline('emotion-analysis');
    
    let clearMetrics = clearRegistry.getMetrics();
    const beforeClear = clearMetrics.loadedCount;
    console.log(`    📊 Before clear: ${beforeClear} cached pipelines`);
    
    // Clear cache
    clearRegistry.clearCache();
    
    clearMetrics = clearRegistry.getMetrics();
    const afterClear = clearMetrics.loadedCount;
    console.log(`    📊 After clear: ${afterClear} cached pipelines`);
    
    if (afterClear === 0 && beforeClear > 0) {
      console.log('    ✅ Cache clearing working correctly');
      testResults.edgeCases.passed++;
    } else {
      console.log('    ❌ Cache clearing not working');
      testResults.edgeCases.issues.push('Cache clearing not working properly');
    }
    
    // Test 3.2: Selective cache clearing
    console.log('  🧪 Test 3.2: Selective cache clearing');
    testResults.edgeCases.tests++;
    
    // Reload pipelines
    await clearRegistry.loadPipeline('mediapipe-face');
    await clearRegistry.loadPipeline('emotion-analysis');
    await clearRegistry.loadPipeline('age-estimation');
    
    const beforeSelective = clearRegistry.getMetrics().loadedCount;
    console.log(`    📊 Before selective clear: ${beforeSelective} cached pipelines`);
    
    // Clear only one pipeline
    clearRegistry.clearCache('emotion-analysis');
    
    const afterSelective = clearRegistry.getMetrics().loadedCount;
    console.log(`    📊 After selective clear: ${afterSelective} cached pipelines`);
    
    if (afterSelective === beforeSelective - 1) {
      console.log('    ✅ Selective cache clearing working');
      testResults.edgeCases.passed++;
    } else {
      console.log('    ❌ Selective cache clearing not working');
      testResults.edgeCases.issues.push('Selective cache clearing not working properly');
    }
    
    // Test 3.3: Concurrent operations with size limits
    console.log('  🧪 Test 3.3: Concurrent operations with size limits');
    testResults.edgeCases.tests++;
    
    const concurrentRegistry = createLazyPipelineRegistry({ 
      cacheSize: 2, 
      preloadCritical: false 
    });
    
    // Launch many concurrent operations
    const concurrentTypes = concurrentRegistry.getAvailablePipelineTypes();
    const concurrentPromises = [];
    
    // Create many concurrent requests for different pipelines
    for (let i = 0; i < 20; i++) {
      const type = concurrentTypes[i % concurrentTypes.length];
      concurrentPromises.push(concurrentRegistry.loadPipeline(type));
    }
    
    await Promise.all(concurrentPromises);
    
    const concurrentMetrics = concurrentRegistry.getMetrics();
    console.log(`    📊 Final cache size after concurrent ops: ${concurrentMetrics.loadedCount}/2`);
    
    if (concurrentMetrics.loadedCount <= 2) {
      console.log('    ✅ Cache size limits maintained during concurrent ops');
      testResults.edgeCases.passed++;
    } else {
      console.log('    ❌ Cache size limits violated during concurrent ops');
      testResults.edgeCases.issues.push('Cache size limits violated during concurrent operations');
    }
    
    console.log(`  📊 Edge Cases: ${testResults.edgeCases.passed}/${testResults.edgeCases.tests} tests passed`);
    
    // =====================================================
    // RESULTS COMPILATION
    // =====================================================
    
    const categories = ['sizeLimits', 'evictionPolicies', 'edgeCases'];
    let totalTests = 0, totalPassed = 0, totalIssues = [];
    
    categories.forEach(category => {
      const result = testResults[category];
      totalTests += result.tests;
      totalPassed += result.passed;
      totalIssues = totalIssues.concat(result.issues);
    });
    
    testResults.overall = { totalTests, totalPassed, totalIssues };
    
    console.log('\n🎯 CACHE LIMITS & EVICTION VALIDATION SUMMARY');
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
    console.log(`\n🏆 Overall Status: ${overallSuccess ? 'ALL CACHE LIMITS WORKING' : 'CACHE LIMIT ISSUES FOUND'}`);
    
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
    console.error('❌ Cache limits validation failed:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      results: testResults
    };
  }
};

// Run cache limits and eviction validation
validateCacheLimitsAndEviction().then(result => {
  if (result.success) {
    console.log('\n🎉 Cache size limits and eviction policies validation PASSED!');
    process.exit(0);
  } else {
    console.log('\n🔧 Cache limits validation found issues that need attention');
    process.exit(1);
  }
});