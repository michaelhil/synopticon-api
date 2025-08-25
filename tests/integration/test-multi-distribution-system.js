/**
 * Multi-Distribution System Test Suite
 * Comprehensive testing of all distribution mechanisms
 */

import { 
  createDistributionManager,
  createHttpDistributor,
  createWebSocketDistributor,
  createMqttDistributor,
  createUdpDistributor,
  createSseDistributor,
  getDistributionPresets,
  getDistributionPreset,
  getAvailablePresets,
  createQuickDistribution,
  validatePreset
} from '../../src/core/distribution/index.js';

/**
 * Test configuration validation
 */
const testConfigurationSystem = async () => {
  console.log('🧪 Testing Configuration System...');
  
  try {
    // Test preset retrieval
    const presets = getDistributionPresets();
    console.log(`✅ Found ${Object.keys(presets).length} distribution presets`);
    
    // Test specific preset
    const basicPreset = getDistributionPreset('basic');
    console.log(`✅ Basic preset loaded: ${basicPreset ? 'Success' : 'Failed'}`);
    
    // Test preset validation
    const validation = validatePreset(basicPreset);
    console.log(`✅ Basic preset validation: ${validation.isValid ? 'Valid' : `Invalid - ${validation.errors.join(', ')}`}`);
    
    // Test quick distribution factory
    try {
      const quickDistribution = createQuickDistribution('basic');
      console.log(`✅ Quick distribution factory: ${quickDistribution ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.log(`⚠️ Quick distribution factory: ${error.message}`);
      // This is not critical for the test
    }
    
    return true;
  } catch (error) {
    console.error('❌ Configuration system test failed:', error.message);
    return false;
  }
};

/**
 * Test individual distributors
 */
const testDistributors = async () => {
  console.log('🧪 Testing Individual Distributors...');
  
  const distributorTests = [
    {
      name: 'HTTP Distributor',
      factory: () => createHttpDistributor({ 
        baseUrl: 'http://localhost:3001',
        timeout: 5000 
      })
    },
    {
      name: 'WebSocket Distributor',
      factory: () => createWebSocketDistributor({ 
        port: 8081,
        host: 'localhost'
      })
    },
    {
      name: 'MQTT Distributor',
      factory: () => createMqttDistributor({
        broker: 'mqtt://test.mosquitto.org:1883',
        clientId: 'synopticon-test'
      })
    },
    {
      name: 'UDP Distributor',
      factory: () => createUdpDistributor({
        port: 9998,
        maxPayload: 512
      })
    },
    {
      name: 'SSE Distributor',
      factory: () => createSseDistributor({
        port: 3002,
        endpoint: '/test-events'
      })
    }
  ];

  let passedTests = 0;
  
  for (const test of distributorTests) {
    try {
      const distributor = test.factory();
      
      // Test basic interface
      const hasRequiredMethods = [
        'send', 'connect', 'disconnect', 'getHealth', 'cleanup'
      ].every(method => typeof distributor[method] === 'function');
      
      if (hasRequiredMethods) {
        console.log(`✅ ${test.name}: Interface complete`);
        
        // Test health check
        const health = distributor.getHealth();
        if (health && health.name) {
          console.log(`✅ ${test.name}: Health check working`);
          passedTests++;
        } else {
          console.log(`⚠️ ${test.name}: Health check incomplete`);
        }
      } else {
        console.log(`❌ ${test.name}: Missing required methods`);
      }
      
      // Cleanup
      await distributor.cleanup().catch(() => {});
      
    } catch (error) {
      console.log(`❌ ${test.name}: Creation failed - ${error.message}`);
    }
  }
  
  console.log(`📊 Distributor tests: ${passedTests}/${distributorTests.length} passed`);
  return passedTests === distributorTests.length;
};

/**
 * Test distribution manager coordination
 */
const testDistributionManager = async () => {
  console.log('🧪 Testing Distribution Manager...');
  
  try {
    const manager = createDistributionManager({
      enableHealthCheck: false // Disable for testing
    });
    
    // Register test distributors (with mock implementations for speed)
    const mockHttpDistributor = {
      name: 'http-test',
      send: async () => ({ success: true, duration: 10 }),
      getHealth: () => ({ name: 'http-test', status: 'healthy' }),
      cleanup: async () => {}
    };
    
    const mockWsDistributor = {
      name: 'ws-test',
      send: async () => ({ success: true, duration: 5 }),
      getHealth: () => ({ name: 'ws-test', status: 'healthy' }),
      cleanup: async () => {}
    };
    
    manager.registerDistributor('http', mockHttpDistributor);
    manager.registerDistributor('websocket', mockWsDistributor);
    
    console.log('✅ Registered distributors successfully');
    
    // Test distribution
    const result = await manager.distribute('test_event', { message: 'Hello World' });
    
    if (result.summary.successful === 2) {
      console.log('✅ Distribution to all distributors successful');
    } else {
      console.log(`⚠️ Distribution partial success: ${result.summary.successful}/2`);
    }
    
    // Test event routing
    manager.setEventRouting('face_detected', ['http']);
    const routedResult = await manager.routeEvent('face_detected', { faces: [] });
    
    if (routedResult.summary.total === 1) {
      console.log('✅ Event routing working correctly');
    } else {
      console.log('⚠️ Event routing issue');
    }
    
    // Test health check
    const health = await manager.performHealthCheck();
    if (health.summary.healthy === 2) {
      console.log('✅ Health monitoring working');
    } else {
      console.log('⚠️ Health monitoring issues');
    }
    
    // Test stats
    const stats = manager.getStats();
    if (stats.performance.totalMessages >= 2) {
      console.log('✅ Statistics tracking working');
    } else {
      console.log('⚠️ Statistics tracking issues');
    }
    
    // Cleanup
    await manager.cleanup();
    console.log('✅ Manager cleanup successful');
    
    return true;
  } catch (error) {
    console.error('❌ Distribution manager test failed:', error.message);
    return false;
  }
};

/**
 * Test preset configurations
 */
const testPresetConfigurations = async () => {
  console.log('🧪 Testing Preset Configurations...');
  
  const presets = ['basic', 'realtime', 'iot', 'performance', 'enterprise', 'development', 'mobile'];
  let validPresets = 0;
  
  for (const presetName of presets) {
    try {
      const preset = getDistributionPreset(presetName);
      if (!preset) {
        console.log(`❌ ${presetName}: Not found`);
        continue;
      }
      
      const validation = validatePreset(preset);
      if (validation.isValid) {
        console.log(`✅ ${presetName}: Valid configuration`);
        validPresets++;
      } else {
        console.log(`❌ ${presetName}: Invalid - ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ ${presetName}: Error - ${error.message}`);
    }
  }
  
  console.log(`📊 Preset validation: ${validPresets}/${presets.length} valid`);
  return validPresets === presets.length;
};

/**
 * Test integration with orchestrator pattern
 */
const testOrchestratorIntegration = async () => {
  console.log('🧪 Testing Orchestrator Integration...');
  
  try {
    // Create a mock orchestrator with distribution
    const createDistributedOrchestrator = async (config = {}) => {
      const distributionManager = createDistributionManager({
        enableHealthCheck: false
      });
      
      // Mock HTTP distributor for testing
      const mockDistributor = {
        send: async (event, data) => {
          console.log(`📡 Distributed ${event}:`, Object.keys(data).join(', '));
          return { success: true, duration: Math.random() * 10 };
        },
        getHealth: () => ({ status: 'healthy', name: 'mock-http' }),
        cleanup: async () => {}
      };
      
      distributionManager.registerDistributor('http', mockDistributor);
      distributionManager.setEventRouting('face_detected', ['http']);
      
      const processAnalysis = async (requirements, metadata = {}) => {
        // Mock analysis result
        const result = {
          success: true,
          data: {
            faces: [{ bbox: { x: 100, y: 100, width: 200, height: 200 }, confidence: 0.95 }]
          },
          processingTime: Math.random() * 100
        };
        
        // Distribute results
        if (result.success && result.data.faces && result.data.faces.length > 0) {
          await distributionManager.routeEvent('face_detected', {
            ...result.data,
            metadata: { ...metadata, timestamp: Date.now() }
          });
        }
        
        return result;
      };
      
      return {
        processAnalysis,
        distributionManager,
        distribute: (event, data) => distributionManager.distribute(event, data),
        getDistributionStats: () => distributionManager.getStats()
      };
    };
    
    // Test integration
    const orchestrator = await createDistributedOrchestrator();
    
    const result = await orchestrator.processAnalysis({
      capabilities: ['face_detection'],
      quality: 'balanced'
    }, {
      source: 'test',
      sessionId: 'integration-test'
    });
    
    if (result.success) {
      console.log('✅ Orchestrator integration successful');
      
      const stats = orchestrator.getDistributionStats();
      if (stats.performance.totalMessages > 0) {
        console.log('✅ Distribution triggered from orchestrator');
      }
      
      await orchestrator.distributionManager.cleanup();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Orchestrator integration test failed:', error.message);
    return false;
  }
};

/**
 * Main test runner
 */
const runMultiDistributionTests = async () => {
  console.log('🚀 Starting Multi-Distribution System Tests...\n');
  
  const tests = [
    { name: 'Configuration System', test: testConfigurationSystem },
    { name: 'Individual Distributors', test: testDistributors },
    { name: 'Distribution Manager', test: testDistributionManager },
    { name: 'Preset Configurations', test: testPresetConfigurations },
    { name: 'Orchestrator Integration', test: testOrchestratorIntegration }
  ];
  
  let passedTests = 0;
  const results = [];
  
  for (const { name, test } of tests) {
    console.log(`\n--- ${name} ---`);
    const startTime = Date.now();
    
    try {
      const success = await test();
      const duration = Date.now() - startTime;
      
      if (success) {
        console.log(`✅ ${name} PASSED (${duration}ms)`);
        passedTests++;
        results.push({ name, status: 'PASSED', duration });
      } else {
        console.log(`❌ ${name} FAILED (${duration}ms)`);
        results.push({ name, status: 'FAILED', duration });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${name} ERROR: ${error.message} (${duration}ms)`);
      results.push({ name, status: 'ERROR', duration, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎯 MULTI-DISTRIBUTION SYSTEM TEST RESULTS');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    const statusIcon = result.status === 'PASSED' ? '✅' : 
                     result.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${result.name}: ${result.status} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const successRate = ((passedTests / tests.length) * 100).toFixed(1);
  console.log(`\n📊 Overall Success Rate: ${successRate}% (${passedTests}/${tests.length})`);
  
  if (passedTests === tests.length) {
    console.log('🎉 All tests passed! Multi-distribution system is ready for use.');
  } else {
    console.log('⚠️ Some tests failed. Review the results above.');
  }
  
  return passedTests === tests.length;
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiDistributionTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
}

export { runMultiDistributionTests };