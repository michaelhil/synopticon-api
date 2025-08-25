#!/usr/bin/env bun
/**
 * Configuration APIs and Orchestration System Test Suite
 * Comprehensive testing for configuration management and pipeline orchestration
 * 
 * System: Synopticon API - Configuration and Orchestration Components
 * Date: August 25, 2025
 * Testing Framework: Bun Test Suite with TypeScript Native
 */

import { createConfiguration, validateConfiguration, CONFIG_PROFILES, createConfigurationFromPreset } from './src/core/configuration.ts';
import { createOrchestrator, createCircuitBreaker } from './src/core/orchestrator.ts';
import { createStrategyRegistry, createPerformanceFirstStrategy, createAccuracyFirstStrategy, createAdaptiveStrategy, STRATEGIES } from './src/core/strategies.ts';

// Test results tracking
let testResults = {
  categories: {
    'Configuration Management': { passed: 0, failed: 0, tests: [] },
    'Configuration Validation': { passed: 0, failed: 0, tests: [] },
    'Configuration Presets': { passed: 0, failed: 0, tests: [] },
    'Orchestrator Core': { passed: 0, failed: 0, tests: [] },
    'Pipeline Management': { passed: 0, failed: 0, tests: [] },
    'Strategy System': { passed: 0, failed: 0, tests: [] },
    'Circuit Breaker': { passed: 0, failed: 0, tests: [] },
    'Error Handling': { passed: 0, failed: 0, tests: [] }
  },
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0
};

// Test helper functions
const recordTest = (category, testName, passed, error = null, details = {}) => {
  testResults.categories[category].tests.push({
    name: testName,
    passed,
    error: error?.message || error,
    details,
    timestamp: new Date().toISOString()
  });
  
  if (passed) {
    testResults.categories[category].passed++;
    testResults.totalPassed++;
  } else {
    testResults.categories[category].failed++;
    testResults.totalFailed++;
  }
  testResults.totalTests++;
  
  const status = passed ? '✅' : '❌';
  const errorMsg = error ? ` - ${error.message || error}` : '';
  console.log(`${status} [${category}] ${testName}${errorMsg}`);
};

const createTestPipeline = (name, capabilities = ['face_detection'], config = {}) => ({
  name,
  version: '1.0.0',
  capabilities,
  config: {
    name,
    capabilities,
    performance: {
      fps: config.fps || 30,
      latency: config.latency || '50ms',
      cpuUsage: config.cpuUsage || 'medium',
      memoryUsage: config.memoryUsage || 'medium',
      batteryImpact: config.batteryImpact || 'medium',
      modelSize: config.modelSize || 'medium'
    },
    process: async (input) => ({
      status: 'success',
      data: { faces: [{ confidence: 0.8, bbox: [10, 10, 100, 100] }] },
      processingTime: 45,
      timestamp: Date.now()
    })
  },
  isInitialized: true,
  process: async (input) => ({
    status: 'success',
    data: { faces: [{ confidence: 0.8, bbox: [10, 10, 100, 100] }] },
    processingTime: 45,
    timestamp: Date.now()
  }),
  initialize: async () => true,
  cleanup: async () => { /* mock */ },
  getStatus: () => ({ 
    initialized: true, 
    healthy: true, 
    lastUsed: Date.now(),
    processingCount: 0
  }),
  getHealthStatus: () => ({ 
    healthy: true,
    successRate: 0.95, 
    errors: [],
    totalRequests: 100,
    failedRequests: 5,
    averageResponseTime: 45,
    lastFailure: null
  }),
  getMetrics: () => ({
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    averageProcessingTime: 45,
    currentFPS: config.fps || 30,
    errorRate: 0.05,
    uptime: 3600000
  }),
  getPerformanceMetrics: () => ({
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    averageProcessingTime: 45,
    currentFPS: config.fps || 30,
    errorRate: 0.05,
    uptime: 3600000
  }),
  isCapable: (requiredCapabilities) => {
    return requiredCapabilities.every(cap => capabilities.includes(cap));
  },
  supportsRealtime: () => true,
  isHealthy: () => true
});

// =============================================================================
// Configuration Management Tests
// =============================================================================

console.log('\n🧪 Testing Configuration Management System...\n');

// Test 1: Basic Configuration Creation
try {
  const config = createConfiguration();
  recordTest('Configuration Management', 'Create default configuration', 
    config && typeof config === 'object' && config.system && config.pipelines,
    null,
    { hasSystem: !!config.system, hasPipelines: !!config.pipelines }
  );
} catch (error) {
  recordTest('Configuration Management', 'Create default configuration', false, error);
}

// Test 2: Configuration with Custom Options
try {
  const customConfig = createConfiguration({
    system: {
      maxConcurrentRequests: 8,
      requestTimeout: 5000
    },
    performance: {
      targetFPS: 60,
      maxLatency: 50
    }
  });
  
  recordTest('Configuration Management', 'Create custom configuration',
    customConfig.system.maxConcurrentRequests === 8 && 
    customConfig.performance.targetFPS === 60,
    null,
    { 
      maxRequests: customConfig.system.maxConcurrentRequests,
      targetFPS: customConfig.performance.targetFPS 
    }
  );
} catch (error) {
  recordTest('Configuration Management', 'Create custom configuration', false, error);
}

// Test 3: Configuration Immutability
try {
  const config = createConfiguration();
  const originalValue = config.system.logLevel;
  
  // Attempt to modify - should not affect original (frozen object)
  let immutable = true;
  try {
    config.system.logLevel = 'debug';
    immutable = config.system.logLevel === originalValue;
  } catch (e) {
    // Expected to fail due to frozen object
    immutable = true;
  }
  
  recordTest('Configuration Management', 'Configuration immutability protection',
    immutable,
    null,
    { originalValue, protected: immutable }
  );
} catch (error) {
  recordTest('Configuration Management', 'Configuration immutability protection', false, error);
}

// Test 4: Configuration Validation
try {
  const config = createConfiguration();
  const validation = validateConfiguration(config);
  
  recordTest('Configuration Management', 'Validate configuration structure',
    validation && typeof validation.valid === 'boolean',
    null,
    { 
      isValid: validation.valid,
      hasErrors: validation.errors?.length > 0,
      hasWarnings: validation.warnings?.length > 0
    }
  );
} catch (error) {
  recordTest('Configuration Management', 'Validate configuration structure', false, error);
}

// =============================================================================
// Configuration Validation Tests  
// =============================================================================

console.log('\n🔍 Testing Configuration Validation...\n');

// Test 5: Valid Configuration Validation
try {
  const validConfig = createConfiguration();
  const validation = validateConfiguration(validConfig);
  
  recordTest('Configuration Validation', 'Validate correct configuration',
    validation.valid === true && (!validation.errors || validation.errors.length === 0),
    null,
    { isValid: validation.valid, errorCount: validation.errors?.length || 0 }
  );
} catch (error) {
  recordTest('Configuration Validation', 'Validate correct configuration', false, error);
}

// Test 6: Invalid Configuration Detection
try {
  const invalidConfig = {
    system: {
      maxConcurrentRequests: -5, // Invalid negative value
      logLevel: 'invalid' // Invalid log level
    }
  };
  
  const validation = validateConfiguration(invalidConfig);
  
  recordTest('Configuration Validation', 'Detect invalid configuration',
    validation.valid === false && validation.errors && validation.errors.length > 0,
    null,
    { isValid: validation.valid, errorCount: validation.errors?.length || 0 }
  );
} catch (error) {
  recordTest('Configuration Validation', 'Detect invalid configuration', false, error);
}

// Test 7: Configuration Creation from Preset
try {
  const performanceConfig = createConfigurationFromPreset('performance');
  const accuracyConfig = createConfigurationFromPreset('accuracy');
  
  recordTest('Configuration Validation', 'Create configurations from presets',
    performanceConfig.performance.targetFPS === 60 &&
    accuracyConfig.pipelines.detection.mediapipe.modelComplexity === 2,
    null,
    { 
      perfFPS: performanceConfig.performance.targetFPS,
      accComplexity: accuracyConfig.pipelines.detection.mediapipe.modelComplexity
    }
  );
} catch (error) {
  recordTest('Configuration Validation', 'Create configurations from presets', false, error);
}

// =============================================================================
// Configuration Presets Tests
// =============================================================================

console.log('\n⚙️ Testing Configuration Presets...\n');

// Test 8: Performance Preset
try {
  const perfConfig = createConfigurationFromPreset('performance');
  
  recordTest('Configuration Presets', 'Load performance preset',
    perfConfig.performance.targetFPS === 60 &&
    perfConfig.system.performanceMonitoring === true,
    null,
    { 
      targetFPS: perfConfig.performance.targetFPS,
      monitoring: perfConfig.system.performanceMonitoring 
    }
  );
} catch (error) {
  recordTest('Configuration Presets', 'Load performance preset', false, error);
}

// Test 9: Accuracy Preset  
try {
  const accConfig = createConfigurationFromPreset('accuracy');
  
  recordTest('Configuration Presets', 'Load accuracy preset',
    accConfig.pipelines.detection.mediapipe.modelComplexity === 2 &&
    accConfig.pipelines.detection.mediapipe.minDetectionConfidence >= 0.8,
    null,
    { 
      modelComplexity: accConfig.pipelines.detection.mediapipe.modelComplexity,
      minConfidence: accConfig.pipelines.detection.mediapipe.minDetectionConfidence
    }
  );
} catch (error) {
  recordTest('Configuration Presets', 'Load accuracy preset', false, error);
}

// Test 10: Lightweight Preset
try {
  const lightConfig = createConfigurationFromPreset('lightweight');
  
  recordTest('Configuration Presets', 'Load lightweight preset',
    lightConfig.pipelines.detection.mediapipe.modelComplexity === 0 &&
    lightConfig.system.performanceMonitoring === false,
    null,
    { 
      modelComplexity: lightConfig.pipelines.detection.mediapipe.modelComplexity,
      monitoring: lightConfig.system.performanceMonitoring 
    }
  );
} catch (error) {
  recordTest('Configuration Presets', 'Load lightweight preset', false, error);
}

// =============================================================================
// Orchestrator Core Tests
// =============================================================================

console.log('\n🎭 Testing Orchestrator Core System...\n');

// Test 11: Orchestrator Creation
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({
    strategies,
    defaultStrategy: 'performance_first'
  });
  
  recordTest('Orchestrator Core', 'Create orchestrator instance',
    typeof orchestrator.analyze === 'function' &&
    typeof orchestrator.registerPipeline === 'function' &&
    typeof orchestrator.getStatus === 'function',
    null,
    { hasAnalyze: typeof orchestrator.analyze === 'function' }
  );
} catch (error) {
  recordTest('Orchestrator Core', 'Create orchestrator instance', false, error);
}

// Test 12: Pipeline Registration
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ strategies });
  const testPipeline = createTestPipeline('test-pipeline-1');
  
  await orchestrator.registerPipeline(testPipeline);
  const registeredPipelines = orchestrator.getRegisteredPipelines();
  
  recordTest('Orchestrator Core', 'Register pipeline successfully',
    registeredPipelines.length === 1 &&
    registeredPipelines[0].name === 'test-pipeline-1',
    null,
    { pipelineCount: registeredPipelines.length }
  );
} catch (error) {
  recordTest('Orchestrator Core', 'Register pipeline successfully', false, error);
}

// Test 13: Pipeline Selection
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ strategies });
  
  // Register multiple pipelines with different capabilities
  await orchestrator.registerPipeline(createTestPipeline('fast-detector', ['face_detection'], { fps: 60 }));
  await orchestrator.registerPipeline(createTestPipeline('accurate-analyzer', ['face_detection', 'emotion_analysis'], { fps: 25 }));
  
  const requirements = {
    capabilities: ['face_detection'],
    strategy: 'performance_first',
    quality: { minConfidence: 0.7, maxLatency: 100, requiredFPS: 30, realtime: true }
  };
  
  const selected = orchestrator.selectOptimalPipelines(requirements);
  
  recordTest('Orchestrator Core', 'Select optimal pipelines',
    selected.length > 0 && selected[0].name === 'fast-detector',
    null,
    { selectedCount: selected.length, firstPipeline: selected[0]?.name }
  );
} catch (error) {
  recordTest('Orchestrator Core', 'Select optimal pipelines', false, error);
}

// =============================================================================
// Pipeline Management Tests
// =============================================================================

console.log('\n🔧 Testing Pipeline Management...\n');

// Test 14: Pipeline Analysis Execution
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ strategies });
  
  await orchestrator.registerPipeline(createTestPipeline('analyzer-1'));
  
  const mockFrame = { width: 640, height: 480, data: new Uint8Array(640 * 480 * 4) };
  const result = await orchestrator.analyze(mockFrame);
  
  recordTest('Pipeline Management', 'Execute pipeline analysis',
    result.status === 'success' && result.data,
    null,
    { status: result.status, hasData: !!result.data }
  );
} catch (error) {
  recordTest('Pipeline Management', 'Execute pipeline analysis', false, error);
}

// Test 15: Multiple Pipeline Handling
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ 
    strategies,
    defaultStrategy: 'performance_first',
    performance: { maxConcurrentPipelines: 2 }
  });
  
  // Register pipelines with different performance characteristics
  await orchestrator.registerPipeline(createTestPipeline('pipeline-1', ['face_detection'], { fps: 30 }));
  await orchestrator.registerPipeline(createTestPipeline('pipeline-2', ['face_detection'], { fps: 45 }));
  await orchestrator.registerPipeline(createTestPipeline('pipeline-3', ['face_detection'], { fps: 60 }));
  
  const requirements = {
    capabilities: ['face_detection'],
    strategy: 'performance_first',
    quality: { minConfidence: 0.5, maxLatency: 1000, requiredFPS: 30, realtime: true }
  };
  
  const selected = orchestrator.selectOptimalPipelines(requirements);
  
  recordTest('Pipeline Management', 'Handle multiple pipelines correctly',
    selected && Array.isArray(selected) && selected.length >= 1 && selected.length <= 2, // Should respect maxConcurrentPipelines
    null,
    { selectedCount: selected?.length || 0, maxAllowed: 2, selectedPipelines: selected?.map(p => p.name) || [] }
  );
} catch (error) {
  recordTest('Pipeline Management', 'Handle multiple pipelines correctly', false, error);
}

// Test 16: Pipeline Unregistration
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ strategies });
  
  await orchestrator.registerPipeline(createTestPipeline('temp-pipeline'));
  let pipelineCount = orchestrator.getRegisteredPipelines().length;
  
  const unregistered = await orchestrator.unregisterPipeline('temp-pipeline');
  const newCount = orchestrator.getRegisteredPipelines().length;
  
  recordTest('Pipeline Management', 'Unregister pipeline successfully',
    unregistered === true && newCount === pipelineCount - 1,
    null,
    { unregistered, oldCount: pipelineCount, newCount }
  );
} catch (error) {
  recordTest('Pipeline Management', 'Unregister pipeline successfully', false, error);
}

// =============================================================================
// Strategy System Tests
// =============================================================================

console.log('\n🎯 Testing Strategy System...\n');

// Test 17: Strategy Registry Creation
try {
  const registry = createStrategyRegistry();
  const strategies = registry.listStrategies();
  
  recordTest('Strategy System', 'Create strategy registry',
    strategies.includes('performance_first') &&
    strategies.includes('accuracy_first') &&
    strategies.includes('adaptive'),
    null,
    { strategiesCount: strategies.length, strategies: strategies.slice(0, 3) }
  );
} catch (error) {
  recordTest('Strategy System', 'Create strategy registry', false, error);
}

// Test 18: Performance-First Strategy
try {
  const strategy = createPerformanceFirstStrategy();
  const pipelines = [
    createTestPipeline('slow-accurate', ['face_detection'], { fps: 15 }),
    createTestPipeline('fast-basic', ['face_detection'], { fps: 60 })
  ];
  
  const requirements = { capabilities: ['face_detection'] };
  const selected = strategy.selectPipelines(pipelines, requirements);
  
  recordTest('Strategy System', 'Performance-first strategy selection',
    selected.length > 0 && selected[0] === 'fast-basic',
    null,
    { selectedFirst: selected[0], totalSelected: selected.length }
  );
} catch (error) {
  recordTest('Strategy System', 'Performance-first strategy selection', false, error);
}

// Test 19: Accuracy-First Strategy  
try {
  const strategy = createAccuracyFirstStrategy();
  const pipelines = [
    createTestPipeline('basic-detector', ['face_detection'], { modelSize: 'small' }),
    createTestPipeline('advanced-analyzer', ['face_detection', 'emotion_analysis'], { modelSize: 'large' })
  ];
  
  const requirements = { capabilities: ['face_detection'] };
  const selected = strategy.selectPipelines(pipelines, requirements);
  
  recordTest('Strategy System', 'Accuracy-first strategy selection',
    selected.length > 0 && selected[0] === 'advanced-analyzer',
    null,
    { selectedFirst: selected[0], totalSelected: selected.length }
  );
} catch (error) {
  recordTest('Strategy System', 'Accuracy-first strategy selection', false, error);
}

// Test 20: Adaptive Strategy
try {
  const strategy = createAdaptiveStrategy();
  const pipelines = [
    createTestPipeline('adaptive-1', ['face_detection'], { fps: 30 }),
    createTestPipeline('adaptive-2', ['face_detection'], { fps: 45 })
  ];
  
  // Simulate performance tracking
  strategy.recordPerformance?.({ 
    averageProcessingTime: 25,
    currentFPS: 35,
    errorRate: 0.02
  });
  
  const requirements = { capabilities: ['face_detection'] };
  const selected = strategy.selectPipelines(pipelines, requirements);
  const currentLevel = strategy.getCurrentLevel?.();
  
  recordTest('Strategy System', 'Adaptive strategy with performance tracking',
    selected.length > 0 && currentLevel !== undefined,
    null,
    { 
      selectedCount: selected.length,
      currentLevel: currentLevel,
      hasPerformanceHistory: strategy.getPerformanceHistory?.().length > 0
    }
  );
} catch (error) {
  recordTest('Strategy System', 'Adaptive strategy with performance tracking', false, error);
}

// =============================================================================
// Circuit Breaker Tests
// =============================================================================

console.log('\n🔌 Testing Circuit Breaker System...\n');

// Test 21: Circuit Breaker Creation
try {
  const breaker = createCircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs: 5000
  });
  
  recordTest('Circuit Breaker', 'Create circuit breaker',
    typeof breaker.recordFailure === 'function' &&
    typeof breaker.recordSuccess === 'function' &&
    typeof breaker.isCircuitOpen === 'function',
    null,
    { hasRequiredMethods: true }
  );
} catch (error) {
  recordTest('Circuit Breaker', 'Create circuit breaker', false, error);
}

// Test 22: Failure Recording and Circuit Opening
try {
  const breaker = createCircuitBreaker({ failureThreshold: 2 });
  const pipelineId = 'test-pipeline-breaker';
  
  // Record failures to trigger circuit opening
  breaker.recordFailure(pipelineId);
  const afterOne = breaker.getCircuitState(pipelineId);
  
  breaker.recordFailure(pipelineId);
  const afterTwo = breaker.getCircuitState(pipelineId);
  
  recordTest('Circuit Breaker', 'Record failures and open circuit',
    afterOne === 'closed' && afterTwo === 'open',
    null,
    { stateAfterOne: afterOne, stateAfterTwo: afterTwo }
  );
} catch (error) {
  recordTest('Circuit Breaker', 'Record failures and open circuit', false, error);
}

// Test 23: Circuit Breaker Execution Protection
try {
  const breaker = createCircuitBreaker({ failureThreshold: 1 });
  const pipelineId = 'protected-pipeline';
  
  // Force circuit to open
  breaker.recordFailure(pipelineId);
  
  let executionBlocked = false;
  try {
    await breaker.executeWithBreaker(pipelineId, async () => {
      return 'should not execute';
    });
  } catch (error) {
    executionBlocked = error.message.includes('Circuit breaker open');
  }
  
  recordTest('Circuit Breaker', 'Block execution when circuit is open',
    executionBlocked,
    null,
    { circuitOpen: breaker.isCircuitOpen(pipelineId) }
  );
} catch (error) {
  recordTest('Circuit Breaker', 'Block execution when circuit is open', false, error);
}

// Test 24: Circuit Recovery
try {
  const breaker = createCircuitBreaker({ 
    failureThreshold: 1,
    successThreshold: 1,
    timeoutMs: 10 // Very short timeout for testing
  });
  const pipelineId = 'recovery-pipeline';
  
  // Force circuit open
  breaker.recordFailure(pipelineId);
  
  // Wait for timeout
  await new Promise(resolve => setTimeout(resolve, 15));
  
  const stateAfterTimeout = breaker.getCircuitState(pipelineId);
  
  recordTest('Circuit Breaker', 'Circuit transitions to half-open after timeout',
    stateAfterTimeout === 'half-open',
    null,
    { stateAfterTimeout }
  );
} catch (error) {
  recordTest('Circuit Breaker', 'Circuit transitions to half-open after timeout', false, error);
}

// =============================================================================
// Error Handling Tests
// =============================================================================

console.log('\n🚨 Testing Error Handling...\n');

// Test 25: Pipeline Failure Handling
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ 
    strategies,
    fallback: { enabled: true, maxFallbacks: 1 }
  });
  
  // Create failing and working pipelines
  const failingPipeline = {
    ...createTestPipeline('failing-pipeline'),
    process: async () => { throw new Error('Pipeline processing failed'); }
  };
  
  const workingPipeline = createTestPipeline('working-pipeline');
  
  await orchestrator.registerPipeline(failingPipeline);
  await orchestrator.registerPipeline(workingPipeline);
  
  const result = await orchestrator.analyze({ test: 'data' });
  
  recordTest('Error Handling', 'Handle pipeline failure with fallback',
    result.status === 'success', // Should succeed with fallback
    null,
    { resultStatus: result.status, hasFallback: true }
  );
} catch (error) {
  recordTest('Error Handling', 'Handle pipeline failure with fallback', false, error);
}

// Test 26: No Compatible Pipelines Error
try {
  const strategies = createStrategyRegistry();
  const orchestrator = createOrchestrator({ strategies });
  
  await orchestrator.registerPipeline(createTestPipeline('face-only', ['face_detection']));
  
  const requirements = {
    capabilities: ['pose_estimation'], // No compatible pipeline
    strategy: 'performance_first'
  };
  
  let errorThrown = false;
  try {
    orchestrator.selectOptimalPipelines(requirements);
  } catch (error) {
    errorThrown = error.message.includes('No pipelines available');
  }
  
  recordTest('Error Handling', 'Handle no compatible pipelines error',
    errorThrown,
    null,
    { errorThrown }
  );
} catch (error) {
  recordTest('Error Handling', 'Handle no compatible pipelines error', false, error);
}

// Test 27: Configuration Validation Error Handling
try {
  let validationHandled = false;
  try {
    const invalidConfig = {
      system: {
        maxConcurrentRequests: 'not-a-number' // Invalid type
      }
    };
    
    const result = validateConfiguration(invalidConfig);
    validationHandled = result && typeof result.valid === 'boolean';
  } catch (error) {
    validationHandled = false;
  }
  
  // Should handle validation gracefully (not throw)
  recordTest('Error Handling', 'Handle configuration validation errors gracefully',
    validationHandled,
    null,
    { validationHandled }
  );
} catch (error) {
  recordTest('Error Handling', 'Handle configuration validation errors gracefully', false, error);
}

// =============================================================================
// Results Summary
// =============================================================================

console.log('\n📊 Configuration and Orchestration System Test Results\n');
console.log('=' .repeat(80));

// Calculate category results
Object.entries(testResults.categories).forEach(([category, results]) => {
  const successRate = results.passed + results.failed > 0 
    ? ((results.passed / (results.passed + results.failed)) * 100).toFixed(1)
    : 0;
  
  const status = results.failed === 0 ? '✅' : results.passed > results.failed ? '⚠️' : '❌';
  console.log(`${status} ${category}: ${results.passed}/${results.passed + results.failed} passed (${successRate}%)`);
});

console.log('=' .repeat(80));

const overallSuccessRate = testResults.totalTests > 0 
  ? ((testResults.totalPassed / testResults.totalTests) * 100).toFixed(1)
  : 0;

console.log(`📈 Overall Results: ${testResults.totalPassed}/${testResults.totalTests} tests passed (${overallSuccessRate}%)`);

if (testResults.totalFailed === 0) {
  console.log('🎉 All tests passed! Configuration and Orchestration systems are fully functional.');
} else {
  console.log(`⚠️ ${testResults.totalFailed} tests failed. Review the detailed results above.`);
}

console.log('\n📋 Test Summary by Category:');
Object.entries(testResults.categories).forEach(([category, results]) => {
  if (results.failed > 0) {
    console.log(`\n❌ ${category} - Failed Tests:`);
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`   • ${test.name}: ${test.error}`);
    });
  }
});

// Export results for further analysis
const exportResults = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTests: testResults.totalTests,
    totalPassed: testResults.totalPassed,
    totalFailed: testResults.totalFailed,
    successRate: overallSuccessRate + '%'
  },
  categories: testResults.categories,
  system: {
    component: 'Configuration and Orchestration APIs',
    version: 'TypeScript Native Implementation',
    testFramework: 'Bun Test Suite'
  }
};

console.log('\n💾 Test results exported for audit report generation');
console.log(`🔍 Testing completed at ${exportResults.timestamp}`);

export { exportResults, testResults };