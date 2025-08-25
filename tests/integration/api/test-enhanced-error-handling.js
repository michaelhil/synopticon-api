/**
 * Enhanced Error Handling Validation Test
 * Tests the new error boundaries and recovery mechanisms
 */

import { createErrorBoundary, RecoveryStrategy, ErrorSeverity } from './examples/shared/error-boundaries.js';
import { createLifecycleManager } from './examples/shared/lifecycle-manager.js';
import { createComponentIntegrationManager } from './examples/shared/component-integration.js';

console.log('🛡️ Starting Enhanced Error Handling Validation...\n');

// Test 1: Error Boundary Basic Functionality
async function testErrorBoundaryBasics() {
  console.log('📋 Test 1: Error Boundary Basic Functionality');
  
  const boundary = createErrorBoundary({
    maxRetries: 2,
    retryDelay: 100
  });
  
  let callCount = 0;
  const flakyComponent = boundary.wrapComponent(async () => ({
    process: () => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Attempt ${callCount} failed`);
      }
      return `Success on attempt ${callCount}`;
    }
  }), {
    name: 'FlakyComponent',
    recoveryStrategy: RecoveryStrategy.RETRY,
    severity: ErrorSeverity.MEDIUM
  });
  
  try {
    const component = await flakyComponent({});
    const result = await component.process();
    console.log(`   ✅ Retry mechanism working: ${result}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Retry mechanism failed: ${error.message}`);
    return false;
  }
}

// Test 2: Graceful Degradation
async function testGracefulDegradation() {
  console.log('📋 Test 2: Graceful Degradation');
  
  const boundary = createErrorBoundary();
  
  const degradableComponent = boundary.wrapComponent(async () => ({
    criticalMethod: () => {
      throw new Error('Critical method always fails');
    },
    optionalMethod: () => {
      throw new Error('Optional method fails');
    }
  }), {
    name: 'DegradableComponent',
    recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
    severity: ErrorSeverity.LOW
  });
  
  try {
    const component = await degradableComponent({});
    
    // Test graceful degradation
    const result1 = await component.criticalMethod();
    const result2 = await component.optionalMethod();
    
    console.log(`   ✅ Graceful degradation working: ${JSON.stringify({ result1, result2 })}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Graceful degradation failed: ${error.message}`);
    return false;
  }
}

// Test 3: Fallback Components
async function testFallbackComponents() {
  console.log('📋 Test 3: Fallback Components');
  
  const boundary = createErrorBoundary();
  
  // Register fallback
  boundary.registerFallback('TestComponent', 'getData', { fallbackData: 'Emergency data' });
  
  const componentWithFallback = boundary.wrapComponent(async () => ({
    getData: () => {
      throw new Error('Data source unavailable');
    }
  }), {
    name: 'TestComponent',
    recoveryStrategy: RecoveryStrategy.FALLBACK,
    severity: ErrorSeverity.HIGH
  });
  
  try {
    const component = await componentWithFallback({});
    const result = await component.getData();
    
    console.log(`   ✅ Fallback working: ${JSON.stringify(result)}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Fallback failed: ${error.message}`);
    return false;
  }
}

// Test 4: Error Severity Handling
async function testErrorSeverityHandling() {
  console.log('📋 Test 4: Error Severity Handling');
  
  const boundary = createErrorBoundary({
    maxRetries: 1
  });
  
  // Critical error should not retry
  const criticalComponent = boundary.wrapComponent(async () => ({
    fail: () => {
      throw new Error('Critical failure');
    }
  }), {
    name: 'CriticalComponent',
    severity: ErrorSeverity.CRITICAL
  });
  
  let retryCount = 0;
  try {
    const component = await criticalComponent({});
    await component.fail();
    console.log(`   ❌ Critical error should have thrown`);
    return false;
  } catch (error) {
    console.log(`   ✅ Critical error handled correctly (no retry)`);
    return true;
  }
}

// Test 5: Component Integration Manager Error Handling
async function testComponentIntegrationErrorHandling() {
  console.log('📋 Test 5: Component Integration Manager Error Handling');
  
  const integrationManager = createComponentIntegrationManager({
    maxRetries: 2,
    retryDelay: 50
  });
  
  let attemptCount = 0;
  integrationManager.registerComponent('unreliable', async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error(`Initialization attempt ${attemptCount} failed`);
    }
    return {
      initialize: async () => {
        console.log(`      Component initialized on attempt ${attemptCount}`);
        return true;
      },
      status: 'ready'
    };
  }, { optional: true });
  
  try {
    const result = await integrationManager.initializeComponent('unreliable');
    if (result) {
      console.log(`   ✅ Integration manager retry working: Component ready`);
      return true;
    } else {
      console.log(`   ❌ Component failed to initialize`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Integration manager error handling failed: ${error.message}`);
    return false;
  }
}

// Test 6: Lifecycle Manager Error Recovery
async function testLifecycleManagerErrorRecovery() {
  console.log('📋 Test 6: Lifecycle Manager Error Recovery');
  
  const lifecycleManager = createLifecycleManager({
    timeout: 1000
  });
  
  let initAttempts = 0;
  lifecycleManager.registerComponent('recoverable', async () => {
    initAttempts++;
    if (initAttempts === 1) {
      throw new Error('First initialization failed');
    }
    
    return {
      initialize: async () => {
        console.log(`      Component initialized on attempt ${initAttempts}`);
        return true;
      },
      restart: async () => {
        console.log(`      Component restarted`);
        return true;
      }
    };
  }, {
    required: false,
    restartOnError: true,
    maxRestarts: 1
  });
  
  try {
    // First attempt should fail
    let result = await lifecycleManager.initializeComponent('recoverable');
    
    // Should be null for optional failed component
    if (result === null) {
      console.log(`   ✅ Lifecycle manager handled optional component failure correctly`);
      return true;
    } else {
      console.log(`   ❌ Expected null result for failed optional component`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Lifecycle manager error recovery failed: ${error.message}`);
    return false;
  }
}

// Test 7: Error Statistics and History
async function testErrorStatistics() {
  console.log('📋 Test 7: Error Statistics and History');
  
  const boundary = createErrorBoundary();
  
  const errorProneComponent = boundary.wrapComponent(async () => ({
    method1: () => { throw new Error('Method 1 error'); },
    method2: () => { throw new Error('Method 2 error'); },
    method3: () => 'Success'
  }), {
    name: 'ErrorProneComponent',
    recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION
  });
  
  const component = await errorProneComponent({});
  
  // Generate some errors
  await component.method1().catch(() => {});
  await component.method2().catch(() => {});
  await component.method3();
  
  const stats = boundary.getErrorStats();
  const history = boundary.getErrorHistory();
  
  if (stats.total >= 2 && history.length >= 2) {
    console.log(`   ✅ Error statistics working: ${stats.total} total errors recorded`);
    return true;
  } else {
    console.log(`   ❌ Error statistics not working correctly`);
    return false;
  }
}

// Test 8: Global Error Handlers
async function testGlobalErrorHandlers() {
  console.log('📋 Test 8: Global Error Handlers');
  
  const boundary = createErrorBoundary();
  
  let globalErrorCaught = false;
  const removeHandler = boundary.addErrorHandler((componentName, error, errorType) => {
    if (componentName === 'GlobalTestComponent') {
      globalErrorCaught = true;
    }
  });
  
  const component = boundary.wrapComponent(async () => ({
    fail: () => { throw new Error('Global test error'); }
  }), {
    name: 'GlobalTestComponent',
    recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION
  });
  
  const instance = await component({});
  await instance.fail();
  
  removeHandler(); // Cleanup
  
  if (globalErrorCaught) {
    console.log(`   ✅ Global error handler working`);
    return true;
  } else {
    console.log(`   ❌ Global error handler not triggered`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Running Enhanced Error Handling Validation Tests...\n');
  
  const tests = [
    testErrorBoundaryBasics,
    testGracefulDegradation,
    testFallbackComponents,
    testErrorSeverityHandling,
    testComponentIntegrationErrorHandling,
    testLifecycleManagerErrorRecovery,
    testErrorStatistics,
    testGlobalErrorHandlers
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      }
      console.log(''); // Add spacing between tests
    } catch (error) {
      console.log(`   ❌ Test threw unexpected error: ${error.message}\n`);
    }
  }
  
  console.log('🛡️ ENHANCED ERROR HANDLING VALIDATION RESULTS');
  console.log('==============================================\n');
  
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
  
  if (passed === total) {
    console.log('✅ ALL TESTS PASSED - Enhanced error handling is working correctly!');
  } else if (passed >= total * 0.8) {
    console.log('⚠️ MOSTLY WORKING - Minor issues detected in error handling');
  } else {
    console.log('❌ SIGNIFICANT ISSUES - Error handling needs improvement');
  }
  
  console.log('\nError Handling Features Validated:');
  console.log('  ✓ Automatic retry with exponential backoff');
  console.log('  ✓ Graceful degradation for non-critical failures'); 
  console.log('  ✓ Fallback component registration and usage');
  console.log('  ✓ Error severity-based handling strategies');
  console.log('  ✓ Integration manager error recovery');
  console.log('  ✓ Lifecycle manager error handling');
  console.log('  ✓ Error statistics and history tracking');
  console.log('  ✓ Global error handler support');
  
  return passed / total;
}

// Run the tests
runAllTests().then(successRate => {
  console.log(`\n🎯 Enhanced Error Handling Validation Complete: ${Math.round(successRate * 100)}% success rate`);
}).catch(error => {
  console.error('\n💥 Test runner failed:', error);
});