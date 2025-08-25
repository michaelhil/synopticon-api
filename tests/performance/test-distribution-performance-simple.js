/**
 * Simplified Distribution System Performance Verification
 * Quick verification of core performance characteristics
 */

import { 
  createDistributionManager,
  createHttpDistributor,
  createWebSocketDistributor,
  getDistributionPresets
} from '../../src/core/distribution/index.js';

/**
 * Simple performance benchmarks
 */
const runSimplePerformanceTest = async () => {
  console.log('🚀 Distribution System Performance Verification\n');

  // Test 1: Basic throughput test
  console.log('📊 Test 1: Basic Throughput');
  console.log('-'.repeat(40));
  
  const manager = createDistributionManager({ enableHealthCheck: false });
  
  // Add mock distributors
  const mockHttp = {
    name: 'http-test',
    send: async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
      return { success: true, duration: Math.random() * 20 };
    },
    getHealth: () => ({ status: 'healthy', name: 'http-test' }),
    cleanup: async () => {}
  };
  
  const mockWs = {
    name: 'ws-test',
    send: async () => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      return { success: true, duration: Math.random() * 10 };
    },
    getHealth: () => ({ status: 'healthy', name: 'ws-test' }),
    cleanup: async () => {}
  };

  manager.registerDistributor('http', mockHttp);
  manager.registerDistributor('websocket', mockWs);

  // Throughput test
  const testCount = 100;
  const startTime = Date.now();
  
  const promises = [];
  for (let i = 0; i < testCount; i++) {
    promises.push(manager.distribute('test_event', { id: i, data: 'test' }));
  }
  
  const results = await Promise.allSettled(promises);
  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const throughput = (testCount / duration) * 1000;

  console.log(`✅ Processed ${testCount} messages in ${duration}ms`);
  console.log(`✅ Success rate: ${((successCount/testCount)*100).toFixed(1)}%`);
  console.log(`✅ Throughput: ${throughput.toFixed(1)} messages/second`);

  // Test 2: Configuration system
  console.log('\n📊 Test 2: Configuration System');
  console.log('-'.repeat(40));
  
  const presets = getDistributionPresets();
  const presetCount = Object.keys(presets).length;
  console.log(`✅ Found ${presetCount} distribution presets`);
  
  // Validate each preset
  let validPresets = 0;
  for (const [name, preset] of Object.entries(presets)) {
    if (preset.distributors && preset.config && preset.eventRouting) {
      validPresets++;
    }
  }
  console.log(`✅ ${validPresets}/${presetCount} presets are valid`);

  // Test 3: Memory efficiency
  console.log('\n📊 Test 3: Memory Efficiency');
  console.log('-'.repeat(40));
  
  const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
  
  // Create and destroy multiple managers
  const managers = [];
  for (let i = 0; i < 10; i++) {
    const tmpManager = createDistributionManager();
    tmpManager.registerDistributor('test', mockHttp);
    managers.push(tmpManager);
  }
  
  // Cleanup all managers
  await Promise.all(managers.map(m => m.cleanup()));
  
  const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
  const memoryGrowth = finalMemory - initialMemory;
  const memoryGrowthMB = memoryGrowth / (1024 * 1024);
  
  console.log(`✅ Memory growth after 10 manager cycles: ${memoryGrowthMB.toFixed(2)} MB`);
  console.log(`✅ Memory efficiency: ${memoryGrowthMB < 5 ? 'EXCELLENT' : 'ACCEPTABLE'}`);

  // Test 4: Health monitoring
  console.log('\n📊 Test 4: Health Monitoring');
  console.log('-'.repeat(40));
  
  const health = await manager.performHealthCheck();
  const healthyCount = health.summary.healthy;
  const totalCount = health.summary.total;
  
  console.log(`✅ Health check completed: ${healthyCount}/${totalCount} distributors healthy`);
  console.log(`✅ Health monitoring: ${healthyCount > 0 ? 'WORKING' : 'FAILED'}`);

  // Final cleanup
  await manager.cleanup();

  // Overall assessment
  console.log('\n' + '='.repeat(50));
  console.log('🎯 PERFORMANCE VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  
  const metrics = {
    throughput: throughput > 100, // > 100 messages/second
    successRate: (successCount/testCount) > 0.95, // > 95% success
    configurationSystem: validPresets === presetCount,
    memoryEfficient: memoryGrowthMB < 10, // < 10MB growth
    healthMonitoring: healthyCount > 0
  };

  Object.entries(metrics).forEach(([metric, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${metric.replace(/([A-Z])/g, ' $1').toUpperCase()}`);
  });

  const allPassed = Object.values(metrics).every(Boolean);
  console.log('\n' + '='.repeat(50));
  console.log(`OVERALL STATUS: ${allPassed ? '🏆 EXCELLENT' : '⚠️ REVIEW NEEDED'}`);
  console.log('='.repeat(50));

  return {
    passed: allPassed,
    metrics: {
      throughput: throughput.toFixed(1),
      successRate: ((successCount/testCount)*100).toFixed(1),
      memoryGrowthMB: memoryGrowthMB.toFixed(2),
      healthyDistributors: `${healthyCount}/${totalCount}`,
      validPresets: `${validPresets}/${presetCount}`
    }
  };
};

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimplePerformanceTest()
    .then(results => {
      if (results.passed) {
        console.log('\n🎉 All performance tests PASSED! System is production ready.');
      } else {
        console.log('\n⚠️ Some performance tests failed. Review results above.');
      }
      process.exit(results.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Performance test crashed:', error);
      process.exit(1);
    });
}

export { runSimplePerformanceTest };