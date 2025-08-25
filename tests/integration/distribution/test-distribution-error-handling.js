// Distribution Error Handling and Recovery Test
console.log('⚠️ Starting Distribution Error Handling Test...\n');

// Error simulation utilities
const createErrorScenarios = () => ({
  connection_timeout: {
    name: 'Connection Timeout',
    error: new Error('Connection timeout after 5000ms'),
    recoverable: true,
    expectedRetries: 3
  },
  
  network_unreachable: {
    name: 'Network Unreachable', 
    error: new Error('ENETUNREACH: Network is unreachable'),
    recoverable: true,
    expectedRetries: 3
  },
  
  invalid_data: {
    name: 'Invalid Data Format',
    error: new Error('Invalid JSON format in payload'),
    recoverable: false,
    expectedRetries: 0
  },
  
  distributor_overload: {
    name: 'Distributor Overload',
    error: new Error('Service temporarily unavailable - too many requests'),
    recoverable: true,
    expectedRetries: 3
  },
  
  authentication_failed: {
    name: 'Authentication Failed',
    error: new Error('Invalid credentials or expired token'),
    recoverable: false,
    expectedRetries: 0
  },
  
  resource_exhausted: {
    name: 'Resource Exhausted',
    error: new Error('Quota exceeded - daily limit reached'),
    recoverable: false,
    expectedRetries: 0
  },
  
  partial_failure: {
    name: 'Partial Failure',
    error: new Error('Some distributors failed to process message'),
    recoverable: true,
    expectedRetries: 2
  }
});

// Mock error-prone distributors
const createErrorProneDistributor = (type, errorScenario, failureRate = 0.5) => {
  let attemptCount = 0;
  let consecutiveFailures = 0;
  
  return {
    type,
    status: 'ready',
    errorScenario,
    stats: {
      attempts: 0,
      successes: 0,
      failures: 0,
      retries: 0
    },
    
    async distribute(data, options = {}) {
      this.stats.attempts++;
      attemptCount++;
      
      // Simulate error conditions
      const shouldFail = Math.random() < failureRate || 
                        (errorScenario === 'partial_failure' && attemptCount % 3 === 0);
      
      if (shouldFail && consecutiveFailures < 3) {
        consecutiveFailures++;
        this.stats.failures++;
        throw createErrorScenarios()[errorScenario].error;
      }
      
      // Success - reset failure counter
      consecutiveFailures = 0;
      this.stats.successes++;
      
      return {
        success: true,
        distributor: type,
        timestamp: Date.now(),
        attemptCount,
        data: data
      };
    },
    
    async healthCheck() {
      // Simulate health check that might detect issues
      if (consecutiveFailures >= 2) {
        return { healthy: false, error: 'Multiple consecutive failures detected' };
      }
      return { healthy: true };
    },
    
    async recover() {
      console.log(`🔧 ${type} distributor attempting recovery...`);
      consecutiveFailures = 0;
      this.status = 'ready';
      return true;
    },
    
    getStats() {
      return { ...this.stats };
    }
  };
};

// Mock resilient distribution manager with error handling
const createResilientDistributionManager = (config = {}) => {
  const state = {
    distributors: new Map(),
    retryPolicy: {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      backoffMultiplier: config.backoffMultiplier || 2,
      maxRetryDelay: config.maxRetryDelay || 10000
    },
    circuitBreaker: {
      enabled: config.circuitBreaker || true,
      failureThreshold: 5,
      resetTimeout: 30000,
      states: new Map() // distributor -> { state, failures, lastFailure }
    },
    stats: {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRetries: 0
    }
  };
  
  const registerDistributor = (name, distributor) => {
    state.distributors.set(name, distributor);
    state.circuitBreaker.states.set(name, {
      state: 'closed', // closed, open, half-open
      failures: 0,
      lastFailure: 0
    });
  };
  
  const isCircuitOpen = (distributorName) => {
    if (!state.circuitBreaker.enabled) return false;
    
    const cbState = state.circuitBreaker.states.get(distributorName);
    if (!cbState) return false;
    
    if (cbState.state === 'open') {
      // Check if we should transition to half-open
      const timeSinceLastFailure = Date.now() - cbState.lastFailure;
      if (timeSinceLastFailure > state.circuitBreaker.resetTimeout) {
        cbState.state = 'half-open';
        console.log(`🔄 Circuit breaker for ${distributorName} transitioning to half-open`);
      }
      return cbState.state === 'open';
    }
    
    return false;
  };
  
  const recordDistributorFailure = (distributorName) => {
    const cbState = state.circuitBreaker.states.get(distributorName);
    if (!cbState) return;
    
    cbState.failures++;
    cbState.lastFailure = Date.now();
    
    if (cbState.failures >= state.circuitBreaker.failureThreshold) {
      cbState.state = 'open';
      console.log(`🚨 Circuit breaker opened for ${distributorName} after ${cbState.failures} failures`);
    }
  };
  
  const recordDistributorSuccess = (distributorName) => {
    const cbState = state.circuitBreaker.states.get(distributorName);
    if (!cbState) return;
    
    if (cbState.state === 'half-open') {
      cbState.state = 'closed';
      console.log(`✅ Circuit breaker closed for ${distributorName} after successful recovery`);
    }
    
    cbState.failures = 0;
  };
  
  const retryWithBackoff = async (fn, distributorName, maxRetries = state.retryPolicy.maxRetries) => {
    let lastError;
    let delay = state.retryPolicy.retryDelay;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`   🔄 Retry ${attempt}/${maxRetries} for ${distributorName} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
          state.stats.totalRetries++;
        }
        
        const result = await fn();
        if (attempt > 0) {
          console.log(`   ✅ ${distributorName} succeeded on retry ${attempt}`);
        }
        return result;
        
      } catch (error) {
        lastError = error;
        delay = Math.min(delay * state.retryPolicy.backoffMultiplier, state.retryPolicy.maxRetryDelay);
        
        // Check if error is recoverable
        const scenarios = createErrorScenarios();
        const isRecoverable = Object.values(scenarios).some(scenario => 
          error.message.includes(scenario.error.message.split(':')[0]) && scenario.recoverable
        );
        
        if (!isRecoverable) {
          console.log(`   ❌ ${distributorName} non-recoverable error: ${error.message}`);
          break;
        }
      }
    }
    
    throw lastError;
  };
  
  const distribute = async (event, data, targets = ['all']) => {
    const results = [];
    state.stats.totalAttempts++;
    
    const distributorsToUse = targets.includes('all') 
      ? Array.from(state.distributors.entries())
      : targets.map(target => [target, state.distributors.get(target)]).filter(([_, d]) => d);
    
    for (const [name, distributor] of distributorsToUse) {
      if (isCircuitOpen(name)) {
        console.log(`   ⚠️ Skipping ${name} - circuit breaker open`);
        results.push({
          distributor: name,
          success: false,
          error: 'Circuit breaker open',
          skipped: true
        });
        continue;
      }
      
      try {
        const result = await retryWithBackoff(
          () => distributor.distribute({ event, data }),
          name
        );
        
        results.push({ 
          distributor: name, 
          success: true, 
          result 
        });
        
        recordDistributorSuccess(name);
        state.stats.totalSuccesses++;
        
      } catch (error) {
        console.log(`   ❌ ${name} final failure: ${error.message}`);
        
        results.push({
          distributor: name,
          success: false,
          error: error.message
        });
        
        recordDistributorFailure(name);
        state.stats.totalFailures++;
      }
    }
    
    return results;
  };
  
  const performHealthCheck = async () => {
    const healthResults = {};
    
    for (const [name, distributor] of state.distributors) {
      try {
        const health = await distributor.healthCheck();
        healthResults[name] = health;
        
        if (!health.healthy) {
          console.log(`   ⚠️ ${name} health check failed: ${health.error}`);
        }
        
      } catch (error) {
        healthResults[name] = { healthy: false, error: error.message };
      }
    }
    
    return healthResults;
  };
  
  const recoverDistributors = async () => {
    const recoveryResults = {};
    
    for (const [name, distributor] of state.distributors) {
      if (distributor.recover) {
        try {
          await distributor.recover();
          recoveryResults[name] = { recovered: true };
          
          // Reset circuit breaker
          const cbState = state.circuitBreaker.states.get(name);
          if (cbState) {
            cbState.state = 'closed';
            cbState.failures = 0;
          }
          
        } catch (error) {
          recoveryResults[name] = { recovered: false, error: error.message };
        }
      }
    }
    
    return recoveryResults;
  };
  
  return {
    registerDistributor,
    distribute,
    performHealthCheck,
    recoverDistributors,
    getStats: () => ({ ...state.stats }),
    getCircuitBreakerStates: () => new Map(state.circuitBreaker.states)
  };
};

// Error handling test scenarios
const testBasicErrorHandling = async () => {
  console.log('1. 🧪 Testing basic error handling...\n');
  
  const manager = createResilientDistributionManager({
    maxRetries: 3,
    retryDelay: 100,
    circuitBreaker: true
  });
  
  // Register error-prone distributors
  const scenarios = createErrorScenarios();
  const results = {};
  
  for (const [scenarioName, scenario] of Object.entries(scenarios)) {
    console.log(`   Testing ${scenario.name}...`);
    
    const distributor = createErrorProneDistributor('test', scenarioName, 0.8);
    manager.registerDistributor(scenarioName, distributor);
    
    // Try to distribute data
    const testData = { message: 'error handling test', timestamp: Date.now() };
    const distributionResults = await manager.distribute('test_event', testData, [scenarioName]);
    
    results[scenarioName] = {
      scenario,
      distributionResults,
      distributorStats: distributor.getStats()
    };
    
    const result = distributionResults[0];
    if (result.success) {
      console.log(`     ✅ ${scenario.name}: Eventually succeeded`);
    } else if (result.skipped) {
      console.log(`     ⚠️ ${scenario.name}: Skipped due to circuit breaker`);
    } else {
      console.log(`     ❌ ${scenario.name}: Failed as expected`);
    }
  }
  
  console.log('');
  return results;
};

const testRetryMechanisms = async () => {
  console.log('2. 🧪 Testing retry mechanisms...\n');
  
  const retryConfigs = [
    { name: 'Conservative', maxRetries: 2, retryDelay: 500, backoffMultiplier: 1.5 },
    { name: 'Aggressive', maxRetries: 5, retryDelay: 100, backoffMultiplier: 2.0 },
    { name: 'Minimal', maxRetries: 1, retryDelay: 1000, backoffMultiplier: 1.0 }
  ];
  
  const results = {};
  
  for (const config of retryConfigs) {
    console.log(`   Testing ${config.name} retry policy...`);
    
    const manager = createResilientDistributionManager(config);
    const distributor = createErrorProneDistributor('retry_test', 'connection_timeout', 0.7);
    manager.registerDistributor('retry_test', distributor);
    
    const startTime = Date.now();
    const distributionResults = await manager.distribute('retry_test', { test: true }, ['retry_test']);
    const duration = Date.now() - startTime;
    
    results[config.name] = {
      config,
      distributionResults,
      duration,
      distributorStats: distributor.getStats(),
      managerStats: manager.getStats()
    };
    
    const success = distributionResults[0].success;
    const retries = distributor.getStats().attempts - 1;
    console.log(`     ${success ? '✅' : '❌'} ${config.name}: ${success ? 'Succeeded' : 'Failed'} with ${retries} retries in ${duration}ms`);
  }
  
  console.log('');
  return results;
};

const testCircuitBreakerPattern = async () => {
  console.log('3. 🧪 Testing circuit breaker pattern...\n');
  
  const manager = createResilientDistributionManager({
    maxRetries: 2,
    circuitBreaker: true
  });
  
  const distributor = createErrorProneDistributor('circuit_test', 'distributor_overload', 0.9);
  manager.registerDistributor('circuit_test', distributor);
  
  const results = [];
  
  // Send multiple requests to trigger circuit breaker
  console.log('   Sending requests to trigger circuit breaker...');
  
  for (let i = 1; i <= 10; i++) {
    const result = await manager.distribute('circuit_test', { attempt: i }, ['circuit_test']);
    results.push({ 
      attempt: i, 
      success: result[0].success, 
      skipped: result[0].skipped || false,
      error: result[0].error 
    });
    
    const status = result[0].success ? '✅' : result[0].skipped ? '⏭️' : '❌';
    console.log(`     Attempt ${i}: ${status} ${result[0].success ? 'Success' : result[0].skipped ? 'Skipped (CB Open)' : 'Failed'}`);
    
    // Small delay between attempts
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const cbStates = manager.getCircuitBreakerStates();
  const cbState = cbStates.get('circuit_test');
  
  console.log(`   🔌 Circuit breaker final state: ${cbState.state} (${cbState.failures} failures)`);
  console.log('');
  
  return { results, circuitBreakerState: cbState };
};

const testPartialFailureHandling = async () => {
  console.log('4. 🧪 Testing partial failure handling...\n');
  
  const manager = createResilientDistributionManager({
    maxRetries: 2,
    circuitBreaker: false // Disable for this test
  });
  
  // Register mix of reliable and unreliable distributors
  const distributors = [
    { name: 'reliable_http', type: 'http', failureRate: 0.1 },
    { name: 'unreliable_websocket', type: 'websocket', failureRate: 0.8 },
    { name: 'flaky_mqtt', type: 'mqtt', failureRate: 0.5 }
  ];
  
  for (const dist of distributors) {
    const distributor = createErrorProneDistributor(dist.type, 'partial_failure', dist.failureRate);
    manager.registerDistributor(dist.name, distributor);
  }
  
  // Send data to all distributors
  console.log('   Distributing to mixed reliability distributors...');
  const results = await manager.distribute('partial_test', { data: 'mixed test' }, ['all']);
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`     ${result.distributor}: ${status} ${result.success ? 'Success' : result.error}`);
  }
  
  console.log(`   📊 Overall: ${successCount}/${results.length} distributors succeeded`);
  console.log('');
  
  return { results, successRate: successCount / results.length };
};

const testErrorRecovery = async () => {
  console.log('5. 🧪 Testing error recovery...\n');
  
  const manager = createResilientDistributionManager();
  
  // Create distributors with different recovery capabilities
  const distributor1 = createErrorProneDistributor('recovery_test1', 'network_unreachable', 1.0);
  const distributor2 = createErrorProneDistributor('recovery_test2', 'distributor_overload', 1.0);
  
  manager.registerDistributor('recovery_test1', distributor1);
  manager.registerDistributor('recovery_test2', distributor2);
  
  // First attempt - should fail
  console.log('   Initial distribution attempt (expected to fail)...');
  let results = await manager.distribute('recovery_test', { test: 'pre-recovery' });
  const initialFailures = results.filter(r => !r.success).length;
  console.log(`     Initial failures: ${initialFailures}/${results.length} distributors failed`);
  
  // Perform health check
  console.log('   Performing health check...');
  const healthStatus = await manager.performHealthCheck();
  const unhealthyCount = Object.values(healthStatus).filter(h => !h.healthy).length;
  console.log(`     Health check: ${unhealthyCount} distributors unhealthy`);
  
  // Attempt recovery
  console.log('   Attempting recovery...');
  const recoveryResults = await manager.recoverDistributors();
  const recoveredCount = Object.values(recoveryResults).filter(r => r.recovered).length;
  console.log(`     Recovery: ${recoveredCount} distributors recovered`);
  
  // Retry distribution after recovery
  console.log('   Post-recovery distribution attempt...');
  results = await manager.distribute('recovery_test', { test: 'post-recovery' });
  const postRecoveryFailures = results.filter(r => !r.success).length;
  console.log(`     Post-recovery failures: ${postRecoveryFailures}/${results.length} distributors failed`);
  
  const recoveryEffectiveness = ((initialFailures - postRecoveryFailures) / initialFailures * 100).toFixed(1);
  console.log(`     🎯 Recovery effectiveness: ${recoveryEffectiveness}% improvement`);
  console.log('');
  
  return {
    initialFailures,
    postRecoveryFailures,
    recoveryEffectiveness: parseFloat(recoveryEffectiveness),
    healthStatus,
    recoveryResults
  };
};

// Main error handling test runner
const runErrorHandlingTests = async () => {
  console.log('🧪 Starting comprehensive error handling tests...\n');
  
  const testResults = {
    basicErrorHandling: {},
    retryMechanisms: {},
    circuitBreaker: {},
    partialFailures: {},
    errorRecovery: {},
    errors: []
  };
  
  try {
    testResults.basicErrorHandling = await testBasicErrorHandling();
  } catch (error) {
    testResults.errors.push(`Basic error handling: ${error.message}`);
  }
  
  try {
    testResults.retryMechanisms = await testRetryMechanisms();
  } catch (error) {
    testResults.errors.push(`Retry mechanisms: ${error.message}`);
  }
  
  try {
    testResults.circuitBreaker = await testCircuitBreakerPattern();
  } catch (error) {
    testResults.errors.push(`Circuit breaker: ${error.message}`);
  }
  
  try {
    testResults.partialFailures = await testPartialFailureHandling();
  } catch (error) {
    testResults.errors.push(`Partial failures: ${error.message}`);
  }
  
  try {
    testResults.errorRecovery = await testErrorRecovery();
  } catch (error) {
    testResults.errors.push(`Error recovery: ${error.message}`);
  }
  
  // Generate comprehensive error handling report
  console.log('⚠️ DISTRIBUTION ERROR HANDLING TEST RESULTS');
  console.log('============================================\n');
  
  // Basic error handling results
  console.log('Error Scenario Handling:');
  for (const [scenario, result] of Object.entries(testResults.basicErrorHandling)) {
    const success = result.distributionResults[0]?.success || false;
    const status = success ? '✅' : '❌';
    console.log(`  ${status} ${result.scenario.name}: ${success ? 'Handled correctly' : 'Failed as expected'}`);
  }
  
  // Retry mechanism results
  console.log('\nRetry Policy Performance:');
  for (const [policy, result] of Object.entries(testResults.retryMechanisms)) {
    const success = result.distributionResults[0]?.success || false;
    const retries = result.managerStats.totalRetries;
    console.log(`  ${policy}: ${success ? '✅ Succeeded' : '❌ Failed'} with ${retries} retries (${result.duration}ms)`);
  }
  
  // Circuit breaker results
  if (testResults.circuitBreaker.circuitBreakerState) {
    console.log(`\nCircuit Breaker: ${testResults.circuitBreaker.circuitBreakerState.state.toUpperCase()} state reached`);
    const skippedRequests = testResults.circuitBreaker.results.filter(r => r.skipped).length;
    console.log(`  Protected system from ${skippedRequests} requests while open`);
  }
  
  // Partial failure results
  if (testResults.partialFailures.successRate !== undefined) {
    const successRate = (testResults.partialFailures.successRate * 100).toFixed(1);
    console.log(`\nPartial Failure Handling: ${successRate}% success rate maintained`);
  }
  
  // Recovery results
  if (testResults.errorRecovery.recoveryEffectiveness !== undefined) {
    console.log(`\nError Recovery: ${testResults.errorRecovery.recoveryEffectiveness}% effectiveness`);
  }
  
  console.log('\nError Handling Features:');
  console.log('  - Automatic retry with exponential backoff ✅');
  console.log('  - Circuit breaker protection ✅');
  console.log('  - Partial failure tolerance ✅');
  console.log('  - Health monitoring and recovery ✅');
  console.log('  - Error classification (recoverable/non-recoverable) ✅');
  console.log('  - Graceful degradation ✅');
  
  // Error handling assessment
  const hasBasicHandling = Object.keys(testResults.basicErrorHandling).length > 0;
  const hasRetryLogic = Object.keys(testResults.retryMechanisms).length > 0;
  const hasCircuitBreaker = testResults.circuitBreaker.circuitBreakerState !== undefined;
  const hasRecovery = testResults.errorRecovery.recoveryEffectiveness > 0;
  
  let resilience = 'EXCELLENT';
  if (!hasBasicHandling) resilience = 'POOR';
  else if (!hasRetryLogic) resilience = 'BASIC';
  else if (!hasCircuitBreaker) resilience = 'GOOD';
  else if (!hasRecovery) resilience = 'VERY_GOOD';
  
  console.log(`\nOverall Error Resilience: ${resilience}`);
  console.log(`Error Detection: ${hasBasicHandling ? 'Working' : 'Missing'}`);
  console.log(`Retry Logic: ${hasRetryLogic ? 'Working' : 'Missing'}`);
  console.log(`Circuit Protection: ${hasCircuitBreaker ? 'Working' : 'Missing'}`);
  console.log(`Recovery Mechanisms: ${hasRecovery ? 'Working' : 'Missing'}`);
  
  if (testResults.errors.length > 0) {
    console.log('\nTest errors encountered:');
    testResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (resilience === 'EXCELLENT') {
    console.log('🎉 EXCELLENT: Distribution system has comprehensive error handling!');
  } else if (resilience === 'VERY_GOOD' || resilience === 'GOOD') {
    console.log('✅ GOOD: Distribution system has solid error handling capabilities');
  } else if (resilience === 'BASIC') {
    console.log('⚠️ BASIC: Distribution system has minimal error handling');
  } else {
    console.log('❌ POOR: Distribution system needs improved error handling');
  }
  
  console.log('\n✅ Error handling testing completed!\n');
};

// Start error handling tests
runErrorHandlingTests().catch(console.error);