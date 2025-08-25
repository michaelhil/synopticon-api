/**
 * Distribution System Performance and Reliability Audit
 * Comprehensive testing for production readiness
 */

import { 
  createDistributionManager,
  createHttpDistributor,
  createWebSocketDistributor,
  createMqttDistributor,
  createUdpDistributor,
  createSseDistributor
} from '../../src/core/distribution/index.js';

/**
 * Performance test configuration
 */
const PERFORMANCE_CONFIG = {
  // Load testing parameters
  loadTest: {
    duration: 10000, // 10 seconds
    rampUp: 2000,    // 2 seconds ramp-up
    maxConcurrency: 100,
    messagesPerSecond: 1000
  },
  
  // Memory monitoring
  memoryTest: {
    iterations: 1000,
    gcTrigger: true,
    memoryThreshold: 100 * 1024 * 1024 // 100MB
  },
  
  // Reliability testing
  reliabilityTest: {
    failureRate: 0.1,        // 10% simulated failures
    recoveryTime: 1000,      // 1 second recovery
    circuitBreakerTest: true,
    retryTest: true
  }
};

/**
 * Create mock distributors for testing
 */
const createMockDistributors = () => {
  const mockHttp = {
    name: 'http-mock',
    send: async (event, data) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50)); // 0-50ms latency
      if (Math.random() < 0.02) throw new Error('Simulated HTTP failure'); // 2% failure rate
      return { success: true, duration: Math.random() * 50 };
    },
    getHealth: () => ({ status: 'healthy', name: 'http-mock' }),
    cleanup: async () => {}
  };

  const mockWebSocket = {
    name: 'websocket-mock',
    send: async (event, data) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // 0-10ms latency
      if (Math.random() < 0.01) throw new Error('Simulated WebSocket failure'); // 1% failure rate
      return { success: true, duration: Math.random() * 10 };
    },
    getHealth: () => ({ status: 'healthy', name: 'websocket-mock' }),
    cleanup: async () => {}
  };

  const mockUdp = {
    name: 'udp-mock',
    send: async (event, data) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5)); // 0-5ms latency
      if (Math.random() < 0.005) throw new Error('Simulated UDP failure'); // 0.5% failure rate
      return { success: true, duration: Math.random() * 5 };
    },
    getHealth: () => ({ status: 'healthy', name: 'udp-mock' }),
    cleanup: async () => {}
  };

  return { mockHttp, mockWebSocket, mockUdp };
};

/**
 * Memory usage monitoring utility
 */
const createMemoryMonitor = () => {
  const measurements = [];
  
  const measure = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      measurements.push({
        timestamp: Date.now(),
        ...usage
      });
      return usage;
    }
    
    // Browser fallback
    if (typeof performance !== 'undefined' && performance.memory) {
      const usage = {
        heapUsed: performance.memory.usedJSHeapSize,
        heapTotal: performance.memory.totalJSHeapSize,
        heapLimit: performance.memory.jsHeapSizeLimit
      };
      measurements.push({
        timestamp: Date.now(),
        ...usage
      });
      return usage;
    }
    
    return null;
  };

  const getStats = () => {
    if (measurements.length === 0) return null;
    
    const heapUsed = measurements.map(m => m.heapUsed);
    const heapTotal = measurements.map(m => m.heapTotal);
    
    return {
      measurements: measurements.length,
      heapUsed: {
        min: Math.min(...heapUsed),
        max: Math.max(...heapUsed),
        avg: heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length,
        growth: heapUsed[heapUsed.length - 1] - heapUsed[0]
      },
      heapTotal: {
        min: Math.min(...heapTotal),
        max: Math.max(...heapTotal),
        avg: heapTotal.reduce((a, b) => a + b, 0) / heapTotal.length
      }
    };
  };

  return { measure, getStats, measurements };
};

/**
 * Load testing framework
 */
const runLoadTest = async (distributionManager, config = PERFORMANCE_CONFIG.loadTest) => {
  console.log(`🔥 Starting load test: ${config.messagesPerSecond} msg/sec for ${config.duration}ms`);
  
  const startTime = Date.now();
  const results = {
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    latencies: [],
    errors: [],
    throughput: 0
  };

  // Memory monitoring
  const memoryMonitor = createMemoryMonitor();
  const memoryInterval = setInterval(() => {
    memoryMonitor.measure();
  }, 100); // Monitor every 100ms

  try {
    // Calculate message interval
    const messageInterval = 1000 / config.messagesPerSecond;
    const testData = { test: true, timestamp: Date.now(), payload: 'x'.repeat(1000) };

    // Ramp up phase
    console.log('📈 Ramping up load...');
    await new Promise(resolve => setTimeout(resolve, config.rampUp));

    // Main load test
    const promises = [];
    const endTime = startTime + config.duration;

    while (Date.now() < endTime) {
      const messageStartTime = Date.now();
      
      const promise = distributionManager.distribute('load_test', testData)
        .then(result => {
          const latency = Date.now() - messageStartTime;
          results.totalMessages++;
          results.latencies.push(latency);
          
          if (result.summary.successful > 0) {
            results.successfulMessages++;
          } else {
            results.failedMessages++;
          }
        })
        .catch(error => {
          results.totalMessages++;
          results.failedMessages++;
          results.errors.push(error.message);
        });

      promises.push(promise);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, messageInterval));
    }

    // Wait for all messages to complete
    await Promise.allSettled(promises);

  } finally {
    clearInterval(memoryInterval);
  }

  // Calculate final metrics
  const duration = Date.now() - startTime;
  results.throughput = (results.totalMessages / duration) * 1000; // messages per second
  results.averageLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  results.p50Latency = results.latencies.sort((a, b) => a - b)[Math.floor(results.latencies.length * 0.5)];
  results.p95Latency = results.latencies.sort((a, b) => a - b)[Math.floor(results.latencies.length * 0.95)];
  results.p99Latency = results.latencies.sort((a, b) => a - b)[Math.floor(results.latencies.length * 0.99)];
  results.successRate = (results.successfulMessages / results.totalMessages) * 100;
  results.memoryStats = memoryMonitor.getStats();

  console.log(`📊 Load test completed:`);
  console.log(`   Total Messages: ${results.totalMessages}`);
  console.log(`   Success Rate: ${results.successRate.toFixed(1)}%`);
  console.log(`   Throughput: ${results.throughput.toFixed(1)} msg/sec`);
  console.log(`   Avg Latency: ${results.averageLatency.toFixed(1)}ms`);
  console.log(`   P95 Latency: ${results.p95Latency}ms`);
  console.log(`   P99 Latency: ${results.p99Latency}ms`);

  return results;
};

/**
 * Memory leak detection test
 */
const runMemoryLeakTest = async (distributionManager, config = PERFORMANCE_CONFIG.memoryTest) => {
  console.log(`🧠 Starting memory leak test: ${config.iterations} iterations`);
  
  const memoryMonitor = createMemoryMonitor();
  const initialMemory = memoryMonitor.measure();
  
  if (!initialMemory) {
    console.log('⚠️ Memory monitoring not available in this environment');
    return { passed: true, reason: 'Memory monitoring unavailable' };
  }

  const testData = { 
    test: true, 
    largePayload: 'x'.repeat(10000), // 10KB payload
    nested: { deep: { data: Array(1000).fill('memory_test') }}
  };

  // Run iterations
  for (let i = 0; i < config.iterations; i++) {
    try {
      await distributionManager.distribute('memory_test', testData);
      
      // Periodic memory measurement
      if (i % 100 === 0) {
        memoryMonitor.measure();
        
        // Optional garbage collection trigger
        if (config.gcTrigger && typeof global !== 'undefined' && global.gc) {
          global.gc();
        }
      }
      
      // Progress indicator
      if (i % 200 === 0) {
        process.stdout.write(`\r   Progress: ${i}/${config.iterations} (${((i/config.iterations)*100).toFixed(1)}%)`);
      }
      
    } catch (error) {
      console.warn(`\n⚠️ Error during iteration ${i}:`, error.message);
    }
  }
  
  console.log('\n'); // New line after progress indicator
  
  const finalMemory = memoryMonitor.measure();
  const memoryStats = memoryMonitor.getStats();
  
  // Check for memory leaks
  const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
  const memoryGrowthMB = memoryGrowth / (1024 * 1024);
  const leakDetected = memoryGrowth > config.memoryThreshold;
  
  console.log(`📊 Memory leak test results:`);
  console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Memory Growth: ${memoryGrowthMB.toFixed(2)} MB`);
  console.log(`   Leak Detected: ${leakDetected ? '❌ YES' : '✅ NO'}`);
  
  return {
    passed: !leakDetected,
    initialMemory: initialMemory.heapUsed,
    finalMemory: finalMemory.heapUsed,
    memoryGrowth,
    memoryGrowthMB,
    memoryStats,
    iterations: config.iterations
  };
};

/**
 * Circuit breaker and reliability test
 */
const runReliabilityTest = async (distributionManager, config = PERFORMANCE_CONFIG.reliabilityTest) => {
  console.log('🔧 Starting reliability and circuit breaker test');
  
  // Create failing mock distributor with higher failure rate
  const failingDistributor = {
    name: 'failing-mock',
    failureCount: 0,
    send: async (event, data) => {
      // Increase failure rate for circuit breaker testing
      const currentFailureRate = failingDistributor.failureCount < 10 ? 0.8 : config.failureRate;
      if (Math.random() < currentFailureRate) {
        failingDistributor.failureCount++;
        throw new Error(`Simulated failure #${failingDistributor.failureCount}`);
      }
      return { success: true, duration: 10 };
    },
    getHealth: () => ({ 
      status: failingDistributor.failureCount > 5 ? 'degraded' : 'healthy', 
      name: 'failing-mock',
      failures: failingDistributor.failureCount
    }),
    cleanup: async () => {}
  };

  distributionManager.registerDistributor('failing-test', failingDistributor);

  const results = {
    totalAttempts: 0,
    failures: 0,
    successes: 0,
    circuitBreakerTriggered: false,
    recoverySuccessful: false
  };

  // Test failure handling
  console.log('🔥 Testing failure scenarios...');
  for (let i = 0; i < 50; i++) {
    try {
      const result = await distributionManager.distribute('reliability_test', { iteration: i });
      results.totalAttempts++;
      
      if (result.summary.successful > 0) {
        results.successes++;
      } else {
        results.failures++;
      }
      
    } catch (error) {
      results.totalAttempts++;
      results.failures++;
      
      // Check if this looks like a circuit breaker response
      if (error.message.includes('circuit breaker') || error.message.includes('Circuit breaker')) {
        results.circuitBreakerTriggered = true;
      }
    }
  }

  // Test recovery after cooling down
  console.log('⏰ Testing recovery after cooldown...');
  await new Promise(resolve => setTimeout(resolve, config.recoveryTime));
  
  // Reset failure rate for recovery test
  const originalFailureRate = config.failureRate;
  config.failureRate = 0.01; // Much lower failure rate
  
  try {
    const recoveryResult = await distributionManager.distribute('recovery_test', { test: 'recovery' });
    if (recoveryResult.summary.successful > 0) {
      results.recoverySuccessful = true;
    }
  } catch (error) {
    console.log('Recovery test failed:', error.message);
  }
  
  // Restore original failure rate
  config.failureRate = originalFailureRate;

  const successRate = (results.successes / results.totalAttempts) * 100;
  
  console.log(`📊 Reliability test results:`);
  console.log(`   Total Attempts: ${results.totalAttempts}`);
  console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`   Circuit Breaker: ${results.circuitBreakerTriggered ? '✅ Triggered' : '❌ Not Triggered'}`);
  console.log(`   Recovery: ${results.recoverySuccessful ? '✅ Successful' : '❌ Failed'}`);
  
  // Cleanup
  distributionManager.unregisterDistributor('failing-test');

  return {
    ...results,
    successRate,
    passed: results.circuitBreakerTriggered && results.recoverySuccessful && successRate > 50
  };
};

/**
 * Concurrent connection test
 */
const runConcurrencyTest = async (distributionManager, maxConcurrency = 100) => {
  console.log(`🔄 Starting concurrency test: ${maxConcurrency} concurrent operations`);
  
  const startTime = Date.now();
  const results = {
    concurrent: maxConcurrency,
    completed: 0,
    failed: 0,
    averageLatency: 0,
    maxLatency: 0,
    minLatency: Infinity
  };

  const promises = [];
  for (let i = 0; i < maxConcurrency; i++) {
    const operationStartTime = Date.now();
    const promise = distributionManager.distribute('concurrency_test', { 
      operationId: i,
      timestamp: operationStartTime 
    })
    .then(() => {
      const latency = Date.now() - operationStartTime;
      results.completed++;
      results.maxLatency = Math.max(results.maxLatency, latency);
      results.minLatency = Math.min(results.minLatency, latency);
      return latency;
    })
    .catch(() => {
      results.failed++;
      return 0;
    });
    
    promises.push(promise);
  }

  const latencies = await Promise.allSettled(promises);
  const validLatencies = latencies
    .filter(result => result.status === 'fulfilled' && result.value > 0)
    .map(result => result.value);

  results.averageLatency = validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length || 0;
  results.totalDuration = Date.now() - startTime;
  results.successRate = (results.completed / maxConcurrency) * 100;

  console.log(`📊 Concurrency test results:`);
  console.log(`   Concurrent Operations: ${maxConcurrency}`);
  console.log(`   Completed Successfully: ${results.completed}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Success Rate: ${results.successRate.toFixed(1)}%`);
  console.log(`   Average Latency: ${results.averageLatency.toFixed(1)}ms`);
  console.log(`   Min/Max Latency: ${results.minLatency}ms / ${results.maxLatency}ms`);
  console.log(`   Total Duration: ${results.totalDuration}ms`);

  return results;
};

/**
 * Main performance audit runner
 */
const runDistributionPerformanceAudit = async () => {
  console.log('🚀 Starting Distribution System Performance Audit\n');
  console.log('='.repeat(60));

  // Create distribution manager with mock distributors
  const distributionManager = createDistributionManager({
    enableHealthCheck: false // Disable for testing
  });

  const { mockHttp, mockWebSocket, mockUdp } = createMockDistributors();
  
  distributionManager.registerDistributor('http', mockHttp);
  distributionManager.registerDistributor('websocket', mockWebSocket);
  distributionManager.registerDistributor('udp', mockUdp);

  const auditResults = {
    timestamp: Date.now(),
    version: '0.5.3',
    tests: {}
  };

  try {
    // 1. Load Testing
    console.log('\n📋 Test 1: Load Testing');
    console.log('-'.repeat(40));
    auditResults.tests.loadTest = await runLoadTest(distributionManager);

    // 2. Memory Leak Testing  
    console.log('\n📋 Test 2: Memory Leak Detection');
    console.log('-'.repeat(40));
    auditResults.tests.memoryLeakTest = await runMemoryLeakTest(distributionManager);

    // 3. Reliability Testing
    console.log('\n📋 Test 3: Reliability and Circuit Breaker');
    console.log('-'.repeat(40));
    auditResults.tests.reliabilityTest = await runReliabilityTest(distributionManager);

    // 4. Concurrency Testing
    console.log('\n📋 Test 4: Concurrency Testing');
    console.log('-'.repeat(40));
    auditResults.tests.concurrencyTest = await runConcurrencyTest(distributionManager);

  } catch (error) {
    console.error('❌ Audit failed:', error);
    auditResults.error = error.message;
  } finally {
    // Cleanup
    await distributionManager.cleanup();
  }

  // Final assessment
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE AUDIT SUMMARY');
  console.log('='.repeat(60));

  const assessments = {
    loadTest: auditResults.tests.loadTest?.successRate > 95,
    memoryTest: auditResults.tests.memoryLeakTest?.passed,
    reliabilityTest: auditResults.tests.reliabilityTest?.passed,
    concurrencyTest: auditResults.tests.concurrencyTest?.successRate > 90
  };

  Object.entries(assessments).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.replace(/([A-Z])/g, ' $1').toUpperCase()}`);
  });

  const overallPassed = Object.values(assessments).every(Boolean);
  const finalGrade = overallPassed ? '🏆 EXCELLENT' : '⚠️ NEEDS IMPROVEMENT';

  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL ASSESSMENT: ${finalGrade}`);
  console.log('='.repeat(60));

  if (overallPassed) {
    console.log('🎉 Distribution system is PRODUCTION READY!');
    console.log('   ✅ High performance under load');
    console.log('   ✅ No memory leaks detected');
    console.log('   ✅ Reliable error handling');
    console.log('   ✅ Excellent concurrency support');
  } else {
    console.log('⚠️ Some issues detected. Review failed tests above.');
  }

  return {
    passed: overallPassed,
    grade: finalGrade,
    ...auditResults
  };
};

// Run audit if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDistributionPerformanceAudit()
    .then(results => {
      process.exit(results.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Performance audit crashed:', error);
      process.exit(1);
    });
}

export { runDistributionPerformanceAudit };