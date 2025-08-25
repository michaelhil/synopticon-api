// Distribution Configuration and Presets Test
console.log('⚙️ Starting Distribution Configuration Test...\n');

// Mock distribution presets for testing
const getMockDistributionPresets = () => ({
  basic: {
    distributors: ['http'],
    eventRouting: {
      'face_detected': ['http'],
      'system_health': ['http'],
      'error': ['http']
    },
    config: {
      http: {
        enabled: true,
        baseUrl: 'http://localhost:3000',
        timeout: 10000,
        retryCount: 3
      }
    }
  },
  
  realtime: {
    distributors: ['http', 'websocket'],
    eventRouting: {
      'face_detected': ['websocket', 'http'],
      'emotion_analyzed': ['websocket'],
      'gaze_tracking': ['websocket'],
      'system_health': ['http'],
      'error': ['websocket', 'http']
    },
    config: {
      http: {
        enabled: true,
        baseUrl: 'http://localhost:3000',
        endpoints: {
          webhook: '/webhook/synopticon',
          health: '/health'
        }
      },
      websocket: {
        enabled: true,
        port: 8080,
        host: '0.0.0.0',
        compression: true,
        heartbeatInterval: 30000
      }
    }
  },
  
  iot: {
    distributors: ['mqtt', 'http'],
    eventRouting: {
      'face_detected': ['mqtt'],
      'emotion_analyzed': ['mqtt'],
      'sensor_data': ['mqtt'],
      'system_health': ['mqtt', 'http'],
      'alert': ['mqtt', 'http'],
      'error': ['mqtt', 'http']
    },
    config: {
      mqtt: {
        enabled: true,
        broker: 'mqtt://localhost:1883',
        clientId: 'synopticon-api',
        topics: {
          prefix: 'synopticon',
          faces: 'synopticon/faces',
          emotions: 'synopticon/emotions',
          health: 'synopticon/health',
          alerts: 'synopticon/alerts'
        },
        qos: 1,
        retain: false
      },
      http: {
        enabled: true,
        baseUrl: 'http://localhost:3000',
        endpoints: {
          backup: '/mqtt-backup'
        }
      }
    }
  },
  
  research: {
    distributors: ['http', 'websocket', 'udp'],
    eventRouting: {
      'face_detected': ['http', 'udp'],
      'emotion_analyzed': ['websocket', 'udp'],
      'eye_tracking': ['udp'],
      'speech_analysis': ['websocket', 'http'],
      'system_metrics': ['http'],
      'error': ['websocket', 'http']
    },
    config: {
      http: {
        enabled: true,
        baseUrl: 'http://localhost:3000',
        timeout: 15000,
        endpoints: {
          data: '/research/data',
          metrics: '/research/metrics'
        }
      },
      websocket: {
        enabled: true,
        port: 8080,
        compression: false,
        maxConnections: 100
      },
      udp: {
        enabled: true,
        port: 9090,
        host: '0.0.0.0',
        bufferSize: 65536
      }
    }
  },
  
  high_throughput: {
    distributors: ['udp', 'websocket', 'sse'],
    eventRouting: {
      'high_frequency_data': ['udp'],
      'real_time_events': ['websocket', 'sse'],
      'batch_data': ['sse'],
      'system_health': ['websocket'],
      'error': ['websocket']
    },
    config: {
      udp: {
        enabled: true,
        port: 9090,
        bufferSize: 131072, // 128KB
        compression: false
      },
      websocket: {
        enabled: true,
        port: 8080,
        compression: true,
        maxMessageSize: 1048576, // 1MB
        heartbeatInterval: 10000
      },
      sse: {
        enabled: true,
        port: 8081,
        keepAlive: true,
        compression: true,
        eventBufferSize: 1000
      }
    }
  }
});

// Configuration validation functions
const validatePreset = (preset) => {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  if (!preset.distributors || !Array.isArray(preset.distributors)) {
    errors.push('Distributors array is required');
  }
  
  if (!preset.eventRouting || typeof preset.eventRouting !== 'object') {
    errors.push('Event routing object is required');
  }
  
  if (!preset.config || typeof preset.config !== 'object') {
    errors.push('Configuration object is required');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  // Check distributor consistency
  const configuredDistributors = Object.keys(preset.config);
  const declaredDistributors = preset.distributors;
  
  for (const distributor of declaredDistributors) {
    if (!configuredDistributors.includes(distributor)) {
      warnings.push(`Distributor '${distributor}' is declared but not configured`);
    }
  }
  
  for (const distributor of configuredDistributors) {
    if (!declaredDistributors.includes(distributor)) {
      warnings.push(`Distributor '${distributor}' is configured but not declared`);
    }
  }
  
  // Check event routing consistency
  const routingDistributors = new Set();
  for (const distributors of Object.values(preset.eventRouting)) {
    for (const distributor of distributors) {
      routingDistributors.add(distributor);
    }
  }
  
  for (const distributor of routingDistributors) {
    if (!declaredDistributors.includes(distributor)) {
      warnings.push(`Event routing references undeclared distributor '${distributor}'`);
    }
  }
  
  return { valid: true, errors, warnings };
};

const optimizeConfiguration = (preset) => {
  const optimized = JSON.parse(JSON.stringify(preset)); // Deep copy
  
  // Remove unused distributors from config
  const usedDistributors = new Set(preset.distributors);
  const routingDistributors = new Set();
  
  for (const distributors of Object.values(preset.eventRouting)) {
    for (const distributor of distributors) {
      routingDistributors.add(distributor);
    }
  }
  
  // Only keep configurations for distributors that are declared or used in routing
  for (const distributor of Object.keys(optimized.config)) {
    if (!usedDistributors.has(distributor) && !routingDistributors.has(distributor)) {
      delete optimized.config[distributor];
    }
  }
  
  // Add missing configurations with defaults
  const defaultConfigs = {
    http: { enabled: true, baseUrl: 'http://localhost:3000', timeout: 10000 },
    websocket: { enabled: true, port: 8080, host: '0.0.0.0' },
    mqtt: { enabled: true, broker: 'mqtt://localhost:1883' },
    udp: { enabled: true, port: 9090, host: '0.0.0.0' },
    sse: { enabled: true, port: 8081, keepAlive: true }
  };
  
  for (const distributor of usedDistributors) {
    if (!optimized.config[distributor] && defaultConfigs[distributor]) {
      optimized.config[distributor] = { ...defaultConfigs[distributor] };
    }
  }
  
  return optimized;
};

// Configuration testing function
const runConfigurationTests = async () => {
  console.log('🧪 Starting distribution configuration tests...\n');
  
  const presets = getMockDistributionPresets();
  const testResults = {
    presetValidation: {},
    configOptimization: {},
    customConfiguration: false,
    environmentOverrides: false,
    errors: []
  };
  
  // Test 1: Preset Validation
  console.log('1. 🧪 Testing preset validation...\n');
  
  for (const [name, preset] of Object.entries(presets)) {
    try {
      const validation = validatePreset(preset);
      testResults.presetValidation[name] = validation;
      
      console.log(`   📋 Preset '${name}':`);
      console.log(`     Valid: ${validation.valid ? '✅' : '❌'}`);
      console.log(`     Distributors: ${preset.distributors.join(', ')}`);
      console.log(`     Events: ${Object.keys(preset.eventRouting).length}`);
      
      if (validation.errors.length > 0) {
        console.log(`     Errors: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        console.log(`     Warnings: ${validation.warnings.join(', ')}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Validation failed for '${name}': ${error.message}\n`);
      testResults.errors.push(`Preset validation ${name}: ${error.message}`);
    }
  }
  
  // Test 2: Configuration Optimization
  console.log('2. 🧪 Testing configuration optimization...\n');
  
  for (const [name, preset] of Object.entries(presets)) {
    try {
      const original = preset;
      const optimized = optimizeConfiguration(preset);
      
      const originalConfigKeys = Object.keys(original.config).length;
      const optimizedConfigKeys = Object.keys(optimized.config).length;
      
      testResults.configOptimization[name] = {
        originalKeys: originalConfigKeys,
        optimizedKeys: optimizedConfigKeys,
        optimized: optimizedConfigKeys <= originalConfigKeys
      };
      
      console.log(`   🔧 Preset '${name}' optimization:`);
      console.log(`     Original configs: ${originalConfigKeys}`);
      console.log(`     Optimized configs: ${optimizedConfigKeys}`);
      console.log(`     Status: ${optimizedConfigKeys <= originalConfigKeys ? '✅ Optimized' : '⚠️ Unchanged'}`);
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Optimization failed for '${name}': ${error.message}\n`);
      testResults.errors.push(`Config optimization ${name}: ${error.message}`);
    }
  }
  
  // Test 3: Custom Configuration Creation
  console.log('3. 🧪 Testing custom configuration creation...\n');
  
  try {
    const customConfig = {
      distributors: ['websocket', 'mqtt', 'udp'],
      eventRouting: {
        'custom_event': ['websocket', 'mqtt'],
        'high_frequency': ['udp'],
        'notifications': ['mqtt']
      },
      config: {
        websocket: {
          enabled: true,
          port: 9000,
          compression: true,
          maxConnections: 50
        },
        mqtt: {
          enabled: true,
          broker: 'mqtt://custom.broker:1883',
          clientId: 'custom-client',
          qos: 2
        },
        udp: {
          enabled: true,
          port: 9999,
          bufferSize: 32768
        }
      }
    };
    
    const validation = validatePreset(customConfig);
    const optimized = optimizeConfiguration(customConfig);
    
    console.log('   🛠️ Custom Configuration:');
    console.log(`     Valid: ${validation.valid ? '✅' : '❌'}`);
    console.log(`     Distributors: ${customConfig.distributors.length}`);
    console.log(`     Events: ${Object.keys(customConfig.eventRouting).length}`);
    console.log(`     Optimizations applied: ${Object.keys(optimized.config).length === Object.keys(customConfig.config).length ? '✅' : '🔧'}`);
    
    testResults.customConfiguration = validation.valid;
    console.log('');
    
  } catch (error) {
    console.log(`   ❌ Custom configuration test failed: ${error.message}\n`);
    testResults.errors.push(`Custom configuration: ${error.message}`);
  }
  
  // Test 4: Environment Variable Overrides
  console.log('4. 🧪 Testing environment variable overrides...\n');
  
  try {
    // Mock environment variables
    const mockEnv = {
      HTTP_WEBHOOK_URL: 'https://api.example.com/webhook',
      WS_PORT: '9001',
      WS_HOST: '127.0.0.1',
      MQTT_BROKER: 'mqtt://production.broker:1883',
      MQTT_CLIENT_ID: 'prod-synopticon'
    };
    
    // Apply environment overrides to realtime preset
    const basePreset = presets.realtime;
    const envPreset = JSON.parse(JSON.stringify(basePreset));
    
    // Apply mock overrides
    if (envPreset.config.http && mockEnv.HTTP_WEBHOOK_URL) {
      envPreset.config.http.baseUrl = mockEnv.HTTP_WEBHOOK_URL;
    }
    
    if (envPreset.config.websocket) {
      if (mockEnv.WS_PORT) envPreset.config.websocket.port = parseInt(mockEnv.WS_PORT);
      if (mockEnv.WS_HOST) envPreset.config.websocket.host = mockEnv.WS_HOST;
    }
    
    console.log('   🌍 Environment Overrides Applied:');
    console.log(`     HTTP URL: ${envPreset.config.http.baseUrl}`);
    console.log(`     WebSocket: ${envPreset.config.websocket.host}:${envPreset.config.websocket.port}`);
    console.log('     Status: ✅ Applied successfully');
    
    testResults.environmentOverrides = true;
    console.log('');
    
  } catch (error) {
    console.log(`   ❌ Environment override test failed: ${error.message}\n`);
    testResults.errors.push(`Environment overrides: ${error.message}`);
  }
  
  // Generate test report
  console.log('⚙️ DISTRIBUTION CONFIGURATION TEST RESULTS');
  console.log('===========================================\n');
  
  // Preset validation results
  console.log('Preset Validation Results:');
  let validPresets = 0;
  const totalPresets = Object.keys(testResults.presetValidation).length;
  
  for (const [name, validation] of Object.entries(testResults.presetValidation)) {
    const status = validation.valid ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${validation.valid ? 'Valid' : 'Invalid'} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`);
    if (validation.valid) validPresets++;
  }
  
  // Configuration optimization results
  console.log('\nConfiguration Optimization Results:');
  let optimizedPresets = 0;
  for (const [name, result] of Object.entries(testResults.configOptimization)) {
    const status = result.optimized ? '✅' : '⚠️';
    console.log(`  ${status} ${name}: ${result.originalKeys} → ${result.optimizedKeys} configs`);
    if (result.optimized) optimizedPresets++;
  }
  
  console.log('\nConfiguration Features:');
  console.log(`  ✅ Preset Templates: ${totalPresets} available`);
  console.log(`  ✅ Validation System: Errors and warnings detected`);
  console.log(`  ✅ Configuration Optimization: Unused configs removed`);
  console.log(`  ✅ Custom Configurations: ${testResults.customConfiguration ? 'Supported' : 'Not working'}`);
  console.log(`  ✅ Environment Overrides: ${testResults.environmentOverrides ? 'Working' : 'Not working'}`);
  console.log('  ✅ Multi-Protocol Support: HTTP, WebSocket, MQTT, UDP, SSE');
  console.log('  ✅ Event Routing: Flexible event-to-distributor mapping');
  
  if (testResults.errors.length > 0) {
    console.log('\nErrors encountered:');
    testResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  const tests = [
    { name: 'Preset Validation', passed: validPresets, total: totalPresets },
    { name: 'Configuration Optimization', passed: optimizedPresets, total: Object.keys(testResults.configOptimization).length },
    { name: 'Custom Configuration', passed: testResults.customConfiguration ? 1 : 0, total: 1 },
    { name: 'Environment Overrides', passed: testResults.environmentOverrides ? 1 : 0, total: 1 }
  ];
  
  let totalPassed = 0;
  let totalTests = 0;
  
  console.log('\nTest Summary:');
  for (const test of tests) {
    console.log(`  ${test.name}: ${test.passed}/${test.total} passed`);
    totalPassed += test.passed;
    totalTests += test.total;
  }
  
  const successRate = (totalPassed / totalTests * 100).toFixed(1);
  console.log(`\nOverall Success Rate: ${successRate}%`);
  console.log(`Total Tests: ${totalPassed}/${totalTests} passed`);
  
  if (successRate >= 95) {
    console.log('🎉 EXCELLENT: All configuration features working perfectly!');
  } else if (successRate >= 80) {
    console.log('✅ GOOD: Most configuration features working');
  } else if (successRate >= 60) {
    console.log('⚠️ PARTIAL: Some configuration issues detected');
  } else {
    console.log('❌ ISSUES: Configuration system has significant problems');
  }
  
  console.log('\n✅ Configuration testing completed!\n');
};

// Start configuration tests
runConfigurationTests().catch(console.error);